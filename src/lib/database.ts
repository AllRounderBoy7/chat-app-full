// Local-First Database using Dexie.js (IndexedDB wrapper)
import Dexie, { type Table } from 'dexie';

export interface DBMessage {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  iv: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice' | 'location' | 'contact' | 'sticker';
  fileUrl?: string;
  localFileId?: string;
  thumbnail?: string;
  replyTo?: string;
  forwardedFrom?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string[]>;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  editedAt?: number;
  expiresAt?: number;
  syncedToServer: boolean;
  deletedFromServer: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DBChat {
  id: string;
  oderId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen?: number;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageTime?: number;
  unreadCount: number;
  isLocked: boolean;
  isHidden: boolean;
  isPinned: boolean;
  isMuted: boolean;
  isBlocked: boolean;
  isArchived: boolean;
  disappearingMessages?: number;
  wallpaper?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DBContact {
  id: string;
  displayName: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  avatar?: string;
  bio?: string;
  odm?: string;
  isOnline: boolean;
  lastSeen?: number;
  isFriend: boolean;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
  isBlocked: boolean;
  mutualFriends: number;
  createdAt: number;
  updatedAt: number;
}

// Friend Types
export interface DBFriend {
  id: string;
  odm_odm_userId: string;
  friendId: string;
  displayName: string;
  avatar: string;
  odm: string;
  bio: string;
  isOnline: boolean;
  lastSeen: Date | null;
  friendshipDate: Date;
  isBestFriend: boolean;
  isCloseFriend: boolean;
  isMuted: boolean;
  nickname: string | null;
  privateNote: string | null;
  mutualFriendsCount: number;
}

export interface DBFriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  fromUserOdm: string;
  toUserId: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Date;
  mutualFriendsCount: number;
}

export interface DBBlockedUser {
  id: string;
  odm_userId: string;
  blockedUserId: string;
  userName: string;
  userAvatar: string;
  blockedAt: Date;
  reason: string | null;
}

export interface DBStory {
  id: string;
  oderId: string;
  oderName: string;
  oderAvatar?: string;
  mediaUrl: string;
  localFileId?: string;
  mediaType: 'image' | 'video';
  thumbnail?: string;
  caption?: string;
  viewers: string[];
  expiresAt: number;
  createdAt: number;
}

export interface DBCallLog {
  id: string;
  oderId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'missed' | 'answered' | 'declined' | 'busy' | 'no_answer';
  duration: number;
  usedTurn: boolean;
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  createdAt: number;
}

export interface DBMediaFile {
  id: string;
  messageId?: string;
  storyId?: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  size: number;
  name: string;
  thumbnail?: string;
  blurHash?: string;
  localPath?: string;
  cloudUrl?: string;
  isDownloaded: boolean;
  downloadProgress: number;
  createdAt: number;
}

export interface DBPendingUpload {
  id: string;
  messageId?: string;
  storyId?: string;
  fileId: string;
  type: 'message' | 'story' | 'avatar';
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  retryCount: number;
  error?: string;
  createdAt: number;
}

export interface DBSyncQueue {
  id: string;
  type: 'message' | 'status_update' | 'reaction' | 'delete' | 'typing' | 'read_receipt';
  payload: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: number;
}

export interface DBSettings {
  id: string;
  key: string;
  value: string;
  updatedAt: number;
}

// Group Types
export interface DBGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  settings: string; // JSON string
  members: string; // JSON string
  memberCount: number;
  lastMessage?: string; // JSON string
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
}

export interface DBGroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice' | 'poll' | 'location' | 'contact' | 'system';
  replyTo?: string; // JSON string
  mentions: string[];
  reactions: Record<string, string[]>;
  attachments?: string; // JSON string
  poll?: string; // JSON string
  location?: string; // JSON string
  contact?: string; // JSON string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveredTo: string[];
  readBy: string[];
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedFor: 'everyone' | 'me' | null;
  isStarred: boolean;
  isPinned: boolean;
  scheduledFor?: string;
  expiresAt?: string;
  createdAt: string;
}

class OurdmDatabase extends Dexie {
  messages!: Table<DBMessage, string>;
  chats!: Table<DBChat, string>;
  contacts!: Table<DBContact, string>;
  stories!: Table<DBStory, string>;
  callLogs!: Table<DBCallLog, string>;
  mediaFiles!: Table<DBMediaFile, string>;
  pendingUploads!: Table<DBPendingUpload, string>;
  syncQueue!: Table<DBSyncQueue, string>;
  settings!: Table<DBSettings, string>;
  groups!: Table<DBGroup, string>;
  groupMessages!: Table<DBGroupMessage, string>;
  friends!: Table<DBFriend, string>;
  friendRequests!: Table<DBFriendRequest, string>;
  blockedUsers!: Table<DBBlockedUser, string>;

