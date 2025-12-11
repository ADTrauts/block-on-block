import React, { Suspense, lazy } from 'react';
import { useFeature } from '../../hooks/useFeatureGating';
import { useDashboard } from '../../contexts/DashboardContext';
import DriveModule from '../modules/DriveModule';
import { Spinner } from 'shared/components';

// Lazy load enterprise module for better performance
const EnhancedDriveModule = lazy(() => import('./enterprise/EnhancedDriveModule'));

interface DriveModuleWrapperProps {
  className?: string;
  refreshTrigger?: number;
  dashboardId?: string | null;
  businessId?: string;
}

/**
 * Wrapper component that conditionally renders either the standard Drive module
 * or the enhanced enterprise Drive module based on feature access
 * 
 * NOTE: Does NOT include sidebar - sidebars are managed by parent components
 * Includes lazy loading for enterprise module to optimize bundle size
 */
export const DriveModuleWrapper: React.FC<DriveModuleWrapperProps> = ({
  className = '',
  refreshTrigger,
  dashboardId,
  businessId
}) => {
  const { currentDashboard, getDashboardType } = useDashboard();
  const dashboardType = currentDashboard ? getDashboardType(currentDashboard) : 'personal';
  
  // Use explicit dashboardId if provided, otherwise fall back to current dashboard
  const effectiveDashboardId = dashboardId || currentDashboard?.id;
  
  // Get business ID for enterprise feature checking
  const effectiveBusinessId = businessId ?? ((dashboardType === 'business' ? currentDashboard?.id : undefined));
  
  console.log('🚀 DriveModuleWrapper:', {
    dashboardId,
    effectiveDashboardId,
    businessId: effectiveBusinessId,
    dashboardType,
    currentDashboardId: currentDashboard?.id
  });
  
  // Check if user has enterprise Drive features
  const { hasAccess: hasEnterpriseFeatures } = useFeature('drive_advanced_sharing', effectiveBusinessId);
  
  // If user has enterprise features and is in a business context, use enhanced module
  if (hasEnterpriseFeatures && effectiveBusinessId) {
    return (
      <Suspense 
        fallback={
          <div className="flex items-center justify-center bg-gray-50 h-full">
            <div className="text-center">
              <Spinner size={32} />
              <p className="mt-4 text-sm text-gray-600">Loading enterprise drive...</p>
            </div>
          </div>
        }
      >
        <EnhancedDriveModule 
          businessId={effectiveBusinessId}
          dashboardId={effectiveDashboardId}
          className={className}
          refreshTrigger={refreshTrigger}
        />
      </Suspense>
    );
  }
  
  // Otherwise, use standard Drive module
  return (
    <DriveModule 
      dashboardId={effectiveDashboardId}
      className={className}
      refreshTrigger={refreshTrigger}
    />
  );
};

export default DriveModuleWrapper;
