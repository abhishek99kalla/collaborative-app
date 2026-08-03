import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();

// Enable CORS for incoming HTTP requests
app.use(cors());

const server = createServer(app);

// Enable CORS for Socket.io connections
const io = new Server(server, {
  cors: {
    origin: '*', // Allows Vercel and local dev environments to connect
    methods: ['GET', 'POST'],
  },
});

// Default status endpoint
app.get('/', (req, res) => {
  res.send('Book Nest Backend is Running!');
});

// Store room user counts
const roomUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    if (!roomUsers[roomId]) {
      roomUsers[roomId] = new Set();
    }
    roomUsers[roomId].add(socket.id);

    io.to(roomId).emit('room-status', { count: roomUsers[roomId].size });

    console.log(`Socket ${socket.id} joined room ${roomId}. Active count: ${roomUsers[roomId].size}`);
  });

  socket.on('edit-document', ({ roomId, data }) => {
    socket.to(roomId).emit('document-update', data);
  });

  socket.on('send-message', ({ roomId, message }) => {
    socket.to(roomId).emit('receive-message', message);
  });

  socket.on('send-audio-message', ({ roomId, audioData }) => {
    socket.to(roomId).emit('receive-audio-message', audioData);
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomId) => {
      if (roomUsers[roomId]) {
        roomUsers[roomId].delete(socket.id);

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