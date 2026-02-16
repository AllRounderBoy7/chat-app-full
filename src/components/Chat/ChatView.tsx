import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip, Smile, 
  Check, CheckCheck, Reply, X, Image, Mic, Camera
} from 'lucide-react';
import { useAppStore, type Chat, type Message } from '@/store/appStore';
import { encryptMessage, decryptMessage, getLocalEncryptionKey } from '@/lib/encryption';
import { processAndStoreMedia, saveToDevice } from '@/lib/mediaStorage';
import { cn } from '@/utils/cn';

interface ChatViewProps {
  chat: Chat;
  onBack: () => void;
  onCall: (type: 'voice' | 'video') => void;
  onOpenMenu: () => void;
}

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '❤️', '🔥', '🎉', '👏', '🙏', '💪', '✨', '😊', '🙂', '😉', '😋', '😜', '🤗', '🤩', '😇', '🥳', '😴', '🤯', '😤', '🥺', '😈', '💀', '👀'];

export function ChatView({ chat, onBack, onCall, onOpenMenu }: ChatViewProps) {
  const { 
    messages, 
    addMessage, 
    updateMessage,
    profile, 
    typingUsers, 
    adminSettings,
    lockedChats
  } = useAppStore();
  
  const [messageInput, setMessageInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle mobile keyboard - WhatsApp style
  useEffect(() => {
    // Visual Viewport API for better keyboard handling
    if ('visualViewport' in window && window.visualViewport) {
      const viewport = window.visualViewport;
      
      const handleResize = () => {
        const windowHeight = window.innerHeight;
        const viewportHeight = viewport.height;
        const keyboardH = windowHeight - viewportHeight;
        
        if (keyboardH > 100) {
          setKeyboardHeight(keyboardH);
          // Scroll to bottom when keyboard opens
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          setKeyboardHeight(0);
        }
      };
      
      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
      
      return () => {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      };
    }
    
    // Fallback for older browsers
    const handleFocus = () => {
      setIsInputFocused(true);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    };
    
    const handleBlur = () => {
      setIsInputFocused(false);
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
      
      return () => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      };
    }
  }, []);
  
  const chatMessages = messages[chat.id] || [];
  const isLocked = lockedChats.includes(chat.id);
  const isTyping = typingUsers[chat.id];

  // Initialize encryption key
  useEffect(() => {
    getLocalEncryptionKey().then(setEncryptionKey);
  }, []);

  // Decrypt messages
  useEffect(() => {
    const decryptAll = async () => {
      if (!encryptionKey) return;
      
      const decrypted: Record<string, string> = {};
      for (const msg of chatMessages) {
        if (msg.is_deleted) {
          decrypted[msg.id] = '[Message deleted]';
        } else if (msg.content && msg.iv) {
          try {
            decrypted[msg.id] = await decryptMessage(msg.content, msg.iv, encryptionKey);
          } catch {
            decrypted[msg.id] = msg.content;
          }
        }
      }
      setDecryptedMessages(decrypted);
    };
    
    decryptAll();
  }, [chatMessages, encryptionKey]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleSend = async () => {
    if (!messageInput.trim() || !encryptionKey || !profile) return;

    const encrypted = await encryptMessage(messageInput.trim(), encryptionKey);
    
    const newMessage: Message = {
      id: crypto.randomUUID(),
      chatId: chat.id,
      sender_id: profile.id,
      receiver_id: chat.user.id,
      content: encrypted.ciphertext,
      iv: encrypted.iv,
      type: 'text',
      status: 'pending',
      reply_to: replyTo?.id,
      created_at: new Date().toISOString()
    };

    addMessage(chat.id, newMessage);
    setMessageInput('');
    setReplyTo(null);
    setShowEmojiPicker(false);

    // Simulate message being sent
    setTimeout(() => {
      updateMessage(chat.id, newMessage.id, { status: 'sent' });
    }, 500);
    
    setTimeout(() => {
      updateMessage(chat.id, newMessage.id, { status: 'delivered' });
    }, 1500);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile || !encryptionKey) return;

    // Validate file size
    const maxSize = adminSettings.max_file_size_mb * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large. Max size: ${adminSettings.max_file_size_mb}MB`);
      return;
    }

    // Process and store media
    const mediaFile = await processAndStoreMedia(file);
    
    const fileType = file.type.startsWith('image/') ? 'image' 
      : file.type.startsWith('video/') ? 'video' 
      : file.type.startsWith('audio/') ? 'audio' 
      : 'document';

    const newMessage: Message = {
      id: crypto.randomUUID(),
      chatId: chat.id,
      sender_id: profile.id,
      receiver_id: chat.user.id,
      content: '',
      iv: '',
      type: fileType,
      file_url: mediaFile.localPath || URL.createObjectURL(file),
      thumbnail: mediaFile.thumbnail,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    addMessage(chat.id, newMessage);
    setShowAttachMenu(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    updateMessage(chat.id, messageId, {
      reactions: {
        ...(chatMessages.find(m => m.id === messageId)?.reactions || {}),
        [profile?.id || '']: emoji
      }
    });
    setSelectedMessage(null);
  };

  const handleDownload = async (message: Message) => {
    if (message.file_url) {
      const response = await fetch(message.file_url);
      const blob = await response.blob();
      await saveToDevice(blob, `ourdm_${message.type}_${Date.now()}.${message.type === 'image' ? 'jpg' : message.type === 'video' ? 'mp4' : 'file'}`);
    }
  };

  const formatTime = (dateStr: string) => format(new Date(dateStr), 'HH:mm');

  const renderMessageStatus = (status: Message['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-3 h-3 border border-current rounded-full animate-pulse" />;
      case 'sent':
        return <Check className="w-4 h-4" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-400" />;
    }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    
    msgs.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    
    return groups;
  };

  return (
    <div 
      className="flex flex-col h-full bg-gray-100 dark:bg-slate-900"
      style={{ 
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
        transition: 'padding-bottom 0.2s ease-out'
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-3 safe-area-top flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="relative">
          <img
            src={chat.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.user.username}`}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
          {chat.user.is_online && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-indigo-600" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{chat.user.display_name}</h3>
          <p className="text-sm text-white/70">
            {isTyping ? 'typing...' : chat.user.is_online ? 'Online' : 'Offline'}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          {adminSettings.voice_calls_enabled && (
            <button onClick={() => onCall('voice')} className="p-2 hover:bg-white/10 rounded-full">
              <Phone className="w-5 h-5" />
            </button>
          )}
          {adminSettings.video_calls_enabled && (
            <button onClick={() => onCall('video')} className="p-2 hover:bg-white/10 rounded-full">
              <Video className="w-5 h-5" />
            </button>
          )}
          <button onClick={onOpenMenu} className="p-2 hover:bg-white/10 rounded-full">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {groupMessagesByDate(chatMessages).map(({ date, messages: dayMessages }) => (
          <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 bg-white/80 dark:bg-slate-800 rounded-full text-xs text-gray-500 dark:text-gray-400 shadow-sm">
                {format(new Date(date), 'MMMM d, yyyy')}
              </span>
            </div>
            
            {/* Messages for this date */}
            <div className="space-y-2">
              {dayMessages.map((msg, index) => {
                const isOwn = msg.sender_id === profile?.id;
                const showAvatar = !isOwn && (index === 0 || dayMessages[index - 1]?.sender_id === profile?.id);
                
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-end gap-2',
                      isOwn ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {!isOwn && showAvatar && (
                      <img
                        src={chat.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.user.username}`}
                        alt=""
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                    )}
                    {!isOwn && !showAvatar && <div className="w-8" />}
                    
                    <div
                      onClick={() => setSelectedMessage(msg)}
                      className={cn(
                        'max-w-[75%] rounded-2xl p-3 cursor-pointer transition-transform active:scale-95',
                        isOwn 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-slate-800 shadow-sm dark:text-white rounded-bl-md'
                      )}
                    >
                      {/* Reply Preview */}
                      {msg.reply_to && (
                        <div className={cn(
                          'text-xs mb-2 p-2 rounded-lg',
                          isOwn ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700'
                        )}>
                          <p className="opacity-70">Reply to message</p>
                        </div>
                      )}
                      
                      {/* Content */}
                      {msg.type === 'text' ? (
                        <p className="break-words whitespace-pre-wrap">
                          {decryptedMessages[msg.id] || 'Decrypting...'}
                        </p>
                      ) : msg.type === 'image' ? (
                        <div className="relative">
                          {msg.thumbnail && (
                            <div 
                              className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
                              style={{ backgroundImage: `url(${msg.thumbnail})` }}
                            />
                          )}
                          <img 
                            src={msg.file_url} 
                            alt="" 
                            className="rounded-lg max-w-full relative z-10"
                            loading="lazy"
                          />
                        </div>
                      ) : msg.type === 'video' ? (
                        <video 
                          src={msg.file_url} 
                          controls 
                          className="rounded-lg max-w-full"
                          poster={msg.thumbnail}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                            📎
                          </div>
                          <span>File</span>
                        </div>
                      )}
                      
                      {/* Time & Status */}
                      <div className={cn(
                        'flex items-center justify-end gap-1 mt-1',
                        isOwn ? 'text-white/70' : 'text-gray-400'
                      )}>
                        <span className="text-xs">{formatTime(msg.created_at)}</span>
                        {isOwn && renderMessageStatus(msg.status)}
                      </div>
                      
                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 -mb-1">
                          {Object.values(msg.reactions).map((emoji, i) => (
                            <span key={i} className="text-sm bg-white/20 rounded-full px-1">
                              {emoji}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2">
            <img
              src={chat.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.user.username}`}
              alt=""
              className="w-8 h-8 rounded-full"
            />
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 border-t dark:border-slate-700 flex items-center gap-2">
          <Reply className="w-4 h-4 text-gray-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-indigo-500 font-medium">
              Reply to {replyTo.sender_id === profile?.id ? 'yourself' : chat.user.display_name}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {decryptedMessages[replyTo.id] || '[Media]'}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className={cn(
        "p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex-shrink-0 transition-all duration-200",
        keyboardHeight > 0 ? "fixed bottom-0 left-0 right-0 z-40" : "safe-area-bottom",
        isInputFocused && keyboardHeight === 0 && "pb-6" // Fallback padding when keyboard is open
      )}>
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <div className="relative">
            <button 
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <Paperclip className="w-6 h-6" />
            </button>
            
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-700 rounded-xl shadow-lg py-2 min-w-[160px]">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', 'image/*');
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-600"
                >
                  <Image className="w-5 h-5 text-indigo-500" />
                  <span className="dark:text-white">Photo</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', 'video/*');
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-600"
                >
                  <Camera className="w-5 h-5 text-purple-500" />
                  <span className="dark:text-white">Video</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', '*/*');
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-600"
                >
                  <Paperclip className="w-5 h-5 text-gray-500" />
                  <span className="dark:text-white">Document</span>
                </button>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          
          {/* Emoji Button */}
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <Smile className="w-6 h-6" />
          </button>
          
          {/* Input Field */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder={isLocked ? '🔒 Chat is locked' : 'Type a message...'}
              disabled={isLocked}
              maxLength={adminSettings.max_message_length}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-slate-700 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-base"
              style={{ fontSize: '16px' }} // Prevents iOS zoom
            />
          </div>
          
          {/* Send/Voice Button */}
          {messageInput.trim() ? (
            <button 
              onClick={handleSend}
              className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:shadow-lg transition-shadow"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onTouchStart={() => setIsRecording(true)}
              onTouchEnd={() => setIsRecording(false)}
              className={cn(
                'p-3 rounded-full transition-all',
                isRecording 
                  ? 'bg-red-500 text-white scale-110' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
              )}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setMessageInput(prev => prev + emoji);
                  }}
                  className="text-2xl p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Message Actions Modal */}
      {selectedMessage && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setSelectedMessage(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Reactions */}
            <div className="flex justify-center gap-4 mb-6">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(selectedMessage.id, emoji)}
                  className="text-3xl p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
            
            {/* Actions */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setReplyTo(selectedMessage);
                  setSelectedMessage(null);
                }}
                className="w-full p-4 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
              >
                <Reply className="w-5 h-5" />
                <span className="dark:text-white">Reply</span>
              </button>
              
              {selectedMessage.type !== 'text' && (
                <button
                  onClick={() => {
                    handleDownload(selectedMessage);
                    setSelectedMessage(null);
                  }}
                  className="w-full p-4 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <Paperclip className="w-5 h-5" />
                  <span className="dark:text-white">Save to Device</span>
                </button>
              )}
              
              {selectedMessage.sender_id === profile?.id && (
                <button
                  onClick={() => {
                    updateMessage(chat.id, selectedMessage.id, { is_deleted: true });
                    setSelectedMessage(null);
                  }}
                  className="w-full p-4 text-left rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-500"
                >
                  <X className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
            
            <button
              onClick={() => setSelectedMessage(null)}
              className="w-full mt-4 p-4 border dark:border-slate-600 rounded-xl font-medium dark:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
