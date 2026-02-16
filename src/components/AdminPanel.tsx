import React, { useState } from 'react';

// Admin Settings Interface
export interface AdminSettings {
  // Call Settings
  voiceCallEnabled: boolean;
  videoCallEnabled: boolean;
  groupCallEnabled: boolean;
  stunEnabled: boolean;
  turnEnabled: boolean;
  maxCallDuration: number; // minutes, 0 = unlimited
  defaultVideoQuality: 'FULL_HD_60' | 'FULL_HD_30' | 'HD_60' | 'HD_30' | 'SD_30';
  
  // Messaging Settings
  messagingEnabled: boolean;
  maxMessageLength: number;
  maxFileSize: number; // MB
  allowedFileTypes: string[];
  disappearingMessagesEnabled: boolean;
  disappearingMessagesDuration: number; // hours
  
  // Stories Settings
  storiesEnabled: boolean;
  storyDuration: number; // hours
  maxStoryFileSize: number; // MB
  
  // Friends Settings
  maxFriends: number;
  friendRequestsEnabled: boolean;
  
  // Security Settings
  e2eEncryptionEnabled: boolean;
  appLockEnabled: boolean;
  hiddenChatsEnabled: boolean;
  
  // Registration Settings
  registrationEnabled: boolean;
  googleAuthEnabled: boolean;
  emailVerificationRequired: boolean;
  
  // System Settings
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maxStoragePerUser: number; // MB
  
  // Moderation
  profanityFilterEnabled: boolean;
  spamDetectionEnabled: boolean;
  maxMessagesPerMinute: number;
}

// Default Admin Settings
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  // Call Settings
  voiceCallEnabled: true,
  videoCallEnabled: true,
  groupCallEnabled: true,
  stunEnabled: true,
  turnEnabled: true,
  maxCallDuration: 0, // Unlimited
  defaultVideoQuality: 'FULL_HD_60',
  
  // Messaging Settings
  messagingEnabled: true,
  maxMessageLength: 10000,
  maxFileSize: 100, // 100 MB
  allowedFileTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
  disappearingMessagesEnabled: true,
  disappearingMessagesDuration: 24,
  
  // Stories Settings
  storiesEnabled: true,
  storyDuration: 24,
  maxStoryFileSize: 50,
  
  // Friends Settings
  maxFriends: 5000,
  friendRequestsEnabled: true,
  
  // Security Settings
  e2eEncryptionEnabled: true,
  appLockEnabled: true,
  hiddenChatsEnabled: true,
  
  // Registration Settings
  registrationEnabled: true,
  googleAuthEnabled: true,
  emailVerificationRequired: false,
  
  // System Settings
  maintenanceMode: false,
  maintenanceMessage: 'System is under maintenance. Please try again later.',
  maxStoragePerUser: 5000, // 5 GB
  
  // Moderation
  profanityFilterEnabled: false,
  spamDetectionEnabled: true,
  maxMessagesPerMinute: 60,
};

interface AdminPanelProps {
  settings: AdminSettings;
  onSettingsChange: (settings: AdminSettings) => void;
  onBack: () => void;
  stats: {
    totalUsers: number;
    onlineUsers: number;
    totalMessages: number;
    totalCalls: number;
    stunCalls: number;
    turnCalls: number;
    totalStorage: number;
  };
  onBroadcast: (message: string) => void;
  onSuspendUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  users: Array<{
    id: string;
    name: string;
    email: string;
    status: 'online' | 'offline';
    suspended: boolean;
    isAdmin: boolean;
    lastSeen: Date;
    messagesCount: number;
    callsCount: number;
    storageUsed: number;
  }>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  onSettingsChange,
  onBack,
  stats,
  onBroadcast,
  onSuspendUser,
  onDeleteUser,
  users,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calls' | 'messaging' | 'users' | 'security' | 'system'>('dashboard');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  
  // Calculate STUN vs TURN usage percentage
  const totalCallsWithTransport = stats.stunCalls + stats.turnCalls;
  const stunPercentage = totalCallsWithTransport > 0 
    ? Math.round((stats.stunCalls / totalCallsWithTransport) * 100) 
    : 0;
  const turnPercentage = totalCallsWithTransport > 0 
    ? Math.round((stats.turnCalls / totalCallsWithTransport) * 100) 
    : 0;
  
