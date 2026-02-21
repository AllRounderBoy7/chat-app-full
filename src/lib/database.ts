// Local-First Database using Dexie.js (IndexedDB wrapper)
// Standardized on snake_case to match Supabase and appStore.ts
import Dexie, { type Table } from 'dexie';

export interface DBMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  iv?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice' | 'location' | 'contact' | 'sticker' | 'system' | 'poll' | 'file';
  receiver_id?: string;
  file_url?: string;
  local_file_id?: string;
  thumbnail?: string;
  reply_to?: string;
  forwarded_from?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'scheduled';
  reactions?: Record<string, string[]>;
  is_deleted?: boolean;
  deleted_for_everyone?: boolean;
  edited_at?: number;
  expires_at?: number;
  synced_to_server?: boolean;
  deleted_from_server?: boolean;
  is_system?: boolean;
  is_broadcast?: boolean;
  broadcast_id?: string;
  created_at?: number;
  updated_at?: number;
  timestamp?: string | number;
}

export interface DBChat {
  id: string;
  order_id?: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  is_online?: boolean;
  last_seen?: number;
  last_message_id?: string;
  is_locked?: boolean;
  is_hidden?: boolean;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_blocked?: boolean;
  is_archived?: boolean;
  disappearing_messages?: number;
  wallpaper?: string;

  // Unified Fields
  type?: 'individual' | 'group' | 'broadcast';
  participants?: string[];
  admins?: string[];
  group_settings?: Record<string, any>;
  description?: string;
  invite_link?: string;

  // Support for multiple naming conventions (aliasing for legacy)
  recipient_id?: string;
  recipient_name?: string;
  recipient_avatar?: string;
  last_message?: string;
  last_message_time?: string | number;
  unread_count?: number;

  created_at?: number;
  updated_at?: number;
}

export type LocalChat = DBChat;

export interface DBContact {
  id: string;
  display_name: string;
  username: string;
  email?: string;
  avatar_url?: string;
  avatar?: string;
  bio?: string;
  odm?: string;
  is_online: boolean;
  last_seen?: number;
  is_friend: boolean;
  friend_status: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
  is_blocked: boolean;
  mutual_friends: number;
  created_at: number;
  updated_at: number;
}

// Friend Types
export interface DBFriend {
  id: string;
  odm_odm_userId: string;
  friendId: string;
  display_name: string;
  avatar: string;
  odm: string;
  bio: string;
  is_online: boolean;
  last_seen: number | null;
  friendship_date: number;
  is_best_friend: boolean;
  is_close_friend: boolean;
  is_muted: boolean;
  nickname: string | null;
  private_note: string | null;
  mutual_friends_count: number;
}

export interface DBFriendRequest {
  id: string;
  sender_id: string;
  from_user_name: string;
  from_user_avatar: string;
  from_user_odm: string;
  receiver_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: number;
  mutual_friends_count: number;
}

export interface DBBlockedUser {
  id: string;
  odm_user_id: string;
  blocked_user_id: string;
  user_name: string;
  user_avatar: string;
  blocked_at: number;
  reason: string | null;
}

export interface DBStory {
  id: string;
  order_id: string;
  order_name: string;
  order_avatar?: string;
  media_url: string;
  local_file_id?: string;
  media_type: 'image' | 'video';
  thumbnail?: string;
  caption?: string;
  viewers: string[];
  expires_at: number;
  created_at: number;
}

export interface DBCallLog {
  id: string;
  order_id: string;
  other_user_name: string;
  other_user_avatar?: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'missed' | 'answered' | 'declined' | 'busy' | 'no_answer';
  duration: number;
  used_turn: boolean;
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  created_at: number;
}

export interface DBMediaFile {
  id: string;
  message_id?: string;
  story_id?: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mime_type: string;
  size: number;
  name: string;
  thumbnail?: string;
  blur_hash?: string;
  local_path?: string;
  cloud_url?: string;
  is_downloaded: boolean;
  download_progress: number;
  created_at: number;
}

export interface DBPendingUpload {
  id: string;
  message_id?: string;
  story_id?: string;
  file_id: string;
  type: 'message' | 'story' | 'avatar';
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  retry_count: number;
  payload?: string; // Optional JSON payload for data
  created_at: number;
}

export interface DBSyncQueue {
  id: string;
  type: 'message' | 'status_update' | 'reaction' | 'delete' | 'typing' | 'read_receipt';
  payload: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  last_error?: string;
  created_at: number;
}

export interface DBSettings {
  id: string;
  key: string;
  value: string;
  updated_at: number;
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
  friends!: Table<DBFriend, string>;
  friendRequests!: Table<DBFriendRequest, string>;
  blockedUsers!: Table<DBBlockedUser, string>;

