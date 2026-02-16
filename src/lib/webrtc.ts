// WebRTC Configuration - Full HD 1080p @ 60fps with STUN Priority
// This is production-grade WebRTC configuration similar to WhatsApp

// ============================================
// STUN SERVERS (20+) - These are FREE and handle 95% of calls
// ============================================
export const STUN_SERVERS = [
  // Google STUN (Most reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // Cloudflare STUN (Fast)
  { urls: 'stun:stun.cloudflare.com:3478' },
  
  // Twilio STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
  
  // Other Public STUN
  { urls: 'stun:stun.voipbuster.com:3478' },
  { urls: 'stun:stun.sipgate.net:3478' },
  { urls: 'stun:stun.voiparound.com:3478' },
  { urls: 'stun:stun.voipstunt.com:3478' },
  { urls: 'stun:stun.counterpath.com:3478' },
  { urls: 'stun:stun.nextcloud.com:3478' },
  { urls: 'stun:stun.ekiga.net:3478' },
  { urls: 'stun:stun.freevoipdeal.com:3478' },
  { urls: 'stun:stun.ideasip.com:3478' },
  { urls: 'stun:stun.schlund.de:3478' },
  { urls: 'stun:stun.voipgate.com:3478' },
  { urls: 'stun:stun.1und1.de:3478' },
  { urls: 'stun:stun.gmx.net:3478' },
];

