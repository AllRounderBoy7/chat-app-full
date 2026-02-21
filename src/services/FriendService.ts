/**
 * FriendService.ts - Complete Friend System
 * WhatsApp + Instagram level implementation
 */

import { db } from '../lib/database';
import { supabase } from '../lib/supabase';

// Types
export interface Friend {
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

export interface FriendRequest {
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

export interface BlockedUser {
  id: string;
  odm_userId: string;
  blocked_user_id: string;
  user_name: string;
  user_avatar: string;
  blocked_at: number;
  reason: string | null;
}

export interface PrivacySettings {
  last_seen_visibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  profile_photo_visibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  bio_visibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  online_status_visibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  story_visibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  can_receive_requests_from: 'everyone' | 'friends_of_friends' | 'nobody';
  show_mutual_friends: boolean;
  allow_friend_suggestions: boolean;
}

// Friend Suggestions removed as per user request

// Friend Service Class
class FriendServiceClass {
  private currentUserId: string | null = null;

  setCurrentUser(userId: string) {
    if (userId) {
      console.log('FriendService: Setting current user to', userId);
      this.currentUserId = userId;
    }
  }

  getCurrentUser(): string | null {
    return this.currentUserId;
  }

  // ==================== FRIEND REQUESTS ====================

  async sendFriendRequestByUsername(
    username: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUserId) return { success: false, error: 'Not logged in' };

    const normalized = username.trim().replace(/^@/, '').toLowerCase();
    if (!normalized) return { success: false, error: 'Username is required' };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', normalized)
        .maybeSingle();

      if (error) {
        console.error('Send friend request by username: profile lookup error:', error);
        return { success: false, error: 'Failed to find user' };
      }

      if (!data?.id) {
        return { success: false, error: 'No user found with this username' };
      }

      return await this.sendFriendRequest(data.id, message);
    } catch (e) {
      console.error('Send friend request by username error:', e);
      return { success: false, error: 'Failed to send request' };
    }
  }

  async sendFriendRequest(
    toUserId: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUserId) return { success: false, error: 'Not logged in' };

    console.log(`FriendService: Sending request from ${this.currentUserId} to ${toUserId}`);

    try {
      if (toUserId === this.currentUserId) {
        console.warn('FriendService: Attempted to send request to self');
        return { success: false, error: 'Cannot add yourself as friend' };
      }

      // Check if already friends
      const existingFriend = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === toUserId)
        .first();

      if (existingFriend) {
        return { success: false, error: 'Already friends' };
      }

      // Check if blocked
      const blocked = await db.blockedUsers
        .where('odm_userId')
        .equals(this.currentUserId)
        .filter(b => b.blocked_user_id === toUserId)
        .first();

      if (blocked) {
        return { success: false, error: 'User is blocked. Unblock first.' };
      }

      // Check if request already pending
      const existingRequest = await db.friendRequests
        .where('sender_id')
        .equals(this.currentUserId)
        .filter(r => r.receiver_id === toUserId && r.status === 'pending')
        .first();

      if (existingRequest) {
        return { success: false, error: 'Request already sent' };
      }

      // Check if they sent you a request (auto-accept mutual request)
      const theirRequest = await db.friendRequests
        .where('sender_id')
        .equals(toUserId)
        .filter(r => r.receiver_id === this.currentUserId && r.status === 'pending')
        .first();

      if (theirRequest) {
        console.log('FriendService: Found mutual request, auto-accepting');
        return await this.acceptFriendRequest(theirRequest.id);
      }

      // Calculate mutual friends
      const mutualCount = await this.getMutualFriendsCount(toUserId);

      // Get current user info
      const currentUser = await db.contacts.get(this.currentUserId);

