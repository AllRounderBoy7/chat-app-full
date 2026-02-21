// Complete Message Service - Common, Advanced, Important Features
import { db, DBMessage, updateMessage, deleteMessage } from '../lib/database';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// ==================== COMMON FEATURES ====================

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice' | 'location' | 'contact' | 'sticker' | 'system' | 'poll' | 'file';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'scheduled';
  created_at: number;
  // Common
  reply_to?: {
    id: string;
    content: string;
    senderName: string;
    type: string;
  };
  forwarded_from?: string;
  // Advanced
  reactions?: Record<string, string[]>; // emoji -> userIds
  is_edited?: boolean;
  edited_at?: number;
  is_deleted?: boolean;
  deleted_for_everyone?: boolean;
  // Important
  is_starred?: boolean;
  is_pinned?: boolean;
  is_scheduled?: boolean;
  scheduled_for?: number;
  expires_at?: number; // For disappearing messages
  // Media
  file_url?: string;
  thumbnail?: string;
  file_name?: string;
  file_size?: number;
  duration?: number; // For audio/video
  // Location
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  // Contact
  contact?: {
    name: string;
    phone: string;
    email?: string;
  };
}

class MessageServiceClass {
  // ==================== COMMON FEATURES ====================

  // Send text message
  async sendMessage(
    chat_id: string,
    sender_id: string,
    receiver_id: string,
    content: string,
    type: Message['type'] = 'text',
    options?: Partial<Message>
  ): Promise<Message> {
    const now = Date.now();
    const message: Message = {
      id: uuidv4(),
      chat_id,
      sender_id,
      receiver_id,
      content,
      type,
      status: 'pending',
      created_at: now,
      reactions: {},
      ...options,
    };

    // Save to local DB (Optimistic UI)
    const dbMessage: DBMessage = {
      id: message.id,
      chat_id: message.chat_id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      content: message.content,
      iv: '',
      type: message.type as DBMessage['type'],
      file_url: message.file_url,
      thumbnail: message.thumbnail,
      reply_to: message.reply_to ? JSON.stringify(message.reply_to) : undefined,
      forwarded_from: message.forwarded_from,
      status: message.status,
      reactions: message.reactions,
      is_deleted: message.is_deleted,
      deleted_for_everyone: message.deleted_for_everyone,
      edited_at: message.edited_at,
      expires_at: message.expires_at,
      synced_to_server: false,
      deleted_from_server: false,
      created_at: message.created_at,
      updated_at: now,
    };

    await db.messages.add(dbMessage);

    // Send to server
    try {
      await supabase.from('pending_messages').insert({
        id: message.id,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: message.content,
        type: message.type,
        reply_to: message.reply_to,
        forwarded_from: message.forwarded_from,
        file_url: message.file_url,
        thumbnail: message.thumbnail,
        scheduled_for: message.scheduled_for ? new Date(message.scheduled_for).toISOString() : null,
        expires_at: message.expires_at ? new Date(message.expires_at).toISOString() : null,
      });

      message.status = 'sent';
      await updateMessage(message.id, { status: 'sent', synced_to_server: true });
    } catch (error) {
      console.error('Error sending message:', error);
    }

    return message;
  }

  // Reply to message
  async replyToMessage(
    chat_id: string,
    sender_id: string,
    receiver_id: string,
    content: string,
    replyToMessage: Message
  ): Promise<Message> {
    return this.sendMessage(chat_id, sender_id, receiver_id, content, 'text', {
      reply_to: {
        id: replyToMessage.id,
        content: replyToMessage.content.substring(0, 100),
        senderName: replyToMessage.sender_id, // Would be actual name
        type: replyToMessage.type,
      },
    });
  }

  // Forward message
  async forwardMessage(
    message: Message,
    new_chat_id: string,
    new_receiver_id: string,
    sender_id: string
  ): Promise<Message> {
    return this.sendMessage(
      new_chat_id,
      sender_id,
      new_receiver_id,
      message.content,
      message.type,
      {
        file_url: message.file_url,
        thumbnail: message.thumbnail,
        location: message.location,
        contact: message.contact,
        forwarded_from: message.sender_id,
      }
    );
  }

