// Group Service - Complete Group Management Logic
import { supabase } from '../../lib/supabase';
import { db, DBGroup, DBGroupMessage } from '../../lib/database';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface GroupMember {
  id: string;
  oderId: string;
  groupId: string;
  role: 'owner' | 'admin' | 'member';
  addedBy: string;
  addedAt: string;
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddMembers: boolean;
  canEditGroupInfo: boolean;
  isMuted: boolean;
  mutedUntil?: string;
  nickname?: string;
  user?: {
    id: string;
    displayName: string;
    username: string;
    avatar: string;
    isOnline: boolean;
    lastSeen: string;
  };
}

export interface Group {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  settings: GroupSettings;
  members: GroupMember[];
  memberCount: number;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    timestamp: string;
    type: string;
  };
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
}

export interface GroupSettings {
  // Permissions
  whoCanSendMessages: 'all' | 'admins_only';
  whoCanEditGroupInfo: 'all' | 'admins_only';
  whoCanAddMembers: 'all' | 'admins_only';
  whoCanSendMedia: 'all' | 'admins_only';
  whoCanSendPolls: 'all' | 'admins_only';
  
  // Features
  disappearingMessages: boolean;
  disappearingDuration: number; // in hours
  slowMode: boolean;
  slowModeInterval: number; // in seconds
  
  // Privacy
  approveNewMembers: boolean;
  hidePhoneNumbers: boolean;
  
  // Limits
  maxMembers: number;
  maxFileSize: number; // in MB
  
  // Invite
  inviteLink: string;
  inviteLinkEnabled: boolean;
  inviteLinkResetAt?: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice' | 'poll' | 'location' | 'contact' | 'system';
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
    type: string;
  };
  mentions: string[];
  reactions: { [emoji: string]: string[] };
  attachments?: {
    url: string;
    thumbnail?: string;
    name: string;
    size: number;
    mimeType: string;
    duration?: number;
  }[];
  poll?: {
    question: string;
    options: { id: string; text: string; votes: string[] }[];
    multipleAnswers: boolean;
    anonymous: boolean;
    endsAt?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  };
  contact?: {
    name: string;
    phone: string;
    email?: string;
  };
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

// Helper functions to convert between DB and App types
function groupToDBGroup(group: Group): DBGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    settings: JSON.stringify(group.settings),
    members: JSON.stringify(group.members),
    memberCount: group.memberCount,
    lastMessage: group.lastMessage ? JSON.stringify(group.lastMessage) : undefined,
    unreadCount: group.unreadCount,
    isPinned: group.isPinned,
    isMuted: group.isMuted,
    isArchived: group.isArchived,
  };
}

function dbGroupToGroup(dbGroup: DBGroup): Group {
  return {
    id: dbGroup.id,
    name: dbGroup.name,
    description: dbGroup.description,
    icon: dbGroup.icon,
    createdBy: dbGroup.createdBy,
    createdAt: dbGroup.createdAt,
    updatedAt: dbGroup.updatedAt,
    settings: typeof dbGroup.settings === 'string' ? JSON.parse(dbGroup.settings) : dbGroup.settings,
    members: typeof dbGroup.members === 'string' ? JSON.parse(dbGroup.members) : dbGroup.members,
    memberCount: dbGroup.memberCount,
    lastMessage: dbGroup.lastMessage ? (typeof dbGroup.lastMessage === 'string' ? JSON.parse(dbGroup.lastMessage) : dbGroup.lastMessage) : undefined,
    unreadCount: dbGroup.unreadCount,
    isPinned: dbGroup.isPinned,
    isMuted: dbGroup.isMuted,
    isArchived: dbGroup.isArchived,
  };
}

