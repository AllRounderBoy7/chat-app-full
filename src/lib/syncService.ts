// Sync Service - Handles transitional cloud storage like WhatsApp
import { supabase } from './supabase';
import { db, addToSyncQueue, getPendingSyncItems, removeSyncItem, updateSyncItem, type DBMessage, type DBSyncQueue } from './database';
import { processAndStoreMedia } from './mediaStorage';

const MESSAGE_TTL_DAYS = 30;
const SYNC_INTERVAL = 5000;
const MAX_RETRIES = 5;

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isOnline = navigator.onLine;
let isSyncing = false;
let unsubscribe: (() => void) | null = null;

// Initialize sync service
export function initSyncService(): void {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  startSyncInterval();

  if (isOnline) {
    syncPendingMessages();
    fetchPendingMessages();
  }
}

export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
}

function handleOnline(): void {
  isOnline = true;
  console.log('Back online - starting sync');
  syncPendingMessages();
  fetchPendingMessages();
}

function handleOffline(): void {
  isOnline = false;
  console.log('Went offline - queuing messages');
}

function startSyncInterval(): void {
  if (syncIntervalId) return;

  syncIntervalId = setInterval(() => {
    if (isOnline && !isSyncing) {
      syncPendingMessages();
    }
  }, SYNC_INTERVAL);
}

// Send message with optimistic UI
export async function sendMessage(message: DBMessage): Promise<void> {
  // Store locally immediately (Optimistic UI)
  await db.messages.add({
    ...message,
    synced_to_server: false,
    deleted_from_server: false
  });

  // Update chat preview
  const existingChat = await db.chats.get(message.chat_id);
  if (existingChat) {
    await db.chats.update(message.chat_id, {
      last_message_id: message.id,
      last_message: message.type === 'text' ? '[Encrypted]' : `[${message.type}]`,
      last_message_time: message.created_at,
      updated_at: Date.now()
    });
  }

  // Add to sync queue
  await addToSyncQueue({
    type: 'message',
    payload: JSON.stringify(message),
    priority: 10,
    retry_count: 0,
    max_retries: MAX_RETRIES
  });

  // Try immediate sync if online
  if (isOnline) {
    syncPendingMessages();
  }
}

// Sync pending messages to server
async function syncPendingMessages(): Promise<void> {
  if (isSyncing || !isOnline) return;

  isSyncing = true;

  try {
    const pendingItems = await getPendingSyncItems();

    for (const item of pendingItems) {
      try {
        await processSyncItem(item);
        await removeSyncItem(item.id);
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);

        // Increment retry count
        await updateSyncItem(item.id, {
          retry_count: item.retry_count + 1,
          last_error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Remove if too many retries
        if (item.retry_count >= item.max_retries - 1) {
          await removeSyncItem(item.id);
          console.log('Removed sync item after max retries:', item.id);
        }
      }
    }
  } finally {
    isSyncing = false;
  }
}

async function processSyncItem(item: DBSyncQueue): Promise<void> {
  const payload = JSON.parse(item.payload);

  switch (item.type) {
    case 'message':
      await uploadMessageToServer(payload);
      break;
    case 'status_update':
      await updateMessageStatusOnServer(payload);
      break;
    case 'reaction':
      await sendReactionToServer(payload);
      break;
    case 'delete':
      await deleteMessageFromServer(payload);
      break;
    case 'typing':
      await sendTypingIndicator(payload);
      break;
    case 'read_receipt':
      await sendReadReceiptToServer(payload);
      break;
  }
}

// Upload message to transitional storage
async function uploadMessageToServer(message: DBMessage): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MESSAGE_TTL_DAYS);

  const { error } = await supabase
    .from('pending_messages')
    .insert({
      id: message.id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      content: message.content,
      iv: message.iv,
      type: message.type,
      file_url: message.file_url,
      thumbnail: message.thumbnail,
      reply_to: message.reply_to,
      expires_at: expiresAt.toISOString(),
      created_at: new Date(message.created_at || Date.now()).toISOString()
    });

  if (error) throw error;

  // Mark as synced locally
  await db.messages.update(message.id, {
    synced_to_server: true,
    status: 'sent',
    updated_at: Date.now()
  });
}

