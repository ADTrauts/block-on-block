import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Schedule,
  ScheduleShift,
  ShiftTemplate,
  EmployeeAvailability,
  ShiftSwapRequest,
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  publishSchedule,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getShiftTemplates,
  getAllEmployeeAvailability,
  getAllShiftSwapRequests,
  approveShiftSwap,
  denyShiftSwap,
  getTeamSchedules,
  getOwnSchedule,
  getOwnAvailability,
  setOwnAvailability,
  updateOwnAvailability,
  deleteOwnAvailability,
  requestShiftSwap,
  getOwnShiftSwapRequests,
  cancelSwapRequest,
  getOwnOpenShifts,
  claimOpenShift,
} from '@/api/scheduling';

export interface UseSchedulingOptions {
  businessId: string;
  scope?: 'admin' | 'manager' | 'employee';
  autoFetch?: boolean;
}

export interface UseSchedulingReturn {
  // State
  schedules: Schedule[];
  shifts: ScheduleShift[];
  templates: ShiftTemplate[];
  availability: EmployeeAvailability[];
  swapRequests: ShiftSwapRequest[];
  loading: boolean;
  error: string | null;

  // Admin Actions
  fetchSchedules: () => Promise<void>;
  fetchScheduleById: (scheduleId: string) => Promise<Schedule | null>;
  createNewSchedule: (scheduleData: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    timezone?: string;
    locationId?: string;
    templateId?: string;
  }) => Promise<Schedule | null>;
  updateExistingSchedule: (scheduleId: string, scheduleData: Partial<Schedule>) => Promise<Schedule | null>;
  removeSchedule: (scheduleId: string) => Promise<boolean>;
  publishExistingSchedule: (scheduleId: string) => Promise<Schedule | null>;

  // Shift Actions
  fetchShifts: (scheduleId?: string) => Promise<void>;
  createNewShift: (shiftData: {
    scheduleId: string;
    title: string;
    employeePositionId?: string;
    positionId?: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    notes?: string;
    stationName?: string;
    jobFunction?: string;
    color?: string;
  }) => Promise<ScheduleShift | null>;
  updateExistingShift: (shiftId: string, shiftData: Partial<ScheduleShift>) => Promise<ScheduleShift | null>;
  removeShift: (shiftId: string) => Promise<boolean>;

  // Template Actions
  fetchTemplates: () => Promise<void>;

  // Availability Actions
  fetchAvailability: () => Promise<void>;
  fetchOwnAvailability: () => Promise<void>;
  setAvailability: (availabilityData: {
    dayOfWeek: string;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    availabilityType: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
    notes?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    recurring?: boolean;
  }) => Promise<EmployeeAvailability | null>;
  updateAvailability: (availabilityId: string, availabilityData: Partial<EmployeeAvailability>) => Promise<EmployeeAvailability | null>;
  deleteAvailability: (availabilityId: string) => Promise<boolean>;

  // Swap Request Actions
  fetchSwapRequests: () => Promise<void>;
  requestSwap: (shiftId: string, requestData: {
    requestedToId?: string;
    coveredShiftId?: string;
    requestNotes?: string;
  }) => Promise<ShiftSwapRequest | null>;
  cancelSwap: (swapId: string) => Promise<ShiftSwapRequest | null>;
  approveSwap: (swapId: string, managerNotes?: string) => Promise<boolean>;
  denySwap: (swapId: string, managerNotes?: string) => Promise<boolean>;

  // Employee Actions
  openShifts: ScheduleShift[];
  fetchOpenShifts: (options?: {
    startDate?: string;
    endDate?: string;
    positionId?: string;
  }) => Promise<void>;
  claimShift: (shiftId: string) => Promise<ScheduleShift | null>;

  // Refresh
  refresh: () => Promise<void>;
}

