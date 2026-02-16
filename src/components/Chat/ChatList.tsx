import { useState, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { MessageCircle, Lock, Pin, Search, Check, CheckCheck, Image, Video, Mic, FileText } from 'lucide-react';
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
    profile
  } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

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
    const aTime = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
    const bTime = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
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
    
    if (chat.isTyping) {
      return <span className="text-indigo-500 italic">typing...</span>;
    }
    
    if (!chat.lastMessage) {
      return <span className="text-gray-400">No messages yet</span>;
    }
    
    if (chat.lastMessage.is_deleted) {
      return <span className="italic text-gray-400">Message deleted</span>;
    }
    
    const isMe = chat.lastMessage.sender_id === profile?.id;
    let preview = '';
    let icon = null;
    
    switch (chat.lastMessage.type) {
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
        try {
          preview = atob(chat.lastMessage.content).substring(0, 35);
          if (atob(chat.lastMessage.content).length > 35) preview += '...';
        } catch {
          preview = 'Message';
        }
    }
    
    return (
      <span className="flex items-center gap-1.5">
        {isMe && (
          <span className={cn(
            'flex-shrink-0',
            chat.lastMessage.status === 'read' ? 'text-blue-500' : 'text-gray-400'
          )}>
            {chat.lastMessage.status === 'sent' ? (
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
      <div className="px-4 py-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-base"
          />
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
              onTouchStart={(e) => handleTouchStart(chat, e)}
              onTouchEnd={() => handleTouchEnd(chat)}
              onTouchMove={handleTouchMove}
              onClick={() => onSelectChat(chat)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-slate-800 transition-colors',
                'active:bg-gray-50 dark:active:bg-slate-800/50',
                'long-press-highlight'
              )}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={chat.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.user.username}`}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover bg-gray-200 dark:bg-slate-700"
                />
                {chat.user.is_online && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                )}
                {isLocked && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                    <Lock className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {/* Chat Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isPinned && <Pin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 rotate-45" />}
                    <h3 className="font-semibold truncate dark:text-white">
                      {chat.user.display_name}
                    </h3>
                  </div>
                  {chat.lastMessage && (
                    <span className={cn(
                      'text-xs flex-shrink-0 ml-2',
                      chat.unreadCount && chat.unreadCount > 0 
                        ? 'text-indigo-600 dark:text-indigo-400 font-medium' 
                        : 'text-gray-500 dark:text-gray-400'
                    )}>
                      {formatTime(chat.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">
                    {getMessagePreview(chat)}
                  </p>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    {isMuted && (
                      <span className="text-gray-400 text-sm">🔇</span>
                    )}
                    {chat.unreadCount !== undefined && chat.unreadCount > 0 && (
                      <span className="min-w-[22px] h-[22px] px-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sortedChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
              {searchQuery ? 'No chats found' : showHiddenChats ? 'No hidden chats' : 'No chats yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
              {searchQuery 
                ? 'Try a different search term'
                : showHiddenChats
                  ? 'Hidden chats will appear here'
                  : 'Start a conversation by searching for friends'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
