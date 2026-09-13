import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Volume2, 
  VolumeX, 
  Radio, 
  Maximize2, 
  Minimize2, 
  Activity, 
  SwitchCamera, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  Wifi,
  AlertCircle
} from 'lucide-react';
import { Call, Profile, User } from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useTranslation } from '../i18n/LanguageContext';
import { soundManager } from '../utils/sound';

interface CallOverlayProps {
  call: Call;
  currentUser?: User | null;
  currentUserProfile: Profile | null;
  onEndCall: () => void;
}

// Google & Cloudflare Public STUN Servers (No fake TURN credentials)
const STUN_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
  { urls: ['stun:stun4.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
  { urls: ['stun:stun.services.mozilla.com'] },
];

// Memoized call timer that does not re-render the parent video stage
const CallTimer: React.FC<{ isActive: boolean }> = React.memo(({ isActive }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return <span>{`${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`}</span>;
});

// Memoized audio visualizer that animates smoothly without triggering parent re-renders
const AudioVisualizer: React.FC<{ isActive: boolean }> = React.memo(({ isActive }) => {
  const [level, setLevel] = useState(50);

  useEffect(() => {
    if (!isActive) {
      setLevel(0);
      return;
    }
    const interval = setInterval(() => {
      setLevel(Math.floor(Math.random() * 50) + 40);
    }, 400);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-1.5 h-8 mt-5">
      {[40, 70, 95, 60, 30, 85, 50, 90, 45, 65, 80, 35].map((h, i) => (
        <div
          key={i}
          className="w-1.5 bg-emerald-400 rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
          style={{
            height: `${Math.max(6, (h * level) / 100)}px`,
          }}
        />
      ))}
    </div>
  );
});

const CallOverlayComponent: React.FC<CallOverlayProps> = ({
  call,
  currentUser,
  currentUserProfile,
  onEndCall,
}) => {
  const { t } = useTranslation();

  // Participant resolution
  const myUserId = currentUser?.id || currentUserProfile?.user_id || currentUserProfile?.id || '';
  const isCaller = call.caller_id === myUserId;
  const otherUserId = isCaller ? call.receiver_id : call.caller_id;
  const otherProfile = isCaller ? call.receiver_profile : call.caller_profile;
  const targetPhoto = otherProfile?.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80';
  const targetName = otherProfile?.name || 'Partner';

  // Call & UI states
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected'>(
    call.status === 'accepted' ? 'connecting' : 'ringing'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(call.type === 'voice');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSwappedView, setIsSwappedView] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [mediaPermissionError, setMediaPermissionError] = useState<string | null>(null);

  // Element Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);

  // WebRTC Instance Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isInitiatingOfferRef = useRef<boolean>(false);
  const isCleaningUpRef = useRef<boolean>(false);
  const sendOfferRef = useRef<() => void>(() => {});
  const hasSentInitialOfferRef = useRef<boolean>(false);
  const localMediaPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const onEndCallRef = useRef(onEndCall);

  useEffect(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);

  // Helper to safely play media elements
  const playMediaElement = (el: HTMLVideoElement | HTMLAudioElement | null) => {
    if (!el) return;
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.catch((err) => {
          console.warn('[WebRTC] playMediaElement note:', err?.message || err);
        });
      }
    } catch (e) {
      console.warn('[WebRTC] playMediaElement error:', e);
    }
  };

  // 1. Manage Outgoing Ringtone
  useEffect(() => {
    if (isCaller && callState === 'ringing') {
      console.log('[WebRTC] Starting outgoing ringtone for caller');
      soundManager.startOutgoingRingtone();
    } else {
      soundManager.stopOutgoingRingtone();
    }

    return () => {
      soundManager.stopOutgoingRingtone();
    };
  }, [isCaller, callState]);

  // Handle call status accepted transition smoothly without tearing down WebRTC
  useEffect(() => {
    if (call.status === 'accepted') {
      soundManager.stopOutgoingRingtone();
      if (isCaller && peerConnectionRef.current && peerConnectionRef.current.signalingState === 'stable' && !hasSentInitialOfferRef.current) {
        hasSentInitialOfferRef.current = true;
        sendOfferRef.current();
      }
    }
  }, [call.status, isCaller]);

  // 2. Core WebRTC Connection & Signaling Engine
  useEffect(() => {
    isCleaningUpRef.current = false;
    hasSentInitialOfferRef.current = false;
    const socket = getSocket();
    let isCancelled = false;

    console.log(`[WebRTC] Initializing session. Call: ${call.id}, Type: ${call.type}, Role: ${isCaller ? 'Caller' : 'Callee'}, MyUser: ${myUserId}`);

    // Create RTCPeerConnection instance
    const pc = new RTCPeerConnection({
      iceServers: STUN_ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });
    peerConnectionRef.current = pc;

    // Flush any queued ICE candidates once remote description is set
    const flushQueuedIceCandidates = async () => {
      console.log(`[WebRTC] Flushing ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[WebRTC] Added queued ICE candidate successfully');
          } catch (iceErr) {
            console.warn('[WebRTC] Failed to add queued ICE candidate:', iceErr);
          }
        }
      }
    };

    // A. Trickle ICE Candidates (send immediately as discovered)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate discovered, sending trickle ICE:', event.candidate.candidate.substring(0, 40));
        socket.emit('webrtc:ice-candidate', {
          callId: call.id,
          caller_id: call.caller_id,
          receiver_id: call.receiver_id,
          target_user_id: otherUserId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      } else {
        console.log('[WebRTC] End of ICE candidates gathering');
      }
    };

    pc.onicecandidateerror = (event: any) => {
      console.warn('[WebRTC] ICE candidate error event:', event.errorText || event);
    };

    // B. Monitor Connection State & ICE State
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState changed:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        soundManager.stopOutgoingRingtone();
        soundManager.playConnectedChime();
        if (remoteAudioRef.current) playMediaElement(remoteAudioRef.current);
        if (remoteVideoRef.current) playMediaElement(remoteVideoRef.current);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.warn(`[WebRTC] connectionState entered ${pc.connectionState}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState changed:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('connected');
        soundManager.stopOutgoingRingtone();
      }
    };

    // C. Remote Track Reception (ontrack)
    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack received: kind=${event.track.kind}, id=${event.track.id}`);
      
      // Ensure track is active and enabled
      event.track.enabled = true;

      // Handle video track: attach ONLY video track to <video> element
      if (event.track.kind === 'video') {
        setHasRemoteStream(true);
        let vStream = remoteVideoStreamRef.current;
        if (!vStream) {
          vStream = new MediaStream([event.track]);
          remoteVideoStreamRef.current = vStream;
        } else if (!vStream.getTracks().some((t) => t.id === event.track.id)) {
          vStream.addTrack(event.track);
        }
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== vStream) {
          remoteVideoRef.current.srcObject = vStream;
          remoteVideoRef.current.play().catch(() => {});
        }
      } else if (event.track.kind === 'audio') {
        if (call.type === 'voice') {
          setHasRemoteStream(true);
        }
        // Handle audio track: attach ONLY audio track to <audio> element
        let aStream = remoteAudioStreamRef.current;
        if (!aStream) {
          aStream = new MediaStream([event.track]);
          remoteAudioStreamRef.current = aStream;
        } else if (!aStream.getTracks().some((t) => t.id === event.track.id)) {
          aStream.addTrack(event.track);
        }
        if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== aStream) {
          remoteAudioRef.current.srcObject = aStream;
          remoteAudioRef.current.play().catch(() => {});
        }
      }

      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote track unmuted: ${event.track.kind}`);
        event.track.enabled = true;
      };

      setCallState('connected');
      soundManager.stopOutgoingRingtone();
    };

    // D. Function to Create and Dispatch SDP Offer (Caller)
    const sendOffer = async (isRenegotiation = false) => {
      if (isCancelled || isCleaningUpRef.current) return;
      if (!isCaller) return;
      if (isInitiatingOfferRef.current) {
        console.log('[WebRTC] Already initiating offer, skipping');
        return;
      }

      // Ensure local media is ready and tracks are attached before creating offer
      if (localMediaPromiseRef.current) {
        try {
          await localMediaPromiseRef.current;
        } catch (e) {}
      }

      if (pc.signalingState !== 'stable') {
        console.log(`[WebRTC] Signaling state is not stable (${pc.signalingState}), skipping sendOffer`);
        return;
      }

      try {
        console.log(`[WebRTC] Creating SDP offer (renegotiation: ${isRenegotiation})...`);
        isInitiatingOfferRef.current = true;

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: call.type === 'video',
        });

        if (pc.signalingState !== 'stable') {
          console.warn(`[WebRTC] Signaling state changed to ${pc.signalingState} during createOffer, aborting`);
          return;
        }

        console.log('[WebRTC] setLocalDescription with offer');
        await pc.setLocalDescription(offer);

        console.log('[WebRTC] Emitting webrtc:offer via socket');
        socket.emit('webrtc:offer', {
          callId: call.id,
          caller_id: call.caller_id,
          receiver_id: call.receiver_id,
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });
      } catch (err) {
        console.error('[WebRTC] Error in sendOffer:', err);
      } finally {
        setTimeout(() => {
          isInitiatingOfferRef.current = false;
        }, 500);
      }
    };
    sendOfferRef.current = sendOffer;

    // E. Socket Signaling Event Handlers
    const handleOffer = async (payload: any) => {
      if (payload?.callId !== call.id || isCaller || isCancelled) return;
      console.log('[WebRTC] Received webrtc:offer from caller');

      // CRITICAL: Callee MUST wait for its local media (camera/mic) to initialize
      // and add tracks to pc BEFORE creating the SDP answer, so video is bidirectional!
      if (localMediaPromiseRef.current) {
        try {
          console.log('[WebRTC] Callee waiting for local camera/audio before answering offer...');
          await localMediaPromiseRef.current;
        } catch (e) {
          console.warn('[WebRTC] Local media wait note:', e);
        }
      }

      try {
        const remoteDesc = new RTCSessionDescription(payload.offer);
        console.log('[WebRTC] setRemoteDescription with offer, current state:', pc.signalingState);

        if (pc.signalingState !== 'stable') {
          console.warn('[WebRTC] Signaling state not stable before setRemoteDescription, rolling back');
          await pc.setLocalDescription({ type: 'rollback' } as any);
        }

        await pc.setRemoteDescription(remoteDesc);
        console.log('[WebRTC] setRemoteDescription success. Flushing queued ICE candidates...');
        await flushQueuedIceCandidates();

        console.log('[WebRTC] Creating SDP answer...');
        const answer = await pc.createAnswer();
        console.log('[WebRTC] setLocalDescription with answer');
        await pc.setLocalDescription(answer);

        console.log('[WebRTC] Emitting webrtc:answer via socket');
        socket.emit('webrtc:answer', {
          callId: call.id,
          caller_id: call.caller_id,
          receiver_id: call.receiver_id,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });

        setCallState('connected');
        soundManager.stopOutgoingRingtone();
      } catch (err) {
        console.error('[WebRTC] Error in handleOffer:', err);
      }
    };

    const handleAnswer = async (payload: any) => {
      if (payload?.callId !== call.id || !isCaller || isCancelled) return;
      console.log('[WebRTC] Received webrtc:answer from callee');

      try {
        if (pc.signalingState === 'have-local-offer') {
          const remoteDesc = new RTCSessionDescription(payload.answer);
          console.log('[WebRTC] Caller setRemoteDescription with answer');
          await pc.setRemoteDescription(remoteDesc);
          await flushQueuedIceCandidates();
          setCallState('connected');
          soundManager.stopOutgoingRingtone();
          soundManager.playConnectedChime();
        } else {
          console.warn('[WebRTC] Received answer but signaling state was:', pc.signalingState);
        }
      } catch (err) {
        console.error('[WebRTC] Error in handleAnswer:', err);
      }
    };

    const handleIceCandidate = async (payload: any) => {
      if (payload?.callId !== call.id || !payload?.candidate || isCancelled) return;
      
      const candidateInit: RTCIceCandidateInit = payload.candidate;
      console.log('[WebRTC] Received remote ICE candidate');

      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          console.log('[WebRTC] Remote ICE candidate added directly');
        } catch (err) {
          console.warn('[WebRTC] addIceCandidate direct failed:', err);
        }
      } else {
        console.log('[WebRTC] Remote description not set yet, queuing ICE candidate');
        iceCandidatesQueueRef.current.push(candidateInit);
      }
    };

    const handlePeerReady = () => {
      console.log('[WebRTC] Received peer ready signal');
      soundManager.stopOutgoingRingtone();
      setCallState('connected');
      if (isCaller && pc.signalingState === 'stable' && !isInitiatingOfferRef.current && !hasSentInitialOfferRef.current) {
        hasSentInitialOfferRef.current = true;
        sendOffer();
      }
    };

    const handleCallAccepted = () => {
      console.log('[WebRTC] Received call:accepted event');
      soundManager.stopOutgoingRingtone();
      setCallState('connected');
      if (isCaller && pc.signalingState === 'stable' && !isInitiatingOfferRef.current && !hasSentInitialOfferRef.current) {
        hasSentInitialOfferRef.current = true;
        sendOffer();
      }
    };

    const handleCallEnded = () => {
      console.log('[WebRTC] Received call:ended event');
      soundManager.stopOutgoingRingtone();
      soundManager.playEndTone();
      onEndCallRef.current();
    };

    const handleMediaToggle = (payload: any) => {
      if (payload?.callId === call.id) {
        if (payload.isVideoOff !== undefined) setIsRemoteVideoOff(payload.isVideoOff);
      }
    };

    // Register socket listeners
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
    socket.on('webrtc:ready', handlePeerReady);
    socket.on('webrtc:request-offer', handlePeerReady);
    socket.on('webrtc:media-toggle', handleMediaToggle);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:ready', handlePeerReady);
    socket.on('call:peer-joined', handlePeerReady);
    socket.on('call:ended', handleCallEnded);

    // F. Acquire Local Media (getUserMedia) with smooth, stable mobile & web constraints
    const initLocalMedia = async () => {
      let localStream: MediaStream | null = null;
      try {
        console.log(`[WebRTC] Requesting getUserMedia (type: ${call.type})...`);
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: call.type === 'video' ? {
            facingMode: 'user',
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 },
          } : false,
        };

        try {
          localStream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('[WebRTC] getUserMedia succeeded with optimal smooth constraints');
        } catch (conErr) {
          console.warn('[WebRTC] Ideal constraints failed, falling back to standard getUserMedia:', conErr);
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: call.type === 'video' ? { facingMode: 'user' } : false,
            });
          } catch (fallbackErr) {
            localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: call.type === 'video',
            });
          }
          console.log('[WebRTC] getUserMedia fallback succeeded');
        }
      } catch (permErr: any) {
        console.error('[WebRTC] getUserMedia failed entirely:', permErr);
        setMediaPermissionError(permErr.message || 'Media permission denied or hardware unavailable');
        
        // If video failed, attempt audio-only fallback
        if (call.type === 'video') {
          try {
            console.log('[WebRTC] Trying audio-only fallback after video failure...');
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setIsVideoOff(true);
            console.log('[WebRTC] Audio-only fallback succeeded');
          } catch (audioErr) {
            console.error('[WebRTC] Audio fallback also failed:', audioErr);
          }
        }
      }

      if (isCancelled || isCleaningUpRef.current) {
        if (localStream) localStream.getTracks().forEach((t) => t.stop());
        return null;
      }

      if (localStream) {
        localStreamRef.current = localStream;

        // Attach video tracks ONLY to local video element (avoid audio pipeline interference)
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoStream = new MediaStream(videoTracks);
          localVideoStreamRef.current = videoStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = videoStream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
          }
        }

        // Add local tracks to RTCPeerConnection with motion hint for smooth playback
        localStream.getTracks().forEach((track) => {
          try {
            console.log(`[WebRTC] Adding local track: kind=${track.kind}, id=${track.id}`);
            track.enabled = true;
            if (track.kind === 'video' && 'contentHint' in track) {
              (track as any).contentHint = 'motion';
            }
            pc.addTrack(track, localStream!);
          } catch (addErr) {
            console.error('[WebRTC] Error in addTrack:', addErr);
          }
        });
      }

      // Join Call Room via Socket
      console.log(`[WebRTC] Emitting call:join for room call_${call.id}`);
      socket.emit('call:join', {
        callId: call.id,
        userId: myUserId,
        isCaller,
      });

      // If Callee, notify Caller that Callee has camera/mic ready
      if (!isCaller) {
        console.log('[WebRTC] Callee ready with tracks, emitting webrtc:ready');
        socket.emit('webrtc:ready', {
          callId: call.id,
          userId: myUserId,
          targetUserId: otherUserId,
        });
      } else if (call.status === 'accepted') {
        console.log('[WebRTC] Caller initializing accepted call, dispatching offer');
        hasSentInitialOfferRef.current = true;
        sendOffer();
      }

      return localStream;
    };

    localMediaPromiseRef.current = initLocalMedia();

    // G. Cleanup on Unmount or Call End
    return () => {
      isCancelled = true;
      isCleaningUpRef.current = true;
      console.log(`[WebRTC] Cleaning up call session ${call.id}`);

      soundManager.stopOutgoingRingtone();

      // Remove socket listeners
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('webrtc:ready', handlePeerReady);
      socket.off('webrtc:request-offer', handlePeerReady);
      socket.off('webrtc:media-toggle', handleMediaToggle);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:ready', handlePeerReady);
      socket.off('call:peer-joined', handlePeerReady);
      socket.off('call:ended', handleCallEnded);

      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
        localStreamRef.current = null;
      }
      localVideoStreamRef.current = null;

      // Stop remote tracks
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
        remoteStreamRef.current = null;
      }
      remoteVideoStreamRef.current = null;
      remoteAudioStreamRef.current = null;

      // Close RTCPeerConnection
      if (peerConnectionRef.current) {
        console.log('[WebRTC] Closing RTCPeerConnection');
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      socket.emit('call:leave', { callId: call.id });
    };
  }, [call.id, call.type, isCaller, myUserId, otherUserId]);

  // Synchronize stream references on video elements if not yet attached
  useEffect(() => {
    if (localVideoRef.current && localVideoStreamRef.current && !localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject = localVideoStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [isVideoOff, facingMode]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoStreamRef.current && !remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject = remoteVideoStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [hasRemoteStream, isRemoteVideoOff]);

  // 4. Toggle Microphone Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
    getSocket().emit('webrtc:media-toggle', {
      callId: call.id,
      isMuted: nextMuted,
    });
  };

  // 5. Toggle Video Camera
  const toggleVideo = () => {
    const nextOff = !isVideoOff;
    setIsVideoOff(nextOff);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !nextOff;
      });
    }
    getSocket().emit('webrtc:media-toggle', {
      callId: call.id,
      isVideoOff: nextOff,
    });
  };

  // 6. Flip Camera (Front / Rear on Mobile Devices)
  const toggleFlipCamera = async () => {
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacingMode);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacingMode, width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 } },
          audio: false,
        });
        const newVideoTrack = newStream.getVideoTracks()[0];

        if (newVideoTrack && localStreamRef.current) {
          const oldTracks = localStreamRef.current.getVideoTracks();
          oldTracks.forEach((t) => {
            t.stop();
            localStreamRef.current?.removeTrack(t);
          });
          localStreamRef.current.addTrack(newVideoTrack);

          const newLocalVidStream = new MediaStream([newVideoTrack]);
          localVideoStreamRef.current = newLocalVidStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newLocalVidStream;
            localVideoRef.current.play().catch(() => {});
          }

          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(newVideoTrack);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Camera flip error:', err);
    }
  };

  // 7. Toggle Speaker Output
  const toggleSpeaker = () => {
    const nextMuted = !isSpeakerMuted;
    setIsSpeakerMuted(nextMuted);
    if (remoteAudioRef.current) remoteAudioRef.current.muted = nextMuted;
  };

  // 8. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      overlayContainerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 9. End Call Handler
  const handleEnd = async () => {
    console.log('[WebRTC] Hanging up call...');
    soundManager.stopOutgoingRingtone();
    soundManager.playEndTone();
    try {
      if (call.id) {
        await api.endCall(call.id);
      }
    } catch (err) {}
    getSocket().emit('call:end', {
      callId: call.id,
      caller_id: call.caller_id,
      receiver_id: call.receiver_id,
    });
    onEndCall();
  };

  return (
    <div 
      ref={overlayContainerRef}
      onClick={() => {
        soundManager.unlock();
        if (remoteAudioRef.current) playMediaElement(remoteAudioRef.current);
        if (remoteVideoRef.current) playMediaElement(remoteVideoRef.current);
      }}
      className="fixed inset-0 z-50 bg-stone-950 text-white flex flex-col justify-between p-2 sm:p-4 select-none touch-none overflow-hidden h-[100dvh]"
    >
      {/* Hidden Unmuted Audio Element for Remote Audio Stream */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={isSpeakerMuted}
        className="sr-only"
      />

      {/* Top Header Floating Bar */}
      <div className="flex items-center justify-between z-30 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-stone-900/80 backdrop-blur-xl border border-white/10 mx-1 shadow-2xl">
        
        {/* User Identity & Live Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-emerald-500 bg-stone-800 shadow-md">
              <img
                src={targetPhoto}
                alt={targetName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {callState === 'connected' && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-stone-950 rounded-full" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm sm:text-base font-sans leading-tight">{targetName}</h3>
              {callState === 'connected' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-0.5">
                  <Activity className="w-2.5 h-2.5" /> HD
                </span>
              )}
            </div>

            <div className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
              {callState === 'connected' ? (
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <CallTimer isActive={true} />
                </span>
              ) : (
                <span className="text-rose-400 font-medium flex items-center gap-1.5 animate-pulse">
                  <Radio className="w-3.5 h-3.5 animate-spin" /> {isCaller ? 'Calling / Ringing...' : 'Connecting...'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badges & Fullscreen Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700/60 text-[11px] text-stone-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline font-sans">Full HD 1080p</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 active:scale-95 text-stone-300 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Permission Warning Banner if device was blocked */}
      {mediaPermissionError && (
        <div className="mx-2 my-1 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{mediaPermissionError}. Please allow microphone and camera in your browser settings.</span>
        </div>
      )}

      {/* Main Video & Audio Call Stage */}
      <div className="relative flex-1 my-2 rounded-3xl overflow-hidden bg-stone-900 border border-stone-800/80 flex items-center justify-center shadow-2xl">
        
        {call.type === 'video' ? (
          <div className="relative w-full h-full bg-stone-950 overflow-hidden flex items-center justify-center">
            
            {/* Slot 1: Remote Video Feed (Fullscreen by default, PiP if swapped) */}
            <div className={`transition-all duration-300 overflow-hidden ${
              isSwappedView 
                ? 'absolute bottom-4 right-4 w-28 sm:w-44 h-40 sm:h-60 rounded-2xl border-2 border-emerald-500/80 bg-stone-950 shadow-2xl z-20 cursor-pointer active:scale-95' 
                : 'absolute inset-0 w-full h-full z-0'
            }`}
            onClick={() => isSwappedView && setIsSwappedView(false)}
            >
              {/* Remote WebRTC Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={true}
                className={`w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${hasRemoteStream && !isRemoteVideoOff ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
              />

              {/* Remote Avatar Screen when video is off or connecting */}
              {(!hasRemoteStream || isRemoteVideoOff) && (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-radial from-stone-900 via-stone-950 to-black text-stone-300 p-6 text-center overflow-hidden">
                  <div className="absolute -top-20 -left-20 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative mb-5">
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-rose-500/80 shadow-2xl bg-stone-800">
                      <img
                        src={targetPhoto}
                        alt={targetName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {callState === 'connected' && (
                      <>
                        <div className="absolute -inset-3 rounded-full border-2 border-emerald-500/50 animate-ping pointer-events-none" />
                        <div className="absolute -inset-6 rounded-full border border-emerald-500/20 animate-pulse pointer-events-none" />
                      </>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-white font-serif tracking-wide">{targetName}</h2>
                  
                  <div className="flex items-center gap-2 mt-2">
                    {callState === 'connected' ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Connected (HD 2-Way)</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                        <Radio className="w-3.5 h-3.5 animate-spin" />
                        <span>{isCaller ? 'Ringing partner...' : 'Connecting...'}</span>
                      </span>
                    )}
                  </div>

                  <AudioVisualizer isActive={callState === 'connected' && !isMuted} />
                </div>
              )}

              {isSwappedView && (
                <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[10px] text-white font-semibold flex items-center justify-between pointer-events-none">
                  <span className="truncate">{targetName}</span>
                  <Layers className="w-3 h-3 text-emerald-400" />
                </div>
              )}
            </div>

            {/* Slot 2: Local Video Feed (PiP by default, Fullscreen if swapped) */}
            <div className={`transition-all duration-300 overflow-hidden ${
              !isSwappedView 
                ? 'absolute bottom-4 right-4 w-28 sm:w-44 h-40 sm:h-60 rounded-2xl border-2 border-emerald-500/80 bg-stone-950 shadow-2xl z-20 cursor-pointer active:scale-95' 
                : 'absolute inset-0 w-full h-full z-0'
            }`}
            onClick={() => !isSwappedView && setIsSwappedView(true)}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted={true}
                className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoOff ? 'opacity-0' : 'opacity-100'} ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {isVideoOff && (
                <div className="absolute inset-0 bg-stone-900 flex flex-col items-center justify-center text-stone-400 text-xs p-2 text-center">
                  <VideoOff className="w-6 h-6 mb-1 text-rose-400" />
                  <span>Your Camera is Off</span>
                </div>
              )}

              {!isSwappedView && (
                <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[10px] text-white font-semibold flex items-center justify-between pointer-events-none">
                  <span className="truncate">You</span>
                  <Layers className="w-3 h-3 text-emerald-400" />
                </div>
              )}
            </div>

            {/* Live Indicator Overlay */}
            {callState === 'connected' && (
              <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium flex items-center gap-2 shadow-lg pointer-events-none">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                <span>{targetName} (Live 2-Way HD)</span>
              </div>
            )}

          </div>
        ) : (
          /* Voice Call Stage Centerpiece */
          <div className="flex flex-col items-center space-y-6 text-center z-10 px-4">
            
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-rose-500 shadow-2xl">
                <img
                  src={targetPhoto}
                  alt={targetName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {callState === 'connected' && (
                <>
                  <div className="absolute -inset-4 rounded-full border-2 border-emerald-500 animate-ping pointer-events-none opacity-40" />
                  <div className="absolute -inset-8 rounded-full border border-emerald-500/30 animate-pulse pointer-events-none" />
                </>
              )}
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white font-serif">{targetName}</h2>
              <p className="text-sm text-stone-400 mt-1 font-sans">
                {callState === 'connected' 
                  ? 'Real-Time HD Audio Active' 
                  : isCaller ? 'Calling / Ringing...' : 'Connecting...'}
              </p>
            </div>

            {/* Voice Activity Frequency Visualizer */}
            <AudioVisualizer isActive={callState === 'connected' && !isMuted} />

          </div>
        )}

      </div>

      {/* Floating Bottom Control Bar */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-4 z-30 py-2 px-3 rounded-2xl bg-stone-900/90 backdrop-blur-xl border border-white/10 mx-auto w-full max-w-lg shadow-2xl">
        
        {/* Mute Microphone */}
        <button
          onClick={toggleMute}
          className={`p-3.5 sm:p-4 rounded-full transition shadow-lg active:scale-90 flex items-center justify-center cursor-pointer ${
            isMuted 
              ? 'bg-rose-600 text-white ring-4 ring-rose-600/30' 
              : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {/* Video Camera Toggle */}
        {call.type === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-3.5 sm:p-4 rounded-full transition shadow-lg active:scale-90 flex items-center justify-center cursor-pointer ${
              isVideoOff 
                ? 'bg-rose-600 text-white ring-4 ring-rose-600/30' 
                : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
            }`}
            title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        )}

        {/* Flip Camera (Front & Rear on Mobile) */}
        {call.type === 'video' && (
          <button
            onClick={toggleFlipCamera}
            className="p-3.5 sm:p-4 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition shadow-lg active:scale-90 flex items-center justify-center cursor-pointer"
            title="Flip Camera (Front / Rear)"
          >
            <SwitchCamera className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </button>
        )}

        {/* Speaker Volume Toggle */}
        <button
          onClick={toggleSpeaker}
          className={`p-3.5 sm:p-4 rounded-full transition shadow-lg active:scale-90 flex items-center justify-center cursor-pointer ${
            isSpeakerMuted 
              ? 'bg-amber-600 text-white ring-4 ring-amber-600/30' 
              : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
          }`}
          title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
        >
          {isSpeakerMuted ? <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {/* Swap View Button */}
        {call.type === 'video' && (
          <button
            onClick={() => setIsSwappedView(!isSwappedView)}
            className="p-3.5 sm:p-4 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition shadow-lg active:scale-90 flex items-center justify-center cursor-pointer"
            title="Swap Screens"
          >
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
          </button>
        )}

        {/* Red End Call Button */}
        <button
          onClick={handleEnd}
          className="p-3.5 sm:p-4 px-6 sm:px-8 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-90 text-white font-bold transition shadow-xl shadow-rose-900/50 flex items-center gap-2 cursor-pointer ml-1 sm:ml-2"
          title={t('endCall')}
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="hidden sm:inline font-semibold">{t('endCall')}</span>
        </button>

      </div>

    </div>
  );
};

export const CallOverlay = React.memo(CallOverlayComponent);
export default CallOverlay;
