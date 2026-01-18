'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { authenticatedApiCall } from '@/lib/apiUtils';

interface ModuleInstallation {
  id: string;
  name: string;
  enabled: boolean;
}

interface UseModuleIntegrationReturn {
  hasDrive: boolean;
  hasCalendar: boolean;
  hasChat: boolean;
  hasScheduling: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check which modules are installed for a business
 * Used to conditionally show integration features
 */
export function useModuleIntegration(businessId?: string): UseModuleIntegrationReturn {
  const { data: session } = useSession();
  const [modules, setModules] = useState<ModuleInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken || !businessId) {
      setLoading(false);
      return;
    }

    const loadModules = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedApiCall<{ success: boolean; data: ModuleInstallation[] }>(
          `/api/modules/installed?scope=business&businessId=${businessId}`,
          { method: 'GET' }
        );

        if (response?.success && Array.isArray(response.data)) {
          setModules(response.data.filter(m => m.enabled));
        } else {
          setModules([]);
        }
      } catch (err) {
        console.error('Failed to load installed modules:', err);
        setError(err instanceof Error ? err.message : 'Failed to load modules');
        setModules([]);
      } finally {
        setLoading(false);
      }
    };

    void loadModules();
  }, [session?.accessToken, businessId]);

  // Check for specific modules
  const hasModule = (moduleId: string): boolean => {
    return modules.some(m => m.id === moduleId && m.enabled);
  };

  return {
    hasDrive: hasModule('drive'),
    hasCalendar: hasModule('calendar'),
    hasChat: hasModule('chat'),
    hasScheduling: hasModule('scheduling'),
    loading,
    error,
  };
}

