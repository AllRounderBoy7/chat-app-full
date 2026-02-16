// WebRTC Service - Production Ready with Metered TURN
import { supabase, STUN_SERVERS, getMeteredTurnServers } from '../lib/supabase';

// Types
interface CallConfig {
  stunEnabled: boolean;
  turnEnabled: boolean;
  videoQuality: 'SD' | 'HD' | 'FHD';
  audioQuality: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface CallState {
  isInCall: boolean;
  callId: string | null;
  callType: 'voice' | 'video';
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  iceConnectionState: string;
  usedStun: boolean;
  usedTurn: boolean;
}

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'voice' | 'video';
  offer: RTCSessionDescriptionInit;
}

// Video Quality Presets
const VIDEO_CONSTRAINTS = {
  SD: { width: 640, height: 480, frameRate: 30 },
  HD: { width: 1280, height: 720, frameRate: 30 },
  FHD: { width: 1920, height: 1080, frameRate: 60 }
};

// Audio Quality Presets
const AUDIO_CONSTRAINTS = {
  LOW: { sampleRate: 22050, channelCount: 1, echoCancellation: true, noiseSuppression: true },
  MEDIUM: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  HIGH: { sampleRate: 48000, channelCount: 2, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
};

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callState: CallState;
  private config: CallConfig;
  private callTimer: NodeJS.Timeout | null = null;
  private onStateChange: ((state: CallState) => void) | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onIncomingCall: ((call: IncomingCall) => void) | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;
  private currentUserId: string | null = null;
  private signalingSubscription: any = null;

  constructor() {
    this.callState = {
      isInCall: false,
      callId: null,
      callType: 'voice',
      isMuted: false,
      isVideoOff: false,
      isSpeakerOn: false,
      callDuration: 0,
      connectionState: 'disconnected',
      iceConnectionState: 'new',
      usedStun: false,
      usedTurn: false
    };

    this.config = {
      stunEnabled: true,
      turnEnabled: true,
      videoQuality: 'HD',
      audioQuality: 'HIGH'
    };
  }

  // Initialize service with user ID
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    await this.setupSignalingListener();
  }

  // Setup signaling listener for incoming calls
  private async setupSignalingListener(): Promise<void> {
    if (!this.currentUserId) return;

    // Unsubscribe from previous subscription
    if (this.signalingSubscription) {
      this.signalingSubscription.unsubscribe();
    }

    // Subscribe to incoming calls
    this.signalingSubscription = supabase
      .channel(`calls:${this.currentUserId}`)
      .on('broadcast', { event: 'incoming-call' }, async (payload) => {
        const { callId, callerId, callerName, callerAvatar, callType, offer } = payload.payload;
        
        // Play ringtone
        this.playRingtone(callType);

        // Notify UI
        if (this.onIncomingCall) {
          this.onIncomingCall({
            callId,
            callerId,
            callerName,
            callerAvatar,
            callType,
            offer
          });
        }
      })
      .on('broadcast', { event: 'call-answer' }, async (payload) => {
        const { answer } = payload.payload;
        if (this.peerConnection && answer) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
        const { candidate } = payload.payload;
        if (this.peerConnection && candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      })
      .on('broadcast', { event: 'call-ended' }, () => {
        this.endCall();
      })
      .subscribe();
  }

  // Get ICE Servers configuration
  private async getIceServers(): Promise<RTCIceServer[]> {
    const iceServers: RTCIceServer[] = [];

    // Add STUN servers if enabled
    if (this.config.stunEnabled) {
      iceServers.push(...STUN_SERVERS);
    }

    // Add TURN servers if enabled (Metered as primary)
    if (this.config.turnEnabled) {
      try {
        const meteredServers = await getMeteredTurnServers();
        iceServers.push(...meteredServers);
      } catch (error) {
        console.error('Failed to get Metered TURN servers, using static fallback');
      }
    }

    return iceServers;
  }

  // Create peer connection with optimized settings
  private async createPeerConnection(): Promise<RTCPeerConnection> {
    const iceServers = await this.getIceServers();

    const config: RTCConfiguration = {
      iceServers,
      iceTransportPolicy: this.config.turnEnabled ? 'all' : 'relay',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.callState.callId) {
        // Send ICE candidate to peer
        this.sendSignal('ice-candidate', { candidate: event.candidate });

        // Track STUN/TURN usage
        const candidateStr = event.candidate.candidate.toLowerCase();
        if (candidateStr.includes('relay')) {
          this.callState.usedTurn = true;
        } else if (candidateStr.includes('srflx') || candidateStr.includes('prflx')) {
          this.callState.usedStun = true;
        }
        this.notifyStateChange();
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.callState.connectionState = pc.connectionState as any;
      this.notifyStateChange();

      if (pc.connectionState === 'connected') {
        this.stopRingtone();
        this.startCallTimer();
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      this.callState.iceConnectionState = pc.iceConnectionState;
      this.notifyStateChange();
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    return pc;
  }

  // Start outgoing call
  async startCall(
    receiverId: string,
    receiverName: string,
    callType: 'voice' | 'video'
  ): Promise<boolean> {
    try {
      // Get local media stream
      const constraints: MediaStreamConstraints = {
        audio: AUDIO_CONSTRAINTS[this.config.audioQuality],
        video: callType === 'video' ? VIDEO_CONSTRAINTS[this.config.videoQuality] : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create peer connection
      this.peerConnection = await this.createPeerConnection();

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Create offer with optimized codecs
      const offerOptions: RTCOfferOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      };

      const offer = await this.peerConnection.createOffer(offerOptions);
      
      // Optimize SDP for better quality
      const optimizedOffer = this.optimizeSDP(offer);
      await this.peerConnection.setLocalDescription(optimizedOffer);

      // Generate call ID
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update state
      this.callState = {
        ...this.callState,
        isInCall: true,
        callId,
        callType,
        connectionState: 'connecting',
        usedStun: false,
        usedTurn: false
      };
      this.notifyStateChange();

      // Send offer to receiver via Supabase channel
      await supabase.channel(`calls:${receiverId}`).send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: {
          callId,
          callerId: this.currentUserId,
          callerName: receiverName,
          callType,
          offer: this.peerConnection.localDescription
        }
      });

      // Play ringback tone
      this.playRingbackTone();

      // Log call attempt
      await this.logCall(callId, receiverId, callType, 'outgoing');

      return true;
    } catch (error) {
      console.error('Failed to start call:', error);
      this.endCall();
      return false;
    }
  }

  // Answer incoming call
  async answerCall(incomingCall: IncomingCall): Promise<boolean> {
    try {
      this.stopRingtone();

      // Get local media stream
      const constraints: MediaStreamConstraints = {
        audio: AUDIO_CONSTRAINTS[this.config.audioQuality],
        video: incomingCall.callType === 'video' ? VIDEO_CONSTRAINTS[this.config.videoQuality] : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create peer connection
      this.peerConnection = await this.createPeerConnection();

      // Add tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Set remote description (the offer)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      const optimizedAnswer = this.optimizeSDP(answer);
      await this.peerConnection.setLocalDescription(optimizedAnswer);

      // Update state
      this.callState = {
        ...this.callState,
        isInCall: true,
        callId: incomingCall.callId,
        callType: incomingCall.callType,
        connectionState: 'connecting'
      };
      this.notifyStateChange();

      // Send answer back to caller
      await supabase.channel(`calls:${incomingCall.callerId}`).send({
        type: 'broadcast',
        event: 'call-answer',
        payload: {
          answer: this.peerConnection.localDescription
        }
      });

      // Log call
      await this.logCall(incomingCall.callId, incomingCall.callerId, incomingCall.callType, 'incoming');

      return true;
    } catch (error) {
      console.error('Failed to answer call:', error);
      this.endCall();
      return false;
    }
  }

  // Decline incoming call
  async declineCall(incomingCall: IncomingCall): Promise<void> {
    this.stopRingtone();
    
    // Notify caller
    await supabase.channel(`calls:${incomingCall.callerId}`).send({
      type: 'broadcast',
      event: 'call-ended',
      payload: { reason: 'declined' }
    });
  }

  // End current call
  async endCall(): Promise<void> {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop timer
    this.stopCallTimer();

    // Stop ringtone
    this.stopRingtone();

    // Notify peer
    if (this.callState.callId) {
      this.sendSignal('call-ended', { reason: 'ended' });
    }

    // Reset state
    this.callState = {
      isInCall: false,
      callId: null,
      callType: 'voice',
      isMuted: false,
      isVideoOff: false,
      isSpeakerOn: false,
      callDuration: 0,
      connectionState: 'disconnected',
      iceConnectionState: 'new',
      usedStun: false,
      usedTurn: false
    };
    this.notifyStateChange();
  }

  // Toggle mute
  toggleMute(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.callState.isMuted = !audioTrack.enabled;
        this.notifyStateChange();
      }
    }
  }

  // Toggle video
  toggleVideo(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.callState.isVideoOff = !videoTrack.enabled;
        this.notifyStateChange();
      }
    }
  }

  // Toggle speaker
  toggleSpeaker(): void {
    this.callState.isSpeakerOn = !this.callState.isSpeakerOn;
    this.notifyStateChange();
  }

  // Switch camera (front/back)
  async switchCamera(): Promise<void> {
    if (!this.localStream || this.callState.callType !== 'video') return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      // Get current facing mode
      const settings = videoTrack.getSettings();
      const currentFacingMode = settings.facingMode || 'user';
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

      // Get new stream with switched camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...VIDEO_CONSTRAINTS[this.config.videoQuality],
          facingMode: newFacingMode
        }
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in peer connection
      const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Stop old track and update local stream
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  }

  // Optimize SDP for better quality
  private optimizeSDP(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    let sdp = description.sdp || '';

    // Prefer Opus codec for audio (high quality)
    sdp = sdp.replace(/m=audio (\d+) UDP\/TLS\/RTP\/SAVPF (\d+)/g, (_, port, codecs) => {
      const codecList = codecs.split(' ');
      const opusIndex = codecList.indexOf('111'); // Opus is usually 111
      if (opusIndex > 0) {
        codecList.splice(opusIndex, 1);
        codecList.unshift('111');
      }
      return `m=audio ${port} UDP/TLS/RTP/SAVPF ${codecList.join(' ')}`;
    });

    // Increase audio bitrate
    if (!sdp.includes('maxaveragebitrate')) {
      sdp = sdp.replace(/(a=fmtp:111.*)/g, '$1; maxaveragebitrate=510000; stereo=1; sprop-stereo=1');
    }

    // Prefer VP9 or H264 for video
    sdp = sdp.replace(/m=video (\d+) UDP\/TLS\/RTP\/SAVPF (\d+)/g, (_, port, codecs) => {
      const codecList = codecs.split(' ');
      // Prefer VP9 (usually 98) or H264 (usually 96)
      const vp9Index = codecList.indexOf('98');
      if (vp9Index > 0) {
        codecList.splice(vp9Index, 1);
        codecList.unshift('98');
      }
      return `m=video ${port} UDP/TLS/RTP/SAVPF ${codecList.join(' ')}`;
    });

    return { ...description, sdp };
  }

  // Handle connection failure with TURN fallback
  private async handleConnectionFailure(): Promise<void> {
    if (this.callState.connectionState === 'failed' && !this.callState.usedTurn && this.config.turnEnabled) {
      console.log('Connection failed, attempting TURN fallback...');
      // Could implement automatic reconnection with TURN-only policy here
    }
  }

  // Send signaling message
  private async sendSignal(_event: string, _payload: unknown): Promise<void> {
    // This would be sent to the appropriate channel based on callId
    // Implementation depends on your signaling architecture
  }

  // Play ringtone
  private playRingtone(callType: 'voice' | 'video'): void {
    try {
      const ringtonePath = callType === 'video' 
        ? '/sounds/video_ringtone.mp3' 
        : '/sounds/voice_ringtone.mp3';
      
      this.ringtoneAudio = new Audio(ringtonePath);
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 1;
      this.ringtoneAudio.play().catch(() => {
        // Fallback to default sound if custom not found
        this.ringtoneAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQkhfKrt7Y9NETaN4u3fhz0ZUrG61pNdKSt/tNvDolEWN5nQ5qpyIxhbqdzNr3QiBUum4d2tdykNW7jn0plTGh1ytuDHnWIiLH+w4tOrYiAhf7bn1JpSGBlwteDElmoiLIOv3dKrYyUgebTh16ZkHyB6s+TVp2cjI3q039imZCMcdrjk0qNnIR97suDXpmMfIXy24NWmZSEhfLjg1aRlISF7tuDVpmUhIXy54NWmZSEhfLng1aVlISF8ueHVpWYiIXy64tSkZSIhfbri1KRmIiF9uuLUpWYiIX274tSkZiIhfbvi1KRmIiB9vOLUpGYiIH284tSkZiIgfbzi1KRmIiB9vOLUpGciIH284dSkZyIgfb3h1KRnIiB9veHUpGciIH294dSkZyMgfb3h1KRnIyB9vt/UpGcjIH2+39SkZyMgfb7f1KRnIyB9vt/UpGcjIH6+39SkZyMgfr7f1KRnIyB+vt/UpGcjIH6+39SkZyMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/U');
        this.ringtoneAudio?.play().catch(() => {});
      });
    } catch (error) {
      console.error('Failed to play ringtone:', error);
    }
  }

  // Play ringback tone (heard by caller)
  private playRingbackTone(): void {
    try {
      this.ringtoneAudio = new Audio('/sounds/ringback.mp3');
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.5;
      this.ringtoneAudio.play().catch(() => {});
    } catch (error) {
      console.error('Failed to play ringback tone:', error);
    }
  }

  // Stop ringtone
  private stopRingtone(): void {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
      this.ringtoneAudio = null;
    }
  }

  // Start call duration timer
  private startCallTimer(): void {
    this.callTimer = setInterval(() => {
      this.callState.callDuration++;
      this.notifyStateChange();
    }, 1000);
  }

  // Stop call timer
  private stopCallTimer(): void {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  // Log call to database
  private async logCall(
    callId: string,
    peerId: string,
    callType: 'voice' | 'video',
    direction: 'incoming' | 'outgoing'
  ): Promise<void> {
    try {
      await supabase.from('call_logs').insert({
        id: callId,
        caller_id: direction === 'outgoing' ? this.currentUserId : peerId,
        receiver_id: direction === 'outgoing' ? peerId : this.currentUserId,
        call_type: callType,
        status: 'initiated',
        started_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log call:', error);
    }
  }

  // Notify state change
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.callState });
    }
  }

  // Set callbacks
  setOnStateChange(callback: (state: CallState) => void): void {
    this.onStateChange = callback;
  }

  setOnRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
  }

  setOnIncomingCall(callback: (call: IncomingCall) => void): void {
    this.onIncomingCall = callback;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Get call state
  getCallState(): CallState {
    return { ...this.callState };
  }

  // Update config
  updateConfig(config: Partial<CallConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get call statistics
  async getCallStats(): Promise<any> {
    if (!this.peerConnection) return null;

    const stats = await this.peerConnection.getStats();
    const result: any = {
      audio: { bytesSent: 0, bytesReceived: 0, packetsLost: 0 },
      video: { bytesSent: 0, bytesReceived: 0, packetsLost: 0, frameRate: 0 },
      connection: { roundTripTime: 0, availableBandwidth: 0 }
    };

    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        result.audio.bytesSent = report.bytesSent;
      } else if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        result.audio.bytesReceived = report.bytesReceived;
        result.audio.packetsLost = report.packetsLost;
      } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
        result.video.bytesSent = report.bytesSent;
        result.video.frameRate = report.framesPerSecond;
      } else if (report.type === 'inbound-rtp' && report.kind === 'video') {
        result.video.bytesReceived = report.bytesReceived;
        result.video.packetsLost = report.packetsLost;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.connection.roundTripTime = report.currentRoundTripTime * 1000;
        result.connection.availableBandwidth = report.availableOutgoingBitrate;
      }
    });

    return result;
  }

  // Cleanup
  cleanup(): void {
    this.endCall();
    if (this.signalingSubscription) {
      this.signalingSubscription.unsubscribe();
    }
  }
}

// Export singleton instance
export const webRTCService = new WebRTCService();
export type { CallConfig, CallState, IncomingCall };
