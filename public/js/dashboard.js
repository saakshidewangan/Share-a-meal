// Initialize variables
let map;
let userMarker;
let userLocation;
let nearbyMarkers = [];
let socket;
let currentUser;

// DOM Elements
const mapView = document.getElementById('mapView');
const matchesView = document.getElementById('matchesView');
const historyView = document.getElementById('historyView');
const mapTab = document.getElementById('mapTab');
const matchesTab = document.getElementById('matchesTab');
const historyTab = document.getElementById('historyTab');
const refreshMapBtn = document.getElementById('refreshMap');
const centerMapBtn = document.getElementById('centerMap');
const availabilityToggle = document.getElementById('availabilityToggle');
const logoutBtn = document.getElementById('logoutBtn');
const matchModal = new bootstrap.Modal(document.getElementById('matchModal'));
const acceptMatchBtn = document.getElementById('acceptMatch');
const distanceFilter = document.getElementById('distanceFilter');
const distanceFilterGroup = document.getElementById('distanceFilterGroup');
const matchesTitle = document.getElementById('matchesTitle');

// Initialize the application
async function init() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Get user data
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = '/';
        return;
    }

    // Set user location from stored coordinates
    userLocation = {
        lat: currentUser.location.coordinates[1],
        lng: currentUser.location.coordinates[0]
    };

    // Update UI with user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userTypeDisplay').textContent = 
        currentUser.userType === 'restaurant' ? 'Restaurant' : 'Volunteer';
    document.getElementById('userEmail').textContent = currentUser.email;
    availabilityToggle.checked = currentUser.isAvailable;

    // Show/hide distance filter based on user type
    distanceFilterGroup.style.display = currentUser.userType === 'volunteer' ? 'block' : 'none';
    matchesTitle.textContent = currentUser.userType === 'restaurant' ? 'Volunteer Requests' : 'My Requests';

    // Initialize map
    initMap();
    initSocket();
    await loadNearbyUsers();
    await loadMatches();
}

// Initialize the map
function initMap() {
    // Initialize map with user's location
    map = L.map('map').setView([userLocation.lat, userLocation.lng], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add user marker
    userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
            className: 'user-marker',
            html: `<i class="fas fa-${currentUser.userType === 'restaurant' ? 'store' : 'user'}"></i>`,
            iconSize: [30, 30]
        })
    }).addTo(map);

    userMarker.bindPopup(`
        <div class="popup-content">
            <h6>${currentUser.name}</h6>
            <p>${currentUser.userType === 'restaurant' ? 'Restaurant' : 'Volunteer'}</p>
            <p class="text-muted">Your Location</p>
        </div>
    `);

    // Center map button functionality
    centerMapBtn.addEventListener('click', () => {
        map.setView([userLocation.lat, userLocation.lng], 14);
    });
}

// Initialize Socket.IO connection
function initSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
        // Join user's room for receiving notifications
        socket.emit('joinRoom', currentUser._id);
        socket.emit('userLocation', {
            userId: currentUser._id,
            location: userLocation
        });
    });

    socket.on('locationUpdate', (data) => {
        updateNearbyUserLocation(data);
    });

    socket.on('matchRequest', (data) => {
        console.log('Received match request:', data);
        showMatchRequest(data);
        // Reload matches to show the pending request
        loadMatches();
    });

    socket.on('matchAccepted', (data) => {
        console.log('Match accepted:', data);
        matchModal.hide();
        loadMatches();
        alert('Your match request was accepted!');
    });

    socket.on('matchDeclined', (data) => {
        console.log('Match declined:', data);
        matchModal.hide();
        loadMatches();
        alert('Your match request was declined.');
    });
}

// Update user's location on the map
function updateUserLocation() {
    if (!userLocation) return;

    if (userMarker) {
        userMarker.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
        userMarker = L.marker([userLocation.lat, userLocation.lng], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<i class="fas fa-user-circle"></i>',
                iconSize: [30, 30]
            })
        }).addTo(map);
    }

    // Update location on server
    socket.emit('locationUpdate', {
        userId: currentUser.id,
        location: userLocation
    });
}

// Load nearby users
async function loadNearbyUsers() {
    try {
        // Check if location is available
        if (!userLocation || !userLocation.lat || !userLocation.lng) {
            console.error('Invalid user location:', userLocation);
            return;
        }

        const maxDistance = parseInt(distanceFilter.value);
        console.log('Fetching nearby users with params:', {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            maxDistance,
            userType: currentUser.userType
        });

        const response = await fetch(
            `/api/matching/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&maxDistance=${maxDistance}`, 
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load nearby users');
        }

        const users = await response.json();
        console.log('Nearby users received:', users);

        if (users.length === 0) {
            console.log('No nearby users found within', maxDistance, 'meters');
        }

        updateNearbyMarkers(users);
    } catch (error) {
        console.error('Error loading nearby users:', error);
        alert('Error loading nearby users: ' + error.message);
    }
}

