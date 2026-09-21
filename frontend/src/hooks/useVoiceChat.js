import { useEffect, useRef, useState, useCallback } from 'react';

export const useVoiceChat = (socket, roomId, gameState) => {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  const startVoiceChat = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Start muted by default
      stream.getAudioTracks()[0].enabled = false;
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsMuted(true);

      // We send a "ping" to everyone in the room to check if they are in voice chat.
      // We cleverly reuse the webrtc_offer event so we don't need backend updates!
      if (gameState && gameState.players) {
        gameState.players.forEach(player => {
          if (player.id !== socket.id) {
            socket.emit("webrtc_offer", {
              target: player.id,
              offer: { type: 'ping' },
            });
          }
        });
      }
    } catch (err) {
      console.error("Failed to get local stream", err);
      alert("Microphone access is required for voice chat.");
    }
  }, [gameState, socket]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const createPeer = (userToSignal, callerID, stream) => {
    const peerObj = { pc: null, stream: null, iceQueue: [] };
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });
    peerObj.pc = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      let remoteStream = event.streams && event.streams[0];
      if (!remoteStream && event.track) {
        remoteStream = new MediaStream([event.track]);
      }
      peerObj.stream = remoteStream;
      setPeers({ ...peersRef.current });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice_candidate", {
          target: userToSignal,
          candidate: event.candidate,
        });
      }
    };

    peer.createOffer()
      .then((offer) => peer.setLocalDescription(offer))
      .then(() => {
        socket.emit("webrtc_offer", {
          target: userToSignal,
          offer: peer.localDescription,
        });
      })
      .catch((e) => console.error(e));

    return peerObj;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peerObj = { pc: null, stream: null, iceQueue: [] };
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });
    peerObj.pc = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      let remoteStream = event.streams && event.streams[0];
      if (!remoteStream && event.track) {
        remoteStream = new MediaStream([event.track]);
      }
      peerObj.stream = remoteStream;
      setPeers({ ...peersRef.current });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice_candidate", {
          target: callerID,
          candidate: event.candidate,
        });
      }
    };

    peer.setRemoteDescription(new RTCSessionDescription(incomingSignal))
      .then(() => peer.createAnswer())
      .then((answer) => peer.setLocalDescription(answer))
      .then(() => {
        socket.emit("webrtc_answer", {
          target: callerID,
          answer: peer.localDescription,
        });
      })
      .then(() => {
        if (peerObj.iceQueue) {
          peerObj.iceQueue.forEach(candidate => {
            peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
          });
          peerObj.iceQueue = [];
        }
      })
      .catch(e => console.error(e));

    return peerObj;
  };

  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ sender, offer }) => {
      if (!localStreamRef.current) return; 

      // Intercept our dummy PING signal
      if (offer.type === 'ping') {
        // Send a PONG back
        socket.emit("webrtc_answer", {
          target: sender,
          answer: { type: 'pong' },
        });

        // Polite peer creates the connection
        if (socket.id > sender) {
          if (peersRef.current[sender]?.pc) peersRef.current[sender].pc.close();
          const peerObj = createPeer(sender, socket.id, localStreamRef.current);
          peersRef.current[sender] = peerObj;
          setPeers({ ...peersRef.current });
        }
        return;
      }

      // Real offer received
      if (peersRef.current[sender]?.pc) {
        peersRef.current[sender].pc.close();
      }

      const peerObj = addPeer(offer, sender, localStreamRef.current);
      peersRef.current[sender] = peerObj;
      setPeers({ ...peersRef.current });
    };

    const handleAnswer = async ({ sender, answer }) => {
      if (!localStreamRef.current) return;

      // Intercept our dummy PONG signal
      if (answer.type === 'pong') {
        // Polite peer creates the connection
        if (socket.id > sender) {
          if (peersRef.current[sender]?.pc) peersRef.current[sender].pc.close();
          const peerObj = createPeer(sender, socket.id, localStreamRef.current);
          peersRef.current[sender] = peerObj;
          setPeers({ ...peersRef.current });
        }
        return;
      }

      // Real answer received
      const peerObj = peersRef.current[sender];
      if (peerObj && peerObj.pc.signalingState !== 'closed') {
        try {
          await peerObj.pc.setRemoteDescription(new RTCSessionDescription(answer));
          if (peerObj.iceQueue) {
            peerObj.iceQueue.forEach(candidate => {
              peerObj.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
            });
            peerObj.iceQueue = [];
          }
        } catch (e) {
          console.error("Failed to set remote answer", e);
        }
      }
    };

    const handleIceCandidate = async ({ sender, candidate }) => {
      const peerObj = peersRef.current[sender];
      if (peerObj && peerObj.pc.signalingState !== 'closed') {
        if (peerObj.pc.remoteDescription) {
          try {
            await peerObj.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Error adding received ice candidate", e);
          }
        } else {
          if (!peerObj.iceQueue) peerObj.iceQueue = [];
          peerObj.iceQueue.push(candidate);
        }
      }
    };

    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_answer", handleAnswer);
    socket.on("webrtc_ice_candidate", handleIceCandidate);

    return () => {
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("webrtc_ice_candidate", handleIceCandidate);
    };
  }, [socket]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(peerObj => {
        if (peerObj.pc && peerObj.pc.signalingState !== 'closed') peerObj.pc.close();
      });
    };
  }, []);

  return {
    localStream,
    peers,
    isMuted,
    startVoiceChat,
    toggleMute
  };
};