function messageToDBMessage(message: GroupMessage): DBGroupMessage {
  return {
    id: message.id,
    groupId: message.groupId,
    senderId: message.senderId,
    senderName: message.senderName,
    senderAvatar: message.senderAvatar,
    content: message.content,
    type: message.type,
    replyTo: message.replyTo ? JSON.stringify(message.replyTo) : undefined,
    mentions: message.mentions,
    reactions: message.reactions,
    attachments: message.attachments ? JSON.stringify(message.attachments) : undefined,
    poll: message.poll ? JSON.stringify(message.poll) : undefined,
    location: message.location ? JSON.stringify(message.location) : undefined,
    contact: message.contact ? JSON.stringify(message.contact) : undefined,
    status: message.status,
    deliveredTo: message.deliveredTo,
    readBy: message.readBy,
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted,
    deletedAt: message.deletedAt,
    deletedFor: message.deletedFor,
    isStarred: message.isStarred,
    isPinned: message.isPinned,
    scheduledFor: message.scheduledFor,
    expiresAt: message.expiresAt,
    createdAt: message.createdAt,
  };
}

function dbMessageToMessage(dbMessage: DBGroupMessage): GroupMessage {
  return {
    id: dbMessage.id,
    groupId: dbMessage.groupId,
    senderId: dbMessage.senderId,
    senderName: dbMessage.senderName,
    senderAvatar: dbMessage.senderAvatar,
    content: dbMessage.content,
    type: dbMessage.type,
    replyTo: dbMessage.replyTo ? (typeof dbMessage.replyTo === 'string' ? JSON.parse(dbMessage.replyTo) : dbMessage.replyTo) : undefined,
    mentions: dbMessage.mentions,
    reactions: dbMessage.reactions,
    attachments: dbMessage.attachments ? (typeof dbMessage.attachments === 'string' ? JSON.parse(dbMessage.attachments) : dbMessage.attachments) : undefined,
    poll: dbMessage.poll ? (typeof dbMessage.poll === 'string' ? JSON.parse(dbMessage.poll) : dbMessage.poll) : undefined,
    location: dbMessage.location ? (typeof dbMessage.location === 'string' ? JSON.parse(dbMessage.location) : dbMessage.location) : undefined,
    contact: dbMessage.contact ? (typeof dbMessage.contact === 'string' ? JSON.parse(dbMessage.contact) : dbMessage.contact) : undefined,
    status: dbMessage.status,
    deliveredTo: dbMessage.deliveredTo,
    readBy: dbMessage.readBy,
    isEdited: dbMessage.isEdited,
    editedAt: dbMessage.editedAt,
    isDeleted: dbMessage.isDeleted,
    deletedAt: dbMessage.deletedAt,
    deletedFor: dbMessage.deletedFor,
    isStarred: dbMessage.isStarred,
    isPinned: dbMessage.isPinned,
    scheduledFor: dbMessage.scheduledFor,
    expiresAt: dbMessage.expiresAt,
    createdAt: dbMessage.createdAt,
  };
}