// Fetch pending messages for this user
export async function fetchPendingMessages(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { data: messages, error } = await supabase
      .from('pending_messages')
      .select('*')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch pending messages:', error);
      return;
    }

    for (const msg of messages || []) {
      // Store locally
      await db.messages.put({
        id: msg.id,
        chat_id: msg.sender_id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        content: msg.content,
        iv: msg.iv,
        type: msg.type,
        file_url: msg.file_url,
        thumbnail: msg.thumbnail,
        reply_to: msg.reply_to,
        status: 'delivered',
        synced_to_server: true,
        deleted_from_server: false,
        created_at: new Date(msg.created_at).getTime(),
        updated_at: Date.now()
      });

      // Send delivery receipt
      await sendDeliveryReceipt(msg.id, msg.sender_id);

      // Delete from server (transitional storage)
      await deleteMessageFromServer({ messageId: msg.id });
    }
  } catch (error) {
    console.error('Error fetching pending messages:', error);
  }
}

// Send delivery receipt
async function sendDeliveryReceipt(messageId: string, senderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase
      .from('delivery_receipts')
      .upsert({
        message_id: messageId,
        receiver_id: user.id,
        sender_id: senderId,
        status: 'delivered',
        created_at: new Date().toISOString()
      }, { onConflict: 'message_id,receiver_id' });
  } catch (error) {
    console.error('Failed to send delivery receipt:', error);
  }
}

// Send read receipt
export async function sendReadReceipt(messageId: string, senderId: string): Promise<void> {
  await db.messages.update(messageId, { status: 'read', updated_at: Date.now() });

  if (isOnline) {
    await sendReadReceiptToServer({ messageId, senderId });
  } else {
    await addToSyncQueue({
      type: 'read_receipt',
      payload: JSON.stringify({ messageId, senderId }),
      priority: 5,
      retry_count: 0,
      max_retries: MAX_RETRIES
    });
  }
}

async function sendReadReceiptToServer(payload: { messageId: string; senderId: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('delivery_receipts')
    .upsert({
      message_id: payload.messageId,
      receiver_id: user.id,
      sender_id: payload.senderId,
      status: 'read',
      created_at: new Date().toISOString()
    }, { onConflict: 'message_id,receiver_id' });
}

async function updateMessageStatusOnServer(payload: { messageId: string; status: string; senderId: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('delivery_receipts')
    .upsert({
      message_id: payload.messageId,
      receiver_id: user.id,
      sender_id: payload.senderId,
      status: payload.status,
      created_at: new Date().toISOString()
    }, { onConflict: 'message_id,receiver_id' });
}

export async function sendReaction(messageId: string, emoji: string): Promise<void> {
  await addToSyncQueue({
    type: 'reaction',
    payload: JSON.stringify({ messageId, emoji }),
    priority: 5,
    retry_count: 0,
    max_retries: MAX_RETRIES
  });
  if (isOnline) syncPendingMessages();
}

async function sendReactionToServer(payload: { messageId: string; emoji: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('message_reactions')
    .upsert({
      message_id: payload.messageId,
      user_id: user.id,
      emoji: payload.emoji
    }, { onConflict: 'message_id,user_id' });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await addToSyncQueue({
    type: 'delete',
    payload: JSON.stringify({ messageId }),
    priority: 5,
    retry_count: 0,
    max_retries: MAX_RETRIES
  });
  if (isOnline) syncPendingMessages();
}

export async function deleteMessageFromServer(payload: { messageId: string }): Promise<void> {
  await supabase
    .from('pending_messages')
    .delete()
    .eq('id', payload.messageId);
}

export async function sendTypingStatus(chatId: string, isTyping: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const channel = supabase.channel(`typing:${chatId}`);
  await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      userId: user.id,
      isTyping
    }
  });
}