// Update markers for nearby users
function updateNearbyMarkers(users) {
    try {
        // Clear existing markers
        nearbyMarkers.forEach(marker => marker.remove());
        nearbyMarkers = [];

        console.log('Updating markers for', users.length, 'users');

        // Add new markers
        users.forEach(user => {
            // Verify coordinates
            if (!user.location || !user.location.coordinates || user.location.coordinates.length !== 2) {
                console.error('Invalid user location data:', user);
                return;
            }

            const userLat = user.location.coordinates[1];
            const userLng = user.location.coordinates[0];
            
            console.log('Adding marker for user:', {
                name: user.name,
                type: user.userType,
                coordinates: [userLat, userLng]
            });

            const marker = L.marker([userLat, userLng], {
                icon: L.divIcon({
                    className: user.userType === 'restaurant' ? 'restaurant-marker' : 'volunteer-marker',
                    html: `<i class="fas fa-${user.userType === 'restaurant' ? 'store' : 'user'}"></i>`,
                    iconSize: [30, 30]
                })
            }).addTo(map);

            const distance = calculateDistance(
                { lat: userLocation.lat, lng: userLocation.lng },
                { lat: userLat, lng: userLng }
            );

            marker.bindPopup(`
                <div class="popup-content">
                    <h6>${user.name}</h6>
                    <p>${user.userType === 'restaurant' ? 'Restaurant' : 'Volunteer'}</p>
                    <p class="text-muted">Distance: ${distance} km</p>
                    ${currentUser.userType === 'volunteer' ? `
                        <button class="btn btn-sm btn-primary request-match" data-user-id="${user._id}">
                            Request Pickup
                        </button>
                    ` : ''}
                </div>
            `);

            marker.on('popupopen', () => {
                const requestBtn = document.querySelector('.request-match');
                if (requestBtn) {
                    requestBtn.addEventListener('click', () => requestMatch(user));
                }
            });

            nearbyMarkers.push(marker);
        });

        // Fit map bounds to show all markers
        if (nearbyMarkers.length > 0) {
            const group = new L.featureGroup([userMarker, ...nearbyMarkers]);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    } catch (error) {
        console.error('Error updating markers:', error);
    }
}

// Request a match with a restaurant
async function requestMatch(targetUser) {
    try {
        console.log('Requesting match with:', targetUser);
        
        // Check if user is available
        if (!currentUser.isAvailable) {
            alert('You must be available to request a match. Please toggle your availability.');
            return;
        }

        const response = await fetch('/api/matching/request-match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                targetUserId: targetUser._id
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to request match');
        }

        // Close the popup
        map.closePopup();
        
        alert('Request sent successfully! Please check the Matches tab for updates.');
        await loadMatches();
    } catch (error) {
        console.error('Error requesting match:', error);
        alert(error.message || 'Failed to request match. Please try again.');
    }
}

// Show match request modal
function showMatchRequest(data) {
    console.log('Showing match request modal for:', data);
    const modalContent = document.querySelector('#matchModal .modal-body');
    modalContent.innerHTML = `
        <div class="text-center">
            <h5>New Match Request</h5>
            <p>${data.from.name} (${data.from.userType}) wants to connect with you!</p>
            <div class="mt-3">
                <button class="btn btn-success me-2" onclick="acceptMatch('${data.from.id}')">Accept</button>
                <button class="btn btn-danger" onclick="declineMatch('${data.from.id}')">Decline</button>
            </div>
        </div>
    `;
    matchModal.show();
}

// Accept match request
async function acceptMatch(userId) {
    try {
        const response = await fetch('/api/matching/accept-match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            throw new Error('Failed to accept match');
        }

        matchModal.hide();
        await loadMatches();
        alert('Match accepted successfully!');
    } catch (error) {
        console.error('Error accepting match:', error);
        alert('Error accepting match: ' + error.message);
    }
}

// Decline match request
async function declineMatch(userId) {
    try {
        const response = await fetch('/api/matching/decline-match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            throw new Error('Failed to decline match');
        }

        matchModal.hide();
        await loadMatches();
    } catch (error) {
        console.error('Error declining match:', error);
        alert('Error declining match: ' + error.message);
    }
}

// Display matches
function displayMatches(data) {
    const matchesList = document.getElementById('matchesList');
    matchesList.innerHTML = '';

    if (data.currentMatch) {
        const matchCard = createMatchCard(data.currentMatch, 'Current Match');
        matchesList.appendChild(matchCard);
    }

    if (data.incomingRequest) {
        console.log('Displaying incoming request:', data.incomingRequest);
        const requestCard = createMatchCard(data.incomingRequest, 'Incoming Request');
        matchesList.appendChild(requestCard);
    }

    if (data.pendingRequest) {
        console.log('Displaying pending request:', data.pendingRequest);
        const requestCard = createMatchCard(data.pendingRequest, 'Pending Request');
        matchesList.appendChild(requestCard);
    }

    if (!data.currentMatch && !data.pendingRequest && !data.incomingRequest) {
        matchesList.innerHTML = '<p class="text-muted">No matches or pending requests</p>';
    }
}

// Create match card
function createMatchCard(user, status) {
    console.log('Creating match card for:', user, 'with status:', status);
    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
        <div class="match-info">
            <h6>${user.name}</h6>
            <p class="text-muted">${user.userType === 'restaurant' ? 'Restaurant' : 'Volunteer'}</p>
            <p class="text-muted">${status}</p>
        </div>
        ${status === 'Incoming Request' && currentUser.userType === 'restaurant' ? `
            <div class="match-actions">
                <button class="btn btn-sm btn-success me-2" onclick="acceptMatch('${user._id}')">Accept</button>
                <button class="btn btn-sm btn-danger" onclick="declineMatch('${user._id}')">Decline</button>
            </div>
        ` : ''}
    `;
    return card;
}

// Load matches
async function loadMatches() {
    try {
        console.log('Loading matches...');
        const response = await fetch('/api/matching/current', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load matches');
        }

        const data = await response.json();
        console.log('Received matches data:', data);
        displayMatches(data);
    } catch (error) {
        console.error('Error loading matches:', error);
        alert('Error loading matches: ' + error.message);
    }
}

// Calculate distance between two points
function calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lng - point1.lng);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

// Event Listeners
mapTab.addEventListener('click', () => {
    mapView.classList.add('active');
    matchesView.classList.remove('active');
    historyView.classList.remove('active');
    mapTab.classList.add('active');
    matchesTab.classList.remove('active');
    historyTab.classList.remove('active');
});

matchesTab.addEventListener('click', () => {
    mapView.classList.remove('active');
    matchesView.classList.add('active');
    historyView.classList.remove('active');
    mapTab.classList.remove('active');
    matchesTab.classList.add('active');
    historyTab.classList.remove('active');
});

historyTab.addEventListener('click', () => {
    mapView.classList.remove('active');
    matchesView.classList.remove('active');
    historyView.classList.add('active');
    mapTab.classList.remove('active');
    matchesTab.classList.remove('active');
    historyTab.classList.add('active');
});

refreshMapBtn.addEventListener('click', loadNearbyUsers);

centerMapBtn.addEventListener('click', () => {
    if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 13);
    }
});

// Update availability status
async function updateAvailability(isAvailable) {
    try {
        const response = await fetch('/api/auth/availability', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ isAvailable })
        });

        if (!response.ok) {
            throw new Error('Failed to update availability');
        }

        const updatedUser = await response.json();
        currentUser.isAvailable = updatedUser.isAvailable;
        
        // Update user data in localStorage
        const userData = JSON.parse(localStorage.getItem('user'));
        userData.isAvailable = updatedUser.isAvailable;
        localStorage.setItem('user', JSON.stringify(userData));

        // Refresh nearby users
        await loadNearbyUsers();
        
        // Update marker appearance
        updateMarkerAppearance();
    } catch (error) {
        console.error('Error updating availability:', error);
        alert('Error updating availability: ' + error.message);
        // Reset toggle to previous state
        availabilityToggle.checked = !isAvailable;
    }
}

// Update marker appearance based on availability
function updateMarkerAppearance() {
    if (userMarker) {
        const markerIcon = L.divIcon({
            className: `user-marker ${currentUser.isAvailable ? 'available' : 'unavailable'}`,
            html: `<i class="fas fa-${currentUser.userType === 'restaurant' ? 'store' : 'user'}"></i>`,
            iconSize: [30, 30]
        });
        userMarker.setIcon(markerIcon);
    }
}

// Event Listeners
availabilityToggle.addEventListener('change', (e) => {
    updateAvailability(e.target.checked);
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
});

distanceFilter.addEventListener('change', loadNearbyUsers);

// Initialize the application
init(); 