/**
 * Employee Self-Service HR Page
 * 
 * Employee view of their own HR data
 * Access: All business employees
 * Location: /business/[id]/workspace/hr/me
 * 
 * Framework: Displays employee's own HR information
 * Features will be implemented incrementally
 */

'use client';

import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHRFeatures } from '@/hooks/useHRFeatures';
import { useBusinessConfiguration } from '@/contexts/BusinessConfigurationContext';
import { Spinner, Alert, EmptyState } from 'shared/components';
import { toast } from 'react-hot-toast';
import HRPageLayout from '@/components/hr/HRPageLayout';
import {
  completeMyOnboardingTask,
  getMyOnboardingJourneys,
  type EmployeeOnboardingJourney,
  type OnboardingTaskStatus,
} from '@/api/hrOnboarding';
import EmployeeOnboardingJourneyView from '@/components/hr/onboarding/EmployeeOnboardingJourneyView';

interface EmployeeData {
  id: string;
  user: {
    name: string;
  }
  & { email: string; };
  position: {
    title: string;
    department?: {
      name: string;
    };
  };
  hrProfile?: {
    hireDate?: string;
    employeeType?: string;
  };
}

type MyRequest = { id: string; type: string; startDate: string; endDate: string; status: string; requestedAt: string; managerNote?: string };

enum TimeOffType {
  PTO = 'PTO',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  UNPAID = 'UNPAID'
}

type AttendanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXCEPTION' | 'AUTO_CLOSED';

interface AttendanceRecord {
  id: string;
  workDate: string;
  status: AttendanceStatus;
  clockInTime: string | null;
  clockOutTime: string | null;
  durationMinutes: number | null;
  varianceMinutes: number | null;
  clockInMethod?: string | null;
  clockOutMethod?: string | null;
}

