// Complete Message Service - Common, Advanced, Important Features
import { db, DBMessage, updateMessage, deleteMessage } from '../lib/database';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// ==================== COMMON FEATURES ====================

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice' | 'location' | 'contact' | 'sticker';
  status: 'pending' | 'sent' | 'delivered' | 'read';
  createdAt: number;
  // Common
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
    type: string;
  };
  forwardedFrom?: string;
  // Advanced
  reactions?: Record<string, string[]>; // emoji -> userIds
  isEdited?: boolean;
  editedAt?: number;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  // Important
  isStarred?: boolean;
  isPinned?: boolean;
  isScheduled?: boolean;
  scheduledFor?: number;
  expiresAt?: number; // For disappearing messages
  // Media
  fileUrl?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
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
    chatId: string,
    senderId: string,
    receiverId: string,
    content: string,
    type: Message['type'] = 'text',
    options?: Partial<Message>
  ): Promise<Message> {
    const now = Date.now();
    const message: Message = {
      id: uuidv4(),
      chatId,
      senderId,
      receiverId,
      content,
      type,
      status: 'pending',
      createdAt: now,
      reactions: {},
      ...options,
    };

    // Save to local DB (Optimistic UI)
    const dbMessage: DBMessage = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      iv: '', // Would be encryption IV in real implementation
      type: message.type as DBMessage['type'],
      fileUrl: message.fileUrl,
      thumbnail: message.thumbnail,
      replyTo: message.replyTo ? JSON.stringify(message.replyTo) : undefined,
      forwardedFrom: message.forwardedFrom,
      status: message.status,
      reactions: message.reactions,
      isDeleted: message.isDeleted,
      deletedForEveryone: message.deletedForEveryone,
      editedAt: message.editedAt,
      expiresAt: message.expiresAt,
      syncedToServer: false,
      deletedFromServer: false,
      createdAt: message.createdAt,
      updatedAt: now,
    };

    await db.messages.add(dbMessage);

    // Send to server
    try {
      await supabase.from('pending_messages').insert({
        id: message.id,
        sender_id: message.senderId,
        receiver_id: message.receiverId,
        content: message.content,
        type: message.type,
        reply_to: message.replyTo,
        forwarded_from: message.forwardedFrom,
        file_url: message.fileUrl,
        thumbnail: message.thumbnail,
        scheduled_for: message.scheduledFor ? new Date(message.scheduledFor).toISOString() : null,
        expires_at: message.expiresAt ? new Date(message.expiresAt).toISOString() : null,
      });

      message.status = 'sent';
      await updateMessage(message.id, { status: 'sent', syncedToServer: true });
    } catch (error) {
      console.error('Error sending message:', error);
    }

    return message;
  }

  // Reply to message
  async replyToMessage(
    chatId: string,
    senderId: string,
    receiverId: string,
    content: string,
    replyToMessage: Message
  ): Promise<Message> {
    return this.sendMessage(chatId, senderId, receiverId, content, 'text', {
      replyTo: {
        id: replyToMessage.id,
        content: replyToMessage.content.substring(0, 100),
        senderName: replyToMessage.senderId, // Would be actual name
        type: replyToMessage.type,
      },
    });
  }

  // Forward message
  async forwardMessage(
    message: Message,
    newChatId: string,
    newReceiverId: string,
    senderId: string
  ): Promise<Message> {
    return this.sendMessage(
      newChatId,
      senderId,
      newReceiverId,
      message.content,
      message.type,
      {
        fileUrl: message.fileUrl,
        thumbnail: message.thumbnail,
        location: message.location,
        contact: message.contact,
        forwardedFrom: message.senderId,
      }
    );
  }

  // Get messages for chat
  async getMessages(chatId: string, limit = 50, before?: number): Promise<Message[]> {
    let query = db.messages.where('chatId').equals(chatId);

    const messages = await query
      .reverse()
      .limit(limit)
      .toArray();

    // Apply filters
    const filtered = messages.filter(m => {
      if (m.isDeleted && !m.deletedForEveryone) return true; // Show for self only
      if (before && m.createdAt >= before) return false;
      return true;
    });

    return filtered.reverse().map(this.dbToMessage);
  }

  // Search messages
  async searchMessages(chatId: string, query: string): Promise<Message[]> {
    const messages = await db.messages
      .where('chatId')
      .equals(chatId)
      .toArray();

    const filtered = messages.filter(m =>
      !m.isDeleted &&
      m.content.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map(this.dbToMessage);
  }

  // ==================== ADVANCED FEATURES ====================

  // Add reaction
  async addReaction(messageId: string, oderId: string, emoji: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    const reactions = message.reactions || {};
    
    // Remove existing reaction from this user
    for (const e in reactions) {
      const idx = reactions[e].indexOf(oderId);
      if (idx > -1) {
        reactions[e].splice(idx, 1);
        if (reactions[e].length === 0) delete reactions[e];
      }
    }

    // Add new reaction
    if (!reactions[emoji]) reactions[emoji] = [];
    if (!reactions[emoji].includes(oderId)) {
      reactions[emoji].push(oderId);
    }

    await updateMessage(messageId, { reactions });

    // Sync to server
    await supabase.from('message_reactions').upsert({
      message_id: messageId,
      user_id: oderId,
      emoji,
    });
  }

  // Remove reaction
  async removeReaction(messageId: string, oderId: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    const reactions = message.reactions || {};
    
    for (const emoji in reactions) {
      const idx = reactions[emoji].indexOf(oderId);
      if (idx > -1) {
        reactions[emoji].splice(idx, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }
    }

    await updateMessage(messageId, { reactions });

    await supabase.from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', oderId);
  }

  // Edit message
  async editMessage(messageId: string, oderId: string, newContent: string): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');
    if (message.senderId !== oderId) throw new Error('Cannot edit others messages');
    if (message.type !== 'text') throw new Error('Can only edit text messages');

    // Check if within edit window (15 minutes)
    const editWindow = 15 * 60 * 1000;
    if (Date.now() - message.createdAt > editWindow) {
      throw new Error('Edit window expired');
    }

    await updateMessage(messageId, {
      content: newContent,
      editedAt: Date.now(),
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
    oderId: string,
    deleteFor: 'me' | 'everyone'
  ): Promise<void> {
    const message = await db.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    if (deleteFor === 'everyone') {
      if (message.senderId !== oderId) {
        throw new Error('Can only delete your own messages for everyone');
      }
      
      // Check if within delete window (1 hour)
      const deleteWindow = 60 * 60 * 1000;
      if (Date.now() - message.createdAt > deleteWindow) {
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
      if (msg && !msg.isDeleted) {
        const message = this.dbToMessage(msg);
        message.isStarred = true;
        messages.push(message);
      }
    }

    return messages;
  }

  // Pin message
  async pinMessage(chatId: string, messageId: string): Promise<void> {
    const pinned = this.getPinnedMessageIds(chatId);
    if (!pinned.includes(messageId) && pinned.length < 3) {
      pinned.push(messageId);
      localStorage.setItem(`pinned_messages_${chatId}`, JSON.stringify(pinned));
    }
  }

  // Unpin message
  async unpinMessage(chatId: string, messageId: string): Promise<void> {
    const pinned = this.getPinnedMessageIds(chatId);
    const filtered = pinned.filter(id => id !== messageId);
    localStorage.setItem(`pinned_messages_${chatId}`, JSON.stringify(filtered));
  }

  // Get pinned message IDs
  getPinnedMessageIds(chatId: string): string[] {
    const stored = localStorage.getItem(`pinned_messages_${chatId}`);
    return stored ? JSON.parse(stored) : [];
  }

  // Get pinned messages
  async getPinnedMessages(chatId: string): Promise<Message[]> {
    const pinnedIds = this.getPinnedMessageIds(chatId);
    const messages: Message[] = [];

    for (const id of pinnedIds) {
      const msg = await db.messages.get(id);
      if (msg && !msg.isDeleted) {
        const message = this.dbToMessage(msg);
        message.isPinned = true;
        messages.push(message);
      }
    }

    return messages;
  }

  // Schedule message
  async scheduleMessage(
    chatId: string,
    senderId: string,
    receiverId: string,
    content: string,
    scheduledFor: number
  ): Promise<Message> {
    return this.sendMessage(chatId, senderId, receiverId, content, 'text', {
      isScheduled: true,
      scheduledFor,
      status: 'pending',
    });
  }

  // Set disappearing messages
  async setDisappearingMessages(chatId: string, duration: number | null): Promise<void> {
    localStorage.setItem(`disappearing_${chatId}`, duration ? duration.toString() : '');
  }

  // Get disappearing duration
  getDisappearingDuration(chatId: string): number | null {
    const stored = localStorage.getItem(`disappearing_${chatId}`);
    return stored ? parseInt(stored) : null;
  }

  // Clear chat
  async clearChat(chatId: string, deleteForEveryone = false): Promise<void> {
    if (deleteForEveryone) {
      const messages = await db.messages.where('chatId').equals(chatId).toArray();
      for (const msg of messages) {
        await deleteMessage(msg.id, true);
      }
    } else {
      await db.messages.where('chatId').equals(chatId).delete();
    }
  }

  // Export chat
  async exportChat(chatId: string): Promise<string> {
    const messages = await this.getMessages(chatId, 10000);
    let text = '';

    for (const msg of messages) {
      const date = new Date(msg.createdAt).toLocaleString();
      const sender = msg.senderId; // Would be actual name
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
  async markAsRead(chatId: string, oderId: string): Promise<void> {
    const messages = await db.messages
      .where('chatId')
      .equals(chatId)
      .and(m => m.receiverId === oderId && m.status !== 'read')
      .toArray();

    for (const msg of messages) {
      await updateMessage(msg.id, { status: 'read' });
    }

    // Notify sender
    if (messages.length > 0) {
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
    chatId: string,
    senderId: string,
    receiverId: string,
    audioBlob: Blob,
    duration: number
  ): Promise<Message> {
    // Upload audio
    const fileName = `voice_${Date.now()}.webm`;
    const { data: uploadData } = await supabase.storage
      .from('media')
      .upload(`voice/${senderId}/${fileName}`, audioBlob);

    const fileUrl = uploadData?.path 
      ? supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl
      : '';

    return this.sendMessage(chatId, senderId, receiverId, '🎤 Voice message', 'voice', {
      fileUrl,
      duration,
    });
  }

  // Send location
  async sendLocation(
    chatId: string,
    senderId: string,
    receiverId: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<Message> {
    return this.sendMessage(chatId, senderId, receiverId, '📍 Location', 'location', {
      location: { latitude, longitude, name, address },
    });
  }

  // Send contact
  async sendContact(
    chatId: string,
    senderId: string,
    receiverId: string,
    contactName: string,
    contactPhone: string,
    contactEmail?: string
  ): Promise<Message> {
    return this.sendMessage(chatId, senderId, receiverId, `👤 ${contactName}`, 'contact', {
      contact: { name: contactName, phone: contactPhone, email: contactEmail },
    });
  }

  // ==================== HELPERS ====================

  private dbToMessage(dbMsg: DBMessage): Message {
    return {
      id: dbMsg.id,
      chatId: dbMsg.chatId,
      senderId: dbMsg.senderId,
      receiverId: dbMsg.receiverId,
      content: dbMsg.content,
      type: dbMsg.type,
      status: dbMsg.status,
      createdAt: dbMsg.createdAt,
      replyTo: dbMsg.replyTo ? JSON.parse(dbMsg.replyTo) : undefined,
      forwardedFrom: dbMsg.forwardedFrom,
      reactions: dbMsg.reactions,
      isEdited: !!dbMsg.editedAt,
      editedAt: dbMsg.editedAt,
      isDeleted: dbMsg.isDeleted,
      deletedForEveryone: dbMsg.deletedForEveryone,
      fileUrl: dbMsg.fileUrl,
      thumbnail: dbMsg.thumbnail,
      expiresAt: dbMsg.expiresAt,
    };
  }
}

export const MessageService = new MessageServiceClass();
