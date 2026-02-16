import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore, type Chat, type AppUser, type Story, type CallLog, type Broadcast } from './store/appStore';
import { supabase } from './lib/supabase';
import { initializeDatabase, requestPersistentStorage } from './lib/database';
import { initMediaStorage } from './lib/mediaStorage';
import { initSyncService, subscribeToRealtime, stopSyncService } from './lib/syncService';
import { AuthScreen } from './components/Auth/AuthScreen';
import { ChatList } from './components/Chat/ChatList';
import { ChatView } from './components/Chat/ChatView';
import { CallScreen } from './components/Calls/CallScreen';
import { AdminPanel } from './components/Admin/AdminPanel';
import { StoriesView } from './components/Stories/StoriesView';
import { FriendsView } from './components/Friends/FriendsView';
import { CallsView } from './components/Calls/CallsView';
import { SettingsView } from './components/Settings/SettingsView';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { 
  MessageCircle, Users, Phone, Settings, Lock, Download, 
  Shield, Search, UserPlus, Bell, Wifi, WifiOff, RefreshCw,
  Archive, Eye, EyeOff, ChevronLeft
} from 'lucide-react';
import { cn } from './utils/cn';

const APP_VERSION = '3.0.0';

// Demo data for testing
const DEMO_USERS: AppUser[] = [
  { id: '1', email: 'alice@demo.com', display_name: 'Alice Johnson', username: 'alice', is_online: true, created_at: new Date().toISOString(), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice' },
  { id: '2', email: 'bob@demo.com', display_name: 'Bob Smith', username: 'bob', is_online: true, created_at: new Date().toISOString(), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob' },
  { id: '3', email: 'carol@demo.com', display_name: 'Carol Williams', username: 'carol', is_online: false, last_seen: new Date(Date.now() - 3600000).toISOString(), created_at: new Date().toISOString(), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carol' },
  { id: '4', email: 'dave@demo.com', display_name: 'Dave Brown', username: 'dave', is_online: false, last_seen: new Date(Date.now() - 7200000).toISOString(), created_at: new Date().toISOString(), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dave' },
  { id: '5', email: 'emma@demo.com', display_name: 'Emma Davis', username: 'emma', is_online: true, created_at: new Date().toISOString(), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma' },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Custom hook for haptic feedback
const useHaptic = () => {
  const vibrate = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };
  return { vibrate };
};

// Pin Pad Component for better mobile UX
function PinPad({ 
  value, 
  onChange, 
  onComplete,
  disabled = false 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onComplete?: (pin: string) => void;
  disabled?: boolean;
}) {
  const { vibrate } = useHaptic();
  
  const handlePress = (num: string) => {
    if (disabled) return;
    vibrate(5);
    const newValue = value + num;
    onChange(newValue);
    if (newValue.length === 4 && onComplete) {
      setTimeout(() => onComplete(newValue), 100);
    }
  };
  
  const handleDelete = () => {
    if (disabled) return;
    vibrate(5);
    onChange(value.slice(0, -1));
  };
  
  return (
    <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((item, i) => (
        <button
          key={i}
          onClick={() => {
            if (item === 'del') handleDelete();
            else if (item !== '') handlePress(String(item));
          }}
          disabled={disabled || item === ''}
          className={cn(
            'h-16 w-16 mx-auto rounded-full flex items-center justify-center text-2xl font-medium transition-all touch-active',
            item === '' ? 'opacity-0' : 'bg-white/10 hover:bg-white/20 active:scale-90',
            disabled && 'opacity-50'
          )}
        >
          {item === 'del' ? (
            <ChevronLeft className="w-6 h-6" />
          ) : (
            <span className="text-white">{item}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const store = useAppStore();
  const {
    profile, isAuthenticated, isAdmin, activeTab, setActiveTab,
    chats, setChats, activeChat, setActiveChat, activeCall, setActiveCall,
    friends, setFriends, appLockPin, isAppLocked, setIsAppLocked,
    theme, showInstallPrompt, setShowInstallPrompt,
    adminSettings, lockedChats, hiddenChats, pinnedChats, mutedChats,
    toggleChatLock, toggleChatHide, toggleChatPin, toggleChatMute, toggleChatArchive,
    setAppLockPin, callLogs, setCallLogs, stories, setStories, allUsers, setAllUsers,
    friendRequests, setFriendRequests, broadcasts, setBroadcasts, markBroadcastRead,
    blockedUsers, addMessage, setIsOnline, isOnline, isSyncing, archivedChats,
    showHiddenChats, setShowHiddenChats
  } = store;

  const { vibrate } = useHaptic();
  
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState<Chat | null>(null);
  const [chatMenuPosition, setChatMenuPosition] = useState({ x: 0, y: 0 });
  const [chatToUnlock, setChatToUnlock] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBroadcast, setShowBroadcast] = useState<Broadcast | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [pinError, setPinError] = useState('');
  const [wrongPinAttempts, setWrongPinAttempts] = useState(0);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [hiddenChatsPinInput, setHiddenChatsPinInput] = useState('');
  const [showHiddenChatsPin, setShowHiddenChatsPin] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize app
  useEffect(() => {
    initApp();
    
    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Handle back button on Android
    const handlePopState = () => {
      if (activeChat) {
        setActiveChat(null);
      } else if (showChatMenu) {
        setShowChatMenu(null);
      } else if (showUserSearch) {
        setShowUserSearch(false);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
      stopSyncService();
    };
  }, [activeChat, showChatMenu, showUserSearch]);

  // Theme effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [setShowInstallPrompt]);

  // Check for unread broadcasts
  useEffect(() => {
    if (profile && broadcasts.length > 0) {
      const unread = broadcasts.find(b => !b.read_by.includes(profile.id));
      if (unread) {
        setShowBroadcast(unread);
      }
    }
  }, [broadcasts, profile]);

  // Check lockout status
  useEffect(() => {
    if (lockoutEndTime) {
      const checkLockout = setInterval(() => {
        if (Date.now() >= lockoutEndTime) {
          setLockoutEndTime(null);
          setWrongPinAttempts(0);
        }
      }, 1000);
      return () => clearInterval(checkLockout);
    }
  }, [lockoutEndTime]);

  const initApp = async () => {
    try {
      await initializeDatabase();
      await initMediaStorage();
      await requestPersistentStorage();
      
      if (appLockPin) {
        setIsAppLocked(true);
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        store.setUser(session.user);
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          store.setProfile(profileData);
          store.setIsAdmin(profileData.is_admin || false);
          store.setIsAuthenticated(true);
          
          await supabase
            .from('profiles')
            .update({ is_online: true })
            .eq('id', session.user.id);
          
          initSyncService();
          subscribeToRealtime(session.user.id, {
            onMessage: (msg) => {
              addMessage(msg.chatId, {
                id: msg.id,
                chatId: msg.chatId,
                sender_id: msg.senderId,
                receiver_id: msg.receiverId,
                content: msg.content,
                iv: msg.iv,
                type: msg.type as 'text' | 'image' | 'video' | 'audio' | 'document',
                file_url: msg.fileUrl,
                thumbnail: msg.thumbnail,
                reply_to: msg.replyTo,
                status: msg.status,
                created_at: new Date(msg.createdAt).toISOString()
              });
            }
          });
          
          await loadData();
        }
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!profile?.id || profile.id === 'demo_user') {
      setupDemoData();
      return;
    }

    try {
      const { data: friendsData } = await supabase
        .from('friends')
        .select('friend:profiles!friends_friend_id_fkey(*)')
        .eq('user_id', profile.id)
        .eq('status', 'accepted');
      
      if (friendsData) {
        setFriends(friendsData.map(f => f.friend as unknown as AppUser));
      }

      const { data: requestsData } = await supabase
        .from('friend_requests')
        .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');
      
      if (requestsData) {
        setFriendRequests(requestsData);
      }

      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('*');
      
      if (settingsData) {
        const settings: Partial<typeof adminSettings> = {};
        settingsData.forEach(s => {
          const key = s.key as keyof typeof adminSettings;
          const value = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
          (settings as Record<string, unknown>)[key] = value;
        });
        store.setAdminSettings(settings);
      }

      const { data: broadcastsData } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (broadcastsData) {
        setBroadcasts(broadcastsData);
      }

      const { data: storiesData } = await supabase
        .from('stories')
        .select('*, user:profiles(*)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (storiesData) {
        setStories(storiesData);
      }

      const { data: callLogsData } = await supabase
        .from('call_logs')
        .select('*, caller:profiles!call_logs_caller_id_fkey(*), receiver:profiles!call_logs_receiver_id_fkey(*)')
        .or(`caller_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (callLogsData) {
        setCallLogs(callLogsData);
      }

      if (profile.is_admin) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (usersData) {
          setAllUsers(usersData);
        }
      }

      setupDemoData();
    } catch (error) {
      console.error('Load data error:', error);
      setupDemoData();
    }
  };

  const setupDemoData = useCallback(() => {
    if (friends.length === 0) {
      setFriends(DEMO_USERS);
    }
    setAllUsers(DEMO_USERS);
    
    if (chats.length === 0) {
      const demoChats: Chat[] = DEMO_USERS.slice(0, 4).map((user, i) => ({
        id: user.id,
        oderId: user.id,
        user,
        lastMessage: {
          id: `msg_${i}`,
          chatId: user.id,
          sender_id: user.id,
          receiver_id: profile?.id || 'demo_user',
          content: btoa('Hello! How are you doing today?'),
          iv: btoa('demo_iv_12345'),
          type: 'text' as const,
          status: 'read' as const,
          created_at: new Date(Date.now() - i * 3600000).toISOString()
        },
        unreadCount: i === 0 ? 3 : i === 1 ? 1 : 0,
        isPinned: pinnedChats.includes(user.id),
        isMuted: mutedChats.includes(user.id)
      }));
      
      setChats(demoChats);
    }

    if (stories.length === 0) {
      const demoStories: Story[] = DEMO_USERS.slice(0, 3).map((user, i) => ({
        id: `story_${i}`,
        user_id: user.id,
        media_url: `https://picsum.photos/seed/${user.username}/400/600`,
        media_type: 'image' as const,
        caption: `Story from ${user.display_name}`,
        viewers: [],
        created_at: new Date(Date.now() - i * 7200000).toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        user
      }));
      setStories(demoStories);
    }

    if (callLogs.length === 0) {
      const demoCallLogs: CallLog[] = DEMO_USERS.slice(0, 3).map((user, i) => ({
        id: `call_${i}`,
        caller_id: i % 2 === 0 ? (profile?.id || 'demo_user') : user.id,
        receiver_id: i % 2 === 0 ? user.id : (profile?.id || 'demo_user'),
        type: i === 1 ? 'video' as const : 'voice' as const,
        status: i === 0 ? 'answered' as const : i === 1 ? 'missed' as const : 'answered' as const,
        duration: i === 0 ? 320 : i === 2 ? 45 : 0,
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
        caller: i % 2 === 0 ? profile || DEMO_USERS[0] : user,
        receiver: i % 2 === 0 ? user : profile || DEMO_USERS[0]
      }));
      setCallLogs(demoCallLogs);
    }
  }, [profile, friends.length, chats.length, stories.length, callLogs.length, pinnedChats, mutedChats, setFriends, setAllUsers, setChats, setStories, setCallLogs]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Install outcome:', outcome);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleAppUnlock = (pin: string) => {
    if (lockoutEndTime && Date.now() < lockoutEndTime) {
      const remainingSeconds = Math.ceil((lockoutEndTime - Date.now()) / 1000);
      setPinError(`Try again in ${remainingSeconds}s`);
      vibrate([50, 50, 50]);
      return;
    }

    if (pin === appLockPin) {
      vibrate(10);
      setIsAppLocked(false);
      setPinInput('');
      setPinError('');
      setWrongPinAttempts(0);
    } else {
      vibrate([100, 50, 100]);
      const attempts = wrongPinAttempts + 1;
      setWrongPinAttempts(attempts);
      setPinInput('');
      
      if (attempts >= 5) {
        setLockoutEndTime(Date.now() + 30000);
        setPinError('Locked for 30 seconds');
      } else {
        setPinError(`Wrong PIN (${5 - attempts} left)`);
      }
    }
  };

  const handleChatUnlock = (pin: string) => {
    if (pin === appLockPin && chatToUnlock) {
      vibrate(10);
      const chat = chats.find(c => c.id === chatToUnlock);
      if (chat) {
        setActiveChat(chat);
      }
      setChatToUnlock(null);
      setPinInput('');
      setPinError('');
    } else {
      vibrate([100, 50, 100]);
      setPinError('Wrong PIN');
      setPinInput('');
    }
  };

  const handleHiddenChatsUnlock = (pin: string) => {
    if (pin === appLockPin) {
      vibrate(10);
      setShowHiddenChats(true);
      setShowHiddenChatsPin(false);
      setHiddenChatsPinInput('');
    } else {
      vibrate([100, 50, 100]);
      setPinError('Wrong PIN');
      setHiddenChatsPinInput('');
    }
  };

  const handleSelectChat = (chat: Chat) => {
    vibrate(5);
    if (lockedChats.includes(chat.id)) {
      setChatToUnlock(chat.id);
    } else {
      setActiveChat(chat);
      store.clearUnreadCount(chat.id);
      window.history.pushState({ chat: chat.id }, '');
    }
  };

  const handleLongPress = (chat: Chat, e: React.TouchEvent | React.MouseEvent) => {
    vibrate(20);
    const target = e.currentTarget.getBoundingClientRect();
    setChatMenuPosition({
      x: Math.min(target.left, window.innerWidth - 240),
      y: Math.min(target.top, window.innerHeight - 320)
    });
    setShowChatMenu(chat);
  };

  const handleCall = (type: 'voice' | 'video') => {
    if (!activeChat) return;
    
    if (type === 'voice' && !adminSettings.voice_calls_enabled) {
      alert('Voice calls are disabled by admin');
      return;
    }
    if (type === 'video' && !adminSettings.video_calls_enabled) {
      alert('Video calls are disabled by admin');
      return;
    }
    
    vibrate(10);
    setActiveCall({
      id: uuidv4(),
      peerId: activeChat.user.id,
      peerName: activeChat.user.display_name,
      peerAvatar: activeChat.user.avatar_url,
      type,
      isIncoming: false,
      status: 'connecting'
    });
  };

  const handleStartChat = (user: AppUser) => {
    if (blockedUsers.includes(user.id)) {
      alert('You have blocked this user');
      return;
    }
    
    vibrate(5);
    const existingChat = chats.find(c => c.id === user.id);
    if (existingChat) {
      if (hiddenChats.includes(existingChat.id) && !showHiddenChats) {
        if (appLockPin) {
          setShowHiddenChatsPin(true);
          return;
        }
        toggleChatHide(existingChat.id);
      }
      setActiveChat(existingChat);
    } else {
      const newChat: Chat = {
        id: user.id,
        oderId: user.id,
        user,
        unreadCount: 0
      };
      setChats([newChat, ...chats]);
      setActiveChat(newChat);
    }
    setShowUserSearch(false);
    setActiveTab('chats');
    window.history.pushState({ chat: user.id }, '');
  };

  // Pull to refresh handler
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current > 0 && scrollRef.current?.scrollTop === 0) {
      const distance = e.touches[0].clientY - touchStartY.current;
      if (distance > 0 && distance < 150) {
        setPullDistance(distance);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      vibrate(10);
      setIsPullRefreshing(true);
      try {
        await loadData();
      } finally {
        setIsPullRefreshing(false);
      }
    }
    setPullDistance(0);
    touchStartY.current = 0;
  };

  // Loading screen
  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center safe-area-top safe-area-bottom">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center animate-pulse">
            <MessageCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Ourdm</h1>
          <p className="text-white/60">Private & Secure Messaging</p>
          <div className="mt-6 w-48 h-1 bg-white/20 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-white/80 rounded-full animate-[shimmer_1.5s_infinite]" style={{ width: '30%' }} />
          </div>
        </div>
      </div>
    );
  }

  // App lock screen
  if (isAppLocked && appLockPin) {
    const isLockedOut = lockoutEndTime && Date.now() < lockoutEndTime;
    
    return (
      <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
        <div className="w-20 h-20 mb-8 rounded-full bg-white/10 flex items-center justify-center">
          <Lock className="w-10 h-10 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">App Locked</h2>
        <p className="text-white/60 mb-8">Enter your PIN to unlock</p>
        
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-full transition-all duration-200',
                pinInput.length > i 
                  ? 'bg-white scale-110' 
                  : 'bg-white/30',
                pinError && 'animate-shake'
              )}
            />
          ))}
        </div>
        
        {pinError && (
          <p className="text-red-400 text-sm mb-6 animate-fade-in">{pinError}</p>
        )}
        
        <PinPad
          value={pinInput}
          onChange={setPinInput}
          onComplete={handleAppUnlock}
          disabled={Boolean(isLockedOut)}
        />
        
        <p className="text-white/30 text-sm mt-12">Ourdm v{APP_VERSION}</p>
      </div>
    );
  }

  // Auth screen
  if (!isAuthenticated) {
    const handleLogin = async (email: string, password: string) => {
      // Real login only - no demo mode
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        store.setUser(data.user);
        store.setIsAuthenticated(true);
        await loadData();
      }
    };

    const handleSignup = async (email: string, password: string, name: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name }
        }
      });
      if (error) throw error;
      if (data.user) {
        store.setUser(data.user);
        store.setIsAuthenticated(true);
      }
    };

    const handleGoogleLogin = async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    };

    const handleAdminAccess = () => {
      setShowAdminLogin(true);
    };

    if (showAdminLogin) {
      return (
        <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4">
          <div className="bg-white/[0.05] backdrop-blur-[25px] rounded-3xl p-8 w-full max-w-sm border border-white/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-yellow-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Admin Access</h2>
              <p className="text-white/40 text-sm mt-1">Enter admin password</p>
            </div>
            
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/20 outline-none focus:ring-4 focus:ring-yellow-500/20 mb-4"
            />
            
            <button
              onClick={async () => {
                if (adminPassword === '3745') {
                  await handleGoogleLogin();
                } else {
                  alert('Wrong password');
                }
              }}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-xl font-bold mb-3"
            >
              Verify & Login with Google
            </button>
            
            <button
              onClick={() => setShowAdminLogin(false)}
              className="w-full py-3 text-white/50"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    return (
      <AuthScreen
        onLogin={handleLogin}
        onSignup={handleSignup}
        onGoogleLogin={handleGoogleLogin}
        onAdminLogin={handleAdminAccess}
        logoClickCount={logoClickCount}
        setLogoClickCount={setLogoClickCount}
      />
    );
  }

  // Active call screen
  if (activeCall) {
    return <CallScreen />;
  }

  // Chat unlock screen
  if (chatToUnlock) {
    return (
      <div className="h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
        <div className="w-20 h-20 mb-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
          <Lock className="w-10 h-10 text-indigo-500" />
        </div>
        
        <h3 className="text-xl font-bold mb-2 dark:text-white">Chat Locked</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Enter PIN to unlock</p>
        
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-full transition-all',
                pinInput.length > i 
                  ? 'bg-indigo-500 scale-110' 
                  : 'bg-gray-300 dark:bg-slate-600'
              )}
            />
          ))}
        </div>
        
        {pinError && (
          <p className="text-red-500 text-sm mb-4">{pinError}</p>
        )}
        
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pinInput}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setPinInput(val);
            setPinError('');
            if (val.length === 4) {
              setTimeout(() => handleChatUnlock(val), 100);
            }
          }}
          className="w-48 text-center text-3xl tracking-[1em] bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 rounded-2xl p-4 dark:text-white focus:outline-none focus:border-indigo-500 mb-6"
          placeholder="••••"
          autoFocus
        />
        
        <button
          onClick={() => { setChatToUnlock(null); setPinInput(''); setPinError(''); }}
          className="px-8 py-3 text-gray-500 dark:text-gray-400 font-medium"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Chat view
  if (activeChat) {
    return (
      <>
        <ChatView
          chat={activeChat}
          onBack={() => {
            setActiveChat(null);
            window.history.back();
          }}
          onCall={handleCall}
          onOpenMenu={() => setShowChatMenu(activeChat)}
        />
        
        {/* Chat Menu */}
        {showChatMenu && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowChatMenu(null)}
          >
            <div 
              className="absolute bg-white dark:bg-slate-800 rounded-2xl shadow-2xl py-2 min-w-[240px] animate-scale-in overflow-hidden"
              style={{ 
                left: Math.min(chatMenuPosition.x, window.innerWidth - 260),
                top: Math.min(chatMenuPosition.y, window.innerHeight - 400)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bottom-sheet-handle" />
              
              {[
                { 
                  icon: lockedChats.includes(showChatMenu.id) ? <Lock className="w-5 h-5" /> : <Lock className="w-5 h-5" />,
                  label: lockedChats.includes(showChatMenu.id) ? 'Unlock Chat' : 'Lock Chat',
                  color: 'text-indigo-500',
                  action: () => { toggleChatLock(showChatMenu.id); setShowChatMenu(null); }
                },
                { 
                  icon: hiddenChats.includes(showChatMenu.id) ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />,
                  label: hiddenChats.includes(showChatMenu.id) ? 'Unhide Chat' : 'Hide Chat',
                  color: 'text-purple-500',
                  action: () => { toggleChatHide(showChatMenu.id); setActiveChat(null); setShowChatMenu(null); }
                },
                { 
                  icon: <span className="text-lg">📌</span>,
                  label: pinnedChats.includes(showChatMenu.id) ? 'Unpin Chat' : 'Pin Chat',
                  color: '',
                  action: () => { toggleChatPin(showChatMenu.id); setShowChatMenu(null); }
                },
                { 
                  icon: <span className="text-lg">🔇</span>,
                  label: mutedChats.includes(showChatMenu.id) ? 'Unmute' : 'Mute',
                  color: '',
                  action: () => { toggleChatMute(showChatMenu.id); setShowChatMenu(null); }
                },
                { 
                  icon: <Archive className="w-5 h-5" />,
                  label: archivedChats.includes(showChatMenu.id) ? 'Unarchive' : 'Archive',
                  color: 'text-orange-500',
                  action: () => { toggleChatArchive(showChatMenu.id); setActiveChat(null); setShowChatMenu(null); }
                },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => { vibrate(5); item.action(); }}
                  className="w-full px-5 py-4 flex items-center gap-4 active:bg-gray-100 dark:active:bg-slate-700 transition-colors"
                >
                  <span className={item.color}>{item.icon}</span>
                  <span className="dark:text-white font-medium">{item.label}</span>
                </button>
              ))}
              
              <div className="border-t dark:border-slate-700 my-1" />
              
              <button 
                onClick={() => { vibrate(5); setShowChatMenu(null); }}
                className="w-full px-5 py-4 flex items-center gap-4 active:bg-red-50 dark:active:bg-red-900/20 text-red-500"
              >
                <span className="text-lg">🗑️</span>
                <span className="font-medium">Delete Chat</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Admin panel
  if (activeTab === 'admin' && isAdmin) {
    return <AdminPanel onBack={() => setActiveTab('settings')} />;
  }

  // Chats are filtered in ChatList component

  // Main app
  return (
    <div className={cn('h-screen flex flex-col overflow-hidden', theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-gray-50')}>
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0 safe-area-top">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(showArchivedChats || showHiddenChats) ? (
              <button
                onClick={() => {
                  setShowArchivedChats(false);
                  setShowHiddenChats(false);
                }}
                className="p-2 -ml-2 rounded-full active:bg-white/10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">
                {showArchivedChats ? 'Archived' : showHiddenChats ? 'Hidden Chats' : 'Ourdm'}
              </h1>
              <p className="text-xs text-white/70 flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    {isSyncing ? 'Syncing...' : 'Connected'}
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Install App Button - Always visible on supported browsers */}
            {(showInstallPrompt || deferredPrompt) && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-white text-indigo-600 rounded-full text-sm font-semibold flex items-center gap-2 active:scale-95 transition-all shadow-lg animate-pulse"
              >
                <Download className="w-4 h-4" />
                <span>Install App</span>
              </button>
            )}
            <button 
              onClick={() => { vibrate(5); setShowUserSearch(true); }}
              className="p-3 rounded-full active:bg-white/10 touch-target"
            >
              <Search className="w-5 h-5" />
            </button>
            {isAdmin && (
              <button
                onClick={() => { vibrate(5); setActiveTab('admin'); }}
                className="p-2 bg-yellow-500 rounded-full touch-target"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Friend Requests Banner */}
      {friendRequests.length > 0 && activeTab === 'chats' && !showArchivedChats && !showHiddenChats && (
        <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border-b dark:border-slate-700 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="flex-1 text-indigo-900 dark:text-indigo-100 font-medium">
            {friendRequests.length} friend request{friendRequests.length > 1 ? 's' : ''}
          </span>
          <button 
            onClick={() => { vibrate(5); setActiveTab('friends'); }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full"
          >
            View
          </button>
        </div>
      )}

      {/* Pull to Refresh Indicator */}
      {pullDistance > 0 && activeTab === 'chats' && (
        <div 
          className="flex items-center justify-center bg-gray-100 dark:bg-slate-800 overflow-hidden transition-all flex-shrink-0"
          style={{ height: Math.min(pullDistance * 0.6, 60) }}
        >
          <RefreshCw className={cn(
            'w-6 h-6 text-indigo-600 dark:text-indigo-400 transition-transform',
            pullDistance > 80 ? 'animate-spin' : '',
          )} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
        </div>
      )}

      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isPullRefreshing && (
          <div className="flex items-center justify-center py-4 bg-gray-100 dark:bg-slate-800">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Refreshing...</span>
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="pb-24">
            {/* Archived & Hidden Quick Access */}
            {!showArchivedChats && !showHiddenChats && (
              <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
                {archivedChats.length > 0 && (
                  <button
                    onClick={() => { vibrate(5); setShowArchivedChats(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-full whitespace-nowrap"
                  >
                    <Archive className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium dark:text-white">{archivedChats.length} Archived</span>
                  </button>
                )}
                {hiddenChats.length > 0 && appLockPin && (
                  <button
                    onClick={() => {
                      vibrate(5);
                      if (showHiddenChats) {
                        setShowHiddenChats(false);
                      } else {
                        setShowHiddenChatsPin(true);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full whitespace-nowrap"
                  >
                    <Lock className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">{hiddenChats.length} Hidden</span>
                  </button>
                )}
              </div>
            )}
            
            <ChatList
              onSelectChat={handleSelectChat}
              onLongPress={handleLongPress}
            />
          </div>
        )}

        {activeTab === 'stories' && adminSettings.stories_enabled && (
          <div className="pb-24">
            <StoriesView 
              currentUserId={profile?.id || ''} 
              userAvatar={profile?.avatar_url || ''}
              userName={profile?.display_name || 'User'}
            />
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="pb-24">
            <FriendsView onStartChat={handleStartChat} />
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="pb-24">
            <CallsView onStartCall={(user, type) => {
              const chat: Chat = {
                id: user.id,
                oderId: user.id,
                user,
                unreadCount: 0
              };
              setActiveChat(chat);
              handleCall(type);
            }} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="pb-24">
            <SettingsView />
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg border-t dark:border-slate-700 safe-area-bottom z-40">
        <div className="flex items-center justify-around py-1">
          {[
            { id: 'chats', icon: MessageCircle, label: 'Chats', badge: chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0) },
            ...(adminSettings.stories_enabled ? [{ id: 'stories', icon: () => <div className="w-6 h-6 rounded-full border-2 border-current" />, label: 'Stories' }] : []),
            { id: 'friends', icon: Users, label: 'Friends', badge: friendRequests.length },
            { id: 'calls', icon: Phone, label: 'Calls' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map(({ id, icon: Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => { vibrate(3); setActiveTab(id as typeof activeTab); }}
              className={cn(
                'flex flex-col items-center py-2 px-4 rounded-2xl transition-all relative touch-target',
                activeTab === id 
                  ? 'text-indigo-600 dark:text-indigo-400' 
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {typeof badge === 'number' && badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center badge-pulse">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium">{label}</span>
              {activeTab === id && (
                <div className="absolute -bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* User Search Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col animate-slide-in-right">
          <div className="px-4 py-3 flex items-center gap-3 border-b dark:border-slate-700 safe-area-top">
            <button 
              onClick={() => { vibrate(5); setShowUserSearch(false); setSearchQuery(''); }}
              className="p-2 rounded-full active:bg-gray-100 dark:active:bg-slate-800"
            >
              <ChevronLeft className="w-6 h-6 dark:text-white" />
            </button>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-full focus:outline-none dark:text-white text-base"
              autoFocus
            />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {(searchQuery ? allUsers : DEMO_USERS)
              .filter(u => 
                u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .filter(u => u.id !== profile?.id && !blockedUsers.includes(u.id))
              .map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleStartChat(user)}
                  className="flex items-center gap-4 p-4 active:bg-gray-50 dark:active:bg-slate-800 cursor-pointer border-b dark:border-slate-800"
                >
                  <div className="relative">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    {user.is_online && (
                      <div className="online-indicator" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold dark:text-white truncate">{user.display_name}</h3>
                    <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                  </div>
                  {friends.some(f => f.id === user.id) ? (
                    <span className="text-xs text-green-500 font-medium bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">Friend</span>
                  ) : (
                    <button className="p-3 bg-indigo-600 text-white rounded-full active:bg-indigo-700">
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              
            {searchQuery && allUsers.filter(u => 
              u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              u.username.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div className="p-8 text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500">No users found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm animate-scale-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <Lock className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 dark:text-white">Set App Lock PIN</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Create a 4-digit PIN to secure your app</p>
            
            <div className="flex justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'w-4 h-4 rounded-full transition-all',
                    pinInput.length > i ? 'bg-indigo-500 scale-110' : 'bg-gray-200 dark:bg-slate-600'
                  )}
                />
              ))}
            </div>
            
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[1em] bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-2xl p-4 mb-6 dark:text-white focus:outline-none focus:border-indigo-500"
              placeholder="••••"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPinSetup(false); setPinInput(''); }}
                className="flex-1 py-4 bg-gray-100 dark:bg-slate-700 rounded-2xl font-medium dark:text-white active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pinInput.length === 4) {
                    vibrate(10);
                    setAppLockPin(pinInput);
                    setPinInput('');
                    setShowPinSetup(false);
                  }
                }}
                disabled={pinInput.length !== 4}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-medium disabled:opacity-50 active:scale-[0.98]"
              >
                Set PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm animate-slide-up">
            <div className="bottom-sheet-handle sm:hidden" />
            
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
              showBroadcast.type === 'urgent' ? 'bg-red-100 dark:bg-red-900/30' :
              showBroadcast.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
              'bg-blue-100 dark:bg-blue-900/30'
            )}>
              <Bell className={cn(
                'w-7 h-7',
                showBroadcast.type === 'urgent' ? 'text-red-600' :
                showBroadcast.type === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              )} />
            </div>
            
            <h3 className="text-xl font-bold mb-2 dark:text-white">{showBroadcast.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">{showBroadcast.message}</p>
            <p className="text-xs text-gray-400 mb-6">
              {format(new Date(showBroadcast.created_at), 'MMM d, yyyy • HH:mm')}
            </p>
            
            <button
              onClick={() => {
                vibrate(5);
                markBroadcastRead(showBroadcast.id);
                setShowBroadcast(null);
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-medium active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Hidden Chats PIN Modal */}
      {showHiddenChatsPin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm animate-scale-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <Lock className="w-8 h-8 text-purple-500" />
            </div>
            
            <h3 className="text-xl font-bold text-center mb-2 dark:text-white">Hidden Chats</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Enter PIN to view hidden chats</p>
            
            <div className="flex justify-center gap-4 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'w-4 h-4 rounded-full transition-all',
                    hiddenChatsPinInput.length > i ? 'bg-purple-500 scale-110' : 'bg-gray-200 dark:bg-slate-600'
                  )}
                />
              ))}
            </div>
            
            {pinError && (
              <p className="text-red-500 text-sm text-center mb-4 animate-shake">{pinError}</p>
            )}
            
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={hiddenChatsPinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setHiddenChatsPinInput(val);
                setPinError('');
                if (val.length === 4) {
                  setTimeout(() => handleHiddenChatsUnlock(val), 100);
                }
              }}
              className="w-full text-center text-3xl tracking-[1em] bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-2xl p-4 mb-6 dark:text-white focus:outline-none focus:border-purple-500"
              placeholder="••••"
              autoFocus
            />
            
            <button
              onClick={() => { 
                setShowHiddenChatsPin(false); 
                setHiddenChatsPinInput(''); 
                setPinError(''); 
              }}
              className="w-full py-4 bg-gray-100 dark:bg-slate-700 rounded-2xl font-medium dark:text-white active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