export default function EmployeeSelfService() {
  const params = useParams();
  const { data: session } = useSession();
  const businessId = (params?.id as string) || '';
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[HR/me] Component mounted/updated:', { businessId, hasSession: !!session, pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR' });
  }
  
  const { businessTier } = useBusinessConfiguration();
  const hrFeatures = useHRFeatures(businessTier || undefined);
  const onboardingFeatureEnabled = Boolean(hrFeatures.onboarding?.enabled);
  
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [balance, setBalance] = useState<{ pto: number; sick: number; personal: number } | null>(null);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [showRequest, setShowRequest] = useState(false);
  const [reqForm, setReqForm] = useState<{ type: string; startDate: string; endDate: string; reason: string }>({ type: '', startDate: '', endDate: '', reason: '' });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [punching, setPunching] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingJourneys, setOnboardingJourneys] = useState<EmployeeOnboardingJourney[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const clockInOutEnabled = Boolean(hrFeatures.attendance?.clockInOut);
  const activeAttendanceRecord = useMemo(
    () => attendanceRecords.find((record) => record.status === 'IN_PROGRESS') ?? null,
    [attendanceRecords]
  );
  const recentAttendanceRecords = useMemo(
    () => attendanceRecords.slice(0, 5),
    [attendanceRecords]
  );
  
  const fetchAttendanceRecords = useCallback(async () => {
    if (!businessId) {
      return;
    }
    try {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const params = new URLSearchParams({
        businessId,
        limit: '20'
      });
      const res = await fetch(`/api/hr/me/attendance/records?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setAttendanceRecords([]);
          setAttendanceError('Attendance records are not available with your current subscription tier.');
          return;
        }
        throw new Error(`Failed to load attendance records (${res.status})`);
      }
      const data = await res.json();
      setAttendanceRecords(Array.isArray(data.records) ? data.records : []);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load attendance records';
      setAttendanceError(errorMsg);
    } finally {
      setAttendanceLoading(false);
    }
  }, [businessId]);

  const fetchOnboardingJourneys = useCallback(async () => {
    if (!businessId || !onboardingFeatureEnabled) {
      return;
    }
    try {
      setOnboardingLoading(true);
      setOnboardingError(null);
      const data = await getMyOnboardingJourneys(businessId);
      setOnboardingJourneys(Array.isArray(data.journeys) ? data.journeys : []);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to load onboarding information';
      setOnboardingError(errorMsg);
    } finally {
      setOnboardingLoading(false);
    }
  }, [businessId, onboardingFeatureEnabled]);

  const handlePunch = useCallback(
    async (action: 'in' | 'out') => {
      if (!businessId) {
        toast.error('Business ID is required to record attendance.');
        return;
      }

      if (!clockInOutEnabled) {
        toast.error('Clock in/out is available on the Enterprise tier.');
        return;
      }

      try {
        setPunching(true);
        const endpoint =
          action === 'in'
            ? `/api/hr/me/attendance/punch-in?businessId=${encodeURIComponent(businessId)}`
            : `/api/hr/me/attendance/punch-out?businessId=${encodeURIComponent(businessId)}`;

        const body: Record<string, unknown> = {
          method: 'WEB'
        };

        if (action === 'out' && activeAttendanceRecord?.id) {
          body.recordId = activeAttendanceRecord.id;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to clock ${action === 'in' ? 'in' : 'out'}`);
        }

        await fetchAttendanceRecords();
        toast.success(action === 'in' ? 'Clock-in recorded' : 'Clock-out recorded');
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to update attendance';
        setAttendanceError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setPunching(false);
      }
    },
    [businessId, clockInOutEnabled, activeAttendanceRecord, fetchAttendanceRecords]
  );

  const handleCompleteOnboardingTask = useCallback(
    async (
      taskId: string,
      payload: { status?: OnboardingTaskStatus; notes?: string; metadata?: Record<string, unknown> }
    ) => {
      if (!businessId) {
        toast.error('Business ID is required to update onboarding tasks.');
        return;
      }

      setCompletingTaskId(taskId);
      try {
        await completeMyOnboardingTask(businessId, taskId, payload);
        toast.success('Task completed');
        await fetchOnboardingJourneys();
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to complete onboarding task';
        toast.error(errorMsg);
        throw error; // Re-throw so modal can handle it
      } finally {
        setCompletingTaskId(null);
      }
    },
    [businessId, fetchOnboardingJourneys]
  );
  
  useEffect(() => {
    // Load profile + balance + my requests
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const isDev = process.env.NODE_ENV === 'development';
        
        if (isDev) {
          console.log('[HR/me] Loading employee data for businessId:', businessId);
        }
        
        const [profileRes, balanceRes, requestsRes] = await Promise.all([
          fetch(`/api/hr/me?businessId=${encodeURIComponent(businessId)}`),
          fetch(`/api/hr/me/time-off/balance?businessId=${encodeURIComponent(businessId)}`),
          fetch(`/api/hr/me/time-off/requests?businessId=${encodeURIComponent(businessId)}`)
        ]);
        
        if (isDev) {
          console.log('[HR/me] API responses:', {
            profile: { status: profileRes.status, ok: profileRes.ok },
            balance: { status: balanceRes.status, ok: balanceRes.ok },
            requests: { status: requestsRes.status, ok: requestsRes.ok }
          });
        }
        
        if (!profileRes.ok) {
          const errorText = await profileRes.text();
          console.error('[HR/me] Profile API error:', profileRes.status, errorText);
          throw new Error(`Failed to load profile (${profileRes.status}): ${errorText}`);
        }
        
        const profileJson = await profileRes.json();
        if (isDev) {
          console.log('[HR/me] Profile data received:', profileJson);
        }
        
        const resolvedUser = {
          name: session?.user?.name || 'Employee',
          email: session?.user?.email ?? 'employee@example.com'
        };
        const fallbackPosition = { title: 'Software Engineer', department: { name: 'Engineering' } };
        const resolvedPosition =
          profileJson.employee?.position && typeof profileJson.employee.position === 'object'
            ? profileJson.employee.position
            : fallbackPosition;

        setEmployeeData({
          id: profileJson.employee?.id || '1',
          user: resolvedUser,
          position: resolvedPosition,
          hrProfile: profileJson.employee?.hrProfile || { hireDate: '2024-01-15', employeeType: 'FULL_TIME' }
        });
        
        if (balanceRes.ok) {
          const balJson = await balanceRes.json();
          setBalance(balJson.balance);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[HR/me] Balance API failed:', balanceRes.status);
          }
          setBalance({ pto: 0, sick: 0, personal: 0 });
        }
        
        if (requestsRes.ok) {
          const rjson = await requestsRes.json();
          setRequests(rjson.requests || []);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[HR/me] Requests API failed:', requestsRes.status);
          }
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to load';
        console.error('[HR/me] Load error:', errorMsg, e);
        setError(errorMsg);
        await fetchAttendanceRecords();
      } finally {
        setLoading(false);
      }
    };
    if (businessId) {
      load();
    } else {
      console.warn('[HR/me] No businessId provided');
      setError('Business ID is required');
      setLoading(false);
    }
  }, [businessId, session, fetchAttendanceRecords]);

  useEffect(() => {
    if (onboardingFeatureEnabled) {
      void fetchOnboardingJourneys();
    } else {
      setOnboardingJourneys([]);
    }
  }, [onboardingFeatureEnabled, fetchOnboardingJourneys]);
  
  const submitRequest = async () => {
    if (!reqForm.type || !reqForm.startDate || !reqForm.endDate) {
      setValidationError('Please fill in all required fields (Type, Start Date, End Date)');
      toast.error('Please fill in all required fields');
      return;
    }
    if (new Date(reqForm.endDate) < new Date(reqForm.startDate)) {
      setValidationError('End date must be after start date');
      toast.error('End date must be after start date');
      return;
    }
    
    setSubmittingRequest(true);
    setValidationError(null);
    try {
      const res = await fetch(`/api/hr/me/time-off/request?businessId=${encodeURIComponent(businessId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reqForm.type, startDate: reqForm.startDate, endDate: reqForm.endDate, reason: reqForm.reason })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to submit request' }));
        
        // Handle validation errors with detailed messages
        if (res.status === 400 && errorData.error) {
          setValidationError(errorData.error);
          if (errorData.balance) {
            setValidationError(`${errorData.error}\nAvailable: ${errorData.balance.available} days, Requested: ${errorData.balance.requested} days`);
          }
          toast.error(errorData.error);
          return;
        }
        
        throw new Error(errorData.error || `Request failed (${res.status})`);
      }
      
      const data = await res.json();
      setRequests((prev) => [
        { id: data.request.id, type: data.request.type, startDate: data.request.startDate, endDate: data.request.endDate, status: data.request.status, requestedAt: data.request.requestedAt },
        ...prev
      ]);
      setShowRequest(false);
      setReqForm({ type: '', startDate: '', endDate: '', reason: '' });
      setValidationError(null);
      
      // Reload balance to reflect new request
      const balanceRes = await fetch(`/api/hr/me/time-off/balance?businessId=${encodeURIComponent(businessId)}`);
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData.balance);
      }
      
      toast.success('Time-off request submitted successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit request';
      setValidationError(errorMsg);
      toast.error(errorMsg);
      console.error('[HR/me] Request submission error:', err);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this time-off request?')) {
      return;
    }
    
    setCanceling(requestId);
    try {
      const res = await fetch(`/api/hr/me/time-off/${encodeURIComponent(requestId)}/cancel?businessId=${encodeURIComponent(businessId)}`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to cancel request' }));
        throw new Error(errorData.error || `Cancel failed (${res.status})`);
      }
      
      // Update request status
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'CANCELED' } : r));
      
      // Reload balance
      const balanceRes = await fetch(`/api/hr/me/time-off/balance?businessId=${encodeURIComponent(businessId)}`);
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData.balance);
      }
      
      toast.success('Time-off request canceled');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to cancel request';
      toast.error(errorMsg);
      console.error('[HR/me] Cancel error:', err);
    } finally {
      setCanceling(null);
    }
  };
  
  if (loading) {
    return (
      <HRPageLayout businessId={businessId} currentView="my-profile">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </HRPageLayout>
    );
  }

  if (error) {
    return (
      <HRPageLayout businessId={businessId} currentView="my-profile">
        <div className="p-6">
          <Alert type="error" title="Error Loading HR Data">
            {error}
          </Alert>
        </div>
      </HRPageLayout>
    );
  }
  
  if (!hrFeatures.hasHRAccess) {
    return (
      <HRPageLayout businessId={businessId} currentView="my-profile">
        <div className="p-6">
          <Alert type="warning" title="HR Self-Service Not Available">
            Your company needs Business Advanced or Enterprise tier to access HR features.
          </Alert>
        </div>
      </HRPageLayout>
    );
  }
  
  return (
    <HRPageLayout businessId={businessId} currentView="my-profile">
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My HR</h1>
        <p className="text-gray-600 mt-2">
          View and manage your employee information
        </p>
      </div>
      
      {/* Employee Profile Card */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">My Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Name</label>
            <p className="font-medium">{employeeData?.user.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <p className="font-medium">{employeeData?.user.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Position</label>
            <p className="font-medium">{employeeData?.position.title}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Department</label>
            <p className="font-medium">{employeeData?.position.department?.name || 'N/A'}</p>
          </div>
          {employeeData?.hrProfile?.hireDate && (
            <div>
              <label className="text-sm text-gray-600">Hire Date</label>
              <p className="font-medium">
                {new Date(employeeData.hrProfile.hireDate).toLocaleDateString()}
              </p>
            </div>
          )}
          {employeeData?.hrProfile?.employeeType && (
            <div>
              <label className="text-sm text-gray-600">Employment Type</label>
              <p className="font-medium">
                {employeeData.hrProfile.employeeType.replace('_', ' ')}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {onboardingFeatureEnabled && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Onboarding</h2>
              <p className="text-sm text-gray-600">
                Track your onboarding tasks and milestones.
              </p>
            </div>
            {onboardingLoading && <Spinner size={20} />}
          </div>
          {onboardingError ? (
            <Alert type="error" title="Unable to load onboarding">
              {onboardingError}
            </Alert>
          ) : onboardingLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size={28} />
            </div>
          ) : onboardingJourneys.length === 0 ? (
            <EmptyState
              icon="🚀"
              title="No onboarding journeys"
              description="Once HR assigns an onboarding plan, it will appear here."
            />
          ) : (
            <div className="space-y-6">
              {onboardingJourneys.map((journey) => (
                <EmployeeOnboardingJourneyView
                  key={journey.id}
                  journey={journey}
                  businessId={businessId}
                  onTaskComplete={handleCompleteOnboardingTask}
                  completingTaskId={completingTaskId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Self-Service Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance */}
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-3xl">⏱️</div>
              <h3 className="text-lg font-semibold">Attendance</h3>
            </div>
            {clockInOutEnabled ? (
              <button
                onClick={() => handlePunch(activeAttendanceRecord ? 'out' : 'in')}
                disabled={punching}
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {punching
                  ? 'Saving...'
                  : activeAttendanceRecord
                  ? 'Clock Out'
                  : 'Clock In'}
              </button>
            ) : (
              <span className="text-xs text-gray-500">
                Clock in/out available on Enterprise
              </span>
            )}
          </div>
          {attendanceError && (
            <Alert type="warning" title="Attendance Notice">
              {attendanceError}
            </Alert>
          )}
          {attendanceLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size={24} />
            </div>
          ) : recentAttendanceRecords.length === 0 ? (
            <div className="py-4">
              <EmptyState
                icon="🕒"
                title="No attendance activity yet"
                description={
                  clockInOutEnabled
                    ? 'Your clock-in history will appear here once you start tracking attendance.'
                    : 'Upgrade to Enterprise to enable clock in/out tracking.'
                }
              />
            </div>
          ) : (
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-3">Date</div>
                <div className="col-span-2">Clock In</div>
                <div className="col-span-2">Clock Out</div>
                <div className="col-span-2">Duration</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Notes</div>
              </div>
              {recentAttendanceRecords.map((record) => {
                const badge = getAttendanceStatusBadge(record.status);
                return (
                  <div key={record.id} className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center">
                    <div className="col-span-3">
                      {new Date(record.workDate).toLocaleDateString()}
                    </div>
                    <div className="col-span-2">{formatAttendanceTime(record.clockInTime)}</div>
                    <div className="col-span-2">{formatAttendanceTime(record.clockOutTime)}</div>
                    <div className="col-span-2">{formatAttendanceDuration(record.durationMinutes)}</div>
                    <div className="col-span-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="col-span-1 text-right text-xs text-gray-500">
                      {record.clockInMethod || record.clockOutMethod
                        ? record.clockOutMethod || record.clockInMethod
                        : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {activeAttendanceRecord && clockInOutEnabled && (
            <div className="mt-3 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
              You clocked in at {formatAttendanceTime(activeAttendanceRecord.clockInTime)} and
              haven&apos;t clocked out yet.
            </div>
          )}
        </div>

        {/* Time Off */}
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🏖️</div>
              <h3 className="text-lg font-semibold">Time Off</h3>
            </div>
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setShowRequest(true)}>New Request</button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
            <div className="border rounded p-3">
              <div className="text-gray-500">PTO Remaining</div>
              <div className="text-xl font-semibold">{balance?.pto ?? 0}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Sick</div>
              <div className="text-xl font-semibold">{balance?.sick ?? 0}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Personal</div>
              <div className="text-xl font-semibold">{balance?.personal ?? 0}</div>
            </div>
          </div>
          <div className="border rounded">
            <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
              <div className="col-span-3">Type</div>
              <div className="col-span-4">Dates</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-2">Submitted</div>
            </div>
            {requests.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon="📅"
                  title="No Time-Off Requests"
                  description="You haven't submitted any time-off requests yet. Click 'New Request' to get started."
                />
              </div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center">
                  <div className="col-span-2">{r.type}</div>
                  <div className="col-span-4">{new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}</div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      r.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      r.status === 'DENIED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-gray-500">{new Date(r.requestedAt).toLocaleDateString()}</div>
                  <div className="col-span-2 text-right">
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancelRequest(r.id)}
                        disabled={canceling === r.id}
                        className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
                      >
                        {canceling === r.id ? 'Canceling...' : 'Cancel'}
                      </button>
                    )}
                    {r.managerNote && (
                      <div className="text-xs text-gray-500 mt-1" title={r.managerNote}>
                        Note: {r.managerNote.substring(0, 20)}...
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Pay Stubs */}
        <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="text-3xl mb-3">💵</div>
          <h3 className="text-lg font-semibold mb-2">Pay Stubs</h3>
          <p className="text-gray-600 text-sm mb-4">
            View your pay history and download pay stubs
          </p>
          <p className="text-sm text-gray-500">
            Feature coming soon
          </p>
        </div>
        
        {/* Benefits */}
        <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="text-3xl mb-3">🏥</div>
          <h3 className="text-lg font-semibold mb-2">My Benefits</h3>
          <p className="text-gray-600 text-sm mb-4">
            View and manage your benefits enrollment
          </p>
          <p className="text-sm text-gray-500">
            Feature coming soon
          </p>
        </div>
        
        {/* Performance */}
        <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="text-3xl mb-3">⭐</div>
          <h3 className="text-lg font-semibold mb-2">My Reviews</h3>
          <p className="text-gray-600 text-sm mb-4">
            View your performance reviews and goals
          </p>
          <p className="text-sm text-gray-500">
            Feature coming soon
          </p>
        </div>
      </div>

      {showRequest && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-5">
            <div className="text-lg font-semibold mb-3">New Time-Off Request</div>
            
            {validationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <div className="text-sm text-red-700 whitespace-pre-line">{validationError}</div>
              </div>
            )}
            
            <div className="grid gap-3">
              <div>
                <label className="block text-sm mb-1">Type</label>
                <select className="w-full border rounded px-3 py-2" value={reqForm.type} onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="">Select…</option>
                  <option value={TimeOffType.PTO}>PTO</option>
                  <option value={TimeOffType.SICK}>Sick</option>
                  <option value={TimeOffType.PERSONAL}>Personal</option>
                  <option value={TimeOffType.UNPAID}>Unpaid</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Start Date</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={reqForm.startDate} onChange={(e) => setReqForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">End Date</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={reqForm.endDate} onChange={(e) => setReqForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Reason (optional)</label>
                <textarea className="w-full border rounded px-3 py-2" rows={3} value={reqForm.reason} onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button 
                className="px-4 py-2 border rounded disabled:opacity-50" 
                onClick={() => {
                  setShowRequest(false);
                  setValidationError(null);
                  setReqForm({ type: '', startDate: '', endDate: '', reason: '' });
                }}
                disabled={submittingRequest}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 flex items-center gap-2" 
                onClick={submitRequest}
                disabled={submittingRequest}
              >
                {submittingRequest && <Spinner size={16} />}
                {submittingRequest ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </HRPageLayout>
  );
}

function formatAttendanceTime(value: string | null) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatAttendanceDuration(minutes: number | null) {
  if (minutes == null || Number.isNaN(minutes)) {
    return '—';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

function getAttendanceStatusBadge(
  status: AttendanceStatus
): { label: string; className: string } {
  switch (status) {
    case 'IN_PROGRESS':
      return { label: 'In Progress', className: 'bg-blue-100 text-blue-700' };
    case 'COMPLETED':
      return { label: 'Completed', className: 'bg-green-100 text-green-700' };
    case 'EXCEPTION':
      return { label: 'Exception', className: 'bg-yellow-100 text-yellow-700' };
    case 'AUTO_CLOSED':
      return { label: 'Auto Closed', className: 'bg-gray-100 text-gray-700' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-700' };
  }
}

