import { useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, X } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useAppStore, type AppUser } from '@/store/appStore';
import { cn } from '@/utils/cn';

interface CallsViewProps {
  onStartCall?: (user: AppUser, type: 'voice' | 'video') => void;
}

export function CallsView({ onStartCall }: CallsViewProps) {
  const { callLogs, friends, setActiveCall, adminSettings, profile } = useAppStore();
  const [showNewCall, setShowNewCall] = useState(false);
  const [callSearch, setCallSearch] = useState('');

  const groupedCalls = callLogs.reduce((acc, call) => {
    const date = format(new Date(call.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(call);
    return acc;
  }, {} as Record<string, typeof callLogs>);

  const sortedDates = Object.keys(groupedCalls).sort((a, b) => b.localeCompare(a));

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatGroupDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const startCall = (user: AppUser, type: 'voice' | 'video') => {
    if (!adminSettings.calls_enabled) {
      alert('Calls are currently disabled.');
      return;
    }
    if (onStartCall) {
      onStartCall(user, type);
    } else {
      setActiveCall({
        id: crypto.randomUUID(),
        type,
        status: 'calling',
        remoteUser: user,
        startTime: new Date().toISOString()
      });
    }
    setShowNewCall(false);
  };

  const filteredFriends = friends.filter(f =>
    f.display_name.toLowerCase().includes(callSearch.toLowerCase()) ||
    f.username.toLowerCase().includes(callSearch.toLowerCase())
  );

  const getCallIcon = (call: typeof callLogs[0]) => {
    const isOutgoing = call.caller_id === profile?.id;
    if (call.status === 'missed') return <PhoneMissed className="w-4 h-4 text-red-500" />;
    if (isOutgoing) return <PhoneOutgoing className="w-4 h-4 text-indigo-500" />;
    return <PhoneIncoming className="w-4 h-4 text-green-500" />;
  };

  const getCallStatusText = (call: typeof callLogs[0]) => {
    const isOutgoing = call.caller_id === profile?.id;
    if (call.status === 'missed') return 'Missed';
    if (call.status === 'declined') return 'Declined';
    if (isOutgoing) return 'Outgoing';
    return 'Incoming';
  };

  const getRemoteUser = (call: typeof callLogs[0]) => {
    const isOutgoing = call.caller_id === profile?.id;
    return isOutgoing ? call.receiver : call.caller;
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Call Modal */}
      {showNewCall && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setShowNewCall(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-sheet-handle mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold dark:text-white">New Call</h3>
              <button
                onClick={() => setShowNewCall(false)}
                className="p-2 rounded-full bg-gray-100 dark:bg-slate-700"
              >
                <X className="w-5 h-5 dark:text-white" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search friends..."
              value={callSearch}
              onChange={(e) => setCallSearch(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-slate-700 rounded-xl mb-4 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredFriends.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                  {callSearch ? 'No friends found' : 'Add friends to start calling'}
                </p>
              ) : (
                filteredFriends.map(friend => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {friend.is_online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold dark:text-white truncate">{friend.display_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {friend.is_online ? <span className="text-green-500">Online</span> : 'Offline'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startCall(friend, 'voice')}
                        className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full active:scale-90 transition-transform"
                        title="Voice Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startCall(friend, 'video')}
                        className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full active:scale-90 transition-transform"
                        title="Video Call"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header area with New Call button */}
      {adminSettings.calls_enabled && (
        <div className="px-4 py-3 flex justify-end border-b dark:border-slate-700">
          <button
            onClick={() => setShowNewCall(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium active:scale-95 transition-transform"
          >
            <PhoneCall className="w-4 h-4" />
            New Call
          </button>
        </div>
      )}

      {/* Call History */}
      <div className="flex-1 overflow-y-auto">
        {callLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-6">
            <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-5">
              <Phone className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">No calls yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6">
              Your call history will appear here
            </p>
            {adminSettings.calls_enabled && (
              <button
                onClick={() => setShowNewCall(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-medium"
              >
                <PhoneCall className="w-5 h-5" />
                Start a Call
              </button>
            )}
          </div>
        ) : (
          <div>
            {sortedDates.map(date => (
              <div key={date}>
                {/* Date Header */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {formatGroupDate(date)}
                  </p>
                </div>

                {/* Calls for this date */}
                {groupedCalls[date].map(call => {
                  const remoteUser = getRemoteUser(call);
                  const isMissed = call.status === 'missed';

                  return (
                    <div
                      key={call.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-4 mx-2 my-1 rounded-2xl transition-all',
                        'bg-white dark:bg-slate-900 premium-card shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-slate-800',
                        'active:scale-[0.98]'
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={remoteUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUser?.username || 'user'}`}
                          alt=""
                          className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 dark:border-slate-800"
                        />
                        {/* Call type badge */}
                        <div className={cn(
                          'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900',
                          call.type === 'video' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-green-500 shadow-green-500/50',
                          'shadow-sm'
                        )}>
                          {call.type === 'video'
                            ? <Video className="w-3 h-3 text-white" />
                            : <Phone className="w-3 h-3 text-white" />
                          }
                        </div>
                      </div>

                      {/* Call Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          'font-bold truncate',
                          isMissed ? 'text-red-500' : 'dark:text-white'
                        )}>
                          {remoteUser?.display_name || 'Unknown'}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {getCallIcon(call)}
                          <span className={cn(
                            'text-sm font-medium',
                            isMissed ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'
                          )}>
                            {getCallStatusText(call)}
                            {call.duration && call.duration > 0 && (
                              <span className="ml-1 opacity-60">· {formatDuration(call.duration)}</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Time & Call Back */}
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 uppercase tracking-tighter">
                          {format(new Date(call.created_at), 'HH:mm')}
                        </span>
                        {adminSettings.calls_enabled && remoteUser && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => startCall(remoteUser as AppUser, 'voice')}
                              className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl active:scale-90 transition-transform"
                              title="Call back"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            {call.type === 'video' && (
                              <button
                                onClick={() => startCall(remoteUser as AppUser, 'video')}
                                className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl active:scale-90 transition-transform"
                                title="Video call back"
                              >
                                <Video className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
