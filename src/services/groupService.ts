// ============================================
// OURDM v3.0.0 - Group Chat Service
// Complete WhatsApp-like Group Management
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { db, LocalChat } from './database';
import { supabase } from './supabase';

// Default group settings
interface GroupSettingsType {
  onlyAdminsCanSend: boolean;
  onlyAdminsCanAddMembers: boolean;
  onlyAdminsCanEditInfo: boolean;
  approvalRequired: boolean;
  maxMembers: number;
  linkSharingEnabled: boolean;
}

const DEFAULT_GROUP_SETTINGS: GroupSettingsType = {
  onlyAdminsCanSend: false,
  onlyAdminsCanAddMembers: false,
  onlyAdminsCanEditInfo: true,
  approvalRequired: false,
  maxMembers: 256,
  linkSharingEnabled: true,
};

// ============================================
// GROUP CREATION
// ============================================

export async function createGroup(
  creatorId: string,
  name: string,
  description: string,
  icon: string | undefined,
  initialMembers: string[]
): Promise<LocalChat> {
  const groupId = uuidv4();
  const now = new Date();
  
  // Include creator in members
  const allMembers = [creatorId, ...initialMembers.filter((id: string) => id !== creatorId)];
  
  const group: LocalChat = {
    id: groupId,
    type: 'group',
    recipientId: creatorId,
    recipientName: name,
    recipientAvatar: icon,
    description,
    participants: allMembers,
    admins: [creatorId],
    lastMessage: 'Group created',
    lastMessageTime: now.toISOString(),
    unread: 0,
    isOnline: false,
    isPinned: false,
    isMuted: false,
    isArchived: false,
    isLocked: false,
    isHidden: false,
    disappearingMessages: 0,
    groupSettings: { ...DEFAULT_GROUP_SETTINGS },
    inviteLink: generateInviteLink(groupId),
  };
  
  // Save to local database
  await db.chats.add(group);
  
  // Create system message
  await db.messages.add({
    id: uuidv4(),
    chatId: groupId,
    senderId: 'system',
    content: `Group "${name}" created`,
    type: 'system',
    status: 'sent',
    timestamp: now.toISOString(),
    isSystem: true,
  });
  
  // Sync to Supabase
  try {
    await supabase.from('groups').insert({
      id: groupId,
      name,
      description,
      icon,
      created_by: creatorId,
      members: allMembers,
      admins: [creatorId],
      settings: group.groupSettings,
      invite_link: group.inviteLink,
      created_at: now.toISOString(),
    });
  } catch (error) {
    console.error('Failed to sync group to Supabase:', error);
  }
  
  return group;
}

// ============================================
// GROUP MANAGEMENT
// ============================================

