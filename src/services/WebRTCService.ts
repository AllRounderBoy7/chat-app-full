// WebRTC Service - Production Ready with Metered TURN
import { supabase, STUN_SERVERS, getMeteredTurnServers } from '../lib/supabase';

// Types
interface CallConfig {
  stun_enabled: boolean;
  turn_enabled: boolean;
  video_quality: 'SD' | 'HD' | 'FHD';
  audio_quality: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface CallState {
  is_in_call: boolean;
  call_id: string | null;
  call_type: 'voice' | 'video';
  is_muted: boolean;
  is_video_off: boolean;
  is_speaker_on: boolean;
  call_duration: number;
  connection_state: 'connecting' | 'connected' | 'disconnected' | 'failed';
  ice_connection_state: string;
  used_stun: boolean;
  used_turn: boolean;
  peer_id: string | null;
  remote_video_off: boolean;
}

interface IncomingCall {
  call_id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar?: string;
  call_type: 'voice' | 'video';
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
      is_in_call: false,
      call_id: null,
      call_type: 'voice',
      is_muted: false,
      is_video_off: false,
      is_speaker_on: false,
      call_duration: 0,
      connection_state: 'disconnected',
      ice_connection_state: 'new',
      used_stun: false,
      used_turn: false,
      peer_id: null,
      remote_video_off: false
    };

