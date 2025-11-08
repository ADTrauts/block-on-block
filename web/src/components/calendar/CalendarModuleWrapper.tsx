import React, { Suspense, lazy } from 'react';
import { useFeature } from '../../hooks/useFeatureGating';
import { useDashboard } from '../../contexts/DashboardContext';
import CalendarModule from '../modules/CalendarModule';
import { Spinner } from 'shared/components';

// Lazy load enterprise module for better performance
const EnhancedCalendarModule = lazy(() => import('./enterprise/EnhancedCalendarModule'));

interface CalendarModuleWrapperProps {
  className?: string;
  refreshTrigger?: number;
  dashboardId?: string | null;
  contextType?: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
  businessId?: string;
}

/**
 * Wrapper component that conditionally renders either the standard Calendar module
 * or the enhanced enterprise Calendar module based on feature access
 * 
 * NOTE: Does NOT include sidebar - sidebars are managed by parent components
 * Includes lazy loading for enterprise module to optimize bundle size
 */
export const CalendarModuleWrapper: React.FC<CalendarModuleWrapperProps> = ({
  className = '',
  refreshTrigger,
  dashboardId,
  contextType,
  businessId
}) => {
  const { currentDashboard, getDashboardType } = useDashboard();
  const dashboardType = currentDashboard ? getDashboardType(currentDashboard) : 'personal';
  
  // CRITICAL: Use dashboardId prop for data isolation
  // Do NOT fall back to currentDashboard in business context (it's null there)
  const effectiveDashboardId = dashboardId || currentDashboard?.id;
  
  // Get business ID for enterprise feature checking (NOT for data scoping!)
  const effectiveBusinessId = businessId ?? (dashboardType === 'business' ? currentDashboard?.id : undefined);
  
  console.log('📅 CalendarModuleWrapper:', {
    dashboardId,
    effectiveDashboardId,
    businessId: effectiveBusinessId,
    dashboardType,
    currentDashboardId: currentDashboard?.id,
    contextTypeOverride: contextType
  });
  
  // Check if user has enterprise Calendar features
  const { hasAccess: hasEnterpriseFeatures } = useFeature('calendar_resource_booking', effectiveBusinessId || undefined);
  
  // If user has enterprise features and is in a business context, use enhanced module
  if (hasEnterpriseFeatures && effectiveBusinessId) {
    return (
      <Suspense 
        fallback={
          <div className="flex items-center justify-center bg-gray-50 h-full">
            <div className="text-center">
              <Spinner size={32} />
              <p className="mt-4 text-sm text-gray-600">Loading enterprise calendar...</p>
            </div>
          </div>
        }
      >
        <EnhancedCalendarModule 
          businessId={effectiveBusinessId}
          dashboardId={effectiveDashboardId}
          className={className}
          refreshTrigger={refreshTrigger}
          contextType={contextType}
        />
      </Suspense>
    );
  }
  
  // Otherwise, use standard Calendar module
  return (
    <CalendarModule 
      businessId={effectiveBusinessId}
      dashboardId={effectiveDashboardId}
      className={className}
      refreshTrigger={refreshTrigger}
      contextType={contextType}
    />
  );
};

export default CalendarModuleWrapper;
