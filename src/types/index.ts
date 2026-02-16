// ============================================
// OURDM v3.0.0 - Complete Type Definitions
// ============================================

// User Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  isOnline: boolean;
  lastSeen: Date;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: Date;
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  storage: StorageSettings;
}

export interface NotificationSettings {
  sound: boolean;
  vibrate: boolean;
  preview: boolean;
  groupNotifications: boolean;
  callRingtone: string;
  messageSound: string;
}

export interface PrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  about: 'everyone' | 'contacts' | 'nobody';
  status: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  disappearingDefault: number; // 0 = off, seconds otherwise
}

export interface StorageSettings {
  autoDownloadPhotos: 'wifi' | 'wifi+mobile' | 'never';
  autoDownloadVideos: 'wifi' | 'never';
  autoDownloadDocuments: 'wifi' | 'wifi+mobile' | 'never';
  mediaQuality: 'auto' | 'best' | 'data-saver';
}

// Chat Types
export interface Chat {
  id: string;
  type: 'individual' | 'group' | 'broadcast';
  participants: string[];
  name?: string; // For groups
  description?: string; // For groups
  icon?: string; // For groups
  lastMessage?: Message;
  lastMessageTime?: Date;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  muteUntil?: Date;
  isArchived: boolean;
  isLocked: boolean;
  isHidden: boolean;
  disappearingMessages: number; // 0 = off, seconds otherwise
  wallpaper?: string;
  createdAt: Date;
  createdBy: string;
  
  // Group specific
  groupSettings?: GroupSettings;
  admins?: string[];
  inviteLink?: string;
}

export interface GroupSettings {
  onlyAdminsCanSend: boolean;
  onlyAdminsCanAddMembers: boolean;
  onlyAdminsCanEditInfo: boolean;
  approvalRequired: boolean;
  maxMembers: number;
  linkSharingEnabled: boolean;
}

// Message Types
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  type: MessageType;
  content: string;
  encryptedContent?: string;
  iv?: string;
  
  // Status
  status: MessageStatus;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  editedAt?: Date;
  
  // Reply
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    type: MessageType;
  };
  
  // Forward
  isForwarded: boolean;
  forwardCount?: number;
  originalSenderId?: string;
  
  // Media
  media?: MediaAttachment;
  thumbnail?: string; // BlurHash or base64
  
  // Reactions
  reactions: MessageReaction[];
  
  // Features
  isStarred: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedForEveryone: boolean;
  deletedAt?: Date;
  
  // Disappearing
  disappearAt?: Date;
  
  // Scheduling
  isScheduled: boolean;
  scheduledFor?: Date;
  
  // Metadata
  mentions?: string[];
  links?: string[];
  isSystem: boolean; // System messages (user joined, left, etc.)
}

export type MessageType = 
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'gif'
  | 'location'
  | 'contact'
  | 'poll'
  | 'system';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'voice' | 'document';
  url?: string;
  localPath?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number; // For audio/video
  thumbnail?: string;
  isDownloaded: boolean;
  downloadProgress?: number;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

// Story Types
export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: 'image' | 'video' | 'text';
  content: string;
  caption?: string;
  backgroundColor?: string;
  textColor?: string;
  viewers: StoryViewer[];
  reactions: StoryReaction[];
  createdAt: Date;
  expiresAt: Date;
  isViewed: boolean;
}

export interface StoryViewer {
  userId: string;
  userName: string;
  viewedAt: Date;
}

export interface StoryReaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

// Call Types
export interface Call {
  id: string;
  type: 'voice' | 'video';
  isGroup: boolean;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  participants: CallParticipant[];
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  missedBy?: string[];
  recordingUrl?: string;
  
  // WebRTC
  usedStun: boolean;
  usedTurn: boolean;
  iceServers?: RTCIceServer[];
  
  // Quality
  quality: CallQuality;
}

export interface CallParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  joinedAt: Date;
  leftAt?: Date;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
}

export type CallStatus = 
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'missed'
  | 'declined'
  | 'busy'
  | 'failed';

export interface CallQuality {
  video: VideoQualityPreset;
  audio: AudioQualityPreset;
  networkType?: 'wifi' | '4g' | '3g' | '2g';
  packetLoss?: number;
  jitter?: number;
  latency?: number;
}

export type VideoQualityPreset = 
  | 'FULL_HD_60'
  | 'FULL_HD_30'
  | 'HD_60'
  | 'HD_30'
  | 'SD_30'
  | 'LOW_15';

export type AudioQualityPreset = 'HIGH' | 'MEDIUM' | 'LOW';

// Friend Types
export interface Friend {
  id: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  acceptedAt?: Date;
  blockedAt?: Date;
  blockedBy?: string;
  mutualFriends?: number;
}

// Admin Types
export interface AdminSettings {
  // Calls
  voiceCallsEnabled: boolean;
  videoCallsEnabled: boolean;
  groupCallsEnabled: boolean;
  stunEnabled: boolean;
  turnEnabled: boolean;
  defaultVideoQuality: VideoQualityPreset;
  maxCallDuration: number;
  maxGroupCallParticipants: number;
  
  // Messaging
  messagingEnabled: boolean;
  maxMessageLength: number;
  maxFileSize: number;
  disappearingMessagesEnabled: boolean;
  defaultDisappearingDuration: number;
  messageEditTimeLimit: number; // seconds
  messageDeleteTimeLimit: number; // seconds
  
  // Groups
  groupsEnabled: boolean;
  maxGroupSize: number;
  maxGroupsPerUser: number;
  broadcastListsEnabled: boolean;
  maxBroadcastListSize: number;
  
  // Stories
  storiesEnabled: boolean;
  storyDuration: number;
  maxStoryFileSize: number;
  
  // Friends
  maxFriends: number;
  friendRequestEnabled: boolean;
  
  // Security
  e2eEncryptionEnabled: boolean;
  appLockEnabled: boolean;
  hiddenChatsEnabled: boolean;
  profanityFilterEnabled: boolean;
  spamDetectionEnabled: boolean;
  reportingEnabled: boolean;
  
  // System
  registrationEnabled: boolean;
  googleSignInEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maxStoragePerUser: number;
  
  // Moderation
  autoModeration: boolean;
  bannedWords: string[];
  linkPreviewEnabled: boolean;
  mediaPreviewEnabled: boolean;
}

// Broadcast List
export interface BroadcastList {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: Date;
  lastBroadcastAt?: Date;
}

// Poll
export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  allowMultipleVotes: boolean;
  isAnonymous: boolean;
  endsAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // user IDs
}
