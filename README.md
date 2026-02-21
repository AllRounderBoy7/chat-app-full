# Ourdm - Private & Secure Messaging Platform

A comprehensive WhatsApp-like messaging application built with React, TypeScript, and modern web technologies.

## Features

- **End-to-End Encryption** - Secure messaging with AES-256-GCM encryption
- **Voice & Video Calls** - WebRTC-based calling with STUN/TURN servers
- **Stories** - Share photos and videos that disappear after 24 hours
- **Group Chats** - Create and manage groups with advanced permissions
- **Broadcast Lists** - Send messages to multiple contacts at once
- **App Lock** - PIN-based security for the application
- **Hidden Chats** - Archive and hide sensitive conversations
- **Real-time Sync** - Supabase-powered real-time messaging
- **PWA Support** - Install as a native app on mobile devices
- **Offline Support** - Service worker for offline functionality

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Realtime, Auth)
- **State Management**: Zustand with persistence
- **Database**: IndexedDB (Dexie) for local storage
- **Build Tool**: Vite
- **WebRTC**: Metered TURN servers for calls

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd ourdm-platform-feature-overview
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Add your Supabase credentials
```

4. Start the development server
```bash
npm run dev
```

5. Build for production
```bash
npm run build
```

## Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Auth/           # Authentication screens
│   ├── Chat/           # Chat interface
│   ├── Calls/          # Voice/video calls
│   ├── Groups/         # Group management
│   ├── Stories/        # Stories feature
│   └── Settings/       # App settings
├── lib/                # Core libraries
│   ├── supabase.ts     # Database client
│   ├── database.ts     # IndexedDB setup
│   ├── encryption.ts   # Message encryption
│   └── syncService.ts  # Real-time sync
├── services/           # Business logic
│   ├── MessageService.ts
│   ├── WebRTCService.ts
│   └── FriendService.ts
├── store/              # State management
│   └── appStore.ts     # Zustand store
├── types/              # TypeScript definitions
└── utils/              # Helper functions
```

## Key Features Explained

### Security
- AES-256-GCM encryption for all messages
- End-to-end encryption keys stored locally
- App lock with PIN protection
- Hidden chat functionality

### Performance
- IndexedDB for local message storage
- Lazy loading of media
- Optimized re-renders with React 19
- Service worker caching

### Real-time Features
- Live typing indicators
- Online status tracking
- Instant message delivery
- Real-time call connectivity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository.

---

**Version**: 3.0.0  
**Author**: Sameer Shah
