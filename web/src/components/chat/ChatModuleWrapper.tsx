import React, { Suspense, lazy } from 'react';
import { useFeature } from '../../hooks/useFeatureGating';
import { useDashboard } from '../../contexts/DashboardContext';
import ChatModule from '../modules/ChatModule';
import { Spinner } from 'shared/components';
import type { EnhancedChatModuleProps } from './enterprise/EnhancedChatModule';

// Lazy load enterprise module for better performance
const EnhancedChatModule = lazy<React.ComponentType<EnhancedChatModuleProps>>(
  () => import('./enterprise/EnhancedChatModule')
);

interface ChatModuleWrapperProps {
  className?: string;
  refreshTrigger?: number;
  dashboardId?: string | null;  // REQUIRED for proper data isolation
  businessId?: string;
}

/**
 * Wrapper component that conditionally renders either the standard Chat module
 * or the enhanced enterprise Chat module based on feature access
 * 
 * Pattern matches DriveModuleWrapper and CalendarModuleWrapper for consistency
 * Includes lazy loading for enterprise module to optimize bundle size
 */
export const ChatModuleWrapper: React.FC<ChatModuleWrapperProps> = ({
  className = '',
  refreshTrigger,
  dashboardId,
  businessId
}) => {
  const { currentDashboard, getDashboardType } = useDashboard();
  
  // CRITICAL: Use dashboardId prop for data isolation
  // Do NOT fall back to currentDashboard in business context (it's null there)
  const effectiveDashboardId = dashboardId || currentDashboard?.id;
  const dashboardType = currentDashboard ? getDashboardType(currentDashboard) : 'personal';
  
  // Get business ID for enterprise feature checking (NOT for data scoping!)
  const effectiveBusinessId = businessId ?? (dashboardType === 'business' ? currentDashboard?.id : undefined);
  
  console.log('💬 ChatModuleWrapper:', {
    dashboardId,
    effectiveDashboardId,
    dashboardType,
    currentDashboardId: currentDashboard?.id,
    effectiveBusinessId
  });
  
  // Check if user has enterprise Chat features
  // Using 'chat_message_retention' as the primary enterprise chat feature gate
  const { hasAccess: hasEnterpriseFeatures } = useFeature('chat_message_retention', effectiveBusinessId || undefined);
  
  // Full-page layout with Chat (no separate sidebar - chat has integrated panels)
  // If user has enterprise features and is in a business context, use enhanced module
  if (hasEnterpriseFeatures && effectiveBusinessId) {
    return (
      <div className={`h-full ${className}`}>
        <Suspense 
          fallback={
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Spinner size={32} />
                <p className="mt-4 text-sm text-gray-600">Loading enterprise chat...</p>
              </div>
            </div>
          }
        >
          <EnhancedChatModule 
            businessId={effectiveBusinessId}
            dashboardId={effectiveDashboardId || undefined}
            className="h-full"
          />
        </Suspense>
      </div>
    );
  }
  
  return (
    <div className={`h-full ${className}`}>
      <ChatModule 
        businessId={effectiveBusinessId || ''}
        className="h-full"
        refreshTrigger={refreshTrigger}
        dashboardId={effectiveDashboardId || undefined}
      />
    </div>
  );
};

export default ChatModuleWrapper;

