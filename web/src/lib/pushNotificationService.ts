import { authenticatedApiCall } from './apiUtils';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean = false;

  private constructor() {
    this.checkSupport();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Check if push notifications are supported
   */
  private async checkSupport(): Promise<void> {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return;
    }

    try {
      // Try to get existing registration
      let registration = await navigator.serviceWorker.getRegistration('/sw.js');
      
      // If no registration, try to register
      if (!registration) {
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          console.log('✅ Service worker registered for push notifications');
        } catch (regError) {
          console.warn('⚠️ Service worker registration failed:', regError);
          // This is expected in development if service worker isn't fully configured
        }
      }
      
      this.registration = registration || null;
      if (!this.registration) {
        console.log('Service worker not found, push notifications will be disabled');
      }
    } catch (error) {
      console.error('Error checking service worker registration:', error);
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Check if notification permission is granted
   */
  async isPermissionGranted(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    return Notification.permission === 'granted';
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscriptionData | null> {
    if (!this.isSupported || !this.registration) {
      console.warn('Push notifications not supported or service worker not registered');
      return null;
    }

    try {
      // Check permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Get VAPID public key
      const response = await authenticatedApiCall('/api/push-notifications/vapid-public-key', {
        method: 'GET'
      }) as { publicKey?: string };

      if (!response.publicKey) {
        console.error('VAPID public key not available');
        return null;
      }

      // Convert VAPID key
      const vapidPublicKey = this.urlBase64ToUint8Array(response.publicKey);

      // Subscribe to push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      // Save subscription to server
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };
      
      await this.saveSubscription(subscriptionData);

      console.log('✅ Push notification subscription successful');
      return subscriptionData;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.isSupported || !this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscription(subscription.endpoint);
        console.log('✅ Push notification unsubscription successful');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  /**
   * Check if user is subscribed to push notifications
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported || !this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Save subscription to server
   */
  private async saveSubscription(subscription: PushSubscriptionData): Promise<void> {
    await authenticatedApiCall('/api/push-notifications/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscription)
    });
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscription(endpoint: string): Promise<void> {
    await authenticatedApiCall('/api/push-notifications/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint })
    });
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Test push notification (admin only)
   */
  async testNotification(title: string = 'Test Notification', body: string = 'This is a test push notification'): Promise<boolean> {
    try {
      const response = await authenticatedApiCall('/api/push-notifications/test', {
        method: 'POST',
        body: JSON.stringify({ title, body })
      }) as { success?: boolean };

      return response.success || false;
    } catch (error) {
      console.error('Error testing push notification:', error);
      return false;
    }
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  }> {
    const supported = this.isSupported;
    const permission = supported ? Notification.permission : 'denied';
    const subscribed = supported ? await this.isSubscribed() : false;

    return {
      supported,
      permission,
      subscribed
    };
  }
} 