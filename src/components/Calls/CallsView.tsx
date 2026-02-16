import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { useAppStore, type AppUser, type CallLog } from '@/store/appStore';
import { cn } from '@/utils/cn';
import { format, isToday, isYesterday } from 'date-fns';

interface CallsViewProps {
  onStartCall: (user: AppUser, type: 'voice' | 'video') => void;
}

export function CallsView({ onStartCall }: CallsViewProps) {
  const { callLogs, profile, adminSettings } = useAppStore();

  const getCallIcon = (call: CallLog) => {
    const isOutgoing = call.caller_id === profile?.id;
    
    if (call.status === 'missed' || call.status === 'no_answer') {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    
    if (isOutgoing) {
      return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
    }
    
    return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
  };

  const getOtherUser = (call: CallLog): AppUser | undefined => {
    return call.caller_id === profile?.id ? call.receiver : call.caller;
  };

  const formatCallTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'HH:mm');
    }
    return format(date, 'MMM d, HH:mm');
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds === 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Group calls by date
  const groupedCalls = callLogs.reduce((acc, call) => {
    const date = format(new Date(call.created_at), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(call);
    return acc;
  }, {} as Record<string, CallLog[]>);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Info */}
      <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Call History</h2>
            <p className="text-sm text-white/70">{callLogs.length} calls</p>
          </div>
          <div className="flex gap-2">
            {adminSettings.voice_calls_enabled && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-sm">
                <Phone className="w-4 h-4" />
                <span>Voice</span>
              </div>
            )}
            {adminSettings.video_calls_enabled && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-sm">
                <Video className="w-4 h-4" />
                <span>Video</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto">
        {callLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Phone className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No calls yet</h3>
            <p className="text-gray-500 text-center">
              Your call history will appear here
            </p>
          </div>
        ) : (
          Object.entries(groupedCalls).map(([date, calls]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-gray-100 dark:bg-slate-800/50 sticky top-0">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {formatDateHeader(date)}
                </p>
              </div>
              {calls.map(call => {
                const otherUser = getOtherUser(call);
                const isOutgoing = call.caller_id === profile?.id;
                const isMissed = call.status === 'missed' || call.status === 'no_answer';
                
                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <img
                        src={otherUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username}`}
                        alt=""
                        className="w-14 h-14 rounded-full"
                      />
                      <div className={cn(
                        'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center',
                        call.type === 'video' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-green-100 dark:bg-green-900'
                      )}>
                        {call.type === 'video' ? (
                          <Video className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Phone className="w-3 h-3 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                    </div>

                    {/* Call Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        'font-semibold truncate',
                        isMissed ? 'text-red-500' : 'dark:text-white'
                      )}>
                        {otherUser?.display_name || 'Unknown'}
                      </h3>
                      <div className="flex items-center gap-2 text-sm">
                        {getCallIcon(call)}
                        <span className={cn(
                          isMissed ? 'text-red-500' : 'text-gray-500'
                        )}>
                          {isOutgoing ? 'Outgoing' : 'Incoming'}
                          {call.duration ? ` • ${formatDuration(call.duration)}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Time & Actions */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-gray-500">
                        {formatCallTime(call.created_at)}
                      </span>
                      <div className="flex gap-1">
                        {adminSettings.voice_calls_enabled && otherUser && (
                          <button
                            onClick={() => onStartCall(otherUser, 'voice')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                          >
                            <Phone className="w-5 h-5 text-green-500" />
                          </button>
                        )}
                        {adminSettings.video_calls_enabled && otherUser && (
                          <button
                            onClick={() => onStartCall(otherUser, 'video')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                          >
                            <Video className="w-5 h-5 text-purple-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Stats Footer */}
      {callLogs.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-t dark:border-slate-700">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">
                {callLogs.filter(c => c.status === 'answered').length}
              </p>
              <p className="text-xs text-gray-500">Answered</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">
                {callLogs.filter(c => c.status === 'missed' || c.status === 'no_answer').length}
              </p>
              <p className="text-xs text-gray-500">Missed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">
                {callLogs.filter(c => c.type === 'video').length}
              </p>
              <p className="text-xs text-gray-500">Video</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">
                {Math.round(callLogs.reduce((acc, c) => acc + (c.duration || 0), 0) / 60)}m
              </p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
