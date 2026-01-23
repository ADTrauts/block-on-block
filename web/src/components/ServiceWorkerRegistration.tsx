'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * 
 * IMPORTANT: Service worker is now LAZY-LOADED
 * - Does NOT auto-register on page load
 * - Only registers when PushNotificationService needs it (when user enables push notifications)
 * - This prevents service worker from interfering with API requests
 * 
 * The service worker will be registered automatically by PushNotificationService
 * when the user actually subscribes to push notifications.
 * 
 * Existing service workers are left alone - they may be needed for active push subscriptions.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Don't auto-register service worker on page load
    // Let PushNotificationService handle registration when push notifications are actually needed
    // This prevents the service worker from interfering with API requests
    
    // Check if service worker is already registered (might be from previous session)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log('ℹ️ Service Worker already registered (likely for push notifications)');
        } else {
          console.log('ℹ️ Service Worker not registered - will be registered on-demand when push notifications are enabled');
        }
      });
    }
  }, []);

  return null;
}
