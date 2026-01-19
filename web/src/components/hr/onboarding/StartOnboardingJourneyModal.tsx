'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert } from 'shared/components';
import { startOnboardingJourney, listOnboardingTemplates, type OnboardingTemplate, type StartOnboardingJourneyInput } from '@/api/hrOnboarding';
import { toast } from 'react-hot-toast';

interface Employee {
  id: string; // employeePositionId
  user: { id: string; name: string | null; email: string };
  position: { title: string; department?: { name?: string | null } | null };
  hrProfile?: { id?: string; hireDate?: string | null; employeeType?: string | null } | null;
}

interface StartOnboardingJourneyModalProps {
  businessId: string;
  employees: Employee[];
  onJourneyStarted: () => void;
  onClose: () => void;
}

export default function StartOnboardingJourneyModal({
  businessId,
  employees,
  onJourneyStarted,
  onClose,
}: StartOnboardingJourneyModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const data = await listOnboardingTemplates(businessId);
        setTemplates(data.filter(t => t.isActive));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load templates';
        toast.error(message);
      } finally {
        setLoadingTemplates(false);
      }
    };

    if (businessId) {
      void loadTemplates();
    }
  }, [businessId]);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleSubmit = async () => {
    if (!selectedEmployeeId || !selectedTemplateId) {
      setError('Please select both an employee and a template');
      return;
    }

    const employee = selectedEmployee;
    if (!employee) {
      setError('Please select an employee');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Get HR profile ID - employees endpoint should include hrProfile
      // If not, we'll need to get it from the employee detail
      let hrProfileId: string | undefined = employee.hrProfile?.id;
      
      if (!hrProfileId) {
        // Try to get employee detail which should include hrProfile
        const detailRes = await fetch(`/api/hr/admin/employees/${encodeURIComponent(employee.id)}?businessId=${encodeURIComponent(businessId)}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          hrProfileId = detailData.employee?.hrProfile?.id;
        }
      }

      if (!hrProfileId) {
        // HR profile might not exist yet - the backend should handle this
        // For now, we'll show an error and ask admin to create profile first
        throw new Error('Employee does not have an HR profile. Please create an HR profile for this employee first in the Employees page.');
      }

      const payload: StartOnboardingJourneyInput = {
        employeeHrProfileId: hrProfileId,
        onboardingTemplateId: selectedTemplateId,
        startDate: new Date().toISOString(),
      };

      await startOnboardingJourney(businessId, payload);
      toast.success('Onboarding journey started successfully');
      onJourneyStarted();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start onboarding journey';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Start Onboarding Journey">
      <div className="space-y-4">
        {error && (
          <Alert type="error" title="Error">
            {error}
          </Alert>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Employee *
          </label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          >
            <option value="">Choose an employee...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.user.name || employee.user.email} - {employee.position.title}
                {employee.position.department?.name && ` (${employee.position.department.name})`}
              </option>
            ))}
          </select>
          {selectedEmployee && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedEmployee.hrProfile?.id 
                ? 'HR profile found. Journey can be started.'
                : 'HR profile will be created automatically if needed.'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Template *
          </label>
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size={20} />
            </div>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            >
              <option value="">Choose a template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault && ' (Default)'}
                  {template.description && ` - ${template.description}`}
                </option>
              ))}
            </select>
          )}
          {templates.length === 0 && !loadingTemplates && (
            <p className="text-xs text-gray-500 mt-1">
              No active templates found. Create a template first.
            </p>
          )}
        </div>

        {selectedTemplate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900 mb-1">Template Preview</p>
            <p className="text-xs text-blue-700">
              {selectedTemplate.taskTemplates?.length || 0} tasks will be created for this journey
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedEmployeeId || !selectedTemplateId}
          >
            {submitting ? (
              <>
                <span className="mr-2"><Spinner size={16} /></span>
                Starting...
              </>
            ) : (
              'Start Journey'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