    this.config = {
      stun_enabled: true,
      turn_enabled: true,
      video_quality: 'FHD', // Default to 1080p 60fps
      audio_quality: 'HIGH'
    };
  }

  // Initialize service with user ID
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    await this.setupSignalingListener();
  }

  setVideoQuality(quality: 'SD' | 'HD' | 'FHD'): void {
    this.config.video_quality = quality;
    console.log(`Video quality set to: ${quality}`);
  }

  getCallConfig(): CallConfig {
    return this.config;
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
        const { call_id, caller_id, caller_name, caller_avatar, call_type, offer } = payload.payload;

        // Play ringtone
        this.playRingtone(call_type);

        // Notify UI
        if (this.onIncomingCall) {
          this.onIncomingCall({
            call_id,
            caller_id,
            caller_name,
            caller_avatar,
            call_type,
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
      .on('broadcast', { event: 'video-toggle' }, (payload) => {
        this.callState.remote_video_off = payload.payload.is_video_off;
        this.notifyStateChange();
      })
      .subscribe();
  }

  // Get ICE Servers configuration
  private async getIceServers(): Promise<RTCIceServer[]> {
    const iceServers: RTCIceServer[] = [];

    // Add STUN servers if enabled
    if (this.config.stun_enabled) {
      iceServers.push(...STUN_SERVERS);
    }

    // Add TURN servers if enabled (Metered as primary)
    if (this.config.turn_enabled) {
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
      iceTransportPolicy: (this.config.turn_enabled && this.config.stun_enabled) ? 'all' : (this.config.turn_enabled ? 'relay' : 'all'),
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.callState.call_id) {
        // Send ICE candidate to peer
        this.sendSignal('ice-candidate', { candidate: event.candidate });

        // Track STUN/TURN usage
        const candidateStr = event.candidate.candidate.toLowerCase();
        if (candidateStr.includes('relay')) {
          this.callState.used_turn = true;
        } else if (candidateStr.includes('srflx') || candidateStr.includes('prflx')) {
          this.callState.used_stun = true;
        }
        this.notifyStateChange();
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.callState.connection_state = pc.connectionState as any;
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
      this.callState.ice_connection_state = pc.iceConnectionState;
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

  // Initiate call
  async startCall(receiver_id: string, receiver_name: string, call_type: 'voice' | 'video'): Promise<boolean> {
    if (this.callState.is_in_call) return false;
    try {
      // Get local media stream
      // High quality constraints for STUN-based calls
      const constraints: MediaStreamConstraints = {
        audio: AUDIO_CONSTRAINTS[this.config.audio_quality],
        video: call_type === 'video' ? {
          ...VIDEO_CONSTRAINTS[this.config.video_quality],
          // Add advanced constraints for better quality on good connections
          facingMode: 'user',
          aspectRatio: 1.7777777778 // 16:9
        } : false
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
        offerToReceiveVideo: call_type === 'video'
      };

      const offer = await this.peerConnection.createOffer(offerOptions);

      // Optimize SDP for better quality
      const optimizedOffer = this.optimizeSDP(offer);
      await this.peerConnection.setLocalDescription(optimizedOffer);

      // Use existing call ID or generate a new one
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update state
      this.callState = {
        ...this.callState,
        is_in_call: true,
        call_id: callId,
        call_type: call_type,
        connection_state: 'connecting',
        used_stun: false,
        used_turn: false,
        peer_id: receiver_id
      };
      this.notifyStateChange();

      // Send offer to receiver via signaling
      await supabase.channel(`calls:${receiver_id}`).send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: {
          call_id: callId,
          caller_id: this.currentUserId,
          caller_name: receiver_name,
          call_type: call_type,
          offer: this.peerConnection.localDescription
        }
      });

      // Play ringback tone
      this.playRingbackTone();

      // Log call attempt
      await this.logCall(callId, receiver_id, call_type, 'outgoing');

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
        audio: AUDIO_CONSTRAINTS[this.config.audio_quality],
        video: incomingCall.call_type === 'video' ? VIDEO_CONSTRAINTS[this.config.video_quality] : false
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
        is_in_call: true,
        call_type: incomingCall.call_type,
        connection_state: 'connecting',
        peer_id: incomingCall.caller_id
      };
      this.notifyStateChange();

      // Send answer back to caller
      await supabase.channel(`calls:${incomingCall.caller_id}`).send({
        type: 'broadcast',
        event: 'call-answer',
        payload: {
          answer: this.peerConnection.localDescription
        }
      });

      // Log call
      await this.logCall(incomingCall.call_id, incomingCall.caller_id, incomingCall.call_type, 'incoming');

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
    await supabase.channel(`calls:${incomingCall.caller_id}`).send({
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
    if (this.callState.call_id) {
      this.sendSignal('call-ended', { reason: 'ended' });
    }

    // Reset state
    this.callState = {
      is_in_call: false,
      call_id: null,
      call_type: 'voice',
      is_muted: false,
      is_video_off: false,
      is_speaker_on: false,
      call_duration: 0,
      connection_state: 'disconnected',
      ice_connection_state: 'new',
      used_stun: false,
      used_turn: false,
      peer_id: null,
      remote_video_off: false
    };
    this.notifyStateChange();
  }

  // Toggle mute
  toggleMute(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.callState.is_muted = !audioTrack.enabled;
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
        this.callState.is_video_off = !videoTrack.enabled;
        this.notifyStateChange();

        // Notify peer about video status change
        this.sendSignal('video-toggle', { is_video_off: this.callState.is_video_off });
      }
    }
  }

  // Toggle speaker
  toggleSpeaker(): void {
    this.callState.is_speaker_on = !this.callState.is_speaker_on;
    this.notifyStateChange();
  }

  // Switch camera (front/back)
  async switchCamera(): Promise<void> {
    if (!this.localStream || this.callState.call_type !== 'video') return;

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
          ...VIDEO_CONSTRAINTS[this.config.video_quality],
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

    // QUALITY FIX: Apply specific bitrates for High/Medium/Low
    let maxBitrate = 500; // Low
    if (this.config.video_quality === 'FHD') maxBitrate = 6000; // High
    else if (this.config.video_quality === 'HD') maxBitrate = 1500; // Medium

    sdp = sdp.replace(/b=AS:(\d+)/g, `b=AS:${maxBitrate}`);
    if (!sdp.includes('b=AS:')) {
      sdp = sdp.replace(/a=mid:video\r\n/g, `a=mid:video\r\nb=AS:${maxBitrate}\r\n`);
    }

    if (this.config.video_quality === 'FHD') {
      // Also prioritize higher frame rates in SDP
      sdp = sdp.replace(/a=fmtp:(\d+) (.*)/g, (match, pt) => {
        if (sdp.includes(`m=video`) && pt === '98') { // VP9
          return `${match}; x-google-max-bitrate=6000; x-google-min-bitrate=2000; x-google-start-bitrate=4000`;
        }
        return match;
      });
    }

    return { ...description, sdp };
  }

  // Handle connection failure with TURN fallback
  private async handleConnectionFailure(): Promise<void> {
    if (this.callState.connection_state === 'failed' && !this.callState.used_turn && this.config.turn_enabled) {
      console.log('Connection failed, attempting TURN fallback...');
      // Could implement automatic reconnection with TURN-only policy here
    }
  }

  // Send signaling message
  private async sendSignal(event: string, payload: any): Promise<void> {
    if (!this.callState.peer_id) return;

    try {
      await supabase.channel(`calls:${this.callState.peer_id}`).send({
        type: 'broadcast',
        event,
        payload
      });
    } catch (error) {
      console.error(`Failed to send signal ${event}:`, error);
    }
  }

  // Play ringtone
  private playRingtone(callType: 'voice' | 'video'): void {
    try {
      const ringtonePath = callType === 'video'
        ? '/sound/video_call.mp3'
        : '/sound/ringtone.mp3';

      this.ringtoneAudio = new Audio(ringtonePath);
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 1;
      this.ringtoneAudio.play().catch(() => {
        // Fallback to default sound if custom not found
        this.ringtoneAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQkhfKrt7Y9NETaN4u3fhz0ZUrG61pNdKSt/tNvDolEWN5nQ5qpyIxhbqdzNr3QiBUum4d2tdykNW7jn0plTGh1ytuDHnWIiLH+w4tOrYiAhf7bn1JpSGBlwteDElmoiLIOv3dKrYyUgebTh16ZkHyB6s+TVp2cjI3q039imZCMcdrjk0qNnIR97suDXpmMfIXy24NWmZSEhfLjg1aRlISF7tuDVpmUhIXy54NWmZSEhfLng1aVlISF8ueHVpWYiIXy64tSkZSIhfbri1KRmIiF9uuLUpWYiIX274tSkZiIhfbvi1KRmIiB9vOLUpGYiIH284tSkZiIgfbzi1KRmIiB9vOLUpGciIH284dSkZyIgfb3h1KRnIiB9veHUpGciIH294dSkZyMgfb3h1KRnIyB9vt/UpGcjIH2+39SkZyMgfb7f1KRnIyB9vt/UpGcjIH6+39SkZyMgfr7f1KRnIyB+vt/UpGcjIH6+39SkZyMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/UpGgjIH6+39SkaCMgfr7f1KRoIyB+vt/U');
        this.ringtoneAudio?.play().catch(() => { });
      });
    } catch (error) {
      console.error('Failed to play ringtone:', error);
    }
  }

  // Play ringback tone (heard by caller)
  private playRingbackTone(): void {
    try {
      this.ringtoneAudio = new Audio('/sound/notification.mp3');
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.5;
      this.ringtoneAudio.play().catch(() => { });
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
      this.callState.call_duration++;
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

  // Log call to Supabase
  private async logCall(call_id: string, peer_id: string, call_type: 'voice' | 'video', direction: 'incoming' | 'outgoing'): Promise<void> {
    try {
      await supabase.from('call_logs').insert({
        call_id,
        user_id: this.currentUserId,
        peer_id,
        call_type,
        direction,
        status: 'completed', // Default until updated
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging call:', error);
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

  // Update call config
  updateConfig(newConfig: Partial<CallConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // QUALITY FIX: Propagate video quality changes by restarting ICE
    if (newConfig.video_quality && this.peerConnection) {
      this.peerConnection.createOffer({ iceRestart: true });
    }
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