  constructor() {
    super('OurdmDB');
    
    this.version(4).stores({
      messages: 'id, chatId, senderId, receiverId, status, syncedToServer, createdAt, [chatId+createdAt], [chatId+status]',
      chats: 'id, oderId, lastMessageTime, isPinned, isHidden, isArchived, updatedAt',
      contacts: 'id, username, isFriend, friendStatus, isBlocked, odm',
      stories: 'id, oderId, expiresAt, createdAt',
      callLogs: 'id, oderId, createdAt',
      mediaFiles: 'id, messageId, storyId, isDownloaded, type',
      pendingUploads: 'id, status, createdAt',
      syncQueue: 'id, priority, createdAt, type',
      settings: 'id, key',
      groups: 'id, createdBy, createdAt, isPinned, isArchived, updatedAt',
      groupMessages: 'id, groupId, senderId, status, isStarred, isPinned, createdAt, [groupId+createdAt]',
      friends: 'id, odm_odm_userId, friendId, isBestFriend, isCloseFriend, friendshipDate',
      friendRequests: 'id, fromUserId, toUserId, status, createdAt',
      blockedUsers: 'id, odm_userId, blockedUserId, blockedAt'
    });
  }
}

export const db = new OurdmDatabase();

// Message operations
export async function addMessage(message: DBMessage): Promise<string> {
  return await db.messages.add(message);
}

export async function getMessage(id: string): Promise<DBMessage | undefined> {
  return await db.messages.get(id);
}

export async function updateMessage(id: string, updates: Partial<DBMessage>): Promise<void> {
  await db.messages.update(id, { ...updates, updatedAt: Date.now() });
}

export async function getMessagesByChatId(chatId: string, limit = 50, offset = 0): Promise<DBMessage[]> {
  return await db.messages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .offset(offset)
    .limit(limit)
    .sortBy('createdAt');
}

export async function getUnsentMessages(): Promise<DBMessage[]> {
  return await db.messages
    .filter(msg => !msg.syncedToServer && msg.status === 'pending')
    .toArray();
}

export async function markMessageSynced(messageId: string): Promise<void> {
  await db.messages.update(messageId, { syncedToServer: true, status: 'sent', updatedAt: Date.now() });
}

export async function updateMessageStatus(messageId: string, status: DBMessage['status']): Promise<void> {
  await db.messages.update(messageId, { status, updatedAt: Date.now() });
}

export async function deleteMessage(messageId: string, forEveryone = false): Promise<void> {
  if (forEveryone) {
    await db.messages.update(messageId, { 
      isDeleted: true, 
      deletedForEveryone: true,
      content: '', 
      fileUrl: undefined,
      thumbnail: undefined,
      updatedAt: Date.now() 
    });
  } else {
    await db.messages.delete(messageId);
  }
}

export async function editMessage(messageId: string, newContent: string, iv: string): Promise<void> {
  await db.messages.update(messageId, { 
    content: newContent, 
    iv,
    editedAt: Date.now(),
    updatedAt: Date.now() 
  });
}

// Chat operations
export async function addChat(chat: DBChat): Promise<string> {
  return await db.chats.add(chat);
}

export async function getChat(id: string): Promise<DBChat | undefined> {
  return await db.chats.get(id);
}

export async function updateChat(chatId: string, updates: Partial<DBChat>): Promise<void> {
  await db.chats.update(chatId, { ...updates, updatedAt: Date.now() });
}

export async function getAllChats(): Promise<DBChat[]> {
  return await db.chats.orderBy('lastMessageTime').reverse().toArray();
}

export async function getVisibleChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => !chat.isHidden && !chat.isArchived)
    .reverse()
    .sortBy('lastMessageTime');
}

export async function getHiddenChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => chat.isHidden)
    .toArray();
}

export async function getArchivedChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => chat.isArchived)
    .toArray();
}

export async function getPinnedChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => chat.isPinned && !chat.isHidden && !chat.isArchived)
    .toArray();
}

// Contact operations
export async function addContact(contact: DBContact): Promise<string> {
  return await db.contacts.add(contact);
}

export async function getContact(id: string): Promise<DBContact | undefined> {
  return await db.contacts.get(id);
}

export async function updateContact(id: string, updates: Partial<DBContact>): Promise<void> {
  await db.contacts.update(id, { ...updates, updatedAt: Date.now() });
}

