import { useEffect, useState, useRef } from 'react';
import { useAppStore, type Chat, type AppUser, type Broadcast } from './store/appStore';
import { supabase } from './lib/supabase';
import { initializeDatabase, requestPersistentStorage } from './lib/database';
import { initMediaStorage } from './lib/mediaStorage';
import { initSyncService, subscribeToRealtime, stopSyncService } from './lib/syncService';
import { webRTCService } from './services/WebRTCService';
import { AuthScreen } from './components/Auth/AuthScreen';
import { ChatList } from './components/Chat/ChatList';
import { ChatView } from './components/Chat/ChatView';
import { CallScreen } from './components/Calls/CallScreen';
import { AdminPanel } from './components/Admin/AdminPanel';
import { StoriesView } from './components/Stories/StoriesView';
import { FriendsView } from './components/Friends/FriendsView';
import { CallsView } from './components/Calls/CallsView';
import { SettingsView } from './components/Settings/SettingsView';
import { LoadingScreen } from './components/UI/LoadingScreen';
import { useProgress } from './hooks/useProgress';
import { FriendService } from '@/services/FriendService';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageCircle, Users, Phone, Settings, Lock, Download,
  Shield, Search, UserPlus, Bell, RefreshCw,
  Archive, Eye, EyeOff, ChevronLeft, Trash2, Ban
} from 'lucide-react';
import { cn } from './utils/cn';

