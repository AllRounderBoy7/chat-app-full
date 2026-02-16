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

export interface FriendRequest {
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

export interface BlockedUser {
  id: string;
  odm_userId: string;
  userName: string;
  userAvatar: string;
  blockedAt: Date;
  reason: string | null;
}

export interface PrivacySettings {
  lastSeenVisibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  profilePhotoVisibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  bioVisibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  onlineStatusVisibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  storyVisibility: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  canReceiveRequestsFrom: 'everyone' | 'friends_of_friends' | 'nobody';
  showMutualFriends: boolean;
  allowFriendSuggestions: boolean;
}

// Friend Suggestions removed as per user request

// Friend Service Class
class FriendServiceClass {
  private currentUserId: string | null = null;

  setCurrentUser(userId: string) {
    this.currentUserId = userId;
  }

  // ==================== FRIEND REQUESTS ====================

  async sendFriendRequest(
    toUserId: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUserId) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      if (toUserId === this.currentUserId) {
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
        .filter(b => b.blockedUserId === toUserId)
        .first();
      
      if (blocked) {
        return { success: false, error: 'User is blocked. Unblock first.' };
      }

      // Check if request already pending
      const existingRequest = await db.friendRequests
        .where('fromUserId')
        .equals(this.currentUserId)
        .filter(r => r.toUserId === toUserId && r.status === 'pending')
        .first();
      
      if (existingRequest) {
        return { success: false, error: 'Request already sent' };
      }

      // Check if they sent you a request (auto-accept)
      const theirRequest = await db.friendRequests
        .where('fromUserId')
        .equals(toUserId)
        .filter(r => r.toUserId === this.currentUserId && r.status === 'pending')
        .first();
      
      if (theirRequest) {
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
        fromUserId: this.currentUserId,
        fromUserName: currentUser?.displayName || 'Unknown',
        fromUserAvatar: currentUser?.avatar || '',
        fromUserOdm: currentUser?.odm || '',
        toUserId,
        message: message || null,
        status: 'pending',
        createdAt: new Date(),
        mutualFriendsCount: mutualCount
      };

      await db.friendRequests.add(request as any);

      // Sync to Supabase
      if (supabase) {
        await supabase.from('friend_requests').insert({
          id: requestId,
          from_user_id: this.currentUserId,
          to_user_id: toUserId,
          message: message || null,
          status: 'pending',
          created_at: new Date().toISOString()
        });
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
      const fromUser = await db.contacts.get(request.fromUserId);
      const toUser = await db.contacts.get(request.toUserId);

      const friendshipDate = new Date();

      // Create friendship for user 1
      await db.friends.add({
        id: `f_${request.fromUserId}_${request.toUserId}`,
        odm_odm_userId: request.fromUserId,
        friendId: request.toUserId,
        displayName: toUser?.displayName || 'Unknown',
        avatar: toUser?.avatar || '',
        odm: toUser?.odm || '',
        bio: toUser?.bio || '',
        isOnline: false,
        lastSeen: null,
        friendshipDate,
        isBestFriend: false,
        isCloseFriend: false,
        isMuted: false,
        nickname: null,
        privateNote: null,
        mutualFriendsCount: 0
      } as any);

      // Create friendship for user 2
      await db.friends.add({
        id: `f_${request.toUserId}_${request.fromUserId}`,
        odm_odm_userId: request.toUserId,
        friendId: request.fromUserId,
        displayName: fromUser?.displayName || 'Unknown',
        avatar: fromUser?.avatar || '',
        odm: fromUser?.odm || '',
        bio: fromUser?.bio || '',
        isOnline: false,
        lastSeen: null,
        friendshipDate,
        isBestFriend: false,
        isCloseFriend: false,
        isMuted: false,
        nickname: null,
        privateNote: null,
        mutualFriendsCount: 0
      } as any);

      // Sync to Supabase
      if (supabase) {
        await supabase.from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        await supabase.from('friendships').insert([
          {
            user_id: request.fromUserId,
            friend_id: request.toUserId,
            created_at: friendshipDate.toISOString()
          },
          {
            user_id: request.toUserId,
            friend_id: request.fromUserId,
            created_at: friendshipDate.toISOString()
          }
        ]);
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

      if (request.fromUserId !== this.currentUserId) {
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
            friends = friends.filter(f => f.isOnline);
            break;
          case 'best_friends':
            friends = friends.filter(f => f.isBestFriend);
            break;
          case 'close_friends':
            friends = friends.filter(f => f.isCloseFriend);
            break;
        }
      }

      // Apply search
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        friends = friends.filter(f => 
          f.displayName?.toLowerCase().includes(searchLower) ||
          f.odm?.toLowerCase().includes(searchLower) ||
          f.nickname?.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      if (options?.sortBy) {
        switch (options.sortBy) {
          case 'name':
            friends.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
            break;
          case 'recent':
            friends.sort((a, b) => {
              const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
              const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
              return bTime - aTime;
            });
            break;
          case 'online':
            friends.sort((a, b) => {
              if (a.isOnline && !b.isOnline) return -1;
              if (!a.isOnline && b.isOnline) return 1;
              return 0;
            });
            break;
          case 'friendship_date':
            friends.sort((a, b) => 
              new Date(b.friendshipDate).getTime() - new Date(a.friendshipDate).getTime()
            );
            break;
        }
      }

      // Best friends always on top
      friends.sort((a, b) => {
        if (a.isBestFriend && !b.isBestFriend) return -1;
        if (!a.isBestFriend && b.isBestFriend) return 1;
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
        await supabase.from('friendships')
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
        const newStatus = !friend.isBestFriend;
        await db.friends.update(friend.id, { isBestFriend: newStatus });
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
        const newStatus = !friend.isCloseFriend;
        await db.friends.update(friend.id, { isCloseFriend: newStatus });
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
        await db.friends.update(friend.id, { privateNote: note });
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
        const newStatus = !friend.isMuted;
        await db.friends.update(friend.id, { isMuted: newStatus });
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
        .filter(b => b.blockedUserId === userId)
        .first();
      
      if (existing) {
        return { success: false, error: 'Already blocked' };
      }

      const user = await db.contacts.get(userId);

      await db.blockedUsers.add({
        id: `block_${this.currentUserId}_${userId}`,
        odm_userId: this.currentUserId,
        blockedUserId: userId,
        userName: user?.displayName || 'Unknown',
        userAvatar: user?.avatar || '',
        blockedAt: new Date(),
        reason: reason || null
      } as any);

      await this.removeFriend(userId);

      await db.friendRequests
        .where('fromUserId')
        .equals(this.currentUserId)
        .filter(r => r.toUserId === userId && r.status === 'pending')
        .modify({ status: 'cancelled' });
      
      await db.friendRequests
        .where('fromUserId')
        .equals(userId)
        .filter(r => r.toUserId === this.currentUserId && r.status === 'pending')
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
        .filter(b => b.blockedUserId === userId)
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
      
      return blocked as BlockedUser[];
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
        .filter(b => b.blockedUserId === userId)
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
        .filter(b => b.blockedUserId === this.currentUserId)
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

  // Friend Suggestions feature removed

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
    displayName: string;
    odm: string;
    avatar: string;
    isFriend: boolean;
    isPending: boolean;
    mutualFriendsCount: number;
  }[]> {
    if (!this.currentUserId || !query.trim()) return [];

    try {
      const limit = options?.limit || 20;
      const queryLower = query.toLowerCase().trim();

      let results = await db.contacts
        .filter(c => 
          c.id !== this.currentUserId &&
          ((c.displayName || '').toLowerCase().includes(queryLower) ||
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
                displayName: r.display_name,
                odm: r.odm,
                avatar: r.avatar_url,
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
            .where('fromUserId')
            .equals(this.currentUserId!)
            .filter(r => r.toUserId === user.id && r.status === 'pending')
            .first();

          const receivedRequest = await db.friendRequests
            .where('fromUserId')
            .equals(user.id)
            .filter(r => r.toUserId === this.currentUserId && r.status === 'pending')
            .first();

          const isPending = !!(sentRequest || receivedRequest);

          const isBlocked = await this.isBlocked(user.id);

          if (options?.excludeFriends && isFriend) return null;
          if (options?.excludeBlocked && isBlocked) return null;

          const mutualFriendsCount = await this.getMutualFriendsCount(user.id);

          return {
            id: user.id,
            displayName: user.displayName || 'Unknown',
            odm: user.odm || '',
            avatar: user.avatar || '',
            isFriend,
            isPending,
            mutualFriendsCount
          };
        })
      );

      return enrichedResults.filter(Boolean) as any;
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
        const parsedValue = typeof settings.value === 'string' ? JSON.parse(settings.value) : settings.value;
        return { ...this.getDefaultPrivacySettings(), ...parsedValue };
      }
      return this.getDefaultPrivacySettings();
    } catch {
      return this.getDefaultPrivacySettings();
    }
  }

  private getDefaultPrivacySettings(): PrivacySettings {
    return {
      lastSeenVisibility: 'everyone',
      profilePhotoVisibility: 'everyone',
      bioVisibility: 'everyone',
      onlineStatusVisibility: 'everyone',
      storyVisibility: 'friends',
      canReceiveRequestsFrom: 'everyone',
      showMutualFriends: true,
      allowFriendSuggestions: true
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
        .where('toUserId')
        .equals(this.currentUserId)
        .filter(r => r.status === 'pending')
        .reverse()
        .toArray();
      
      return requests as FriendRequest[];
    } catch (error) {
      console.error('Get incoming requests error:', error);
      return [];
    }
  }

  async getOutgoingRequests(): Promise<FriendRequest[]> {
    if (!this.currentUserId) return [];

    try {
      const requests = await db.friendRequests
        .where('fromUserId')
        .equals(this.currentUserId)
        .filter(r => r.status === 'pending')
        .reverse()
        .toArray();
      
      return requests as FriendRequest[];
    } catch (error) {
      console.error('Get outgoing requests error:', error);
      return [];
    }
  }

  async getRequestsCount(): Promise<number> {
    if (!this.currentUserId) return 0;

    try {
      return await db.friendRequests
        .where('toUserId')
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