  constructor() {
    super('OurdmDB');

    // Naming standardized to snake_case for consistency
    this.version(4).stores({
      messages: 'id, chat_id, sender_id, receiver_id, status, synced_to_server, created_at, [chat_id+created_at], [chat_id+status]',
      chats: 'id, order_id, last_message_time, is_pinned, is_hidden, is_archived, updated_at',
      contacts: 'id, username, is_friend, friend_status, is_blocked, odm',
      stories: 'id, order_id, expires_at, created_at',
      callLogs: 'id, order_id, created_at',
      mediaFiles: 'id, message_id, story_id, is_downloaded, type',
      pendingUploads: 'id, status, created_at',
      syncQueue: 'id, priority, created_at, type',
      settings: 'id, key',
      friends: 'id, odm_odm_userId, friendId, is_best_friend, is_close_friend, friendship_date',
      friendRequests: 'id, sender_id, receiver_id, status, created_at',
      blockedUsers: 'id, odm_user_id, blocked_user_id, blocked_at'
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
  await db.messages.update(id, { ...updates, updated_at: Date.now() });
}

export async function getMessagesByChatId(chat_id: string, limit = 50, offset = 0): Promise<DBMessage[]> {
  return await db.messages
    .where('chat_id')
    .equals(chat_id)
    .reverse()
    .offset(offset)
    .limit(limit)
    .sortBy('created_at');
}

export async function getUnsentMessages(): Promise<DBMessage[]> {
  return await db.messages
    .filter(msg => !(msg.synced_to_server ?? false) && msg.status === 'pending')
    .toArray();
}

export async function markMessageSynced(messageId: string): Promise<void> {
  await db.messages.update(messageId, { synced_to_server: true, status: 'sent', updated_at: Date.now() });
}

export async function updateMessageStatus(messageId: string, status: DBMessage['status']): Promise<void> {
  await db.messages.update(messageId, { status, updated_at: Date.now() });
}

export async function deleteMessage(messageId: string, forEveryone = false): Promise<void> {
  if (forEveryone) {
    await db.messages.update(messageId, {
      is_deleted: true,
      deleted_for_everyone: true,
      content: '',
      file_url: undefined,
      thumbnail: undefined,
      updated_at: Date.now()
    });
  } else {
    await db.messages.delete(messageId);
  }
}

export async function editMessage(messageId: string, newContent: string, iv: string): Promise<void> {
  await db.messages.update(messageId, {
    content: newContent,
    iv,
    edited_at: Date.now(),
    updated_at: Date.now()
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
  await db.chats.update(chatId, { ...updates, updated_at: Date.now() });
}

export async function getAllChats(): Promise<DBChat[]> {
  return await db.chats.orderBy('last_message_time').reverse().toArray();
}

export async function getVisibleChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => !(chat.is_hidden ?? false) && !(chat.is_archived ?? false))
    .reverse()
    .sortBy('last_message_time');
}

export async function getHiddenChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => (chat.is_hidden ?? false))
    .toArray();
}

export async function getArchivedChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => (chat.is_archived ?? false))
    .toArray();
}

export async function getPinnedChats(): Promise<DBChat[]> {
  return await db.chats
    .filter(chat => (chat.is_pinned ?? false) && !(chat.is_hidden ?? false) && !(chat.is_archived ?? false))
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
  await db.contacts.update(id, { ...updates, updated_at: Date.now() });
}

export async function getFriends(): Promise<DBContact[]> {
  return await db.contacts.filter(c => c.friend_status === 'accepted' || (c.is_friend ?? false)).toArray();
}

export async function getBlockedContacts(): Promise<DBContact[]> {
  return await db.contacts.filter(c => (c.is_blocked ?? false)).toArray();
}

export async function getPendingRequests(): Promise<DBContact[]> {
  return await db.contacts.filter(c => c.friend_status === 'pending_received').toArray();
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<DBSyncQueue, 'id' | 'created_at'>): Promise<void> {
  await db.syncQueue.add({
    ...item,
    id: crypto.randomUUID(),
    created_at: Date.now()
  });
}

export async function getPendingSyncItems(): Promise<DBSyncQueue[]> {
  return await db.syncQueue
    .filter(item => item.retry_count < item.max_retries)
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
    .filter(story => story.expires_at > now)
    .sortBy('created_at');
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
    .filter(msg => msg.expires_at !== undefined && msg.expires_at < now)
    .toArray();

  await db.messages.bulkDelete(expired.map(m => m.id));
  return expired.length;
}

export async function clearExpiredStories(): Promise<number> {
  const now = Date.now();
  const expired = await db.stories
    .filter(story => story.expires_at < now)
    .toArray();

  await db.stories.bulkDelete(expired.map(s => s.id));
  return expired.length;
}

export async function clearOldSyncItems(): Promise<number> {
  const oneHourAgo = Date.now() - 3600000;
  const old = await db.syncQueue
    .filter(item => item.created_at < oneHourAgo && item.retry_count >= item.max_retries)
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
    await db.settings.update(existing.id, { value, updated_at: Date.now() });
  } else {
    await db.settings.add({
      id: crypto.randomUUID(),
      key,
      value,
      updated_at: Date.now()
    });
  }
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
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
