import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', registration.scope);
      
      // Request persistent storage
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log('Storage persisted:', isPersisted);
      }
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      // Register periodic sync for checking messages
      if ('periodicSync' in registration) {
        try {
          await (registration as ServiceWorkerRegistration & { periodicSync: { register: (tag: string, options: { minInterval: number }) => Promise<void> } }).periodicSync.register('check-messages', {
            minInterval: 60 * 1000 // 1 minute
          });
        } catch (error) {
          console.log('Periodic sync not supported');
        }
      }
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}

// Add online/offline detection
window.addEventListener('online', () => {
  document.body.classList.remove('offline');
  console.log('Back online');
});

window.addEventListener('offline', () => {
  document.body.classList.add('offline');
  console.log('Gone offline');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
