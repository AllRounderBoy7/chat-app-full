import { useState, useRef, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, RotateCcw, Phone, PhoneCall } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { webRTCService, type CallState } from '@/services/WebRTCService';
import { cn } from '@/utils/cn';

export function CallScreen() {
  const { activeCall, setActiveCall, profile, addCallLog } = useAppStore();

  const [localCallState, setLocalCallState] = useState<CallState>(webRTCService.getCallState());
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!activeCall) return;

    // Set up WebRTC Service listeners
    webRTCService.setOnStateChange((state) => {
      setLocalCallState(state);
      setCallDuration(state.call_duration);

      if (state.connection_state === 'failed' || state.connection_state === 'disconnected') {
        handleEndCall();
      }
    });

    webRTCService.setOnRemoteStream((stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    // Handle initialization
    if (!activeCall.isIncoming && !localCallState.is_in_call) {
      // Outgoing call
      webRTCService.startCall(
        activeCall.remoteUser.id,
        activeCall.remoteUser.display_name,
        activeCall.type
      );
    }

    // Set local stream immediately if available or when it becomes available
    const updateLocalVideo = () => {
      const stream = webRTCService.getLocalStream();
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
      }
    };

    updateLocalVideo();
    const interval = setInterval(updateLocalVideo, 500);

    return () => {
      clearInterval(interval);
      webRTCService.cleanup();
    };
  }, []);

  const handleAnswer = async () => {
    if (activeCall?.isIncoming && activeCall.incomingOffer) {
      await webRTCService.answerCall({
        call_id: activeCall.id,
        caller_id: activeCall.remoteUser.id,
        caller_name: activeCall.remoteUser.display_name,
        caller_avatar: activeCall.remoteUser.avatar_url,
        call_type: activeCall.type,
        offer: activeCall.incomingOffer
      });
    }
  };

  const handleDecline = async () => {
    if (activeCall?.isIncoming && activeCall.incomingOffer) {
      await webRTCService.declineCall({
        call_id: activeCall.id,
        caller_id: activeCall.remoteUser.id,
        caller_name: activeCall.remoteUser.display_name,
        caller_avatar: activeCall.remoteUser.avatar_url,
        call_type: activeCall.type,
        offer: activeCall.incomingOffer
      });
    }
    handleEndCall();
  };

  const handleEndCall = () => {
    const duration = webRTCService.getCallState().call_duration;

    // Log the call
    if (activeCall && profile) {
      addCallLog({
        id: activeCall.id,
        caller_id: activeCall.isIncoming ? activeCall.remoteUser.id : profile.id,
        receiver_id: activeCall.isIncoming ? profile.id : activeCall.remoteUser.id,
        type: activeCall.type,
        status: duration > 5 ? 'answered' : 'missed',
        duration: duration > 0 ? duration : undefined,
        created_at: new Date().toISOString(),
        caller: activeCall.isIncoming ? activeCall.remoteUser : profile,
        receiver: activeCall.isIncoming ? profile : activeCall.remoteUser
      });
    }

    webRTCService.endCall();
    setActiveCall(null);
  };

  const vibrate = (pattern: number = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  const remoteUser = activeCall.remoteUser;
  const isConnected = localCallState.connection_state === 'connected';
  const isIncomingPending = activeCall.isIncoming && localCallState.connection_state === 'disconnected' && !localCallState.is_in_call;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 flex flex-col">
      {/* Video Area */}
      {activeCall.type === 'video' ? (
        <>
          {/* Remote Video (Full Screen) */}
          <div className="absolute inset-0 bg-slate-900">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn(
                "w-full h-full object-cover",
                localCallState.remote_video_off && "hidden"
              )}
            />
            {localCallState.remote_video_off && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-3xl">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse scale-110" />
                  <img
                    src={remoteUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUser.username}`}
                    alt=""
                    className="w-48 h-48 rounded-full object-cover border-8 border-white/10 relative z-10"
                  />
                </div>
                <h3 className="text-white text-xl font-bold mt-6">{remoteUser.display_name}</h3>
                <p className="text-white/60 text-sm">Camera is off</p>
              </div>
            )}
          </div>

          {/* Local Video (Floating Picture-in-Picture) */}
          <div className="absolute top-12 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl safe-area-top z-40 bg-slate-800 ring-4 ring-black/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'w-full h-full object-cover mirror',
                localCallState.is_video_off && 'hidden'
              )}
            />
            {localCallState.is_video_off && (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <VideoOff className="w-6 h-6 text-white/50" />
                </div>
              </div>
            )}
            {/* Small identifier for 'You' */}
            <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] text-white/80 font-bold border border-white/10">
              You
            </div>
          </div>

          {/* Interactive Gradient Overlays */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        </>
      ) : (
        // Voice Call UI
        <div className="flex-1 flex flex-col items-center justify-center safe-area-top">
          {/* Avatar with pulse rings */}
          <div className="relative mb-8">
            {/* Pulse rings */}
            {!isConnected && (
              <>
                <div className="absolute inset-0 rounded-full bg-white/10 animate-ping scale-150" />
                <div className="absolute inset-0 rounded-full bg-white/5 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
              </>
            )}
            {isConnected && (
              <div className="absolute inset-0 rounded-full ring-4 ring-green-500/50 scale-110" />
            )}
            <img
              src={remoteUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUser.username}`}
              alt=""
              className="w-40 h-40 rounded-full object-cover relative z-10 border-4 border-white/20"
            />
          </div>

          {/* Name */}
          <h2 className="text-3xl font-bold text-white mb-2">
            {remoteUser.display_name}
          </h2>
          <p className="text-white/60 text-sm mb-2">@{remoteUser.username}</p>

          {/* Status / Duration */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 mt-2">
            <Phone className="w-4 h-4 text-white/70" />
            <span className="text-white text-sm font-medium">
              {isConnected
                ? formatDuration(callDuration)
                : isIncomingPending ? 'Incoming call...' : 'Calling...'
              }
            </span>
          </div>
        </div>
      )}

      {/* Top Bar - Call info for video calls */}
      {activeCall.type === 'video' && (
        <div className="absolute top-0 left-0 right-0 p-4 safe-area-top flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const nextQ = localCallState.connection_state === 'connected' ?
                  (webRTCService.getCallConfig().video_quality === 'SD' ? 'HD' : webRTCService.getCallConfig().video_quality === 'HD' ? 'FHD' : 'SD')
                  : 'FHD';
                webRTCService.setVideoQuality(nextQ as any);
                vibrate(20);
              }}
              className="px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md text-[10px] font-bold text-white border border-white/20 active:scale-90"
            >
              {webRTCService.getCallConfig().video_quality} MODE
            </button>
            <div>
              <h2 className="text-white font-bold text-lg">{remoteUser.display_name}</h2>
              <p className="text-white/70 text-sm">
                {isConnected ? formatDuration(callDuration) : isIncomingPending ? 'Incoming call...' : 'Connecting...'}
              </p>
            </div>
          </div>
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            isConnected ? 'bg-green-500/30 text-green-300' : 'bg-yellow-500/30 text-yellow-300'
          )}>
            {isConnected ? '● Connected' : isIncomingPending ? '● Incoming' : '● Connecting'}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 safe-area-bottom">
        {isIncomingPending ? (
          /* Incoming Call Controls */
          <div className="flex justify-center items-center gap-12">
            <button
              onClick={handleDecline}
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center group-hover:bg-red-600 transition-all shadow-lg shadow-red-500/40 active:scale-90">
                <PhoneOff className="w-8 h-8" />
              </div>
              <span className="text-white text-xs font-medium">Decline</span>
            </button>

            <button
              onClick={handleAnswer}
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center group-hover:bg-green-600 transition-all shadow-lg shadow-green-500/40 animate-bounce active:scale-90">
                <PhoneCall className="w-8 h-8" />
              </div>
              <span className="text-white text-xs font-medium">Answer</span>
            </button>
          </div>
        ) : (
          /* Ongoing Call Controls */
          <div className="flex justify-center items-center gap-5">
            {/* Mute Button */}
            <button
              onClick={() => { vibrate(10); webRTCService.toggleMute(); }}
              className={cn(
                'w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all active:scale-90 relative overflow-hidden',
                localCallState.is_muted
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 ring-4 ring-red-500/20'
                  : 'bg-white/10 backdrop-blur-xl text-white hover:bg-white/20 border border-white/20'
              )}
            >
              {localCallState.is_muted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              <span className="text-[10px] font-bold mt-1 opacity-60">Mute</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={() => { vibrate(50); handleEndCall(); }}
              className="w-20 h-20 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-all shadow-2xl shadow-rose-600/50 active:scale-95 ring-8 ring-rose-600/10"
            >
              <PhoneOff className="w-9 h-9" />
            </button>

            {/* Camera Button (Video calls only) */}
            {activeCall.type === 'video' && (
              <>
                <button
                  onClick={() => { vibrate(10); webRTCService.toggleVideo(); }}
                  className={cn(
                    'w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all active:scale-90',
                    localCallState.is_video_off
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 ring-4 ring-red-500/20'
                      : 'bg-white/10 backdrop-blur-xl text-white hover:bg-white/20 border border-white/20'
                  )}
                >
                  {localCallState.is_video_off ? <VideoOff className="w-7 h-7" /> : <Video className="w-7 h-7" />}
                  <span className="text-[10px] font-bold mt-1 opacity-60">Camera</span>
                </button>

                {/* Switch Camera */}
                <button
                  onClick={() => { vibrate(20); webRTCService.switchCamera(); }}
                  className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl text-white flex flex-col items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/20"
                >
                  <RotateCcw className="w-7 h-7" />
                  <span className="text-[10px] font-bold mt-1 opacity-60">Flip</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
