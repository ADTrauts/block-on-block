'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Spinner, Alert, EmptyState } from 'shared/components';
import { toast } from 'react-hot-toast';
import { useBusinessConfiguration } from '@/contexts/BusinessConfigurationContext';
import { useHRFeatures } from '@/hooks/useHRFeatures';
import HRPageLayout from '@/components/hr/HRPageLayout';

type AttendanceOverview = {
  activeEmployees: number;
  todaysRecords: number;
  openExceptions: number;
  inProgressCount: number;
};

type AttendancePolicy = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  timezone: string | null;
  roundingIncrementMinutes: number | null;
  gracePeriodMinutes: number | null;
  autoClockOutAfterMinutes: number | null;
  requireGeolocation: boolean;
  geofenceRadiusMeters: number | null;
  workingDays: string[];
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  createdAt?: string | null;
};

type AttendancePolicyForm = {
        name: string;
  description: string;
  timezone: string;
  roundingIncrementMinutes: string;
  gracePeriodMinutes: string;
  autoClockOutAfterMinutes: string;
  requireGeolocation: boolean;
  geofenceRadiusMeters: string;
  workingDays: string[];
  metadata: string;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  active: boolean;
};

type NumericFieldKey =
  | 'roundingIncrementMinutes'
  | 'gracePeriodMinutes'
  | 'autoClockOutAfterMinutes'
  | 'geofenceRadiusMeters';

const WEEKDAY_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Monday', value: 'MONDAY' },
  { label: 'Tuesday', value: 'TUESDAY' },
  { label: 'Wednesday', value: 'WEDNESDAY' },
  { label: 'Thursday', value: 'THURSDAY' },
  { label: 'Friday', value: 'FRIDAY' },
  { label: 'Saturday', value: 'SATURDAY' },
  { label: 'Sunday', value: 'SUNDAY' }
];

const DEFAULT_FORM: AttendancePolicyForm = {
  name: '',
  description: '',
  timezone: 'UTC',
  roundingIncrementMinutes: '',
  gracePeriodMinutes: '5',
  autoClockOutAfterMinutes: '',
  requireGeolocation: false,
  geofenceRadiusMeters: '',
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  metadata: '',
  isDefault: false,
  effectiveFrom: '',
  effectiveTo: '',
  active: true
};

const formatNumber = (value: number | null | undefined) =>
  typeof value === 'number' && !Number.isNaN(value) ? value.toString() : '';

const toForm = (policy: AttendancePolicy): AttendancePolicyForm => ({
  name: policy.name ?? '',
  description: policy.description ?? '',
  timezone: policy.timezone ?? 'UTC',
  roundingIncrementMinutes: formatNumber(policy.roundingIncrementMinutes),
  gracePeriodMinutes: formatNumber(policy.gracePeriodMinutes),
  autoClockOutAfterMinutes: formatNumber(policy.autoClockOutAfterMinutes),
  requireGeolocation: policy.requireGeolocation ?? false,
  geofenceRadiusMeters: formatNumber(policy.geofenceRadiusMeters),
  workingDays: policy.workingDays && policy.workingDays.length > 0
    ? policy.workingDays
    : DEFAULT_FORM.workingDays,
  metadata: policy.metadata ? JSON.stringify(policy.metadata, null, 2) : '',
  isDefault: policy.isDefault,
  effectiveFrom: policy.effectiveFrom ? policy.effectiveFrom.slice(0, 10) : '',
  effectiveTo: policy.effectiveTo ? policy.effectiveTo.slice(0, 10) : '',
  active: policy.active
});

const parseNumberField = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`"${value}" is not a valid number`);
  }
  return parsed;
};

