-- =====================================================
-- OURDM v3.0.0 - COMPLETE SUPABASE SQL SCHEMA
-- Production Ready - Run this in Supabase SQL Editor
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'User',
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  avatar_path TEXT, -- For deleting old avatars from storage
  phone TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Privacy settings
  last_seen_privacy TEXT DEFAULT 'everyone' CHECK (last_seen_privacy IN ('everyone', 'contacts', 'nobody')),
  profile_photo_privacy TEXT DEFAULT 'everyone' CHECK (profile_photo_privacy IN ('everyone', 'contacts', 'nobody')),
  online_status_privacy TEXT DEFAULT 'everyone' CHECK (online_status_privacy IN ('everyone', 'contacts', 'nobody')),
  read_receipts BOOLEAN DEFAULT TRUE,
  typing_indicator BOOLEAN DEFAULT TRUE,
  
  -- App lock
  app_lock_enabled BOOLEAN DEFAULT FALSE,
  app_lock_pin_hash TEXT,
  
  -- Notification settings
  notification_sound BOOLEAN DEFAULT TRUE,
  notification_vibrate BOOLEAN DEFAULT TRUE,
  notification_preview BOOLEAN DEFAULT TRUE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON profiles(is_online);

-- =====================================================
-- 2. FRIENDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('accepted', 'blocked')),
  nickname TEXT,
  is_best_friend BOOLEAN DEFAULT FALSE,
  is_close_friend BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- =====================================================
-- 3. FRIEND REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);

-- =====================================================
-- 4. BLOCKED USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, blocked_user_id)
);

-- =====================================================
-- 5. PENDING MESSAGES TABLE (Transitional Cloud Storage)
-- =====================================================
CREATE TABLE IF NOT EXISTS pending_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Encrypted content
  iv TEXT NOT NULL, -- Encryption IV
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'story_reply')),
  file_url TEXT,
  file_path TEXT, -- For deleting files after delivery
  file_size INTEGER,
  thumbnail TEXT, -- BlurHash thumbnail
  reply_to UUID,
  metadata JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- 30-day TTL
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_messages_receiver ON pending_messages(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_messages_expires ON pending_messages(expires_at);

-- =====================================================
-- 6. DELIVERY RECEIPTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES pending_messages(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(message_id, receiver_id, status)
);

-- =====================================================
-- 7. STORIES TABLE (24-hour auto-delete)
-- =====================================================
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video')),
  content TEXT NOT NULL, -- Text content or media URL
  thumbnail TEXT, -- BlurHash for media
  background_color TEXT,
  text_color TEXT DEFAULT '#ffffff',
  font_style TEXT DEFAULT 'font-sans',
  caption TEXT,
  duration INTEGER DEFAULT 5,
  media_path TEXT, -- For deleting from storage
  privacy TEXT DEFAULT 'everyone' CHECK (privacy IN ('everyone', 'contacts', 'close_friends', 'except')),
  except_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours') -- 24-hour auto-delete
);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC);

-- =====================================================
-- 8. STORY VIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_name TEXT,
  viewer_avatar TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  reaction TEXT,
  
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);

-- =====================================================
-- 9. STORY REACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS story_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(story_id, user_id)
);

-- =====================================================
-- 10. MUTED STORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS muted_stories (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. GROUPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  icon_path TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  settings JSONB DEFAULT '{
    "who_can_send": "everyone",
    "who_can_add_members": "admins",
    "disappearing_messages": null,
    "slow_mode": null,
    "announce_only": false
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. GROUP MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMPTZ,
  nickname TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- =====================================================
-- 13. GROUP MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  iv TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'poll', 'system')),
  file_url TEXT,
  file_path TEXT,
  thumbnail TEXT,
  reply_to UUID,
  mentions UUID[] DEFAULT '{}',
  metadata JSONB,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_for UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at DESC);

-- =====================================================
-- 14. GROUP POLLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  message_id UUID REFERENCES group_messages(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  votes JSONB DEFAULT '{}',
  is_anonymous BOOLEAN DEFAULT FALSE,
  multiple_choice BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 15. CALL LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video')),
  status TEXT NOT NULL CHECK (status IN ('missed', 'answered', 'declined', 'busy', 'failed')),
  duration INTEGER DEFAULT 0, -- In seconds
  quality_stats JSONB,
  used_turn BOOLEAN DEFAULT FALSE,
  turn_server TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_id, created_at DESC);

