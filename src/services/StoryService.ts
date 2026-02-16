// StoryService.ts - Complete WhatsApp-style Story/Status System
import { supabase } from '../lib/supabase';

// Types
export interface Story {
  id: string;
  odId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'text' | 'image' | 'video';
  content: string;
  thumbnail?: string;
  backgroundColor?: string;
  textColor?: string;
  fontStyle?: string;
  caption?: string;
  duration: number;
  viewCount: number;
  viewers: StoryViewer[];
  reactions: StoryReaction[];
  createdAt: Date;
  expiresAt: Date;
  isViewed: boolean;
  isMuted: boolean;
  privacy: 'everyone' | 'contacts' | 'close_friends' | 'except';
  exceptUsers?: string[];
  mediaPath?: string;
}

export interface StoryViewer {
  id: string;
  odId: string;
  odIdx: string;
  userId: string;
  userName: string;
  userAvatar: string;
  viewedAt: Date;
  reaction?: string;
}

export interface StoryReaction {
  userId: string;
  userName: string;
  reaction: string;
  createdAt: Date;
}

export interface UserStories {
  odId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  stories: Story[];
  hasUnviewed: boolean;
  lastUpdated: Date;
}

// Background colors for text stories
export const STORY_BACKGROUNDS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
  'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
  'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)',
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#e94560',
  '#533483',
  '#1e5128',
  '#191a19',
  '#2d4059',
];

// Font styles for text stories
export const STORY_FONTS = [
  { name: 'Default', style: 'font-sans' },
  { name: 'Serif', style: 'font-serif' },
  { name: 'Mono', style: 'font-mono' },
  { name: 'Bold', style: 'font-sans font-black' },
  { name: 'Italic', style: 'font-serif italic' },
];

class StoryServiceClass {
  private currentUserId: string | null = null;

  setCurrentUser(userId: string) {
    this.currentUserId = userId;
  }