export async function getFriends(): Promise<DBContact[]> {
  return await db.contacts.filter(c => c.friendStatus === 'accepted').toArray();
}

export async function getBlockedContacts(): Promise<DBContact[]> {
  return await db.contacts.filter(c => c.isBlocked).toArray();
}

export async function getPendingRequests(): Promise<DBContact[]> {
  return await db.contacts.filter(c => c.friendStatus === 'pending_received').toArray();
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<DBSyncQueue, 'id' | 'createdAt'>): Promise<void> {
  await db.syncQueue.add({
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  });
}

export async function getPendingSyncItems(): Promise<DBSyncQueue[]> {
  return await db.syncQueue
    .filter(item => item.retryCount < item.maxRetries)
    .sortBy('priority')
    .then(items => items.reverse().slice(0, 50));
}

export async function updateSyncItem(id: string, updates: Partial<DBSyncQueue>): Promise<void> {
  await db.syncQueue.update(id, updates);
}

export async function removeSyncItem(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

// Story operations
export async function addStory(story: DBStory): Promise<string> {
  return await db.stories.add(story);
}

export async function getActiveStories(): Promise<DBStory[]> {
  const now = Date.now();
  return await db.stories
    .filter(story => story.expiresAt > now)
    .sortBy('createdAt');
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const story = await db.stories.get(storyId);
  if (story && !story.viewers.includes(viewerId)) {
    await db.stories.update(storyId, {
      viewers: [...story.viewers, viewerId]
    });
  }
}

// Cleanup operations
export async function clearExpiredMessages(): Promise<number> {
  const now = Date.now();
  const expired = await db.messages
    .filter(msg => msg.expiresAt !== undefined && msg.expiresAt < now)
    .toArray();
  
  await db.messages.bulkDelete(expired.map(m => m.id));
  return expired.length;
}

export async function clearExpiredStories(): Promise<number> {
  const now = Date.now();
  const expired = await db.stories
    .filter(story => story.expiresAt < now)
    .toArray();
  
  await db.stories.bulkDelete(expired.map(s => s.id));
  return expired.length;
}

export async function clearOldSyncItems(): Promise<number> {
  const oneHourAgo = Date.now() - 3600000;
  const old = await db.syncQueue
    .filter(item => item.createdAt < oneHourAgo && item.retryCount >= item.maxRetries)
    .toArray();
  
  await db.syncQueue.bulkDelete(old.map(s => s.id));
  return old.length;
}

// Storage stats
export async function getStorageStats(): Promise<{
  messagesCount: number;
  chatsCount: number;
  mediaFilesCount: number;
  storiesCount: number;
  callLogsCount: number;
  pendingUploadsCount: number;
  syncQueueCount: number;
  estimatedSize: number;
}> {
  const [messagesCount, chatsCount, mediaFilesCount, storiesCount, callLogsCount, pendingUploadsCount, syncQueueCount] = await Promise.all([
    db.messages.count(),
    db.chats.count(),
    db.mediaFiles.count(),
    db.stories.count(),
    db.callLogs.count(),
    db.pendingUploads.count(),
    db.syncQueue.count()
  ]);
  
  const estimate = await navigator.storage.estimate();
  
  return {
    messagesCount,
    chatsCount,
    mediaFilesCount,
    storiesCount,
    callLogsCount,
    pendingUploadsCount,
    syncQueueCount,
    estimatedSize: estimate.usage || 0
  };
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.messages.clear(),
    db.chats.clear(),
    db.contacts.clear(),
    db.stories.clear(),
    db.callLogs.clear(),
    db.mediaFiles.clear(),
    db.pendingUploads.clear(),
    db.syncQueue.clear(),
    db.settings.clear()
  ]);
}

// Settings operations
export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.settings.where('key').equals(key).first();
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing) {
    await db.settings.update(existing.id, { value, updatedAt: Date.now() });
  } else {
    await db.settings.add({
      id: crypto.randomUUID(),
      key,
      value,
      updatedAt: Date.now()
    });
  }
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persistence: ${isPersisted}`);
    return isPersisted;
  }
  return false;
}

// Initialize database
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    await requestPersistentStorage();
    
    // Clean up expired data
    const [expiredMessages, expiredStories, oldSyncItems] = await Promise.all([
      clearExpiredMessages(),
      clearExpiredStories(),
      clearOldSyncItems()
    ]);
    
    console.log(`Cleaned up: ${expiredMessages} messages, ${expiredStories} stories, ${oldSyncItems} sync items`);
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}
