import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { nanoid } from 'nanoid';

// YOUR LIVE RENDER BACKEND URL
const SOCKET_SERVER_URL = 'https://collaborative-app-yihy.onrender.com';

const socket = io(SOCKET_SERVER_URL, {
  transports: ['websocket', 'polling'],
});

function App() {
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [userCount, setUserCount] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Editor and Chat state
  const [documentContent, setDocumentContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Check URL query parameters for room link
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
      setInRoom(true);
      socket.emit('join-room', roomParam);
    }

    function onConnect() {
      setIsConnected(true);
      if (roomId) {
        socket.emit('join-room', roomId);
      }
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

    function onReceiveAudio(audioData) {
      setMessages((prev) => [...prev, { sender: 'Peer', audio: audioData, time: new Date().toLocaleTimeString() }]);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-status', onRoomStatus);
    socket.on('document-update', onDocumentUpdate);
    socket.on('receive-message', onReceiveMessage);
    socket.on('receive-audio-message', onReceiveAudio);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-status', onRoomStatus);
      socket.off('document-update', onDocumentUpdate);
      socket.off('receive-message', onReceiveMessage);
      socket.off('receive-audio-message', onReceiveAudio);
    };
  }, [roomId]);

  // Handle Room Creation
  const createRoom = () => {
    const newRoomId = nanoid(8);
    setRoomId(newRoomId);
    setInRoom(true);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    socket.emit('join-room', newRoomId);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      setInRoom(true);
      window.history.pushState({}, '', `?room=${roomId}`);
      socket.emit('join-room', roomId);
    }
  };

  // Document Editing
  const handleDocChange = (e) => {
    const content = e.target.value;
    setDocumentContent(content);
    socket.emit('edit-document', { roomId, data: content });
  };

  // Text Chat
  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const msg = { text: inputMessage, sender: 'You', time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, msg]);
    socket.emit('send-message', { roomId, message: { text: inputMessage, sender: 'Peer', time: new Date().toLocaleTimeString() } });
    setInputMessage('');
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          setMessages((prev) => [...prev, { sender: 'You', audio: base64Audio, time: new Date().toLocaleTimeString() }]);
          socket.emit('send-audio-message', { roomId, audioData: base64Audio });
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Export Document Functionality
  const exportDocument = (type) => {
    if (type === 'txt') {
      const element = document.createElement('a');
      const file = new Blob([documentContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `notes-${roomId}.txt`;
      document.body.appendChild(element);
      element.click();
    } else {
      alert(`Exporting to ${type.toUpperCase()} option selected!`);
    }
  };

  // Theme Styles
  const theme = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    primary: '#6366f1',
  };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', transition: 'all 0.3s ease', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top Navigation Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.cardBg }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>📚 Collaborative Workspace</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Connection Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: isConnected ? '#22c55e' : '#ef4444' }} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, cursor: 'pointer' }}
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {!inRoom ? (
        /* Lobby Screen */
        <main style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', backgroundColor: theme.cardBg, borderRadius: '0.75rem', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }}>Join a Workspace</h2>
          <button
            onClick={createRoom}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: theme.primary, color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }}
          >
            Create New Room
          </button>
          <div style={{ margin: '1rem 0', color: '#64748b' }}>or</div>
          <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Enter Room Code..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}
            />
            <button
              type="submit"
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, cursor: 'pointer' }}
            >
              Join Private Session
            </button>
          </form>
        </main>
      ) : (
        /* Workspace Editor & Chat Layout */
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          
          {/* Document Section */}
          <section style={{ backgroundColor: theme.cardBg, padding: '1.5rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Shared Notes</h2>
                <small style={{ color: '#64748b' }}>Room: {roomId} ({userCount} active {userCount > 1 ? 'users' : 'user'})</small>
              </div>

              {/* Export Dropdown */}
              <select
                onChange={(e) => e.target.value && exportDocument(e.target.value)}
                defaultValue=""
                style={{ padding: '0.5rem', borderRadius: '0.375rem', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}
              >
                <option value="" disabled>Export Notes</option>
                <option value="txt">Export as .TXT</option>
                <option value="pdf">Export as PDF</option>
                <option value="png">Export as Image (PNG)</option>
              </select>
            </div>

            <textarea
              value={documentContent}
              onChange={handleDocChange}
              placeholder="Start typing your collaborative notes live..."
              style={{ width: '96%', height: '400px', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, fontSize: '1rem', lineHeight: '1.5', resize: 'vertical' }}
            />
          </section>

          {/* Chat & Voice Section */}
          <section style={{ backgroundColor: theme.cardBg, padding: '1.5rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', height: '500px' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.25rem', marginBottom: '1rem' }}>Live Discussion</h2>
            
            {/* Messages Feed */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>{msg.sender} • {msg.time}</div>
                  {msg.text && <div>{msg.text}</div>}
                  {msg.audio && <audio controls src={msg.audio} style={{ width: '100%', marginTop: '0.25rem' }} />}
                </div>
              ))}
            </div>

            {/* Input Controls */}
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '0.375rem', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', backgroundColor: theme.primary, color: '#fff', cursor: 'pointer' }}>
                Send
              </button>
            </form>

            {/* Voice Recording Control */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: `1px solid ${isRecording ? '#ef4444' : theme.border}`, backgroundColor: isRecording ? '#ef4444' : 'transparent', color: isRecording ? '#fff' : theme.text, cursor: 'pointer' }}
            >
              {isRecording ? '🛑 Stop & Send Voice Note' : '🎙️ Record Voice Note'}
            </button>
          </section>

        </main>
      )}
    </div>
  );
}

export default App;