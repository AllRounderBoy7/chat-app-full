import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  iv: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice' | 'location' | 'contact' | 'sticker' | 'system' | 'poll' | 'file';
  file_url?: string;
  thumbnail?: string;
  reply_to?: string;
  forwarded_from?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'scheduled';
  reactions?: Record<string, string[]>;
  is_deleted?: boolean;
  deleted_for_everyone?: boolean;
  edited_at?: string | number;
  created_at: string | number;
}

export interface Chat {
  id: string;
  order_id: string;
  user: AppUser;
  last_message?: Message;
  unread_count: number;
  is_typing?: boolean;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_archived?: boolean;
  disappearing_messages?: number;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  sender?: AppUser;
  receiver?: AppUser;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail?: string;
  caption?: string;
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
  status: 'missed' | 'answered' | 'declined' | 'busy' | 'no_answer';
  duration?: number;
  used_turn?: boolean;
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  created_at: string;
  ended_at?: string;
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
  disappearing_messages_hours: number;
  registration_enabled: boolean;
  maintenance_mode: boolean;
  announcement?: string;
  calls_enabled: boolean;
}

export interface ActiveCall {
  id: string;
  remoteUser: AppUser;
  type: 'voice' | 'video';
  isIncoming?: boolean;
  status: 'calling' | 'incoming' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'busy' | 'no_answer';
  startTime?: string;
  usedTurn?: boolean;
  incomingOffer?: any;
}

export interface Broadcast {
  id: string;
  admin_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent';
  read_by: string[];
  created_at: string;
}

interface PersistedState {
  theme: 'light' | 'dark';
  appLockPin: string | null;
  lockedChats: string[];
  hiddenChats: string[];
  pinnedChats: string[];
  mutedChats: string[];
  archivedChats: string[];
  adminSettings: AdminSettings;
  chatWallpapers: Record<string, string>;
  notificationSettings: {
    enabled: boolean;
    sound: boolean;
    vibrate: boolean;
    preview: boolean;
    groupEnabled: boolean;
    callEnabled: boolean;
  };
  privacySettings: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    onlineStatus: 'everyone' | 'contacts' | 'nobody';
    stories: 'everyone' | 'contacts';
    readReceipts: boolean;
    typingIndicator: boolean;
  };
  storageSettings: {
    autoDownloadPhotos: 'always' | 'wifi' | 'never';
    autoDownloadVideos: 'always' | 'wifi' | 'never';
    autoDownloadDocs: 'always' | 'wifi' | 'never';
    uploadQuality: 'original' | 'standard' | 'low';
  };
  accessibilitySettings: {
    fontSize: number;
    hapticFeedback: boolean;
    reduceMotion: boolean;
    highContrast: boolean;
  };
}

interface AppState extends PersistedState {
  // Auth
  user: User | null;
  profile: AppUser | null;
  isAdmin: boolean;
  isAuthenticated: boolean;

  // Navigation
  activeTab: 'chats' | 'stories' | 'friends' | 'calls' | 'settings' | 'admin';

  // Chats
  chats: Chat[];
  activeChat: Chat | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, boolean>;

  // Friends
  friends: AppUser[];
  friendRequests: FriendRequest[];
  blockedUsers: string[];

  // Stories
  stories: Story[];
  myStories: Story[];

  // Calls
  callLogs: CallLog[];
  activeCall: ActiveCall | null;

  // Security
  isAppLocked: boolean;
  showHiddenChats: boolean;

  // Admin
  allUsers: AppUser[];
  broadcasts: Broadcast[];