// Group Service Class
class GroupServiceClass {
  // Create a new group
  async createGroup(
    name: string,
    description: string,
    icon: string | null,
    memberIds: string[],
    creatorId: string
  ): Promise<Group> {
    const groupId = uuidv4();
    const now = new Date().toISOString();
    
    const defaultSettings: GroupSettings = {
      whoCanSendMessages: 'all',
      whoCanEditGroupInfo: 'admins_only',
      whoCanAddMembers: 'all',
      whoCanSendMedia: 'all',
      whoCanSendPolls: 'all',
      disappearingMessages: false,
      disappearingDuration: 24,
      slowMode: false,
      slowModeInterval: 10,
      approveNewMembers: false,
      hidePhoneNumbers: true,
      maxMembers: 256,
      maxFileSize: 100,
      inviteLink: `https://ourdm.app/join/${groupId.substring(0, 8)}`,
      inviteLinkEnabled: true,
    };

    const group: Group = {
      id: groupId,
      name,
      description,
      icon: icon || '',
      createdBy: creatorId,
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings,
      members: [],
      memberCount: memberIds.length + 1,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isArchived: false,
    };

    // Add creator as owner
    const ownerMember: GroupMember = {
      id: uuidv4(),
      oderId: creatorId,
      groupId: groupId,
      role: 'owner',
      addedBy: creatorId,
      addedAt: now,
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: true,
      canEditGroupInfo: true,
      isMuted: false,
    };
    group.members.push(ownerMember);

    // Add other members
    for (const memberId of memberIds) {
      const member: GroupMember = {
        id: uuidv4(),
        oderId: memberId,
        groupId: groupId,
        role: 'member',
        addedBy: creatorId,
        addedAt: now,
        canSendMessages: true,
        canSendMedia: true,
        canAddMembers: defaultSettings.whoCanAddMembers === 'all',
        canEditGroupInfo: false,
        isMuted: false,
      };
      group.members.push(member);
    }

    // Save to local DB
    await db.groups.add(groupToDBGroup(group));

    // Save to Supabase
    try {
      await supabase.from('groups').insert({
        id: group.id,
        name: group.name,
        description: group.description,
        icon: group.icon,
        created_by: group.createdBy,
        settings: group.settings,
      });

      // Insert members
      for (const member of group.members) {
        await supabase.from('group_members').insert({
          id: member.id,
          group_id: member.groupId,
          user_id: member.oderId,
          role: member.role,
          added_by: member.addedBy,
          permissions: {
            canSendMessages: member.canSendMessages,
            canSendMedia: member.canSendMedia,
            canAddMembers: member.canAddMembers,
            canEditGroupInfo: member.canEditGroupInfo,
          },
        });
      }

      // Create system message
      await this.sendSystemMessage(groupId, `Group "${name}" created`);
    } catch (error) {
      console.error('Error saving group to Supabase:', error);
    }

    return group;
  }

  // Add members to group
  async addMembers(groupId: string, memberIds: string[], addedBy: string): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const adder = group.members.find(m => m.oderId === addedBy);
    if (!adder) throw new Error('You are not a member of this group');

    // Check permission
    if (group.settings.whoCanAddMembers === 'admins_only' && adder.role === 'member') {
      throw new Error('Only admins can add members');
    }

    const now = new Date().toISOString();
    const newMembers: GroupMember[] = [];

    for (const memberId of memberIds) {
      // Check if already a member
      if (group.members.some(m => m.oderId === memberId)) continue;

      const member: GroupMember = {
        id: uuidv4(),
        oderId: memberId,
        groupId: groupId,
        role: 'member',
        addedBy: addedBy,
        addedAt: now,
        canSendMessages: group.settings.whoCanSendMessages === 'all',
        canSendMedia: group.settings.whoCanSendMedia === 'all',
        canAddMembers: group.settings.whoCanAddMembers === 'all',
        canEditGroupInfo: false,
        isMuted: false,
      };
      newMembers.push(member);
    }

    // Update local DB
    group.members.push(...newMembers);
    group.memberCount = group.members.length;
    await db.groups.update(groupId, {
      members: JSON.stringify(group.members),
      memberCount: group.memberCount,
    });