  // Get messages for chat
  async getMessages(chat_id: string, limit = 50, before?: number): Promise<Message[]> {
    let query = db.messages.where('chat_id').equals(chat_id);

    const messages = await query
      .reverse()
      .limit(limit)
      .toArray();

    // Apply filters
    const filtered = messages.filter(m => {
      if (m.is_deleted && !m.deleted_for_everyone) return true; // Show for self only
      if (before && (m.created_at ?? 0) >= before) return false;
      return true;
    });

    return filtered.reverse().map(this.dbToMessage);
  }

  // Search messages
  async searchMessages(chat_id: string, query: string): Promise<Message[]> {
    const messages = await db.messages
      .where('chat_id')
      .equals(chat_id)
      .toArray();

    const filtered = messages.filter(m =>
      !(m.is_deleted ?? false) &&
      m.content.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map(this.dbToMessage);
  }

  // ==================== ADVANCED FEATURES ====================

  // Add reaction
  async addReaction(messageId: string, order_id: string, emoji: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    const reactions = message.reactions || {};

    // Remove existing reaction from this user
    for (const e in reactions) {
      const idx = reactions[e].indexOf(order_id);
      if (idx > -1) {
        reactions[e].splice(idx, 1);
        if (reactions[e].length === 0) delete reactions[e];
      }
    }

    // Add new reaction
    if (!reactions[emoji]) reactions[emoji] = [];
    if (!reactions[emoji].includes(order_id)) {
      reactions[emoji].push(order_id);
    }

    await updateMessage(messageId, { reactions });

    // Sync to server
    await supabase.from('message_reactions').upsert({
      message_id: messageId,
      user_id: order_id,
      emoji,
    });
  }

  // Remove reaction
  async removeReaction(messageId: string, order_id: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    const reactions = message.reactions || {};

    for (const emoji in reactions) {
      const idx = reactions[emoji].indexOf(order_id);
      if (idx > -1) {
        reactions[emoji].splice(idx, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }
    }

    await updateMessage(messageId, { reactions });

    await supabase.from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', order_id);
  }

  // Edit message
  async editMessage(messageId: string, order_id: string, newContent: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');
    if (message.sender_id !== order_id) throw new Error('Cannot edit others messages');
    if (message.type !== 'text') throw new Error('Can only edit text messages');

    // Check if within edit window (15 minutes)
    const editWindow = 15 * 60 * 1000;
    if (Date.now() - (message.created_at as number) > editWindow) {
      throw new Error('Edit window expired');
    }

    await updateMessage(messageId, {
      content: newContent,
      edited_at: Date.now(),
    });

    await supabase.from('pending_messages')
      .update({
        content: newContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);
  }

  // Delete message (for me or everyone)
  async deleteMessageAction(
    messageId: string,
    order_id: string,
    deleteFor: 'me' | 'everyone'
  ): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    if (deleteFor === 'everyone') {
      if (message.sender_id !== order_id) {
        throw new Error('Can only delete your own messages for everyone');
      }

      // Check if within delete window (1 hour)
      const deleteWindow = 60 * 60 * 1000;
      if (Date.now() - (message.created_at || 0) > deleteWindow) {
        throw new Error('Delete window expired');
      }

      await deleteMessage(messageId, true);

      await supabase.from('pending_messages')
        .update({
          is_deleted: true,
          content: 'This message was deleted',
        })
        .eq('id', messageId);
    } else {
      await deleteMessage(messageId, false);
    }
  }

  // ==================== IMPORTANT FEATURES ====================

  // Star message
  async starMessage(messageId: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    // We need to add isStarred to DBMessage or use settings
    // For now, we'll use a separate storage
    const starred = await this.getStarredMessageIds();
    if (!starred.includes(messageId)) {
      starred.push(messageId);
      localStorage.setItem('starred_messages', JSON.stringify(starred));
    }
  }

  // Unstar message
  async unstarMessage(messageId: string): Promise<void> {
    const starred = await this.getStarredMessageIds();
    const filtered = starred.filter(id => id !== messageId);
    localStorage.setItem('starred_messages', JSON.stringify(filtered));
  }

  // Get starred message IDs
  async getStarredMessageIds(): Promise<string[]> {
    const stored = localStorage.getItem('starred_messages');
    return stored ? JSON.parse(stored) : [];
  }

  // Get starred messages
  async getStarredMessages(): Promise<Message[]> {
    const starredIds = await this.getStarredMessageIds();
    const messages: Message[] = [];

    for (const id of starredIds) {
      const msg = await db.messages.get(id);
      if (msg && !msg.is_deleted) {
        const message = this.dbToMessage(msg);
        message.is_starred = true;
        messages.push(message);
      }
    }

    return messages;
  }

  // Pin message
  async pinMessage(chat_id: string, messageId: string): Promise<void> {
    const pinned = this.getPinnedMessageIds(chat_id);
    if (!pinned.includes(messageId) && pinned.length < 3) {
      pinned.push(messageId);
      localStorage.setItem(`pinned_messages_${chat_id}`, JSON.stringify(pinned));
    }
  }

  // Unpin message
  async unpinMessage(chat_id: string, messageId: string): Promise<void> {
    const pinned = this.getPinnedMessageIds(chat_id);
    const filtered = pinned.filter(id => id !== messageId);
    localStorage.setItem(`pinned_messages_${chat_id}`, JSON.stringify(filtered));
  }

  // Get pinned message IDs
  getPinnedMessageIds(chat_id: string): string[] {
    const stored = localStorage.getItem(`pinned_messages_${chat_id}`);
    return stored ? JSON.parse(stored) : [];
  }

  // Get pinned messages
  async getPinnedMessages(chat_id: string): Promise<Message[]> {
    const pinnedIds = this.getPinnedMessageIds(chat_id);
    const messages: Message[] = [];

    for (const id of pinnedIds) {
      const msg = await db.messages.get(id);
      if (msg && !(msg.is_deleted ?? false)) {
        const message = this.dbToMessage(msg);
        message.is_pinned = true;
        messages.push(message);
      }
    }
    return messages;
  }

  // Schedule message
  async scheduleMessage(
    chat_id: string,
    sender_id: string,
    receiver_id: string,
    content: string,
    scheduled_for: number
  ): Promise<Message> {
    return this.sendMessage(chat_id, sender_id, receiver_id, content, 'text', {
      is_scheduled: true,
      scheduled_for,
      status: 'pending',
    });
  }

  // Set disappearing messages
  async setDisappearingMessages(chat_id: string, duration: number | null): Promise<void> {
    localStorage.setItem(`disappearing_${chat_id}`, duration ? duration.toString() : '');
  }

  // Get disappearing duration
  getDisappearingDuration(chat_id: string): number | null {
    const stored = localStorage.getItem(`disappearing_${chat_id}`);
    return stored ? parseInt(stored) : null;
  }

  // Clear chat
  async clearChat(chat_id: string, deleteForEveryone = false): Promise<void> {
    if (deleteForEveryone) {
      const messages = await db.messages.where('chat_id').equals(chat_id).toArray();
      for (const msg of messages) {
        await this.deleteMessageAction(msg.id, msg.sender_id, 'everyone');
      }
    } else {
      await db.messages.where('chat_id').equals(chat_id).delete();
    }
  }

  // Export chat
  async exportChat(chat_id: string): Promise<string> {
    const messages = await this.getMessages(chat_id, 10000);
    let text = '';

    for (const msg of messages) {
      const date = new Date(msg.created_at).toLocaleString();
      const sender = msg.sender_id; // Would be actual name
      text += `[${date}] ${sender}: ${msg.content}\n`;
    }

    return text;
  }

  // ==================== STATUS UPDATES ====================

  // Mark as delivered
  async markAsDelivered(messageIds: string[]): Promise<void> {
    for (const id of messageIds) {
      await updateMessage(id, { status: 'delivered' });
    }

    // Notify sender via realtime
    await supabase.from('delivery_receipts').insert(
      messageIds.map(id => ({
        id: uuidv4(),
        message_id: id,
        status: 'delivered',
      }))
    );
  }

  // Mark as read
  async markAsRead(chat_id: string, order_id: string): Promise<void> {
    const messages = await db.messages
      .where('chat_id')
      .equals(chat_id)
      .filter(m => m.sender_id !== order_id && m.status !== 'read')
      .toArray();

    for (const msg of messages) {
      await updateMessage(msg.id, { status: 'read' });
    }

    // Sync to server
    await supabase.from('pending_messages')
      .update({ status: 'read' })
      .eq('chat_id', chat_id)
      .neq('sender_id', order_id);

    // If messages were marked as read, delete them from pending_messages and insert receipts
    if (messages.length > 0) {
      // 1. Delete from pending_messages Table (Supabase)
      await supabase.from('pending_messages')
        .delete()
        .in('id', messages.map(m => m.id));

      // 2. Insert receipt (transient)
      await supabase.from('delivery_receipts').insert(
        messages.map(m => ({
          id: uuidv4(),
          message_id: m.id,
          status: 'read',
        }))
      );
    }
  }

  // ==================== MEDIA MESSAGES ====================

  // Send voice message
  async sendVoiceMessage(
    chat_id: string,
    sender_id: string,
    receiver_id: string,
    audioBlob: Blob,
    duration: number
  ): Promise<Message> {
    // Upload audio
    const fileName = `voice_${Date.now()}.webm`;
    const { data: uploadData } = await supabase.storage
      .from('chat-media')
      .upload(`voice/${sender_id}/${fileName}`, audioBlob);

    const fileUrl = uploadData?.path
      ? supabase.storage.from('chat-media').getPublicUrl(uploadData.path).data.publicUrl
      : '';

    return this.sendMessage(chat_id, sender_id, receiver_id, '🎤 Voice message', 'voice', {
      file_url: fileUrl,
      duration,
    });
  }

  // Send location
  async sendLocation(
    chat_id: string,
    sender_id: string,
    receiver_id: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<Message> {
    return this.sendMessage(chat_id, sender_id, receiver_id, '📍 Location', 'location', {
      location: { latitude, longitude, name, address },
    });
  }

  // Send contact
  async sendContact(
    chat_id: string,
    sender_id: string,
    receiver_id: string,
    contactName: string,
    contactPhone: string,
    contactEmail?: string
  ): Promise<Message> {
    return this.sendMessage(chat_id, sender_id, receiver_id, `👤 ${contactName}`, 'contact', {
      contact: { name: contactName, phone: contactPhone, email: contactEmail },
    });
  }

  // ==================== HELPERS ====================

  private dbToMessage(dbMsg: DBMessage): Message {
    return {
      id: dbMsg.id,
      chat_id: dbMsg.chat_id,
      sender_id: dbMsg.sender_id,
      receiver_id: dbMsg.receiver_id || '',
      content: dbMsg.content,
      type: dbMsg.type,
      status: dbMsg.status,
      created_at: dbMsg.created_at || Date.now(),
      reply_to: dbMsg.reply_to ? JSON.parse(dbMsg.reply_to) : undefined,
      forwarded_from: dbMsg.forwarded_from,
      reactions: dbMsg.reactions,
      is_edited: !!dbMsg.edited_at,
      edited_at: dbMsg.edited_at,
      is_deleted: dbMsg.is_deleted,
      deleted_for_everyone: dbMsg.deleted_for_everyone,
      file_url: dbMsg.file_url,
      thumbnail: dbMsg.thumbnail,
      expires_at: dbMsg.expires_at,
    };
  }

  // ==================== STORAGE OPTIMIZATION ====================

  // Auto-cleanup media from Supabase Storage to stay under 0.5GB limit
  async cleanupServerStorage(): Promise<void> {
    try {
      // 1. Delete expired stories media (handled in StoryService, but we can double check)

      // 2. Delete delivered/old message media from server (keep local copy only)
      const { data: oldMedia } = await supabase
        .from('pending_messages')
        .select('id, file_url')
        .not('file_url', 'is', null)
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // 24h old

      if (oldMedia && oldMedia.length > 0) {
        for (const item of oldMedia) {
          if (item.file_url) {
            // Extract path from URL
            const url = new URL(item.file_url);
            const path = url.pathname.split('/storage/v1/object/public/chat-media/')[1];
            if (path) {
              await supabase.storage.from('chat-media').remove([path]);
              // Clear URL from DB to save space and mark as "Server Cleared"
              await supabase.from('pending_messages').update({ file_url: null }).eq('id', item.id);
            }
          }
        }
        console.log(`🧹 Storage Cleanup: Removed ${oldMedia.length} old media files from server.`);
      }
    } catch (error) {
      console.error('Storage cleanup failed:', error);
    }
  }
}

export const MessageService = new MessageServiceClass();