async function sendTypingIndicator(payload: { chatId: string; isTyping: boolean }): Promise<void> {
  await sendTypingStatus(payload.chatId, payload.isTyping);
}

// Subscribe to realtime updates
export function subscribeToRealtime(oderId: string, callbacks: {
  onMessage?: (msg: DBMessage) => void;
  onTyping?: (chatId: string, isTyping: boolean) => void;
  onStatusUpdate?: (messageId: string, status: string) => void;
  onFriendRequest?: (request: any) => void;
  onFriendChange?: (friend: any) => void;
  onPresenceUpdate?: (userId: string, status: any) => void;
}): () => void {
  const channel = supabase
    .channel(`user:${oderId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friend_requests',
      filter: `receiver_id=eq.${oderId}`
    }, (payload) => {
      callbacks.onFriendRequest?.(payload.new);
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friends',
      filter: `user_id=eq.${oderId}`
    }, (payload) => {
      callbacks.onFriendChange?.(payload.new);
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'pending_messages',
      filter: `receiver_id=eq.${oderId}`
    }, async (payload) => {
      const msg = payload.new as Record<string, unknown>;

      const localMsg: DBMessage = {
        id: msg.id as string,
        chat_id: msg.sender_id as string,
        sender_id: msg.sender_id as string,
        receiver_id: msg.receiver_id as string,
        content: msg.content as string,
        iv: msg.iv as string,
        type: msg.type as DBMessage['type'],
        file_url: msg.file_url as string | undefined,
        thumbnail: msg.thumbnail as string | undefined,
        reply_to: msg.reply_to as string | undefined,
        status: 'delivered',
        synced_to_server: true,
        deleted_from_server: false,
        created_at: new Date(msg.created_at as string).getTime(),
        updated_at: Date.now()
      };

      await db.messages.put(localMsg);
      callbacks.onMessage?.(localMsg);

      // Transport-only media: download media to local storage, then delete from Supabase Storage
      if (localMsg.file_url && ['image', 'video', 'audio', 'document', 'voice', 'file'].includes(localMsg.type)) {
        try {
          const marker = '/storage/v1/object/public/chat-media/';
          if (localMsg.file_url.includes(marker)) {
            const path = localMsg.file_url.split(marker)[1];
            const res = await fetch(localMsg.file_url);
            const blob = await res.blob();

            const ext = localMsg.type === 'image' ? 'jpg'
              : localMsg.type === 'video' ? 'mp4'
                : localMsg.type === 'voice' || localMsg.type === 'audio' ? 'webm'
                  : 'bin';

            const file = new File([blob], `ourdm_${localMsg.id}.${ext}`, { type: blob.type || 'application/octet-stream' });
            const media = await processAndStoreMedia(file, localMsg.id);

            if (media.local_path) {
              await db.messages.update(localMsg.id, {
                file_url: media.local_path,
                local_file_id: media.id,
                updated_at: Date.now()
              });
            }

            if (path) {
              await supabase.storage.from('chat-media').remove([path]);
            }
          }
        } catch (e) {
          console.warn('Transport media auto-cache/delete failed:', e);
        }
      }

      // Send delivery receipt and delete from server
      await sendDeliveryReceipt(msg.id as string, msg.sender_id as string);
      await deleteMessageFromServer({ messageId: msg.id as string });
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'delivery_receipts',
      filter: `sender_id=eq.${oderId}`
    }, async (payload) => {
      const receipt = payload.new as Record<string, unknown>;
      await db.messages.update(receipt.message_id as string, {
        status: receipt.status as DBMessage['status'],
        updated_at: Date.now()
      });
      callbacks.onStatusUpdate?.(receipt.message_id as string, receipt.status as string);
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// Register for background sync
export async function registerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-expect-error - sync is not in standard types
      await registration.sync?.register('sync-messages');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
}

// Check if online
export function getIsOnline(): boolean {
  return isOnline;
}

// Force sync
export async function forceSync(): Promise<void> {
  if (!isOnline) {
    throw new Error('Cannot sync while offline');
  }
  await syncPendingMessages();
  await fetchPendingMessages();
}
