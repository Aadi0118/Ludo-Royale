import React, { useEffect, useRef } from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { Mic, MicOff, Phone } from 'lucide-react';

const AudioStream = ({ stream, isMuted }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      
      // Explicitly call play to handle browsers that require it, and handle the promise
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.error("Audio playback failed (might need user interaction):", e));
      }
    }
  }, [stream]);

  // Make audio elements virtually invisible but not display:none to avoid browser optimizations
  return <audio ref={audioRef} autoPlay muted={isMuted} style={{ width: 0, height: 0, position: 'absolute', opacity: 0, pointerEvents: 'none' }} />;
};

const VoiceChat = ({ socket, roomId, gameState }) => {
  const { localStream, peers, isMuted, startVoiceChat, toggleMute } = useVoiceChat(socket, roomId, gameState);

  return (
    <div className="voice-chat-container" style={{ 
      position: 'absolute', 
      bottom: '20px', 
      right: '20px', 
      display: 'flex', 
      gap: '10px', 
      alignItems: 'center', 
      background: 'rgba(255,255,255,0.9)', 
      padding: '10px 15px', 
      borderRadius: '24px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 100
    }}>
      {!localStream ? (
        <button onClick={startVoiceChat} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          <Phone size={18} /> Join Voice
        </button>
      ) : (
        <button onClick={toggleMute} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isMuted ? '#ef4444' : '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      )}

      {/* Render remote audio streams */}
      {Object.entries(peers).map(([peerId, peerObj]) => (
        <AudioStream key={peerId} stream={peerObj.stream} isMuted={false} />
      ))}
      
      {localStream && (
        <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: '600' }}>
          {Object.values(peers).filter(p => p.stream).length + 1} people in voice
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
