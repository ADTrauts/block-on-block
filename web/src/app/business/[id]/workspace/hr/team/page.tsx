/**
 * Manager Team HR Page
 * 
 * Manager view of team HR data
 * Access: Managers with direct reports only
 * Location: /business/[id]/workspace/hr/team
 * 
 * Framework: Displays team member information
 * Features will be implemented incrementally
 */

'use client';

import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useHRFeatures } from '@/hooks/useHRFeatures';
import { useBusinessConfiguration } from '@/contexts/BusinessConfigurationContext';
import { Spinner, Alert, EmptyState, Badge } from 'shared/components';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import HRPageLayout from '@/components/hr/HRPageLayout';
import {
  completeTeamOnboardingTask,
  getTeamOnboardingTasks,
  type TeamOnboardingTask,
  type OnboardingTaskStatus,
} from '@/api/hrOnboarding';
import ManagerOnboardingDashboard from '@/components/hr/onboarding/ManagerOnboardingDashboard';
import TeamOnboardingTaskList from '@/components/hr/onboarding/TeamOnboardingTaskList';

interface TeamMember {
  id: string;
  user: {
    name: string;
    email: string;
    image?: string;
  };
  position: {
    title: string;
  };
}

type PendingRequest = {
  id: string;
  employeePosition: {
    user: { name?: string | null; email: string };
    position: { 
      title: string;
      department?: { name: string } | null;
    };
  };
  type: string;
  startDate: string;
  endDate: string;
  requestedAt: string;
  reason?: string;
};

type AttendanceExceptionStatusType = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

interface TeamAttendanceException {
  id: string;
  type: string;
  status: AttendanceExceptionStatusType;
  detectedAt: string;
  detectedSource?: string | null;
  managerNote?: string | null;
  resolutionNote?: string | null;
  employeePosition: {
    user: { name?: string | null; email: string };
    position: {
      title: string;
      department?: { name?: string | null } | null;
    };
  };
  attendanceRecord?: {
    id: string;
    clockInTime?: string | null;
    clockOutTime?: string | null;
  } | null;
  policy?: {
    id: string;
    name: string;
  } | null;
}

