import { useState } from 'react';
import { Search, UserPlus, Check, X, MessageCircle, Phone, Video, Users, Clock, UserMinus, Ban, ShieldCheck } from 'lucide-react';
import { useAppStore, type AppUser, type FriendRequest } from '@/store/appStore';
import { cn } from '@/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { FriendService } from '@/services/FriendService';

interface FriendsViewProps {
  onStartChat: (user: AppUser) => void;
}

export function FriendsView({ onStartChat }: FriendsViewProps) {
  const {
    profile, friends, friendRequests, blockedUsers,
    setFriendRequests, addFriend, removeFriend, blockUser, unblockUser, allUsers,
    setActiveCall, adminSettings, hiddenChats, showHiddenChats
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<'friends' | 'requests' | 'blocked' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const matchesQuery = (u: AppUser, qRaw: string) => {
    const q = qRaw.trim().toLowerCase();
    if (!q) return true;
    const hay = `${u.id} ${u.display_name} ${u.username}`.toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every(t => hay.includes(t));
  };

  const filteredFriends = friends.filter(f => {
    // Hide friend if their chat is hidden and hidden chats are not revealed
    if (hiddenChats.includes(f.id) && !showHiddenChats) return false;

    return matchesQuery(f, searchQuery);
  });

  const discoverUsers = allUsers.filter(u =>
    u.id !== profile?.id &&
    !friends.some(f => f.id === u.id) &&
    !blockedUsers.includes(u.id) &&
    matchesQuery(u, searchQuery)
  );

  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      const result = await FriendService.acceptFriendRequest(request.id);
      if (result.success) {
        if (request.sender) addFriend(request.sender);
        setFriendRequests(friendRequests.filter(r => r.id !== request.id));
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    try {
      const result = await FriendService.declineFriendRequest(request.id);
      if (result.success) {
        setFriendRequests(friendRequests.filter(r => r.id !== request.id));
      }
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const handleSendRequest = async (user: AppUser) => {
    if (user.id === profile?.id) {
      alert("You cannot send a friend request to yourself.");
      return;
    }

    if (pendingRequests.has(user.id)) return;

    setPendingRequests(prev => new Set(prev).add(user.id));
    try {
      const result = await FriendService.sendFriendRequestByUsername(user.username);
      if (!result.success) {
        alert(result.error);
      }
    } catch (error) {
      console.error('Failed to send request:', error);
    } finally {
      setPendingRequests(prev => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Remove this friend?')) return;

    try {
      const result = await FriendService.removeFriend(friendId);
      if (result.success) {
        removeFriend(friendId);
        setSelectedUser(null);
      } else {
        alert(result.error || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!confirm('Block this user? They will not be able to message you.')) return;

    try {
      const result = await FriendService.blockUser(userId);
      if (result.success) {
        blockUser(userId);
        setSelectedUser(null);
      } else {
        alert(result.error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Failed to block user:', error);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      const result = await FriendService.unblockUser(userId);
      if (result.success) {
        unblockUser(userId);
      } else {
        alert(result.error || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
    }
  };

  const handleVoiceCall = (user: AppUser) => {
    if (!adminSettings.calls_enabled) {
      alert('Calls are currently disabled by the admin.');
      return;
    }
    setActiveCall({
      id: crypto.randomUUID(),
      type: 'voice',
      status: 'calling',
      remoteUser: user,
      startTime: new Date().toISOString()
    });
    setSelectedUser(null);
  };

  const handleVideoCall = (user: AppUser) => {
    if (!adminSettings.calls_enabled) {
      alert('Calls are currently disabled by the admin.');
      return;
    }
    setActiveCall({
      id: crypto.randomUUID(),
      type: 'video',
      status: 'calling',
      remoteUser: user,
      startTime: new Date().toISOString()
    });
    setSelectedUser(null);
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
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-2 gap-2 overflow-x-auto scrollbar-hide">
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
              'flex-1 min-w-[90px] py-2.5 px-4 text-xs font-bold transition-all rounded-xl border-2 flex items-center justify-center gap-1.5 whitespace-nowrap',
              activeSection === id
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-105 z-10'
                : 'bg-transparent border-gray-100 dark:border-slate-800 text-gray-500 hover:border-gray-200 dark:hover:border-slate-700'
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 text-[10px] rounded-full',
                activeSection === id
                  ? 'bg-white text-indigo-600'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-600'
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
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-indigo-300 dark:text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  {searchQuery ? 'No friends found' : 'No friends yet'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                  {searchQuery ? 'Try a different search' : 'Discover people to add as friends'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveSection('discover')}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-medium"
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
                  className={cn(
                    'flex items-center gap-3 p-4 mx-2 my-1 cursor-pointer rounded-2xl active:scale-[0.98] transition-all',
                    'bg-white dark:bg-slate-900 premium-card shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-slate-800'
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 dark:border-slate-800"
                    />
                    {friend.is_online && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold dark:text-white truncate">{friend.display_name}</h3>
                    <p className="text-sm truncate">
                      {friend.is_online ? (
                        <span className="text-green-500 font-medium">Online</span>
                      ) : friend.last_seen ? (
                        <span className="text-gray-400">{formatDistanceToNow(new Date(friend.last_seen), { addSuffix: true })}</span>
                      ) : (
                        <span className="text-gray-400">Offline</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {adminSettings.calls_enabled && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVoiceCall(friend); }}
                        className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartChat(friend);
                      }}
                      className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Friend Requests */}
        {activeSection === 'requests' && (
          <div className="p-4 space-y-3">
            {friendRequests.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No pending requests</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Friend requests will appear here</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase px-1">
                  {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}
                </p>
                {friendRequests.map(request => (
                  <div
                    key={request.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm animate-fade-in"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={request.sender?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.sender_id}`}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold dark:text-white truncate">{request.sender?.display_name || 'Unknown'}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{request.sender?.username} · {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                        {request.message && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">"{request.message}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeclineRequest(request)}
                        className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </button>
                      <button
                        onClick={() => handleAcceptRequest(request)}
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Discover */}
        {activeSection === 'discover' && (
          <div className="p-4 space-y-2">
            {discoverUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No users found</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Try searching for someone by name or username</p>
              </div>
            ) : (
              discoverUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-4 mx-2 my-1 bg-white dark:bg-slate-900 premium-card shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-slate-800 rounded-2xl"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    {user.is_online && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold dark:text-white truncate">{user.display_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                    {user.bio && <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{user.bio}</p>}
                  </div>
                  <button
                    onClick={() => handleSendRequest(user)}
                    disabled={pendingRequests.has(user.id)}
                    className={cn(
                      'p-2.5 rounded-full transition-all active:scale-95 shadow-sm',
                      pendingRequests.has(user.id)
                        ? 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    )}
                  >
                    {pendingRequests.has(user.id) ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
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
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No blocked users</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Blocked users will appear here</p>
              </div>
            ) : (
              blockedUsersList.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm"
                >
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt=""
                    className="w-14 h-14 rounded-full grayscale opacity-60 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold dark:text-white truncate">{user.display_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                  </div>
                  <button
                    onClick={() => handleUnblockUser(user.id)}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 dark:text-white rounded-full font-medium active:scale-95 transition-transform"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="bottom-sheet-handle mb-4" />

            {/* Profile */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <img
                  src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover"
                />
                {selectedUser.is_online && (
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold dark:text-white truncate">{selectedUser.display_name}</h3>
                <p className="text-gray-500 dark:text-gray-400">@{selectedUser.username}</p>
                {selectedUser.bio && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{selectedUser.bio}</p>
                )}
                <p className="text-xs mt-1">
                  {selectedUser.is_online
                    ? <span className="text-green-500 font-medium">● Online</span>
                    : <span className="text-gray-400">Offline</span>
                  }
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-5">
              <button
                onClick={() => {
                  onStartChat(selectedUser);
                  setSelectedUser(null);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl flex items-center justify-center gap-2 font-medium active:scale-95 transition-transform"
              >
                <MessageCircle className="w-5 h-5" />
                Message
              </button>
              {adminSettings.calls_enabled && (
                <>
                  <button
                    onClick={() => handleVoiceCall(selectedUser)}
                    className="py-3 px-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                    title="Voice Call"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleVideoCall(selectedUser)}
                    className="py-3 px-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                    title="Video Call"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Danger Actions */}
            <div className="space-y-1 border-t dark:border-slate-700 pt-4">
              <button
                onClick={() => handleRemoveFriend(selectedUser.id)}
                className="w-full p-3.5 flex items-center gap-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <UserMinus className="w-4 h-4 text-orange-500" />
                </div>
                <span className="font-medium dark:text-white">Remove Friend</span>
              </button>
              <button
                onClick={() => handleBlockUser(selectedUser.id)}
                className="w-full p-3.5 flex items-center gap-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Ban className="w-4 h-4 text-red-500" />
                </div>
                <span className="font-medium text-red-500">Block User</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-3 py-3 border dark:border-slate-600 rounded-2xl dark:text-white font-medium active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
