const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get current matches for a user
router.get('/current', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const response = {
      currentMatch: null,
      pendingRequest: null,
      incomingRequest: null
    };

    // Get current match if exists
    if (currentUser.currentMatch) {
      const match = await User.findById(currentUser.currentMatch).select('-password');
      response.currentMatch = match;
    }

    // Get pending request if exists
    if (currentUser.pendingRequest) {
      const request = await User.findById(currentUser.pendingRequest).select('-password');
      response.pendingRequest = request;
    }

    // Get incoming request if exists
    if (currentUser.incomingRequest) {
      const incoming = await User.findById(currentUser.incomingRequest).select('-password');
      response.incomingRequest = incoming;
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error getting matches', error: error.message });
  }
});

// Get nearby available users (restaurants for volunteers, volunteers for restaurants)
router.get('/nearby', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000 } = req.query;

    // Validate parameters
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: 'Invalid latitude or longitude values' });
    }

    const distance = parseInt(maxDistance);
    if (isNaN(distance) || distance <= 0) {
      return res.status(400).json({ message: 'Invalid maxDistance value' });
    }

    // Get opposite user type
    const userType = req.user.userType === 'restaurant' ? 'volunteer' : 'restaurant';

    console.log('Searching for nearby users:', {
      userType,
      latitude: lat,
      longitude: lng,
      maxDistance: distance
    });

    // Find nearby users
    const nearbyUsers = await User.find({
      userType,
      isAvailable: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat] // MongoDB expects [longitude, latitude]
          },
          $maxDistance: distance
        }
      }
    }).select('-password');

    console.log(`Found ${nearbyUsers.length} nearby ${userType}s`);

    res.json(nearbyUsers);
  } catch (error) {
    console.error('Error finding nearby users:', error);
    res.status(500).json({ 
      message: 'Error finding nearby users', 
      error: error.message 
    });
  }
});

// Request a match
router.post('/request-match', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    
    // Validate target user ID
    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    // Get current user
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }

    // Check if current user is available
    if (!currentUser.isAvailable) {
      return res.status(400).json({ message: 'You must be available to request a match' });
    }

    // Check if current user already has a pending request or match
    if (currentUser.pendingRequest || currentUser.currentMatch) {
      return res.status(400).json({ message: 'You already have a pending request or active match' });
    }

    // Get target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check if target user is available
    if (!targetUser.isAvailable) {
      return res.status(400).json({ message: 'Target user is not available' });
    }

    // Check if target user already has a pending request or match
    if (targetUser.pendingRequest || targetUser.currentMatch) {
      return res.status(400).json({ message: 'Target user already has a pending request or active match' });
    }

    // Verify user types match (volunteer to restaurant or vice versa)
    if (currentUser.userType === targetUser.userType) {
      return res.status(400).json({ message: 'Invalid match: users must be of different types' });
    }

    // Create a pending request
    currentUser.pendingRequest = targetUserId;
    await currentUser.save();

    // Update target user to show incoming request
    targetUser.incomingRequest = currentUser._id;
    await targetUser.save();

    // Try to emit socket event
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(targetUser._id.toString()).emit('matchRequest', {
          from: {
            id: currentUser._id,
            name: currentUser.name,
            userType: currentUser.userType
          }
        });
      }
    } catch (socketError) {
      console.error('Socket error:', socketError);
      // Continue with the request even if socket fails
    }

    res.json({ 
      message: 'Match request sent successfully',
      requestId: currentUser._id
    });
  } catch (error) {
    console.error('Error in request-match:', error);
    res.status(500).json({ 
      message: 'Error creating match request', 
      error: error.message 
    });
  }
});

// Accept a match request
router.post('/accept-match', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const requestingUser = await User.findOne({ pendingRequest: currentUser._id });

    if (!requestingUser) {
      return res.status(400).json({ message: 'No pending request found' });
    }

    // Update both users' availability and current match
    currentUser.isAvailable = false;
    currentUser.currentMatch = requestingUser._id;
    currentUser.pendingRequest = null;
    currentUser.incomingRequest = null;  // Clear incoming request
    await currentUser.save();

    requestingUser.isAvailable = false;
    requestingUser.currentMatch = currentUser._id;
    requestingUser.pendingRequest = null;
    requestingUser.incomingRequest = null;  // Clear incoming request
    await requestingUser.save();

    // Emit socket event to notify the volunteer
    req.app.get('io').to(requestingUser._id.toString()).emit('matchAccepted', {
      from: {
        id: currentUser._id,
        name: currentUser.name,
        userType: currentUser.userType
      }
    });

    res.json({ message: 'Match accepted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting match', error: error.message });
  }
});

// Complete delivery
router.post('/complete-delivery', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const matchedUser = await User.findById(currentUser.currentMatch);

    if (!matchedUser) {
      return res.status(400).json({ message: 'No active match found' });
    }

    // Reset availability for both users
    currentUser.isAvailable = true;
    currentUser.currentMatch = null;
    await currentUser.save();

    matchedUser.isAvailable = true;
    matchedUser.currentMatch = null;
    await matchedUser.save();

    res.json({ message: 'Delivery completed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error completing delivery', error: error.message });
  }
});

// Decline a match request
router.post('/decline-match', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const requestingUser = await User.findOne({ pendingRequest: currentUser._id });

    if (!requestingUser) {
      return res.status(400).json({ message: 'No pending request found' });
    }

    // Clear the request from both users
    currentUser.incomingRequest = null;
    await currentUser.save();

    requestingUser.pendingRequest = null;
    await requestingUser.save();

    // Emit socket event to notify the volunteer
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(requestingUser._id.toString()).emit('matchDeclined', {
          from: {
            id: currentUser._id,
            name: currentUser.name,
            userType: currentUser.userType
          }
        });
      }
    } catch (socketError) {
      console.error('Socket error:', socketError);
    }

    res.json({ message: 'Match request declined successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error declining match', error: error.message });
  }
});

module.exports = router; 