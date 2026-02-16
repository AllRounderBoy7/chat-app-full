import { useState, useRef, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, RotateCcw, Phone } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { STUN_SERVERS, getMeteredTurnServers } from '@/lib/supabase';
import { cn } from '@/utils/cn';

export function CallScreen() {
  const { activeCall, setActiveCall, adminSettings } = useAppStore();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeCall) {
      initializeCall();
    }
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      // Build ICE servers config
      const iceServers: RTCIceServer[] = [];
      
      if (adminSettings.stun_enabled) {
        iceServers.push(...STUN_SERVERS);
      }
      
      if (adminSettings.turn_enabled) {
        const turnServers = await getMeteredTurnServers();
        iceServers.push(...turnServers);
      }

      // Create peer connection
      const pc = new RTCPeerConnection({ 
        iceServers,
        iceCandidatePoolSize: 10
      });
      peerConnectionRef.current = pc;

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          startCallTimer();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          endCall();
        }
      };

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCall?.type === 'video' ? { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      });
      
      localStreamRef.current = stream;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Simulate connection for demo
      setTimeout(() => {
        setConnectionState('connected');
        startCallTimer();
      }, 2000);

    } catch (error) {
      console.error('Failed to initialize call:', error);
      endCall();
    }
  };

  const startCallTimer = () => {
    if (callTimerRef.current) return;
    
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const cleanup = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const endCall = () => {
    cleanup();
    setActiveCall(null);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = isCameraOff;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const switchCamera = async () => {
    if (!localStreamRef.current) return;
    
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    const currentSettings = currentTrack?.getSettings();
    const newFacingMode = currentSettings?.facingMode === 'user' ? 'environment' : 'user';
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode }
      });
      
      const newTrack = newStream.getVideoTracks()[0];
      
      // Replace track in peer connection
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      }
      
      // Replace local track
      currentTrack?.stop();
      localStreamRef.current.removeTrack(currentTrack);
      localStreamRef.current.addTrack(newTrack);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 flex flex-col">
      {/* Video Area */}
      {activeCall.type === 'video' ? (
        <>
          {/* Remote Video (Full Screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Local Video (Picture-in-Picture) */}
          <div className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg safe-area-top">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'w-full h-full object-cover',
                isCameraOff && 'hidden'
              )}
            />
            {isCameraOff && (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-white/50" />
              </div>
            )}
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 to-transparent" />
        </>
      ) : (
        // Voice Call UI
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Avatar */}
          <div className="relative mb-8">
            <div className={cn(
              'w-40 h-40 rounded-full overflow-hidden',
              connectionState === 'connected' && 'ring-4 ring-green-500 ring-opacity-50'
            )}>
              <img
                src={activeCall.peerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeCall.peerId}`}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Pulse Animation */}
            {connectionState !== 'connected' && (
              <div className="absolute inset-0 animate-ping opacity-20">
                <div className="w-full h-full rounded-full bg-white" />
              </div>
            )}
          </div>
          
          {/* Name */}
          <h2 className="text-3xl font-bold text-white mb-2">
            {activeCall.peerName || 'Unknown'}
          </h2>
          
          {/* Status */}
          <p className="text-white/70 mb-2">
            {connectionState === 'connecting' ? 'Connecting...' 
              : connectionState === 'connected' ? 'Voice Call'
              : activeCall.isIncoming ? 'Incoming call...' : 'Calling...'}
          </p>
        </div>
      )}

      {/* Call Info Overlay */}
      <div className="absolute top-4 left-4 safe-area-top">
        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
          {activeCall.type === 'video' ? (
            <Video className="w-4 h-4 text-white" />
          ) : (
            <Phone className="w-4 h-4 text-white" />
          )}
          <span className="text-white text-sm">
            {connectionState === 'connected' 
              ? formatDuration(callDuration)
              : 'Connecting...'
            }
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 safe-area-bottom">
        {/* Duration for video calls */}
        {activeCall.type === 'video' && connectionState === 'connected' && (
          <p className="text-center text-white text-lg mb-6">
            {formatDuration(callDuration)}
          </p>
        )}
        
        <div className="flex justify-center items-center gap-6">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all',
              isMuted 
                ? 'bg-red-500 text-white' 
                : 'bg-white/20 text-white hover:bg-white/30'
            )}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          {/* Camera Button (Video calls only) */}
          {activeCall.type === 'video' && (
            <>
              <button
                onClick={toggleCamera}
                className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center transition-all',
                  isCameraOff 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                )}
              >
                {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
              
              {/* Switch Camera */}
              <button
                onClick={switchCamera}
                className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            </>
          )}
          
          {/* End Call Button */}
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
