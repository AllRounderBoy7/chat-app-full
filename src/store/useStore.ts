import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  is_online: boolean;
  last_seen?: string;
  is_admin?: boolean;
  is_suspended?: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  iv: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  file_url?: string;
  reply_to?: string;
  status: 'sent' | 'delivered' | 'read';
  reactions?: { [userId: string]: string };
  is_deleted?: boolean;
  edited_at?: string;
  created_at: string;
}

export interface Chat {
  id: string;
  user: AppUser;
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  sender?: AppUser;
  receiver?: AppUser;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  viewers: string[];
  created_at: string;
  expires_at: string;
  user?: AppUser;
}

export interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  type: 'voice' | 'video';
  status: 'missed' | 'answered' | 'declined';
  duration?: number;
  used_turn?: boolean;
  created_at: string;
  caller?: AppUser;
  receiver?: AppUser;
}

export interface AdminSettings {
  voice_calls_enabled: boolean;
  video_calls_enabled: boolean;
  stun_enabled: boolean;
  turn_enabled: boolean;
  stories_enabled: boolean;
  max_file_size_mb: number;
  max_message_length: number;
  max_friends: number;
  disappearing_messages_default: number; // hours, 0 = disabled
}

interface AppState {
  // Auth
  user: User | null;
  profile: AppUser | null;
  isAdmin: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: AppUser | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;

  // Navigation
  activeTab: 'chats' | 'stories' | 'friends' | 'calls' | 'settings' | 'admin';
  setActiveTab: (tab: 'chats' | 'stories' | 'friends' | 'calls' | 'settings' | 'admin') => void;

  // Chats
  chats: Chat[];
  activeChat: Chat | null;
  messages: { [chatId: string]: Message[] };
  setChats: (chats: Chat[]) => void;
  setActiveChat: (chat: Chat | null) => void;
  addMessage: (chatId: string, message: Message) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  updateMessageStatus: (chatId: string, messageId: string, status: 'delivered' | 'read') => void;

  // Friends
  friends: AppUser[];
  friendRequests: FriendRequest[];
  blockedUsers: string[];
  setFriends: (friends: AppUser[]) => void;
  setFriendRequests: (requests: FriendRequest[]) => void;
  setBlockedUsers: (users: string[]) => void;

  // Stories
  stories: Story[];
  setStories: (stories: Story[]) => void;

  // Calls
  callLogs: CallLog[];
  activeCall: { peerId: string; type: 'voice' | 'video'; isIncoming: boolean } | null;
  setCallLogs: (logs: CallLog[]) => void;
  setActiveCall: (call: { peerId: string; type: 'voice' | 'video'; isIncoming: boolean } | null) => void;

  // App Lock
  isAppLocked: boolean;
  appLockPin: string | null;
  lockedChats: string[];
  hiddenChats: string[];
  setIsAppLocked: (locked: boolean) => void;
  setAppLockPin: (pin: string | null) => void;
  setLockedChats: (chats: string[]) => void;
  setHiddenChats: (chats: string[]) => void;
  toggleChatLock: (chatId: string) => void;
  toggleChatHide: (chatId: string) => void;

  // Admin
  adminSettings: AdminSettings;
  allUsers: AppUser[];
  setAdminSettings: (settings: AdminSettings) => void;
  setAllUsers: (users: AppUser[]) => void;

  // UI State
  showInstallPrompt: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  setShowInstallPrompt: (show: boolean) => void;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  user: null,
  profile: null,
  isAdmin: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  // Navigation
  activeTab: 'chats',
  setActiveTab: (activeTab) => set({ activeTab }),

  // Chats
  chats: [],
  activeChat: null,
  messages: {},
  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChat) => set({ activeChat }),
  addMessage: (chatId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), message]
      }
    })),
  setMessages: (chatId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: messages }
    })),
  updateMessageStatus: (chatId, messageId, status) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: state.messages[chatId]?.map((m) =>
          m.id === messageId ? { ...m, status } : m
        ) || []
      }
    })),

  // Friends
  friends: [],
  friendRequests: [],
  blockedUsers: [],
  setFriends: (friends) => set({ friends }),
  setFriendRequests: (friendRequests) => set({ friendRequests }),
  setBlockedUsers: (blockedUsers) => set({ blockedUsers }),

  // Stories
  stories: [],
  setStories: (stories) => set({ stories }),

  // Calls
  callLogs: [],
  activeCall: null,
  setCallLogs: (callLogs) => set({ callLogs }),
  setActiveCall: (activeCall) => set({ activeCall }),

  // App Lock
  isAppLocked: false,
  appLockPin: localStorage.getItem('ourdm_app_lock_pin'),
  lockedChats: JSON.parse(localStorage.getItem('ourdm_locked_chats') || '[]'),
  hiddenChats: JSON.parse(localStorage.getItem('ourdm_hidden_chats') || '[]'),
  setIsAppLocked: (isAppLocked) => set({ isAppLocked }),
  setAppLockPin: (pin) => {
    if (pin) {
      localStorage.setItem('ourdm_app_lock_pin', pin);
    } else {
      localStorage.removeItem('ourdm_app_lock_pin');
    }
    set({ appLockPin: pin });
  },
  setLockedChats: (chats) => {
    localStorage.setItem('ourdm_locked_chats', JSON.stringify(chats));
    set({ lockedChats: chats });
  },
  setHiddenChats: (chats) => {
    localStorage.setItem('ourdm_hidden_chats', JSON.stringify(chats));
    set({ hiddenChats: chats });
  },
  toggleChatLock: (chatId) =>
    set((state) => {
      const locked = state.lockedChats.includes(chatId)
        ? state.lockedChats.filter((id) => id !== chatId)
        : [...state.lockedChats, chatId];
      localStorage.setItem('ourdm_locked_chats', JSON.stringify(locked));
      return { lockedChats: locked };
    }),
  toggleChatHide: (chatId) =>
    set((state) => {
      const hidden = state.hiddenChats.includes(chatId)
        ? state.hiddenChats.filter((id) => id !== chatId)
        : [...state.hiddenChats, chatId];
      localStorage.setItem('ourdm_hidden_chats', JSON.stringify(hidden));
      return { hiddenChats: hidden };
    }),

  // Admin
  adminSettings: {
    voice_calls_enabled: true,
    video_calls_enabled: true,
    stun_enabled: true,
    turn_enabled: true,
    stories_enabled: true,
    max_file_size_mb: 25,
    max_message_length: 5000,
    max_friends: 500,
    disappearing_messages_default: 0
  },
  allUsers: [],
  setAdminSettings: (adminSettings) => set({ adminSettings }),
  setAllUsers: (allUsers) => set({ allUsers }),

  // UI State
  showInstallPrompt: false,
  deferredPrompt: null,
  setShowInstallPrompt: (showInstallPrompt) => set({ showInstallPrompt }),
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt })
}));
