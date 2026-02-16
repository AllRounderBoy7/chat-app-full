import { useState } from 'react';
import { Search, UserPlus, Check, X, MessageCircle, Phone, Video, Users, Clock, UserMinus, Ban } from 'lucide-react';
import { useAppStore, type AppUser, type FriendRequest } from '@/store/appStore';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface FriendsViewProps {
  onStartChat: (user: AppUser) => void;
}

export function FriendsView({ onStartChat }: FriendsViewProps) {
  const {
    profile, friends, friendRequests, blockedUsers,
    setFriendRequests, addFriend, removeFriend, blockUser, unblockUser, allUsers
  } = useAppStore();
  
  const [activeSection, setActiveSection] = useState<'friends' | 'requests' | 'blocked' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const filteredFriends = friends.filter(f =>
    f.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const discoverUsers = allUsers.filter(u =>
    u.id !== profile?.id &&
    !friends.some(f => f.id === u.id) &&
    !blockedUsers.includes(u.id) &&
    (searchQuery ? (
      u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    ) : true)
  );

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (request.sender) {
      addFriend(request.sender);
    }
    setFriendRequests(friendRequests.filter(r => r.id !== request.id));
    
    try {
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', request.id);
      
      await supabase.from('friends').insert([
        { user_id: profile?.id, friend_id: request.sender_id, status: 'accepted' },
        { user_id: request.sender_id, friend_id: profile?.id, status: 'accepted' }
      ]);
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    setFriendRequests(friendRequests.filter(r => r.id !== request.id));
    
    try {
      await supabase
        .from('friend_requests')
        .update({ status: 'declined' })
        .eq('id', request.id);
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const handleSendRequest = async (user: AppUser) => {
    try {
      await supabase.from('friend_requests').insert({
        sender_id: profile?.id,
        receiver_id: user.id,
        status: 'pending'
      });
      alert('Friend request sent!');
    } catch (error) {
      console.error('Failed to send request:', error);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Remove this friend?')) return;
    
    removeFriend(friendId);
    
    try {
      await supabase
        .from('friends')
        .delete()
        .or(`user_id.eq.${profile?.id},friend_id.eq.${profile?.id}`)
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`);
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
    setSelectedUser(null);
  };

  const handleBlockUser = async (userId: string) => {
    if (!confirm('Block this user? They will not be able to message you.')) return;
    
    blockUser(userId);
    
    try {
      await supabase.from('blocked_users').insert({
        user_id: profile?.id,
        blocked_user_id: userId
      });
    } catch (error) {
      console.error('Failed to block user:', error);
    }
    setSelectedUser(null);
  };

  const handleUnblockUser = async (userId: string) => {
    unblockUser(userId);
    
    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', profile?.id)
        .eq('blocked_user_id', userId);
    } catch (error) {
      console.error('Failed to unblock user:', error);
    }
  };

  const blockedUsersList = allUsers.filter(u => blockedUsers.includes(u.id));

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-white dark:bg-slate-800 border-b dark:border-slate-700 overflow-x-auto">
        {[
          { id: 'friends', label: 'Friends', count: friends.length },
          { id: 'requests', label: 'Requests', count: friendRequests.length },
          { id: 'discover', label: 'Discover' },
          { id: 'blocked', label: 'Blocked', count: blockedUsers.length }
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as typeof activeSection)}
            className={cn(
              'flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors relative',
              activeSection === id
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                activeSection === id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Friends List */}
        {activeSection === 'friends' && (
          <div className="p-4 space-y-2">
            {filteredFriends.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  {searchQuery ? 'No friends found' : 'No friends yet'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'Try a different search' : 'Discover people to add as friends'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveSection('discover')}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-full"
                  >
                    Discover People
                  </button>
                )}
              </div>
            ) : (
              filteredFriends.map(friend => (
                <div
                  key={friend.id}
                  onClick={() => setSelectedUser(friend)}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="relative">
                    <img
                      src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                      alt=""
                      className="w-14 h-14 rounded-full"
                    />
                    {friend.is_online && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold dark:text-white">{friend.display_name}</h3>
                    <p className="text-sm text-gray-500">
                      {friend.is_online ? (
                        <span className="text-green-500">Online</span>
                      ) : friend.last_seen ? (
                        `Last seen ${formatDistanceToNow(new Date(friend.last_seen), { addSuffix: true })}`
                      ) : (
                        'Offline'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartChat(friend);
                    }}
                    className="p-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 rounded-full"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Friend Requests */}
        {activeSection === 'requests' && (
          <div className="p-4 space-y-2">
            {friendRequests.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No pending requests</h3>
                <p className="text-gray-500">Friend requests will appear here</p>
              </div>
            ) : (
              friendRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl"
                >
                  <img
                    src={request.sender?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.sender_id}`}
                    alt=""
                    className="w-14 h-14 rounded-full"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold dark:text-white">{request.sender?.display_name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-500">
                      @{request.sender?.username} • {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                    {request.message && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">"{request.message}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeclineRequest(request)}
                      className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleAcceptRequest(request)}
                      className="p-2 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Discover */}
        {activeSection === 'discover' && (
          <div className="p-4 space-y-2">
            {discoverUsers.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No users found</h3>
                <p className="text-gray-500">Try searching for someone</p>
              </div>
            ) : (
              discoverUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl"
                >
                  <div className="relative">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt=""
                      className="w-14 h-14 rounded-full"
                    />
                    {user.is_online && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold dark:text-white">{user.display_name}</h3>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </div>
                  <button
                    onClick={() => handleSendRequest(user)}
                    className="p-2 bg-indigo-600 text-white rounded-full"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Blocked Users */}
        {activeSection === 'blocked' && (
          <div className="p-4 space-y-2">
            {blockedUsersList.length === 0 ? (
              <div className="text-center py-12">
                <Ban className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No blocked users</h3>
                <p className="text-gray-500">Blocked users will appear here</p>
              </div>
            ) : (
              blockedUsersList.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl"
                >
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt=""
                    className="w-14 h-14 rounded-full grayscale"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold dark:text-white">{user.display_name}</h3>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </div>
                  <button
                    onClick={() => handleUnblockUser(user.id)}
                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 dark:text-white rounded-full"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setSelectedUser(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <img
                src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
                alt=""
                className="w-20 h-20 rounded-full"
              />
              <div>
                <h3 className="text-xl font-bold dark:text-white">{selectedUser.display_name}</h3>
                <p className="text-gray-500">@{selectedUser.username}</p>
                {selectedUser.bio && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{selectedUser.bio}</p>
                )}
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => {
                  onStartChat(selectedUser);
                  setSelectedUser(null);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Message
              </button>
              <button className="py-3 px-4 bg-gray-100 dark:bg-slate-700 rounded-xl">
                <Phone className="w-5 h-5 dark:text-white" />
              </button>
              <button className="py-3 px-4 bg-gray-100 dark:bg-slate-700 rounded-xl">
                <Video className="w-5 h-5 dark:text-white" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleRemoveFriend(selectedUser.id)}
                className="w-full p-4 flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <UserMinus className="w-5 h-5 text-orange-500" />
                <span className="dark:text-white">Remove Friend</span>
              </button>
              <button
                onClick={() => handleBlockUser(selectedUser.id)}
                className="w-full p-4 flex items-center gap-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
              >
                <Ban className="w-5 h-5" />
                <span>Block User</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-4 py-3 border dark:border-slate-600 rounded-xl dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
