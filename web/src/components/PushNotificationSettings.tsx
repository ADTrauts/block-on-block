'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from 'shared/components';
import { Switch } from 'shared/components';
import { Alert } from 'shared/components';
import { PushNotificationService } from '../lib/pushNotificationService';

interface PushNotificationSettingsProps {
  className?: string;
}

export default function PushNotificationSettings({ className = '' }: PushNotificationSettingsProps) {
  const [status, setStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  }>({
    supported: false,
    permission: 'denied',
    subscribed: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pushService = PushNotificationService.getInstance();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const currentStatus = await pushService.getSubscriptionStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Error checking push notification status:', error);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const subscription = await pushService.subscribe();
      
      if (subscription) {
        setSuccess('Push notifications enabled successfully!');
        await checkStatus();
      } else {
        setError('Failed to enable push notifications. Please check your browser settings.');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setError('Failed to enable push notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const success = await pushService.unsubscribe();
      
      if (success) {
        setSuccess('Push notifications disabled successfully!');
        await checkStatus();
      } else {
        setError('Failed to disable push notifications. Please try again.');
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setError('Failed to disable push notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const success = await pushService.testNotification(
        'Test Notification',
        'This is a test push notification from Vssyl!'
      );
      
      if (success) {
        setSuccess('Test notification sent successfully!');
      } else {
        setError('Failed to send test notification. Please check your subscription status.');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setError('Failed to send test notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!status.supported) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    
    if (status.permission === 'granted' && status.subscribed) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    
    if (status.permission === 'denied') {
      return <BellOff className="w-5 h-5 text-red-500" />;
    }
    
    return <Bell className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (!status.supported) {
      return 'Push notifications are not supported in this browser';
    }
    
    if (status.permission === 'granted' && status.subscribed) {
      return 'Push notifications are enabled';
    }
    
    if (status.permission === 'denied') {
      return 'Push notifications are blocked. Please enable them in your browser settings.';
    }
    
    if (status.permission === 'default') {
      return 'Push notifications are not enabled';
    }
    
    return 'Push notification status unknown';
  };

  const getStatusColor = () => {
    if (!status.supported || status.permission === 'denied') {
      return 'red';
    }
    
    if (status.permission === 'granted' && status.subscribed) {
      return 'green';
    }
    
    return 'yellow';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold">Push Notifications</h3>
            <p className="text-sm text-gray-600">{getStatusText()}</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert type="error" title="Error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success" title="Success">
          {success}
        </Alert>
      )}

      <div className="space-y-4">
        {status.supported && status.permission !== 'denied' && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Enable Push Notifications</h4>
              <p className="text-sm text-gray-600">
                Receive notifications even when the app is closed
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {status.subscribed ? (
                <Button
                  variant="secondary"
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="flex items-center space-x-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                  <span>Disable</span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="flex items-center space-x-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  <span>Enable</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {status.supported && status.subscribed && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Test Push Notification</h4>
              <p className="text-sm text-gray-600">
                Send a test notification to verify everything is working
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleTestNotification}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              <span>Send Test</span>
            </Button>
          </div>
        )}

        {!status.supported && (
          <Alert type="warning" title="Browser Not Supported">
            <p>Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.</p>
            <p className="text-sm mt-2 text-gray-600">
              Note: Service worker registration may take a moment. If you just enabled push notifications, wait a few seconds and refresh the page.
            </p>
          </Alert>
        )}

        {status.permission === 'denied' && (
          <Alert type="error" title="Notifications Blocked">
            <p className="mb-2">Push notifications are blocked in your browser. To enable them:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Click the lock/info icon in your browser's address bar</li>
              <li>Change "Notifications" to "Allow"</li>
              <li>Refresh this page</li>
            </ol>
          </Alert>
        )}

        {status.supported && status.permission !== 'denied' && !status.subscribed && (
          <Alert type="info" title="Enable Push Notifications">
            <p>Click "Enable" above to subscribe to push notifications. You'll receive notifications even when the app is closed.</p>
          </Alert>
        )}
      </div>

      {/* Note: Push notification preferences are controlled by the main notification preferences above */}
      {/* Individual notification type toggles are managed in the main Notification Settings page */}
    </div>
  );
} 