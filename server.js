const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import routes
const authRoutes = require('./routes/auth');
const matchingRoutes = require('./routes/matching');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);
app.use('/api/matching', matchingRoutes);

// Store socket connections by user ID
const userSockets = new Map();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/share_a_plate')
    .then(() => {
        console.log('\n=== MongoDB Connection ===');
        console.log('Connected to MongoDB successfully');
        console.log('Database:', process.env.MONGODB_URI || 'mongodb://localhost:27017/share_a_plate');
        console.log('========================\n');
    })
    .catch(err => {
        console.error('\n=== MongoDB Connection Error ===');
        console.error('Error connecting to MongoDB:', err);
        console.error('Connection string:', process.env.MONGODB_URI || 'mongodb://localhost:27017/share_a_plate');
        console.error('===========================\n');
    });

// Log all database operations
mongoose.set('debug', true);

// Basic route
app.get('/', (req, res) => {
  res.send('Share A Plate API is running');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  // Handle joining user's room
  socket.on('joinRoom', (userId) => {
    console.log(`User ${userId} joined their room`);
    socket.join(userId);
    userSockets.set(userId, socket);
  });

  // Handle location updates
  socket.on('userLocation', (data) => {
    console.log('Location update:', data);
    socket.broadcast.emit('locationUpdate', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Remove user from socket map
    for (const [userId, userSocket] of userSockets.entries()) {
      if (userSocket === socket) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

// Make io available to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 