    // Update Supabase
    for (const member of newMembers) {
      await supabase.from('group_members').insert({
        id: member.id,
        group_id: member.groupId,
        user_id: member.oderId,
        role: member.role,
        added_by: member.addedBy,
        permissions: {
          canSendMessages: member.canSendMessages,
          canSendMedia: member.canSendMedia,
          canAddMembers: member.canAddMembers,
          canEditGroupInfo: member.canEditGroupInfo,
        },
      });

      // System message
      await this.sendSystemMessage(groupId, `${member.oderId} was added to the group`);
    }
  }

  // Remove member from group
  async removeMember(groupId: string, memberId: string, removedBy: string): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const remover = group.members.find(m => m.oderId === removedBy);
    const memberToRemove = group.members.find(m => m.oderId === memberId);

    if (!remover || !memberToRemove) throw new Error('Invalid member');

    // Permission checks
    if (remover.role === 'member') {
      throw new Error('Only admins can remove members');
    }
    if (memberToRemove.role === 'owner') {
      throw new Error('Cannot remove the group owner');
    }
    if (memberToRemove.role === 'admin' && remover.role !== 'owner') {
      throw new Error('Only owner can remove admins');
    }

    // Remove from local DB
    group.members = group.members.filter(m => m.oderId !== memberId);
    group.memberCount = group.members.length;
    await db.groups.update(groupId, {
      members: JSON.stringify(group.members),
      memberCount: group.memberCount,
    });

    // Remove from Supabase
    await supabase.from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId);

    // System message
    await this.sendSystemMessage(groupId, `${memberId} was removed from the group`);
  }

  // Leave group
  async leaveGroup(groupId: string, oderId: string): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === oderId);
    if (!member) throw new Error('You are not a member of this group');

    // If owner is leaving, transfer ownership
    if (member.role === 'owner') {
      const admins = group.members.filter(m => m.role === 'admin');
      if (admins.length > 0) {
        // Transfer to first admin
        await this.changeRole(groupId, admins[0].oderId, 'owner', oderId);
      } else {
        const members = group.members.filter(m => m.role === 'member' && m.oderId !== oderId);
        if (members.length > 0) {
          // Transfer to first member
          await this.changeRole(groupId, members[0].oderId, 'owner', oderId);
        } else {
          // Delete group if no other members
          await this.deleteGroup(groupId, oderId);
          return;
        }
      }
    }

    // Remove from local DB
    group.members = group.members.filter(m => m.oderId !== oderId);
    group.memberCount = group.members.length;
    await db.groups.update(groupId, {
      members: JSON.stringify(group.members),
      memberCount: group.memberCount,
    });

    // Remove from Supabase
    await supabase.from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', oderId);

    // System message
    await this.sendSystemMessage(groupId, `${oderId} left the group`);
  }

  // Change member role
  async changeRole(
    groupId: string,
    memberId: string,
    newRole: 'owner' | 'admin' | 'member',
    changedBy: string
  ): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const changer = group.members.find(m => m.oderId === changedBy);
    const member = group.members.find(m => m.oderId === memberId);

    if (!changer || !member) throw new Error('Invalid member');
    if (changer.role !== 'owner') throw new Error('Only owner can change roles');

    // If making someone owner, demote current owner
    if (newRole === 'owner') {
      changer.role = 'admin';
    }

    member.role = newRole;
    member.canEditGroupInfo = newRole === 'owner' || newRole === 'admin';
    member.canAddMembers = newRole === 'owner' || newRole === 'admin' || group.settings.whoCanAddMembers === 'all';

    // Update local DB
    await db.groups.update(groupId, {
      members: JSON.stringify(group.members),
    });

    // Update Supabase
    await supabase.from('group_members')
      .update({ role: newRole })
      .eq('group_id', groupId)
      .eq('user_id', memberId);

    // System message
    const roleText = newRole === 'owner' ? 'owner' : newRole === 'admin' ? 'an admin' : 'a member';
    await this.sendSystemMessage(groupId, `${memberId} is now ${roleText}`);
  }

  // Update group info
  async updateGroupInfo(
    groupId: string,
    updates: { name?: string; description?: string; icon?: string },
    updatedBy: string
  ): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === updatedBy);
    if (!member) throw new Error('You are not a member of this group');

    if (group.settings.whoCanEditGroupInfo === 'admins_only' && member.role === 'member') {
      throw new Error('Only admins can edit group info');
    }

    const now = new Date().toISOString();

    // Update local DB
    await db.groups.update(groupId, {
      ...updates,
      updatedAt: now,
    });

    // Update Supabase
    await supabase.from('groups')
      .update({
        ...updates,
        updated_at: now,
      })
      .eq('id', groupId);

    // System messages
    if (updates.name) {
      await this.sendSystemMessage(groupId, `Group name changed to "${updates.name}"`);
    }
    if (updates.description) {
      await this.sendSystemMessage(groupId, `Group description was updated`);
    }
    if (updates.icon) {
      await this.sendSystemMessage(groupId, `Group icon was changed`);
    }
  }

  // Update group settings
  async updateGroupSettings(
    groupId: string,
    settings: Partial<GroupSettings>,
    updatedBy: string
  ): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === updatedBy);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new Error('Only admins can change settings');
    }

    const newSettings = { ...group.settings, ...settings };

    // Update local DB
    await db.groups.update(groupId, {
      settings: JSON.stringify(newSettings),
      updatedAt: new Date().toISOString(),
    });

    // Update Supabase
    await supabase.from('groups')
      .update({ settings: newSettings })
      .eq('id', groupId);

    // Update member permissions based on new settings
    for (const m of group.members) {
      if (m.role === 'member') {
        m.canSendMessages = newSettings.whoCanSendMessages === 'all';
        m.canSendMedia = newSettings.whoCanSendMedia === 'all';
        m.canAddMembers = newSettings.whoCanAddMembers === 'all';
      }
    }

    await db.groups.update(groupId, {
      members: JSON.stringify(group.members),
    });
  }

  // Mute/unmute member
  async muteMember(
    groupId: string,
    memberId: string,
    mute: boolean,
    duration?: number,
    mutedBy?: string
  ): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === memberId);
    if (!member) throw new Error('Member not found');

    if (mutedBy) {
      const muter = group.members.find(m => m.oderId === mutedBy);
      if (!muter || muter.role === 'member') {
        throw new Error('Only admins can mute members');
      }
    }

    member.isMuted = mute;
    member.canSendMessages = !mute;
    if (mute && duration) {
      member.mutedUntil = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
    } else {
      member.mutedUntil = undefined;
    }

    // Update local DB
    await db.groups.update(groupId, {
      members: JSON.stringify(group.members),
    });

    // Update Supabase
    await supabase.from('group_members')
      .update({
        is_muted: mute,
        muted_until: member.mutedUntil,
      })
      .eq('group_id', groupId)
      .eq('user_id', memberId);
  }

  // Reset invite link
  async resetInviteLink(groupId: string, resetBy: string): Promise<string> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === resetBy);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new Error('Only admins can reset invite link');
    }

    const newLink = `https://ourdm.app/join/${uuidv4().substring(0, 8)}`;
    group.settings.inviteLink = newLink;
    group.settings.inviteLinkResetAt = new Date().toISOString();

    // Update local DB
    await db.groups.update(groupId, {
      settings: JSON.stringify(group.settings),
    });

    // Update Supabase
    await supabase.from('groups')
      .update({ settings: group.settings })
      .eq('id', groupId);

    return newLink;
  }

  // Delete group
  async deleteGroup(groupId: string, deletedBy: string): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === deletedBy);
    if (!member || member.role !== 'owner') {
      throw new Error('Only owner can delete the group');
    }

    // Delete from local DB
    await db.groups.delete(groupId);
    await db.groupMessages.where('groupId').equals(groupId).delete();

    // Delete from Supabase
    await supabase.from('group_messages').delete().eq('group_id', groupId);
    await supabase.from('group_members').delete().eq('group_id', groupId);
    await supabase.from('groups').delete().eq('id', groupId);
  }

  // Get group
  async getGroup(groupId: string): Promise<Group | null> {
    const localGroup = await db.groups.get(groupId);
    if (localGroup) {
      return dbGroupToGroup(localGroup);
    }

    // Fetch from Supabase
    const { data } = await supabase
      .from('groups')
      .select('*, group_members(*)')
      .eq('id', groupId)
      .single();

    if (!data) return null;

    const group: Group = {
      id: data.id,
      name: data.name,
      description: data.description,
      icon: data.icon,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      settings: data.settings,
      members: data.group_members || [],
      memberCount: data.group_members?.length || 0,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isArchived: false,
    };

    // Save to local DB
    await db.groups.put(groupToDBGroup(group));

    return group;
  }

  // Get all groups for user
  async getUserGroups(oderId: string): Promise<Group[]> {
    // First get from local DB
    const localGroups = await db.groups.toArray();
    const userGroups = localGroups.filter((g: DBGroup) => {
      const members = typeof g.members === 'string' ? JSON.parse(g.members) : g.members;
      return members.some((m: GroupMember) => m.oderId === oderId);
    });

    return userGroups.map((g: DBGroup) => dbGroupToGroup(g));
  }

  // Send system message
  async sendSystemMessage(groupId: string, content: string): Promise<void> {
    const message: GroupMessage = {
      id: uuidv4(),
      groupId,
      senderId: 'system',
      senderName: 'System',
      senderAvatar: '',
      content,
      type: 'system',
      mentions: [],
      reactions: {},
      status: 'sent',
      deliveredTo: [],
      readBy: [],
      isEdited: false,
      isDeleted: false,
      deletedFor: null,
      isStarred: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };

    await db.groupMessages.add(messageToDBMessage(message));

    await supabase.from('group_messages').insert({
      id: message.id,
      group_id: message.groupId,
      sender_id: message.senderId,
      content: message.content,
      type: message.type,
    });
  }

  // Send message to group
  async sendMessage(
    groupId: string,
    senderId: string,
    senderName: string,
    senderAvatar: string,
    content: string,
    type: GroupMessage['type'] = 'text',
    options?: {
      replyTo?: GroupMessage['replyTo'];
      mentions?: string[];
      attachments?: GroupMessage['attachments'];
      poll?: GroupMessage['poll'];
      location?: GroupMessage['location'];
      contact?: GroupMessage['contact'];
      scheduledFor?: string;
    }
  ): Promise<GroupMessage> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const member = group.members.find(m => m.oderId === senderId);
    if (!member) throw new Error('You are not a member of this group');
    if (!member.canSendMessages) throw new Error('You are muted in this group');

    // Check slow mode
    if (group.settings.slowMode) {
      const lastMessages = await db.groupMessages
        .where('groupId')
        .equals(groupId)
        .reverse()
        .limit(10)
        .toArray();
      
      const lastUserMessage = lastMessages.find((m: DBGroupMessage) => m.senderId === senderId);
      
      if (lastUserMessage) {
        const timeSinceLastMessage = Date.now() - new Date(lastUserMessage.createdAt).getTime();
        if (timeSinceLastMessage < group.settings.slowModeInterval * 1000) {
          throw new Error(`Please wait ${group.settings.slowModeInterval} seconds between messages`);
        }
      }
    }

    const now = new Date().toISOString();
    const message: GroupMessage = {
      id: uuidv4(),
      groupId,
      senderId,
      senderName,
      senderAvatar,
      content,
      type,
      replyTo: options?.replyTo,
      mentions: options?.mentions || [],
      reactions: {},
      attachments: options?.attachments,
      poll: options?.poll,
      location: options?.location,
      contact: options?.contact,
      status: 'pending',
      deliveredTo: [],
      readBy: [],
      isEdited: false,
      isDeleted: false,
      deletedFor: null,
      isStarred: false,
      isPinned: false,
      scheduledFor: options?.scheduledFor,
      expiresAt: group.settings.disappearingMessages 
        ? new Date(Date.now() + group.settings.disappearingDuration * 60 * 60 * 1000).toISOString()
        : undefined,
      createdAt: now,
    };

    // Save to local DB immediately (Optimistic UI)
    await db.groupMessages.add(messageToDBMessage(message));

    // Send to Supabase
    try {
      await supabase.from('group_messages').insert({
        id: message.id,
        group_id: message.groupId,
        sender_id: message.senderId,
        content: message.content,
        type: message.type,
        reply_to: message.replyTo,
        mentions: message.mentions,
        attachments: message.attachments,
        poll: message.poll,
        location: message.location,
        contact: message.contact,
        scheduled_for: message.scheduledFor,
        expires_at: message.expiresAt,
      });

      message.status = 'sent';
      await db.groupMessages.update(message.id, { status: 'sent' });
    } catch (error) {
      console.error('Error sending message:', error);
      message.status = 'failed';
      await db.groupMessages.update(message.id, { status: 'failed' });
    }

    return message;
  }

  // Get group messages
  async getMessages(groupId: string, limit = 50, before?: string): Promise<GroupMessage[]> {
    let query = db.groupMessages
      .where('groupId')
      .equals(groupId);

    const messages = await query
      .reverse()
      .limit(limit)
      .toArray();

    // Filter out deleted and apply before filter
    const filtered = messages.filter((m: DBGroupMessage) => {
      if (m.isDeleted) return false;
      if (before && m.createdAt >= before) return false;
      return true;
    });

    return filtered.reverse().map((m: DBGroupMessage) => dbMessageToMessage(m));
  }

  // React to message
  async reactToMessage(messageId: string, oderId: string, emoji: string): Promise<void> {
    const dbMessage = await db.groupMessages.get(messageId);
    if (!dbMessage) throw new Error('Message not found');

    const message = dbMessageToMessage(dbMessage);

    // Toggle reaction
    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    const index = message.reactions[emoji].indexOf(oderId);
    if (index > -1) {
      message.reactions[emoji].splice(index, 1);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji].push(oderId);
    }

    await db.groupMessages.update(messageId, { reactions: message.reactions });

    await supabase.from('group_messages')
      .update({ reactions: message.reactions })
      .eq('id', messageId);
  }

  // Delete message
  async deleteMessage(
    messageId: string,
    oderId: string,
    deleteFor: 'everyone' | 'me'
  ): Promise<void> {
    const dbMessage = await db.groupMessages.get(messageId);
    if (!dbMessage) throw new Error('Message not found');

    const message = dbMessageToMessage(dbMessage);

    if (deleteFor === 'everyone' && message.senderId !== oderId) {
      const group = await this.getGroup(message.groupId);
      const member = group?.members.find(m => m.oderId === oderId);
      if (!member || member.role === 'member') {
        throw new Error('Only the sender or admins can delete for everyone');
      }
    }

    await db.groupMessages.update(messageId, {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedFor: deleteFor,
      content: deleteFor === 'everyone' ? 'This message was deleted' : message.content,
    });

    if (deleteFor === 'everyone') {
      await supabase.from('group_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          content: 'This message was deleted',
        })
        .eq('id', messageId);
    }
  }

  // Edit message
  async editMessage(messageId: string, oderId: string, newContent: string): Promise<void> {
    const dbMessage = await db.groupMessages.get(messageId);
    if (!dbMessage) throw new Error('Message not found');

    const message = dbMessageToMessage(dbMessage);
    if (message.senderId !== oderId) throw new Error('You can only edit your own messages');
    if (message.type !== 'text') throw new Error('Can only edit text messages');

    await db.groupMessages.update(messageId, {
      content: newContent,
      isEdited: true,
      editedAt: new Date().toISOString(),
    });

    await supabase.from('group_messages')
      .update({
        content: newContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);
  }

  // Star/unstar message
  async toggleStarMessage(messageId: string): Promise<void> {
    const dbMessage = await db.groupMessages.get(messageId);
    if (!dbMessage) throw new Error('Message not found');

    await db.groupMessages.update(messageId, {
      isStarred: !dbMessage.isStarred,
    });
  }

  // Pin/unpin message
  async togglePinMessage(messageId: string, oderId: string): Promise<void> {
    const dbMessage = await db.groupMessages.get(messageId);
    if (!dbMessage) throw new Error('Message not found');

    const message = dbMessageToMessage(dbMessage);
    const group = await this.getGroup(message.groupId);
    const member = group?.members.find(m => m.oderId === oderId);
    if (!member || member.role === 'member') {
      throw new Error('Only admins can pin messages');
    }

    await db.groupMessages.update(messageId, {
      isPinned: !dbMessage.isPinned,
    });

    await supabase.from('group_messages')
      .update({ is_pinned: !dbMessage.isPinned })
      .eq('id', messageId);
  }

  // Create poll
  async createPoll(
    groupId: string,
    senderId: string,
    senderName: string,
    senderAvatar: string,
    question: string,
    options: string[],
    settings: { multipleAnswers: boolean; anonymous: boolean; endsAt?: string }
  ): Promise<GroupMessage> {
    const poll: GroupMessage['poll'] = {
      question,
      options: options.map(text => ({
        id: uuidv4(),
        text,
        votes: [],
      })),
      multipleAnswers: settings.multipleAnswers,
      anonymous: settings.anonymous,
      endsAt: settings.endsAt,
    };

    return this.sendMessage(groupId, senderId, senderName, senderAvatar, question, 'poll', { poll });
  }

  // Vote on poll
  async votePoll(messageId: string, optionId: string, oderId: string): Promise<void> {
    const dbMessage = await db.groupMessages.get(messageId);
    if (!dbMessage) throw new Error('Poll not found');

    const message = dbMessageToMessage(dbMessage);
    if (!message.poll) throw new Error('Not a poll message');

    // Check if poll has ended
    if (message.poll.endsAt && new Date(message.poll.endsAt) < new Date()) {
      throw new Error('This poll has ended');
    }

    // Remove previous votes if not multiple answers
    if (!message.poll.multipleAnswers) {
      for (const option of message.poll.options) {
        const index = option.votes.indexOf(oderId);
        if (index > -1) {
          option.votes.splice(index, 1);
        }
      }
    }

    // Add/remove vote
    const option = message.poll.options.find(o => o.id === optionId);
    if (!option) throw new Error('Option not found');

    const index = option.votes.indexOf(oderId);
    if (index > -1) {
      option.votes.splice(index, 1);
    } else {
      option.votes.push(oderId);
    }

    await db.groupMessages.update(messageId, { poll: JSON.stringify(message.poll) });

    await supabase.from('group_messages')
      .update({ poll: message.poll })
      .eq('id', messageId);
  }

  // Mark messages as read
  async markAsRead(groupId: string, oderId: string): Promise<void> {
    const messages = await db.groupMessages
      .where('groupId')
      .equals(groupId)
      .toArray();

    const unreadMessages = messages.filter((m: DBGroupMessage) => 
      !m.readBy.includes(oderId) && m.senderId !== oderId
    );

    for (const dbMessage of unreadMessages) {
      const readBy = [...dbMessage.readBy, oderId];
      const deliveredTo = dbMessage.deliveredTo.includes(oderId) 
        ? dbMessage.deliveredTo 
        : [...dbMessage.deliveredTo, oderId];
      
      await db.groupMessages.update(dbMessage.id, {
        readBy,
        deliveredTo,
      });
    }
  }

  // Search messages
  async searchMessages(groupId: string, query: string): Promise<GroupMessage[]> {
    const messages = await db.groupMessages
      .where('groupId')
      .equals(groupId)
      .toArray();

    const filtered = messages.filter((m: DBGroupMessage) => 
      m.content.toLowerCase().includes(query.toLowerCase()) && 
      !m.isDeleted
    );

    return filtered.map((m: DBGroupMessage) => dbMessageToMessage(m));
  }

  // Get starred messages
  async getStarredMessages(groupId: string): Promise<GroupMessage[]> {
    const messages = await db.groupMessages
      .where('groupId')
      .equals(groupId)
      .toArray();

    const starred = messages.filter((m: DBGroupMessage) => m.isStarred);
    return starred.map((m: DBGroupMessage) => dbMessageToMessage(m));
  }

  // Get pinned messages
  async getPinnedMessages(groupId: string): Promise<GroupMessage[]> {
    const messages = await db.groupMessages
      .where('groupId')
      .equals(groupId)
      .toArray();

    const pinned = messages.filter((m: DBGroupMessage) => m.isPinned);
    return pinned.map((m: DBGroupMessage) => dbMessageToMessage(m));
  }

  // Get media messages
  async getMediaMessages(groupId: string): Promise<GroupMessage[]> {
    const messages = await db.groupMessages
      .where('groupId')
      .equals(groupId)
      .toArray();

    const media = messages.filter((m: DBGroupMessage) => 
      ['image', 'video', 'audio', 'file'].includes(m.type)
    );
    return media.map((m: DBGroupMessage) => dbMessageToMessage(m));
  }
}

export const GroupService = new GroupServiceClass();
