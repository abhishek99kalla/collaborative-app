import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// YOUR LIVE RENDER BACKEND URL
const SOCKET_SERVER_URL = 'https://collaborative-app-yihy.onrender.com';

// Initialize socket outside component to prevent recreation on re-renders
const socket = io(SOCKET_SERVER_URL, {
  transports: ['websocket', 'polling'], // Fallback options for smooth connections
});

function App() {
  const [roomId, setRoomId] = useState('default-room');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [userCount, setUserCount] = useState(1);
  const [documentContent, setDocumentContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    // Socket connection event listeners
    function onConnect() {
      setIsConnected(true);
      socket.emit('join-room', roomId);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomStatus(data) {
      setUserCount(data.count);
    }

    function onDocumentUpdate(data) {
      setDocumentContent(data);
    }

    function onReceiveMessage(message) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-status', onRoomStatus);
    socket.on('document-update', onDocumentUpdate);
    socket.on('receive-message', onReceiveMessage);

    // Join room if already connected when component mounts
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-status', onRoomStatus);
      socket.off('document-update', onDocumentUpdate);
      socket.off('receive-message', onReceiveMessage);
    };
  }, [roomId]);

  // Handle document editor text changes
  const handleDocChange = (e) => {
    const newContent = e.target.value;
    setDocumentContent(newContent);
    socket.emit('edit-document', { roomId, data: newContent });
  };

  // Handle chat message sending
  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const msgData = { text: inputMessage, sender: 'You', time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, msgData]);
    socket.emit('send-message', { roomId, message: { text: inputMessage, sender: 'Peer', time: new Date().toLocaleTimeString() } });
    setInputMessage('');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Collaborative Editor & Chat</h2>
      
      {/* Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <span
          style={{
            height: '12px',
            width: '12px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#22c55e' : '#ef4444',
            display: 'inline-block',
          }}
        />
        <strong>{isConnected ? 'Connected to Backend' : 'Connecting...'}</strong>
        <span>({userCount} user{userCount > 1 ? 's' : ''} in room)</span>
      </div>

      {/* Editor Section */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Collaborative Document</h3>
        <textarea
          rows="10"
          style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          value={documentContent}
          onChange={handleDocChange}
          placeholder="Type here to collaborate live..."
        />
      </div>

      {/* Chat Section */}
      <div>
        <h3>Live Chat</h3>
        <div style={{ border: '1px solid #ccc', height: '150px', overflowY: 'scroll', padding: '10px', marginBottom: '10px' }}>
          {messages.map((msg, index) => (
            <div key={index}>
              <strong>{msg.sender}:</strong> {msg.text} <small style={{ color: '#888' }}>({msg.time})</small>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            style={{ flex: 1, padding: '8px' }}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit" style={{ padding: '8px 16px' }}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;