// ============================================
// OURDM v3.0.0 - Supabase Service
// Backend Integration
// ============================================

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

// Create Supabase client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ============================================
// AUTHENTICATION
// ============================================

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        username: displayName.toLowerCase().replace(/\s+/g, '_'),
      },
    },
  });
  
  if (error) throw error;
  // Do not insert into `profiles` here.
  // On many Supabase setups (email confirmation / no session yet + RLS), this insert can fail and surface as a "Database error".
  // Profile creation is handled after login in App.tsx (ensure-profile logic).
  
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ============================================
// USER PROFILES
// ============================================

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) throw new Error(`Profile not found for user ${userId}`);
  return data;
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function searchUsers(query: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, is_online')
    .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(limit);
  
  if (error) throw error;
  return data;
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

let messagesChannel: RealtimeChannel | null = null;
let presenceChannel: RealtimeChannel | null = null;

export function subscribeToMessages(
  userId: string,
  onMessage: (message: unknown) => void,
  onDeliveryReceipt: (receipt: unknown) => void
) {
  // Unsubscribe from existing channel
  if (messagesChannel) {
    messagesChannel.unsubscribe();
  }
  
  messagesChannel = supabase
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_messages',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => onMessage(payload.new)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'delivery_receipts',
        filter: `sender_id=eq.${userId}`,
      },
      (payload) => onDeliveryReceipt(payload.new)
    )
    .subscribe();
  
  return () => {
    messagesChannel?.unsubscribe();
    messagesChannel = null;
  };
}

export function subscribeToPresence(
  userId: string,
  onPresenceChange: (users: Record<string, unknown>[]) => void
) {
  if (presenceChannel) {
    presenceChannel.unsubscribe();
  }
  
  presenceChannel = supabase
    .channel('online-users')
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel?.presenceState() || {};
      const users = Object.values(state).flat() as Record<string, unknown>[];
      onPresenceChange(users);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel?.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });
  
  return () => {
    presenceChannel?.unsubscribe();
    presenceChannel = null;
  };
}

export function subscribeToTyping(
  chatId: string,
  onTyping: (data: { userId: string; isTyping: boolean }) => void
) {
  const channel = supabase
    .channel(`typing:${chatId}`)
    .on('broadcast', { event: 'typing' }, (payload) => {
      onTyping(payload.payload as { userId: string; isTyping: boolean });
    })
    .subscribe();
  
  return () => channel.unsubscribe();
}

export function sendTypingIndicator(chatId: string, userId: string, isTyping: boolean) {
  supabase.channel(`typing:${chatId}`).send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId, isTyping },
  });
}

// ============================================
// FILE STORAGE
// ============================================

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  _onProgress?: (progress: number) => void
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw error;
}

// ============================================
// WEBRTC SIGNALING
// ============================================

export function subscribeToCallSignaling(
  callId: string,
  onOffer: (data: RTCSessionDescriptionInit) => void,
  onAnswer: (data: RTCSessionDescriptionInit) => void,
  onIceCandidate: (candidate: RTCIceCandidateInit) => void,
  onHangup: () => void
) {
  const channel = supabase
    .channel(`call:${callId}`)
    .on('broadcast', { event: 'offer' }, (payload) => onOffer(payload.payload as RTCSessionDescriptionInit))
    .on('broadcast', { event: 'answer' }, (payload) => onAnswer(payload.payload as RTCSessionDescriptionInit))
    .on('broadcast', { event: 'ice-candidate' }, (payload) => onIceCandidate(payload.payload as RTCIceCandidateInit))
    .on('broadcast', { event: 'hangup' }, () => onHangup())
    .subscribe();
  
  return {
    sendOffer: (offer: RTCSessionDescriptionInit) => {
      channel.send({ type: 'broadcast', event: 'offer', payload: offer });
    },
    sendAnswer: (answer: RTCSessionDescriptionInit) => {
      channel.send({ type: 'broadcast', event: 'answer', payload: answer });
    },
    sendIceCandidate: (candidate: RTCIceCandidateInit) => {
      channel.send({ type: 'broadcast', event: 'ice-candidate', payload: candidate });
    },
    sendHangup: () => {
      channel.send({ type: 'broadcast', event: 'hangup', payload: {} });
    },
    unsubscribe: () => channel.unsubscribe(),
  };
}

// ============================================
// METERED TURN SERVERS
// ============================================

const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY || '';

export async function getMeteredTurnCredentials(): Promise<RTCIceServer[]> {
  if (!METERED_API_KEY) {
    console.warn('Metered API key not configured');
    return [];
  }
  
  try {
    const response = await fetch(
      `https://ourdm.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch TURN credentials');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get Metered TURN credentials:', error);
    return [];
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

export async function getAdminStats() {
  const [
    { count: totalUsers },
    { count: totalMessages },
    { count: totalCalls },
    { data: onlineUsers },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
    supabase.from('call_logs').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('id').eq('is_online', true),
  ]);
  
  return {
    totalUsers: totalUsers || 0,
    totalMessages: totalMessages || 0,
    totalCalls: totalCalls || 0,
    onlineUsers: onlineUsers?.length || 0,
  };
}

export async function getAllUsers(limit: number = 100, offset: number = 0) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data;
}

export async function suspendUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: true, suspended_at: new Date().toISOString() })
    .eq('id', userId);
  
  if (error) throw error;
}

export async function unsuspendUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: false, suspended_at: null })
    .eq('id', userId);
  
  if (error) throw error;
}

export async function deleteUser(userId: string) {
  // Delete user data
  await supabase.from('messages').delete().eq('sender_id', userId);
  await supabase.from('friends').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  await supabase.from('stories').delete().eq('user_id', userId);
  
  // Delete profile
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
  
  // Delete auth user (requires service role key)
  // This should be done via an Edge Function with service role
}

export async function makeAdmin(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', userId);
  
  if (error) throw error;
}

export async function removeAdmin(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: false })
    .eq('id', userId);
  
  if (error) throw error;
}

export async function broadcastAnnouncement(message: string, senderId: string) {
  const { data: users } = await supabase.from('profiles').select('id');
  
  if (!users) return;
  
  const announcements = users.map((user) => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    type: 'announcement',
    title: 'Announcement',
    message,
    sender_id: senderId,
    created_at: new Date().toISOString(),
    is_read: false,
  }));
  
  await supabase.from('notifications').insert(announcements);
}