export default function ManagerTeamView() {
  const params = useParams();
  const { data: session } = useSession();
  const businessId = (params?.id as string) || '';
  
  const { businessTier } = useBusinessConfiguration();
  const hrFeatures = useHRFeatures(businessTier || undefined);
  const onboardingManagerFeatureEnabled = Boolean(hrFeatures.onboarding?.enabled);
  
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hasDirectReports, setHasDirectReports] = useState(false);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [exceptions, setExceptions] = useState<TeamAttendanceException[]>([]);
  const [exceptionsMeta, setExceptionsMeta] = useState({ total: 0, page: 1, pageSize: 20 });
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptionNotes, setExceptionNotes] = useState<Record<string, string>>({});
  const [exceptionAction, setExceptionAction] = useState<string | null>(null);
  const [onboardingTasksLoading, setOnboardingTasksLoading] = useState(false);
  const [onboardingTasksError, setOnboardingTasksError] = useState<string | null>(null);
  const [onboardingTasks, setOnboardingTasks] = useState<TeamOnboardingTask[]>([]);
  const [completingOnboardingTaskId, setCompletingOnboardingTaskId] = useState<string | null>(null);
  const openExceptionCount = exceptionsMeta.total;

  const fetchOnboardingTasks = useCallback(async () => {
    if (!businessId || !onboardingManagerFeatureEnabled) {
      return;
    }
    try {
      setOnboardingTasksLoading(true);
      setOnboardingTasksError(null);
      const data = await getTeamOnboardingTasks(businessId);
      setOnboardingTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load onboarding tasks';
      setOnboardingTasksError(message);
      setOnboardingTasks([]);
    } finally {
      setOnboardingTasksLoading(false);
    }
  }, [businessId, onboardingManagerFeatureEnabled]);
  
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Load team members
        const teamRes = await fetch(`/api/hr/team/employees?businessId=${encodeURIComponent(businessId)}`);
        if (teamRes.ok) {
          const teamJson = await teamRes.json();
          setTeamMembers(teamJson.employees || []);
          setHasDirectReports((teamJson.employees || []).length > 0);
        } else {
          setHasDirectReports(false);
        }
        // Load pending approvals
        const penRes = await fetch(`/api/hr/team/time-off/pending?businessId=${encodeURIComponent(businessId)}`);
        if (penRes.ok) {
          const pjson = await penRes.json();
          setPending(pjson.requests || []);
        }

        try {
          setExceptionsLoading(true);
          setExceptionError(null);
          const excRes = await fetch(
            `/api/hr/team/attendance/exceptions?businessId=${encodeURIComponent(businessId)}`
          );
          if (!excRes.ok) {
            const errJson = await excRes.json().catch(() => ({}));
            throw new Error(errJson.error || 'Failed to load attendance exceptions');
          }
          const excJson = await excRes.json();
          setExceptions(excJson.exceptions || []);
          setExceptionsMeta({
            total: excJson.total ?? (excJson.exceptions ? excJson.exceptions.length : 0),
            page: excJson.page ?? 1,
            pageSize: excJson.pageSize ?? 20
          });
        } catch (excError) {
          const message =
            excError instanceof Error ? excError.message : 'Failed to load attendance exceptions';
          setExceptionError(message);
          setExceptions([]);
          setExceptionsMeta({ total: 0, page: 1, pageSize: 20 });
        } finally {
          setExceptionsLoading(false);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    if (businessId) load();
  }, [businessId, session]);

  useEffect(() => {
    if (onboardingManagerFeatureEnabled) {
      void fetchOnboardingTasks();
    } else {
      setOnboardingTasks([]);
    }
  }, [onboardingManagerFeatureEnabled, fetchOnboardingTasks]);

  const actOn = async (id: string, decision: 'APPROVE' | 'DENY') => {
    setApproving(id);
    try {
      const res = await fetch(`/api/hr/team/time-off/${encodeURIComponent(id)}/approve?businessId=${encodeURIComponent(businessId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: note[id] || undefined })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Action failed' }));
        throw new Error(errorData.error || `Failed to ${decision.toLowerCase()} request`);
      }
      
      setPending((prev) => prev.filter((r) => r.id !== id));
      toast.success(`Request ${decision === 'APPROVE' ? 'approved' : 'denied'} successfully`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Action failed';
      toast.error(errorMsg);
      console.error('[HR/team] Approval error:', err);
    } finally {
      setApproving(null);
    }
  };

  const handleExceptionAction = async (
    id: string,
    status: AttendanceExceptionStatusType
  ) => {
    setExceptionAction(`${id}:${status}`);
    try {
      const payload: Record<string, unknown> = { status };
      const noteValue = exceptionNotes[id]?.trim();

      if (noteValue) {
        if (status === 'UNDER_REVIEW') {
          payload.managerNote = noteValue;
        } else {
          payload.resolutionNote = noteValue;
        }
      }

      const res = await fetch(
        `/api/hr/team/attendance/exceptions/${encodeURIComponent(id)}/resolve?businessId=${encodeURIComponent(
          businessId
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update attendance exception');
      }

      const data = await res.json();
      const updated: TeamAttendanceException | undefined = data.exception;

      setExceptions((prev) => {
        if (!updated) {
          return prev.filter((item) => item.id !== id);
        }

        if (updated.status === 'RESOLVED' || updated.status === 'DISMISSED') {
          return prev.filter((item) => item.id !== id);
        }

        return prev.map((item) => (item.id === id ? updated : item));
      });

      setExceptionNotes((prev) => {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      });

      if (updated?.status === 'RESOLVED' || updated?.status === 'DISMISSED') {
        setExceptionsMeta((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1)
        }));
        toast.success('Attendance exception resolved.');
      } else if (updated?.status === 'UNDER_REVIEW') {
        toast.success('Attendance exception marked as under review.');
      } else {
        toast.success('Attendance exception updated.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update attendance exception';
      toast.error(message);
      console.error('[HR/team] Attendance exception error:', err);
    } finally {
      setExceptionAction(null);
    }
  };

  const handleCompleteOnboardingTask = useCallback(
    async (
      taskId: string,
      payload: { approved?: boolean; notes?: string; status?: OnboardingTaskStatus }
    ) => {
      if (!businessId) {
        toast.error('Business ID is required to update onboarding tasks.');
        return;
      }

      setCompletingOnboardingTaskId(taskId);
      try {
        await completeTeamOnboardingTask(businessId, taskId, {
          status: payload.status || 'COMPLETED',
          approved: payload.approved,
          notes: payload.notes,
        });
        toast.success(payload.approved === false ? 'Task rejected' : 'Task completed');
        await fetchOnboardingTasks();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update onboarding task';
        toast.error(message);
        throw error; // Re-throw so modal can handle it
      } finally {
        setCompletingOnboardingTaskId(null);
      }
    },
    [businessId, fetchOnboardingTasks]
  );
  
  if (loading) {
    return (
      <HRPageLayout businessId={businessId} currentView="team">
        <div className="p-6">
          <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
      </HRPageLayout>
    );
  }

  if (error) {
    return (
      <HRPageLayout businessId={businessId} currentView="team">
        <div className="p-6">
          <Alert type="error" title="Error Loading Team Data">
            {error}
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  if (!hrFeatures.hasHRAccess) {
    return (
      <HRPageLayout businessId={businessId} currentView="team">
        <div className="p-6">
          <Alert type="warning" title="Team HR Not Available">
            Your company needs Business Advanced or Enterprise tier to access HR features.
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  if (!hasDirectReports) {
    return (
      <HRPageLayout businessId={businessId} currentView="team">
        <div className="p-6">
          <EmptyState
            icon="👥"
            title="No Team Members"
            description="You don&apos;t have any direct reports. Team HR features are available when you manage a team."
          />
          <div className="mt-6 text-center">
            <Link 
              href={`/business/${businessId}/workspace`}
              className="text-blue-600 hover:underline"
            >
              ← Back to Workspace
            </Link>
          </div>
        </div>
      </HRPageLayout>
    );
  }
  
  return (
    <HRPageLayout businessId={businessId} currentView="team">
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Team HR</h1>
        <p className="text-gray-600 mt-2">
          Manage your team&apos;s HR information and approvals
        </p>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Team Members</div>
          <div className="text-2xl font-bold">{teamMembers.length}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Pending Approvals</div>
          <div className="text-2xl font-bold">{pending.length}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Out Today</div>
          <div className="text-2xl font-bold">0</div>
          <div className="text-xs text-gray-500 mt-1">Coming later</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Open Attendance Exceptions</div>
          <div className="text-2xl font-bold">{openExceptionCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            Exceptions flagged for your review
          </div>
        </div>
      </div>
      
      {/* Team Management Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {onboardingManagerFeatureEnabled && (
          <div className="border rounded-lg p-6 bg-white md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Team Onboarding</h3>
                <p className="text-sm text-gray-600">
                  Review and approve onboarding tasks for your team members.
                </p>
              </div>
              {onboardingTasksLoading && <Spinner size={20} />}
            </div>
            {onboardingTasksError ? (
              <Alert type="error" title="Unable to load onboarding tasks">
                {onboardingTasksError}
              </Alert>
            ) : onboardingTasksLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner size={28} />
              </div>
            ) : onboardingTasks.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No pending onboarding tasks"
                description="You have reviewed all onboarding tasks for your team."
              />
            ) : (
              <div className="space-y-6">
                <ManagerOnboardingDashboard
                  tasks={onboardingTasks}
                  teamMemberCount={teamMembers.length}
                />
                <TeamOnboardingTaskList
                  tasks={onboardingTasks}
                  businessId={businessId}
                  onTaskComplete={handleCompleteOnboardingTask}
                  completingTaskId={completingOnboardingTaskId}
                />
              </div>
            )}
          </div>
        )}

        {/* Team Members */}
        <div className="border rounded-lg p-6 bg-white">
          <div className="text-3xl mb-3">👥</div>
          <h3 className="text-lg font-semibold mb-2">Team Members</h3>
          {teamMembers.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No Team Members"
              description="You don&apos;t have any direct reports assigned yet."
            />
          ) : (
            <div className="divide-y">
              {teamMembers.map((m) => (
                <div key={m.id} className="py-2 text-sm">
                  <div className="font-medium">{m.user?.name || m.user?.email}</div>
                  <div className="text-gray-500">{m.position?.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Time-Off Approvals */}
        <div className="border rounded-lg p-6 bg-white">
          <div className="text-3xl mb-3">✅</div>
          <h3 className="text-lg font-semibold mb-2">Time-Off Approvals</h3>
          {pending.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="✅"
                title="All Caught Up!"
                description="No pending time-off requests. Your team's requests will appear here when submitted."
              />
            </div>
          ) : (
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-3">Employee</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-3">Dates</div>
                <div className="col-span-2">Submitted</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {pending.map((r) => {
                const start = new Date(r.startDate);
                const end = new Date(r.endDate);
                const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
                
                return (
                  <div key={r.id} className="border-t">
                    <div className="grid grid-cols-12 px-3 py-3 text-sm items-start">
                      <div className="col-span-3">
                        <div className="font-medium">{r.employeePosition.user?.name || r.employeePosition.user.email}</div>
                        <div className="text-gray-500 text-xs">{r.employeePosition.position.title}</div>
                        {r.employeePosition.position?.department && (
                          <div className="text-gray-400 text-xs">{r.employeePosition.position.department.name}</div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{r.type}</span>
                        <div className="text-xs text-gray-500 mt-1">{days} day{days !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="col-span-3">
                        <div>{start.toLocaleDateString()} → {end.toLocaleDateString()}</div>
                        {r.reason && (
                          <div className="text-xs text-gray-500 mt-1" title={r.reason}>
                            {r.reason.length > 30 ? `${r.reason.substring(0, 30)}...` : r.reason}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-gray-500 text-xs">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </div>
                      <div className="col-span-2 flex gap-2 justify-end">
                        <button
                          onClick={() => actOn(r.id, 'APPROVE')}
                          disabled={approving === r.id}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {approving === r.id ? <Spinner size={12} /> : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => actOn(r.id, 'DENY')}
                          disabled={approving === r.id}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {approving === r.id ? <Spinner size={12} /> : '✗ Deny'}
                        </button>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <textarea
                        placeholder="Add a note (optional)"
                        value={note[r.id] || ''}
                        onChange={(e) => setNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-xs"
                        rows={2}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance Exceptions */}
        <div className="border rounded-lg p-6 bg-white">
          <div className="text-3xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Attendance Exceptions</h3>
          {exceptionsLoading ? (
            <div className="flex justify-center items-center py-8">
              <Spinner size={24} />
            </div>
          ) : exceptionError ? (
            <Alert type="warning" title="Unable to load attendance exceptions">
              {exceptionError}
            </Alert>
          ) : exceptions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="✅"
                title="No open exceptions"
                description="Attendance exceptions that need review will appear here."
              />
            </div>
          ) : (
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-3">Employee</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Detected</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              {exceptions.map((exception) => {
                const detectedDate = new Date(exception.detectedAt);
                const noteValue = exceptionNotes[exception.id] || '';
                const actionKeyUnderReview = `${exception.id}:UNDER_REVIEW`;
                const actionKeyResolve = `${exception.id}:RESOLVED`;
                const actionKeyDismiss = `${exception.id}:DISMISSED`;
                return (
                  <div key={exception.id} className="border-t">
                    <div className="grid grid-cols-12 px-3 py-3 text-sm items-start gap-y-2">
                      <div className="col-span-3">
                        <div className="font-medium">
                          {exception.employeePosition.user?.name ||
                            exception.employeePosition.user.email}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {exception.employeePosition.position.title}
                        </div>
                        {exception.employeePosition.position?.department?.name && (
                          <div className="text-gray-400 text-xs">
                            {exception.employeePosition.position.department?.name}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs uppercase">
                          {exception.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="col-span-2 text-gray-500 text-xs">
                        {detectedDate.toLocaleString()}
                      </div>
                      <div className="col-span-2">
                        <Badge
                          color={
                            exception.status === 'UNDER_REVIEW'
                              ? 'yellow'
                              : exception.status === 'RESOLVED'
                              ? 'green'
                              : exception.status === 'DISMISSED'
                              ? 'gray'
                              : 'red'
                          }
                          size="sm"
                        >
                          {exception.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="col-span-3 flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => handleExceptionAction(exception.id, 'UNDER_REVIEW')}
                          disabled={exceptionAction === actionKeyUnderReview}
                          className="px-3 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1"
                        >
                          {exceptionAction === actionKeyUnderReview ? (
                            <Spinner size={12} />
                          ) : (
                            'Flag Review'
                          )}
                        </button>
                        <button
                          onClick={() => handleExceptionAction(exception.id, 'RESOLVED')}
                          disabled={exceptionAction === actionKeyResolve}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {exceptionAction === actionKeyResolve ? (
                            <Spinner size={12} />
                          ) : (
                            'Resolve'
                          )}
                        </button>
                        <button
                          onClick={() => handleExceptionAction(exception.id, 'DISMISSED')}
                          disabled={exceptionAction === actionKeyDismiss}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {exceptionAction === actionKeyDismiss ? (
                            <Spinner size={12} />
                          ) : (
                            'Dismiss'
                          )}
                        </button>
                      </div>
                      <div className="col-span-12">
                        <textarea
                          placeholder={
                            exception.status === 'UNDER_REVIEW'
                              ? 'Add a note for follow-up...'
                              : 'Add a resolution note...'
                          }
                          value={noteValue}
                          onChange={(e) =>
                            setExceptionNotes((prev) => ({
                              ...prev,
                              [exception.id]: e.target.value
                            }))
                          }
                          className="w-full border rounded px-2 py-1 text-xs"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Note about manager approvals */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Note for Managers</h3>
        <p className="text-sm text-blue-800">
          Your own time-off requests and HR actions require approval from your manager 
          (the position above you in the org chart). You cannot approve your own requests.
        </p>
      </div>
    </div>
    </HRPageLayout>
  );
}

