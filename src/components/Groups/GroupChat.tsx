// Group Chat Component - Full Featured Group UI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  GroupService, 
  Group, 
  GroupMessage
} from './GroupService';

interface GroupChatProps {
  group: Group;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  onBack: () => void;
  onOpenGroupInfo: () => void;
}

export const GroupChat: React.FC<GroupChatProps> = ({
  group,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onBack,
  onOpenGroupInfo,
}) => {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState<{ message: GroupMessage; x: number; y: number } | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '💯', '🎉', '👏', '🙏'];
  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const msgs = await GroupService.getMessages(group.id);
      setMessages(msgs);
      await GroupService.markAsRead(group.id, currentUserId);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [group.id, currentUserId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const options = replyTo ? {
      replyTo: {
        id: replyTo.id,
        content: replyTo.content,
        senderName: replyTo.senderName,
        type: replyTo.type,
      }
    } : undefined;

    try {
      const message = await GroupService.sendMessage(
        group.id,
        currentUserId,
        currentUserName,
        currentUserAvatar,
        newMessage.trim(),
        'text',
        options
      );
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      setReplyTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await GroupService.reactToMessage(messageId, currentUserId, emoji);
      loadMessages();
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    setShowContextMenu(null);
  };

  const handleDeleteMessage = async (messageId: string, deleteFor: 'everyone' | 'me') => {
    try {
      await GroupService.deleteMessage(messageId, currentUserId, deleteFor);
      loadMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete message');
    }
    setShowContextMenu(null);
  };

  const handleStarMessage = async (messageId: string) => {
    try {
      await GroupService.toggleStarMessage(messageId);
      loadMessages();
    } catch (error) {
      console.error('Error starring message:', error);
    }
    setShowContextMenu(null);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const groupMessagesByDate = (msgs: GroupMessage[]) => {
    const groups: { [key: string]: GroupMessage[] } = {};
    msgs.forEach(msg => {
      const dateKey = new Date(msg.createdAt).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  const currentMember = group.members.find(m => m.oderId === currentUserId);
  const canSendMessages = currentMember?.canSendMessages ?? false;

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button 
          onClick={onOpenGroupInfo}
          className="flex items-center gap-3 flex-1"
        >
          <div className="relative">
            {group.icon ? (
              <img src={group.icon} alt={group.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {group.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {group.memberCount} members
            </p>
          </div>
        </button>

        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                  {formatDate(msgs[0].createdAt)}
                </span>
              </div>

              {/* Messages */}
              {msgs.map((message, index) => (
                <div key={message.id} className="mb-2">
                  {/* System Message */}
                  {message.type === 'system' ? (
                    <div className="flex justify-center">
                      <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-xs text-yellow-700 dark:text-yellow-300">
                        {message.content}
                      </span>
                    </div>
                  ) : (
                    <div className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 max-w-[80%] ${message.senderId === currentUserId ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar (show for first message of consecutive messages from same sender) */}
                        {message.senderId !== currentUserId && (
                          index === 0 || msgs[index - 1].senderId !== message.senderId
                        ) && (
                          <div className="flex-shrink-0">
                            {message.senderAvatar ? (
                              <img 
                                src={message.senderAvatar} 
                                alt={message.senderName}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold">
                                {message.senderName.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            message.senderId === currentUserId
                              ? 'bg-purple-500 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                          } ${message.senderId !== currentUserId && (index > 0 && msgs[index - 1].senderId === message.senderId) ? 'ml-10' : ''}`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setShowContextMenu({ message, x: e.clientX, y: e.clientY });
                          }}
                          onTouchStart={() => {
                            const timer = setTimeout(() => {
                              setShowContextMenu({ message, x: window.innerWidth / 2, y: window.innerHeight / 2 });
                            }, 500);
                            return () => clearTimeout(timer);
                          }}
                        >
                          {/* Sender Name (for group messages) */}
                          {message.senderId !== currentUserId && (
                            index === 0 || msgs[index - 1].senderId !== message.senderId
                          ) && (
                            <p className="text-xs font-semibold text-purple-400 mb-1">
                              {message.senderName}
                            </p>
                          )}

                          {/* Reply Preview */}
                          {message.replyTo && (
                            <div className={`mb-2 p-2 rounded border-l-4 ${
                              message.senderId === currentUserId
                                ? 'bg-purple-600/50 border-white/50'
                                : 'bg-gray-100 dark:bg-gray-700 border-purple-500'
                            }`}>
                              <p className="text-xs font-medium">{message.replyTo.senderName}</p>
                              <p className="text-xs opacity-75 truncate">{message.replyTo.content}</p>
                            </div>
                          )}

                          {/* Poll Message */}
                          {message.type === 'poll' && message.poll && (
                            <div className="space-y-2">
                              <p className="font-medium">📊 {message.poll.question}</p>
                              {message.poll.options.map(option => {
                                const totalVotes = message.poll!.options.reduce((sum, o) => sum + o.votes.length, 0);
                                const percentage = totalVotes > 0 ? (option.votes.length / totalVotes) * 100 : 0;
                                const hasVoted = option.votes.includes(currentUserId);
                                
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => GroupService.votePoll(message.id, option.id, currentUserId).then(loadMessages)}
                                    className={`w-full p-2 rounded-lg text-left transition-all ${
                                      hasVoted
                                        ? 'bg-purple-600/50 border-2 border-purple-500'
                                        : 'bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/50'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">{option.text}</span>
                                      <span className="text-xs">{option.votes.length} votes</span>
                                    </div>
                                    <div className="mt-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-purple-500 transition-all"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Text Content */}
                          {message.type === 'text' && (
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          )}

                          {/* Image Content */}
                          {message.type === 'image' && message.attachments?.[0] && (
                            <img 
                              src={message.attachments[0].url} 
                              alt="Shared image"
                              className="rounded-lg max-w-full max-h-64 object-cover"
                            />
                          )}

                          {/* Message Info */}
                          <div className={`flex items-center gap-1 mt-1 ${
                            message.senderId === currentUserId ? 'justify-end' : ''
                          }`}>
                            <span className="text-[10px] opacity-60">
                              {formatTime(message.createdAt)}
                            </span>
                            {message.isEdited && (
                              <span className="text-[10px] opacity-60">· edited</span>
                            )}
                            {message.senderId === currentUserId && (
                              <span className="text-[10px]">
                                {message.status === 'pending' && '🕐'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && <span className="text-blue-300">✓✓</span>}
                              </span>
                            )}
                            {message.isStarred && <span className="text-yellow-400">⭐</span>}
                          </div>

                          {/* Reactions */}
                          {Object.keys(message.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.entries(message.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.id, emoji)}
                                  className={`px-2 py-0.5 rounded-full text-xs ${
                                    users.includes(currentUserId)
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-700'
                                  }`}
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => setShowContextMenu(null)}
        >
          <div 
            className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{ 
              left: Math.min(showContextMenu.x, window.innerWidth - 200), 
              top: Math.min(showContextMenu.y, window.innerHeight - 300)
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Quick Reactions */}
            <div className="flex p-2 border-b border-gray-200 dark:border-gray-700">
              {reactions.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(showContextMenu.message.id, emoji)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="py-1">
              <button
                onClick={() => {
                  setReplyTo(showContextMenu.message);
                  setShowContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                ↩️ Reply
              </button>
              <button
                onClick={() => handleStarMessage(showContextMenu.message.id)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                {showContextMenu.message.isStarred ? '⭐ Unstar' : '⭐ Star'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showContextMenu.message.content);
                  setShowContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                📋 Copy
              </button>
              {showContextMenu.message.senderId === currentUserId && (
                <>
                  <button
                    onClick={() => handleDeleteMessage(showContextMenu.message.id, 'everyone')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-red-500"
                  >
                    🗑️ Delete for Everyone
                  </button>
                </>
              )}
              <button
                onClick={() => handleDeleteMessage(showContextMenu.message.id, 'me')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-red-500"
              >
                🗑️ Delete for Me
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-l-4 border-purple-500">
            <p className="text-xs font-medium text-purple-500">{replyTo.senderName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-2">
            ✕
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        {canSendMessages ? (
          <div className="flex items-end gap-2">
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              😊
            </button>

            <button 
              onClick={() => setShowPollCreator(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              📊
            </button>

            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-center py-3 text-gray-500">
            You can't send messages in this group
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <div className="flex flex-wrap gap-2">
              {emojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    setNewMessage(prev => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Poll Creator Modal */}
      {showPollCreator && (
        <PollCreator
          onClose={() => setShowPollCreator(false)}
          onCreate={async (question, options, settings) => {
            await GroupService.createPoll(
              group.id,
              currentUserId,
              currentUserName,
              currentUserAvatar,
              question,
              options,
              settings
            );
            loadMessages();
            setShowPollCreator(false);
          }}
        />
      )}
    </div>
  );
};

// Poll Creator Component
interface PollCreatorProps {
  onClose: () => void;
  onCreate: (question: string, options: string[], settings: { multipleAnswers: boolean; anonymous: boolean; endsAt?: string }) => Promise<void>;
}

const PollCreator: React.FC<PollCreatorProps> = ({ onClose, onCreate }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2) {
      alert('Please enter a question and at least 2 options');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate(
        question.trim(),
        options.filter(o => o.trim()),
        { multipleAnswers, anonymous }
      );
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Poll</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Options</label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[index] = e.target.value;
                    setOptions(newOptions);
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions(options.filter((_, i) => i !== index))}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button
                onClick={() => setOptions([...options, ''])}
                className="text-sm text-purple-500 hover:underline"
              >
                + Add Option
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={multipleAnswers}
                onChange={(e) => setMultipleAnswers(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Allow multiple answers</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Anonymous voting</span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCreate}
            disabled={isCreating || !question.trim() || options.filter(o => o.trim()).length < 2}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-medium"
          >
            {isCreating ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChat;