  async createTextStory(
    text: string,
    backgroundColor: string,
    textColor: string = '#ffffff',
    fontStyle: string = 'font-sans',
    privacy: Story['privacy'] = 'everyone',
    exceptUsers: string[] = []
  ): Promise<Story | null> {
    if (!this.currentUserId) return null;

    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', this.currentUserId)
        .single();

      const storyId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { error } = await supabase.from('stories').insert({
        id: storyId,
        user_id: this.currentUserId,
        type: 'text',
        content: text,
        background_color: backgroundColor,
        text_color: textColor,
        font_style: fontStyle,
        duration: 5,
        privacy,
        except_users: exceptUsers,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      return {
        id: storyId,
        odId: storyId,
        userId: this.currentUserId,
        userName: userData?.display_name || 'User',
        userAvatar: userData?.avatar_url || '',
        type: 'text',
        content: text,
        backgroundColor,
        textColor,
        fontStyle,
        duration: 5,
        viewCount: 0,
        viewers: [],
        reactions: [],
        createdAt: now,
        expiresAt,
        isViewed: true,
        isMuted: false,
        privacy,
        exceptUsers,
      };
    } catch (error) {
      console.error('Error creating text story:', error);
      return null;
    }
  }

  async createMediaStory(
    file: File,
    type: 'image' | 'video',
    caption?: string,
    privacy: Story['privacy'] = 'everyone',
    exceptUsers: string[] = []
  ): Promise<Story | null> {
    if (!this.currentUserId) return null;

    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', this.currentUserId)
        .single();

      let fileToUpload = file;
      if (type === 'image' && file.size > 1024 * 1024) {
        fileToUpload = await this.compressImage(file);
      }

      const thumbnail = type === 'image' 
        ? await this.generateThumbnail(file)
        : undefined;

      const fileName = `stories/${this.currentUserId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const storyId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { error } = await supabase.from('stories').insert({
        id: storyId,
        user_id: this.currentUserId,
        type,
        content: urlData.publicUrl,
        thumbnail,
        caption,
        duration: type === 'video' ? 15 : 5,
        privacy,
        except_users: exceptUsers,
        media_path: fileName,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      return {
        id: storyId,
        odId: storyId,
        userId: this.currentUserId,
        userName: userData?.display_name || 'User',
        userAvatar: userData?.avatar_url || '',
        type,
        content: urlData.publicUrl,
        thumbnail,
        caption,
        duration: type === 'video' ? 15 : 5,
        viewCount: 0,
        viewers: [],
        reactions: [],
        createdAt: now,
        expiresAt,
        isViewed: true,
        isMuted: false,
        privacy,
        exceptUsers,
        mediaPath: fileName,
      };
    } catch (error) {
      console.error('Error creating media story:', error);
      return null;
    }
  }

  async viewStory(storyId: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', this.currentUserId)
        .single();

      const { data: existing } = await supabase
        .from('story_views')
        .select('id')
        .eq('story_id', storyId)
        .eq('viewer_id', this.currentUserId)
        .single();

      if (!existing) {
        await supabase.from('story_views').insert({
          id: crypto.randomUUID(),
          story_id: storyId,
          viewer_id: this.currentUserId,
          viewer_name: userData?.display_name || 'User',
          viewer_avatar: userData?.avatar_url || '',
          viewed_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error viewing story:', error);
    }
  }

  async reactToStory(storyId: string, reaction: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', this.currentUserId)
        .single();

      await supabase
        .from('story_reactions')
        .delete()
        .eq('story_id', storyId)
        .eq('user_id', this.currentUserId);

      await supabase.from('story_reactions').insert({
        id: crypto.randomUUID(),
        story_id: storyId,
        user_id: this.currentUserId,
        user_name: userData?.display_name || 'User',
        reaction,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error reacting to story:', error);
    }
  }

  async replyToStory(storyId: string, storyOwnerId: string, message: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      await supabase.from('pending_messages').insert({
        id: crypto.randomUUID(),
        sender_id: this.currentUserId,
        receiver_id: storyOwnerId,
        content: message,
        type: 'story_reply',
        metadata: JSON.stringify({ storyId }),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error replying to story:', error);
    }
  }

  async getStoriesFeed(): Promise<UserStories[]> {
    if (!this.currentUserId) return [];

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: stories, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id (display_name, avatar_url),
          story_views (id, viewer_id, viewer_name, viewer_avatar, viewed_at),
          story_reactions (user_id, user_name, reaction, created_at)
        `)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userStoriesMap = new Map<string, UserStories>();

      for (const story of stories || []) {
        if (story.privacy === 'except' && story.except_users?.includes(this.currentUserId)) {
          continue;
        }

        const odId = story.user_id;
        if (!userStoriesMap.has(odId)) {
          userStoriesMap.set(odId, {
            odId: odId,
            userId: odId,
            userName: story.profiles?.display_name || 'User',
            userAvatar: story.profiles?.avatar_url || '',
            stories: [],
            hasUnviewed: false,
            lastUpdated: new Date(story.created_at),
          });
        }

        const userStories = userStoriesMap.get(odId)!;
        const isViewed = story.story_views?.some(
          (v: { viewer_id: string }) => v.viewer_id === this.currentUserId
        ) || false;

        userStories.stories.push({
          id: story.id,
          odId: story.id,
          userId: story.user_id,
          userName: story.profiles?.display_name || 'User',
          userAvatar: story.profiles?.avatar_url || '',
          type: story.type,
          content: story.content,
          thumbnail: story.thumbnail,
          backgroundColor: story.background_color,
          textColor: story.text_color,
          fontStyle: story.font_style,
          caption: story.caption,
          duration: story.duration || 5,
          viewCount: story.story_views?.length || 0,
          viewers: (story.story_views || []).map((v: any) => ({
            id: v.id,
            odId: v.id,
            odIdx: v.viewer_id,
            userId: v.viewer_id,
            userName: v.viewer_name,
            userAvatar: v.viewer_avatar,
            viewedAt: new Date(v.viewed_at),
          })),
          reactions: (story.story_reactions || []).map((r: any) => ({
            userId: r.user_id,
            userName: r.user_name,
            reaction: r.reaction,
            createdAt: new Date(r.created_at),
          })),
          createdAt: new Date(story.created_at),
          expiresAt: new Date(story.expires_at),
          isViewed,
          isMuted: false,
          privacy: story.privacy,
          exceptUsers: story.except_users,
          mediaPath: story.media_path,
        });

        if (!isViewed) {
          userStories.hasUnviewed = true;
        }
      }

      const result = Array.from(userStoriesMap.values());
      result.sort((a, b) => {
        if (a.userId === this.currentUserId) return -1;
        if (b.userId === this.currentUserId) return 1;
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return b.lastUpdated.getTime() - a.lastUpdated.getTime();
      });

      return result;
    } catch (error) {
      console.error('Error fetching stories feed:', error);
      return [];
    }
  }

  async getMyStories(): Promise<Story[]> {
    if (!this.currentUserId) return [];

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: stories, error } = await supabase
        .from('stories')
        .select(`
          *,
          story_views (id, viewer_id, viewer_name, viewer_avatar, viewed_at),
          story_reactions (user_id, user_name, reaction, created_at)
        `)
        .eq('user_id', this.currentUserId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (stories || []).map(story => ({
        id: story.id,
        odId: story.id,
        userId: story.user_id,
        userName: 'You',
        userAvatar: '',
        type: story.type,
        content: story.content,
        thumbnail: story.thumbnail,
        backgroundColor: story.background_color,
        textColor: story.text_color,
        fontStyle: story.font_style,
        caption: story.caption,
        duration: story.duration || 5,
        viewCount: story.story_views?.length || 0,
        viewers: (story.story_views || []).map((v: any) => ({
          id: v.id,
          odId: v.id,
          odIdx: v.viewer_id,
          userId: v.viewer_id,
          userName: v.viewer_name,
          userAvatar: v.viewer_avatar,
          viewedAt: new Date(v.viewed_at),
        })),
        reactions: (story.story_reactions || []).map((r: any) => ({
          userId: r.user_id,
          userName: r.user_name,
          reaction: r.reaction,
          createdAt: new Date(r.created_at),
        })),
        createdAt: new Date(story.created_at),
        expiresAt: new Date(story.expires_at),
        isViewed: true,
        isMuted: false,
        privacy: story.privacy,
        exceptUsers: story.except_users,
        mediaPath: story.media_path,
      }));
    } catch (error) {
      console.error('Error fetching my stories:', error);
      return [];
    }
  }

  async getStoryViewers(storyId: string): Promise<StoryViewer[]> {
    try {
      const { data, error } = await supabase
        .from('story_views')
        .select('*')
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(v => ({
        id: v.id,
        odId: v.id,
        odIdx: v.viewer_id,
        userId: v.viewer_id,
        userName: v.viewer_name,
        userAvatar: v.viewer_avatar,
        viewedAt: new Date(v.viewed_at),
        reaction: v.reaction,
      }));
    } catch (error) {
      console.error('Error fetching story viewers:', error);
      return [];
    }
  }

  async deleteStory(storyId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const { data: story } = await supabase
        .from('stories')
        .select('media_path, user_id')
        .eq('id', storyId)
        .single();

      if (!story || story.user_id !== this.currentUserId) return false;

      if (story.media_path) {
        await supabase.storage.from('media').remove([story.media_path]);
      }

      await supabase.from('story_views').delete().eq('story_id', storyId);
      await supabase.from('story_reactions').delete().eq('story_id', storyId);
      await supabase.from('stories').delete().eq('id', storyId);

      return true;
    } catch (error) {
      console.error('Error deleting story:', error);
      return false;
    }
  }

  async muteUserStories(targetUserId: string, muted: boolean): Promise<void> {
    if (!this.currentUserId) return;

    try {
      if (muted) {
        await supabase.from('muted_stories').upsert({
          id: `${this.currentUserId}_${targetUserId}`,
          user_id: this.currentUserId,
          muted_user_id: targetUserId,
          created_at: new Date().toISOString(),
        });
      } else {
        await supabase
          .from('muted_stories')
          .delete()
          .eq('user_id', this.currentUserId)
          .eq('muted_user_id', targetUserId);
      }
    } catch (error) {
      console.error('Error muting stories:', error);
    }
  }

  private async compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const maxSize = 1080;
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }

  private async generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = 20;
        canvas.height = 20;
        ctx?.drawImage(img, 0, 0, 20, 20);
        resolve(canvas.toDataURL('image/jpeg', 0.1));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  async updateProfilePicture(file: File): Promise<string | null> {
    if (!this.currentUserId) return null;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, avatar_path')
        .eq('id', this.currentUserId)
        .single();

      if (profile?.avatar_path) {
        await supabase.storage.from('media').remove([profile.avatar_path]);
      }

      const compressedFile = await this.compressImage(file);
      const fileName = `avatars/${this.currentUserId}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      await supabase
        .from('profiles')
        .update({
          avatar_url: urlData.publicUrl,
          avatar_path: fileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.currentUserId);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error updating profile picture:', error);
      return null;
    }
  }

  async removeProfilePicture(): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_path')
        .eq('id', this.currentUserId)
        .single();

      if (profile?.avatar_path) {
        await supabase.storage.from('media').remove([profile.avatar_path]);
      }

      await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          avatar_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.currentUserId);

      return true;
    } catch (error) {
      console.error('Error removing profile picture:', error);
      return false;
    }
  }
}

export const StoryService = new StoryServiceClass();
export default StoryService;