export const useScheduling = ({
  businessId,
  scope = 'employee',
  autoFetch = true,
}: UseSchedulingOptions): UseSchedulingReturn => {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  
  // Debug logging for token issues
  useEffect(() => {
    if (!token && session) {
      console.warn('useScheduling: No accessToken in session', { 
        sessionKeys: Object.keys(session || {}),
        hasSession: !!session 
      });
    }
  }, [token, session]);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Schedules
  const fetchSchedules = useCallback(async () => {
    if (!businessId || !token) return;
    
    setLoading(true);
    setError(null);
    try {
      let data: Schedule[];
      if (scope === 'admin') {
        data = await getSchedules(businessId, token);
      } else if (scope === 'manager') {
        data = await getTeamSchedules(businessId, token);
      } else {
        data = await getOwnSchedule(businessId, token);
      }
      
      // Debug logging to verify data structure
      // Removed debug logging to reduce console noise
      setSchedules(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch schedules';
      setError(errorMessage);
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Fetch Schedule by ID
  const fetchScheduleById = useCallback(async (scheduleId: string): Promise<Schedule | null> => {
    if (!businessId || !token || scope !== 'admin') return null;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getScheduleById(businessId, scheduleId, token);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch schedule';
      setError(errorMessage);
      console.error('Error fetching schedule:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Create Schedule
  const createNewSchedule = useCallback(async (scheduleData: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    timezone?: string;
    locationId?: string;
    templateId?: string;
  }): Promise<Schedule | null> => {
    if (!businessId || !token || scope !== 'admin') return null;
    
    setLoading(true);
    setError(null);
    try {
      const newSchedule = await createSchedule(businessId, scheduleData, token);
      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create schedule';
      setError(errorMessage);
      console.error('Error creating schedule:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Update Schedule
  const updateExistingSchedule = useCallback(async (
    scheduleId: string,
    scheduleData: Partial<Schedule>
  ): Promise<Schedule | null> => {
    if (!businessId || !token || scope !== 'admin') return null;
    
    setLoading(true);
    setError(null);
    try {
      const updated = await updateSchedule(businessId, scheduleId, scheduleData, token);
      setSchedules(prev => prev.map(s => s.id === scheduleId ? updated : s));
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update schedule';
      setError(errorMessage);
      console.error('Error updating schedule:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Delete Schedule
  const removeSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    if (!businessId || !token || scope !== 'admin') return false;
    
    setLoading(true);
    setError(null);
    try {
      await deleteSchedule(businessId, scheduleId, token);
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete schedule';
      setError(errorMessage);
      console.error('Error deleting schedule:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Publish Schedule
  const publishExistingSchedule = useCallback(async (scheduleId: string): Promise<Schedule | null> => {
    if (!businessId || !token || scope !== 'admin') return null;
    
    setLoading(true);
    setError(null);
    try {
      const published = await publishSchedule(businessId, scheduleId, token);
      setSchedules(prev => prev.map(s => s.id === scheduleId ? published : s));
      return published;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to publish schedule';
      setError(errorMessage);
      console.error('Error publishing schedule:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Fetch Shifts
  const fetchShifts = useCallback(async (scheduleId?: string) => {
    if (!businessId || !token || scope !== 'admin') {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Removed debug logging to reduce console noise
      const data = await getShifts(businessId, scheduleId, token);
      setShifts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch shifts';
      setError(errorMessage);
      console.error('❌ useScheduling.fetchShifts: Error', err);
    } finally {
      setLoading(false);
      // Removed debug logging to reduce console noise
    }
  }, [businessId, token, scope]);

  // Create Shift
  const createNewShift = useCallback(async (shiftData: {
    scheduleId: string;
    title: string;
    employeePositionId?: string;
    positionId?: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    notes?: string;
    stationName?: string;
    jobFunction?: string;
    color?: string;
  }): Promise<ScheduleShift | null> => {
    if (!businessId || !token || scope !== 'admin') return null;
    
    setLoading(true);
    setError(null);
    try {
      const newShift = await createShift(businessId, shiftData, token);
      setShifts(prev => [...prev, newShift]);
      return newShift;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create shift';
      setError(errorMessage);
      console.error('Error creating shift:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Update Shift
  const updateExistingShift = useCallback(async (
    shiftId: string,
    shiftData: Partial<ScheduleShift>
  ): Promise<ScheduleShift | null> => {
    if (!businessId || !token || scope !== 'admin') return null;
    
    setLoading(true);
    setError(null);
    try {
      const updated = await updateShift(businessId, shiftId, shiftData, token);
      setShifts(prev => prev.map(s => s.id === shiftId ? updated : s));
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update shift';
      setError(errorMessage);
      console.error('Error updating shift:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Delete Shift
  const removeShift = useCallback(async (shiftId: string): Promise<boolean> => {
    if (!businessId || !token || scope !== 'admin') return false;
    
    setLoading(true);
    setError(null);
    try {
      await deleteShift(businessId, shiftId, token);
      setShifts(prev => prev.filter(s => s.id !== shiftId));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete shift';
      setError(errorMessage);
      console.error('Error deleting shift:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    if (!businessId || !token || scope !== 'admin') return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getShiftTemplates(businessId, token);
      setTemplates(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Fetch Availability
  const fetchAvailability = useCallback(async () => {
    if (!businessId || !token) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = scope === 'admin' 
        ? await getAllEmployeeAvailability(businessId, token)
        : []; // Employee-specific availability fetching would go here
      setAvailability(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch availability';
      setError(errorMessage);
      console.error('Error fetching availability:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Fetch Own Availability (employee view)
  const fetchOwnAvailability = useCallback(async () => {
    if (!businessId || !token) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getOwnAvailability(businessId, token);
      setAvailability(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch availability';
      setError(errorMessage);
      console.error('Error fetching availability:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Set Availability
  const setAvailabilityData = useCallback(async (availabilityData: {
    dayOfWeek: string;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    availabilityType: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
    notes?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    recurring?: boolean;
  }): Promise<EmployeeAvailability | null> => {
    if (!businessId || !token) return null;
    
    setLoading(true);
    setError(null);
    try {
      const newAvailability = await setOwnAvailability(businessId, availabilityData, token);
      setAvailability(prev => [...prev, newAvailability]);
      return newAvailability;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set availability';
      setError(errorMessage);
      console.error('Error setting availability:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Update Availability
  const updateAvailabilityData = useCallback(async (
    availabilityId: string,
    availabilityData: Partial<EmployeeAvailability>
  ): Promise<EmployeeAvailability | null> => {
    if (!businessId || !token) return null;
    
    setLoading(true);
    setError(null);
    try {
      const updated = await updateOwnAvailability(businessId, availabilityId, availabilityData, token);
      setAvailability(prev => prev.map(a => a.id === availabilityId ? updated : a));
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update availability';
      setError(errorMessage);
      console.error('Error updating availability:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Delete Availability
  const deleteAvailabilityData = useCallback(async (availabilityId: string): Promise<boolean> => {
    if (!businessId || !token) return false;
    
    setLoading(true);
    setError(null);
    try {
      await deleteOwnAvailability(businessId, availabilityId, token);
      setAvailability(prev => prev.filter(a => a.id !== availabilityId));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete availability';
      setError(errorMessage);
      console.error('Error deleting availability:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Fetch Swap Requests
  const fetchSwapRequests = useCallback(async () => {
    if (!businessId || !token) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = scope === 'admin'
        ? await getAllShiftSwapRequests(businessId, token)
        : await getOwnShiftSwapRequests(businessId, token);
      setSwapRequests(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch swap requests';
      setError(errorMessage);
      console.error('Error fetching swap requests:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Request Swap
  const requestSwap = useCallback(async (
    shiftId: string,
    requestData: {
      requestedToId?: string;
      coveredShiftId?: string;
      requestNotes?: string;
    }
  ): Promise<ShiftSwapRequest | null> => {
    if (!businessId || !token) return null;
    
    setLoading(true);
    setError(null);
    try {
      const newRequest = await requestShiftSwap(businessId, shiftId, requestData, token);
      setSwapRequests(prev => [...prev, newRequest]);
      return newRequest;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request shift swap';
      setError(errorMessage);
      console.error('Error requesting swap:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Cancel Swap Request
  const cancelSwap = useCallback(async (swapId: string): Promise<ShiftSwapRequest | null> => {
    if (!businessId || !token) return null;
    
    setLoading(true);
    setError(null);
    try {
      const cancelledSwap = await cancelSwapRequest(businessId, swapId, token);
      setSwapRequests(prev => prev.map(sr => sr.id === swapId ? cancelledSwap : sr));
      return cancelledSwap;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel swap request';
      setError(errorMessage);
      console.error('Error cancelling swap request:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Approve Swap
  const approveSwap = useCallback(async (swapId: string, managerNotes?: string): Promise<boolean> => {
    if (!businessId || !token || (scope !== 'admin' && scope !== 'manager')) return false;
    
    setLoading(true);
    setError(null);
    try {
      await approveShiftSwap(businessId, swapId, managerNotes, token, scope);
      setSwapRequests(prev => prev.map(sr => 
        sr.id === swapId ? { ...sr, status: 'APPROVED' as const } : sr
      ));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve swap';
      setError(errorMessage);
      console.error('Error approving swap:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Deny Swap
  const denySwap = useCallback(async (swapId: string, managerNotes?: string): Promise<boolean> => {
    if (!businessId || !token || (scope !== 'admin' && scope !== 'manager')) return false;
    
    setLoading(true);
    setError(null);
    try {
      await denyShiftSwap(businessId, swapId, managerNotes, token, scope);
      setSwapRequests(prev => prev.map(sr => 
        sr.id === swapId ? { ...sr, status: 'DENIED' as const } : sr
      ));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deny swap';
      setError(errorMessage);
      console.error('Error denying swap:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [businessId, token, scope]);

  // Fetch Open Shifts
  const [openShifts, setOpenShifts] = useState<ScheduleShift[]>([]);
  const fetchOpenShifts = useCallback(async (options?: {
    startDate?: string;
    endDate?: string;
    positionId?: string;
  }) => {
    if (!businessId || !token) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getOwnOpenShifts(businessId, options, token);
      setOpenShifts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch open shifts';
      setError(errorMessage);
      console.error('Error fetching open shifts:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Claim Open Shift
  const claimShift = useCallback(async (shiftId: string): Promise<ScheduleShift | null> => {
    if (!businessId || !token) return null;
    
    setLoading(true);
    setError(null);
    try {
      const claimedShift = await claimOpenShift(businessId, shiftId, token);
      // Update shifts list if we have it
      setShifts(prev => prev.map(s => s.id === shiftId ? claimedShift : s));
      // Remove from open shifts list
      setOpenShifts(prev => prev.filter(s => s.id !== shiftId));
      return claimedShift;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim shift';
      setError(errorMessage);
      console.error('Error claiming shift:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchSchedules(),
      scope === 'admin' && fetchTemplates(),
      scope === 'admin' && fetchAvailability(),
      fetchSwapRequests(),
    ]);
  }, [fetchSchedules, fetchTemplates, fetchAvailability, fetchSwapRequests, scope]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && businessId && token) {
      refresh();
    } else if (autoFetch && businessId && !token) {
      console.warn('useScheduling: Cannot auto-fetch - token is missing', { 
        businessId, 
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : []
      });
    }
  }, [autoFetch, businessId, token, session]); // Intentionally not including refresh to avoid loops

  return {
    // State
    schedules,
    shifts,
    templates,
    availability,
    swapRequests,
    loading,
    error,

    // Admin Actions
    fetchSchedules,
    fetchScheduleById,
    createNewSchedule,
    updateExistingSchedule,
    removeSchedule,
    publishExistingSchedule,

    // Shift Actions
    fetchShifts,
    createNewShift,
    updateExistingShift,
    removeShift,

    // Template Actions
    fetchTemplates,

    // Availability Actions
    fetchAvailability,
    fetchOwnAvailability,
    setAvailability: setAvailabilityData,
    updateAvailability: updateAvailabilityData,
    deleteAvailability: deleteAvailabilityData,

    // Swap Request Actions
    fetchSwapRequests,
    requestSwap,
    cancelSwap,
    approveSwap,
    denySwap,

    // Employee Actions
    openShifts,
    fetchOpenShifts,
    claimShift,

    // Refresh
    refresh,
  };
};

