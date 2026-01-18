/**
 * Module Notification Metadata
 * 
 * Defines the notification types that a module can send.
 * This metadata is stored in the module manifest and used to:
 * - Dynamically populate notification center categories
 * - Generate notification settings UI
 * - Validate notification type names
 */

export interface ModuleNotificationType {
  /** Notification type identifier (must follow [module]_[event] pattern) */
  type: string;
  
  /** Human-readable name for this notification type */
  name: string;
  
  /** Description of when this notification is sent */
  description: string;
  
  /** Category for grouping in notification center */
  category: 'chat' | 'drive' | 'members' | 'business' | 'system' | 'mentions' | 'hr' | 'calendar' | 'scheduling' | 'todo' | string;
  
  /** Default notification channels enabled */
  defaultChannels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  
  /** Priority level */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Whether this notification requires user action */
  requiresAction?: boolean;
}

export interface ModuleNotificationMetadata {
  /** Module ID */
  moduleId: string;
  
  /** Module name */
  moduleName: string;
  
  /** List of notification types this module can send */
  notificationTypes: ModuleNotificationType[];
  
  /** Default category icon (lucide-react icon name) */
  categoryIcon?: string;
}