export default function HRAttendancePage() {
  const params = useParams();
  const businessId = (params?.id as string) || '';
  const { businessTier } = useBusinessConfiguration();
  const hrFeatures = useHRFeatures(businessTier || undefined);

  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [activePolicyId, setActivePolicyId] = useState<string | null>(null);
  const [form, setForm] = useState<AttendancePolicyForm>(DEFAULT_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    const loadOverview = async () => {
      try {
        setOverviewLoading(true);
        setOverviewError(null);
        const res = await fetch(
          `/api/hr/admin/attendance/overview?businessId=${encodeURIComponent(businessId)}`
        );
        if (!res.ok) {
          throw new Error(`Failed to load attendance overview (${res.status})`);
        }
        const data = await res.json();
        setOverview(data.overview);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load overview';
        setOverviewError(message);
        toast.error(message);
      } finally {
        setOverviewLoading(false);
      }
    };

    const loadPolicies = async () => {
      try {
        setPoliciesLoading(true);
        setPoliciesError(null);
        const res = await fetch(
          `/api/hr/admin/attendance/policies?businessId=${encodeURIComponent(businessId)}`
        );
        if (!res.ok) {
          throw new Error(`Failed to load attendance policies (${res.status})`);
        }
        const data = await res.json();
        setPolicies(data.policies || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load policies';
        setPoliciesError(message);
        toast.error(message);
      } finally {
        setPoliciesLoading(false);
      }
    };

    loadOverview();
    loadPolicies();
  }, [businessId]);

  const defaultPolicy = useMemo(
    () => policies.find((policy) => policy.isDefault) ?? null,
    [policies]
  );

  const openCreateForm = () => {
    setForm(DEFAULT_FORM);
    setFormMode('create');
    setActivePolicyId(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (policy: AttendancePolicy) => {
    setForm(toForm(policy));
    setFormMode('edit');
    setActivePolicyId(policy.id);
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setFormError(null);
    setActivePolicyId(null);
    setForm(DEFAULT_FORM);
  };

  const handleWorkingDayToggle = (value: string) => {
    setForm((prev) => {
      const exists = prev.workingDays.includes(value);
      return {
        ...prev,
        workingDays: exists
          ? prev.workingDays.filter((day) => day !== value)
          : [...prev.workingDays, value]
      };
    });
  };

  const handleFormSubmit = async () => {
    if (!businessId) {
      toast.error('Business ID is required');
      return;
    }

    if (!form.name.trim()) {
      setFormError('Policy name is required');
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        timezone: form.timezone.trim() || null,
        requireGeolocation: form.requireGeolocation,
        workingDays: form.workingDays,
        isDefault: form.isDefault,
        active: form.active,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null
      };

      const numericFields: Array<{ formKey: NumericFieldKey; payloadKey: string }> = [
        { formKey: 'roundingIncrementMinutes', payloadKey: 'roundingIncrementMinutes' },
        { formKey: 'gracePeriodMinutes', payloadKey: 'gracePeriodMinutes' },
        { formKey: 'autoClockOutAfterMinutes', payloadKey: 'autoClockOutAfterMinutes' },
        { formKey: 'geofenceRadiusMeters', payloadKey: 'geofenceRadiusMeters' }
      ];

      numericFields.forEach(({ formKey, payloadKey }) => {
        const value = form[formKey];
        if (value.trim().length === 0) {
          payload[payloadKey] = null;
          return;
        }
        payload[payloadKey] = parseNumberField(value);
      });

      if (form.metadata.trim()) {
        try {
          payload.metadata = JSON.parse(form.metadata);
        } catch (error) {
          throw new Error('Metadata must be valid JSON');
        }
      }

      const endpoint =
        formMode === 'create'
          ? `/api/hr/admin/attendance/policies?businessId=${encodeURIComponent(businessId)}`
          : `/api/hr/admin/attendance/policies/${encodeURIComponent(
              activePolicyId ?? ''
            )}?businessId=${encodeURIComponent(businessId)}`;

      setFormSubmitting(true);
      setFormError(null);

      const res = await fetch(endpoint, {
        method: formMode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Unable to ${formMode === 'create' ? 'create' : 'update'} policy`);
      }

      const data = await res.json();
      toast.success(`Attendance policy ${formMode === 'create' ? 'created' : 'updated'} successfully`);

      if (formMode === 'create') {
        setPolicies((prev) => [data.policy, ...prev]);
      } else {
        setPolicies((prev) =>
          prev.map((policy) => (policy.id === data.policy.id ? data.policy : policy))
        );
      }

      closeForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save policy';
      setFormError(message);
      toast.error(message);
    } finally {
      setFormSubmitting(false);
    }
  };

  if (!businessId) {
    return (
      <div className="p-6">
        <Alert type="error" title="Business Not Found">
          A valid business identifier is required to view attendance settings.
        </Alert>
      </div>
    );
  }

  if (!hrFeatures.hasHRAccess) {
    return (
      <HRPageLayout businessId={businessId} currentView="attendance">
        <div className="p-6">
          <Alert type="warning" title="HR Module Not Installed">
            The HR module must be installed and the business tier upgraded to Business Advanced or
            Enterprise to access attendance settings.
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  if (!hrFeatures.attendance.enabled) {
    return (
      <HRPageLayout businessId={businessId} currentView="attendance">
        <div className="p-6">
          <Alert type="warning" title="Attendance Module Not Available">
            Attendance features are not included with the current subscription tier. Upgrade to
            Business Advanced or Enterprise to enable attendance tracking.
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  return (
    <HRPageLayout businessId={businessId} currentView="attendance">
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Attendance Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure attendance policies and monitor usage for your organization.
        </p>
      </div>

      {/* Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Today&apos;s Overview</h2>
          {overviewLoading && <Spinner size={20} />}
        </div>

        {overviewError ? (
          <Alert type="error" title="Unable to load attendance overview">
            {overviewError}
          </Alert>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <OverviewCard
              title="Active Employees"
              value={overview?.activeEmployees ?? 0}
              description="Employees assigned to active positions"
            />
            <OverviewCard
              title="Records Today"
              value={overview?.todaysRecords ?? 0}
              description="Attendance entries logged today"
            />
            <OverviewCard
              title="Open Exceptions"
              value={overview?.openExceptions ?? 0}
              description="Attendance exceptions requiring review"
            />
            <OverviewCard
              title="Currently Clocked In"
              value={overview?.inProgressCount ?? 0}
              description="Employees with in-progress shifts"
            />
          </div>
        )}
      </section>

      {/* Policy Management */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Attendance Policies</h2>
            <p className="text-gray-600 text-sm">
              Policies control how attendance is tracked, including grace periods and geolocation
              requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + New Policy
          </button>
        </div>
        
        {policiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={28} />
      </div>
        ) : policiesError ? (
          <Alert type="error" title="Unable to load policies">
            {policiesError}
          </Alert>
        ) : policies.length === 0 ? (
          <div className="border rounded-lg bg-white">
            <EmptyState
              icon="🗂️"
              title="No Attendance Policies"
              description="Create a policy to define how attendance is tracked for your organization."
            />
            </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Name</Th>
                  <Th>Timezone</Th>
                  <Th>Working Days</Th>
                  <Th>Grace Period</Th>
                  <Th>Auto Clock-Out</Th>
                  <Th>Status</Th>
                  <Th>Default</Th>
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-gray-50">
                    <Td>
                      <div className="font-medium text-gray-900">{policy.name}</div>
                      {policy.description && (
                        <div className="text-sm text-gray-500">{policy.description}</div>
                      )}
                    </Td>
                    <Td>{policy.timezone ?? 'UTC'}</Td>
                    <Td>
                      <span className="inline-flex flex-wrap gap-1">
                        {policy.workingDays?.length
                          ? policy.workingDays.map((day) => (
                              <span
                                key={day}
                                className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                              >
                                {day.slice(0, 3)}
                              </span>
                            ))
                          : '—'}
                      </span>
                    </Td>
                    <Td>
                      {policy.gracePeriodMinutes != null
                        ? `${policy.gracePeriodMinutes} min`
                        : '—'}
                    </Td>
                    <Td>
                      {policy.autoClockOutAfterMinutes != null
                        ? `${policy.autoClockOutAfterMinutes} min`
                        : '—'}
                    </Td>
                    <Td>
                      <StatusBadge active={policy.active}>
                        {policy.active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </Td>
                    <Td>
                      {policy.isDefault ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Default
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => openEditForm(policy)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                      >
                        Edit
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        )}

        {!hrFeatures.attendance.clockInOut && (
          <Alert type="info" title="Clock In/Out Limited">
            Clock in/out features are available on the Enterprise tier. Businesses on Business
            Advanced can still track time-off and attendance policies.
          </Alert>
        )}
      </section>

      {/* Drawer / Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {formMode === 'create' ? 'Create Attendance Policy' : 'Edit Attendance Policy'}
                </h3>
                <p className="text-sm text-gray-500">
                  Define how attendance should be tracked for this business.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
                </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
              {formError && (
                <Alert type="error" title="Unable to save policy">
                  {formError}
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Policy Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </Field>

                <Field label="Timezone">
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, timezone: event.target.value }))
                    }
                    className="w-full rounded border px-3 py-2"
                    placeholder="UTC"
                  />
                </Field>

                <Field label="Grace Period (minutes)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.gracePeriodMinutes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, gracePeriodMinutes: event.target.value }))
                    }
                    className="w-full rounded border px-3 py-2"
                    min={0}
                  />
                </Field>

                <Field label="Auto Clock-Out After (minutes)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.autoClockOutAfterMinutes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        autoClockOutAfterMinutes: event.target.value
                      }))
                    }
                    className="w-full rounded border px-3 py-2"
                    min={0}
                  />
                </Field>

                <Field label="Rounding Increment (minutes)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.roundingIncrementMinutes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        roundingIncrementMinutes: event.target.value
                      }))
                    }
                    className="w-full rounded border px-3 py-2"
                    min={0}
                  />
                </Field>

                <Field label="Geofence Radius (meters)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.geofenceRadiusMeters}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        geofenceRadiusMeters: event.target.value
                      }))
                    }
                    className="w-full rounded border px-3 py-2"
                    min={0}
                  />
                </Field>

                <Field label="Effective From">
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </Field>

                <Field label="Effective To">
                  <input
                    type="date"
                    value={form.effectiveTo}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, effectiveTo: event.target.value }))
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </Field>
                    </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                  rows={2}
                  placeholder="Optional details about this policy"
                />
              </Field>

              <Field label="Working Days">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {WEEKDAY_OPTIONS.map((day) => (
                    <label key={day.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.workingDays.includes(day.value)}
                        onChange={() => handleWorkingDayToggle(day.value)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.requireGeolocation}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        requireGeolocation: event.target.checked
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Require geolocation for clock-ins
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, isDefault: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Set as default policy
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, active: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Policy is active
                </label>
              </div>

              <Field label="Metadata (JSON)">
                <textarea
                  value={form.metadata}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, metadata: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  rows={4}
                  placeholder='{"notes":"additional policy metadata"}'
                />
              </Field>
      </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={formSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {formSubmitting ? (
                  <>
                    <Spinner size={18} />
                    Saving...
                  </>
                ) : (
                  'Save Policy'
                )}
              </button>
        </div>
        </div>
        </div>
      )}

      {/* Default Policy Summary */}
      {defaultPolicy && (
        <section className="rounded-lg border border-blue-100 bg-blue-50 px-6 py-4 text-sm text-blue-900">
          <h3 className="text-base font-semibold text-blue-900">Default Policy</h3>
          <p className="mt-1 text-blue-800">
            {defaultPolicy.name} is currently applied to employees without a specific policy
            assignment. Update the policy to change grace periods, auto clock-out, and other
            settings.
          </p>
        </section>
      )}
        </div>
    </HRPageLayout>
  );
}

function OverviewCard({
  title,
  value,
  description
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{description}</div>
    </div>
  );
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 ${className ?? ''}`.trim()}
    >
      {children ?? <span aria-hidden="true"> </span>}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 align-top text-sm text-gray-700 ${className ?? ''}`.trim()}>
      {children}
    </td>
  );
}

function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  );
}

