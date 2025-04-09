# Share A Plate - Food Donation & Volunteer Matching Platform

A web-based platform that connects restaurants with volunteers for food donation and delivery. The platform provides real-time location tracking, matching system, and a seamless user experience for both restaurants and volunteers.

## Features

- **User Authentication**: Separate signup/login for restaurants and volunteers
- **Real-time Location Tracking**: Using OpenStreetMap and Geolocation API
- **Smart Matching System**: Matches restaurants with nearby volunteers
- **Interactive Map View**: Visual representation of nearby users and delivery routes
- **Real-time Updates**: Live tracking of food pickup and delivery status
- **Responsive Design**: Works seamlessly on both desktop and mobile devices

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript
- Bootstrap 5 for UI components
- Leaflet.js for map integration
- Socket.IO for real-time updates

### Backend
- Node.js with Express.js
- MongoDB for database
- JWT for authentication
- Socket.IO for real-time communication

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/share-a-plate.git
cd share-a-plate
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Project Structure

```
share-a-plate/
├── public/
│   ├── css/
│   │   ├── style.css
│   │   └── dashboard.css
│   ├── js/
│   │   ├── auth.js
│   │   └── dashboard.js
│   ├── index.html
│   └── dashboard.html
├── models/
│   └── User.js
├── routes/
│   ├── auth.js
│   └── matching.js
├── server.js
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Matching
- `GET /api/matching/nearby` - Get nearby available users
- `POST /api/matching/request-match` - Request a match with another user
- `POST /api/matching/complete-delivery` - Complete a delivery

### User Management
- `PUT /api/users/availability` - Update user availability status

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenStreetMap for map data
- Bootstrap for UI components
- Font Awesome for icons
- Leaflet.js for map integration 