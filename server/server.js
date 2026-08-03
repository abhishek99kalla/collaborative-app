const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. Allow cross-origin HTTP requests
app.use(cors());

const server = http.createServer(app);

// 2. Allow Socket.IO connections from Vercel / any domain
const io = new Server(server, {
  cors: {
    origin: '*', // Allows Vercel and all external domains to connect
    methods: ['GET', 'POST'],
  },
});

// Default test route to check if server is awake
app.get('/', (req, res) => {
  res.send('Book Nest Backend is Running!');
});

// Store room user counts
const roomUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    // Track user count per room
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = new Set();
    }
    roomUsers[roomId].add(socket.id);

    // Broadcast current user count to everyone in the room
    io.to(roomId).emit('room-status', { count: roomUsers[roomId].size });

    console.log(`Socket ${socket.id} joined room ${roomId}. Active count: ${roomUsers[roomId].size}`);
  });

  // Real-time document updates
  socket.on('edit-document', ({ roomId, data }) => {
    socket.to(roomId).emit('document-update', data);
  });

  // Real-time text chat
  socket.on('send-message', ({ roomId, message }) => {
    socket.to(roomId).emit('receive-message', message);
  });

  // Real-time voice messaging
  socket.on('send-audio-message', ({ roomId, audioData }) => {
    socket.to(roomId).emit('receive-audio-message', audioData);
  });

  // Handle user disconnect
  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomId) => {
      if (roomUsers[roomId]) {
        roomUsers[roomId].delete(socket.id);
        
        // Notify remaining users in the room
        io.to(roomId).emit('room-status', { count: roomUsers[roomId].size });

        if (roomUsers[roomId].size === 0) {
          delete roomUsers[roomId];
        }
      }
    });
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});