// StoriesView.tsx - Complete WhatsApp-style Stories UI
import { useState, useRef, useEffect } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, Eye, Send,
  Trash2, MoreVertical, Type, Palette,
  Camera, Volume2, VolumeX, Pause, Play, Download
} from 'lucide-react';
import { StoryService, Story, UserStories, STORY_BACKGROUNDS, STORY_FONTS } from '../../services/StoryService';
import { saveToDevice } from '@/lib/mediaStorage';

interface StoriesViewProps {
  currentUserId: string;
  userAvatar: string;
  userName: string;
}

export function StoriesView({ currentUserId, userAvatar, userName }: StoriesViewProps) {
  const [storiesFeed, setStoriesFeed] = useState<UserStories[]>([]);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [selectedUserStories, setSelectedUserStories] = useState<UserStories | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    StoryService.setCurrentUser(currentUserId);
    loadStories();
  }, [currentUserId]);

  const loadStories = async () => {
    setLoading(true);
    const [feed, mine] = await Promise.all([
      StoryService.getStoriesFeed(),
      StoryService.getMyStories(),
    ]);
    setStoriesFeed(feed);
    setMyStories(mine);
    setLoading(false);
  };

  const startProgress = (duration: number) => {
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      if (isPaused) return;

      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / (duration * 1000)) * 100;

      if (newProgress >= 100) {
        clearInterval(progressIntervalRef.current!);
        goToNextStory();
      } else {
        setProgress(newProgress);
      }
    }, 50);
  };

  const openStoryViewer = async (userStories: UserStories, startIndex: number = 0) => {
    setSelectedUserStories(userStories);
    setCurrentStoryIndex(startIndex);
    setProgress(0);
    setShowViewers(false);
    setReplyText('');

    const story = userStories.stories[startIndex];
    if (story && !story.is_viewed) {
      await StoryService.viewStory(story.id);
    }
    startProgress(story?.duration || 5);
  };

  const closeStoryViewer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setSelectedUserStories(null);
    setCurrentStoryIndex(0);
    setProgress(0);
    loadStories();
  };

  const goToNextStory = () => {
    if (!selectedUserStories) return;

    if (currentStoryIndex < selectedUserStories.stories.length - 1) {
      const nextIndex = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIndex);
      setProgress(0);
      const story = selectedUserStories.stories[nextIndex];
      if (!story.is_viewed) {
        StoryService.viewStory(story.id);
      }
      startProgress(story.duration);
    } else {
      const currentUserIndex = storiesFeed.findIndex(u => u.user_id === selectedUserStories.user_id);
      if (currentUserIndex < storiesFeed.length - 1) {
        openStoryViewer(storiesFeed[currentUserIndex + 1], 0);
      } else {
        closeStoryViewer();
      }
    }
  };

  const goToPreviousStory = () => {
    if (!selectedUserStories) return;

    if (currentStoryIndex > 0) {
      const prevIndex = currentStoryIndex - 1;
      setCurrentStoryIndex(prevIndex);
      setProgress(0);
      startProgress(selectedUserStories.stories[prevIndex].duration);
    } else {
      const currentUserIndex = storiesFeed.findIndex(u => u.user_id === selectedUserStories.user_id);
      if (currentUserIndex > 0) {
        const prevUser = storiesFeed[currentUserIndex - 1];
        openStoryViewer(prevUser, prevUser.stories.length - 1);
      }
    }
  };

  const handleReact = async (reaction: string) => {
    if (!selectedUserStories) return;
    const story = selectedUserStories.stories[currentStoryIndex];
    await StoryService.reactToStory(story.id, reaction);
  };

  const handleReply = async () => {
    if (!selectedUserStories || !replyText.trim()) return;
    const story = selectedUserStories.stories[currentStoryIndex];
    await StoryService.replyToStory(story.id, selectedUserStories.user_id, replyText);
    setReplyText('');
  };

  const handleDeleteStory = async (storyId: string) => {
    await StoryService.deleteStory(storyId);
    loadStories();
    if (selectedUserStories) {
      const remainingStories = selectedUserStories.stories.filter(s => s.id !== storyId);
      if (remainingStories.length === 0) {
        closeStoryViewer();
      } else {
        setSelectedUserStories({ ...selectedUserStories, stories: remainingStories });
        if (currentStoryIndex >= remainingStories.length) {
          setCurrentStoryIndex(remainingStories.length - 1);
        }
      }
    }
  };

  const formatTimeAgo = (date: number | Date) => {
    const time = date instanceof Date ? date.getTime() : date;
    const seconds = Math.floor((Date.now() - time) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const currentStory = selectedUserStories?.stories[currentStoryIndex];

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900">
      {!selectedUserStories && (
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Status</h2>

          <div className="mb-6">
            <div
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl cursor-pointer"
              onClick={() => myStories.length > 0 ? openStoryViewer({
                od_id: currentUserId,
                user_id: currentUserId,
                user_name: 'My Status',
                user_avatar: userAvatar,
                stories: myStories,
                has_unviewed: false,
                last_updated: Date.now(),
              }) : setShowCreateStory(true)}
            >
              <div className="relative">
                <div className={`w-14 h-14 rounded-full overflow-hidden ${myStories.length > 0 ? 'ring-2 ring-green-500 ring-offset-2' : ''
                  }`}>
                  {userAvatar ? (
                    <img src={userAvatar} alt="My Status" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                      {userName.charAt(0)}
                    </div>
                  )}
                </div>
                <button
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateStory(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">My Status</p>
                <p className="text-sm text-gray-500">
                  {myStories.length > 0
                    ? `${myStories.length} updates • Tap to view`
                    : 'Tap to add status update'}
                </p>
              </div>
            </div>
          </div>

          {storiesFeed.filter(u => u.user_id !== currentUserId && u.has_unviewed).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">Recent updates</p>
              {storiesFeed
                .filter(u => u.user_id !== currentUserId && u.has_unviewed)
                .map(userStories => (
                  <div
                    key={userStories.user_id}
                    className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
                    onClick={() => openStoryViewer(userStories)}
                  >
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full ring-2 ring-green-500 ring-offset-2 overflow-hidden">
                        {userStories.user_avatar ? (
                          <img src={userStories.user_avatar} alt={userStories.user_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                            {userStories.user_name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{userStories.user_name}</p>
                      <p className="text-sm text-gray-500">
                        {userStories.stories.length} update{userStories.stories.length > 1 ? 's' : ''} • {formatTimeAgo(userStories.last_updated)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {storiesFeed.filter(u => u.user_id !== currentUserId && !u.has_unviewed).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">Viewed updates</p>
              {storiesFeed
                .filter(u => u.user_id !== currentUserId && !u.has_unviewed)
                .map(userStories => (
                  <div
                    key={userStories.user_id}
                    className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
                    onClick={() => openStoryViewer(userStories)}
                  >
                    <div className="w-14 h-14 rounded-full ring-2 ring-gray-300 ring-offset-2 overflow-hidden">
                      {userStories.user_avatar ? (
                        <img src={userStories.user_avatar} alt={userStories.user_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xl font-bold">
                          {userStories.user_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{userStories.user_name}</p>
                      <p className="text-sm text-gray-500">{formatTimeAgo(userStories.last_updated)}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {selectedUserStories && currentStory && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
            {selectedUserStories.stories.map((story, index) => (
              <div key={story.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{
                    width: index < currentStoryIndex ? '100%' :
                      index === currentStoryIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-3">
              <button onClick={closeStoryViewer} className="text-white">
                <X className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 rounded-full overflow-hidden">
                {selectedUserStories.user_avatar ? (
                  <img src={selectedUserStories.user_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {selectedUserStories.user_name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-semibold">{selectedUserStories.user_name}</p>
                <p className="text-white/70 text-xs">{formatTimeAgo(currentStory.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {currentStory.type === 'video' && (
                <button onClick={() => setIsMuted(!isMuted)} className="text-white">
                  {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
              )}
              <button onClick={() => setIsPaused(!isPaused)} className="text-white">
                {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              </button>
              <button
                onClick={async () => {
                  try {
                    if (currentStory.type === 'text') {
                      const blob = new Blob([currentStory.content], { type: 'text/plain' });
                      await saveToDevice(blob, `story_${currentStory.id.substring(0, 8)}.txt`);
                    } else {
                      const response = await fetch(currentStory.content);
                      const blob = await response.blob();
                      await saveToDevice(blob, `story_${currentStory.id.substring(0, 8)}.${currentStory.type === 'video' ? 'mp4' : 'jpg'}`);
                    }
                  } catch (error) {
                    console.error('Save failed:', error);
                  }
                }}
                className="text-white"
              >
                <Download className="w-6 h-6" />
              </button>
              {currentStory.user_id === currentUserId && (
                <button
                  onClick={() => handleDeleteStory(currentStory.id)}
                  className="text-white"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              )}
              <button className="text-white">
                <MoreVertical className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width / 3) {
                goToPreviousStory();
              } else if (x > rect.width * 2 / 3) {
                goToNextStory();
              } else {
                setIsPaused(!isPaused);
              }
            }}
          >
            <button
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); goToPreviousStory(); }}
            >
              <ChevronLeft className="w-8 h-8 text-white/50 absolute left-4 top-1/2 -translate-y-1/2" />
            </button>
            <button
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); goToNextStory(); }}
            >
              <ChevronRight className="w-8 h-8 text-white/50 absolute right-4 top-1/2 -translate-y-1/2" />
            </button>

            {currentStory.type === 'text' && (
              <div
                className="w-full h-full flex items-center justify-center p-8"
                style={{ background: currentStory.background_color }}
              >
                <p
                  className={`text-white text-2xl text-center ${currentStory.font_style}`}
                  style={{ color: currentStory.text_color }}
                >
                  {currentStory.content}
                </p>
              </div>
            )}

            {currentStory.type === 'image' && (
              <img
                src={currentStory.content}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}

            {currentStory.type === 'video' && (
              <video
                ref={videoRef}
                src={currentStory.content}
                className="max-w-full max-h-full object-contain"
                autoPlay
                muted={isMuted}
                playsInline
              />
            )}

            {currentStory.caption && (
              <div className="absolute bottom-24 left-0 right-0 text-center px-8">
                <p className="text-white text-lg bg-black/50 px-4 py-2 rounded-lg inline-block">
                  {currentStory.caption}
                </p>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            {currentStory.user_id === currentUserId && (
              <button
                onClick={() => setShowViewers(true)}
                className="flex items-center gap-2 text-white mb-4"
              >
                <Eye className="w-5 h-5" />
                <span>{currentStory.view_count} views</span>
              </button>
            )}

            {currentStory.user_id !== currentUserId && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply..."
                  className="flex-1 bg-white/20 text-white placeholder-white/50 px-4 py-3 rounded-full outline-none"
                />
                <button onClick={handleReply} className="text-white p-2">
                  <Send className="w-6 h-6" />
                </button>
                <div className="flex gap-1">
                  {['❤️', '😂', '😮', '😢', '👏', '🔥'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showViewers && currentStory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Views</h3>
                <button
                  onClick={() => setShowViewers(false)}
                  className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {currentStory.view_count} people have viewed this update
              </div>
            </div>
            <div className="p-2 space-y-1">
              {currentStory.viewers.length > 0 ? currentStory.viewers.map(viewer => (
                <div
                  key={viewer.id}
                  className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-green-500/20">
                    {viewer.user_avatar ? (
                      <img src={viewer.user_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {viewer.user_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{viewer.user_name}</p>
                    <p className="text-xs text-gray-500">{formatTimeAgo(viewer.viewed_at)}</p>
                  </div>
                  {viewer.reaction && (
                    <div className="w-10 h-10 bg-white dark:bg-gray-700 shadow-sm rounded-full flex items-center justify-center text-xl">
                      {viewer.reaction}
                    </div>
                  )}
                </div>
              )) : (
                <div className="py-12 text-center">
                  <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No views yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateStory && (
        <CreateStoryModal
          onClose={() => setShowCreateStory(false)}
          onCreated={() => {
            setShowCreateStory(false);
            loadStories();
          }}
        />
      )}
    </div>
  );
}

function CreateStoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(STORY_BACKGROUNDS[0]);
  const [textColor] = useState('#ffffff');
  const [fontStyle, setFontStyle] = useState(STORY_FONTS[0].style);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<Story['privacy']>('everyone');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setMode('media');
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      if (mode === 'text' && text.trim()) {
        await StoryService.createTextStory(text, backgroundColor, textColor, fontStyle, privacy);
      } else if (mode === 'media' && selectedFile) {
        const type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
        await StoryService.createMediaStory(selectedFile, type, caption, privacy);
      }
      onCreated();
    } catch (error) {
      console.error('Error creating story:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <button onClick={onClose} className="text-white">
          <X className="w-6 h-6" />
        </button>
        <div className="flex gap-2">
          <div className="relative group">
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as any)}
              className="bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-full outline-none appearance-none cursor-pointer"
            >
              <option value="everyone" className="text-black">Everyone</option>
              <option value="contacts" className="text-black">Contacts Only</option>
            </select>
          </div>

          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-full ${mode === 'text' ? 'bg-white text-black' : 'bg-white/20 text-white'}`}
          >
            <Type className="w-5 h-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`px-4 py-2 rounded-full ${mode === 'media' ? 'bg-white text-black' : 'bg-white/20 text-white'}`}
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading || (mode === 'text' && !text.trim()) || (mode === 'media' && !selectedFile)}
          className="bg-green-500 text-white px-6 py-2 rounded-full font-semibold disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex-1 flex flex-col">
        {mode === 'text' && (
          <>
            <div
              className="flex-1 flex items-center justify-center p-8"
              style={{ background: backgroundColor }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a status..."
                className={`w-full text-center text-2xl bg-transparent outline-none resize-none ${fontStyle}`}
                style={{ color: textColor }}
                rows={5}
              />
            </div>

            <div className="p-4 bg-black">
              <div className="flex items-center gap-3 mb-3">
                <Palette className="w-5 h-5 text-white" />
                <span className="text-white text-sm">Background</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {STORY_BACKGROUNDS.map((bg, index) => (
                  <button
                    key={index}
                    onClick={() => setBackgroundColor(bg)}
                    className={`w-10 h-10 rounded-full flex-shrink-0 ${backgroundColor === bg ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                      }`}
                    style={{ background: bg }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 mt-4 mb-3">
                <Type className="w-5 h-5 text-white" />
                <span className="text-white text-sm">Font</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {STORY_FONTS.map((font, index) => (
                  <button
                    key={index}
                    onClick={() => setFontStyle(font.style)}
                    className={`px-4 py-2 rounded-full flex-shrink-0 ${font.style} ${fontStyle === font.style ? 'bg-white text-black' : 'bg-white/20 text-white'
                      }`}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === 'media' && selectedFile && (
          <>
            <div className="flex-1 flex items-center justify-center bg-black">
              {selectedFile.type.startsWith('video/') ? (
                <video src={filePreview} className="max-w-full max-h-full" controls />
              ) : (
                <img src={filePreview} alt="" className="max-w-full max-h-full object-contain" />
              )}
            </div>
            <div className="p-4 bg-black">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="w-full bg-white/20 text-white placeholder-white/50 px-4 py-3 rounded-full outline-none"
              />
            </div>
          </>
        )}

        {mode === 'media' && !selectedFile && (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-4 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <p className="text-white text-lg">Tap to select photo or video</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StoriesView;