      // Create friend request
      const requestId = `fr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const request: FriendRequest = {
        id: requestId,
        sender_id: this.currentUserId,
        from_user_name: currentUser?.display_name || 'Unknown',
        from_user_avatar: currentUser?.avatar_url || '',
        from_user_odm: currentUser?.odm || '',
        receiver_id: toUserId,
        message: message || null,
        status: 'pending',
        created_at: Date.now(),
        mutual_friends_count: mutualCount
      };

      await db.friendRequests.add(request as any);

      // Sync to Supabase
      if (supabase) {
        console.log('FriendService: Syncing request to Supabase', { sender_id: this.currentUserId, receiver_id: toUserId });
        const { error } = await supabase.from('friend_requests').insert({
          id: requestId,
          sender_id: this.currentUserId,
          receiver_id: toUserId,
          message: message || null,
          status: 'pending',
          created_at: new Date().toISOString()
        });

        if (error) {
          console.error('FriendService: Supabase insert error:', error);
          throw error;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Send friend request error:', error);
      return { success: false, error: 'Failed to send request' };
    }
  }

  async acceptFriendRequest(
    requestId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await db.friendRequests.get(requestId);

      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, error: 'Request already processed' };
      }

      // Update request status
      await db.friendRequests.update(requestId, { status: 'accepted' });

      // Get both users' info
      const fromUser = await db.contacts.get(request.sender_id);
      const toUser = await db.contacts.get(request.receiver_id);

      const now = Date.now();

      // Create friendship for both users (mutual connection)
      // Note: In Supabase, the trigger will handle the server-side friendship creation
      // but we need to update local Dexie DB.

      await db.friends.bulkAdd([
        {
          id: `f_${request.sender_id}_${request.receiver_id}`,
          odm_odm_userId: request.sender_id,
          friendId: request.receiver_id,
          display_name: toUser?.display_name || 'Unknown',
          avatar: toUser?.avatar_url || '',
          odm: toUser?.odm || '',
          bio: toUser?.bio || '',
          is_online: false,
          last_seen: null,
          friendship_date: now,
          is_best_friend: false,
          is_close_friend: false,
          is_muted: false,
          nickname: null,
          private_note: null,
          mutual_friends_count: 0
        },
        {
          id: `f_${request.receiver_id}_${request.sender_id}`,
          odm_odm_userId: request.receiver_id,
          friendId: request.sender_id,
          display_name: fromUser?.display_name || 'Unknown',
          avatar: fromUser?.avatar_url || '',
          odm: fromUser?.odm || '',
          bio: fromUser?.bio || '',
          is_online: false,
          last_seen: null,
          friendship_date: now,
          is_best_friend: false,
          is_close_friend: false,
          is_muted: false,
          nickname: null,
          private_note: null,
          mutual_friends_count: 0
        }
      ] as any).catch(e => console.warn('Dexie friendship add warning:', e));

      // Sync to Supabase
      if (supabase) {
        await supabase.from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        // Friendships table insert is handled by DB trigger on friend_requests update to 'accepted'
      }

      return { success: true };
    } catch (error) {
      console.error('Accept friend request error:', error);
      return { success: false, error: 'Failed to accept request' };
    }
  }

  async declineFriendRequest(
    requestId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await db.friendRequests.get(requestId);

      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      await db.friendRequests.update(requestId, { status: 'declined' });

      if (supabase) {
        await supabase.from('friend_requests')
          .update({ status: 'declined' })
          .eq('id', requestId);
      }

      return { success: true };
    } catch (error) {
      console.error('Decline friend request error:', error);
      return { success: false, error: 'Failed to decline request' };
    }
  }

  async cancelFriendRequest(
    requestId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await db.friendRequests.get(requestId);

      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.sender_id !== this.currentUserId) {
        return { success: false, error: 'Cannot cancel this request' };
      }

      await db.friendRequests.update(requestId, { status: 'cancelled' });

      if (supabase) {
        await supabase.from('friend_requests')
          .update({ status: 'cancelled' })
          .eq('id', requestId);
      }

      return { success: true };
    } catch (error) {
      console.error('Cancel friend request error:', error);
      return { success: false, error: 'Failed to cancel request' };
    }
  }

  // ==================== FRIEND MANAGEMENT ====================

  async getFriends(options?: {
    sortBy?: 'name' | 'recent' | 'online' | 'friendship_date';
    filterBy?: 'all' | 'online' | 'best_friends' | 'close_friends';
    search?: string;
  }): Promise<Friend[]> {
    if (!this.currentUserId) return [];

    try {
      let friends = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .toArray();

      // Apply filters
      if (options?.filterBy) {
        switch (options.filterBy) {
          case 'online':
            friends = friends.filter(f => f.is_online);
            break;
          case 'best_friends':
            friends = friends.filter(f => f.is_best_friend);
            break;
          case 'close_friends':
            friends = friends.filter(f => f.is_close_friend);
            break;
        }
      }

      // Apply search
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        friends = friends.filter(f =>
          f.display_name?.toLowerCase().includes(searchLower) ||
          f.odm?.toLowerCase().includes(searchLower) ||
          f.nickname?.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      if (options?.sortBy) {
        switch (options.sortBy) {
          case 'name':
            friends.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
            break;
          case 'recent':
            friends.sort((a, b) => {
              const aTime = a.last_seen || 0;
              const bTime = b.last_seen || 0;
              return bTime - aTime;
            });
            break;
          case 'online':
            friends.sort((a, b) => {
              if (a.is_online && !b.is_online) return -1;
              if (!a.is_online && b.is_online) return 1;
              return 0;
            });
            break;
          case 'friendship_date':
            friends.sort((a, b) => (b.friendship_date || 0) - (a.friendship_date || 0));
            break;
        }
      }

      // Best friends always on top
      friends.sort((a, b) => {
        if (a.is_best_friend && !b.is_best_friend) return -1;
        if (!a.is_best_friend && b.is_best_friend) return 1;
        return 0;
      });

      return friends as Friend[];
    } catch (error) {
      console.error('Get friends error:', error);
      return [];
    }
  }

  async removeFriend(
    friendId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUserId) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      // Remove both friendship records
      await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === friendId)
        .delete();

      await db.friends
        .where('odm_odm_userId')
        .equals(friendId)
        .filter(f => f.friendId === this.currentUserId)
        .delete();

      if (supabase) {
        await supabase.from('friends')
          .delete()
          .or(`and(user_id.eq.${this.currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${this.currentUserId})`);
      }

      return { success: true };
    } catch (error) {
      console.error('Remove friend error:', error);
      return { success: false, error: 'Failed to remove friend' };
    }
  }

  async toggleBestFriend(friendId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const friend = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === friendId)
        .first();

      if (friend) {
        const newStatus = !friend.is_best_friend;
        await db.friends.update(friend.id, { is_best_friend: newStatus });
        return newStatus;
      }
      return false;
    } catch (error) {
      console.error('Toggle best friend error:', error);
      return false;
    }
  }

  async toggleCloseFriend(friendId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const friend = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === friendId)
        .first();

      if (friend) {
        const newStatus = !friend.is_close_friend;
        await db.friends.update(friend.id, { is_close_friend: newStatus });
        return newStatus;
      }
      return false;
    } catch (error) {
      console.error('Toggle close friend error:', error);
      return false;
    }
  }

  async setFriendNickname(friendId: string, nickname: string | null): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const friend = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === friendId)
        .first();

      if (friend) {
        await db.friends.update(friend.id, { nickname });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Set friend nickname error:', error);
      return false;
    }
  }

  async setPrivateNote(friendId: string, note: string | null): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const friend = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === friendId)
        .first();

      if (friend) {
        await db.friends.update(friend.id, { private_note: note });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Set private note error:', error);
      return false;
    }
  }

  async toggleMuteFriend(friendId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const friend = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .filter(f => f.friendId === friendId)
        .first();

      if (friend) {
        const newStatus = !friend.is_muted;
        await db.friends.update(friend.id, { is_muted: newStatus });
        return newStatus;
      }
      return false;
    } catch (error) {
      console.error('Toggle mute friend error:', error);
      return false;
    }
  }

  // ==================== BLOCKING ====================

  async blockUser(
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUserId) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      const existing = await db.blockedUsers
        .where('odm_userId')
        .equals(this.currentUserId)
        .filter(b => b.blocked_user_id === userId)
        .first();

      if (existing) {
        return { success: false, error: 'Already blocked' };
      }

      const user = await db.contacts.get(userId);

      await db.blockedUsers.add({
        id: `block_${this.currentUserId}_${userId}`,
        odm_userId: this.currentUserId,
        blocked_user_id: userId,
        user_name: user?.display_name || 'Unknown',
        user_avatar: user?.avatar_url || '',
        blocked_at: Date.now(),
        reason: reason || null
      } as any);

      await this.removeFriend(userId);

      await db.friendRequests
        .where('sender_id')
        .equals(this.currentUserId)
        .filter(r => r.receiver_id === userId && r.status === 'pending')
        .modify({ status: 'cancelled' });

      await db.friendRequests
        .where('sender_id')
        .equals(userId)
        .filter(r => r.receiver_id === this.currentUserId && r.status === 'pending')
        .modify({ status: 'declined' });

      if (supabase) {
        await supabase.from('blocked_users').insert({
          user_id: this.currentUserId,
          blocked_user_id: userId,
          reason: reason || null,
          blocked_at: new Date().toISOString()
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Block user error:', error);
      return { success: false, error: 'Failed to block user' };
    }
  }

  async unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUserId) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      await db.blockedUsers
        .where('odm_userId')
        .equals(this.currentUserId)
        .filter(b => b.blocked_user_id === userId)
        .delete();

      if (supabase) {
        await supabase.from('blocked_users')
          .delete()
          .eq('user_id', this.currentUserId)
          .eq('blocked_user_id', userId);
      }

      return { success: true };
    } catch (error) {
      console.error('Unblock user error:', error);
      return { success: false, error: 'Failed to unblock user' };
    }
  }

  async getBlockedUsers(): Promise<BlockedUser[]> {
    if (!this.currentUserId) return [];

    try {
      const blocked = await db.blockedUsers
        .where('odm_userId')
        .equals(this.currentUserId)
        .toArray();

      return blocked as any[];
    } catch (error) {
      console.error('Get blocked users error:', error);
      return [];
    }
  }

  async isBlocked(userId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const blocked = await db.blockedUsers
        .where('odm_userId')
        .equals(this.currentUserId)
        .filter(b => b.blocked_user_id === userId)
        .first();

      return !!blocked;
    } catch {
      return false;
    }
  }

  async isBlockedBy(userId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const blocked = await db.blockedUsers
        .where('odm_userId')
        .equals(userId)
        .filter(b => b.blocked_user_id === this.currentUserId)
        .first();

      return !!blocked;
    } catch {
      return false;
    }
  }

  // ==================== MUTUAL FRIENDS & SUGGESTIONS ====================

  async getMutualFriendsCount(userId: string): Promise<number> {
    if (!this.currentUserId) return 0;

    try {
      const myFriends = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .toArray();

      const theirFriends = await db.friends
        .where('odm_odm_userId')
        .equals(userId)
        .toArray();

      const myFriendIds = new Set(myFriends.map(f => f.friendId));
      const mutualCount = theirFriends.filter(f => myFriendIds.has(f.friendId)).length;

      return mutualCount;
    } catch {
      return 0;
    }
  }

  async getMutualFriends(userId: string): Promise<Friend[]> {
    if (!this.currentUserId) return [];

    try {
      const myFriends = await db.friends
        .where('odm_odm_userId')
        .equals(this.currentUserId)
        .toArray();

      const theirFriends = await db.friends
        .where('odm_odm_userId')
        .equals(userId)
        .toArray();

      const theirFriendIds = new Set(theirFriends.map(f => f.friendId));
      const mutualFriends = myFriends.filter(f => theirFriendIds.has(f.friendId));

      return mutualFriends as Friend[];
    } catch {
      return [];
    }
  }

  // ==================== SEARCH ====================

  async searchUsers(
    query: string,
    options?: {
      excludeFriends?: boolean;
      excludeBlocked?: boolean;
      limit?: number;
    }
  ): Promise<{
    id: string;
    display_name: string;
    odm: string;
    avatar: string;
    isFriend: boolean;
    isPending: boolean;
    mutual_friends_count: number;
    email?: string;
  }[]> {
    if (!this.currentUserId || !query.trim()) return [];

    try {
      const limit = options?.limit || 20;
      const queryLower = query.toLowerCase().trim();

      let results = await db.contacts
        .filter(c =>
          c.id !== this.currentUserId &&
          ((c.display_name || '').toLowerCase().includes(queryLower) ||
            (c.odm || '').toLowerCase().includes(queryLower) ||
            (c.email || '').toLowerCase().includes(queryLower))
        )
        .limit(limit)
        .toArray();

      if (supabase && results.length < limit) {
        const { data: supabaseResults } = await supabase
          .from('profiles')
          .select('id, display_name, odm, avatar_url')
          .or(`display_name.ilike.%${query}%,odm.ilike.%${query}%`)
          .neq('id', this.currentUserId)
          .limit(limit - results.length);

        if (supabaseResults) {
          for (const r of supabaseResults) {
            if (!results.find(lr => lr.id === r.id)) {
              results.push({
                id: r.id,
                display_name: r.display_name,
                odm: r.odm,
                avatar_url: r.avatar_url,
                email: ''
              } as any);
            }
          }
        }
      }

      const enrichedResults = await Promise.all(
        results.map(async (user) => {
          const isFriend = !!(await db.friends
            .where('odm_odm_userId')
            .equals(this.currentUserId!)
            .filter(f => f.friendId === user.id)
            .first());

          const sentRequest = await db.friendRequests
            .where('sender_id')
            .equals(this.currentUserId!)
            .filter(r => r.receiver_id === user.id && r.status === 'pending')
            .first();

          const receivedRequest = await db.friendRequests
            .where('sender_id')
            .equals(user.id)
            .filter(r => r.receiver_id === this.currentUserId! && r.status === 'pending')
            .first();

          const isPending = !!(sentRequest || receivedRequest);

          const isBlocked = await this.isBlocked(user.id);

          if (options?.excludeFriends && isFriend) return null;
          if (options?.excludeBlocked && isBlocked) return null;

          const mfc = await this.getMutualFriendsCount(user.id);

          return {
            id: user.id,
            display_name: user.display_name || 'Unknown',
            odm: user.odm || '',
            avatar: (user as any).avatar_url || (user as any).avatar || '',
            isFriend,
            isPending,
            mutual_friends_count: mfc
          };
        })
      );

      return enrichedResults.filter((r): r is NonNullable<typeof r> => r !== null);
    } catch (error) {
      console.error('Search users error:', error);
      return [];
    }
  }

  // ==================== PRIVACY ====================

  async getPrivacySettings(): Promise<PrivacySettings> {
    if (!this.currentUserId) {
      return this.getDefaultPrivacySettings();
    }

    try {
      const settings = await db.settings.get(`privacy_${this.currentUserId}`);
      if (settings?.value) {
        const parsedValue = (() => {
          try {
            return typeof settings.value === 'string' ? JSON.parse(settings.value) : settings.value;
          } catch {
            return {};
          }
        })();
        return { ...this.getDefaultPrivacySettings(), ...parsedValue };
      }
      return this.getDefaultPrivacySettings();
    } catch {
      return this.getDefaultPrivacySettings();
    }
  }

  private getDefaultPrivacySettings(): PrivacySettings {
    return {
      last_seen_visibility: 'everyone',
      profile_photo_visibility: 'everyone',
      bio_visibility: 'everyone',
      online_status_visibility: 'everyone',
      story_visibility: 'friends',
      can_receive_requests_from: 'everyone',
      show_mutual_friends: true,
      allow_friend_suggestions: true
    };
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const current = await this.getPrivacySettings();
      const updated = { ...current, ...settings };

      await db.settings.put({
        id: `privacy_${this.currentUserId}`,
        key: 'privacy',
        value: updated
      } as any);

      if (supabase) {
        await supabase.from('user_settings')
          .upsert({
            user_id: this.currentUserId,
            privacy_settings: updated
          });
      }

      return true;
    } catch (error) {
      console.error('Update privacy settings error:', error);
      return false;
    }
  }

  // ==================== INCOMING REQUESTS ====================

  async getIncomingRequests(): Promise<FriendRequest[]> {
    if (!this.currentUserId) return [];

    try {
      const requests = await db.friendRequests
        .where('receiver_id')
        .equals(this.currentUserId)
        .filter(r => r.status === 'pending')
        .reverse()
        .toArray();

      return requests as any[];
    } catch (error) {
      console.error('Get incoming requests error:', error);
      return [];
    }
  }

  async getOutgoingRequests(): Promise<FriendRequest[]> {
    if (!this.currentUserId) return [];

    try {
      const requests = await db.friendRequests
        .where('sender_id')
        .equals(this.currentUserId)
        .filter(r => r.status === 'pending')
        .reverse()
        .toArray();

      return requests as any[];
    } catch (error) {
      console.error('Get outgoing requests error:', error);
      return [];
    }
  }

  async getRequestsCount(): Promise<number> {
    if (!this.currentUserId) return 0;

    try {
      return await db.friendRequests
        .where('receiver_id')
        .equals(this.currentUserId)
        .filter(r => r.status === 'pending')
        .count();
    } catch {
      return 0;
    }
  }
}

export const FriendService = new FriendServiceClass();
export default FriendService;
