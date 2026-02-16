import { useState } from 'react';
import { ArrowLeft, Users, MessageCircle, Phone, Bell, Settings, Trash2, Ban, UserCheck, Crown, Send, BarChart3, Activity, Database, Globe } from 'lucide-react';
import { useAppStore, type AppUser, type Broadcast } from '@/store/appStore';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const {
    profile, allUsers, adminSettings, setAdminSettings, updateUser,
    broadcasts, addBroadcast, callLogs, chats
  } = useAppStore();
  
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'settings' | 'broadcast'>('dashboard');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'urgent'>('info');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = {
    totalUsers: allUsers.length,
    onlineUsers: allUsers.filter(u => u.is_online).length,
    totalChats: chats.length,
    totalCalls: callLogs.length,
    suspendedUsers: allUsers.filter(u => u.is_suspended).length,
    adminUsers: allUsers.filter(u => u.is_admin).length
  };

  const handleToggleSetting = async (key: keyof typeof adminSettings) => {
    const newValue = !adminSettings[key];
    setAdminSettings({ [key]: newValue });
    
    try {
      await supabase
        .from('admin_settings')
        .upsert({ key, value: JSON.stringify(newValue), updated_by: profile?.id });
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  };

  const handleUpdateNumericSetting = async (key: keyof typeof adminSettings, value: number) => {
    setAdminSettings({ [key]: value });
    
    try {
      await supabase
        .from('admin_settings')
        .upsert({ key, value: JSON.stringify(value), updated_by: profile?.id });
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  };

  const handleSuspendUser = async (oderId: string, suspend: boolean) => {
    updateUser(oderId, { is_suspended: suspend });
    
    try {
      await supabase
        .from('profiles')
        .update({ is_suspended: suspend })
        .eq('id', oderId);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
    setSelectedUser(null);
  };

  const handleToggleAdmin = async (oderId: string, makeAdmin: boolean) => {
    updateUser(oderId, { is_admin: makeAdmin });
    
    try {
      await supabase
        .from('profiles')
        .update({ is_admin: makeAdmin })
        .eq('id', oderId);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
    setSelectedUser(null);
  };

  const handleDeleteUser = async (oderId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    
    try {
      await supabase.from('profiles').delete().eq('id', oderId);
      // Remove from local state
      useAppStore.setState(state => ({
        allUsers: state.allUsers.filter(u => u.id !== oderId)
      }));
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
    setSelectedUser(null);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || !profile) return;
    
    const broadcast: Broadcast = {
      id: crypto.randomUUID(),
      admin_id: profile.id,
      title: broadcastTitle,
      message: broadcastMessage,
      type: broadcastType,
      read_by: [],
      created_at: new Date().toISOString()
    };
    
    addBroadcast(broadcast);
    
    try {
      await supabase.from('broadcasts').insert(broadcast);
    } catch (error) {
      console.error('Failed to send broadcast:', error);
    }
    
    setBroadcastTitle('');
    setBroadcastMessage('');
    setBroadcastType('info');
  };

  const filteredUsers = allUsers.filter(u =>
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-4 safe-area-top">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-sm text-white/70">Manage Ourdm</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-white dark:bg-slate-800 border-b dark:border-slate-700 overflow-x-auto">
        {[
          { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'settings', icon: Settings, label: 'Settings' },
          { id: 'broadcast', icon: Bell, label: 'Broadcast' }
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as typeof activeSection)}
            className={cn(
              'flex-1 min-w-[80px] py-3 flex flex-col items-center gap-1 transition-colors',
              activeSection === id
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-500'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        {/* Dashboard */}
        {activeSection === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white">
                <Users className="w-8 h-8 mb-2 opacity-80" />
                <h3 className="text-3xl font-bold">{stats.totalUsers}</h3>
                <p className="text-white/70">Total Users</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white">
                <Activity className="w-8 h-8 mb-2 opacity-80" />
                <h3 className="text-3xl font-bold">{stats.onlineUsers}</h3>
                <p className="text-white/70">Online Now</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-4 text-white">
                <MessageCircle className="w-8 h-8 mb-2 opacity-80" />
                <h3 className="text-3xl font-bold">{stats.totalChats}</h3>
                <p className="text-white/70">Active Chats</p>
              </div>
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-4 text-white">
                <Phone className="w-8 h-8 mb-2 opacity-80" />
                <h3 className="text-3xl font-bold">{stats.totalCalls}</h3>
                <p className="text-white/70">Total Calls</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5" />
                System Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Server Status</span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                    Online
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Database</span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                    Connected
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Admin Users</span>
                  <span className="font-medium dark:text-white">{stats.adminUsers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Suspended Users</span>
                  <span className="font-medium text-red-500">{stats.suspendedUsers}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Recent Broadcasts
              </h3>
              {broadcasts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No broadcasts yet</p>
              ) : (
                <div className="space-y-2">
                  {broadcasts.slice(0, 3).map(b => (
                    <div key={b.id} className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          b.type === 'urgent' ? 'bg-red-500' :
                          b.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        )} />
                        <span className="font-medium dark:text-white text-sm">{b.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Management */}
        {activeSection === 'users' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
            />
            
            <div className="space-y-2">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="relative">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt=""
                      className="w-12 h-12 rounded-full"
                    />
                    {user.is_online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold dark:text-white truncate">{user.display_name}</h3>
                      {user.is_admin && <Crown className="w-4 h-4 text-yellow-500" />}
                      {user.is_suspended && <Ban className="w-4 h-4 text-red-500" />}
                    </div>
                    <p className="text-sm text-gray-500 truncate">@{user.username} • {user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {activeSection === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <h3 className="font-bold mb-4 dark:text-white">Feature Toggles</h3>
              <div className="space-y-4">
                {[
                  { key: 'voice_calls_enabled', label: 'Voice Calls', icon: Phone },
                  { key: 'video_calls_enabled', label: 'Video Calls', icon: Phone },
                  { key: 'stun_enabled', label: 'STUN Servers', icon: Globe },
                  { key: 'turn_enabled', label: 'TURN Servers', icon: Globe },
                  { key: 'stories_enabled', label: 'Stories', icon: Activity },
                  { key: 'registration_enabled', label: 'New Registrations', icon: UserCheck },
                  { key: 'maintenance_mode', label: 'Maintenance Mode', icon: Settings }
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-500" />
                      <span className="dark:text-white">{label}</span>
                    </div>
                    <button
                      onClick={() => handleToggleSetting(key as keyof typeof adminSettings)}
                      className={cn(
                        'w-12 h-6 rounded-full transition-colors relative',
                        adminSettings[key as keyof typeof adminSettings] ? 'bg-green-500' : 'bg-gray-300'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow',
                        adminSettings[key as keyof typeof adminSettings] ? 'right-0.5' : 'left-0.5'
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <h3 className="font-bold mb-4 dark:text-white">Limits</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Max File Size (MB)</label>
                  <input
                    type="number"
                    value={adminSettings.max_file_size_mb}
                    onChange={(e) => handleUpdateNumericSetting('max_file_size_mb', parseInt(e.target.value) || 25)}
                    className="w-full mt-1 px-4 py-2 border dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Max Message Length</label>
                  <input
                    type="number"
                    value={adminSettings.max_message_length}
                    onChange={(e) => handleUpdateNumericSetting('max_message_length', parseInt(e.target.value) || 5000)}
                    className="w-full mt-1 px-4 py-2 border dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Max Friends per User</label>
                  <input
                    type="number"
                    value={adminSettings.max_friends}
                    onChange={(e) => handleUpdateNumericSetting('max_friends', parseInt(e.target.value) || 500)}
                    className="w-full mt-1 px-4 py-2 border dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Disappearing Messages (hours, 0 = disabled)</label>
                  <input
                    type="number"
                    value={adminSettings.disappearing_messages_hours}
                    onChange={(e) => handleUpdateNumericSetting('disappearing_messages_hours', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 px-4 py-2 border dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Broadcast */}
        {activeSection === 'broadcast' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <h3 className="font-bold mb-4 dark:text-white">Send Announcement</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Type</label>
                  <div className="flex gap-2 mt-1">
                    {(['info', 'warning', 'urgent'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setBroadcastType(type)}
                        className={cn(
                          'flex-1 py-2 rounded-xl capitalize transition-colors',
                          broadcastType === type
                            ? type === 'urgent' ? 'bg-red-500 text-white' :
                              type === 'warning' ? 'bg-yellow-500 text-white' :
                              'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 dark:text-white'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Title</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Announcement title"
                    className="w-full mt-1 px-4 py-2 border dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Message</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Your message to all users..."
                    rows={4}
                    className="w-full mt-1 px-4 py-2 border dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white resize-none"
                  />
                </div>
                
                <button
                  onClick={handleSendBroadcast}
                  disabled={!broadcastTitle.trim() || !broadcastMessage.trim()}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send to All Users
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <h3 className="font-bold mb-4 dark:text-white">Previous Broadcasts</h3>
              {broadcasts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No broadcasts yet</p>
              ) : (
                <div className="space-y-3">
                  {broadcasts.map(b => (
                    <div key={b.id} className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium dark:text-white">{b.title}</span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          b.type === 'urgent' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          b.type === 'warning' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        )}>
                          {b.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{b.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Read by {b.read_by.length} users
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setSelectedUser(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <img
                src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
                alt=""
                className="w-16 h-16 rounded-full"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold dark:text-white">{selectedUser.display_name}</h3>
                  {selectedUser.is_admin && <Crown className="w-5 h-5 text-yellow-500" />}
                </div>
                <p className="text-gray-500">@{selectedUser.username}</p>
                <p className="text-sm text-gray-400">{selectedUser.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleToggleAdmin(selectedUser.id, !selectedUser.is_admin)}
                className="w-full p-4 flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <Crown className="w-5 h-5 text-yellow-500" />
                <span className="dark:text-white">
                  {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
                </span>
              </button>
              
              <button
                onClick={() => handleSuspendUser(selectedUser.id, !selectedUser.is_suspended)}
                className="w-full p-4 flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <Ban className={cn('w-5 h-5', selectedUser.is_suspended ? 'text-green-500' : 'text-red-500')} />
                <span className="dark:text-white">
                  {selectedUser.is_suspended ? 'Unsuspend User' : 'Suspend User'}
                </span>
              </button>
              
              <button
                onClick={() => handleDeleteUser(selectedUser.id)}
                className="w-full p-4 flex items-center gap-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
              >
                <Trash2 className="w-5 h-5" />
                <span>Delete User Permanently</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-4 py-3 border dark:border-slate-600 rounded-xl dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
