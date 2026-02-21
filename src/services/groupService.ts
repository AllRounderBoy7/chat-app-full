// ============================================
// OURDM v3.0.0 - Group Chat Service
// Complete WhatsApp-like Group Management
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { db, type LocalChat } from '../lib/database';
import { supabase } from '../lib/supabase';


// Default group settings
interface GroupSettingsType {
  only_admins_can_send: boolean;
  only_admins_can_add_members: boolean;
  only_admins_can_edit_info: boolean;
  approval_required: boolean;
  max_members: number;
  link_sharing_enabled: boolean;
}

const DEFAULT_GROUP_SETTINGS: GroupSettingsType = {
  only_admins_can_send: false,
  only_admins_can_add_members: false,
  only_admins_can_edit_info: true,
  approval_required: false,
  max_members: 256,
  link_sharing_enabled: true,
};

// ============================================
// GROUP CREATION
// ============================================

export async function createGroup(
  creator_id: string,
  name: string,
  description: string,
  icon: string | undefined,
  initial_members: string[]
): Promise<LocalChat> {
  const group_id = uuidv4();
  const now = Date.now();

  // Include creator in members
  const all_members = [creator_id, ...initial_members.filter((id: string) => id !== creator_id)];

  const group: LocalChat = {
    id: group_id,
    type: 'group',
    order_id: creator_id,
    display_name: name,
    avatar_url: icon,
    description,
    participants: all_members,
    admins: [creator_id],
    last_message: 'Group created',
    created_at: now,
    updated_at: now,
    unread_count: 0,
    is_online: false,
    is_pinned: false,
    is_muted: false,
    is_archived: false,
    is_locked: false,
    is_hidden: false,
    disappearing_messages: 0,
    group_settings: { ...DEFAULT_GROUP_SETTINGS },
    invite_link: generateInviteLink(group_id),
  };

  // Save to local database
  await db.chats.add(group);

  // Create system message
  await db.messages.add({
    id: uuidv4(),
    chat_id: group_id,
    sender_id: 'system',
    content: `Group "${name}" created`,
    type: 'system',
    status: 'sent',
    created_at: now,
    is_system: true,
  });

  // Sync to Supabase
  try {
    await supabase.from('groups').insert({
      id: group_id,
      name,
      description,
      icon,
      created_by: creator_id,
      members: all_members,
      admins: [creator_id],
      settings: group.group_settings,
      invite_link: group.invite_link,
      created_at: Date.now(),
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
  group_id: string,
  admin_id: string,
  new_members: string[]
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];
  const settings = (chat.group_settings as unknown as GroupSettingsType) || DEFAULT_GROUP_SETTINGS;

  if (settings.only_admins_can_add_members && !admins.includes(admin_id)) {
    return { success: false, message: 'Only admins can add members' };
  }

  const current_members = chat.participants || [];
  if (current_members.length + new_members.length > settings.max_members) {
    return { success: false, message: `Group can have maximum ${settings.max_members} members` };
  }

  const updated_members = [...new Set([...current_members, ...new_members])];

  await db.chats.update(group_id, {
    participants: updated_members,
  });

  // Create system messages
  for (const member_id of new_members) {
    await db.messages.add({
      id: uuidv4(),
      chat_id: group_id,
      sender_id: 'system',
      content: `${member_id} was added to the group`,
      type: 'system',
      status: 'sent',
      created_at: Date.now(),
      is_system: true,
    });
  }

  // Sync to Supabase
  try {
    await supabase.from('groups').update({
      members: updated_members,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync members to Supabase:', error);
  }

  return { success: true, message: `${new_members.length} members added` };
}

export async function removeMemberFromGroup(
  group_id: string,
  admin_id: string,
  member_to_remove: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];

  if (member_to_remove !== admin_id && !admins.includes(admin_id)) {
    return { success: false, message: 'Only admins can remove members' };
  }

  const current_members = chat.participants || [];
  const updated_members = current_members.filter((id: string) => id !== member_to_remove);
  const updated_admins = admins.filter((id: string) => id !== member_to_remove);

  await db.chats.update(group_id, {
    participants: updated_members,
    admins: updated_admins,
  });

  const is_leaving = member_to_remove === admin_id;
  await db.messages.add({
    id: uuidv4(),
    chat_id: group_id,
    sender_id: 'system',
    content: is_leaving
      ? `${member_to_remove} left the group`
      : `${member_to_remove} was removed from the group`,
    type: 'system',
    status: 'sent',
    created_at: Date.now(),
    is_system: true,
  });

  try {
    await supabase.from('groups').update({
      members: updated_members,
      admins: updated_admins,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync member removal to Supabase:', error);
  }

  return { success: true, message: is_leaving ? 'You left the group' : 'Member removed' };
}

export async function makeGroupAdmin(
  group_id: string,
  current_admin_id: string,
  new_admin_id: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];

  if (!admins.includes(current_admin_id)) {
    return { success: false, message: 'Only admins can promote members' };
  }

  if (admins.includes(new_admin_id)) {
    return { success: false, message: 'User is already an admin' };
  }

  const updated_admins = [...admins, new_admin_id];

  await db.chats.update(group_id, {
    admins: updated_admins,
  });

  await db.messages.add({
    id: uuidv4(),
    chat_id: group_id,
    sender_id: 'system',
    content: `${new_admin_id} is now an admin`,
    type: 'system',
    status: 'sent',
    created_at: Date.now(),
    is_system: true,
  });

  try {
    await supabase.from('groups').update({
      admins: updated_admins,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync admin update to Supabase:', error);
  }

  return { success: true, message: 'Admin added' };
}

export async function removeGroupAdmin(
  group_id: string,
  current_admin_id: string,
  admin_to_remove: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];

  if (!admins.includes(current_admin_id)) {
    return { success: false, message: 'Only admins can demote admins' };
  }

  if (admins.length <= 1) {
    return { success: false, message: 'Group must have at least one admin' };
  }

  const updated_admins = admins.filter((id: string) => id !== admin_to_remove);

  await db.chats.update(group_id, {
    admins: updated_admins,
  });

  await db.messages.add({
    id: uuidv4(),
    chat_id: group_id,
    sender_id: 'system',
    content: `${admin_to_remove} is no longer an admin`,
    type: 'system',
    status: 'sent',
    created_at: Date.now(),
    is_system: true,
  });

  try {
    await supabase.from('groups').update({
      admins: updated_admins,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync admin removal to Supabase:', error);
  }

  return { success: true, message: 'Admin removed' };
}

export async function updateGroupInfo(
  group_id: string,
  admin_id: string,
  updates: { name?: string; description?: string; icon?: string }
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];
  const settings = (chat.group_settings as unknown as GroupSettingsType) || DEFAULT_GROUP_SETTINGS;

  if (settings.only_admins_can_edit_info && !admins.includes(admin_id)) {
    return { success: false, message: 'Only admins can edit group info' };
  }

  const update_data: Partial<LocalChat> = {};

  if (updates.name) {
    update_data.display_name = updates.name;
  }
  if (updates.description !== undefined) {
    update_data.description = updates.description;
  }
  if (updates.icon !== undefined) {
    update_data.avatar_url = updates.icon;
  }

  await db.chats.update(group_id, update_data);

  if (updates.name) {
    await db.messages.add({
      id: uuidv4(),
      chat_id: group_id,
      sender_id: 'system',
      content: `Group name changed to "${updates.name}"`,
      type: 'system',
      status: 'sent',
      created_at: Date.now(),
      is_system: true,
    });
  }

  try {
    await supabase.from('groups').update({
      name: updates.name,
      description: updates.description,
      icon: updates.icon,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync group info to Supabase:', error);
  }

  return { success: true, message: 'Group info updated' };
}

export async function updateGroupSettings(
  group_id: string,
  admin_id: string,
  settings: Partial<GroupSettingsType>
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];

  if (!admins.includes(admin_id)) {
    return { success: false, message: 'Only admins can change group settings' };
  }

  const current_settings = (chat.group_settings as unknown as GroupSettingsType) || DEFAULT_GROUP_SETTINGS;
  const updated_settings = { ...current_settings, ...settings };

  await db.chats.update(group_id, {
    group_settings: updated_settings,
  });

  try {
    await supabase.from('groups').update({
      settings: updated_settings,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync group settings to Supabase:', error);
  }

  return { success: true, message: 'Group settings updated' };
}

// ============================================
// GROUP INVITE LINKS
// ============================================

function generateInviteLink(group_id: string): string {
  const code = btoa(group_id + ':' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 22);
  return `https://ourdm.app/join/${code}`;
}

export async function regenerateInviteLink(
  group_id: string,
  admin_id: string
): Promise<{ success: boolean; link?: string; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];

  if (!admins.includes(admin_id)) {
    return { success: false, message: 'Only admins can regenerate invite link' };
  }

  const new_link = generateInviteLink(group_id);

  await db.chats.update(group_id, {
    invite_link: new_link,
  });

  try {
    await supabase.from('groups').update({
      invite_link: new_link,
    }).eq('id', group_id);
  } catch (error) {
    console.error('Failed to sync invite link to Supabase:', error);
  }

  return { success: true, link: new_link, message: 'Invite link regenerated' };
}

export async function joinGroupViaLink(
  invite_code: string,
  user_id: string
): Promise<{ success: boolean; group_id?: string; message: string }> {
  try {
    const decoded = atob(invite_code);
    const group_id = decoded.split(':')[0];

    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('id', group_id)
      .single();

    if (!group) {
      return { success: false, message: 'Invalid or expired invite link' };
    }

    if (!group.settings?.link_sharing_enabled) {
      return { success: false, message: 'Group link sharing is disabled' };
    }

    if (group.members.includes(user_id)) {
      return { success: false, message: 'You are already a member of this group' };
    }

    if (group.settings?.approval_required) {
      await supabase.from('group_join_requests').insert({
        group_id: group_id,
        user_id: user_id,
        status: 'pending',
        created_at: Date.now(),
      });
      return { success: true, group_id, message: 'Join request sent. Waiting for admin approval.' };
    }

    const updated_members = [...group.members, user_id];
    await supabase.from('groups').update({
      members: updated_members,
    }).eq('id', group_id);

    await supabase.from('messages').insert({
      id: uuidv4(),
      chat_id: group_id,
      sender_id: 'system',
      content: `User joined via invite link`,
      type: 'system',
      created_at: Date.now(),
    });

    return { success: true, group_id, message: 'Joined group successfully' };
  } catch {
    return { success: false, message: 'Invalid invite link' };
  }
}

// ============================================
// GROUP DELETION
// ============================================

export async function deleteGroup(
  group_id: string,
  admin_id: string
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(group_id);

  if (!chat) {
    return { success: false, message: 'Group not found' };
  }

  const admins = chat.admins || [];

  if (!admins.includes(admin_id)) {
    return { success: false, message: 'Only admins can delete the group' };
  }

  await db.chats.delete(group_id);
  await db.messages.where('chat_id').equals(group_id).delete();

  try {
    await supabase.from('groups').delete().eq('id', group_id);
    await supabase.from('messages').delete().eq('chat_id', group_id);
  } catch (error) {
    console.error('Failed to delete group from Supabase:', error);
  }

  return { success: true, message: 'Group deleted' };
}

// ============================================
// BROADCAST LISTS
// ============================================

export async function createBroadcastList(
  creator_id: string,
  name: string,
  members: string[]
): Promise<{ success: boolean; id?: string; message: string }> {
  const id = uuidv4();
  const now = Date.now();

  await db.chats.add({
    id,
    order_id: creator_id,
    display_name: name,
    avatar_url: undefined,
    last_message: 'Broadcast list created',
    created_at: now,
    updated_at: now, // Added updated_at
    unread_count: 0,
    is_online: false,
    type: 'broadcast',
    participants: members,
    admins: [creator_id],
  });

  try {
    await supabase.from('broadcast_lists').insert({
      id,
      name,
      members,
      created_by: creator_id,
      created_at: Date.now(),
    });
  } catch (error) {
    console.error('Failed to sync broadcast list to Supabase:', error);
  }

  return { success: true, id, message: 'Broadcast list created' };
}

export async function sendBroadcastMessage(
  broadcast_id: string,
  sender_id: string,
  content: string,
  type: 'text' | 'image' | 'video' = 'text'
): Promise<{ success: boolean; message: string }> {
  const chat = await db.chats.get(broadcast_id);

  if (!chat || chat.type !== 'broadcast') {
    return { success: false, message: 'Broadcast list not found' };
  }

  const members = chat.participants || [];
  const now = Date.now(); // Changed from new Date()

  for (const member_id of members) {
    const message_id = uuidv4();

    const existing_chat = await db.chats
      .where('recipient_id')
      .equals(member_id)
      .first();

    let chat_id = existing_chat?.id;

    if (!existing_chat) {
      chat_id = uuidv4();
      await db.chats.add({
        id: chat_id,
        recipient_id: member_id,
        display_name: member_id,
        last_message: content,
        created_at: now,
        updated_at: now, // Added updated_at
        unread_count: 0,
        is_online: false,
        type: 'individual',
      });
    }

    await db.messages.add({
      id: message_id,
      chat_id: chat_id!,
      sender_id: sender_id,
      content,
      type,
      status: 'pending',
      created_at: now, // Added created_at
    });

    await db.syncQueue.add({
      id: uuidv4(),
      type: 'message',
      payload: JSON.stringify({ chat_id, content, type, receiver_id: member_id }),
      priority: 1,
      retry_count: 0,
      max_retries: 5,
      created_at: Date.now(),
    });
  }

  return { success: true, message: `Message sent to ${members.length} recipients` };
}
