'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  getMyOnboardingJourneys,
  completeMyOnboardingTask,
  type EmployeeOnboardingJourney,
  type EmployeeOnboardingProfile,
  type CompleteOnboardingTaskPayload,
} from '@/api/hrOnboarding';

interface UseOnboardingJourneyReturn {
  profile: EmployeeOnboardingProfile | null;
  journeys: EmployeeOnboardingJourney[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  completeTask: (taskId: string, payload: CompleteOnboardingTaskPayload) => Promise<void>;
}

export function useOnboardingJourney(businessId: string): UseOnboardingJourneyReturn {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<EmployeeOnboardingProfile | null>(null);
  const [journeys, setJourneys] = useState<EmployeeOnboardingJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJourneys = useCallback(async () => {
    if (!session?.accessToken || !businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getMyOnboardingJourneys(businessId);
      setProfile(data.profile);
      setJourneys(data.journeys);
    } catch (err) {
      console.error('Failed to load onboarding journeys:', err);
      setError(err instanceof Error ? err.message : 'Failed to load onboarding journeys');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, businessId]);

  const completeTask = useCallback(
    async (taskId: string, payload: CompleteOnboardingTaskPayload) => {
      if (!session?.accessToken || !businessId) {
        throw new Error('Not authenticated');
      }

      try {
        await completeMyOnboardingTask(businessId, taskId, payload);
        // Refresh journeys after completing task
        await loadJourneys();
      } catch (err) {
        console.error('Failed to complete onboarding task:', err);
        throw err;
      }
    },
    [session?.accessToken, businessId, loadJourneys]
  );

  useEffect(() => {
    void loadJourneys();
  }, [loadJourneys]);

  return {
    profile,
    journeys,
    loading,
    error,
    refresh: loadJourneys,
    completeTask,
  };
}

