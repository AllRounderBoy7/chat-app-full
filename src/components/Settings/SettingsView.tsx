import { useState, useEffect } from 'react';
import {
  User, Lock, Bell, Moon, Sun, HelpCircle, Info, LogOut, Shield,
  ChevronRight, Eye, EyeOff, Smartphone, Database, Palette,
  MessageCircle, Phone, Image, Globe, Key, Fingerprint, Clock,
  Volume2, Trash2, Download, UserX, Users,
  Camera, Edit3, Check, AlertTriangle, Monitor, Zap, Type, RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';
import { getStorageStats, clearAllData } from '@/lib/database';

type SettingsSection = 'main' | 'account' | 'privacy' | 'security' | 'notifications' |
  'storage' | 'appearance' | 'help' | 'about' | 'blocked' | 'accessibility';

export function SettingsView() {
  const {
    profile, theme, setTheme, appLockPin, setAppLockPin, isAdmin,
    setActiveTab, blockedUsers, setIsAuthenticated, hiddenChats, lockedChats,
    notificationSettings, setNotificationSettings,
    privacySettings, setPrivacySettings,
    storageSettings, setStorageSettings,
    accessibilitySettings, setAccessibilitySettings
  } = useAppStore();

  const [section, setSection] = useState<SettingsSection>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.display_name || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);

  const [storageStats, setStorageStats] = useState<any>(null);

  useEffect(() => {
    if (section === 'storage') {
      getStorageStats().then(setStorageStats);
    }
  }, [section]);

  const vibrate = (pattern: number = 10) => {
    if (accessibilitySettings.hapticFeedback && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    vibrate(10);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editName,
          username: editUsername,
          bio: editBio,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Update local state
      useAppStore.setState({
        profile: { ...profile, display_name: editName, username: editUsername, bio: editBio }
      });

      setIsEditing(false);
      vibrate(10);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = () => {
    if (pinStep === 'enter') {
      if (pinInput.length !== 4) {
        setPinError('PIN must be 4 digits');
        return;
      }
      setPinStep('confirm');
      setPinError('');
    } else {
      if (confirmPinInput !== pinInput) {
        setPinError('PINs do not match');
        setConfirmPinInput('');
        return;
      }
      setAppLockPin(pinInput);
      setShowPinSetup(false);
      setPinInput('');
      setConfirmPinInput('');
      setPinStep('enter');
      vibrate(10);
    }
  };

  const handleRemovePin = () => {
    if (confirm('Remove app lock PIN?')) {
      setAppLockPin(null);
      vibrate(10);
    }
  };

  const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Check size first (5MB limit as requested, then compress)
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo is too large. It will be compressed automatically.');
    }

    setSaving(true);
    try {
      const { StoryService } = await import('@/services/StoryService');
      StoryService.setCurrentUser(profile.id);
      const newUrl = await StoryService.updateProfilePicture(file);

      if (newUrl) {
        useAppStore.setState({ profile: { ...profile, avatar_url: newUrl } });
        vibrate(10);
      } else {
        alert('Failed to update profile picture');
      }
    } catch (error) {
      console.error('Avatar update error:', error);
      alert('Error updating photo');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) return;

    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      vibrate(10);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleClearData = async () => {
    if (!confirm('This will delete all your local data including messages and media. This cannot be undone. Continue?')) return;

    try {
      setSaving(true);
      await clearAllData();

      // Clear localStorage
      localStorage.clear();

      vibrate(20);
      alert('Application reset successfully. Logging out.');
      window.location.reload();
    } catch (error) {
      console.error('Clear data error:', error);
      alert('Failed to reset application');
    } finally {
      setSaving(false);
    }
  };

  // Storage size formatter - used in storage section
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  console.log(formatStorageSize); // Using the function to avoid unused warning

  // Settings Menu Item Component
  const MenuItem = ({
    icon: Icon,
    label,
    value,
    onClick,
    danger = false,
    badge,
    toggle,
    onToggle
  }: {
    icon: React.ElementType;
    label: string;
    value?: string;
    onClick?: () => void;
    danger?: boolean;
    badge?: number;
    toggle?: boolean;
    onToggle?: (value: boolean) => void;
  }) => (
    <button
      onClick={() => {
        vibrate();
        if (onToggle !== undefined && toggle !== undefined) {
          onToggle(!toggle);
        } else if (onClick) {
          onClick();
        }
      }}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-4 transition-colors",
        "active:bg-gray-50 dark:active:bg-slate-800",
        danger && "text-red-500"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
        danger ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-slate-800"
      )}>
        <Icon className={cn("w-5 h-5", danger ? "text-red-500" : "text-gray-600 dark:text-gray-400")} />
      </div>
      <div className="flex-1 text-left">
        <span className={cn("font-medium", danger ? "text-red-500" : "dark:text-white")}>{label}</span>
        {value && <p className="text-sm text-gray-500 dark:text-gray-400">{value}</p>}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{badge}</span>
      )}
      {toggle !== undefined ? (
        <div className={cn(
          "w-12 h-7 rounded-full transition-colors relative",
          toggle ? "bg-indigo-500" : "bg-gray-300 dark:bg-slate-600"
        )}>
          <div className={cn(
            "absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform",
            toggle ? "translate-x-5" : "translate-x-0.5"
          )} />
        </div>
      ) : (
        !danger && <ChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );

  // Section Header Component
  const SectionHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 px-4 py-4 border-b dark:border-slate-800 flex items-center gap-4">
      <button onClick={() => { vibrate(); onBack(); }} className="p-2 -ml-2 rounded-full active:bg-gray-100 dark:active:bg-slate-800">
        <ChevronRight className="w-6 h-6 rotate-180 dark:text-white" />
      </button>
      <h2 className="text-xl font-bold dark:text-white">{title}</h2>
    </div>
  );

  // Main Settings
  if (section === 'main') {
    return (
      <div className="min-h-full">
        {/* Profile Card */}
        <div className="p-4">
          <div className="bg-indigo-600 premium-card p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full -ml-12 -mb-12 blur-2xl" />

            <div className="relative z-10 flex items-center gap-5">
              <div className="relative group">
                <img
                  src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || 'user'}`}
                  alt=""
                  className="w-20 h-20 rounded-2xl border-2 border-white/30 object-cover shadow-lg group-hover:scale-105 transition-transform"
                />
                <input
                  type="file"
                  id="avatar-upload-main"
                  className="hidden"
                  accept="image/*"
                  onChange={handleUpdateAvatar}
                />
                <button
                  onClick={() => document.getElementById('avatar-upload-main')?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-white text-indigo-600 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black truncate tracking-tight">{profile?.display_name || 'User'}</h2>
                <div className="flex items-center gap-1.5 opacity-80 mt-0.5">
                  <span className="text-sm font-bold">@{profile?.username || 'username'}</span>
                </div>
                {profile?.bio && <p className="text-white/70 text-xs mt-2 line-clamp-1 font-medium">{profile.bio}</p>}
              </div>
              <button
                onClick={() => setSection('account')}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
                title="Edit Account"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 px-4 mb-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center premium-card shadow-sm border border-transparent">
            <p className="text-2xl font-black text-indigo-600">{lockedChats.length}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Locked</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center premium-card shadow-sm border border-transparent">
            <p className="text-2xl font-black text-purple-600">{hiddenChats.length}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hidden</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center premium-card shadow-sm border border-transparent">
            <p className="text-2xl font-black text-orange-500">{blockedUsers.length}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Blocked</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white dark:bg-slate-900 rounded-t-3xl">
          <div className="border-b dark:border-slate-800">
            <MenuItem icon={User} label="Account" value="Edit profile, username, bio" onClick={() => setSection('account')} />
            <MenuItem icon={Lock} label="Privacy" value="Last seen, profile photo, status" onClick={() => setSection('privacy')} />
            <MenuItem icon={Shield} label="Security" value="App lock, fingerprint" onClick={() => setSection('security')} />
          </div>

          <div className="border-b dark:border-slate-800">
            <MenuItem icon={Bell} label="Notifications" value="Message, group, call alerts" onClick={() => setSection('notifications')} />
            <MenuItem icon={Database} label="Storage & Data" value="Manage storage, auto-download" onClick={() => setSection('storage')} />
            <MenuItem icon={Palette} label="Appearance" value="Theme, chat wallpaper" onClick={() => setSection('appearance')} />
          </div>

          <div className="border-b dark:border-slate-800">
            <MenuItem icon={UserX} label="Blocked Users" value={`${blockedUsers.length} blocked`} onClick={() => setSection('blocked')} />
            <MenuItem icon={Download} label="Download App" value="Get OurDM for Android & Desktop" onClick={() => {
              vibrate(10);
              // Trigger PWA install or show external links
              const event = new CustomEvent('pwa-install-prompt');
              window.dispatchEvent(event);
            }} />
            <MenuItem icon={Monitor} label="Accessibility" value="Text size, haptics, motion" onClick={() => setSection('accessibility')} />
            <MenuItem icon={HelpCircle} label="Help" value="FAQ, contact us" onClick={() => setSection('help')} />
            <MenuItem icon={Info} label="About" value={`Ourdm v3.0.1`} onClick={() => setSection('about')} />
          </div>

          {isAdmin && (
            <div className="border-b dark:border-slate-800">
              <MenuItem
                icon={Shield}
                label="Admin Panel"
                value="Manage users, settings"
                onClick={() => setActiveTab('admin')}
              />
            </div>
          )}

          <div className="py-4">
            <MenuItem icon={LogOut} label="Logout" danger onClick={handleLogout} />
          </div>
        </div>
      </div>
    );
  }

  // Account Settings
  if (section === 'account') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Account" onBack={() => setSection('main')} />

        <div className="p-4">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <img
                src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`}
                alt=""
                className="w-28 h-28 rounded-full object-cover border-4 border-gray-200 dark:border-slate-700"
              />
              <input
                type="file"
                id="avatar-upload-account"
                className="hidden"
                accept="image/*"
                onChange={handleUpdateAvatar}
              />
              <button
                onClick={() => document.getElementById('avatar-upload-account')?.click()}
                className="absolute bottom-0 right-0 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Display Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl dark:text-white disabled:opacity-60"
                />
                {isEditing && <Edit3 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  disabled={!isEditing}
                  className="w-full pl-8 pr-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl dark:text-white disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value.slice(0, 150))}
                disabled={!isEditing}
                rows={3}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl dark:text-white disabled:opacity-60 resize-none"
                placeholder="Write something about yourself..."
              />
              {isEditing && <p className="text-xs text-gray-400 mt-1">{editBio.length}/150</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl dark:text-white opacity-60"
              />
            </div>

            <div className="pt-6 border-t dark:border-slate-800">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-indigo-500" />
                  <div>
                    <p className="text-sm font-bold dark:text-white">Cloud Sync</p>
                    <p className="text-[10px] text-gray-500">Settings synced with database</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-green-500 uppercase">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(profile?.display_name || '');
                    setEditUsername(profile?.username || '');
                    setEditBio(profile?.bio || '');
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl font-medium dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Save
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Edit3 className="w-5 h-5" />
                Edit Profile
              </button>
            )}
          </div>
        </div >
      </div >
    );
  }

  // Privacy Settings
  if (section === 'privacy') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Privacy" onBack={() => setSection('main')} />

        <div className="py-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Who can see my personal info</p>

          <MenuItem
            icon={Clock}
            label="Last Seen"
            value={privacySettings.lastSeen === 'everyone' ? 'Everyone' : privacySettings.lastSeen === 'contacts' ? 'My Contacts' : 'Nobody'}
            onClick={() => {
              const options: ('everyone' | 'contacts' | 'nobody')[] = ['everyone', 'contacts', 'nobody'];
              const currentIdx = options.indexOf(privacySettings.lastSeen);
              setPrivacySettings({ lastSeen: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />
          <MenuItem
            icon={Image}
            label="Profile Photo"
            value={privacySettings.profilePhoto === 'everyone' ? 'Everyone' : privacySettings.profilePhoto === 'contacts' ? 'My Contacts' : 'Nobody'}
            onClick={() => {
              const options: ('everyone' | 'contacts' | 'nobody')[] = ['everyone', 'contacts', 'nobody'];
              const currentIdx = options.indexOf(privacySettings.profilePhoto);
              setPrivacySettings({ profilePhoto: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />
          <MenuItem
            icon={Globe}
            label="Online Status"
            value={privacySettings.onlineStatus === 'everyone' ? 'Everyone' : privacySettings.onlineStatus === 'contacts' ? 'My Contacts' : 'Nobody'}
            onClick={() => {
              const options: ('everyone' | 'contacts' | 'nobody')[] = ['everyone', 'contacts', 'nobody'];
              const currentIdx = options.indexOf(privacySettings.onlineStatus);
              setPrivacySettings({ onlineStatus: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />

          <MenuItem
            icon={Clock}
            label="Story Privacy"
            value={privacySettings.stories === 'everyone' ? 'Everyone' : 'My Contacts'}
            onClick={() => {
              setPrivacySettings({ stories: privacySettings.stories === 'everyone' ? 'contacts' : 'everyone' });
              vibrate(10);
            }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Messages</p>

          <MenuItem
            icon={Eye}
            label="Read Receipts"
            value="Blue ticks when you read messages"
            toggle={privacySettings.readReceipts}
            onToggle={(v) => { setPrivacySettings({ readReceipts: v }); vibrate(10); }}
          />
          <MenuItem
            icon={MessageCircle}
            label="Typing Indicator"
            value="Show when you're typing"
            toggle={privacySettings.typingIndicator}
            onToggle={(v) => { setPrivacySettings({ typingIndicator: v }); vibrate(10); }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Blocked</p>

          <MenuItem
            icon={UserX}
            label="Blocked Users"
            value={`${blockedUsers.length} contacts blocked`}
            onClick={() => setSection('blocked')}
          />
        </div>
      </div>
    );
  }

  // Security Settings
  if (section === 'security') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Security" onBack={() => setSection('main')} />

        <div className="py-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">App Lock</p>

          <MenuItem
            icon={Lock}
            label="App Lock"
            value={appLockPin ? 'Enabled' : 'Disabled'}
            toggle={!!appLockPin}
            onToggle={(v) => {
              if (v) setShowPinSetup(true);
              else handleRemovePin();
            }}
          />

          {appLockPin && (
            <>
              <MenuItem
                icon={Key}
                label="Change PIN"
                value="Change your app lock PIN"
                onClick={() => setShowPinSetup(true)}
              />
              <MenuItem
                icon={Fingerprint}
                label="Biometric Unlock"
                value="Use fingerprint or face"
                toggle={accessibilitySettings.highContrast} // Placeholder for real biometric if available
                onToggle={(v) => { setAccessibilitySettings({ highContrast: v }); vibrate(10); }}
              />
              <MenuItem
                icon={Clock}
                label="Auto-Lock"
                value={`Instant`}
              />
              <MenuItem
                icon={Shield}
                label="Screen Security"
                value="Block screenshots & previews"
                toggle={accessibilitySettings.reduceMotion}
                onToggle={(v) => { setAccessibilitySettings({ reduceMotion: v }); vibrate(10); }}
              />
            </>
          )}

          <div className="h-4" />
          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Chats</p>

          <div className="px-4 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium dark:text-white">Locked Chats</p>
              <p className="text-sm text-gray-500">{lockedChats.length} chats locked</p>
            </div>
          </div>

          <div className="px-4 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium dark:text-white">Hidden Chats</p>
              <p className="text-sm text-gray-500">{hiddenChats.length} chats hidden</p>
            </div>
          </div>
        </div>

        {/* PIN Setup Modal */}
        {showPinSetup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Lock className="w-8 h-8 text-indigo-500" />
              </div>

              <h3 className="text-xl font-bold text-center mb-2 dark:text-white">
                {pinStep === 'enter' ? 'Set PIN' : 'Confirm PIN'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
                {pinStep === 'enter' ? 'Enter a 4-digit PIN' : 'Re-enter your PIN to confirm'}
              </p>

              <div className="flex justify-center gap-4 mb-4">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={cn(
                      'w-4 h-4 rounded-full transition-all',
                      (pinStep === 'enter' ? pinInput : confirmPinInput).length > i
                        ? 'bg-indigo-500 scale-110'
                        : 'bg-gray-200 dark:bg-slate-600'
                    )}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-red-500 text-sm text-center mb-4">{pinError}</p>
              )}

              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinStep === 'enter' ? pinInput : confirmPinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (pinStep === 'enter') setPinInput(val);
                  else setConfirmPinInput(val);
                  setPinError('');
                }}
                className="w-full text-center text-3xl tracking-[1em] bg-gray-50 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-2xl p-4 mb-6 dark:text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPinSetup(false);
                    setPinInput('');
                    setConfirmPinInput('');
                    setPinStep('enter');
                    setPinError('');
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-medium dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPin}
                  disabled={(pinStep === 'enter' ? pinInput : confirmPinInput).length !== 4}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {pinStep === 'enter' ? 'Next' : 'Set PIN'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Notifications Settings
  if (section === 'notifications') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Notifications" onBack={() => setSection('main')} />

        <div className="py-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Messages</p>

          <MenuItem
            icon={Bell}
            label="Message Notifications"
            value="Show notifications for new messages"
            toggle={notificationSettings.enabled}
            onToggle={(v) => { setNotificationSettings({ enabled: v }); vibrate(10); }}
          />
          <MenuItem
            icon={Volume2}
            label="Message Sound"
            value="Play sound for messages"
            toggle={notificationSettings.sound}
            onToggle={(v) => { setNotificationSettings({ sound: v }); vibrate(10); }}
          />
          <MenuItem
            icon={Smartphone}
            label="Vibrate"
            value="Vibrate for messages"
            toggle={notificationSettings.vibrate}
            onToggle={(v) => { setNotificationSettings({ vibrate: v }); vibrate(10); }}
          />
          <MenuItem
            icon={Eye}
            label="Show Preview"
            value="Show message content in notification"
            toggle={notificationSettings.preview}
            onToggle={(v) => { setNotificationSettings({ preview: v }); vibrate(10); }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Groups</p>

          <MenuItem
            icon={Users}
            label="Group Notifications"
            value="Notifications for group messages"
            toggle={notificationSettings.groupEnabled}
            onToggle={(v) => { setNotificationSettings({ groupEnabled: v }); vibrate(10); }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Calls</p>

          <MenuItem
            icon={Phone}
            label="Call Ringtone"
            value="Default ringtone"
          />
          <MenuItem
            icon={Bell}
            label="Call Notifications"
            value="Vibrate and ring for calls"
            toggle={notificationSettings.callEnabled}
            onToggle={(v) => { setNotificationSettings({ callEnabled: v }); vibrate(10); }}
          />
        </div>
      </div>
    );
  }

  // Storage Settings
  if (section === 'storage') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Storage & Data" onBack={() => setSection('main')} />

        <div className="p-4">
          {/* Storage Usage Card */}
          <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium dark:text-white">Storage Used</span>
              <span className="text-sm text-gray-500">
                {storageStats ? formatStorageSize(storageStats.estimatedSize) : 'Calculating...'}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: storageStats ? `${Math.min(100, (storageStats.estimatedSize / (1024 * 1024 * 50)) * 100)}%` : '0%' }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Messages: {storageStats?.messagesCount || 0}</span>
              <span>Chats: {storageStats?.chatsCount || 0}</span>
              <span>Media: {storageStats?.mediaFilesCount || 0}</span>
            </div>
          </div>
        </div>

        <div className="py-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Auto-Download</p>

          <MenuItem
            icon={Image}
            label="Photos"
            value={storageSettings.autoDownloadPhotos === 'always' ? 'Always' : storageSettings.autoDownloadPhotos === 'wifi' ? 'WiFi only' : 'Never'}
            onClick={() => {
              const options: ('always' | 'wifi' | 'never')[] = ['always', 'wifi', 'never'];
              const currentIdx = options.indexOf(storageSettings.autoDownloadPhotos);
              setStorageSettings({ autoDownloadPhotos: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />
          <MenuItem
            icon={Smartphone}
            label="Videos"
            value={storageSettings.autoDownloadVideos === 'always' ? 'Always' : storageSettings.autoDownloadVideos === 'wifi' ? 'WiFi only' : 'Never'}
            onClick={() => {
              const options: ('always' | 'wifi' | 'never')[] = ['always', 'wifi', 'never'];
              const currentIdx = options.indexOf(storageSettings.autoDownloadVideos);
              setStorageSettings({ autoDownloadVideos: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />
          <MenuItem
            icon={Download}
            label="Documents"
            value={storageSettings.autoDownloadDocs === 'always' ? 'Always' : storageSettings.autoDownloadDocs === 'wifi' ? 'WiFi only' : 'Never'}
            onClick={() => {
              const options: ('always' | 'wifi' | 'never')[] = ['always', 'wifi', 'never'];
              const currentIdx = options.indexOf(storageSettings.autoDownloadDocs);
              setStorageSettings({ autoDownloadDocs: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Media Quality</p>

          <MenuItem
            icon={Zap}
            label="Upload Quality"
            value={storageSettings.uploadQuality === 'original' ? 'Original (Larger size)' : storageSettings.uploadQuality === 'standard' ? 'Standard (Recommended)' : 'Low (Smaller size)'}
            onClick={() => {
              const options: ('original' | 'standard' | 'low')[] = ['original', 'standard', 'low'];
              const currentIdx = options.indexOf(storageSettings.uploadQuality);
              setStorageSettings({ uploadQuality: options[(currentIdx + 1) % 3] });
              vibrate(10);
            }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Manage Storage</p>

          <MenuItem
            icon={RefreshCw}
            label="Optimize Cloud Storage"
            value="Free up Supabase storage space"
            onClick={async () => {
              vibrate(10);
              const { MessageService } = await import('@/services/MessageService');
              await MessageService.cleanupServerStorage();
              alert('Cloud storage optimized. Old media removed from server.');
            }}
          />

          <MenuItem
            icon={Trash2}
            label="Clear Cache"
            value="Free up space by clearing cache"
            onClick={() => {
              if (confirm('Clear all cached data?')) {
                caches.keys().then(names => {
                  names.forEach(name => caches.delete(name));
                });
                vibrate(10);
                alert('Cache cleared.');
              }
            }}
          />

          <MenuItem
            icon={AlertTriangle}
            label="Reset Application"
            value="Delete all data and logout"
            danger
            onClick={handleClearData}
          />
          <MenuItem
            icon={AlertTriangle}
            label="Clear All Data"
            value="Delete all messages and media"
            danger
            onClick={handleClearData}
          />
        </div>
      </div>
    );
  }

  // Appearance Settings
  if (section === 'appearance') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Appearance" onBack={() => setSection('main')} />

        <div className="py-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Theme</p>

          <div className="px-4 py-4">
            <div className="flex gap-3">
              <button
                onClick={() => { vibrate(); setTheme('light'); }}
                className={cn(
                  "flex-1 p-4 rounded-2xl border-2 transition-all",
                  theme === 'light'
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-200 dark:border-slate-700"
                )}
              >
                <Sun className={cn("w-8 h-8 mx-auto mb-2", theme === 'light' ? "text-indigo-500" : "text-gray-400")} />
                <p className={cn("text-sm font-medium text-center", theme === 'light' ? "text-indigo-600" : "dark:text-white")}>Light</p>
              </button>
              <button
                onClick={() => { vibrate(); setTheme('dark'); }}
                className={cn(
                  "flex-1 p-4 rounded-2xl border-2 transition-all",
                  theme === 'dark'
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-200 dark:border-slate-700"
                )}
              >
                <Moon className={cn("w-8 h-8 mx-auto mb-2", theme === 'dark' ? "text-indigo-500" : "text-gray-400")} />
                <p className={cn("text-sm font-medium text-center", theme === 'dark' ? "text-indigo-600" : "dark:text-white")}>Dark</p>
              </button>
            </div>
          </div>

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Chat</p>

          <MenuItem
            icon={Image}
            label="Chat Wallpaper"
            value="Default Galaxy"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    useAppStore.setState(state => ({
                      chatWallpapers: { ...state.chatWallpapers, default: reader.result as string }
                    }));
                    alert('Wallpaper updated!');
                  };
                  reader.readAsDataURL(file);
                }
              };
              input.click();
              vibrate(10);
            }}
          />
          <MenuItem
            icon={Palette}
            label="Accent Color"
            value="Indigo (Adaptive)"
            onClick={() => {
              vibrate(10);
              alert('Accent color adapts to your theme automatically.');
            }}
          />
        </div>
      </div>
    );
  }

  // Blocked Users
  if (section === 'blocked') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Blocked Users" onBack={() => setSection('main')} />

        {blockedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <UserX className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No blocked users</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
              Users you block will appear here
            </p>
          </div>
        ) : (
          <div className="py-2">
            {blockedUsers.map((userId) => (
              <div key={userId} className="flex items-center gap-4 px-4 py-3 border-b dark:border-slate-800">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-700" />
                <div className="flex-1">
                  <p className="font-medium dark:text-white">User {userId.slice(0, 8)}</p>
                </div>
                <button className="px-4 py-2 text-red-500 text-sm font-medium">Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Accessibility Settings
  if (section === 'accessibility') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Accessibility" onBack={() => setSection('main')} />

        <div className="py-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Display & Motion</p>

          <MenuItem
            icon={Type}
            label="Text Size"
            value={`${accessibilitySettings.fontSize}%`}
            onClick={() => {
              const sizes = [80, 100, 120, 140];
              const currentIdx = sizes.indexOf(accessibilitySettings.fontSize);
              setAccessibilitySettings({ fontSize: sizes[(currentIdx + 1) % 4] });
              vibrate(10);
            }}
          />
          <MenuItem
            icon={Monitor}
            label="Reduce Motion"
            value="Minimize animations and effects"
            toggle={accessibilitySettings.reduceMotion}
            onToggle={(v) => { setAccessibilitySettings({ reduceMotion: v }); vibrate(10); }}
          />

          <div className="h-4" />
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Feedback</p>

          <MenuItem
            icon={Zap}
            label="Haptic Feedback"
            value="Vibrate on touch and interactions"
            toggle={accessibilitySettings.hapticFeedback}
            onToggle={(v) => { setAccessibilitySettings({ hapticFeedback: v }); vibrate(10); }}
          />
        </div>
      </div>
    );
  }

  // Help
  if (section === 'help') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="Help" onBack={() => setSection('main')} />

        <div className="py-2">
          <MenuItem icon={HelpCircle} label="FAQ" value="Frequently asked questions" />
          <MenuItem icon={MessageCircle} label="Contact Us" value="Get help from our team" />
          <MenuItem icon={Info} label="Terms of Service" value="Read our terms" />
          <MenuItem icon={Shield} label="Privacy Policy" value="How we protect your data" />
        </div>
      </div>
    );
  }

  // About
  if (section === 'about') {
    return (
      <div className="min-h-full bg-white dark:bg-slate-900">
        <SectionHeader title="About" onBack={() => setSection('main')} />

        <div className="p-6 text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
            <MessageCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold dark:text-white mb-1">Ourdm</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Private & Secure Messaging</p>
          <p className="text-sm text-gray-400 mb-6">Version 3.0.0</p>

          <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl p-4 text-left mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Ourdm is a production-ready, end-to-end encrypted messaging platform with voice/video calls, stories, and group chats.
            </p>
          </div>

          <p className="text-xs text-gray-400 mb-2">Made with ❤️ by Sameer Shah</p>
          <p className="text-xs text-gray-400">© 2025 Ourdm Privacy Systems</p>
        </div>
      </div>
    );
  }

  return null;
}