const APP_VERSION = '3.0.0';



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
  disabled = false,
  onPasswordReset,
  onDataReset,
  showResetOptions
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  onPasswordReset?: () => void;
  onDataReset?: () => void;
  showResetOptions?: boolean;
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
    <div className="flex flex-col gap-8 max-w-xs mx-auto">
      <div className="grid grid-cols-3 gap-4">
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

      {showResetOptions && (
        <>
          <button
            onClick={onPasswordReset}
            className="text-white/40 text-sm font-medium hover:text-white/60 transition-colors mt-2"
          >
            Unlock with Password
          </button>

          <button
            onClick={onDataReset}
            className="text-white/20 text-[10px] font-medium hover:text-white/40 transition-colors"
          >
            Clear Hidden/Locked Chats
          </button>
        </>
      )}
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
    setAppLockPin, setCallLogs, setStories, allUsers, setAllUsers,
    friendRequests, setFriendRequests, broadcasts, setBroadcasts, markBroadcastRead,
    blockedUsers, addMessage, setIsOnline, isOnline, isSyncing, archivedChats,
    showHiddenChats, setShowHiddenChats, blockUser, unblockUser
  } = store;

  const realtimeUnsubRef = useRef<(() => void) | null>(null);

  const { vibrate } = useHaptic();
  const { progress, isLoading, message, updateProgress, complete, reset } = useProgress({
    duration: 3000,
    steps: 50,
    autoIncrement: false,
  });

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
    updateProgress(5, 'Starting app...');
    initApp();

    // Online/offline detection
    const handleOnline = () => {
      setIsOnline(true);
      if (profile) {
        supabase.from('profiles').update({ is_online: true }).eq('id', profile.id);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (profile) {
        supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', profile.id);
      }
    };

    const handleVisibilityChange = () => {
      if (profile) {
        const isOnlineStatus = document.visibilityState === 'visible';
        supabase.from('profiles').update({
          is_online: isOnlineStatus,
          last_seen: isOnlineStatus ? undefined : new Date().toISOString()
        }).eq('id', profile.id);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle back button on Android/Mobile
    const handlePopState = () => {
      if (activeChat) {
        setActiveChat(null);
        window.history.pushState(null, ''); // Prevent going back further
      } else if (showChatMenu) {
        setShowChatMenu(null);
      } else if (showUserSearch) {
        setShowUserSearch(false);
      } else if (activeTab !== 'chats') {
        setActiveTab('chats');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopSyncService();
      // Cleanup realtime subscription
      if (realtimeUnsubRef.current) {
        realtimeUnsubRef.current();
        realtimeUnsubRef.current = null;
      }
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

    const settingsHandler = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
          }
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
        });
      } else {
        alert('App is already installed or your browser doesn\'t support installation.');
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('pwa-install-prompt', settingsHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-install-prompt', settingsHandler);
    };
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
      updateProgress(10, 'Initializing database...');
      await initializeDatabase();
      
      updateProgress(20, 'Setting up media storage...');
      await initMediaStorage();
      
      updateProgress(30, 'Requesting storage permissions...');
      await requestPersistentStorage();

      if (appLockPin) {
        setIsAppLocked(true);
      }

      updateProgress(40, 'Checking authentication...');
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        updateProgress(50, 'Loading user profile...');
        store.setUser(session.user);

        const generateUsername = () => {
          const emailPrefix = session.user.email?.split('@')[0] || 'user';
          const suffix = session.user.id.slice(0, 6);
          return `${emailPrefix}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        };

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
        }

        let ensuredProfile = profileData;
        if (!ensuredProfile) {
          const displayName =
            (session.user.user_metadata as any)?.display_name ||
            (session.user.user_metadata as any)?.full_name ||
            session.user.email?.split('@')[0] ||
            'User';

          const profileInsert = {
            id: session.user.id,
            email: session.user.email || '',
            display_name: displayName,
            username: generateUsername(),
            avatar_url: (session.user.user_metadata as any)?.avatar_url || null,
            bio: null,
            is_online: true,
            last_seen: new Date().toISOString(),
            is_admin: false,
            is_suspended: false,
            created_at: new Date().toISOString()
          };

          const { data: insertedProfile, error: insertProfileError } = await supabase
            .from('profiles')
            .insert(profileInsert)
            .select('*')
            .maybeSingle();

          if (insertProfileError) {
            console.error('Profile create error:', insertProfileError);
          } else {
            ensuredProfile = insertedProfile as any;
          }
        }

        if (ensuredProfile) {
          updateProgress(60, 'Setting up profile...');
          store.setProfile(ensuredProfile as any);
          store.setIsAdmin((ensuredProfile as any).is_admin || false);
          store.setIsAuthenticated(true);

          updateProgress(70, 'Updating online status...');
          await supabase
            .from('profiles')
            .update({ is_online: true })
            .eq('id', session.user.id);

          // Initialize Friend Service
          updateProgress(75, 'Initializing friend service...');
          FriendService.setCurrentUser(session.user.id);

          updateProgress(80, 'Starting sync service...');
          initSyncService();
          webRTCService.initialize(session.user.id);

          // Cleanup storage periodically (once per session on start)
          import('./services/MessageService').then(m => m.MessageService.cleanupServerStorage());

          // Store unsubscribe function for cleanup
          updateProgress(85, 'Setting up real-time updates...');
          realtimeUnsubRef.current = subscribeToRealtime(session.user.id, {
            onMessage: (msg) => {
              addMessage(msg.chat_id, {
                id: msg.id,
                chat_id: msg.chat_id,
                sender_id: msg.sender_id,
                receiver_id: msg.receiver_id || '',
                content: msg.content,
                iv: msg.iv || '',
                type: msg.type as any,
                file_url: msg.file_url,
                thumbnail: msg.thumbnail,
                reply_to: msg.reply_to,
                status: (msg.status as any) || 'sent',
                created_at: typeof msg.created_at === 'number' ? msg.created_at : Date.now()
              });
            },
            onFriendRequest: () => {
              loadData(); // Reload requests silently
            },
            onFriendChange: () => {
              loadData(); // Reload friends silently
            },
            onPresenceUpdate: (userId, status) => {
              store.updateUser(userId, {
                is_online: status === 'online',
                last_seen: new Date().toISOString()
              });
            }
          });

          updateProgress(90, 'Configuring call service...');
          webRTCService.setOnIncomingCall((incoming_call) => {
            setActiveCall({
              id: incoming_call.call_id,
              remoteUser: {
                id: incoming_call.caller_id,
                display_name: incoming_call.caller_name,
                avatar_url: incoming_call.caller_avatar,
                username: incoming_call.caller_name.toLowerCase(), // fallback
              } as any,
              type: incoming_call.call_type,
              isIncoming: true,
              status: 'incoming',
              incomingOffer: incoming_call.offer
            });
            setActiveTab('calls');
          });

          // Pass profile directly to avoid race condition with store update
          updateProgress(95, 'Loading user data...');
          await loadDataForUser(ensuredProfile as any);
        }
      }
      
      updateProgress(100, 'Ready!');
      setTimeout(complete, 500);
    } catch (error) {
      console.error('Init error:', error);
      updateProgress(0, 'Initialization failed');
      setTimeout(reset, 2000);
    }
  };

  // loadData uses a passed profile to avoid race conditions
  const loadDataForUser = async (currentProfile: AppUser) => {
    if (!currentProfile?.id) return;

    try {
      const { data: friendsData } = await supabase
        .from('friends')
        .select('friend:profiles!friends_friend_id_fkey(*)')
        .eq('user_id', currentProfile.id)
        .eq('status', 'accepted');

      if (friendsData) {
        setFriends(friendsData.map(f => f.friend as unknown as AppUser));
      }

      const { data: requestsData } = await supabase
        .from('friend_requests')
        .select('*, sender:profiles!sender_id(*)')
        .eq('receiver_id', currentProfile.id)
        .eq('status', 'pending');

      if (requestsData) {
        setFriendRequests(requestsData.map(r => ({
          ...r,
          sender_id: r.sender_id,
          receiver_id: r.receiver_id,
          sender: (r as any).sender
        })));
      }

      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('*');

      if (settingsData) {
        const settings: Partial<typeof adminSettings> = {};
        settingsData.forEach(s => {
          const key = s.key as keyof typeof adminSettings;
          let value: unknown = s.value;
          if (typeof s.value === 'string') {
            try {
              value = JSON.parse(s.value);
            } catch {
              value = s.value;
            }
          }
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
        .or(`caller_id.eq.${currentProfile.id},receiver_id.eq.${currentProfile.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (callLogsData) {
        setCallLogs(callLogsData);
      }

      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersData) {
        setAllUsers(usersData);
      }

    } catch (error) {
      console.error('Load data error:', error);
    }
  };

  // Wrapper for pull-to-refresh that uses current profile from store
  // Wrapper for pull-to-refresh that uses current profile from store
  const loadData = async () => {
    if (profile) {
      await loadDataForUser(profile);
    }
  };



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

  const handlePasswordUnlock = async () => {
    const pass = prompt('🔑 Verification Required: \nEnter your Account Password to reset PIN and unlock all chats:');
    if (pass && profile?.email) {
      vibrate(10);
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: pass
      });

      if (error) {
        alert('❌ Incorrect Password');
        vibrate([100, 50, 100]);
      } else {
        if (confirm('🔒 Unlock System? \n\nPIN will be cleared. This will NOT delete messages, just reset your lock settings.')) {
          setAppLockPin(null);
          setIsAppLocked(false);
          setShowHiddenChats(true);
          alert('🔓 System Unlocked. You can set a new PIN in settings.');
        }
      }
    }
  };

  const handleResetHiddenLocked = () => {
    vibrate(20);
    if (confirm('🚨 Reset Hidden & Locked Data? \n\nThis will DELETE all messages and chats that were hidden or locked. This cannot be undone. \n\nContinue?')) {
      import('@/lib/database').then(async m => {
        const hiddenAndLockedIds = [...hiddenChats, ...lockedChats];
        for (const id of hiddenAndLockedIds) {
          await m.db.messages.where('chatId').equals(id).delete();
          await m.db.chats.delete(id);
        }
        setChats(chats.filter(c => !hiddenAndLockedIds.includes(c.id)));
        setAppLockPin(null);
        setIsAppLocked(false);
        alert('🗑️ Hidden & Locked data cleared.');
      });
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
      remoteUser: activeChat.user,
      type,
      isIncoming: false,
      status: 'calling'
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
        order_id: user.id,
        user,
        unread_count: 0
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
  if (isLoading) {
    return (
      <LoadingScreen 
        isLoading={isLoading} 
        progress={progress} 
        message={message} 
        onComplete={() => {
          // Loading complete callback
        }}
      />
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
          showResetOptions={true}
          onPasswordReset={handlePasswordUnlock}
          onDataReset={handleResetHiddenLocked}
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
                // Production: Remove hardcoded bypass, use proper authentication
                if (adminPassword === '3745') {
                  await handleGoogleLogin();
                } else {
                  alert('❌ Access Denied: Incorrect Admin Token');
                  vibrate(100);
                }
              }}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-xl font-bold mb-3 shadow-lg shadow-yellow-500/20 active:scale-95 transition-all"
            >
              Verify System Access
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

        <PinPad
          value={pinInput}
          onChange={setPinInput}
          onComplete={handleChatUnlock}
          showResetOptions={true}
          onPasswordReset={handlePasswordUnlock}
          onDataReset={handleResetHiddenLocked}
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
                {
                  icon: <Lock className="w-5 h-5" />,
                  label: lockedChats.includes(showChatMenu.id) ? 'Unlock Chat' : 'Lock Chat',
                  color: 'text-indigo-500',
                  action: () => { toggleChatLock(showChatMenu.id); setShowChatMenu(null); }
                },
                {
                  icon: <Ban className="w-5 h-5" />,
                  label: blockedUsers.includes(showChatMenu.id) ? 'Unblock' : 'Block',
                  color: 'text-red-500',
                  action: () => {
                    if (blockedUsers.includes(showChatMenu.id)) {
                      unblockUser(showChatMenu.id);
                    } else {
                      blockUser(showChatMenu.id);
                    }
                    setShowChatMenu(null);
                  }
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
                onClick={() => {
                  if (confirm('Are you sure you want to delete this chat and all messages?')) {
                    setChats(chats.filter(c => c.id !== showChatMenu.id));
                    vibrate(20);
                  }
                  setShowChatMenu(null);
                }}
                className="w-full px-5 py-4 flex items-center gap-4 active:bg-red-50 dark:active:bg-red-900/20 text-red-500"
              >
                <Trash2 className="w-5 h-5" />
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

  // Get header title based on active tab
  const getHeaderTitle = () => {
    if (showArchivedChats) return 'Archived';
    if (showHiddenChats) return 'Hidden Chats';
    switch (activeTab) {
      case 'chats': return 'OurDM';
      case 'stories': return 'Stories';
      case 'friends': return 'Friends';
      case 'calls': return 'Calls';
      case 'settings': return 'Settings';
      default: return 'OurDM';
    }
  };

  // Main app
  return (
    <div className={cn('h-screen flex flex-col overflow-hidden', theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-gray-50')}>
      {/* Header */}
      <header className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white flex-shrink-0 safe-area-top relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(showArchivedChats || showHiddenChats) ? (
              <button
                onClick={() => {
                  setShowArchivedChats(false);
                  setShowHiddenChats(false);
                }}
                className="p-2 -ml-2 rounded-full active:bg-white/20 backdrop-blur-sm transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {getHeaderTitle()}
              </h1>
              <p className="text-xs text-white/80 flex items-center gap-2 font-medium">
                {isOnline ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    {isSyncing ? 'Syncing...' : 'Connected'}
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    Offline
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Install App Button - Always visible on supported browsers */}
            {(showInstallPrompt || deferredPrompt) && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-white text-indigo-600 rounded-2xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all shadow-xl animate-bounce"
              >
                <Download className="w-4 h-4" />
                <span>Install</span>
              </button>
            )}
            <button
              onClick={() => { vibrate(5); setShowUserSearch(true); }}
              className="p-3 rounded-2xl active:bg-white/20 backdrop-blur-sm touch-target transition-all hover:scale-105"
            >
              <Search className="w-5 h-5" />
            </button>
            {isAdmin && (
              <button
                onClick={() => { vibrate(5); setActiveTab('admin'); }}
                className="p-2 bg-yellow-400 text-yellow-900 rounded-2xl touch-target shadow-lg hover:scale-105 transition-all"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Friend Requests Banner */}
      {friendRequests.length > 0 && activeTab === 'chats' && !showArchivedChats && !showHiddenChats && (
        <div className="px-4 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-indigo-100 dark:border-indigo-800/50 flex items-center gap-4 flex-shrink-0 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-purple-500 rounded-full blur-xl" />
          </div>
          
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bell className="w-6 h-6 text-white animate-bounce" />
          </div>
          <div className="flex-1 relative">
            <p className="text-indigo-900 dark:text-indigo-100 font-bold text-sm">
              {friendRequests.length} friend request{friendRequests.length > 1 ? 's' : ''}
            </p>
            <p className="text-indigo-600 dark:text-indigo-300 text-xs">
              Tap to view and respond
            </p>
          </div>
          <button
            onClick={() => { vibrate(5); setActiveTab('friends'); }}
            className="relative px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-2xl shadow-lg active:scale-95 transition-all hover:shadow-xl"
          >
            View
            <div className="absolute inset-0 rounded-2xl bg-white opacity-0 hover:opacity-20 transition-opacity" />
          </button>
        </div>
      )}

      {/* Pull to Refresh Indicator */}
      {pullDistance > 0 && activeTab === 'chats' && (
        <div
          className="flex items-center justify-center bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 overflow-hidden transition-all flex-shrink-0 relative"
          style={{ height: Math.min(pullDistance * 0.6, 80) }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 animate-pulse" />
          <div className="relative flex items-center gap-3">
            <RefreshCw className={cn(
              'w-7 h-7 text-indigo-600 dark:text-indigo-400 transition-all drop-shadow-md',
              pullDistance > 80 ? 'animate-spin' : '',
            )} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
            {pullDistance > 80 && (
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm animate-fade-in">
                Release to refresh
              </span>
            )}
          </div>
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
              <div className="flex gap-3 px-4 py-4 overflow-x-auto scrollbar-hide">
                {archivedChats.length > 0 && (
                  <button
                    onClick={() => { vibrate(5); setShowArchivedChats(true); }}
                    className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl whitespace-nowrap shadow-md hover:shadow-lg transition-all group active:scale-95"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-xl flex items-center justify-center shadow-sm">
                      <Archive className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200 block">{archivedChats.length} Archived</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">View archived chats</span>
                    </div>
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
                    className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/50 rounded-2xl whitespace-nowrap shadow-md hover:shadow-lg transition-all group active:scale-95"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-sm">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-purple-700 dark:text-purple-300 block">{hiddenChats.length} Hidden</span>
                      <span className="text-xs text-purple-600 dark:text-purple-400">Private chats</span>
                    </div>
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
                order_id: user.id,
                user,
                unread_count: 0
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

      {/* Floating Action Button */}
      {activeTab === 'chats' && !showArchivedChats && !showHiddenChats && (
        <button
          onClick={() => { vibrate(5); setShowUserSearch(true); }}
          className="fixed bottom-24 right-6 w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-2xl hover:shadow-3xl active:scale-95 transition-all z-30 group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full animate-ping opacity-20" />
          <UserPlus className="w-7 h-7 text-white relative z-10 group-hover:rotate-12 transition-transform" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t dark:border-slate-800 safe-area-bottom shadow-[0_-2px_15px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          {[
            { id: 'chats', icon: MessageCircle, label: 'Chats', badge: chats.reduce((acc, c) => acc + (c.unread_count || 0), 0) },
            { id: 'friends', icon: Users, label: 'Friends', badge: friendRequests.length },
            { id: 'calls', icon: Phone, label: 'Calls' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map(({ id, icon: Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => {
                vibrate(5);
                setActiveTab(id as typeof activeTab);
              }}
              className={cn(
                'flex flex-col items-center justify-center min-w-[64px] h-full rounded-xl transition-all relative',
                activeTab === id
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {activeTab === id && (
                <div className="absolute inset-x-1 inset-y-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl animate-scale-in" />
              )}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <Icon className={cn(
                    "w-6 h-6 transition-transform",
                    activeTab === id && "scale-110"
                  )} />
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 badge-pulse">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] mt-1 font-bold',
                  activeTab === id ? 'opacity-100' : 'opacity-70'
                )}>{label}</span>
              </div>
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
            {allUsers
              .filter(u => {
                const q = searchQuery.trim().toLowerCase();
                if (!q) return true;
                const hay = `${u.id} ${u.display_name} ${u.username}`.toLowerCase();
                const tokens = q.split(/\s+/).filter(Boolean);
                return tokens.every(t => hay.includes(t));
              })
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
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const result = await FriendService.sendFriendRequestByUsername(user.username);
                        if (!result.success) {
                          alert(result.error || 'Failed to send friend request');
                        } else {
                          alert('Friend request sent');
                        }
                      }}
                      className="p-3 bg-indigo-600 text-white rounded-full active:bg-indigo-700"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}

            {searchQuery && allUsers.filter(u => {
              const q = searchQuery.trim().toLowerCase();
              const hay = `${u.id} ${u.display_name} ${u.username}`.toLowerCase();
              const tokens = q.split(/\s+/).filter(Boolean);
              return tokens.every(t => hay.includes(t));
            }).length === 0 && (
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

            <PinPad
              value={hiddenChatsPinInput}
              onChange={setHiddenChatsPinInput}
              onComplete={handleHiddenChatsUnlock}
              showResetOptions={true}
              onPasswordReset={handlePasswordUnlock}
              onDataReset={handleResetHiddenLocked}
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
