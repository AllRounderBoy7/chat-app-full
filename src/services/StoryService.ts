// StoryService.ts - Complete WhatsApp-style Story/Status System
import { supabase } from '../lib/supabase';

// Types
export interface Story {
  id: string;
  od_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  type: 'text' | 'image' | 'video';
  content: string;
  thumbnail?: string;
  background_color?: string;
  text_color?: string;
  font_style?: string;
  caption?: string;
  duration: number;
  view_count: number;
  viewers: StoryViewer[];
  reactions: StoryReaction[];
  created_at: number;
  expires_at: number;
  is_viewed: boolean;
  is_muted: boolean;
  privacy: 'everyone' | 'contacts' | 'close_friends' | 'except';
  except_users?: string[];
  media_path?: string;
}

export interface StoryViewer {
  id: string;
  od_id: string;
  od_idx: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  viewed_at: number;
  reaction?: string;
}

export interface StoryReaction {
  user_id: string;
  user_name: string;
  reaction: string;
  created_at: number;
}

export interface UserStories {
  od_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  stories: Story[];
  has_unviewed: boolean;
  last_updated: number;
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
        od_id: storyId,
        user_id: this.currentUserId,
        user_name: userData?.display_name || 'User',
        user_avatar: userData?.avatar_url || '',
        type: 'text',
        content: text,
        background_color: backgroundColor,
        text_color: textColor,
        font_style: fontStyle,
        duration: 5,
        view_count: 0,
        viewers: [],
        reactions: [],
        created_at: now.getTime(),
        expires_at: expiresAt.getTime(),
        is_viewed: true,
        is_muted: false,
        privacy,
        except_users: exceptUsers,
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
        od_id: storyId,
        user_id: this.currentUserId,
        user_name: userData?.display_name || 'User',
        user_avatar: userData?.avatar_url || '',
        type,
        content: urlData.publicUrl,
        thumbnail,
        caption,
        duration: type === 'video' ? 15 : 5,
        view_count: 0,
        viewers: [],
        reactions: [],
        created_at: now.getTime(),
        expires_at: expiresAt.getTime(),
        is_viewed: true,
        is_muted: false,
        privacy,
        except_users: exceptUsers,
        media_path: fileName,
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
      // Auto-cleanup: Delete expired stories before fetching
      await this.cleanupExpiredStories();

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

        const od_id = story.user_id;
        if (!userStoriesMap.has(od_id)) {
          userStoriesMap.set(od_id, {
            od_id: od_id,
            user_id: od_id,
            user_name: story.profiles?.display_name || 'User',
            user_avatar: story.profiles?.avatar_url || '',
            stories: [],
            has_unviewed: false,
            last_updated: new Date(story.created_at).getTime(),
          });
        }

        const userStories = userStoriesMap.get(od_id)!;
        const isViewed = story.story_views?.some(
          (v: { viewer_id: string }) => v.viewer_id === this.currentUserId
        ) || false;

        userStories.stories.push({
          id: story.id,
          od_id: story.id,
          user_id: story.user_id,
          user_name: story.profiles?.display_name || 'User',
          user_avatar: story.profiles?.avatar_url || '',
          type: story.type,
          content: story.content,
          thumbnail: story.thumbnail,
          background_color: story.background_color,
          text_color: story.text_color,
          font_style: story.font_style,
          caption: story.caption,
          duration: story.duration || 5,
          view_count: story.story_views?.length || 0,
          viewers: (story.story_views || []).map((v: any) => ({
            id: v.id,
            od_id: v.id,
            od_idx: v.viewer_id,
            user_id: v.viewer_id,
            user_name: v.viewer_name,
            user_avatar: v.viewer_avatar,
            viewed_at: new Date(v.viewed_at).getTime(),
            reaction: story.story_reactions?.find((r: any) => r.user_id === v.viewer_id)?.reaction,
          })),
          reactions: (story.story_reactions || []).map((r: any) => ({
            user_id: r.user_id,
            user_name: r.user_name,
            reaction: r.reaction,
            created_at: new Date(r.created_at).getTime(),
          })),
          created_at: new Date(story.created_at).getTime(),
          expires_at: new Date(story.expires_at).getTime(),
          is_viewed: isViewed,
          is_muted: false,
          privacy: story.privacy,
          except_users: story.except_users,
          media_path: story.media_path,
        });

        if (!isViewed) {
          userStories.has_unviewed = true;
        }
      }

      const result = Array.from(userStoriesMap.values());
      result.sort((a, b) => {
        if (a.user_id === this.currentUserId) return -1;
        if (b.user_id === this.currentUserId) return 1;
        if (a.has_unviewed && !b.has_unviewed) return -1;
        if (!a.has_unviewed && b.has_unviewed) return 1;
        return b.last_updated - a.last_updated;
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
        od_id: story.id,
        user_id: story.user_id,
        user_name: 'You',
        user_avatar: '',
        type: story.type,
        content: story.content,
        thumbnail: story.thumbnail,
        background_color: story.background_color,
        text_color: story.text_color,
        font_style: story.font_style,
        caption: story.caption,
        duration: story.duration || 5,
        view_count: story.story_views?.length || 0,
        viewers: (story.story_views || []).map((v: any) => ({
          id: v.id,
          od_id: v.id,
          od_idx: v.viewer_id,
          user_id: v.viewer_id,
          user_name: v.viewer_name,
          user_avatar: v.viewer_avatar,
          viewed_at: new Date(v.viewed_at).getTime(),
          reaction: story.story_reactions?.find((r: any) => r.user_id === v.viewer_id)?.reaction,
        })),
        reactions: (story.story_reactions || []).map((r: any) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          reaction: r.reaction,
          created_at: new Date(r.created_at).getTime(),
        })),
        created_at: new Date(story.created_at).getTime(),
        expires_at: new Date(story.expires_at).getTime(),
        is_viewed: true,
        is_muted: false,
        privacy: story.privacy,
        except_users: story.except_users,
        media_path: story.media_path,
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
        od_id: v.id,
        od_idx: v.viewer_id,
        user_id: v.viewer_id,
        user_name: v.viewer_name,
        user_avatar: v.viewer_avatar,
        viewed_at: new Date(v.viewed_at).getTime(),
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

  private async cleanupExpiredStories(): Promise<void> {
    try {
      const now = new Date().toISOString();

      // Get expired stories with media paths
      const { data: expired } = await supabase
        .from('stories')
        .select('id, media_path')
        .lt('expires_at', now);

      if (expired && expired.length > 0) {
        const ids = expired.map(s => s.id);
        const paths = expired.map(s => s.media_path).filter(Boolean) as string[];

        // Remove from storage
        if (paths.length > 0) {
          await supabase.storage.from('media').remove(paths);
        }

        // Remove from DB (Cascade should handle views/reactions, but we do it manually for safety)
        await supabase.from('story_views').delete().in('story_id', ids);
        await supabase.from('story_reactions').delete().in('story_id', ids);
        await supabase.from('stories').delete().in('id', ids);

        console.log(`🧹 Cleaned up ${ids.length} expired stories`);
      }
    } catch (error) {
      console.error('Auto-cleanup error:', error);
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
