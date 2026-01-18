'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import HRPageLayout from '@/components/hr/HRPageLayout';
import { 
  listOnboardingTemplates, 
  archiveOnboardingTemplate, 
  createOnboardingTemplate,
  updateOnboardingTemplate,
  OnboardingTemplate,
  UpsertOnboardingTemplateInput,
  UpsertOnboardingTaskTemplateInput,
  OnboardingTaskType,
  OnboardingTaskOwnerType
} from '@/api/hrOnboarding';
import { Button, Card, Spinner, Alert, Badge } from 'shared/components';
import { Plus, Edit2, Trash2, Eye, Copy, CheckCircle2, XCircle, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TASK_TYPE_OPTIONS: OnboardingTaskType[] = ['DOCUMENT', 'EQUIPMENT', 'TRAINING', 'MEETING', 'FORM', 'CUSTOM'];
const OWNER_TYPE_OPTIONS: OnboardingTaskOwnerType[] = ['EMPLOYEE', 'MANAGER', 'HR', 'BUDDY', 'IT', 'OTHER'];

interface EditableTaskTemplate extends UpsertOnboardingTaskTemplateInput {
  id?: string;
}

interface EditableTemplate extends Omit<UpsertOnboardingTemplateInput, 'tasks'> {
  id?: string;
  tasks: EditableTaskTemplate[];
}

export default function OnboardingTemplatesPage() {
  const params = useParams();
  const businessId = params?.id as string;

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EditableTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (businessId) {
      loadTemplates();
    }
  }, [businessId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listOnboardingTemplates(businessId);
      setTemplates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (templateId: string) => {
    if (!confirm('Are you sure you want to archive this template? It will no longer be available for new onboarding journeys.')) {
      return;
    }

    try {
      await archiveOnboardingTemplate(businessId, templateId);
      toast.success('Template archived successfully');
      loadTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive template';
      toast.error(message);
    }
  };

  const handleEdit = (template: OnboardingTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || null,
      isDefault: template.isDefault,
      isActive: template.isActive,
      ownerUserId: template.ownerUserId || null,
      tasks: (template.taskTemplates || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || null,
        orderIndex: task.orderIndex,
        taskType: task.taskType,
        ownerType: task.ownerType,
        ownerReference: task.ownerReference || null,
        dueOffsetDays: task.dueOffsetDays || null,
        requiresApproval: task.requiresApproval,
        requiresDocument: task.requiresDocument,
        metadata: task.metadata || null
      }))
    });
  };

  const handleCreateNew = () => {
    setEditingTemplate({
      name: '',
      description: null,
      isDefault: false,
      isActive: true,
      ownerUserId: null,
      tasks: []
    });
  };

  const handleCancel = () => {
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    if (!editingTemplate || !editingTemplate.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      setSavingTemplate(true);
      const payload: UpsertOnboardingTemplateInput = {
        name: editingTemplate.name,
        description: editingTemplate.description,
        isDefault: editingTemplate.isDefault,
        isActive: editingTemplate.isActive,
        ownerUserId: editingTemplate.ownerUserId,
        tasks: editingTemplate.tasks.map((task, index) => ({
          ...task,
          orderIndex: task.orderIndex ?? index
        }))
      };

      if (editingTemplate.id) {
        await updateOnboardingTemplate(businessId, editingTemplate.id, payload);
        toast.success('Template updated successfully');
      } else {
        await createOnboardingTemplate(businessId, payload);
        toast.success('Template created successfully');
      }

      await loadTemplates();
      setEditingTemplate(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save template';
      toast.error(message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const updateTemplate = (partial: Partial<EditableTemplate>) => {
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, ...partial });
    }
  };

  const updateTask = (index: number, partial: Partial<EditableTaskTemplate>) => {
    if (editingTemplate) {
      const updatedTasks = editingTemplate.tasks.map((task, idx) =>
        idx === index ? { ...task, ...partial } : task
      );
      updateTemplate({ tasks: updatedTasks });
    }
  };

  const addTask = () => {
    if (editingTemplate) {
      updateTemplate({
        tasks: [
          ...editingTemplate.tasks,
          {
            title: 'New Task',
            description: null,
            taskType: 'CUSTOM',
            ownerType: 'EMPLOYEE',
            dueOffsetDays: null,
            requiresApproval: false,
            requiresDocument: false,
            orderIndex: editingTemplate.tasks.length,
            metadata: null
          }
        ]
      });
    }
  };

  const removeTask = (index: number) => {
    if (editingTemplate) {
      const updatedTasks = editingTemplate.tasks.filter((_, idx) => idx !== index);
      updateTemplate({ tasks: updatedTasks });
    }
  };

  if (!businessId) {
    return (
      <HRPageLayout businessId="" currentView="onboarding-templates">
        <div className="p-6">
          <Alert type="error" title="Error">
            Business ID is required
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  if (loading) {
    return (
      <HRPageLayout businessId={businessId} currentView="onboarding-templates">
        <div className="flex items-center justify-center h-full">
          <Spinner size={32} />
        </div>
      </HRPageLayout>
    );
  }

  if (error) {
    return (
      <HRPageLayout businessId={businessId} currentView="onboarding-templates">
        <div className="p-6">
          <Alert type="error" title="Error Loading Templates">
            {error}
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  // If editing or creating, show the editor
  if (editingTemplate) {
    return (
      <HRPageLayout businessId={businessId} currentView="onboarding-templates">
        <div className="p-6">
          <Card className="p-6 border border-blue-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate.id ? 'Edit Onboarding Template' : 'Create Onboarding Template'}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Template Name</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => updateTemplate({ name: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Corporate Onboarding"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Template Owner (User ID)</label>
                <input
                  type="text"
                  value={editingTemplate.ownerUserId ?? ''}
                  onChange={(e) => updateTemplate({ ownerUserId: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional - assign template owner"
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={editingTemplate.description ?? ''}
                onChange={(e) => updateTemplate({ description: e.target.value || null })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe when to use this template, who it's for, and any notes for HR admins."
              />
            </div>

            <div className="mt-4 flex items-center space-x-4">
              <label className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editingTemplate.isDefault ?? false}
                  onChange={(e) => updateTemplate({ isDefault: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Set as default template</span>
              </label>

              <label className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editingTemplate.isActive ?? true}
                  onChange={(e) => updateTemplate({ isActive: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Template active</span>
              </label>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900">Task Sequence</h4>
                <Button variant="secondary" size="sm" onClick={addTask}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Task
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {editingTemplate.tasks.length === 0 && (
                  <Alert type="info" title="No tasks added yet">
                    Add tasks to define the onboarding journey for employees using this template.
                  </Alert>
                )}

                {editingTemplate.tasks.map((task, index) => (
                  <Card key={task.id ?? index} className="p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-col md:flex-row md:space-x-4 space-y-2 md:space-y-0">
                          <div className="flex-1">
                            <label className="text-sm font-medium text-gray-700">Task Title</label>
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateTask(index, { title: e.target.value })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: Submit I-9 documents"
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-sm font-medium text-gray-700">Order</label>
                            <input
                              type="number"
                              value={task.orderIndex ?? index}
                              onChange={(e) => updateTask(index, { orderIndex: Number(e.target.value) })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min={0}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Task Type</label>
                            <select
                              value={task.taskType ?? 'CUSTOM'}
                              onChange={(e) => updateTask(index, { taskType: e.target.value as OnboardingTaskType })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {TASK_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option.charAt(0) + option.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700">Owner</label>
                            <select
                              value={task.ownerType ?? 'EMPLOYEE'}
                              onChange={(e) => updateTask(index, { ownerType: e.target.value as OnboardingTaskOwnerType })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {OWNER_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option.charAt(0) + option.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700">Due Offset (days)</label>
                            <input
                              type="number"
                              value={task.dueOffsetDays ?? 0}
                              onChange={(e) => updateTask(index, { dueOffsetDays: Number(e.target.value) || null })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <label className="text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          value={task.description ?? ''}
                          onChange={(e) => updateTask(index, { description: e.target.value || null })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Add task instructions or links for the assignee."
                        />

                        <div className="flex items-center space-x-4">
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={task.requiresApproval ?? false}
                              onChange={(e) => updateTask(index, { requiresApproval: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Requires approval</span>
                          </label>

                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={task.requiresDocument ?? false}
                              onChange={(e) => updateTask(index, { requiresDocument: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Requires document upload</span>
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeTask(index)}
                        className="ml-4 rounded-lg p-2 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={savingTemplate || !editingTemplate.name.trim()}>
                {savingTemplate ? (
                  <div className="mr-2">
                    <Spinner size={16} />
                  </div>
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </Card>
        </div>
      </HRPageLayout>
    );
  }

  return (
    <HRPageLayout businessId={businessId} currentView="onboarding-templates">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding Templates</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage onboarding templates for your business
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {templates.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-4">No onboarding templates found.</p>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      {template.isDefault && (
                        <Badge variant="primary">Default</Badge>
                      )}
                      {!template.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {template.archivedAt && (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <span>{template.taskTemplates?.length || 0} tasks</span>
                  <span>
                    {template.isActive ? (
                      <span className="flex items-center text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center text-gray-400">
                        <XCircle className="w-4 h-4 mr-1" />
                        Inactive
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(template)}
                    className="flex-1"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement preview
                      toast.info('Preview feature coming soon');
                    }}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  {!template.archivedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(template.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </HRPageLayout>
  );
}