export async function addMembersToGroup(
  groupId: string,
  adminId: string,
  newMembers: string[]
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  const settings = (chat.groupSettings as unknown as GroupSettingsType) || DEFAULT_GROUP_SETTINGS;
  
  if (settings.onlyAdminsCanAddMembers && !admins.includes(adminId)) {
    return { success: false, message: 'Only admins can add members' };
  }
  
  const currentMembers = chat.participants || [];
  if (currentMembers.length + newMembers.length > settings.maxMembers) {
    return { success: false, message: `Group can have maximum ${settings.maxMembers} members` };
  }
  
  const updatedMembers = [...new Set([...currentMembers, ...newMembers])];
  
  await db.chats.update(groupId, {
    participants: updatedMembers,
  });
  
  // Create system messages
  const now = new Date();
  for (const memberId of newMembers) {
    await db.messages.add({
      id: uuidv4(),
      chatId: groupId,
      senderId: 'system',
      content: `${memberId} was added to the group`,
      type: 'system',
      status: 'sent',
      timestamp: now.toISOString(),
      isSystem: true,
    });
  }
  
  // Sync to Supabase
  try {
    await supabase.from('groups').update({
      members: updatedMembers,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync members to Supabase:', error);
  }
  
  return { success: true, message: `${newMembers.length} members added` };
}

export async function removeMemberFromGroup(
  groupId: string,
  adminId: string,
  memberToRemove: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  
  if (memberToRemove !== adminId && !admins.includes(adminId)) {
    return { success: false, message: 'Only admins can remove members' };
  }
  
  const currentMembers = chat.participants || [];
  const updatedMembers = currentMembers.filter((id: string) => id !== memberToRemove);
  const updatedAdmins = admins.filter((id: string) => id !== memberToRemove);
  
  await db.chats.update(groupId, {
    participants: updatedMembers,
    admins: updatedAdmins,
  });
  
  const isLeaving = memberToRemove === adminId;
  await db.messages.add({
    id: uuidv4(),
    chatId: groupId,
    senderId: 'system',
    content: isLeaving 
      ? `${memberToRemove} left the group`
      : `${memberToRemove} was removed from the group`,
    type: 'system',
    status: 'sent',
    timestamp: new Date().toISOString(),
    isSystem: true,
  });
  
  try {
    await supabase.from('groups').update({
      members: updatedMembers,
      admins: updatedAdmins,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync member removal to Supabase:', error);
  }
  
  return { success: true, message: isLeaving ? 'You left the group' : 'Member removed' };
}

export async function makeGroupAdmin(
  groupId: string,
  currentAdminId: string,
  newAdminId: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  
  if (!admins.includes(currentAdminId)) {
    return { success: false, message: 'Only admins can promote members' };
  }
  
  if (admins.includes(newAdminId)) {
    return { success: false, message: 'User is already an admin' };
  }
  
  const updatedAdmins = [...admins, newAdminId];
  
  await db.chats.update(groupId, {
    admins: updatedAdmins,
  });
  
  await db.messages.add({
    id: uuidv4(),
    chatId: groupId,
    senderId: 'system',
    content: `${newAdminId} is now an admin`,
    type: 'system',
    status: 'sent',
    timestamp: new Date().toISOString(),
    isSystem: true,
  });
  
  try {
    await supabase.from('groups').update({
      admins: updatedAdmins,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync admin update to Supabase:', error);
  }
  
  return { success: true, message: 'Admin added' };
}

export async function removeGroupAdmin(
  groupId: string,
  currentAdminId: string,
  adminToRemove: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  
  if (!admins.includes(currentAdminId)) {
    return { success: false, message: 'Only admins can demote admins' };
  }
  
  if (admins.length <= 1) {
    return { success: false, message: 'Group must have at least one admin' };
  }
  
  const updatedAdmins = admins.filter((id: string) => id !== adminToRemove);
  
  await db.chats.update(groupId, {
    admins: updatedAdmins,
  });
  
  await db.messages.add({
    id: uuidv4(),
    chatId: groupId,
    senderId: 'system',
    content: `${adminToRemove} is no longer an admin`,
    type: 'system',
    status: 'sent',
    timestamp: new Date().toISOString(),
    isSystem: true,
  });
  
  try {
    await supabase.from('groups').update({
      admins: updatedAdmins,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync admin removal to Supabase:', error);
  }
  
  return { success: true, message: 'Admin removed' };
}

export async function updateGroupInfo(
  groupId: string,
  adminId: string,
  updates: { name?: string; description?: string; icon?: string }
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  const settings = (chat.groupSettings as unknown as GroupSettingsType) || DEFAULT_GROUP_SETTINGS;
  
  if (settings.onlyAdminsCanEditInfo && !admins.includes(adminId)) {
    return { success: false, message: 'Only admins can edit group info' };
  }
  
  const updateData: Partial<LocalChat> = {};
  
  if (updates.name) {
    updateData.recipientName = updates.name;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  if (updates.icon !== undefined) {
    updateData.recipientAvatar = updates.icon;
  }
  
  await db.chats.update(groupId, updateData);
  
  if (updates.name) {
    await db.messages.add({
      id: uuidv4(),
      chatId: groupId,
      senderId: 'system',
      content: `Group name changed to "${updates.name}"`,
      type: 'system',
      status: 'sent',
      timestamp: new Date().toISOString(),
      isSystem: true,
    });
  }
  
  try {
    await supabase.from('groups').update({
      name: updates.name,
      description: updates.description,
      icon: updates.icon,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync group info to Supabase:', error);
  }
  
  return { success: true, message: 'Group info updated' };
}

export async function updateGroupSettings(
  groupId: string,
  adminId: string,
  settings: Partial<GroupSettingsType>
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  
  if (!admins.includes(adminId)) {
    return { success: false, message: 'Only admins can change group settings' };
  }
  
  const currentSettings = (chat.groupSettings as unknown as GroupSettingsType) || DEFAULT_GROUP_SETTINGS;
  const updatedSettings = { ...currentSettings, ...settings };
  
  await db.chats.update(groupId, {
    groupSettings: updatedSettings,
  });
  
  try {
    await supabase.from('groups').update({
      settings: updatedSettings,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync group settings to Supabase:', error);
  }
  
  return { success: true, message: 'Group settings updated' };
}

// ============================================
// GROUP INVITE LINKS
// ============================================

function generateInviteLink(groupId: string): string {
  const code = btoa(groupId + ':' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 22);
  return `https://ourdm.app/join/${code}`;
}

export async function regenerateInviteLink(
  groupId: string,
  adminId: string
): Promise<{ success: boolean; link?: string; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  
  if (!admins.includes(adminId)) {
    return { success: false, message: 'Only admins can regenerate invite link' };
  }
  
  const newLink = generateInviteLink(groupId);
  
  await db.chats.update(groupId, {
    inviteLink: newLink,
  });
  
  try {
    await supabase.from('groups').update({
      invite_link: newLink,
    }).eq('id', groupId);
  } catch (error) {
    console.error('Failed to sync invite link to Supabase:', error);
  }
  
  return { success: true, link: newLink, message: 'Invite link regenerated' };
}

export async function joinGroupViaLink(
  inviteCode: string,
  userId: string
): Promise<{ success: boolean; groupId?: string; message: string }> {
  try {
    const decoded = atob(inviteCode);
    const groupId = decoded.split(':')[0];
    
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();
    
    if (!group) {
      return { success: false, message: 'Invalid or expired invite link' };
    }
    
    if (!group.settings?.linkSharingEnabled) {
      return { success: false, message: 'Group link sharing is disabled' };
    }
    
    if (group.members.includes(userId)) {
      return { success: false, message: 'You are already a member of this group' };
    }
    
    if (group.settings?.approvalRequired) {
      await supabase.from('group_join_requests').insert({
        group_id: groupId,
        user_id: userId,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      return { success: true, groupId, message: 'Join request sent. Waiting for admin approval.' };
    }
    
    const updatedMembers = [...group.members, userId];
    await supabase.from('groups').update({
      members: updatedMembers,
    }).eq('id', groupId);
    
    await supabase.from('messages').insert({
      id: uuidv4(),
      chat_id: groupId,
      sender_id: 'system',
      content: `User joined via invite link`,
      type: 'system',
      created_at: new Date().toISOString(),
    });
    
    return { success: true, groupId, message: 'Joined group successfully' };
  } catch {
    return { success: false, message: 'Invalid invite link' };
  }
}

// ============================================
// GROUP DELETION
// ============================================

export async function deleteGroup(
  groupId: string,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(groupId);
  
  if (!chat) {
    return { success: false, message: 'Group not found' };
  }
  
  const admins = chat.admins || [];
  
  if (!admins.includes(adminId)) {
    return { success: false, message: 'Only admins can delete the group' };
  }
  
  await db.chats.delete(groupId);
  await db.messages.where('chatId').equals(groupId).delete();
  
  try {
    await supabase.from('groups').delete().eq('id', groupId);
    await supabase.from('messages').delete().eq('chat_id', groupId);
  } catch (error) {
    console.error('Failed to delete group from Supabase:', error);
  }
  
  return { success: true, message: 'Group deleted' };
}

// ============================================
// BROADCAST LISTS
// ============================================

export async function createBroadcastList(
  creatorId: string,
  name: string,
  members: string[]
): Promise<{ success: boolean; id?: string; message: string }> {
  const id = uuidv4();
  const now = new Date();
  
  await db.chats.add({
    id,
    recipientId: creatorId,
    recipientName: name,
    recipientAvatar: undefined,
    lastMessage: 'Broadcast list created',
    lastMessageTime: now.toISOString(),
    unread: 0,
    isOnline: false,
    type: 'broadcast',
    participants: members,
    admins: [creatorId],
  });
  
  try {
    await supabase.from('broadcast_lists').insert({
      id,
      name,
      members,
      created_by: creatorId,
      created_at: now.toISOString(),
    });
  } catch (error) {
    console.error('Failed to sync broadcast list to Supabase:', error);
  }
  
  return { success: true, id, message: 'Broadcast list created' };
}

export async function sendBroadcastMessage(
  broadcastId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'video' = 'text'
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(broadcastId);
  
  if (!chat || chat.type !== 'broadcast') {
    return { success: false, message: 'Broadcast list not found' };
  }
  
  const members = chat.participants || [];
  const now = new Date();
  
  for (const memberId of members) {
    const messageId = uuidv4();
    
    const existingChat = await db.chats
      .where('recipientId')
      .equals(memberId)
      .first();
    
    let chatId = existingChat?.id;
    
    if (!existingChat) {
      chatId = uuidv4();
      await db.chats.add({
        id: chatId,
        recipientId: memberId,
        recipientName: memberId,
        lastMessage: content,
        lastMessageTime: now.toISOString(),
        unread: 0,
        isOnline: false,
        type: 'individual',
      });
    }
    
    await db.messages.add({
      id: messageId,
      chatId: chatId!,
      senderId,
      content,
      type,
      status: 'pending',
      timestamp: now.toISOString(),
      isBroadcast: true,
      broadcastId,
    });
    
    await db.pendingUploads.add({
      id: messageId,
      type: 'message',
      data: { chatId, content, type, receiverId: memberId },
      createdAt: now.toISOString(),
      status: 'pending',
    });
  }
  
  return { success: true, message: `Message sent to ${members.length} recipients` };
}
