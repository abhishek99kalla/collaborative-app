import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Helper function to update and log room counts to all participants
const updateRoomStatus = (roomId) => {
  if (!roomId) return;

  const room = io.sockets.adapter.rooms.get(roomId);
  const count = room ? room.size : 0;

  console.log(`[STATUS UPDATE] Room "${roomId}" now has ${count} active user(s).`);

  // Broadcast user count to ALL sockets in this room
  io.in(roomId).emit('room-status', { count });
};

io.on('connection', (socket) => {
  console.log(`[CONNECT] New user connected with ID: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    if (!roomId) return;

    // Leave any previously joined room
    const previousRooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    previousRooms.forEach((r) => {
      socket.leave(r);
      updateRoomStatus(r);
    });

    socket.join(roomId);
    console.log(`[ROOM JOIN] Socket ${socket.id} joined Room "${roomId}"`);

    // Broadcast updated status to everyone in the room
    updateRoomStatus(roomId);
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
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        setTimeout(() => updateRoomStatus(room), 100);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('--------------------------------------------------');
  console.log(`🚀 Socket.IO Server running on port ${PORT}`);
  console.log('--------------------------------------------------');
});