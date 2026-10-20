import { useEffect, useRef, useState, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import socket from '../socket';

/**
 * useMediasoup — Complete WebRTC + mediasoup media management
 * Supports:
 * - Camera producer
 * - Microphone producer
 * - Screen sharing producer (navigator.mediaDevices.getDisplayMedia)
 * - Remote screen share dedicated stream
 * - Connection quality monitoring
 * - Reconnection and producer/consumer lifecycle
 */
export function useMediasoup({ roomId: roomIdParam, role, lectureTitle = 'Live Lecture' }) {
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenProducerRef = useRef(null);
  const screenStreamRef = useRef(null);
  const audioProducerRef = useRef(null);
  const videoProducerRef = useRef(null);

  const isInvalidParam = !roomIdParam || roomIdParam === 'new' || roomIdParam === 'undefined' || roomIdParam === 'null';
  const sanitizedInitialRoom = isInvalidParam ? null : roomIdParam.trim().toUpperCase();

  const getSavedPref = (type, key) => {
    if (typeof window === 'undefined') return null;
    if (key) {
      const val = sessionStorage.getItem(`${type}_pref_${key}`);
      if (val !== null) return val === 'true';
    }
    if (sanitizedInitialRoom) {
      const val = sessionStorage.getItem(`${type}_pref_${sanitizedInitialRoom}`);
      if (val !== null) return val === 'true';
    }
    const globalVal = sessionStorage.getItem(`lecturelens_${type}_preference`);
    if (globalVal !== null) return globalVal === 'true';
    return null;
  };

  const initialMic = getSavedPref('mic', sanitizedInitialRoom);
  const initialCam = getSavedPref('cam', sanitizedInitialRoom);

  const [roomId, setRoomId] = useState(sanitizedInitialRoom);
  const [lectureId, setLectureId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // key → MediaStream
  const [screenStream, setScreenStream] = useState(null); // Local screen share
  const [remoteScreenStream, setRemoteScreenStream] = useState(null); // Remote screen share
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [micEnabled, setMicEnabled] = useState(initialMic !== null ? initialMic : true);
  const [cameraEnabled, setCameraEnabled] = useState(initialCam !== null ? initialCam : true);
  const [connectionQuality, setConnectionQuality] = useState('Good');
  const [participants, setParticipants] = useState([]);

  // Promisified socket emit
  const emit = useCallback((event, data = {}) => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ error: `Timeout waiting for server response on '${event}'` });
      }, 7000);

      socket.emit(event, data, (res) => {
        clearTimeout(timer);
        resolve(res || {});
      });
    });
  }, []);

  // Load mediasoup Device
  const loadDevice = useCallback(async (rtpCapabilities) => {
    const device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;
    return device;
  }, []);

  // Create send transport
  const createSendTransport = useCallback(async (device, stream) => {
    const { transportParams, error: err } = await emit('createTransport', { direction: 'send' });
    if (err) throw new Error(err);

    const transport = device.createSendTransport(transportParams);
    sendTransportRef.current = transport;

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        const res = await emit('connectTransport', {
          transportId: transport.id,
          dtlsParameters,
        });
        if (res?.error) throw new Error(res.error);
        callback();
      } catch (e) { errback(e); }
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const { producerId, error: err } = await emit('produce', {
          transportId: transport.id,
          kind,
          rtpParameters,
          appData,
        });
        if (err) throw new Error(err);
        callback({ id: producerId });
      } catch (e) { errback(e); }
    });

    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const vp = await transport.produce({ track: videoTrack, appData: { type: 'camera' } });
        videoProducerRef.current = vp;
        if (!videoTrack.enabled) {
          try { await vp.pause(); } catch (e) {}
        }
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const ap = await transport.produce({ track: audioTrack, appData: { type: 'microphone' } });
        audioProducerRef.current = ap;
        if (!audioTrack.enabled) {
          try { await ap.pause(); } catch (e) {}
        }
      }
    }
  }, [emit]);

  // Create recv transport
  const createRecvTransport = useCallback(async (device) => {
    const { transportParams, error: err } = await emit('createTransport', { direction: 'recv' });
    if (err) throw new Error(err);

    const transport = device.createRecvTransport(transportParams);
    recvTransportRef.current = transport;

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        const res = await emit('connectTransport', {
          transportId: transport.id,
          dtlsParameters,
        });
        if (res?.error) throw new Error(res.error);
        callback();
      } catch (e) { errback(e); }
    });

    return transport;
  }, [emit]);

  // Consume one producer
  const consumeProducer = useCallback(async ({ producerId, peerId, type, userName }) => {
    const device = deviceRef.current;
    const transport = recvTransportRef.current;
    if (!device || !transport) return;

    const { consumerParams, error: err } = await emit('consume', {
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });
    if (err) {
      console.warn('[consume] Server error:', err);
      return;
    }

    const consumer = await transport.consume(consumerParams);
    await emit('resumeConsumer', { consumerId: consumer.id });

    const stream = new MediaStream([consumer.track]);

    // Distinguish screen sharing stream
    const isScreen = type === 'screen' || consumerParams.appData?.type === 'screen';
    if (isScreen) {
      console.log(`[useMediasoup] Screen share stream received from ${userName || peerId}`);
      setRemoteScreenStream(stream);
    } else {
      const key = `${peerId}_${producerId}`;
      setRemoteStreams((prev) => ({
        ...prev,
        [key]: { stream, userName: userName || 'Peer', kind: consumerParams.kind },
      }));
    }
  }, [emit]);

  // Screen Sharing: Start
  const startScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true, // share system audio if available
      });

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const screenTrack = displayStream.getVideoTracks()[0];

      // Produce screen track through mediasoup
      const producer = await sendTransportRef.current.produce({
        track: screenTrack,
        appData: { type: 'screen' },
      });
      screenProducerRef.current = producer;

      // Handle user stopping screen share via browser UI bar
      screenTrack.onended = () => {
        stopScreenShare();
      };

      console.log('[Screen Share] Started producer:', producer.id);
    } catch (err) {
      console.warn('[Screen Share] Error starting display media:', err.message);
      setIsScreenSharing(false);
    }
  }, []);

  // Screen Sharing: Stop
  const stopScreenShare = useCallback(async () => {
    if (screenProducerRef.current) {
      await emit('closeProducer', { producerId: screenProducerRef.current.id });
      screenProducerRef.current.close();
      screenProducerRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    setScreenStream(null);
    setIsScreenSharing(false);
    console.log('[Screen Share] Stopped');
  }, [emit]);

  // Bug #26 fix: Guard against double-invocation in React strict mode
  const joinCalledRef = useRef(false);

  // Main join flow
  const join = useCallback(async () => {
    if (!role) return;
    if (joinCalledRef.current) return;
    joinCalledRef.current = true;
    setStatus('connecting');
    setError(null);

    try {
      if (!socket.connected) {
        socket.connect();
        await new Promise((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
        });
      }

      let rtpCapabilities;
      let resolvedRoomId = sanitizedInitialRoom;

      if (role === 'host') {
        const res = await emit('createRoom', {
          roomId: sanitizedInitialRoom || undefined,
          title: lectureTitle,
        });
        if (res?.error) throw new Error(res.error);
        if (!res?.roomId) throw new Error('Failed to obtain room ID from server');
        rtpCapabilities = res.rtpCapabilities;
        resolvedRoomId = res.roomId.toUpperCase();
        setRoomId(resolvedRoomId);
        if (res.lectureId) setLectureId(res.lectureId);

        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', `/room/${resolvedRoomId}?role=host`);
        }
      } else {
        const joinTarget = sanitizedInitialRoom || (roomIdParam || '').trim().toUpperCase();
        if (!joinTarget || joinTarget === 'UNDEFINED' || joinTarget === 'NULL') {
          throw new Error('Please enter a valid 8-digit Room Code to join.');
        }
        const res = await emit('joinRoom', { roomId: joinTarget });
        if (res.error) throw new Error(res.error);
        rtpCapabilities = res.rtpCapabilities;
        resolvedRoomId = (res.roomId || joinTarget).toUpperCase();
        setRoomId(resolvedRoomId);
        if (res.lectureId) setLectureId(res.lectureId);
      }

      const device = await loadDevice(rtpCapabilities);

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (mediaErr) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setCameraEnabled(false);
        } catch (audioErr) {
          setCameraEnabled(false);
          setMicEnabled(false);
        }
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Apply saved mic/camera state across page refresh
      const targetRoomKey = resolvedRoomId || sanitizedInitialRoom;
      const micPref = getSavedPref('mic', targetRoomKey);
      const camPref = getSavedPref('cam', targetRoomKey);

      if (stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack && micPref !== null) {
          audioTrack.enabled = micPref;
          setMicEnabled(micPref);
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && camPref !== null) {
          videoTrack.enabled = camPref;
          setCameraEnabled(camPref);
        }
      }

      await createRecvTransport(device);

      if (stream) {
        await createSendTransport(device, stream);
      }

      // Consume existing producers
      const { producers, error: pErr } = await emit('getProducers');
      if (pErr) throw new Error(pErr);
      if (producers) {
        for (const producer of producers) {
          await consumeProducer(producer);
        }
      }

      setStatus('connected');
    } catch (err) {
      console.error('[useMediasoup] Init error:', err);
      setError(err.message);
      setStatus('error');
      joinCalledRef.current = false; // allow retry on error
    }
  }, [role, roomIdParam, lectureTitle, emit, loadDevice, createRecvTransport, createSendTransport, consumeProducer]);

  // Mic & Camera Toggles
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    const nextState = !audioTrack.enabled;
    audioTrack.enabled = nextState;
    setMicEnabled(nextState);

    if (audioProducerRef.current) {
      try {
        if (nextState) {
          audioProducerRef.current.resume();
        } else {
          audioProducerRef.current.pause();
        }
      } catch (e) {
        console.warn('[toggleMic] Producer pause/resume:', e);
      }
    }

    if (typeof window !== 'undefined') {
      const activeKey = roomId || sanitizedInitialRoom || roomIdParam || 'default';
      sessionStorage.setItem(`mic_pref_${activeKey}`, String(nextState));
      sessionStorage.setItem('lecturelens_mic_preference', String(nextState));
    }
  }, [roomId, sanitizedInitialRoom, roomIdParam]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const nextState = !videoTrack.enabled;
    videoTrack.enabled = nextState;
    setCameraEnabled(nextState);

    if (videoProducerRef.current) {
      try {
        if (nextState) {
          videoProducerRef.current.resume();
        } else {
          videoProducerRef.current.pause();
        }
      } catch (e) {
        console.warn('[toggleCamera] Producer pause/resume:', e);
      }
    }

    if (typeof window !== 'undefined') {
      const activeKey = roomId || sanitizedInitialRoom || roomIdParam || 'default';
      sessionStorage.setItem(`cam_pref_${activeKey}`, String(nextState));
      sessionStorage.setItem('lecturelens_cam_preference', String(nextState));
    }
  }, [roomId, sanitizedInitialRoom, roomIdParam]);

  // Live Chat
  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;
    const userStr = localStorage.getItem('lecturelens_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const senderName = user?.name || (role === 'host' ? 'Teacher' : 'Student');

    setMessages((prev) => [
      ...prev,
      { peerId: 'self', senderName, message: text, timestamp: Date.now() },
    ]);
    socket.emit('chatMessage', { message: text });
  }, [role]);

  // Kick participant (Host moderation)
  const removeParticipant = useCallback((peerId) => {
    socket.emit('removeParticipant', { peerId }, (res) => {
      if (res?.error) alert(res.error);
    });
  }, []);

  // Bug #21 fix: Use actual WebRTC stats for connection quality monitoring
  useEffect(() => {
    if (status !== 'connected' || !sendTransportRef.current) return;
    const interval = setInterval(async () => {
      try {
        const transport = sendTransportRef.current;
        if (!transport || transport.connectionState !== 'connected') {
          setConnectionQuality(transport?.connectionState === 'connecting' ? 'Fair' : 'Poor');
          return;
        }
        // Try to get real stats from the underlying RTCPeerConnection
        const pc = transport._handler?._pc || transport._handler?._sendTransport?._handler?._pc;
        if (pc && typeof pc.getStats === 'function') {
          const stats = await pc.getStats();
          let rtt = null;
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) {
              rtt = report.currentRoundTripTime;
            }
          });
          if (rtt !== null) {
            if (rtt < 0.1) setConnectionQuality('Excellent');
            else if (rtt < 0.3) setConnectionQuality('Good');
            else if (rtt < 0.5) setConnectionQuality('Fair');
            else setConnectionQuality('Poor');
            return;
          }
        }
        // Fallback if stats unavailable
        setConnectionQuality('Good');
      } catch (e) {
        setConnectionQuality('Good');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status]);

  // Socket event listeners
  useEffect(() => {
    const handleNewProducer = async (data) => {
      await consumeProducer(data);
    };

    const handleProducerClosed = ({ producerId, peerId }) => {
      // Bug #9 fix: Only clear remoteScreenStream if the closed producer was a screen share
      setRemoteStreams((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.endsWith(`_${producerId}`)) delete next[key];
        }
        return next;
      });
      // Check if any remaining remote stream entries belong to this producer;
      // if not found in remoteStreams, it might have been the screen producer
      setRemoteScreenStream((prev) => {
        // We don't have explicit screen producerId tracking on the consumer side,
        // so check: if the producerId was being consumed as screen, prev will be non-null.
        // Clear it only if no screen video DOM element is still playing.
        if (!prev) return null;
        // After a small delay, check if screen video is still active
        setTimeout(() => {
          const screenVideo = document.querySelector('video[data-screen="true"]');
          if (!screenVideo || screenVideo.videoWidth === 0) {
            setRemoteScreenStream(null);
          }
        }, 200);
        return prev;
      });
    };

    const handlePeerLeft = ({ peerId }) => {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${peerId}_`)) delete next[key];
        }
        return next;
      });
    };

    const handlePeerJoined = ({ peerId, user }) => {
      setParticipants((prev) => [...prev, { peerId, user }]);
    };

    const handleChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleRemoved = ({ reason }) => {
      alert(`You have been removed from the lecture: ${reason}`);
      window.location.href = '/dashboard';
    };

    socket.on('newProducer', handleNewProducer);
    socket.on('producerClosed', handleProducerClosed);
    socket.on('peerJoined', handlePeerJoined);
    socket.on('peerLeft', handlePeerLeft);
    socket.on('chatMessage', handleChatMessage);
    socket.on('removedFromRoom', handleRemoved);

    return () => {
      socket.off('newProducer', handleNewProducer);
      socket.off('producerClosed', handleProducerClosed);
      socket.off('peerJoined', handlePeerJoined);
      socket.off('peerLeft', handlePeerLeft);
      socket.off('chatMessage', handleChatMessage);
      socket.off('removedFromRoom', handleRemoved);
    };
  }, [consumeProducer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
    };
  }, []);

  return {
    roomId,
    lectureId,
    localStream,
    remoteStreams,
    screenStream,
    remoteScreenStream,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    messages,
    sendMessage,
    removeParticipant,
    status,
    error,
    join,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    connectionQuality,
    participants,
  };
}
