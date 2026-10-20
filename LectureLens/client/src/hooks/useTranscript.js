import { useRef, useState, useCallback, useEffect } from 'react';
import { io as llmIo } from 'socket.io-client';
import socket from '../socket';
import { aiApi } from '../services/api';

const SYNC_INTERVAL_MS = 3000;
const CHUNK_INTERVAL_MS = 5000;
const LLM_SERVER_URL = import.meta.env.VITE_LLM_SERVER_URL || 'http://localhost:5000';
const DEFAULT_AUTO_SNAP_INTERVAL_SEC = 30; // seconds between automatic snapshots

export function useTranscript({ roomId, role, localStream, micEnabled = true, lectureId }) {
  const [segments, setSegments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLectureRecording, setIsLectureRecording] = useState(false); // Video recording
  const [transcriptStatus, setTranscriptStatus] = useState('idle');
  const [summary, setSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const savedLang = typeof window !== 'undefined' ? sessionStorage.getItem('lecturelens_transcript_lang') || 'en' : 'en';
  const [selectedLanguage, setSelectedLanguage] = useState(savedLang);
  const [translatedSegments, setTranslatedSegments] = useState({});
  const [boardContents, setBoardContents] = useState([]);
  const [isCapturingBoard, setIsCapturingBoard] = useState(false);
  const [autoSnapEnabled, setAutoSnapEnabled] = useState(false);
  const [autoSnapIntervalSec, setAutoSnapIntervalSec] = useState(DEFAULT_AUTO_SNAP_INTERVAL_SEC);

  // Bug #10 fix: keep a ref of translatedSegments so socket handlers never read stale closure
  const translatedSegmentsRef = useRef({});

  const selectedLanguageRef = useRef(savedLang);
  const mediaRecorderRef = useRef(null);
  const fullRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(null);
  const segmentsRef = useRef([]);
  const syncIntervalRef = useRef(null);
  const roomJoinTimeRef = useRef(Date.now());
  const meetingStartRef = useRef(null);
  const segmentIdRef = useRef(0);
  const llmSocketRef = useRef(null);
  const isRecordingRef = useRef(false);
  const chunkTimerRef = useRef(null);
  const audioQueueRef = useRef([]);
  const autoSnapTimerRef = useRef(null);       // setInterval id for auto-snapping
  const isAutoSnappingRef = useRef(false);      // guard: skip cycle if a snap is in flight
  const autoSnapSourceRef = useRef(null);       // latest active screen / camera source
  const autoSnapEnabledRef = useRef(false);     // mirror of autoSnapEnabled for use in timer closure

  const buildFullText = (segs) =>
    segs.map((s) => s.text).filter(Boolean).join(' ');

  const syncToSFU = useCallback(
    (segs) => {
      socket.emit('syncTranscript', {
        roomId,
        segments: segs,
        fullText: buildFullText(segs),
      });
    },
    [roomId]
  );

  // Preload existing board, slide contents, and transcript segments across refresh/join
  useEffect(() => {
    const targetId = lectureId || roomId;
    if (!targetId) return;

    const mergeSegments = (newSegs, status) => {
      if (!Array.isArray(newSegs) || newSegs.length === 0) return;
      const normalized = newSegs.map((s) => ({
        id: s.id || s.chunk_id,
        text: s.text,
        speakerName: s.speakerName || s.speaker_name || 'Teacher',
        startOffset: s.startOffset ?? s.start_time ?? 0,
        endOffset: s.endOffset ?? s.end_time ?? ((s.startOffset ?? s.start_time ?? 0) + 3.0),
        status: s.status || 'complete',
        timestamp: s.timestamp || Date.now(),
      }));

      const existing = segmentsRef.current || [];
      const map = new Map();
      existing.forEach((item) => map.set(item.id, item));
      normalized.forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values()).sort((a, b) => (a.startOffset || 0) - (b.startOffset || 0));

      setSegments(merged);
      segmentsRef.current = merged;

      const maxId = merged.reduce((max, s) => {
        const num = typeof s.id === 'number' ? s.id : parseInt(s.id, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      if (maxId > segmentIdRef.current) {
        segmentIdRef.current = maxId;
      }

      if (status) {
        setTranscriptStatus(status);
      }

      // If non-English language selected, request translation for rehydrated segments
      const currentLang = selectedLanguageRef.current;
      if (currentLang && currentLang !== 'en') {
        merged.forEach((seg) => {
          if (seg.text && !translatedSegmentsRef.current[`${seg.id}_${currentLang}`]) {
            socket.emit('translateText', { text: seg.text, targetLang: currentLang }, (res) => {
              if (res?.translatedText) {
                setTranslatedSegments((prev) => {
                  const next = { ...prev, [`${seg.id}_${currentLang}`]: res.translatedText };
                  translatedSegmentsRef.current = next;
                  return next;
                });
              }
            });
          }
        });
      }
    };

    // 1. Preload board contents, screen contents, and REST transcript
    Promise.allSettled([
      aiApi.getBoardContents(targetId),
      aiApi.getScreenContents(targetId),
      aiApi.getTranscript(targetId),
    ]).then(([bRes, sRes, tRes]) => {
      const bList = bRes.status === 'fulfilled' && Array.isArray(bRes.value) ? bRes.value : [];
      const sList = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      const combined = [...bList, ...sList].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (combined.length > 0) {
        setBoardContents(combined);
      }

      if (tRes.status === 'fulfilled' && tRes.value) {
        const data = tRes.value;
        const apiSegments = data.segments || (Array.isArray(data) ? data : []);
        if (apiSegments.length > 0) {
          mergeSegments(apiSegments, data.transcript?.status);
        }
      }
    });

    // 2. Preload/rehydrate via Socket for freshest live segments
    socket.emit('getTranscript', { roomId, lectureId: targetId }, (res) => {
      if (res?.segments && Array.isArray(res.segments) && res.segments.length > 0) {
        mergeSegments(res.segments, res.status);
      }
    });
  }, [lectureId, roomId]);

  // Real-time transcript socket listeners
  useEffect(() => {
    const handleStarted = ({ status }) => setTranscriptStatus(status || 'live');

    const handleUpdated = ({ segments: newSegs, status }) => {
      if (role !== 'host') {
        setSegments(newSegs || []);
        segmentsRef.current = newSegs || [];
        if (status) setTranscriptStatus(status);

        const currentLang = selectedLanguageRef.current;
        if (currentLang && currentLang !== 'en' && Array.isArray(newSegs)) {
          newSegs.forEach((seg) => {
            // Bug #10 fix: read from ref instead of stale closure
            if (seg.text && !translatedSegmentsRef.current[`${seg.id}_${currentLang}`]) {
              socket.emit('translateText', { text: seg.text, targetLang: currentLang }, (res) => {
                if (res?.translatedText) {
                  setTranslatedSegments((prev) => {
                    const next = { ...prev, [`${seg.id}_${currentLang}`]: res.translatedText };
                    translatedSegmentsRef.current = next;
                    return next;
                  });
                }
              });
            }
          });
        }
      }
    };

    const handleEnded = ({ segments: newSegs, status }) => {
      if (role !== 'host') {
        setSegments(newSegs || []);
        segmentsRef.current = newSegs || [];
      }
      setTranscriptStatus(status || 'complete');
    };

    const handleContentAdded = (content) => {
      if (!content) return;
      setBoardContents((prev) => {
        // If content is marked as an update or replaced an existing id
        if (content.isUpdate || content.replacedId) {
          const targetId = content.replacedId || content.id;
          const exists = prev.some((b) => b.id === targetId || b.id === content.id);
          if (exists) {
            return prev.map((b) => (b.id === targetId || b.id === content.id ? content : b));
          }
        }
        // If duplicate was detected and existing was kept
        if (content.isDuplicate && content.keptExistingId) {
          return prev; // keep existing without adding duplicate card
        }
        if (prev.some((b) => b.id === content.id)) {
          return prev.map((b) => (b.id === content.id ? content : b));
        }
        return [content, ...prev];
      });
    };

    socket.on('transcriptStarted', handleStarted);
    socket.on('transcriptUpdated', handleUpdated);
    socket.on('transcriptEnded', handleEnded);
    socket.on('boardContentAdded', handleContentAdded);
    socket.on('screenContentAdded', handleContentAdded);

    return () => {
      socket.off('transcriptStarted', handleStarted);
      socket.off('transcriptUpdated', handleUpdated);
      socket.off('transcriptEnded', handleEnded);
      socket.off('boardContentAdded', handleContentAdded);
      socket.off('screenContentAdded', handleContentAdded);
    };
  }, [role]);

  // Start Transcription (Host)
  const startTranscription = useCallback(async () => {
    if (!localStream || role !== 'host') return;

    socket.emit('startTranscription', { roomId, lectureId });
    if (!meetingStartRef.current) {
      meetingStartRef.current = Date.now();
    }
    // Retain existing segments so page refresh or re-start doesn't wipe history
    if (!segmentsRef.current) {
      segmentsRef.current = [];
    }
    isRecordingRef.current = true;
    audioQueueRef.current = [];

    setIsRecording(true);
    setTranscriptStatus('live');
    setSegments([...segmentsRef.current]);

    if (typeof window !== 'undefined') {
      const activeKey = roomId || lectureId || 'default';
      sessionStorage.setItem(`transcription_active_${activeKey}`, 'true');
      if (roomId) sessionStorage.setItem(`transcription_active_${roomId}`, 'true');
    }

    const userStr = localStorage.getItem('lecturelens_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const speakerName = user?.name || 'Prof. Turing (Teacher)';

    try {
      if (!llmSocketRef.current || !llmSocketRef.current.connected) {
        llmSocketRef.current = llmIo(LLM_SERVER_URL, {
          reconnectionAttempts: 5,
          timeout: 5000,
        });

        llmSocketRef.current.on('connect', () => {
          console.log('[LLM Client] Connected to STT service at', LLM_SERVER_URL);
          llmSocketRef.current.emit('startSession', { sessionId: roomId });
          while (audioQueueRef.current.length > 0) {
            const item = audioQueueRef.current.shift();
            llmSocketRef.current.emit('audioChunk', item);
          }
        });

        llmSocketRef.current.on('transcriptSegment', ({ chunkId, text, startOffset, endOffset }) => {
          if (!text || !text.trim()) return;
          console.log('[Transcript] Received segment:', chunkId, text);
          const cleanText = text.trim();
          const existingIdx = segmentsRef.current.findIndex((s) =>
            chunkId != null ? s.id === chunkId : (s.status === 'pending' && Math.abs(s.startOffset - (startOffset || 0)) < 3.0)
          );

          let segItem;
          if (existingIdx !== -1) {
            segmentsRef.current[existingIdx] = {
              ...segmentsRef.current[existingIdx],
              text: cleanText,
              endOffset: endOffset || segmentsRef.current[existingIdx].startOffset + 3.0,
              status: 'complete',
              speakerName: segmentsRef.current[existingIdx].speakerName || speakerName,
            };
            segItem = segmentsRef.current[existingIdx];
          } else {
            segItem = {
              id: chunkId || ++segmentIdRef.current,
              text: cleanText,
              speakerName,
              startOffset: startOffset || 0,
              endOffset: endOffset || (startOffset || 0) + 3.0,
              status: 'complete',
              timestamp: Date.now(),
            };
            segmentsRef.current.push(segItem);
          }
          setSegments([...segmentsRef.current]);
          syncToSFU(segmentsRef.current);

          // If current language is not English, translate this incoming segment immediately
          const currentLang = selectedLanguageRef.current;
          if (currentLang && currentLang !== 'en' && segItem?.id) {
            socket.emit('translateText', { text: cleanText, targetLang: currentLang }, (res) => {
              if (res?.translatedText) {
                setTranslatedSegments((prev) => {
                  const next = { ...prev, [`${segItem.id}_${currentLang}`]: res.translatedText };
                  translatedSegmentsRef.current = next;
                  return next;
                });
              }
            });
          }
        });
      } else {
        llmSocketRef.current.emit('startSession', { sessionId: roomId });
      }
    } catch (e) {
      console.warn('[LLM Server] Connect error:', e.message);
    }

    const audioTracks = localStream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      console.warn('[Transcription] No audio tracks available in local stream');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const startAudioChunkRecorder = () => {
      if (!isRecordingRef.current) return;

      const currentAudioTrack = localStream?.getAudioTracks()[0];
      if (!currentAudioTrack || !currentAudioTrack.enabled) {
        chunkTimerRef.current = setTimeout(startAudioChunkRecorder, 1000);
        return;
      }

      let recorder;
      try {
        const audioOnlyStream = new MediaStream([currentAudioTrack]);
        recorder = new MediaRecorder(audioOnlyStream, { mimeType });
      } catch (err) {
        console.warn('[Transcription] Error creating MediaRecorder:', err);
        chunkTimerRef.current = setTimeout(startAudioChunkRecorder, 2000);
        return;
      }

      mediaRecorderRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (chunks.length > 0 && isRecordingRef.current) {
          const completeBlob = new Blob(chunks, { type: mimeType });
          const now = Date.now();
          const startOffset = parseFloat(((now - (meetingStartRef.current || now)) / 1000).toFixed(2));
          const chunkId = ++segmentIdRef.current;

          const newSeg = {
            id: chunkId,
            text: '',
            speakerName,
            startOffset,
            endOffset: null,
            timestamp: now,
            status: 'pending',
          };

          segmentsRef.current = [...segmentsRef.current, newSeg];
          setSegments([...segmentsRef.current]);

          const payload = {
            sessionId: roomId,
            chunk: completeBlob,
            startOffset,
            chunkId,
            language: selectedLanguageRef.current,
          };

          if (llmSocketRef.current?.connected) {
            llmSocketRef.current.emit('audioChunk', payload);
          } else {
            audioQueueRef.current.push(payload);
          }
        }

        if (isRecordingRef.current) {
          startAudioChunkRecorder();
        }
      };

      recorder.start();

      chunkTimerRef.current = setTimeout(() => {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      }, CHUNK_INTERVAL_MS);
    };

    startAudioChunkRecorder();

    syncIntervalRef.current = setInterval(() => {
      syncToSFU(segmentsRef.current);
    }, SYNC_INTERVAL_MS);
  }, [localStream, role, roomId, lectureId, micEnabled, syncToSFU]);

  // Stop Transcription
  const stopTranscription = useCallback(() => {
    isRecordingRef.current = false;
    clearTimeout(chunkTimerRef.current);
    audioQueueRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    clearInterval(syncIntervalRef.current);

    syncToSFU(segmentsRef.current);
    socket.emit('endTranscription', { roomId });

    setIsRecording(false);
    setTranscriptStatus('complete');

    if (typeof window !== 'undefined') {
      const activeKey = roomId || lectureId || 'default';
      sessionStorage.removeItem(`transcription_active_${activeKey}`);
      if (roomId) sessionStorage.removeItem(`transcription_active_${roomId}`);
      sessionStorage.removeItem('transcription_active_default');
    }

    if (llmSocketRef.current) {
      llmSocketRef.current.emit('endSession', { sessionId: roomId });
      llmSocketRef.current.disconnect();
      llmSocketRef.current = null;
    }
  }, [roomId, lectureId, syncToSFU]);

  // Auto-resume host transcription on reload if it was active before refresh
  const autoResumeAttemptedRef = useRef(false);
  useEffect(() => {
    if (role !== 'host' || !localStream || isRecordingRef.current || autoResumeAttemptedRef.current) return;
    const activeKey = roomId || lectureId || 'default';
    const wasActive =
      typeof window !== 'undefined' &&
      (sessionStorage.getItem(`transcription_active_${activeKey}`) === 'true' ||
        (roomId && sessionStorage.getItem(`transcription_active_${roomId}`) === 'true') ||
        (lectureId && sessionStorage.getItem(`transcription_active_${lectureId}`) === 'true'));

    if (wasActive) {
      autoResumeAttemptedRef.current = true;
      console.log('[Transcript] Auto-resuming host transcription session after page refresh...');
      startTranscription();
    }
  }, [role, localStream, roomId, lectureId, startTranscription]);

  // Full Lecture Video Recording
  const startLectureRecording = useCallback(() => {
    if (!localStream) return;
    try {
      recordedChunksRef.current = [];
      recordingStartRef.current = Date.now();
      const recorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });
      fullRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);
      setIsLectureRecording(true);
      console.log('[Recorder] Lecture video recording started');
    } catch (err) {
      console.error('[Recorder] Failed to start lecture video recording:', err);
    }
  }, [localStream]);

  const stopLectureRecording = useCallback(async () => {
    if (!fullRecorderRef.current) return;
    fullRecorderRef.current.stop();
    setIsLectureRecording(false);

    const durationSec = recordingStartRef.current
      ? (Date.now() - recordingStartRef.current) / 1000
      : 0;

    setTimeout(async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const targetId = lectureId || roomId;
      try {
        console.log(`[Recorder] Uploading recording for lecture ${targetId} (${blob.size} bytes)...`);
        await aiApi.uploadRecording(targetId, blob, durationSec);
        console.log('[Recorder] Lecture video uploaded successfully!');
      } catch (err) {
        console.error('[Recorder] Upload recording failed:', err);
      }
    }, 500);
  }, [lectureId, roomId]);

  // Robust helper to capture JPEG base64 from either MediaStream or HTMLVideoElement
  const grabFrameBase64 = async (source) => {
    if (!source) throw new Error('No video source provided');

    // Case 1: source is an HTMLVideoElement that is already rendering frames
    if (source instanceof HTMLVideoElement && source.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    // Resolve MediaStream (if source is MediaStream, or if video element wraps a stream)
    const mediaStream = source instanceof MediaStream
      ? source
      : (source.srcObject instanceof MediaStream ? source.srcObject : null);

    if (mediaStream) {
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No active video track found in stream');

      // Check if ANY active <video> currently rendered in the DOM has this stream or track
      const domVideos = Array.from(document.querySelectorAll('video'));
      const activeDomVideo = domVideos.find(
        (v) => (v.srcObject === mediaStream || v.srcObject?.id === mediaStream.id) && v.videoWidth > 0
      ) || domVideos.find(
        (v) => v.dataset?.screen === 'true' && v.videoWidth > 0
      );

      if (activeDomVideo && activeDomVideo.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = activeDomVideo.videoWidth;
        canvas.height = activeDomVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(activeDomVideo, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.9);
      }

      // If no active DOM video element is found, attach a temporary video element to DOM
      // (Chrome's compositor requires DOM attachment to pump frames for display/webcam streams)
      return new Promise((resolve, reject) => {
        const tempVideo = document.createElement('video');
        tempVideo.muted = true;
        tempVideo.defaultMuted = true;
        tempVideo.playsInline = true;
        tempVideo.autoplay = true;
        tempVideo.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:160px;height:90px;opacity:0;pointer-events:none;z-index:-1;';
        document.body.appendChild(tempVideo);
        tempVideo.srcObject = mediaStream;

        let finished = false;
        const cleanupAndFinish = () => {
          if (finished) return;
          finished = true;
          try {
            const canvas = document.createElement('canvas');
            const w = tempVideo.videoWidth || 1280;
            const h = tempVideo.videoHeight || 720;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempVideo, 0, 0, w, h);
            tempVideo.srcObject = null;
            tempVideo.remove();
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          } catch (err) {
            tempVideo.srcObject = null;
            tempVideo.remove();
            reject(err);
          }
        };

        tempVideo.onloadeddata = cleanupAndFinish;
        tempVideo.onplaying = cleanupAndFinish;
        tempVideo.onloadedmetadata = () => {
          tempVideo.play().then(cleanupAndFinish).catch(cleanupAndFinish);
        };

        // Poll videoWidth > 0
        const poll = setInterval(() => {
          if (tempVideo.videoWidth > 0) {
            clearInterval(poll);
            cleanupAndFinish();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(poll);
          if (tempVideo.videoWidth > 0) {
            cleanupAndFinish();
          } else {
            tempVideo.srcObject = null;
            tempVideo.remove();
            reject(new Error('Video frame capture timed out (inactive stream)'));
          }
        }, 3000);
      });
    }

    // Fallback: regular HTMLVideoElement
    if (source instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth || 1280;
      canvas.height = source.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    throw new Error('Unsupported video source format');
  };

  // Capture Board Frame Snapshot (Camera / Whiteboard)
  const captureBoardSnapshot = useCallback(async (source) => {
    try {
      setIsCapturingBoard(true);
      const imageBase64 = await grabFrameBase64(source);
      const now = Date.now();
      const timestamp = meetingStartRef.current
        ? (now - meetingStartRef.current) / 1000
        : (now - roomJoinTimeRef.current) / 1000;
      const targetId = lectureId || roomId;

      const result = await aiApi.uploadBoardFrame(targetId, imageBase64, timestamp);
      if (result) {
        setBoardContents((prev) => {
          if (result.isUpdate || result.replacedId) {
            const target = result.replacedId || result.id;
            if (prev.some((b) => b.id === target || b.id === result.id)) {
              return prev.map((b) => (b.id === target || b.id === result.id ? result : b));
            }
          }
          if (result.isDuplicate && result.keptExistingId) {
            return prev;
          }
          if (prev.some((b) => b.id === result.id)) {
            return prev.map((b) => (b.id === result.id ? result : b));
          }
          return [result, ...prev];
        });
      }
      setIsCapturingBoard(false);
      return result;
    } catch (err) {
      console.error('[Board Snapshot] Error:', err);
      setIsCapturingBoard(false);
      throw err;
    }
  }, [lectureId, roomId]);

  // Capture Screen Frame Snapshot (Shared Screen / Slide)
  const captureScreenSnapshot = useCallback(async (source) => {
    try {
      setIsCapturingBoard(true);
      const imageBase64 = await grabFrameBase64(source);
      const now = Date.now();
      const timestamp = meetingStartRef.current
        ? (now - meetingStartRef.current) / 1000
        : (now - roomJoinTimeRef.current) / 1000;
      const targetId = lectureId || roomId;

      const result = await aiApi.uploadScreenFrame(targetId, imageBase64, timestamp);
      if (result) {
        setBoardContents((prev) => {
          if (result.isUpdate || result.replacedId) {
            const target = result.replacedId || result.id;
            if (prev.some((b) => b.id === target || b.id === result.id)) {
              return prev.map((b) => (b.id === target || b.id === result.id ? result : b));
            }
          }
          if (result.isDuplicate && result.keptExistingId) {
            return prev;
          }
          if (prev.some((b) => b.id === result.id)) {
            return prev.map((b) => (b.id === result.id ? result : b));
          }
          return [result, ...prev];
        });
      }
      setIsCapturingBoard(false);
      return result;
    } catch (err) {
      console.error('[Screen Snapshot] Error:', err);
      setIsCapturingBoard(false);
      throw err;
    }
  }, [lectureId, roomId]);

  // Language translation
  // Bug #11 fix: read translatedSegmentsRef instead of stale translatedSegments closure
  const changeLanguage = useCallback((langCode) => {
    setSelectedLanguage(langCode);
    selectedLanguageRef.current = langCode;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lecturelens_transcript_lang', langCode);
    }
    if (langCode === 'en') return;

    segmentsRef.current.forEach((seg) => {
      if (seg.text && !translatedSegmentsRef.current[`${seg.id}_${langCode}`]) {
        socket.emit('translateText', { text: seg.text, targetLang: langCode }, (res) => {
          if (res?.translatedText) {
            setTranslatedSegments((prev) => {
              const next = { ...prev, [`${seg.id}_${langCode}`]: res.translatedText };
              translatedSegmentsRef.current = next;
              return next;
            });
          }
        });
      }
    });
  }, []);

  // Fetch complete transcript
  const fetchTranscript = useCallback(() => {
    const targetId = lectureId || roomId;
    socket.emit('getTranscript', { roomId, lectureId: targetId }, (res) => {
      if (res?.segments && Array.isArray(res.segments)) {
        const normalized = res.segments.map((s) => ({
          id: s.id || s.chunk_id,
          text: s.text,
          speakerName: s.speakerName || s.speaker_name || 'Teacher',
          startOffset: s.startOffset ?? s.start_time ?? 0,
          endOffset: s.endOffset ?? s.end_time ?? ((s.startOffset ?? s.start_time ?? 0) + 3.0),
          status: s.status || 'complete',
          timestamp: s.timestamp || Date.now(),
        }));
        setSegments(normalized);
        segmentsRef.current = normalized;
        setTranscriptStatus(res.status || 'idle');
      }
    });
  }, [roomId, lectureId]);

  // ── Auto-Snap: keep ref in sync with state so timer closure always reads latest ──
  useEffect(() => {
    autoSnapEnabledRef.current = autoSnapEnabled;
  }, [autoSnapEnabled]);

  // ── Auto-Snap: store capture fns in refs so the timer closure is never stale ──
  const captureBoardSnapshotRef = useRef(captureBoardSnapshot);
  const captureScreenSnapshotRef = useRef(captureScreenSnapshot);
  useEffect(() => { captureBoardSnapshotRef.current = captureBoardSnapshot; }, [captureBoardSnapshot]);
  useEffect(() => { captureScreenSnapshotRef.current = captureScreenSnapshot; }, [captureScreenSnapshot]);

  // ── Auto-Snap: core timer management ─────────────────────────────────────────
  const startAutoSnapTimer = useCallback((intervalSec) => {
    if (autoSnapTimerRef.current) {
      clearInterval(autoSnapTimerRef.current);
      autoSnapTimerRef.current = null;
    }

    console.log(`[Auto-Snap] Timer starting — fires every ${intervalSec}s`);

    autoSnapTimerRef.current = setInterval(async () => {
      // Skip if auto-snap was turned off or a snap is already in flight
      if (!autoSnapEnabledRef.current || isAutoSnappingRef.current) return;

      console.log('[Auto-Snap] Timer tick — attempting capture...');
      isAutoSnappingRef.current = true;
      try {
        const screenSrc = autoSnapSourceRef.current;
        if (screenSrc) {
          // Screen share is active — snap the slide
          console.log('[Auto-Snap] Capturing screen/slide source');
          await captureScreenSnapshotRef.current(screenSrc);
        } else {
          // No screen share — snap the first visible camera video
          const cameraVideo = document.querySelector('video:not([data-screen="true"])');
          if (cameraVideo && cameraVideo.videoWidth > 0) {
            console.log('[Auto-Snap] Capturing camera/whiteboard source');
            await captureBoardSnapshotRef.current(cameraVideo);
          } else {
            console.warn('[Auto-Snap] No active video source found to capture');
          }
        }
      } catch (err) {
        console.warn('[Auto-Snap] Snapshot skipped:', err.message);
      } finally {
        isAutoSnappingRef.current = false;
      }
    }, intervalSec * 1000);
  }, []); // no deps — reads everything through refs

  const stopAutoSnapTimer = useCallback(() => {
    if (autoSnapTimerRef.current) {
      clearInterval(autoSnapTimerRef.current);
      autoSnapTimerRef.current = null;
    }
  }, []);

  // Toggle auto-snap on/off
  const toggleAutoSnap = useCallback(() => {
    setAutoSnapEnabled((prev) => {
      const next = !prev;
      if (next) {
        startAutoSnapTimer(autoSnapIntervalSec);
        console.log(`[Auto-Snap] Started — every ${autoSnapIntervalSec}s`);
      } else {
        stopAutoSnapTimer();
        console.log('[Auto-Snap] Stopped');
      }
      return next;
    });
  }, [autoSnapIntervalSec, startAutoSnapTimer, stopAutoSnapTimer]);

  // Update interval duration (restarts timer if running)
  const updateAutoSnapInterval = useCallback((newSec) => {
    const sec = Math.max(10, Number(newSec) || DEFAULT_AUTO_SNAP_INTERVAL_SEC);
    setAutoSnapIntervalSec(sec);
    if (autoSnapEnabledRef.current) {
      startAutoSnapTimer(sec);
    }
  }, [startAutoSnapTimer]);

  // ── Auto-Snap: expose a way for RoomPage to register the active screen source ──
  const setAutoSnapSource = useCallback((source) => {
    autoSnapSourceRef.current = source || null;
  }, []);

  // ── Auto-Snap: stop timer when unmounting ────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAutoSnapTimer();
    };
  }, [stopAutoSnapTimer]);

  return {
    segments,
    isRecording,
    isLectureRecording,
    startLectureRecording,
    stopLectureRecording,
    transcriptStatus,
    summary,
    selectedLanguage,
    translatedSegments,
    boardContents,
    isCapturingBoard,
    captureBoardSnapshot,
    captureScreenSnapshot,
    changeLanguage,
    startTranscription,
    stopTranscription,
    fetchTranscript,
    // Auto-snap API
    autoSnapEnabled,
    autoSnapIntervalSec,
    toggleAutoSnap,
    updateAutoSnapInterval,
    setAutoSnapSource,
  };
}