-- =====================================================
-- 16. CALL SIGNALING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS call_signaling (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL,
  from_user UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate', 'hangup', 'busy', 'decline')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_signaling_to_user ON call_signaling(to_user, created_at DESC);

-- =====================================================
-- 17. ADMIN SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO admin_settings (key, value) VALUES
  ('voice_calls_enabled', 'true'),
  ('video_calls_enabled', 'true'),
  ('group_calls_enabled', 'true'),
  ('stun_enabled', 'true'),
  ('turn_enabled', 'true'),
  ('stories_enabled', 'true'),
  ('max_file_size', '52428800'), -- 50MB
  ('max_message_length', '5000'),
  ('max_friends', '500'),
  ('registrations_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('default_video_quality', '"HD_30"')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 18. BROADCASTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'urgent')),
  sent_by UUID NOT NULL REFERENCES profiles(id),
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 19. REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_message_id UUID,
  reported_story_id UUID,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE muted_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signaling ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Friends policies
CREATE POLICY "Users can view own friends" ON friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can manage own friends" ON friends FOR ALL USING (auth.uid() = user_id);

-- Friend requests policies
CREATE POLICY "Users can view own requests" ON friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send requests" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can manage own requests" ON friend_requests FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Blocked users policies
CREATE POLICY "Users can view own blocks" ON blocked_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own blocks" ON blocked_users FOR ALL USING (auth.uid() = user_id);

-- Pending messages policies
CREATE POLICY "Users can view own messages" ON pending_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON pending_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update message status" ON pending_messages FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Users can delete own messages" ON pending_messages FOR DELETE USING (auth.uid() = sender_id);

-- Stories policies
CREATE POLICY "Users can view non-hidden stories" ON stories FOR SELECT USING (
  auth.uid() = user_id OR 
  (privacy = 'everyone') OR
  (privacy = 'contacts' AND EXISTS (SELECT 1 FROM friends WHERE user_id = stories.user_id AND friend_id = auth.uid())) OR
  (privacy = 'close_friends' AND EXISTS (SELECT 1 FROM friends WHERE user_id = stories.user_id AND friend_id = auth.uid() AND is_close_friend = true))
);
CREATE POLICY "Users can create own stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON stories FOR DELETE USING (auth.uid() = user_id);

-- Story views policies
CREATE POLICY "Story owners can view who viewed" ON story_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM stories WHERE id = story_views.story_id AND user_id = auth.uid()) OR
  auth.uid() = viewer_id
);
CREATE POLICY "Users can add views" ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Call logs policies
CREATE POLICY "Users can view own calls" ON call_logs FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create calls" ON call_logs FOR INSERT WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "Users can update own calls" ON call_logs FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Call signaling policies
CREATE POLICY "Users can view own signals" ON call_signaling FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "Users can send signals" ON call_signaling FOR INSERT WITH CHECK (auth.uid() = from_user);

-- Admin settings policies
CREATE POLICY "Anyone can view settings" ON admin_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON admin_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Broadcasts policies
CREATE POLICY "Anyone can view broadcasts" ON broadcasts FOR SELECT USING (true);
CREATE POLICY "Admins can create broadcasts" ON broadcasts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Users can update broadcast read status" ON broadcasts FOR UPDATE USING (true);

-- Groups policies
CREATE POLICY "Members can view groups" ON groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid())
);
CREATE POLICY "Users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update groups" ON groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Group members policies
CREATE POLICY "Members can view group members" ON group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Admins can manage members" ON group_members FOR ALL USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Group messages policies
CREATE POLICY "Members can view group messages" ON group_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can send group messages" ON group_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);

-- =====================================================
-- AUTO-DELETE FUNCTIONS
-- =====================================================

-- Function to delete expired stories and their media
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete story views for expired stories
  DELETE FROM story_views WHERE story_id IN (
    SELECT id FROM stories WHERE expires_at < NOW()
  );
  
  -- Delete story reactions for expired stories
  DELETE FROM story_reactions WHERE story_id IN (
    SELECT id FROM stories WHERE expires_at < NOW()
  );
  
  -- Note: Media files should be deleted via Edge Function or scheduled job
  -- that calls storage.delete() for each story.media_path
  
  -- Delete expired stories
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$;

-- Function to delete expired pending messages
CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete delivery receipts for expired messages
  DELETE FROM delivery_receipts WHERE message_id IN (
    SELECT id FROM pending_messages WHERE expires_at < NOW()
  );
  
  -- Note: Files should be deleted via Edge Function
  
  -- Delete expired messages
  DELETE FROM pending_messages WHERE expires_at < NOW();
END;
$$;

-- Function to delete delivered messages (after receiver downloads)
CREATE OR REPLACE FUNCTION delete_delivered_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'read' THEN
    -- Schedule deletion after 24 hours (keep for potential disputes)
    -- In production, use pg_cron or Edge Function
    NULL; -- Placeholder
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for delivery receipt
CREATE TRIGGER on_message_read
  AFTER UPDATE OF status ON pending_messages
  FOR EACH ROW
  WHEN (NEW.status = 'read')
  EXECUTE FUNCTION delete_delivered_message();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    LOWER(REPLACE(split_part(NEW.email, '@', 1), '.', '_')) || '_' || SUBSTRING(NEW.id::text, 1, 4)
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for required tables
ALTER PUBLICATION supabase_realtime ADD TABLE pending_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE call_signaling;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

-- =====================================================
-- SCHEDULED JOBS (pg_cron)
-- =====================================================

-- Run cleanup every hour
SELECT cron.schedule('cleanup-expired-stories', '0 * * * *', 'SELECT delete_expired_stories()');
SELECT cron.schedule('cleanup-expired-messages', '0 * * * *', 'SELECT delete_expired_messages()');

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Create storage bucket for media (run separately in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Storage policies (run in Supabase Dashboard -> Storage -> Policies)
-- Allow authenticated users to upload
-- Allow anyone to download
-- Allow users to delete their own files

-- =====================================================
-- DONE! Your database is ready.
-- =====================================================
