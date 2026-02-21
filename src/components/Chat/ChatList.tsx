import { useState, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { MessageCircle, Lock, Pin, Search, Check, CheckCheck, Image, Video, Mic, FileText, X, Trash2, Bell, Archive } from 'lucide-react';
import { useAppStore, type Chat } from '@/store/appStore';
import { cn } from '@/utils/cn';

interface ChatListProps {
  onSelectChat: (chat: Chat) => void;
  onLongPress: (chat: Chat, e: React.TouchEvent | React.MouseEvent) => void;
}

export function ChatList({ onSelectChat, onLongPress }: ChatListProps) {
  const {
    chats,
    lockedChats,
    hiddenChats,
    showHiddenChats,
    archivedChats,
    pinnedChats,
    mutedChats,
    profile,
    toggleChatArchive,
    toggleChatMute,
    setChats
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const [swipeStates, setSwipeStates] = useState<Record<string, number>>({});

  // Filter and sort chats
  const visibleChats = chats.filter(chat => {
    const isHidden = hiddenChats.includes(chat.id);
    const isArchived = archivedChats.includes(chat.id);
    const matchesSearch = chat.user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.user.username.toLowerCase().includes(searchQuery.toLowerCase());

    if (showHiddenChats) {
      return isHidden && matchesSearch;
    }
    return !isHidden && !isArchived && matchesSearch;
  });

  const sortedChats = [...visibleChats].sort((a, b) => {
    // Pinned chats first
    const aPinned = pinnedChats.includes(a.id);
    const bPinned = pinnedChats.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // Then by last message time
    const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
    const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
    return bTime - aTime;
  });

  const handleTouchStart = (chat: Chat, e: React.TouchEvent) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(chat, e);
    }, 500);
  };

  const handleTouchEnd = (chat: Chat) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      onSelectChat(chat);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Swipe handlers
  const handleSwipeStart = (chatId: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    
    const handleSwipeMove = (moveEvent: TouchEvent) => {
      const currentX = moveEvent.touches[0].clientX;
      const diffX = startX - currentX;
      const swipePercentage = Math.max(-100, Math.min(100, (diffX / 200) * 100));
      
      setSwipeStates(prev => ({
        ...prev,
        [chatId]: swipePercentage
      }));
    };

    const handleSwipeEnd = () => {
      const finalSwipe = swipeStates[chatId] || 0;
      
      if (Math.abs(finalSwipe) > 50) {
        // Perform action based on swipe direction
        if (finalSwipe < -50) {
          // Swipe right - archive/unarchive
          toggleChatArchive(chatId);
        } else if (finalSwipe > 50) {
          // Swipe left - mute/unmute or delete
          if (archivedChats.includes(chatId)) {
            // Delete archived chats
            setChats(chats.filter(c => c.id !== chatId));
          } else {
            // Mute/unmute regular chats
            toggleChatMute(chatId);
          }
        }
      }
      
      // Reset swipe state
      setSwipeStates(prev => ({
        ...prev,
        [chatId]: 0
      }));
      
      document.removeEventListener('touchmove', handleSwipeMove);
      document.removeEventListener('touchend', handleSwipeEnd);
    };

    document.addEventListener('touchmove', handleSwipeMove);
    document.addEventListener('touchend', handleSwipeEnd);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yy');
  };

  const getMessagePreview = (chat: Chat) => {
    if (lockedChats.includes(chat.id)) {
      return <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Chat locked</span>;
    }

    if (chat.is_typing) {
      return <span className="text-indigo-500 italic">typing...</span>;
    }

    if (!chat.last_message) {
      return <span className="text-gray-400">No messages yet</span>;
    }

    if (chat.last_message.is_deleted) {
      return <span className="italic text-gray-400">Message deleted</span>;
    }

    const isMe = chat.last_message.sender_id === profile?.id;
    let preview = '';
    let icon = null;

    switch (chat.last_message.type) {
      case 'image':
        icon = <Image className="w-4 h-4" />;
        preview = 'Photo';
        break;
      case 'video':
        icon = <Video className="w-4 h-4" />;
        preview = 'Video';
        break;
      case 'audio':
        icon = <Mic className="w-4 h-4" />;
        preview = 'Voice message';
        break;
      case 'document':
        icon = <FileText className="w-4 h-4" />;
        preview = 'Document';
        break;
      default:
        // Messages are AES-encrypted, not plain base64 - show generic preview
        preview = 'Message';
    }

    return (
      <span className="flex items-center gap-1.5">
        {isMe && (
          <span className={cn(
            'flex-shrink-0',
            chat.last_message.status === 'read' ? 'text-blue-500' : 'text-gray-400'
          )}>
            {chat.last_message.status === 'sent' ? (
              <Check className="w-4 h-4" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
          </span>
        )}
        {icon && <span className="flex-shrink-0 text-gray-400">{icon}</span>}
        <span className="truncate">{preview}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="px-4 py-4 flex-shrink-0">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity blur-xl" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors z-10" />
          <input
            type="text"
            placeholder="Search chats or start new one..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-base placeholder-gray-400 dark:placeholder-gray-500 border border-transparent focus:border-indigo-200 dark:focus:border-indigo-800 transition-all group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm hover:shadow-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {sortedChats.map((chat) => {
          const isPinned = pinnedChats.includes(chat.id);
          const isMuted = mutedChats.includes(chat.id);
          const isLocked = lockedChats.includes(chat.id);

          return (
            <div
              key={chat.id}
              onContextMenu={(e) => {
                e.preventDefault();
                onLongPress(chat, e);
              }}
              onTouchStart={(e) => {
                handleTouchStart(chat, e);
                handleSwipeStart(chat.id, e);
              }}
              onTouchEnd={() => handleTouchEnd(chat)}
              onTouchMove={handleTouchMove}
              onClick={() => onSelectChat(chat)}
              className={cn(
                'flex items-center gap-4 px-4 py-4 mx-3 my-2 cursor-pointer rounded-3xl transition-all duration-200 group relative overflow-hidden',
                'bg-white dark:bg-slate-800 shadow-lg border border-transparent hover:border-indigo-200 dark:hover:border-slate-700',
                'active:scale-[0.98] active:shadow-xl hover:shadow-xl hover:bg-gradient-to-r hover:from-white hover:to-indigo-50 dark:hover:from-slate-800 dark:hover:to-slate-700/50'
              )}
              style={{
                transform: `translateX(${swipeStates[chat.id] || 0}px)`
              }}
            >
              {/* Swipe indicators */}
              {swipeStates[chat.id] && Math.abs(swipeStates[chat.id]) > 20 && (
                <>
                  {/* Left swipe indicator (mute/delete) */}
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded-full shadow-lg z-20">
                    {archivedChats.includes(chat.id) ? (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span className="text-xs font-medium">Delete</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4" />
                        <span className="text-xs font-medium">Mute</span>
                      </>
                    )}
                  </div>
                  
                  {/* Right swipe indicator (archive) */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg z-20">
                    <Archive className="w-4 h-4" />
                    <span className="text-xs font-medium">Archive</span>
                  </div>
                </>
              )}
              
              {/* Subtle background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
              
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="relative">
                  <img
                    src={chat.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.user.username}`}
                    alt=""
                    className="w-16 h-16 rounded-2xl object-cover bg-gray-100 dark:bg-slate-700 border-2 border-white dark:border-slate-600 shadow-md group-hover:shadow-lg transition-shadow"
                  />
                  {chat.user.is_online && (
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 rounded-full border-3 border-white dark:border-slate-800 shadow-md animate-pulse" />
                  )}
                  {isLocked && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800">
                      <Lock className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Info */}
              <div className="flex-1 min-w-0 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPinned && (
                      <div className="p-1 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                        <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 rotate-45" />
                      </div>
                    )}
                    <h3 className="font-bold text-lg truncate dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {chat.user.display_name}
                    </h3>
                  </div>
                  {chat.last_message && (
                    <span className={cn(
                      'text-xs flex-shrink-0 ml-2 font-medium px-2 py-1 rounded-full',
                      chat.unread_count && chat.unread_count > 0
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700'
                    )}>
                      {formatTime(String(chat.last_message.created_at))}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 font-medium">
                    {getMessagePreview(chat)}
                  </p>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {isMuted && (
                      <div className="w-6 h-6 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <span className="text-gray-400 text-xs">🔇</span>
                      </div>
                    )}
                    {chat.unread_count !== undefined && chat.unread_count > 0 && (
                      <span className="min-w-[24px] h-[24px] px-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce">
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sortedChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-6 shadow-xl">
              <MessageCircle className="w-12 h-12 text-indigo-400 dark:text-indigo-500" />
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">✨</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-3 text-center">
              {searchQuery ? 'No chats found' : showHiddenChats ? 'No hidden chats' : 'No chats yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed max-w-xs">
              {searchQuery
                ? 'Try adjusting your search terms or filters'
                : showHiddenChats
                  ? 'Your hidden chats will appear here for privacy'
                  : 'Start connecting! Search for friends and begin amazing conversations'
              }
            </p>
            {!searchQuery && !showHiddenChats && (
              <div className="mt-8 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>Online users ready to connect</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                  <span>End-to-end encrypted messaging</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
