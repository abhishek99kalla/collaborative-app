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
    // Read room ID from URL if present
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

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-status', onRoomStatus);
      socket.off('document-update', onDocumentUpdate);
      socket.off('receive-message', onReceiveMessage);
      socket.off('receive-audio-message', onReceiveAudio);
    };
  }, [roomId]);

  // Create Room
  const createRoom = () => {
    const newRoomId = nanoid(8);
    setRoomId(newRoomId);
    setInRoom(true);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    socket.emit('join-room', newRoomId);
  };

  // Join Room
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

  // Voice Note Recording
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

  // Export Notes Handler
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

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0b0f19] text-white' : 'bg-gray-100 text-gray-900'} font-sans transition-colors duration-300`}>
      
      {/* Top Header Bar */}
      <header className="flex justify-between items-center px-8 py-4 bg-[#111827] border-b border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-400"></span>
            <span className="w-3 h-3 rounded-sm bg-green-400"></span>
            <span className="w-3 h-3 rounded-sm bg-blue-400"></span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Collaborative Workspace</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition"
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      {!inRoom ? (
        <main className="max-w-md mx-auto mt-20 p-8 bg-[#1f293d] rounded-2xl border border-gray-800 shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-6">Join a Workspace</h2>
          <button
            onClick={createRoom}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl transition shadow-lg mb-4"
          >
            Create New Room
          </button>
          <div className="text-gray-400 text-sm my-3">or join with code</div>
          <form onSubmit={joinRoom} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Enter Room Code..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="p-3 rounded-xl bg-[#111827] border border-gray-700 text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="py-3 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 transition font-medium"
            >
              Join Private Session
            </button>
          </form>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Shared Notes Card */}
          <section className="md:col-span-2 bg-[#1f293d] p-6 rounded-2xl border border-gray-800/80 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">Shared Notes</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Room: <span className="font-mono text-gray-300">{roomId}</span> ({userCount} active user{userCount > 1 ? 's' : ''})
                  </p>
                </div>

                <select
                  onChange={(e) => e.target.value && exportDocument(e.target.value)}
                  defaultValue=""
                  className="bg-[#111827] text-sm text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none"
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
                className="w-full h-96 p-4 rounded-xl bg-[#111827] border border-gray-700 text-gray-200 font-mono text-sm leading-relaxed focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </section>

          {/* Live Discussion Card */}
          <section className="bg-[#1f293d] p-6 rounded-2xl border border-gray-800/80 shadow-lg flex flex-col h-[520px]">
            <h2 className="text-xl font-bold mb-4">Live Discussion</h2>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
              {messages.map((msg, idx) => (
                <div key={idx} className="bg-[#111827] p-3 rounded-xl border border-gray-800">
                  <div className="text-[10px] text-gray-400 mb-1">{msg.sender} • {msg.time}</div>
                  {msg.text && <p className="text-sm text-gray-200">{msg.text}</p>}
                  {msg.audio && <audio controls src={msg.audio} className="w-full mt-2 h-8" />}
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-[#111827] border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl text-sm transition"
              >
                Send
              </button>
            </form>

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-2.5 rounded-xl border text-sm font-medium transition ${
                isRecording 
                  ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30' 
                  : 'bg-[#111827] border-gray-700 text-gray-300 hover:bg-gray-800'
              }`}
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