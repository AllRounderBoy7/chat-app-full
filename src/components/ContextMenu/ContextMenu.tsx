import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

export interface ContextMenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  color?: string;
  danger?: boolean;
  divider?: boolean;
  action: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  title?: string;
}

export function ContextMenu({ items, position, onClose, title }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Calculate position to ensure menu stays within viewport
  const getMenuStyle = () => {
    const menuWidth = 260;
    const menuHeight = items.length * 52 + (title ? 50 : 16);
    
    let x = position.x;
    let y = position.y;

    // Keep within horizontal bounds
    if (x + menuWidth > window.innerWidth - 16) {
      x = window.innerWidth - menuWidth - 16;
    }
    if (x < 16) x = 16;

    // Keep within vertical bounds
    if (y + menuHeight > window.innerHeight - 16) {
      y = window.innerHeight - menuHeight - 16;
    }
    if (y < 16) y = 16;

    return { left: x, top: y };
  };

  const handleItemClick = (item: ContextMenuItem) => {
    if (navigator.vibrate) navigator.vibrate(5);
    item.action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in min-w-[240px] max-w-[280px]"
        style={getMenuStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for mobile */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {title && (
          <div className="px-4 py-3 border-b dark:border-slate-700">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">{title}</p>
          </div>
        )}

        <div className="py-1">
          {items.map((item, index) => (
            <div key={item.id}>
              {item.divider && index > 0 && (
                <div className="h-px bg-gray-200 dark:bg-slate-700 my-1" />
              )}
              <button
                onClick={() => handleItemClick(item)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3.5 transition-colors",
                  "active:bg-gray-100 dark:active:bg-slate-700",
                  item.danger && "text-red-500"
                )}
              >
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center",
                  item.color || (item.danger ? "text-red-500" : "text-gray-500 dark:text-gray-400")
                )}>
                  {item.icon}
                </span>
                <span className={cn(
                  "font-medium",
                  item.danger ? "text-red-500" : "dark:text-white"
                )}>
                  {item.label}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Chat Context Menu Items Generator
export function getChatMenuItems(
  _chatId: string,
  isLocked: boolean,
  isHidden: boolean,
  isPinned: boolean,
  isMuted: boolean,
  isArchived: boolean,
  isBlocked: boolean,
  callbacks: {
    onLock: () => void;
    onHide: () => void;
    onPin: () => void;
    onMute: () => void;
    onArchive: () => void;
    onBlock: () => void;
    onClear: () => void;
    onDelete: () => void;
    onMarkRead: () => void;
  }
): ContextMenuItem[] {
  return [
    {
      id: 'pin',
      icon: <span className="text-lg">{isPinned ? '📍' : '📌'}</span>,
      label: isPinned ? 'Unpin Chat' : 'Pin Chat',
      action: callbacks.onPin,
    },
    {
      id: 'mute',
      icon: <span className="text-lg">{isMuted ? '🔔' : '🔇'}</span>,
      label: isMuted ? 'Unmute' : 'Mute Notifications',
      action: callbacks.onMute,
    },
    {
      id: 'archive',
      icon: <span className="text-lg">{isArchived ? '📤' : '📥'}</span>,
      label: isArchived ? 'Unarchive' : 'Archive Chat',
      action: callbacks.onArchive,
    },
    {
      id: 'lock',
      icon: <span className="text-lg">{isLocked ? '🔓' : '🔒'}</span>,
      label: isLocked ? 'Unlock Chat' : 'Lock Chat',
      color: 'text-indigo-500',
      action: callbacks.onLock,
    },
    {
      id: 'hide',
      icon: <span className="text-lg">{isHidden ? '👁️' : '🙈'}</span>,
      label: isHidden ? 'Unhide Chat' : 'Hide Chat',
      color: 'text-purple-500',
      action: callbacks.onHide,
    },
    {
      id: 'markRead',
      icon: <span className="text-lg">✓✓</span>,
      label: 'Mark as Read',
      divider: true,
      action: callbacks.onMarkRead,
    },
    {
      id: 'block',
      icon: <span className="text-lg">{isBlocked ? '✅' : '🚫'}</span>,
      label: isBlocked ? 'Unblock User' : 'Block User',
      color: isBlocked ? 'text-green-500' : 'text-orange-500',
      action: callbacks.onBlock,
    },
    {
      id: 'clear',
      icon: <span className="text-lg">🧹</span>,
      label: 'Clear Chat',
      divider: true,
      action: callbacks.onClear,
    },
    {
      id: 'delete',
      icon: <span className="text-lg">🗑️</span>,
      label: 'Delete Chat',
      danger: true,
      action: callbacks.onDelete,
    },
  ];
}

// Message Context Menu Items Generator
export function getMessageMenuItems(
  _messageId: string,
  isOwnMessage: boolean,
  isStarred: boolean,
  isPinned: boolean,
  _messageContent: string,
  callbacks: {
    onReply: () => void;
    onForward: () => void;
    onCopy: () => void;
    onStar: () => void;
    onPin: () => void;
    onEdit?: () => void;
    onDelete: () => void;
    onDeleteForEveryone?: () => void;
    onInfo: () => void;
  }
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      id: 'reply',
      icon: <span className="text-lg">↩️</span>,
      label: 'Reply',
      action: callbacks.onReply,
    },
    {
      id: 'forward',
      icon: <span className="text-lg">↪️</span>,
      label: 'Forward',
      action: callbacks.onForward,
    },
    {
      id: 'copy',
      icon: <span className="text-lg">📋</span>,
      label: 'Copy',
      action: callbacks.onCopy,
    },
    {
      id: 'star',
      icon: <span className="text-lg">{isStarred ? '⭐' : '☆'}</span>,
      label: isStarred ? 'Unstar' : 'Star Message',
      action: callbacks.onStar,
    },
    {
      id: 'pin',
      icon: <span className="text-lg">{isPinned ? '📍' : '📌'}</span>,
      label: isPinned ? 'Unpin' : 'Pin Message',
      action: callbacks.onPin,
      divider: true,
    },
  ];

  if (isOwnMessage && callbacks.onEdit) {
    items.push({
      id: 'edit',
      icon: <span className="text-lg">✏️</span>,
      label: 'Edit',
      color: 'text-blue-500',
      action: callbacks.onEdit,
    });
  }

  items.push({
    id: 'info',
    icon: <span className="text-lg">ℹ️</span>,
    label: 'Message Info',
    action: callbacks.onInfo,
  });

  items.push({
    id: 'delete',
    icon: <span className="text-lg">🗑️</span>,
    label: 'Delete for Me',
    danger: true,
    divider: true,
    action: callbacks.onDelete,
  });

  if (isOwnMessage && callbacks.onDeleteForEveryone) {
    items.push({
      id: 'deleteForEveryone',
      icon: <span className="text-lg">💨</span>,
      label: 'Delete for Everyone',
      danger: true,
      action: callbacks.onDeleteForEveryone,
    });
  }

  return items;
}