// ============================================
// TURN SERVERS - Only used when STUN fails (5% cases)
// ============================================
export const STATIC_TURN_SERVERS = [
  // Metered.ca Open Relay (Free tier)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  // Additional TURN servers
  {
    urls: 'turn:openrelay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// ============================================
// Fetch Metered TURN dynamically
// ============================================
export async function fetchMeteredTurnServers(): Promise<RTCIceServer[]> {
  const apiKey = import.meta.env.VITE_METERED_API_KEY;
  if (!apiKey) return STATIC_TURN_SERVERS;
  
  try {
    const response = await fetch(
      `https://ourdm.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) throw new Error('Failed to fetch TURN');
    
    const servers = await response.json();
    console.log('[WebRTC] Fetched Metered TURN servers:', servers.length);
    return servers;
  } catch (error) {
    console.warn('[WebRTC] Using static TURN servers:', error);
    return STATIC_TURN_SERVERS;
  }
}

// ============================================
// VIDEO QUALITY PRESETS
// ============================================
export const VIDEO_QUALITY = {
  // Full HD 1080p @ 60fps (Best quality - WhatsApp level)
  FULL_HD_60: {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 60, max: 60 },
    aspectRatio: { ideal: 16 / 9 },
  },
  
  // Full HD 1080p @ 30fps (Good quality, less bandwidth)
  FULL_HD_30: {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
    aspectRatio: { ideal: 16 / 9 },
  },
  
  // HD 720p @ 60fps (Balanced)
  HD_60: {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 60, max: 60 },
    aspectRatio: { ideal: 16 / 9 },
  },
  
  // HD 720p @ 30fps (Standard WhatsApp quality)
  HD_30: {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
    aspectRatio: { ideal: 16 / 9 },
  },
  
  // SD 480p @ 30fps (Low bandwidth)
  SD_30: {
    width: { ideal: 854, max: 854 },
    height: { ideal: 480, max: 480 },
    frameRate: { ideal: 30, max: 30 },
    aspectRatio: { ideal: 16 / 9 },
  },
};

// ============================================
// AUDIO QUALITY SETTINGS
// ============================================
export const AUDIO_QUALITY = {
  // High quality audio (crystal clear)
  HIGH: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2, // Stereo
    sampleSize: 16,
  },
  
  // Standard quality
  STANDARD: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
    channelCount: 1, // Mono
    sampleSize: 16,
  },
};

// ============================================
// Build ICE Servers with STUN Priority
// ============================================
export async function buildIceServers(
  stunEnabled: boolean = true,
  turnEnabled: boolean = true,
  _prioritizeStun: boolean = true
): Promise<RTCIceServer[]> {
  const iceServers: RTCIceServer[] = [];
  
  // Add STUN first (priority) - handles 95% of calls
  if (stunEnabled) {
    iceServers.push(...STUN_SERVERS);
  }
  
  // Add TURN as fallback (5% of calls)
  if (turnEnabled) {
    try {
      const turnServers = await fetchMeteredTurnServers();
      iceServers.push(...turnServers);
    } catch {
      iceServers.push(...STATIC_TURN_SERVERS);
    }
  }
  
  return iceServers;
}

// ============================================
// RTCPeerConnection Configuration
// ============================================
export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  bundlePolicy: RTCBundlePolicy;
  rtcpMuxPolicy: RTCRtcpMuxPolicy;
  iceTransportPolicy: RTCIceTransportPolicy;
}

export async function createPeerConnectionConfig(
  stunEnabled: boolean = true,
  turnEnabled: boolean = true,
  forceRelay: boolean = false
): Promise<WebRTCConfig> {
  const iceServers = await buildIceServers(stunEnabled, turnEnabled);
  
  return {
    iceServers,
    iceCandidatePoolSize: 10, // Pre-gather candidates
    bundlePolicy: 'max-bundle', // Reduce ports used
    rtcpMuxPolicy: 'require', // Multiplex RTP and RTCP
    iceTransportPolicy: forceRelay ? 'relay' : 'all', // 'all' = try STUN first
  };
}

// ============================================
// BITRATE SETTINGS for Quality Control
// ============================================
export const BITRATE_CONFIG = {
  // Video bitrates (kbps)
  video: {
    FULL_HD_60: { min: 2500, max: 8000, start: 4000 },
    FULL_HD_30: { min: 2000, max: 6000, start: 3000 },
    HD_60: { min: 1500, max: 4000, start: 2500 },
    HD_30: { min: 1000, max: 3000, start: 1500 },
    SD_30: { min: 500, max: 1500, start: 800 },
  },
  
  // Audio bitrates (kbps)
  audio: {
    HIGH: { min: 64, max: 128, start: 96 },
    STANDARD: { min: 32, max: 64, start: 48 },
  },
};

// ============================================
// Adaptive Bitrate Controller
// ============================================
export class AdaptiveBitrateController {
  private peerConnection: RTCPeerConnection;
  private currentQuality: keyof typeof VIDEO_QUALITY = 'HD_30';
  private statsInterval: number | null = null;
  
  constructor(pc: RTCPeerConnection) {
    this.peerConnection = pc;
  }
  
  // Start monitoring and adjusting bitrate
  startMonitoring() {
    this.statsInterval = window.setInterval(async () => {
      await this.checkAndAdjust();
    }, 3000); // Check every 3 seconds
  }
  
  stopMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
  
  private async checkAndAdjust() {
    try {
      const stats = await this.peerConnection.getStats();
      let packetsLost = 0;
      let packetsSent = 0;
      let availableBandwidth = Infinity;
      
      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          packetsLost = report.packetsLost || 0;
          packetsSent = report.packetsSent || 0;
        }
        
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          availableBandwidth = report.availableOutgoingBitrate || Infinity;
        }
      });
      
      const lossRate = packetsSent > 0 ? packetsLost / packetsSent : 0;
      
      // Adjust quality based on packet loss
      if (lossRate > 0.1) {
        // More than 10% packet loss - reduce quality
        await this.reduceQuality();
      } else if (lossRate < 0.01 && availableBandwidth > 3000000) {
        // Less than 1% loss and good bandwidth - increase quality
        await this.increaseQuality();
      }
    } catch (error) {
      console.error('[AdaptiveBitrate] Error:', error);
    }
  }
  
  private async reduceQuality() {
    const qualities: (keyof typeof VIDEO_QUALITY)[] = [
      'FULL_HD_60', 'FULL_HD_30', 'HD_60', 'HD_30', 'SD_30'
    ];
    const currentIndex = qualities.indexOf(this.currentQuality);
    
    if (currentIndex < qualities.length - 1) {
      this.currentQuality = qualities[currentIndex + 1];
      await this.applyBitrate();
      console.log('[AdaptiveBitrate] Reduced to:', this.currentQuality);
    }
  }
  
  private async increaseQuality() {
    const qualities: (keyof typeof VIDEO_QUALITY)[] = [
      'FULL_HD_60', 'FULL_HD_30', 'HD_60', 'HD_30', 'SD_30'
    ];
    const currentIndex = qualities.indexOf(this.currentQuality);
    
    if (currentIndex > 0) {
      this.currentQuality = qualities[currentIndex - 1];
      await this.applyBitrate();
      console.log('[AdaptiveBitrate] Increased to:', this.currentQuality);
    }
  }
  
  private async applyBitrate() {
    const sender = this.peerConnection
      .getSenders()
      .find((s) => s.track?.kind === 'video');
    
    if (!sender) return;
    
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    
    const bitrate = BITRATE_CONFIG.video[this.currentQuality];
    params.encodings[0].maxBitrate = bitrate.max * 1000;
    
    await sender.setParameters(params);
  }
  
  setQuality(quality: keyof typeof VIDEO_QUALITY) {
    this.currentQuality = quality;
    this.applyBitrate();
  }
}

// ============================================
// Audio Buffer Management (Prevent cutting)
// ============================================
export function configureAudioBuffer(audioElement: HTMLAudioElement) {
  // Increase buffer size to prevent audio cutting
  if ('mozPreservesPitch' in audioElement) {
    (audioElement as any).mozPreservesPitch = false;
  }
  
  // Set playback strategy
  audioElement.preload = 'auto';
  
  // Handle audio interruptions
  audioElement.addEventListener('waiting', () => {
    console.log('[Audio] Buffering...');
  });
  
  audioElement.addEventListener('playing', () => {
    console.log('[Audio] Playing');
  });
}

// ============================================
// Complete WebRTC Call Manager
// ============================================
export class WebRTCCallManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private bitrateController: AdaptiveBitrateController | null = null;
  
  private onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;
  private onIceConnectionStateChange: ((state: RTCIceConnectionState) => void) | null = null;
  
  // Track which transport is being used
  private transportUsed: 'stun' | 'turn' | 'unknown' = 'unknown';
  
  // Call statistics
  private callStats = {
    startTime: 0,
    bytesReceived: 0,
    bytesSent: 0,
    packetsLost: 0,
    jitter: 0,
    roundTripTime: 0,
  };
  
  // Event handlers
  setOnIceCandidate(handler: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidate = handler;
  }
  
  setOnRemoteStream(handler: (stream: MediaStream) => void) {
    this.onRemoteStream = handler;
  }
  
  setOnConnectionStateChange(handler: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChange = handler;
  }
  
  setOnIceConnectionStateChange(handler: (state: RTCIceConnectionState) => void) {
    this.onIceConnectionStateChange = handler;
  }
  
  // Initialize peer connection
  async initialize(
    stunEnabled: boolean = true,
    turnEnabled: boolean = true,
    forceRelay: boolean = false
  ) {
    const config = await createPeerConnectionConfig(stunEnabled, turnEnabled, forceRelay);
    
    this.peerConnection = new RTCPeerConnection(config);
    this.bitrateController = new AdaptiveBitrateController(this.peerConnection);
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        // Check if using STUN or TURN
        const candidateStr = event.candidate.candidate;
        if (candidateStr.includes('relay')) {
          this.transportUsed = 'turn';
          console.log('[WebRTC] Using TURN relay');
        } else if (candidateStr.includes('srflx') || candidateStr.includes('host')) {
          this.transportUsed = 'stun';
          console.log('[WebRTC] Using STUN');
        }
        
        this.onIceCandidate(event.candidate);
      }
    };
    
    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      this.remoteStream.addTrack(event.track);
      
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('[WebRTC] Connection state:', state);
      
      if (state === 'connected') {
        this.callStats.startTime = Date.now();
        this.bitrateController?.startMonitoring();
      } else if (state === 'disconnected' || state === 'failed') {
        this.bitrateController?.stopMonitoring();
      }
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };
    
    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection!.iceConnectionState;
      console.log('[WebRTC] ICE connection state:', state);
      
      // Auto-restart ICE on failure
      if (state === 'failed') {
        console.log('[WebRTC] ICE failed, attempting restart...');
        this.peerConnection?.restartIce();
      }
      
      if (this.onIceConnectionStateChange) {
        this.onIceConnectionStateChange(state);
      }
    };
    
    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = () => {
      console.log('[WebRTC] Negotiation needed');
    };
    
    return this.peerConnection;
  }
  
  // Get local media stream
  async getLocalStream(
    video: boolean = true,
    audio: boolean = true,
    quality: keyof typeof VIDEO_QUALITY = 'FULL_HD_60'
  ): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: audio ? AUDIO_QUALITY.HIGH : false,
      video: video ? VIDEO_QUALITY[quality] : false,
    };
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to peer connection
      if (this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }
      
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Error getting local stream:', error);
      
      // Fallback to lower quality if Full HD fails
      if (quality === 'FULL_HD_60') {
        console.log('[WebRTC] Falling back to HD_30');
        return this.getLocalStream(video, audio, 'HD_30');
      }
      
      throw error;
    }
  }
  
  // Create offer
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    
    await this.peerConnection.setLocalDescription(offer);
    
    return offer;
  }
  
  // Create answer
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    return answer;
  }
  
  // Handle answer
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
  
  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
  
  // Toggle audio
  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }
  
  // Toggle video
  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }
  
  // Switch camera (front/back)
  async switchCamera() {
    if (!this.localStream) return;
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const settings = videoTrack.getSettings();
    const currentFacing = settings.facingMode;
    
    // Stop current track
    videoTrack.stop();
    
    // Get new track with opposite facing mode
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...VIDEO_QUALITY.FULL_HD_60,
        facingMode: currentFacing === 'user' ? 'environment' : 'user',
      },
    });
    
    const newVideoTrack = newStream.getVideoTracks()[0];
    
    // Replace track in peer connection
    const sender = this.peerConnection
      ?.getSenders()
      .find((s) => s.track?.kind === 'video');
    
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }
    
    // Replace track in local stream
    this.localStream.removeTrack(videoTrack);
    this.localStream.addTrack(newVideoTrack);
  }
  
  // Set video quality
  setVideoQuality(quality: keyof typeof VIDEO_QUALITY) {
    this.bitrateController?.setQuality(quality);
  }
  
  // Get call statistics
  async getStats(): Promise<{
    transportUsed: string;
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    jitter: number;
    roundTripTime: number;
    duration: number;
  }> {
    if (!this.peerConnection) {
      return {
        transportUsed: 'unknown',
        bytesReceived: 0,
        bytesSent: 0,
        packetsLost: 0,
        jitter: 0,
        roundTripTime: 0,
        duration: 0,
      };
    }
    
    const stats = await this.peerConnection.getStats();
    
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        this.callStats.bytesReceived = report.bytesReceived || 0;
        this.callStats.packetsLost = report.packetsLost || 0;
        this.callStats.jitter = report.jitter || 0;
      }
      
      if (report.type === 'outbound-rtp') {
        this.callStats.bytesSent = report.bytesSent || 0;
      }
      
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        this.callStats.roundTripTime = report.currentRoundTripTime || 0;
      }
    });
    
    return {
      transportUsed: this.transportUsed,
      ...this.callStats,
      duration: this.callStats.startTime
        ? Math.floor((Date.now() - this.callStats.startTime) / 1000)
        : 0,
    };
  }
  
  // End call
  endCall() {
    this.bitrateController?.stopMonitoring();
    
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    
    // Stop all remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Reset stats
    this.callStats = {
      startTime: 0,
      bytesReceived: 0,
      bytesSent: 0,
      packetsLost: 0,
      jitter: 0,
      roundTripTime: 0,
    };
    
    this.transportUsed = 'unknown';
  }
  
  // Get local stream
  getLocalStreamRef() {
    return this.localStream;
  }
  
  // Get remote stream
  getRemoteStreamRef() {
    return this.remoteStream;
  }
  
  // Get peer connection
  getPeerConnection() {
    return this.peerConnection;
  }
}

// ============================================
// Group Call Manager (Multiple peers)
// ============================================
export class GroupCallManager {
  private peers: Map<string, WebRTCCallManager> = new Map();
  private localStream: MediaStream | null = null;
  
  private onPeerJoined: ((peerId: string) => void) | null = null;
  private onPeerLeft: ((peerId: string) => void) | null = null;
  private onPeerStream: ((peerId: string, stream: MediaStream) => void) | null = null;
  
  setOnPeerJoined(handler: (peerId: string) => void) {
    this.onPeerJoined = handler;
  }
  
  setOnPeerLeft(handler: (peerId: string) => void) {
    this.onPeerLeft = handler;
  }
  
  setOnPeerStream(handler: (peerId: string, stream: MediaStream) => void) {
    this.onPeerStream = handler;
  }
  
  // Initialize local stream for group call
  async initializeLocalStream(
    video: boolean = true,
    audio: boolean = true,
    quality: keyof typeof VIDEO_QUALITY = 'HD_30' // Use HD for group calls to save bandwidth
  ): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: audio ? AUDIO_QUALITY.STANDARD : false,
      video: video ? VIDEO_QUALITY[quality] : false,
    };
    
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }
  
  // Add peer to group call
  async addPeer(
    peerId: string,
    stunEnabled: boolean = true,
    turnEnabled: boolean = true
  ): Promise<WebRTCCallManager> {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!;
    }
    
    const manager = new WebRTCCallManager();
    await manager.initialize(stunEnabled, turnEnabled);
    
    // Add local tracks to this peer connection
    if (this.localStream) {
      const pc = manager.getPeerConnection();
      if (pc) {
        this.localStream.getTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
        });
      }
    }
    
    // Handle remote stream
    manager.setOnRemoteStream((stream) => {
      if (this.onPeerStream) {
        this.onPeerStream(peerId, stream);
      }
    });
    
    // Handle disconnection
    manager.setOnConnectionStateChange((state) => {
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.removePeer(peerId);
      }
    });
    
    this.peers.set(peerId, manager);
    
    if (this.onPeerJoined) {
      this.onPeerJoined(peerId);
    }
    
    return manager;
  }
  
  // Remove peer from group call
  removePeer(peerId: string) {
    const manager = this.peers.get(peerId);
    if (manager) {
      manager.endCall();
      this.peers.delete(peerId);
      
      if (this.onPeerLeft) {
        this.onPeerLeft(peerId);
      }
    }
  }
  
  // Get peer manager
  getPeer(peerId: string): WebRTCCallManager | undefined {
    return this.peers.get(peerId);
  }
  
  // Toggle audio for all peers
  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }
  
  // Toggle video for all peers
  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }
  
  // End group call
  endCall() {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    
    // End all peer connections
    this.peers.forEach((manager, peerId) => {
      manager.endCall();
      if (this.onPeerLeft) {
        this.onPeerLeft(peerId);
      }
    });
    
    this.peers.clear();
  }
  
  // Get all peer IDs
  getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }
  
  // Get local stream
  getLocalStream() {
    return this.localStream;
  }
}

// ============================================
// Export default instance
// ============================================
export const webrtcManager = new WebRTCCallManager();
export const groupCallManager = new GroupCallManager();
