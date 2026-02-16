// ============================================
// OURDM v3.0.0 - Local Database Service
// Dexie.js (IndexedDB) Implementation
// WhatsApp-like Local-First Architecture
// ============================================

import Dexie, { Table } from 'dexie';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface LocalMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  content: string;
  iv?: string; // For encrypted messages
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'gif' | 'location' | 'contact' | 'poll' | 'system';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'scheduled';
  timestamp: string;
  createdAt?: string;
  
  // Reply
  replyTo?: string;
  
  // Media
  mediaUrl?: string;
  localMediaPath?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  
  // Forward
  isForwarded?: boolean;
  forwardCount?: number;
  originalSenderId?: string;
  
  // Reactions
  reactions?: string; // JSON string of reactions array
  
  // Features
  isStarred?: boolean;
  starredAt?: string;
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  deletedAt?: string;
  isEdited?: boolean;
  editedAt?: string;
  
  // Disappearing
  disappearAt?: string;
  
  // Scheduled
  isScheduled?: boolean;
  scheduledFor?: string;
  
  // Broadcast
  isBroadcast?: boolean;
  broadcastId?: string;
  
  // System
  isSystem?: boolean;
  
  // Delivery
  deliveredAt?: string;
  readAt?: string;
  
  // Receiver (for direct messages)
  receiverId?: string;
}

export interface LocalChat {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  isOnline: boolean;
  lastSeen?: string;
  typing?: boolean;
  
  // Chat type
  type?: 'individual' | 'group' | 'broadcast';
  
  // Group info
  participants?: string[];
  admins?: string[];
  groupSettings?: Record<string, unknown>;
  description?: string;
  inviteLink?: string;
  
  // Features
  isPinned?: boolean;
  isMuted?: boolean;
  muteUntil?: string;
  isArchived?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  
  // Disappearing messages
  disappearingMessages?: number; // 0 = off, otherwise seconds
  
  // Wallpaper
  wallpaper?: string;
  
  // Block status
  isBlocked?: boolean;
  blockedBy?: string;
}

export interface LocalContact {
  id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  status: 'friend' | 'pending_sent' | 'pending_received' | 'blocked';
  isOnline?: boolean;
  lastSeen?: string;
  addedAt: string;
  mutualFriends?: number;
}

export interface LocalStory {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: 'image' | 'video' | 'text';
  content: string;
  caption?: string;
  backgroundColor?: string;
  textColor?: string;
  viewers: string; // JSON string of viewer array
  reactions: string; // JSON string of reaction array
  createdAt: string;
  expiresAt: string;
  isViewed?: boolean;
}

export interface LocalCallLog {
  id: string;
  type: 'voice' | 'video';
  isGroup: boolean;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  participants: string; // JSON string
  status: 'ringing' | 'connecting' | 'connected' | 'ended' | 'missed' | 'declined' | 'busy' | 'failed';
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  missedBy?: string;
  usedStun?: boolean;
  usedTurn?: boolean;
  quality?: string; // JSON string
}

export interface LocalMediaFile {
  id: string;
  messageId: string;
  chatId: string;
  type: 'image' | 'video' | 'audio' | 'voice' | 'document';
  fileName: string;
  fileSize: number;
  mimeType: string;
  localPath?: string;
  cloudUrl?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  createdAt: string;
}

export interface LocalPendingUpload {
  id: string;
  type: 'message' | 'media' | 'story' | 'profile' | 'reaction' | 'read_receipt';
  data: Record<string, unknown>;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  attempts?: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}