  const updateSetting = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };
  
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleBroadcast = () => {
    if (broadcastMessage.trim()) {
      onBroadcast(broadcastMessage);
      setBroadcastMessage('');
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-gray-400">Manage all app settings</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-green-400">Live</span>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-800 bg-gray-900/50 backdrop-blur-lg sticky top-16 z-10">
        {(['dashboard', 'calls', 'messaging', 'users', 'security', 'system'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="p-4 space-y-6 pb-24">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="Total Users" value={stats.totalUsers} icon="👥" color="cyan" />
              <StatCard title="Online Now" value={stats.onlineUsers} icon="🟢" color="green" />
              <StatCard title="Messages" value={stats.totalMessages} icon="💬" color="purple" />
              <StatCard title="Calls" value={stats.totalCalls} icon="📞" color="blue" />
            </div>
            
            {/* STUN vs TURN Usage */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-4">📡 Call Transport Usage</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-400">STUN (Free)</span>
                    <span className="text-green-400">{stunPercentage}%</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${stunPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-orange-400">TURN (Paid)</span>
                    <span className="text-orange-400">{turnPercentage}%</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${turnPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Target: 95% STUN, 5% TURN for optimal cost savings
              </p>
            </div>
            
            {/* Broadcast */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-3">📢 Broadcast Announcement</h3>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Type your announcement..."
                className="w-full bg-gray-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none"
                rows={3}
              />
              <button
                onClick={handleBroadcast}
                disabled={!broadcastMessage.trim()}
                className="mt-3 w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:text-gray-500 py-2 rounded-lg font-medium transition-colors"
              >
                Send to All Users
              </button>
            </div>
            
            {/* Storage Usage */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-3">💾 Storage Usage</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{formatBytes(stats.totalStorage * 1024 * 1024)}</span>
                    <span className="text-gray-400">of {formatBytes(settings.maxStoragePerUser * stats.totalUsers * 1024 * 1024)}</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: `${Math.min((stats.totalStorage / (settings.maxStoragePerUser * stats.totalUsers)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Calls Tab */}
        {activeTab === 'calls' && (
          <>
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">📞 Call Features</h3>
              
              <ToggleSetting
                label="Voice Calls"
                description="Enable voice calling between users"
                enabled={settings.voiceCallEnabled}
                onChange={(v) => updateSetting('voiceCallEnabled', v)}
              />
              
              <ToggleSetting
                label="Video Calls"
                description="Enable video calling (requires voice calls)"
                enabled={settings.videoCallEnabled}
                onChange={(v) => updateSetting('videoCallEnabled', v)}
                disabled={!settings.voiceCallEnabled}
              />
              
              <ToggleSetting
                label="Group Calls"
                description="Enable multi-person calls"
                enabled={settings.groupCallEnabled}
                onChange={(v) => updateSetting('groupCallEnabled', v)}
                disabled={!settings.voiceCallEnabled}
              />
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">🌐 Server Configuration</h3>
              
              <ToggleSetting
                label="STUN Servers"
                description="Free servers for direct P2P connections (95% of calls)"
                enabled={settings.stunEnabled}
                onChange={(v) => updateSetting('stunEnabled', v)}
              />
              
              <ToggleSetting
                label="TURN Servers"
                description="Relay servers for restricted networks (costs money)"
                enabled={settings.turnEnabled}
                onChange={(v) => updateSetting('turnEnabled', v)}
              />
              
              <div className="text-xs text-gray-500 p-2 bg-gray-700 rounded-lg">
                ℹ️ If both STUN and TURN are disabled, calls will only work on local networks.
                For best results, keep STUN enabled (free) and TURN as fallback (5% usage).
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">🎥 Video Quality</h3>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Default Video Quality</label>
                <select
                  value={settings.defaultVideoQuality}
                  onChange={(e) => updateSetting('defaultVideoQuality', e.target.value as AdminSettings['defaultVideoQuality'])}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                >
                  <option value="FULL_HD_60">Full HD 1080p @ 60fps (Best)</option>
                  <option value="FULL_HD_30">Full HD 1080p @ 30fps</option>
                  <option value="HD_60">HD 720p @ 60fps</option>
                  <option value="HD_30">HD 720p @ 30fps (Recommended)</option>
                  <option value="SD_30">SD 480p @ 30fps (Low Bandwidth)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Call Duration (minutes, 0 = unlimited)</label>
                <input
                  type="number"
                  value={settings.maxCallDuration}
                  onChange={(e) => updateSetting('maxCallDuration', parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={0}
                />
              </div>
            </div>
          </>
        )}
        
        {/* Messaging Tab */}
        {activeTab === 'messaging' && (
          <>
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">💬 Messaging</h3>
              
              <ToggleSetting
                label="Messaging"
                description="Enable messaging between users"
                enabled={settings.messagingEnabled}
                onChange={(v) => updateSetting('messagingEnabled', v)}
              />
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Message Length</label>
                <input
                  type="number"
                  value={settings.maxMessageLength}
                  onChange={(e) => updateSetting('maxMessageLength', parseInt(e.target.value) || 1000)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={100}
                  max={100000}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max File Size (MB)</label>
                <input
                  type="number"
                  value={settings.maxFileSize}
                  onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value) || 10)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={1}
                  max={1000}
                />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">⏱️ Disappearing Messages</h3>
              
              <ToggleSetting
                label="Disappearing Messages"
                description="Allow messages to auto-delete after a period"
                enabled={settings.disappearingMessagesEnabled}
                onChange={(v) => updateSetting('disappearingMessagesEnabled', v)}
              />
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Default Duration (hours)</label>
                <select
                  value={settings.disappearingMessagesDuration}
                  onChange={(e) => updateSetting('disappearingMessagesDuration', parseInt(e.target.value))}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  disabled={!settings.disappearingMessagesEnabled}
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>24 hours</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">📷 Stories</h3>
              
              <ToggleSetting
                label="Stories"
                description="Enable 24-hour disappearing stories"
                enabled={settings.storiesEnabled}
                onChange={(v) => updateSetting('storiesEnabled', v)}
              />
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Story Duration (hours)</label>
                <input
                  type="number"
                  value={settings.storyDuration}
                  onChange={(e) => updateSetting('storyDuration', parseInt(e.target.value) || 24)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={1}
                  max={168}
                  disabled={!settings.storiesEnabled}
                />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">👥 Friends</h3>
              
              <ToggleSetting
                label="Friend Requests"
                description="Allow users to send friend requests"
                enabled={settings.friendRequestsEnabled}
                onChange={(v) => updateSetting('friendRequestsEnabled', v)}
              />
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Friends per User</label>
                <input
                  type="number"
                  value={settings.maxFriends}
                  onChange={(e) => updateSetting('maxFriends', parseInt(e.target.value) || 100)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={10}
                  max={10000}
                />
              </div>
            </div>
          </>
        )}
        
        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="flex-1 bg-gray-700 rounded-lg p-3 text-white placeholder-gray-500"
                />
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No users found</p>
                ) : (
                  filteredUsers.map(user => (
                    <div
                      key={user.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedUser === user.id ? 'bg-cyan-600/20 border border-cyan-600' : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                            {user.name[0].toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${
                            user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{user.name}</p>
                            {user.isAdmin && (
                              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Admin</span>
                            )}
                            {user.suspended && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Suspended</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>
                      
                      {selectedUser === user.id && (
                        <div className="mt-3 pt-3 border-t border-gray-600 space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                              <p className="text-gray-400">Messages</p>
                              <p className="font-bold">{user.messagesCount}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Calls</p>
                              <p className="font-bold">{user.callsCount}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Storage</p>
                              <p className="font-bold">{formatBytes(user.storageUsed * 1024 * 1024)}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Last seen: {user.lastSeen.toLocaleString()}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onSuspendUser(user.id); }}
                              className={`flex-1 py-2 rounded-lg font-medium text-sm ${
                                user.suspended
                                  ? 'bg-green-600 hover:bg-green-700'
                                  : 'bg-orange-600 hover:bg-orange-700'
                              }`}
                            >
                              {user.suspended ? 'Unsuspend' : 'Suspend'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteUser(user.id); }}
                              className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Security Tab */}
        {activeTab === 'security' && (
          <>
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">🔒 Encryption & Privacy</h3>
              
              <ToggleSetting
                label="End-to-End Encryption"
                description="Encrypt all messages using AES-256-GCM"
                enabled={settings.e2eEncryptionEnabled}
                onChange={(v) => updateSetting('e2eEncryptionEnabled', v)}
              />
              
              <ToggleSetting
                label="App Lock"
                description="Allow users to lock app with PIN"
                enabled={settings.appLockEnabled}
                onChange={(v) => updateSetting('appLockEnabled', v)}
              />
              
              <ToggleSetting
                label="Hidden Chats"
                description="Allow users to hide chats with PIN"
                enabled={settings.hiddenChatsEnabled}
                onChange={(v) => updateSetting('hiddenChatsEnabled', v)}
              />
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">🛡️ Moderation</h3>
              
              <ToggleSetting
                label="Profanity Filter"
                description="Block messages containing profanity"
                enabled={settings.profanityFilterEnabled}
                onChange={(v) => updateSetting('profanityFilterEnabled', v)}
              />
              
              <ToggleSetting
                label="Spam Detection"
                description="Detect and block spam messages"
                enabled={settings.spamDetectionEnabled}
                onChange={(v) => updateSetting('spamDetectionEnabled', v)}
              />
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Messages per Minute</label>
                <input
                  type="number"
                  value={settings.maxMessagesPerMinute}
                  onChange={(e) => updateSetting('maxMessagesPerMinute', parseInt(e.target.value) || 30)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={10}
                  max={200}
                />
              </div>
            </div>
          </>
        )}
        
        {/* System Tab */}
        {activeTab === 'system' && (
          <>
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">🚀 Registration</h3>
              
              <ToggleSetting
                label="New Registrations"
                description="Allow new users to sign up"
                enabled={settings.registrationEnabled}
                onChange={(v) => updateSetting('registrationEnabled', v)}
              />
              
              <ToggleSetting
                label="Google Sign-In"
                description="Allow sign up with Google"
                enabled={settings.googleAuthEnabled}
                onChange={(v) => updateSetting('googleAuthEnabled', v)}
              />
              
              <ToggleSetting
                label="Email Verification"
                description="Require email verification for new accounts"
                enabled={settings.emailVerificationRequired}
                onChange={(v) => updateSetting('emailVerificationRequired', v)}
              />
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-lg font-semibold">⚙️ System</h3>
              
              <ToggleSetting
                label="Maintenance Mode"
                description="Put app in maintenance mode (users can't access)"
                enabled={settings.maintenanceMode}
                onChange={(v) => updateSetting('maintenanceMode', v)}
              />
              
              {settings.maintenanceMode && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Maintenance Message</label>
                  <textarea
                    value={settings.maintenanceMessage}
                    onChange={(e) => updateSetting('maintenanceMessage', e.target.value)}
                    className="w-full bg-gray-700 rounded-lg p-3 text-white resize-none"
                    rows={2}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Storage per User (MB)</label>
                <input
                  type="number"
                  value={settings.maxStoragePerUser}
                  onChange={(e) => updateSetting('maxStoragePerUser', parseInt(e.target.value) || 1000)}
                  className="w-full bg-gray-700 rounded-lg p-3 text-white"
                  min={100}
                  max={50000}
                />
              </div>
            </div>
            
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ Danger Zone</h3>
              <button className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-medium transition-colors">
                Reset All Settings to Default
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Helper Components
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: string;
  color: 'cyan' | 'green' | 'purple' | 'blue' | 'orange' | 'red';
}> = ({ title, value, icon, color }) => {
  const colors = {
    cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm text-gray-400">{title}</span>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
};

const ToggleSetting: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, enabled, onChange, disabled = false }) => (
  <div className={`flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex-1 mr-4">
      <p className="font-medium">{label}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`w-12 h-7 rounded-full transition-colors relative ${
        enabled ? 'bg-cyan-500' : 'bg-gray-600'
      }`}
    >
      <div
        className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default AdminPanel;
