'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Spinner, Alert } from 'shared/components';
import { Plus, RefreshCw, Save, Trash2, Edit2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { ModuleConfig, OnboardingModuleConfig } from '@/components/module-settings/types';
import {
  archiveOnboardingTemplate,
  createOnboardingTemplate,
  listOnboardingTemplates,
  updateOnboardingTemplate,
  type OnboardingTemplate,
  type UpsertOnboardingTemplateInput,
  type UpsertOnboardingTaskTemplateInput,
  type OnboardingTaskOwnerType,
  type OnboardingTaskType
} from '@/api/hrOnboarding';

type SetModuleConfig = React.Dispatch<React.SetStateAction<ModuleConfig>>;

interface OnboardingModuleSettingsProps {
  businessId?: string;
  config: ModuleConfig;
  onConfigChange: SetModuleConfig;
}

interface EditableTaskTemplate extends UpsertOnboardingTaskTemplateInput {
  id?: string;
}

interface EditableTemplate extends Omit<UpsertOnboardingTemplateInput, 'tasks'> {
  tasks: EditableTaskTemplate[];
}

const DEFAULT_ONBOARDING_CONFIG: OnboardingModuleConfig = {
  ownerUserId: null,
  ownerRole: 'HR_ADMIN',
  ownerNotes: null,
  defaultTemplateId: null,
  buddyProgramEnabled: false,
  buddySelectionStrategy: 'manager_recommended',
  timeOffPresetDays: null,
  documentChecklist: [],
  equipmentList: [],
  uniformOptions: [],
  metadata: {}
};

const TASK_TYPE_OPTIONS: OnboardingTaskType[] = ['DOCUMENT', 'EQUIPMENT', 'TRAINING', 'MEETING', 'FORM', 'CUSTOM'];
const OWNER_TYPE_OPTIONS: OnboardingTaskOwnerType[] = ['EMPLOYEE', 'MANAGER', 'HR', 'BUDDY', 'IT', 'OTHER'];

const emptyTemplate = (): EditableTemplate => ({
  name: '',
  description: '',
  isDefault: false,
  isActive: true,
  ownerUserId: null,
  applicabilityRules: {},
  automationSettings: {},
  tasks: [
    {
      title: 'Welcome & Orientation',
      description: 'Kick-off call with HR to review policies and expectations.',
      taskType: 'MEETING',
      ownerType: 'HR',
      dueOffsetDays: 0,
      requiresApproval: false,
      requiresDocument: false,
      orderIndex: 0,
      metadata: {}
    }
  ]
});

function ensureOnboardingConfig(config: ModuleConfig): OnboardingModuleConfig {
  if (!config.onboarding) {
    return DEFAULT_ONBOARDING_CONFIG;
  }

  return {
    ...DEFAULT_ONBOARDING_CONFIG,
    ...config.onboarding,
    documentChecklist: config.onboarding.documentChecklist ?? [],
    equipmentList: config.onboarding.equipmentList ?? [],
    uniformOptions: config.onboarding.uniformOptions ?? []
  };
}

const TemplateEditor: React.FC<{
  template: EditableTemplate;
  onChange: (template: EditableTemplate) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}> = ({ template, onChange, onSave, onCancel, saving }) => {
  const updateTemplate = (partial: Partial<EditableTemplate>) => {
    onChange({ ...template, ...partial });
  };

  const updateTask = (index: number, partial: Partial<EditableTaskTemplate>) => {
    const updatedTasks = template.tasks.map((task, idx) =>
      idx === index ? { ...task, ...partial } : task
    );
    updateTemplate({ tasks: updatedTasks });
  };

  const addTask = () => {
    updateTemplate({
      tasks: [
        ...template.tasks,
        {
          title: 'New Task',
          description: '',
          taskType: 'CUSTOM',
          ownerType: 'EMPLOYEE',
          dueOffsetDays: null,
          requiresApproval: false,
          requiresDocument: false,
          orderIndex: template.tasks.length,
          metadata: {}
        }
      ]
    });
  };

  const removeTask = (index: number) => {
    const updatedTasks = template.tasks.filter((_, idx) => idx !== index);
    updateTemplate({ tasks: updatedTasks });
  };

  return (
    <Card className="p-6 border border-blue-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {template.id ? 'Edit Onboarding Template' : 'Create Onboarding Template'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
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
            value={template.name}
            onChange={(e) => updateTemplate({ name: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Corporate Onboarding"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Template Owner (User ID)</label>
          <input
            type="text"
            value={template.ownerUserId ?? ''}
            onChange={(e) => updateTemplate({ ownerUserId: e.target.value || null })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional - assign template owner"
          />
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={template.description ?? ''}
          onChange={(e) => updateTemplate({ description: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Describe when to use this template, who it's for, and any notes for HR admins."
        />
      </div>

      <div className="mt-4 flex items-center space-x-4">
        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={template.isDefault ?? false}
            onChange={(e) => updateTemplate({ isDefault: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Set as default template</span>
        </label>

        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={template.isActive ?? true}
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
          {template.tasks.length === 0 && (
            <Alert type="info" title="No tasks added yet">
              Add tasks to define the onboarding journey for employees using this template.
            </Alert>
          )}

          {template.tasks.map((task, index) => (
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Submit I-9 documents"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-sm font-medium text-gray-700">Order</label>
                      <input
                        type="number"
                        value={task.orderIndex ?? index}
                        onChange={(e) => updateTask(index, { orderIndex: Number(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        onChange={(e) => updateTask(index, { dueOffsetDays: Number(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={task.description ?? ''}
                    onChange={(e) => updateTask(index, { description: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving || !template.name.trim()}>
          {saving ? (
            <div className="mr-2">
              <Spinner size={16} />
            </div>
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </Card>
  );
};

export default function OnboardingModuleSettings({
  businessId,
  config,
  onConfigChange
}: OnboardingModuleSettingsProps) {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EditableTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const onboardingConfig = useMemo(() => ensureOnboardingConfig(config), [config]);

  useEffect(() => {
    if (!config.onboarding) {
      onConfigChange((prev) => ({
        ...prev,
        onboarding: DEFAULT_ONBOARDING_CONFIG
      }));
    }
  }, [config.onboarding, onConfigChange]);

  const refreshTemplates = useCallback(async () => {
    if (!businessId) {
      setTemplates([]);
      return;
    }

    try {
      setLoadingTemplates(true);
      setTemplatesError(null);
      const data = await listOnboardingTemplates(businessId);
      setTemplates(data);

      const defaultTemplate = data.find((tpl) => tpl.isDefault);
      if (defaultTemplate && onboardingConfig.defaultTemplateId !== defaultTemplate.id) {
        onConfigChange((prev) => ({
          ...prev,
          onboarding: {
            ...ensureOnboardingConfig(prev),
            defaultTemplateId: defaultTemplate.id
          }
        }));
      }
    } catch (error) {
      console.error(error);
      setTemplatesError(error instanceof Error ? error.message : 'Failed to load onboarding templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [businessId, onConfigChange, onboardingConfig.defaultTemplateId]);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  const updateOnboardingConfig = (updater: (prev: OnboardingModuleConfig) => OnboardingModuleConfig) => {
    onConfigChange((prev) => {
      const next = updater(ensureOnboardingConfig(prev));
      return {
        ...prev,
        onboarding: next
      };
    });
  };

  const handleAddChecklistItem = (section: 'documentChecklist' | 'equipmentList' | 'uniformOptions') => {
    const label =
      section === 'documentChecklist'
        ? 'Document name'
        : section === 'equipmentList'
        ? 'Equipment or tool name'
        : 'Uniform item';
    const name = window.prompt(`Add ${label}`);
    if (!name) {
      return;
    }

    updateOnboardingConfig((prev) => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const item = {
        id,
        title: name,
        required: true
      };

      if (section === 'documentChecklist') {
        return {
          ...prev,
          documentChecklist: [...prev.documentChecklist, item]
        };
      }

      if (section === 'equipmentList') {
        return {
          ...prev,
          equipmentList: [
            ...prev.equipmentList,
            {
              id,
              name,
              required: true
            }
          ]
        };
      }

      return {
        ...prev,
        uniformOptions: [
          ...prev.uniformOptions,
          {
            id,
            name,
            required: true
          }
        ]
      };
    });
  };

  const handleToggleRequired = (
    section: 'documentChecklist' | 'equipmentList' | 'uniformOptions',
    id: string,
    required: boolean
  ) => {
    updateOnboardingConfig((prev) => {
      if (section === 'documentChecklist') {
        return {
          ...prev,
          documentChecklist: prev.documentChecklist.map((item) =>
            item.id === id ? { ...item, required } : item
          )
        };
      }
      if (section === 'equipmentList') {
        return {
          ...prev,
          equipmentList: prev.equipmentList.map((item) =>
            item.id === id ? { ...item, required } : item
          )
        };
      }
      return {
        ...prev,
        uniformOptions: prev.uniformOptions.map((item) =>
          item.id === id ? { ...item, required } : item
        )
      };
    });
  };

  const handleRemoveItem = (section: 'documentChecklist' | 'equipmentList' | 'uniformOptions', id: string) => {
    updateOnboardingConfig((prev) => {
      if (section === 'documentChecklist') {
        return {
          ...prev,
          documentChecklist: prev.documentChecklist.filter((item) => item.id !== id)
        };
      }
      if (section === 'equipmentList') {
        return {
          ...prev,
          equipmentList: prev.equipmentList.filter((item) => item.id !== id)
        };
      }
      return {
        ...prev,
        uniformOptions: prev.uniformOptions.filter((item) => item.id !== id)
      };
    });
  };

  const beginCreateTemplate = () => {
    if (!businessId) {
      toast.error('Select a business before creating templates');
      return;
    }
    setEditingTemplate(emptyTemplate());
  };

  const beginEditTemplate = (template: OnboardingTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description ?? '',
      isDefault: template.isDefault,
      isActive: template.isActive,
      ownerUserId: template.ownerUserId,
      applicabilityRules: template.applicabilityRules ?? {},
      automationSettings: template.automationSettings ?? {},
      tasks: template.taskTemplates
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description ?? '',
          taskType: task.taskType,
          ownerType: task.ownerType,
          ownerReference: task.ownerReference,
          dueOffsetDays: task.dueOffsetDays,
          requiresApproval: task.requiresApproval,
          requiresDocument: task.requiresDocument,
          orderIndex: task.orderIndex,
          metadata: task.metadata ?? {}
        }))
    });
  };

  const handleSaveTemplate = async () => {
    if (!businessId || !editingTemplate) {
      return;
    }

    const payload: UpsertOnboardingTemplateInput = {
      id: editingTemplate.id,
      name: editingTemplate.name.trim(),
      description: editingTemplate.description ?? null,
      isDefault: editingTemplate.isDefault ?? false,
      isActive: editingTemplate.isActive ?? true,
      ownerUserId: editingTemplate.ownerUserId ?? null,
      applicabilityRules: editingTemplate.applicabilityRules ?? {},
      automationSettings: editingTemplate.automationSettings ?? {},
      tasks: editingTemplate.tasks.map((task, index) => ({
        id: task.id,
        title: task.title.trim(),
        description: task.description ?? null,
        taskType: task.taskType ?? 'CUSTOM',
        ownerType: task.ownerType ?? 'EMPLOYEE',
        ownerReference: task.ownerReference ?? null,
        dueOffsetDays: task.dueOffsetDays ?? null,
        requiresApproval: task.requiresApproval ?? false,
        requiresDocument: task.requiresDocument ?? false,
        orderIndex: task.orderIndex ?? index,
        metadata: task.metadata ?? {}
      }))
    };

    try {
      setSavingTemplate(true);
      if (payload.id) {
        await updateOnboardingTemplate(businessId, payload.id, payload);
        toast.success('Onboarding template updated');
      } else {
        await createOnboardingTemplate(businessId, payload);
        toast.success('Onboarding template created');
      }
      setEditingTemplate(null);
      await refreshTemplates();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleArchiveTemplate = async (template: OnboardingTemplate) => {
    if (!businessId) {
      return;
    }

    const confirmed = window.confirm(`Archive onboarding template "${template.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await archiveOnboardingTemplate(businessId, template.id);
      toast.success('Template archived');
      await refreshTemplates();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to archive template');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-gray-200">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Module Ownership</h3>
              <p className="text-sm text-gray-600">
                Define who governs onboarding and how employee journeys are managed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Primary module owner (User ID)</label>
              <input
                type="text"
                value={onboardingConfig.ownerUserId ?? ''}
                onChange={(e) =>
                  updateOnboardingConfig((prev) => ({
                    ...prev,
                    ownerUserId: e.target.value || null
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Assign the HR point person responsible for onboarding"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Owner role</label>
              <select
                value={onboardingConfig.ownerRole ?? 'HR_ADMIN'}
                onChange={(e) =>
                  updateOnboardingConfig((prev) => ({
                    ...prev,
                    ownerRole: e.target.value as OnboardingModuleConfig['ownerRole']
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HR_ADMIN">HR Admin</option>
                <option value="BUSINESS_ADMIN">Business Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="IT">IT / Ops</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Owner notes</label>
            <textarea
              value={onboardingConfig.ownerNotes ?? ''}
              onChange={(e) =>
                updateOnboardingConfig((prev) => ({
                  ...prev,
                  ownerNotes: e.target.value || null
                }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Document how onboarding decisions are made, escalation paths, or policy references."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={onboardingConfig.buddyProgramEnabled ?? false}
                  onChange={(e) =>
                    updateOnboardingConfig((prev) => ({
                      ...prev,
                      buddyProgramEnabled: e.target.checked
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable buddy program</span>
              </label>

              {onboardingConfig.buddyProgramEnabled && (
                <select
                  value={onboardingConfig.buddySelectionStrategy ?? 'manager_recommended'}
                  onChange={(e) =>
                    updateOnboardingConfig((prev) => ({
                      ...prev,
                      buddySelectionStrategy: e.target.value as OnboardingModuleConfig['buddySelectionStrategy']
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manager_recommended">Manager recommends buddy</option>
                  <option value="auto_assign">Auto-assign by department</option>
                  <option value="manual">Manual selection per hire</option>
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Time-off preset (days)</label>
              <input
                type="number"
                value={onboardingConfig.timeOffPresetDays ?? 0}
                onChange={(e) =>
                  updateOnboardingConfig((prev) => ({
                    ...prev,
                    timeOffPresetDays: Number(e.target.value)
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
              />
              <p className="text-xs text-gray-500">
                Automatically sets initial PTO for new hires. Advanced accrual rules will override this baseline.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-gray-200">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Onboarding Templates</h3>
              <p className="text-sm text-gray-600">
                Manage template playbooks that drive onboarding journeys for different roles or locations.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="secondary" onClick={refreshTemplates}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={beginCreateTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </div>
          </div>

          {templatesError && (
            <Alert type="error" title="Unable to load templates">
              {templatesError}
            </Alert>
          )}

          {loadingTemplates ? (
            <div className="flex justify-center py-8">
              <Spinner size={32} />
            </div>
          ) : templates.length === 0 ? (
            <Alert type="info" title="No onboarding templates yet">
              Create your first template to standardize onboarding tasks, document collection, and equipment handoff.
            </Alert>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="p-4 border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-3 md:space-y-0">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-md font-semibold text-gray-900">{template.name}</h4>
                        {template.isDefault && <Badge color="blue">Default</Badge>}
                        {!template.isActive && <Badge color="gray">Archived</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{template.description || 'No description provided.'}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {template.taskTemplates.length} tasks • Updated{' '}
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => beginEditTemplate(template)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveTemplate(template)}
                        className="text-red-600 hover:bg-red-50 border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Default template for new hires</label>
            <select
              value={onboardingConfig.defaultTemplateId ?? ''}
              onChange={(e) =>
                updateOnboardingConfig((prev) => ({
                  ...prev,
                  defaultTemplateId: e.target.value || null
                }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select default template</option>
              {templates
                .filter((tpl) => tpl.isActive)
                .map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
            </select>
          </div>

          {editingTemplate && (
            <TemplateEditor
              template={editingTemplate}
              onChange={setEditingTemplate}
              onSave={async () => {
                await handleSaveTemplate();
              }}
              onCancel={() => setEditingTemplate(null)}
              saving={savingTemplate}
            />
          )}
        </div>
      </Card>

      <Card className="p-6 border border-gray-200">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Onboarding Checklists</h3>
            <p className="text-sm text-gray-600">
              Configure what every new hire needs before their first day. These lists power task templates and
              automated reminders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900">Documents</h4>
                <Button size="sm" variant="ghost" onClick={() => handleAddChecklistItem('documentChecklist')}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.documentChecklist.length === 0 && (
                  <li className="text-sm text-gray-500">No documents configured yet.</li>
                )}
                {onboardingConfig.documentChecklist.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span>{item.title}</span>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) =>
                            handleToggleRequired('documentChecklist', item.id, e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-500">Required</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem('documentChecklist', item.id)}
                        className="rounded p-1 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900">Equipment</h4>
                <Button size="sm" variant="ghost" onClick={() => handleAddChecklistItem('equipmentList')}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.equipmentList.length === 0 && (
                  <li className="text-sm text-gray-500">No equipment configured yet.</li>
                )}
                {onboardingConfig.equipmentList.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) =>
                            handleToggleRequired('equipmentList', item.id, e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-500">Required</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem('equipmentList', item.id)}
                        className="rounded p-1 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900">Uniforms</h4>
                <Button size="sm" variant="ghost" onClick={() => handleAddChecklistItem('uniformOptions')}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.uniformOptions.length === 0 && (
                  <li className="text-sm text-gray-500">No uniforms configured yet.</li>
                )}
                {onboardingConfig.uniformOptions.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) =>
                            handleToggleRequired('uniformOptions', item.id, e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-500">Required</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem('uniformOptions', item.id)}
                        className="rounded p-1 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}

