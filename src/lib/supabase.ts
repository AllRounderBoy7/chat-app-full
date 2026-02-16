import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lskhxlmzfpvcollwflxq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2h4bG16ZnB2Y29sbHdmbHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODM1MzQsImV4cCI6MjA4NjM1OTUzNH0.GOHTXs87TjjukqXh1NHC8T98Pgzyrqq9dDoPJ8_JB6I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Metered TURN API Configuration
export const METERED_API_KEY = '721c866ff0333b031f3703962619c0dba4bd';
export const METERED_API_URL = 'https://ourdm.metered.live/api/v1/turn/credentials';

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.voipbuster.com:3478' },
  { urls: 'stun:stun.sipgate.net:3478' },
  { urls: 'stun:stun.voiparound.com:3478' },
  { urls: 'stun:stun.voipstunt.com:3478' },
  { urls: 'stun:stun.counterpath.com:3478' },
  { urls: 'stun:stun.nextcloud.com:3478' },
  { urls: 'stun:stun.ekiga.net:3478' },
  { urls: 'stun:stun.freevoipdeal.com:3478' },
  { urls: 'stun:stun.ideasip.com:3478' },
  { urls: 'stun:stun.schlund.de:3478' },
  { urls: 'stun:stun.voipgate.com:3478' },
  { urls: 'stun:stun.1und1.de:3478' },
  { urls: 'stun:stun.gmx.net:3478' },
  { urls: 'stun:stun.netappel.com:3478' }
];

export const STATIC_TURN_SERVERS = [
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:a.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:a.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:b.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:b.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:c.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:c.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:d.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:d.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:e.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:e.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
];

// Fetch TURN servers from Metered API (Primary Method)
export async function getMeteredTurnServers(): Promise<RTCIceServer[]> {
  try {
    const response = await fetch(`${METERED_API_URL}?apiKey=${METERED_API_KEY}`);
    if (response.ok) {
      const iceServers = await response.json();
      console.log('✅ Metered TURN servers fetched successfully:', iceServers.length, 'servers');
      return iceServers;
    }
    console.warn('⚠️ Metered API returned non-OK status, using static fallback');
  } catch (error) {
    console.error('❌ Failed to fetch Metered TURN servers:', error);
  }
  return STATIC_TURN_SERVERS;
}

// Get complete ICE configuration (STUN + TURN)
export async function getIceConfiguration(
  stunEnabled: boolean = true,
  turnEnabled: boolean = true
): Promise<RTCConfiguration> {
  const iceServers: RTCIceServer[] = [];

  // Add STUN servers (free, works for 80-90% of calls)
  if (stunEnabled) {
    iceServers.push(...STUN_SERVERS);
  }

  // Add TURN servers (required for restrictive NATs/firewalls)
  if (turnEnabled) {
    const turnServers = await getMeteredTurnServers();
    iceServers.push(...turnServers);
  }

  return {
    iceServers,
    iceTransportPolicy: turnEnabled ? 'all' : 'relay',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10
  };
}