  // UI
  showInstallPrompt: boolean;
  isOnline: boolean;
  isSyncing: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: AppUser | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setChats: (chats: Chat[]) => void;
  setActiveChat: (chat: Chat | null) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (chatId: string, messageId: string, forEveryone?: boolean) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  setTypingUser: (chatId: string, isTyping: boolean) => void;
  setFriends: (friends: AppUser[]) => void;
  addFriend: (friend: AppUser) => void;
  removeFriend: (friendId: string) => void;
  setFriendRequests: (requests: FriendRequest[]) => void;
  addFriendRequest: (request: FriendRequest) => void;
  updateFriendRequest: (requestId: string, status: 'accepted' | 'declined') => void;
  setBlockedUsers: (users: string[]) => void;
  blockUser: (oderId: string) => void;
  unblockUser: (oderId: string) => void;
  setStories: (stories: Story[]) => void;
  addStory: (story: Story) => void;
  deleteStory: (storyId: string) => void;
  setMyStories: (stories: Story[]) => void;
  setCallLogs: (logs: CallLog[]) => void;
  addCallLog: (log: CallLog) => void;
  setActiveCall: (call: ActiveCall | null) => void;
  setIsAppLocked: (locked: boolean) => void;
  setAppLockPin: (pin: string | null) => void;
  toggleChatLock: (chatId: string) => void;
  toggleChatHide: (chatId: string) => void;
  toggleChatPin: (chatId: string) => void;
  toggleChatMute: (chatId: string) => void;
  toggleChatArchive: (chatId: string) => void;
  setShowHiddenChats: (show: boolean) => void;
  setChatWallpaper: (chatId: string, wallpaper: string | null) => void;
  setAdminSettings: (settings: Partial<AdminSettings>) => void;
  setAllUsers: (users: AppUser[]) => void;
  updateUser: (oderId: string, updates: Partial<AppUser>) => void;
  setBroadcasts: (broadcasts: Broadcast[]) => void;
  addBroadcast: (broadcast: Broadcast) => void;
  markBroadcastRead: (broadcastId: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setShowInstallPrompt: (show: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setIsSyncing: (syncing: boolean) => void;
  setNotificationSettings: (settings: Partial<AppState['notificationSettings']>) => void;
  setPrivacySettings: (settings: Partial<AppState['privacySettings']>) => void;
  setStorageSettings: (settings: Partial<AppState['storageSettings']>) => void;
  setAccessibilitySettings: (settings: Partial<AppState['accessibilitySettings']>) => void;
  logout: () => void;
  clearUnreadCount: (chatId: string) => void;
  incrementUnreadCount: (chatId: string) => void;
}

const defaultAdminSettings: AdminSettings = {
  voice_calls_enabled: true,
  video_calls_enabled: true,
  stun_enabled: true,
  turn_enabled: true,
  stories_enabled: true,
  max_file_size_mb: 25,
  max_message_length: 5000,
  max_friends: 500,
  disappearing_messages_hours: 0,
  registration_enabled: true,
  maintenance_mode: false,
  calls_enabled: true
};

const initialPersistedState: PersistedState = {
  theme: 'light',
  appLockPin: null,
  lockedChats: [],
  hiddenChats: [],
  pinnedChats: [],
  mutedChats: [],
  archivedChats: [],
  adminSettings: defaultAdminSettings,
  chatWallpapers: {},
  notificationSettings: {
    enabled: true,
    sound: true,
    vibrate: true,
    preview: true,
    groupEnabled: true,
    callEnabled: true
  },
  privacySettings: {
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    onlineStatus: 'everyone',
    stories: 'everyone',
    readReceipts: true,
    typingIndicator: true
  },
  storageSettings: {
    autoDownloadPhotos: 'wifi',
    autoDownloadVideos: 'never',
    autoDownloadDocs: 'never',
    uploadQuality: 'standard'
  },
  accessibilitySettings: {
    fontSize: 100,
    hapticFeedback: true,
    reduceMotion: false,
    highContrast: false
  }
};

const initialState = {
  ...initialPersistedState,
  user: null,
  profile: null,
  isAdmin: false,
  isAuthenticated: false,
  activeTab: 'chats' as const,
  chats: [],
  activeChat: null,
  messages: {},
  typingUsers: {},
  friends: [],
  friendRequests: [],
  blockedUsers: [],
  stories: [],
  myStories: [],
  callLogs: [],
  activeCall: null,
  isAppLocked: false,
  showHiddenChats: false,
  allUsers: [],
  broadcasts: [],
  showInstallPrompt: false,
  isOnline: true,
  isSyncing: false
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Auth actions
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

      // Navigation
      setActiveTab: (activeTab) => set({ activeTab }),

      // Chat actions
      setChats: (chats) => set({ chats }),
      setActiveChat: (activeChat) => set({ activeChat }),

      addMessage: (chatId, message) => set((state) => {
        const existingMessages = state.messages[chatId] || [];
        // Avoid duplicates
        if (existingMessages.some(m => m.id === message.id)) {
          return state;
        }

        const newMessages = [...existingMessages, message].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Update chat's last message
        const updatedChats = state.chats.map(chat =>
          chat.id === chatId
            ? { ...chat, last_message: message }
            : chat
        );

        return {
          messages: { ...state.messages, [chatId]: newMessages },
          chats: updatedChats
        };
      }),

      updateMessage: (chatId, messageId, updates) => set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          )
        }
      })),

      deleteMessage: (chatId, messageId, forEveryone = false) => set((state) => {
        if (forEveryone) {
          return {
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).map(msg =>
                msg.id === messageId
                  ? { ...msg, is_deleted: true, deleted_for_everyone: true, content: '', file_url: undefined }
                  : msg
              )
            }
          };
        }
        return {
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).filter(msg => msg.id !== messageId)
          }
        };
      }),

      setMessages: (chatId, messages) => set((state) => ({
        messages: { ...state.messages, [chatId]: messages }
      })),

      setTypingUser: (chatId, isTyping) => set((state) => ({
        typingUsers: { ...state.typingUsers, [chatId]: isTyping }
      })),

      clearUnreadCount: (chatId) => set((state) => ({
        chats: state.chats.map(chat =>
          chat.id === chatId ? { ...chat, unread_count: 0 } : chat
        )
      })),

      incrementUnreadCount: (chatId) => set((state) => ({
        chats: state.chats.map(chat =>
          chat.id === chatId ? { ...chat, unread_count: (chat.unread_count || 0) + 1 } : chat
        )
      })),

      // Friends actions
      setFriends: (friends) => set({ friends }),
      addFriend: (friend) => set((state) => ({
        friends: [...state.friends, friend]
      })),
      removeFriend: (friendId) => set((state) => ({
        friends: state.friends.filter(f => f.id !== friendId)
      })),

      setFriendRequests: (friendRequests) => set({ friendRequests }),
      addFriendRequest: (request) => set((state) => ({
        friendRequests: [...state.friendRequests, request]
      })),
      updateFriendRequest: (requestId, status) => set((state) => ({
        friendRequests: state.friendRequests.map(req =>
          req.id === requestId ? { ...req, status } : req
        ).filter(req => req.status === 'pending')
      })),

      setBlockedUsers: (blockedUsers) => set({ blockedUsers }),
      blockUser: (oderId) => set((state) => ({
        blockedUsers: [...state.blockedUsers, oderId],
        friends: state.friends.filter(f => f.id !== oderId)
      })),
      unblockUser: (oderId) => set((state) => ({
        blockedUsers: state.blockedUsers.filter(id => id !== oderId)
      })),

      // Stories actions
      setStories: (stories) => set({ stories }),
      addStory: (story) => set((state) => ({
        stories: [story, ...state.stories],
        myStories: story.user_id === state.profile?.id
          ? [story, ...state.myStories]
          : state.myStories
      })),
      deleteStory: (storyId) => set((state) => ({
        stories: state.stories.filter(s => s.id !== storyId),
        myStories: state.myStories.filter(s => s.id !== storyId)
      })),
      setMyStories: (myStories) => set({ myStories }),

      // Call actions
      setCallLogs: (callLogs) => set({ callLogs }),
      addCallLog: (log) => set((state) => ({
        callLogs: [log, ...state.callLogs]
      })),
      setActiveCall: (activeCall) => set({ activeCall }),

      // Security actions
      setIsAppLocked: (isAppLocked) => set({ isAppLocked }),
      setAppLockPin: (appLockPin) => set({ appLockPin }),

      toggleChatLock: (chatId) => set((state) => ({
        lockedChats: state.lockedChats.includes(chatId)
          ? state.lockedChats.filter(id => id !== chatId)
          : [...state.lockedChats, chatId]
      })),

      toggleChatHide: (chatId) => set((state) => ({
        hiddenChats: state.hiddenChats.includes(chatId)
          ? state.hiddenChats.filter(id => id !== chatId)
          : [...state.hiddenChats, chatId]
      })),

      toggleChatPin: (chatId) => set((state) => ({
        pinnedChats: state.pinnedChats.includes(chatId)
          ? state.pinnedChats.filter(id => id !== chatId)
          : [...state.pinnedChats, chatId]
      })),

      toggleChatMute: (chatId) => set((state) => ({
        mutedChats: state.mutedChats.includes(chatId)
          ? state.mutedChats.filter(id => id !== chatId)
          : [...state.mutedChats, chatId]
      })),

      toggleChatArchive: (chatId) => set((state) => ({
        archivedChats: state.archivedChats.includes(chatId)
          ? state.archivedChats.filter(id => id !== chatId)
          : [...state.archivedChats, chatId]
      })),

      setShowHiddenChats: (showHiddenChats) => set({ showHiddenChats }),

      setChatWallpaper: (chatId, wallpaper) => set((state) => {
        const newWallpapers = { ...state.chatWallpapers };
        if (wallpaper) {
          newWallpapers[chatId] = wallpaper;
        } else {
          delete newWallpapers[chatId];
        }
        return { chatWallpapers: newWallpapers };
      }),

      // Admin actions
      setAdminSettings: (settings) => set((state) => ({
        adminSettings: { ...state.adminSettings, ...settings }
      })),

      setAllUsers: (allUsers) => set({ allUsers }),

      updateUser: (oderId, updates) => set((state) => ({
        allUsers: state.allUsers.map(user =>
          user.id === oderId ? { ...user, ...updates } : user
        ),
        friends: state.friends.map(friend =>
          friend.id === oderId ? { ...friend, ...updates } : friend
        )
      })),

      setBroadcasts: (broadcasts) => set({ broadcasts }),
      addBroadcast: (broadcast) => set((state) => ({
        broadcasts: [broadcast, ...state.broadcasts]
      })),
      markBroadcastRead: (broadcastId) => set((state) => ({
        broadcasts: state.broadcasts.map(b =>
          b.id === broadcastId && state.profile
            ? { ...b, read_by: [...b.read_by, state.profile.id] }
            : b
        )
      })),

      // UI actions
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },
      setShowInstallPrompt: (showInstallPrompt) => set({ showInstallPrompt }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setIsSyncing: (isSyncing) => set({ isSyncing }),
      setNotificationSettings: (settings) => set((state) => ({
        notificationSettings: { ...state.notificationSettings, ...settings }
      })),
      setPrivacySettings: (settings) => set((state) => ({
        privacySettings: { ...state.privacySettings, ...settings }
      })),
      setStorageSettings: (settings) => set((state) => ({
        storageSettings: { ...state.storageSettings, ...settings }
      })),
      setAccessibilitySettings: (settings) => set((state) => ({
        accessibilitySettings: { ...state.accessibilitySettings, ...settings }
      })),

      // Logout
      logout: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.error('Logout error:', e);
        }

        set({
          ...initialState,
          // Preserve persisted settings
          theme: get().theme,
          adminSettings: get().adminSettings,
          notificationSettings: get().notificationSettings
        });
      }
    }),
    {
      name: 'ourdm-storage-v2',
      partialize: (state) => ({
        theme: state.theme,
        appLockPin: state.appLockPin,
        lockedChats: state.lockedChats,
        hiddenChats: state.hiddenChats,
        pinnedChats: state.pinnedChats,
        mutedChats: state.mutedChats,
        archivedChats: state.archivedChats,
        adminSettings: state.adminSettings,
        chatWallpapers: state.chatWallpapers,
        notificationSettings: state.notificationSettings,
        privacySettings: state.privacySettings,
        storageSettings: state.storageSettings,
        accessibilitySettings: state.accessibilitySettings
      })
    }
  )
);

// Helper hooks
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useProfile = () => useAppStore((state) => state.profile);
export const useIsAdmin = () => useAppStore((state) => state.isAdmin);
export const useActiveChat = () => useAppStore((state) => state.activeChat);
export const useTheme = () => useAppStore((state) => state.theme);
