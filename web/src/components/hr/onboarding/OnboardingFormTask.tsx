'use client';

import React, { useState } from 'react';
import { Card, Button, Spinner, Alert } from 'shared/components';
import { FileText, Save } from 'lucide-react';
import type { EmployeeOnboardingTask, OnboardingTaskStatus } from '@/api/hrOnboarding';

interface OnboardingFormTaskProps {
  task: EmployeeOnboardingTask;
  businessId: string;
  onComplete: (taskId: string, payload: { status?: OnboardingTaskStatus; notes?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  isCompleting?: boolean;
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export default function OnboardingFormTask({
  task,
  businessId,
  onComplete,
  isCompleting = false,
}: OnboardingFormTaskProps) {
  // Extract form fields from task metadata
  const formFields = (task.metadata as { formFields?: FormField[] })?.formFields || [];
  const existingFormData = (task.metadata as { formData?: Record<string, unknown> })?.formData || {};

  const [formData, setFormData] = useState<Record<string, unknown>>(existingFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // If no form fields defined, create a default form structure
  const defaultFields: FormField[] = formFields.length > 0 ? formFields : [
    { id: 'notes', label: 'Additional Information', type: 'textarea', required: false },
  ];

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    defaultFields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      await onComplete(task.id, {
        status: 'IN_PROGRESS',
        metadata: {
          ...task.metadata,
          formData,
          formSubmittedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to save form:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      await onComplete(task.id, {
        status: 'COMPLETED',
        metadata: {
          ...task.metadata,
          formData,
          formSubmittedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to submit form:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] ?? '';
    const error = errors[field.id];

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-600">*</span>}
            </label>
            <textarea
              value={value as string}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              rows={4}
              className={`w-full rounded-md border ${error ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-600">*</span>}
            </label>
            <select
              value={value as string}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              required={field.required}
              className={`w-full rounded-md border ${error ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select...</option>
              {field.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={value === true}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                required={field.required}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {field.label} {field.required && <span className="text-red-600">*</span>}
              </span>
            </label>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        );

      default:
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-600">*</span>}
            </label>
            <input
              type={field.type}
              value={value as string}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className={`w-full rounded-md border ${error ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        );
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">{task.title}</h4>
          {task.description && (
            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
          )}
        </div>
      </div>

      <form className="space-y-4">
        {defaultFields.map(field => renderField(field))}

        <div className="flex items-center gap-2 pt-4 border-t">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={saving || isCompleting}
          >
            {saving ? (
              <>
                <span className="mr-2"><Spinner size={16} /></span>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save Draft
              </>
            )}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || isCompleting}
          >
            {saving ? (
              <>
                <span className="mr-2"><Spinner size={16} /></span>
                Submitting...
              </>
            ) : (
              'Submit Form'
            )}
          </Button>
        </div>
      </form>

      {Object.keys(existingFormData).length > 0 && (
        <Alert type="info" title="Form Data Saved" className="mt-4">
          <p className="text-sm text-gray-600">
            You have previously saved form data. You can continue editing or submit the form.
          </p>
        </Alert>
      )}
    </Card>
  );
}

