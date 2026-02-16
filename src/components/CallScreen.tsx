import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WebRTCCallManager, VIDEO_QUALITY } from '../lib/webrtc';

interface CallScreenProps {
  isVideo: boolean;
  isIncoming: boolean;
  callerName: string;
  callerAvatar?: string;
  onEnd: () => void;
  stunEnabled?: boolean;
  turnEnabled?: boolean;
  videoQuality?: keyof typeof VIDEO_QUALITY;
  // Signaling callbacks
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  // Incoming data
  incomingOffer?: RTCSessionDescriptionInit;
  incomingAnswer?: RTCSessionDescriptionInit;
  incomingIceCandidate?: RTCIceCandidate;
}

export const CallScreen: React.FC<CallScreenProps> = ({
  isVideo,
  isIncoming,
  callerName,
  callerAvatar,
  onEnd,
  stunEnabled = true,
  turnEnabled = true,
  videoQuality = 'FULL_HD_60',
  onOffer,
  onAnswer,
  onIceCandidate,
  incomingOffer,
  incomingAnswer,
  incomingIceCandidate,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callManagerRef = useRef<WebRTCCallManager | null>(null);
  
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [duration, setDuration] = useState(0);
  const [transportUsed, setTransportUsed] = useState<'stun' | 'turn' | 'unknown'>('unknown');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    bytesReceived: 0,
    bytesSent: 0,
    packetsLost: 0,
    roundTripTime: 0,
  });
  
  const durationIntervalRef = useRef<number | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  
  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Initialize call
  const initializeCall = useCallback(async () => {
    const manager = new WebRTCCallManager();
    callManagerRef.current = manager;
    
    // Set up event handlers
    manager.setOnIceCandidate((candidate) => {
      console.log('[CallScreen] ICE candidate:', candidate.candidate?.substring(0, 50));
      onIceCandidate?.(candidate);
    });
    
    manager.setOnRemoteStream((stream) => {
      console.log('[CallScreen] Remote stream received');
      
      if (isVideo && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(console.error);
      }
      
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(console.error);
      }
    });
    
    manager.setOnConnectionStateChange((state) => {
      console.log('[CallScreen] Connection state:', state);
      
      if (state === 'connected') {
        setCallState('connected');
        
        // Start duration timer
        durationIntervalRef.current = window.setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
        
        // Start stats monitoring
        statsIntervalRef.current = window.setInterval(async () => {
          const callStats = await manager.getStats();
          setTransportUsed(callStats.transportUsed as 'stun' | 'turn' | 'unknown');
          setStats({
            bytesReceived: callStats.bytesReceived,
            bytesSent: callStats.bytesSent,
            packetsLost: callStats.packetsLost,
            roundTripTime: callStats.roundTripTime,
          });
        }, 2000);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        handleEndCall();
      }
    });
    
    // Initialize peer connection
    await manager.initialize(stunEnabled, turnEnabled);
    
    // Get local stream
    const localStream = await manager.getLocalStream(isVideo, true, videoQuality);
    
    if (isVideo && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(console.error);
    }
    
    setCallState('connecting');
    
    // If outgoing call, create offer
    if (!isIncoming) {
      const offer = await manager.createOffer();
      onOffer?.(offer);
    }
    
    return manager;
  }, [isVideo, isIncoming, stunEnabled, turnEnabled, videoQuality, onOffer, onIceCandidate]);
  
  // Handle incoming offer
  useEffect(() => {
    if (incomingOffer && callManagerRef.current) {
      (async () => {
        const answer = await callManagerRef.current!.createAnswer(incomingOffer);
        onAnswer?.(answer);
      })();
    }
  }, [incomingOffer, onAnswer]);
  
  // Handle incoming answer
  useEffect(() => {
    if (incomingAnswer && callManagerRef.current) {
      callManagerRef.current.handleAnswer(incomingAnswer);
    }
  }, [incomingAnswer]);
  
  // Handle incoming ICE candidate
  useEffect(() => {
    if (incomingIceCandidate && callManagerRef.current) {
      callManagerRef.current.addIceCandidate(incomingIceCandidate);
    }
  }, [incomingIceCandidate]);
  
  // Initialize on mount
  useEffect(() => {
    initializeCall();
    
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      callManagerRef.current?.endCall();
    };
  }, [initializeCall]);
  
  // Toggle mute
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    callManagerRef.current?.toggleAudio(!newMuted);
  };
  
  // Toggle video
  const toggleVideo = () => {
    const newVideoOff = !isVideoOff;
    setIsVideoOff(newVideoOff);
    callManagerRef.current?.toggleVideo(!newVideoOff);
  };
  
  // Switch camera
  const switchCamera = async () => {
    await callManagerRef.current?.switchCamera();
  };
  
  // Toggle speaker
  const toggleSpeaker = () => {
    const newSpeaker = !isSpeaker;
    setIsSpeaker(newSpeaker);
    
    if (remoteAudioRef.current) {
      // Note: setSinkId requires user permission and HTTPS
      // This is a simplified implementation
      remoteAudioRef.current.volume = newSpeaker ? 1 : 0.3;
    }
  };
  
  // End call
  const handleEndCall = () => {
    setCallState('ended');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    callManagerRef.current?.endCall();
    callManagerRef.current = null;
    
    onEnd();
  };
  
  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-gray-900">
      {/* Video backgrounds */}
      {isVideo ? (
        <>
          {/* Remote video (full screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Local video (picture-in-picture) */}
          <div className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <span className="text-4xl">📵</span>
              </div>
            )}
          </div>
        </>
      ) : (
        // Audio call background
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center">
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt={callerName}
              className="w-32 h-32 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="w-32 h-32 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-5xl font-bold text-white">
                {callerName[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
          
          <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
          
          <p className="text-gray-400">
            {callState === 'ringing' && (isIncoming ? 'Incoming call...' : 'Calling...')}
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'connected' && formatDuration(duration)}
            {callState === 'ended' && 'Call ended'}
          </p>
        </div>
      )}
      
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay />
      
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isVideo && (
              <>
                {callerAvatar ? (
                  <img src={callerAvatar} alt={callerName} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{callerName[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{callerName}</p>
                  <p className="text-sm text-gray-300">
                    {callState === 'connected' ? formatDuration(duration) : callState}
                  </p>
                </div>
              </>
            )}
          </div>
          
          {/* Stats button */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-full ${showStats ? 'bg-cyan-600' : 'bg-white/20'}`}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
        
        {/* Stats panel */}
        {showStats && callState === 'connected' && (
          <div className="mt-4 bg-black/60 backdrop-blur-lg rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Transport</span>
              <span className={`font-medium ${
                transportUsed === 'stun' ? 'text-green-400' : 
                transportUsed === 'turn' ? 'text-orange-400' : 'text-gray-400'
              }`}>
                {transportUsed.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Received</span>
              <span className="text-white">{formatBytes(stats.bytesReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sent</span>
              <span className="text-white">{formatBytes(stats.bytesSent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Packets Lost</span>
              <span className={stats.packetsLost > 100 ? 'text-red-400' : 'text-white'}>
                {stats.packetsLost}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">RTT</span>
              <span className={stats.roundTripTime > 0.3 ? 'text-yellow-400' : 'text-white'}>
                {(stats.roundTripTime * 1000).toFixed(0)} ms
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Connection indicator */}
      {callState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-lg rounded-full px-6 py-3">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white font-medium">Connecting...</span>
          </div>
        </div>
      )}
      
      {/* Control buttons */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {isMuted ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          
          {/* Video toggle (only for video calls) */}
          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isVideoOff ? (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
          
          {/* End call */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
          
          {/* Speaker toggle */}
          <button
            onClick={toggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              !isSpeaker ? 'bg-white/40' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {isSpeaker ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          
          {/* Switch camera (only for video calls) */}
          {isVideo && (
            <button
              onClick={switchCamera}
              className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallScreen;