export interface LocalSyncQueue {
  id: string;
  type: 'message' | 'media' | 'read_receipt' | 'typing' | 'online_status' | 'scheduled_message';
  data: Record<string, unknown>;
  scheduledFor?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface LocalSettings {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface LocalBlockedUser {
  id: string;
  blockedUserId: string;
  blockedAt: string;
}

export interface LocalPinnedMessage {
  id: string;
  messageId: string;
  chatId: string;
  pinnedBy: string;
  pinnedAt: string;
}

// ============================================
// DATABASE CLASS
// ============================================

export class OurdmDatabase extends Dexie {
  messages!: Table<LocalMessage, string>;
  chats!: Table<LocalChat, string>;
  contacts!: Table<LocalContact, string>;
  stories!: Table<LocalStory, string>;
  callLogs!: Table<LocalCallLog, string>;
  mediaFiles!: Table<LocalMediaFile, string>;
  pendingUploads!: Table<LocalPendingUpload, string>;
  syncQueue!: Table<LocalSyncQueue, string>;
  settings!: Table<LocalSettings, string>;
  blockedUsers!: Table<LocalBlockedUser, string>;
  pinnedMessages!: Table<LocalPinnedMessage, string>;
  
  constructor() {
    super('OurdmDB');
    
    this.version(1).stores({
      messages: 'id, chatId, senderId, timestamp, type, status, isStarred, isPinned, [chatId+timestamp]',
      chats: 'id, recipientId, lastMessageTime, type, isPinned, isArchived, isHidden, [type+lastMessageTime]',
      contacts: 'id, name, username, email, status, addedAt',
      stories: 'id, userId, createdAt, expiresAt',
      callLogs: 'id, callerId, type, status, startedAt',
      mediaFiles: 'id, messageId, chatId, type, createdAt, isDownloaded',
      pendingUploads: 'id, type, status, createdAt',
      syncQueue: 'id, type, status, scheduledFor, createdAt',
      settings: 'id, key',
      blockedUsers: 'id, blockedUserId, blockedAt',
      pinnedMessages: 'id, messageId, chatId, pinnedAt',
    });
  }
}

// Create database instance
export const db = new OurdmDatabase();

// ============================================
// STORAGE PERSISTENCE
// ============================================

export async function requestStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persistence: ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  }
  return false;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeDatabase(): Promise<void> {
  try {
    // Request persistence
    await requestStoragePersistence();
    
    // Open database
    await db.open();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// ============================================
// CLEANUP FUNCTIONS
// ============================================

// Clean up expired stories
export async function cleanupExpiredStories(): Promise<void> {
  const now = new Date().toISOString();
  await db.stories.where('expiresAt').below(now).delete();
}

// Clean up disappearing messages
export async function cleanupDisappearingMessages(): Promise<void> {
  const now = new Date().toISOString();
  const expiredMessages = await db.messages
    .filter((m) => m.disappearAt !== undefined && m.disappearAt <= now)
    .toArray();
  
  for (const msg of expiredMessages) {
    await db.messages.delete(msg.id);
  }
}

// Clean up old sync queue items
export async function cleanupSyncQueue(): Promise<void> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.syncQueue
    .where('createdAt')
    .below(oneWeekAgo)
    .filter((item) => item.status === 'completed')
    .delete();
}

// Run all cleanup tasks
export async function runDatabaseCleanup(): Promise<void> {
  await cleanupExpiredStories();
  await cleanupDisappearingMessages();
  await cleanupSyncQueue();
}

// Schedule periodic cleanup
export function schedulePeriodicCleanup(): void {
  // Run cleanup every 5 minutes
  setInterval(() => {
    runDatabaseCleanup().catch(console.error);
  }, 5 * 60 * 1000);
  
  // Run immediately on startup
  runDatabaseCleanup().catch(console.error);
}

// ============================================
// EXPORT DATABASE FOR BACKUP
// ============================================

export async function exportDatabaseForBackup(): Promise<string> {
  const messages = await db.messages.toArray();
  const chats = await db.chats.toArray();
  const contacts = await db.contacts.toArray();
  const settings = await db.settings.toArray();
  
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: '3.0.0',
    messages,
    chats,
    contacts,
    settings,
  });
}

// Import database from backup
export async function importDatabaseFromBackup(backupJson: string): Promise<void> {
  const backup = JSON.parse(backupJson);
  
  // Clear existing data
  await db.messages.clear();
  await db.chats.clear();
  await db.contacts.clear();
  await db.settings.clear();
  
  // Import data
  if (backup.messages) {
    await db.messages.bulkAdd(backup.messages);
  }
  if (backup.chats) {
    await db.chats.bulkAdd(backup.chats);
  }
  if (backup.contacts) {
    await db.contacts.bulkAdd(backup.contacts);
  }
  if (backup.settings) {
    await db.settings.bulkAdd(backup.settings);
  }
}

// ============================================
// INITIALIZE ON IMPORT
// ============================================

initializeDatabase().catch(console.error);
schedulePeriodicCleanup();
