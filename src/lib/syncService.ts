// Sync Service - Handles transitional cloud storage like WhatsApp
import { supabase } from './supabase';
import { db, addToSyncQueue, getPendingSyncItems, removeSyncItem, updateSyncItem, type DBMessage, type DBSyncQueue } from './database';

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
    syncedToServer: false,
    deletedFromServer: false
  });
  
  // Update chat preview
  const existingChat = await db.chats.get(message.chatId);
  if (existingChat) {
    await db.chats.update(message.chatId, {
      lastMessageId: message.id,
      lastMessagePreview: message.type === 'text' ? '[Encrypted]' : `[${message.type}]`,
      lastMessageTime: message.createdAt,
      updatedAt: Date.now()
    });
  }
  
  // Add to sync queue
  await addToSyncQueue({
    type: 'message',
    payload: JSON.stringify(message),
    priority: 10,
    retryCount: 0,
    maxRetries: MAX_RETRIES
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
          retryCount: item.retryCount + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Remove if too many retries
        if (item.retryCount >= item.maxRetries - 1) {
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
      sender_id: message.senderId,
      receiver_id: message.receiverId,
      content: message.content,
      iv: message.iv,
      type: message.type,
      file_url: message.fileUrl,
      thumbnail: message.thumbnail,
      reply_to: message.replyTo,
      expires_at: expiresAt.toISOString(),
      created_at: new Date(message.createdAt).toISOString()
    });
  
  if (error) throw error;
  
  // Mark as synced locally
  await db.messages.update(message.id, {
    syncedToServer: true,
    status: 'sent',
    updatedAt: Date.now()
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
        chatId: msg.sender_id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        content: msg.content,
        iv: msg.iv,
        type: msg.type,
        fileUrl: msg.file_url,
        thumbnail: msg.thumbnail,
        replyTo: msg.reply_to,
        status: 'delivered',
        syncedToServer: true,
        deletedFromServer: false,
        createdAt: new Date(msg.created_at).getTime(),
        updatedAt: Date.now()
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
  await db.messages.update(messageId, { status: 'read', updatedAt: Date.now() });
  
  if (isOnline) {
    await sendReadReceiptToServer({ messageId, senderId });
  } else {
    await addToSyncQueue({
      type: 'read_receipt',
      payload: JSON.stringify({ messageId, senderId }),
      priority: 5,
      retryCount: 0,
      maxRetries: MAX_RETRIES
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

async function deleteMessageFromServer(payload: { messageId: string }): Promise<void> {
  await supabase
    .from('pending_messages')
    .delete()
    .eq('id', payload.messageId);
}

async function sendTypingIndicator(payload: { chatId: string; isTyping: boolean }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const channel = supabase.channel(`typing:${payload.chatId}`);
  await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      oderId: user.id,
      isTyping: payload.isTyping
    }
  });
}

// Subscribe to realtime updates
export function subscribeToRealtime(oderId: string, callbacks: {
  onMessage?: (msg: DBMessage) => void;
  onTyping?: (chatId: string, isTyping: boolean) => void;
  onStatusUpdate?: (messageId: string, status: string) => void;
}): () => void {
  const channel = supabase
    .channel(`user:${oderId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'pending_messages',
      filter: `receiver_id=eq.${oderId}`
    }, async (payload) => {
      const msg = payload.new as Record<string, unknown>;
      
      const localMsg: DBMessage = {
        id: msg.id as string,
        chatId: msg.sender_id as string,
        senderId: msg.sender_id as string,
        receiverId: msg.receiver_id as string,
        content: msg.content as string,
        iv: msg.iv as string,
        type: msg.type as DBMessage['type'],
        fileUrl: msg.file_url as string | undefined,
        thumbnail: msg.thumbnail as string | undefined,
        replyTo: msg.reply_to as string | undefined,
        status: 'delivered',
        syncedToServer: true,
        deletedFromServer: false,
        createdAt: new Date(msg.created_at as string).getTime(),
        updatedAt: Date.now()
      };
      
      await db.messages.put(localMsg);
      callbacks.onMessage?.(localMsg);
      
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
        updatedAt: Date.now()
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
