import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { nanoid } from 'nanoid';
import pptxgen from 'pptxgenjs';

// Auto-detect production vs local environment
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://booknest-backend.onrender.com' 
    : 'http://localhost:3001';

// Socket connection
const socket = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

function App() {
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  
  // Track host status
  const [isHost, setIsHost] = useState(false);

  // Track link copied status
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Room status: connected = 2 or more users in the room
  const [isConnected, setIsConnected] = useState(false);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 3-Line Menu Toggle
  const [showNotesMenu, setShowNotesMenu] = useState(false);

  // App Features State
  const [documentContent, setDocumentContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Join existing room helper
  const joinExistingRoom = (id, createdBySelf = false) => {
    setRoomId(id);
    setInRoom(true);
    setIsHost(createdBySelf);
  };

  // Generate new private room
  const createNewRoom = () => {
    const newRoomId = nanoid(8);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    joinExistingRoom(newRoomId, true);
  };

  // Check URL parameters on page load
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlRoomId = queryParams.get('room');

    if (urlRoomId) {
      joinExistingRoom(urlRoomId, false);
    }
  }, []);

  // Main Socket Listener Effect
  useEffect(() => {
    if (!inRoom || !roomId) return;

    const emitJoin = () => {
      socket.emit('join-room', roomId);
    };

    if (socket.connected) {
      emitJoin();
    }

    const onConnect = () => {
      emitJoin();
    };

    const handleRoomStatus = (data) => {
      setIsConnected(data.count > 1);
    };

    const handleDocUpdate = (data) => {
      setDocumentContent(data);
    };

    const handleMessage = (data) => {
      setMessages((prev) => [...prev, { type: 'text', content: data.content, senderId: data.senderId }]);
    };

    const handleAudioMessage = (data) => {
      setMessages((prev) => [...prev, { type: 'audio', content: data.audioData, senderId: data.senderId }]);
    };

    socket.on('connect', onConnect);
    socket.on('room-status', handleRoomStatus);
    socket.on('document-update', handleDocUpdate);
    socket.on('receive-message', handleMessage);
    socket.on('receive-audio-message', handleAudioMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('room-status', handleRoomStatus);
      socket.off('document-update', handleDocUpdate);
      socket.off('receive-message', handleMessage);
      socket.off('receive-audio-message', handleAudioMessage);
    };
  }, [inRoom, roomId]);

  // Toggle Theme
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Copy Share Link
  const copyShareLink = () => {
    if (isLinkCopied) return;

    const publicUrl = window.location.href;
    navigator.clipboard.writeText(publicUrl);
    setIsLinkCopied(true);
  };

  // Document Editor Change
  const handleDocumentChange = (e) => {
    const text = e.target.value;
    setDocumentContent(text);
    socket.emit('edit-document', { roomId, data: text });
  };

  // Helper trigger file download
  const triggerDownload = (blob, filename) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setShowNotesMenu(false);
  };

  // 1. SAVE AS PDF
  const exportAsPdf = () => {
    if (!documentContent.trim()) return alert('Shared notes are empty!');

    const printWindow = window.open('', '_blank', 'height=650,width=800');
    if (!printWindow) return alert('Please allow popups to save as PDF.');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notes - Room ${roomId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
            h1 { color: #0066fe; font-size: 22px; border-bottom: 2px solid #0066fe; padding-bottom: 8px; }
            pre { font-family: inherit; font-size: 14px; white-space: pre-wrap; word-break: break-word; line-height: 1.6; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Book Nest's Workspace — Shared Notes</h1>
          <p><strong>Room ID:</strong> ${roomId}</p>
          <pre>${documentContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    setShowNotesMenu(false);
  };

  // 2. SAVE AS PPT (PowerPoint)
  const exportAsPpt = () => {
    if (!documentContent.trim()) return alert('Shared notes are empty!');

    try {
      const pptx = new pptxgen();
      
      // Title Slide
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: '0F172A' };
      titleSlide.addText("Book Nest's Workspace", {
        x: 0.8,
        y: 2.0,
        w: 8.5,
        h: 1.0,
        fontSize: 36,
        bold: true,
        color: '0066FE',
      });
      titleSlide.addText(`Shared Notes — Room: ${roomId}`, {
        x: 0.8,
        y: 3.0,
        w: 8.5,
        h: 0.8,
        fontSize: 20,
        color: '94A3B8',
      });

      // Split paragraphs into slides
      const paragraphs = documentContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

      if (paragraphs.length === 0) {
        paragraphs.push(documentContent);
      }

      paragraphs.forEach((pText, index) => {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' };
        
        slide.addText(`Notes (Part ${index + 1})`, {
          x: 0.8,
          y: 0.5,
          w: 8.5,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: '0066FE',
        });

        slide.addText(pText, {
          x: 0.8,
          y: 1.4,
          w: 8.5,
          h: 5.0,
          fontSize: 16,
          color: '1E293B',
          valign: 'top',
        });
      });

      pptx.writeFile({ fileName: `notes-${roomId || 'booknest'}.pptx` });
      setShowNotesMenu(false);
    } catch (err) {
      console.error(err);
      alert('Error generating PowerPoint file.');
    }
  };

  // 3. SAVE AS IMAGE (.png)
  const exportAsImage = () => {
    if (!documentContent.trim()) return alert('Shared notes are empty!');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const padding = 40;
    const fontSize = 16;
    const lineHeight = 24;
    const font = `${fontSize}px sans-serif`;

    ctx.font = font;

    const lines = documentContent.split('\n');
    let maxLineWidth = 400;

    lines.forEach((line) => {
      const width = ctx.measureText(line).width;
      if (width > maxLineWidth) maxLineWidth = width;
    });

    const width = Math.min(Math.max(maxLineWidth + padding * 2, 500), 1200);
    const height = lines.length * lineHeight + padding * 2 + 60;

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = isDarkMode ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Title Header
    ctx.fillStyle = '#0066fe';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Book Nest Notes (Room: ${roomId})`, padding, padding);

    ctx.strokeStyle = isDarkMode ? '#334155' : '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(padding, padding + 15);
    ctx.lineTo(width - padding, padding + 15);
    ctx.stroke();

    // Body Text
    ctx.fillStyle = isDarkMode ? '#f3f4f6' : '#1f2937';
    ctx.font = font;

    lines.forEach((line, index) => {
      ctx.fillText(line, padding, padding + 50 + index * lineHeight);
    });

    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `notes-${roomId || 'booknest'}.png`);
    }, 'image/png');
  };

  // 4. SAVE AS TEXT (.txt)
  const exportAsTxt = () => {
    if (!documentContent.trim()) return alert('Shared notes are empty!');
    const blob = new Blob([documentContent], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `notes-${roomId || 'booknest'}.txt`);
  };

  // 5. SAVE AS MARKDOWN (.md)
  const exportAsMarkdown = () => {
    if (!documentContent.trim()) return alert('Shared notes are empty!');
    const mdContent = `# Shared Notes - Room ${roomId}\n\n${documentContent}`;
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, `notes-${roomId || 'booknest'}.md`);
  };

  // Send Text Message
  const sendTextMessage = () => {
    if (!inputText.trim()) return;

    const msgData = { content: inputText, senderId: socket.id };
    setMessages((prev) => [...prev, { type: 'text', content: inputText, senderId: socket.id }]);
    socket.emit('send-message', { roomId, message: msgData });
    setInputText('');
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);

        reader.onloadend = () => {
          const base64Audio = reader.result;

          setMessages((prev) => [...prev, { type: 'audio', content: base64Audio, senderId: socket.id }]);

          socket.emit('send-audio-message', {
            roomId,
            audioData: { audioData: base64Audio, senderId: socket.id },
          });
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone permission is required.');
    }
  };

  // Stop Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  // LOBBY VIEW
  if (!inRoom) {
    return (
      <div style={{ ...styles.lobbyBackground, backgroundColor: theme.pageBg }}>
        <div style={{ ...styles.lobbyCard, backgroundColor: theme.cardBg, borderColor: theme.borderColor }}>
          <div style={styles.iconBadge}>📚</div>
          <h1 style={{ ...styles.lobbyTitle, color: theme.textColor }}>Book Nest's Workspace</h1>
          <p style={{ ...styles.lobbySub, color: theme.subTextColor }}>
            Real-time notes, live text chat, and instant voice notes in a private room.
          </p>
          <button style={styles.heroButton} onClick={createNewRoom}>
            🔗 Connect & Generate Private Link
          </button>
        </div>
      </div>
    );
  }

  // MAIN WORKSPACE VIEW
  return (
    <div style={{ ...styles.appWrapper, backgroundColor: theme.pageBg }}>
      {/* Header */}
      <header style={{ ...styles.topHeader, backgroundColor: theme.headerBg, borderColor: theme.borderColor }}>
        <div style={styles.brandContainer}>
          <div style={styles.brandGroup}>
            <span style={styles.brandIcon}>📚</span>
            <h2 style={{ ...styles.brandTitle, color: theme.textColor }}>Book Nest's Workspace</h2>
            <span style={{ ...styles.roomTag, backgroundColor: theme.tagBg, color: theme.tagText }}>
              Room ID: {roomId}
            </span>
          </div>

          {/* Connection Indicator */}
          <div style={styles.statusIndicator}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: isConnected ? '#22c55e' : '#ef4444',
              }}
            />
            <span style={{ ...styles.statusText, color: theme.subTextColor }}>
              {isConnected ? 'connected' : 'disconnected'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={styles.actionGroup}>
          <button
            style={{ ...styles.themeBtn, backgroundColor: theme.btnToggleBg, color: theme.textColor, borderColor: theme.borderColor }}
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          {/* Shown ONLY to Host AND ONLY before a 2nd user joins */}
          {isHost && !isConnected && (
            <button
              style={{
                ...styles.shareLinkBtn,
                backgroundColor: isLinkCopied ? '#6b7280' : '#10b981',
                cursor: isLinkCopied ? 'not-allowed' : 'pointer',
                opacity: isLinkCopied ? 0.7 : 1,
              }}
              onClick={copyShareLink}
              disabled={isLinkCopied}
            >
              {isLinkCopied ? '✅ Link Copied' : '🔗 Copy Invite Link'}
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <main style={styles.mainGrid}>
        {/* Shared Notes */}
        <section style={{ ...styles.cardSection, backgroundColor: theme.cardBg, borderColor: theme.borderColor }}>
          <div style={{ ...styles.cardHeader, backgroundColor: theme.cardHeaderBg, borderColor: theme.borderColor }}>
            <h3 style={{ ...styles.cardTitle, color: theme.textColor }}>📄 Shared Notes</h3>

            {/* 3-Line Menu Icon (hamburger) */}
            <div style={{ position: 'relative' }}>
              <button
                style={{ ...styles.hamburgerBtn, color: theme.textColor, backgroundColor: theme.btnToggleBg, borderColor: theme.borderColor }}
                onClick={() => setShowNotesMenu((prev) => !prev)}
                title="Download options"
              >
                ≡
              </button>

              {/* Download Options Dropdown */}
              {showNotesMenu && (
                <div style={{ ...styles.dropdownMenu, backgroundColor: theme.cardBg, borderColor: theme.borderColor }}>
                  <div style={{ ...styles.dropdownHeader, color: theme.subTextColor }}>Save Notes As:</div>
                  <button style={{ ...styles.dropdownItem, color: theme.textColor }} onClick={exportAsPdf}>
                    📄 Save as PDF (.pdf)
                  </button>
                  <button style={{ ...styles.dropdownItem, color: theme.textColor }} onClick={exportAsPpt}>
                    📊 Save as PPT File (.pptx)
                  </button>
                  <button style={{ ...styles.dropdownItem, color: theme.textColor }} onClick={exportAsImage}>
                    🖼️ Save as Image (.png)
                  </button>
                  <button style={{ ...styles.dropdownItem, color: theme.textColor }} onClick={exportAsTxt}>
                    📝 Save as Text (.txt)
                  </button>
                  <button style={{ ...styles.dropdownItem, color: theme.textColor }} onClick={exportAsMarkdown}>
                    📄 Save as Markdown (.md)
                  </button>
                </div>
              )}
            </div>
          </div>
          <textarea
            style={{ ...styles.textEditor, color: theme.textColor, backgroundColor: theme.cardBg }}
            value={documentContent}
            onChange={handleDocumentChange}
            placeholder="Type anything here... Users in this room will see changes instantly!"
          />
        </section>

        {/* Live Chat */}
        <section style={{ ...styles.cardSection, backgroundColor: theme.cardBg, borderColor: theme.borderColor }}>
          <div style={{ ...styles.cardHeader, backgroundColor: theme.cardHeaderBg, borderColor: theme.borderColor }}>
            <h3 style={{ ...styles.cardTitle, color: theme.textColor }}>💬 Live Chat</h3>
          </div>

          <div style={{ ...styles.chatHistory, backgroundColor: theme.chatHistoryBg }}>
            {messages.length === 0 ? (
              <p style={{ ...styles.emptyState, color: theme.subTextColor }}>No messages yet. Send a text or voice note!</p>
            ) : (
              messages.map((msg, index) => {
                const isSelf = msg.senderId === socket.id;

                return (
                  <div
                    key={index}
                    style={{
                      ...styles.messageRow,
                      alignItems: isSelf ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {msg.type === 'text' ? (
                      <div
                        style={{
                          ...styles.textBubble,
                          backgroundColor: isSelf ? '#1e3a8a' : theme.bubbleBg,
                          color: isSelf ? '#ffffff' : theme.textColor,
                          borderColor: isSelf ? '#1e3a8a' : theme.borderColor,
                          borderRadius: isSelf ? '12px 12px 0px 12px' : '12px 12px 12px 0px',
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        style={{
                          ...styles.audioBubble,
                          backgroundColor: isSelf ? '#1e3a8a' : theme.bubbleBg,
                          borderColor: isSelf ? '#1e3a8a' : theme.borderColor,
                          borderRadius: isSelf ? '12px 12px 0px 12px' : '12px 12px 12px 0px',
                        }}
                      >
                        <audio src={msg.content} controls style={{ width: '100%', minWidth: '200px' }} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Controls */}
          <div style={{ ...styles.chatInputBar, backgroundColor: theme.cardBg, borderColor: theme.borderColor }}>
            <input
              type="text"
              style={{ ...styles.inputField, backgroundColor: theme.inputBg, color: theme.textColor, borderColor: theme.borderColor }}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendTextMessage()}
              placeholder="Type a message..."
            />
            <button style={styles.sendButton} onClick={sendTextMessage}>
              Send
            </button>
            <button
              style={{
                ...styles.micButton,
                backgroundColor: isRecording ? '#e63946' : '#2a9d8f',
              }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? '⏹️ Stop' : '🎙️ Voice'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

// Theme Palettes
const lightTheme = {
  pageBg: '#f8f9fa',
  headerBg: '#ffffff',
  cardBg: '#ffffff',
  cardHeaderBg: '#fafafa',
  chatHistoryBg: '#f9fafb',
  bubbleBg: '#ffffff',
  inputBg: '#ffffff',
  textColor: '#1f2937',
  subTextColor: '#6b7280',
  borderColor: '#e5e7eb',
  tagBg: '#e9ecef',
  tagText: '#495057',
  btnToggleBg: '#f3f4f6',
};

const darkTheme = {
  pageBg: '#0f172a',
  headerBg: '#1e293b',
  cardBg: '#1e293b',
  cardHeaderBg: '#111827',
  chatHistoryBg: '#0f172a',
  bubbleBg: '#334155',
  inputBg: '#0f172a',
  textColor: '#f3f4f6',
  subTextColor: '#9ca3af',
  borderColor: '#334155',
  tagBg: '#334155',
  tagText: '#cbd5e1',
  btnToggleBg: '#334155',
};

// Styles
const styles = {
  lobbyBackground: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: 'background-color 0.3s ease',
  },
  lobbyCard: {
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
    textAlign: 'center',
    maxWidth: '480px',
    width: '90%',
    border: '1px solid',
  },
  iconBadge: {
    fontSize: '48px',
    marginBottom: '10px',
  },
  lobbyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 10px 0',
  },
  lobbySub: {
    fontSize: '15px',
    marginBottom: '30px',
    lineHeight: '1.5',
  },
  heroButton: {
    backgroundColor: '#0066fe',
    color: '#ffffff',
    border: 'none',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
  },
  appWrapper: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: 'background-color 0.3s ease',
  },
  topHeader: {
    borderBottom: '1px solid',
    padding: '12px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandIcon: {
    fontSize: '20px',
  },
  brandTitle: {
    fontSize: '18px',
    fontWeight: '700',
    margin: 0,
  },
  roomTag: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '30px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  statusText: {
    fontSize: '12px',
    fontWeight: '500',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  themeBtn: {
    padding: '8px 12px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '16px',
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLinkBtn: {
    color: '#ffffff',
    border: 'none',
    padding: '9px 18px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '0.65fr 0.35fr',
    gap: '20px',
    padding: '20px',
    overflow: 'hidden',
  },
  cardSection: {
    borderRadius: '12px',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  cardHeader: {
    padding: '12px 20px',
    borderBottom: '1px solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
  },
  hamburgerBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '20px',
    fontWeight: 'bold',
    border: '1px solid',
    cursor: 'pointer',
    lineHeight: '1',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: '38px',
    borderRadius: '8px',
    border: '1px solid',
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: '210px',
  },
  dropdownHeader: {
    padding: '8px 14px 4px 14px',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dropdownItem: {
    background: 'none',
    border: 'none',
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  textEditor: {
    flex: 1,
    padding: '20px',
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    lineHeight: '1.6',
    fontFamily: 'inherit',
    resize: 'none',
  },
  chatHistory: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyState: {
    textAlign: 'center',
    fontSize: '14px',
    marginTop: '40px',
  },
  messageRow: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  textBubble: {
    border: '1px solid',
    padding: '10px 14px',
    fontSize: '14px',
    maxWidth: '80%',
    wordBreak: 'break-word',
  },
  audioBubble: {
    border: '1px solid',
    padding: '8px',
    maxWidth: '90%',
  },
  chatInputBar: {
    padding: '15px 20px',
    borderTop: '1px solid',
    display: 'flex',
    gap: '8px',
  },
  inputField: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
  },
  sendButton: {
    backgroundColor: '#0066fe',
    color: '#ffffff',
    border: 'none',
    padding: '0 14px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  micButton: {
    color: '#ffffff',
    border: 'none',
    padding: '0 14px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default App;