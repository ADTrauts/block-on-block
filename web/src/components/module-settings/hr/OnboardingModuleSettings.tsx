'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Spinner, Alert, Modal } from 'shared/components';
import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import type { ModuleConfig, OnboardingModuleConfig } from '@/components/module-settings/types';
import {
  archiveOnboardingTemplate,
  createOnboardingTemplate,
  listOnboardingTemplates,
  updateOnboardingTemplate,
  getOnboardingDocumentLibrary,
  type OnboardingDocumentLibraryFile,
  type OnboardingDocumentLibraryResponse,
  type OnboardingTemplate,
  type UpsertOnboardingTemplateInput,
  type UpsertOnboardingTaskTemplateInput,
  type OnboardingTaskOwnerType,
  type OnboardingTaskType
} from '@/api/hrOnboarding';
import { uploadFile } from '@/api/drive';

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

type ChecklistSection = 'documentChecklist' | 'equipmentList' | 'uniformOptions' | 'customActions';

interface ChecklistDialogActionState {
  id: string;
  label: string;
}

interface ChecklistDialogState {
  section: ChecklistSection;
  name: string;
  description: string;
  required: boolean;
  actions: ChecklistDialogActionState[];
  driveFileId?: string;
  driveFileName?: string;
  driveFileType?: string;
  driveFileUrl?: string;
  equipmentLibraryItemId?: string;
  uniformCatalogItemId?: string;
  sku?: string;
  instructions?: string;
  color?: string;
  uniformSizesText?: string;
}

const CHECKLIST_SECTION_LABELS: Record<ChecklistSection, { title: string; nameLabel: string; descriptionLabel: string }> = {
  documentChecklist: {
    title: 'Add Document Requirement',
    nameLabel: 'Document name',
    descriptionLabel: 'Instructions or notes (optional)'
  },
  equipmentList: {
    title: 'Add Equipment Item',
    nameLabel: 'Equipment name',
    descriptionLabel: 'Assignment details (optional)'
  },
  uniformOptions: {
    title: 'Add Uniform Item',
    nameLabel: 'Uniform item',
    descriptionLabel: 'Sizing or presentation notes (optional)'
  },
  customActions: {
    title: 'Create Custom Checklist',
    nameLabel: 'Custom name',
    descriptionLabel: 'Overview or notes (optional)'
  }
};

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
  equipmentLibrary: [],
  uniformLibrary: [],
  customActions: [],
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

const createTempId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const renderDocumentIcon = (mimeType?: string) => {
  const normalized = mimeType?.toLowerCase() ?? '';

  if (normalized.includes('pdf')) {
    return <FileText className="h-4 w-4" />;
  }
  if (
    normalized.includes('spreadsheet') ||
    normalized.includes('excel') ||
    normalized.includes('sheet')
  ) {
    return <FileSpreadsheet className="h-4 w-4" />;
  }
  if (
    normalized.includes('word') ||
    normalized.includes('document') ||
    normalized.includes('text')
  ) {
    return <FileText className="h-4 w-4" />;
  }
  if (normalized.includes('presentation') || normalized.includes('powerpoint')) {
    return <FileText className="h-4 w-4" />;
  }
  if (normalized.includes('image') || normalized.match(/(png|jpg|jpeg|gif|svg)/)) {
    return <FileImage className="h-4 w-4" />;
  }
  if (normalized.includes('audio')) {
    return <FileAudio className="h-4 w-4" />;
  }
  if (normalized.includes('video')) {
    return <FileVideo className="h-4 w-4" />;
  }
  if (normalized.includes('zip') || normalized.includes('compressed') || normalized.includes('archive')) {
    return <FileArchive className="h-4 w-4" />;
  }
  if (normalized.includes('json') || normalized.includes('xml') || normalized.includes('code')) {
    return <FileCode className="h-4 w-4" />;
  }

  return <FileIcon className="h-4 w-4" />;
};

function ensureOnboardingConfig(config: ModuleConfig): OnboardingModuleConfig {
  if (!config.onboarding) {
    return DEFAULT_ONBOARDING_CONFIG;
  }

  return {
    ...DEFAULT_ONBOARDING_CONFIG,
    ...config.onboarding,
    documentChecklist: config.onboarding.documentChecklist ?? [],
    equipmentList: config.onboarding.equipmentList ?? [],
    uniformOptions: config.onboarding.uniformOptions ?? [],
    equipmentLibrary: config.onboarding.equipmentLibrary ?? [],
    uniformLibrary: config.onboarding.uniformLibrary ?? [],
    customActions: config.onboarding.customActions ?? []
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Corporate Onboarding"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Template Owner (User ID)</label>
          <input
            type="text"
            value={template.ownerUserId ?? ''}
            onChange={(e) => updateTemplate({ ownerUserId: e.target.value || null })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional - assign template owner"
          />
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={template.description ?? ''}
          onChange={(e) => updateTemplate({ description: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        onChange={(e) => updateTask(index, { dueOffsetDays: Number(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={task.description ?? ''}
                    onChange={(e) => updateTask(index, { description: e.target.value })}
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
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EditableTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [checklistDialog, setChecklistDialog] = useState<ChecklistDialogState | null>(null);
  const [checklistDialogError, setChecklistDialogError] = useState<string | null>(null);
  const [documentLibrary, setDocumentLibrary] = useState<OnboardingDocumentLibraryResponse | null>(null);
  const [documentLibraryLoading, setDocumentLibraryLoading] = useState(false);
  const [documentLibraryError, setDocumentLibraryError] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const documentUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [newEquipmentItem, setNewEquipmentItem] = useState({
    name: '',
    description: '',
    sku: '',
    instructions: ''
  });
  const [newUniformItem, setNewUniformItem] = useState({
    name: '',
    description: '',
    sizes: '',
    color: '',
    notes: ''
  });

  const loadDocumentLibrary = useCallback(async () => {
    if (!businessId) {
      setDocumentLibrary(null);
      setDocumentLibraryError(null);
      return;
    }

    try {
      setDocumentLibraryLoading(true);
      setDocumentLibraryError(null);
      const data = await getOnboardingDocumentLibrary(businessId);
      setDocumentLibrary(data);
    } catch (error) {
      setDocumentLibraryError(
        error instanceof Error ? error.message : 'Failed to load onboarding documents'
      );
    } finally {
      setDocumentLibraryLoading(false);
    }
  }, [businessId]);

  const onboardingConfig = useMemo(() => ensureOnboardingConfig(config), [config]);

  useEffect(() => {
    if (!config.onboarding) {
      onConfigChange((prev) => ({
        ...prev,
        onboarding: DEFAULT_ONBOARDING_CONFIG
      }));
    }
  }, [config.onboarding, onConfigChange]);

  useEffect(() => {
    if (!businessId) {
      setDocumentLibrary(null);
      return;
    }
    void loadDocumentLibrary();
  }, [businessId, loadDocumentLibrary]);

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

  const openChecklistDialog = (section: ChecklistSection) => {
    setChecklistDialog({
      section,
      name: '',
      description: '',
      required: true,
      actions: section === 'customActions' ? [{ id: createTempId(), label: '' }] : [],
      driveFileId: undefined,
      driveFileName: undefined,
      driveFileType: undefined,
      driveFileUrl: undefined,
      equipmentLibraryItemId: undefined,
      uniformCatalogItemId: undefined,
      sku: '',
      instructions: '',
      color: '',
      uniformSizesText: ''
    });
    setChecklistDialogError(null);
    if (section === 'documentChecklist') {
      void loadDocumentLibrary();
    }
  };

  const closeChecklistDialog = () => {
    setChecklistDialog(null);
    setChecklistDialogError(null);
  };

  const handleChecklistDialogSubmit = () => {
    if (!checklistDialog) {
      return;
    }

    const name = checklistDialog.name.trim();
    if (!name) {
      setChecklistDialogError('Name is required.');
      return;
    }

    const description = checklistDialog.description.trim();
    const trimmedActions =
      checklistDialog.section === 'customActions'
        ? checklistDialog.actions
            .map((action) => ({
              ...action,
              label: action.label.trim()
            }))
            .filter((action) => action.label.length > 0)
        : [];

    if (checklistDialog.section === 'documentChecklist' && !checklistDialog.driveFileId) {
      setChecklistDialogError('Select or upload a document to continue.');
      return;
    }

    if (checklistDialog.section === 'customActions' && trimmedActions.length === 0) {
      setChecklistDialogError('Add at least one action.');
      return;
    }

    const uniformSizes = checklistDialog.uniformSizesText
      ? checklistDialog.uniformSizesText
          .split(',')
          .map((size) => size.trim())
          .filter((size) => size.length > 0)
      : [];

    updateOnboardingConfig((prev) => {
      const id = createTempId();

      if (checklistDialog.section === 'documentChecklist') {
        return {
          ...prev,
          documentChecklist: [
            ...prev.documentChecklist,
            {
              id,
              title: name,
              description: description || undefined,
              required: checklistDialog.required,
              driveFileId: checklistDialog.driveFileId,
              driveFileName: checklistDialog.driveFileName ?? name,
              driveFileType: checklistDialog.driveFileType,
              driveFileUrl: checklistDialog.driveFileUrl
            }
          ]
        };
      }

      if (checklistDialog.section === 'equipmentList') {
        return {
          ...prev,
          equipmentList: [
            ...prev.equipmentList,
            {
              id,
              name,
              description: description || undefined,
              required: checklistDialog.required,
              catalogItemId: checklistDialog.equipmentLibraryItemId,
              sku: checklistDialog.sku?.trim() || undefined,
              instructions: checklistDialog.instructions?.trim() || undefined
            }
          ]
        };
      }

      if (checklistDialog.section === 'customActions') {
        return {
          ...prev,
          customActions: [
            ...prev.customActions,
            {
              id,
              name,
              description: description || undefined,
              required: checklistDialog.required,
              actions: trimmedActions.map((action) => ({
                id: action.id ?? createTempId(),
                label: action.label
              }))
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
            description: description || undefined,
            required: checklistDialog.required,
            catalogItemId: checklistDialog.uniformCatalogItemId,
            color: checklistDialog.color?.trim() || undefined,
            sizes: uniformSizes.length > 0 ? uniformSizes : undefined
          }
        ]
      };
    });

    closeChecklistDialog();
  };

  const handleToggleRequired = (
    section: 'documentChecklist' | 'equipmentList' | 'uniformOptions' | 'customActions',
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
      if (section === 'customActions') {
        return {
          ...prev,
          customActions: prev.customActions.map((item) =>
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

  const handleRemoveItem = (
    section: 'documentChecklist' | 'equipmentList' | 'uniformOptions' | 'customActions',
    id: string
  ) => {
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
      if (section === 'customActions') {
        return {
          ...prev,
          customActions: prev.customActions.filter((item) => item.id !== id)
        };
      }
      return {
        ...prev,
        uniformOptions: prev.uniformOptions.filter((item) => item.id !== id)
      };
    });
  };

  const handleCustomActionLabelChange = (actionId: string, value: string) => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'customActions') {
        return prev;
      }

      return {
        ...prev,
        actions: prev.actions.map((action) =>
          action.id === actionId ? { ...action, label: value } : action
        )
      };
    });
  };

  const handleAddCustomActionField = () => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'customActions') {
        return prev;
      }

      return {
        ...prev,
        actions: [...prev.actions, { id: createTempId(), label: '' }]
      };
    });
  };

  const handleRemoveCustomActionField = (actionId: string) => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'customActions') {
        return prev;
      }

      const remaining = prev.actions.filter((action) => action.id !== actionId);
      return {
        ...prev,
        actions: remaining.length > 0 ? remaining : [{ id: createTempId(), label: '' }]
      };
    });
  };

  const handleDocumentSelect = useCallback((file: OnboardingDocumentLibraryFile) => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'documentChecklist') {
        return prev;
      }

      setChecklistDialogError(null);

      return {
        ...prev,
        driveFileId: file.id,
        driveFileName: file.name,
        driveFileType: file.type,
        driveFileUrl: file.url
      };
    });
  }, []);

  const handleDocumentClear = useCallback(() => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'documentChecklist') {
        return prev;
      }

      return {
        ...prev,
        driveFileId: undefined,
        driveFileName: undefined,
        driveFileType: undefined,
        driveFileUrl: undefined
      };
    });
  }, []);

  const handleDocumentUploadClick = useCallback(() => {
    documentUploadInputRef.current?.click();
  }, []);

  const handleDocumentUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !documentLibrary?.folderId || !session?.accessToken) {
        return;
      }

      try {
        setUploadingDocument(true);
        const uploaded = await uploadFile(
          session.accessToken,
          file,
          documentLibrary.folderId,
          false,
          documentLibrary.dashboardId
        );

        await loadDocumentLibrary();
        setChecklistDialog((prev) => {
          if (!prev || prev.section !== 'documentChecklist') {
            return prev;
          }
          setChecklistDialogError(null);
          return {
            ...prev,
            driveFileId: uploaded.id,
            driveFileName: uploaded.name,
            driveFileType: uploaded.type,
            driveFileUrl: uploaded.url
          };
        });
        toast.success('Document uploaded successfully');
      } catch (uploadError) {
        console.error('Failed to upload onboarding document:', uploadError);
        toast.error('Failed to upload document');
      } finally {
        setUploadingDocument(false);
        event.target.value = '';
      }
    },
    [documentLibrary, loadDocumentLibrary, session?.accessToken]
  );

  const handleEquipmentLibrarySelect = useCallback(
    (item: OnboardingModuleConfig['equipmentLibrary'][number]) => {
      setChecklistDialogError(null);
      setChecklistDialog((prev) => {
        if (!prev || prev.section !== 'equipmentList') {
          return prev;
        }

        return {
          ...prev,
          equipmentLibraryItemId: item.id,
          name: item.name,
          description: item.description ?? '',
          sku: item.sku ?? '',
          instructions: item.instructions ?? ''
        };
      });
    },
    []
  );

  const handleEquipmentLibraryClear = useCallback(() => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'equipmentList') {
        return prev;
      }
      return {
        ...prev,
        equipmentLibraryItemId: undefined
      };
    });
  }, []);

  const handleUniformCatalogSelect = useCallback(
    (item: OnboardingModuleConfig['uniformLibrary'][number]) => {
      setChecklistDialogError(null);
      setChecklistDialog((prev) => {
        if (!prev || prev.section !== 'uniformOptions') {
          return prev;
        }

        return {
          ...prev,
          uniformCatalogItemId: item.id,
          name: item.name,
          description: item.description ?? '',
          color: item.color ?? '',
          uniformSizesText: item.sizes.join(', ')
        };
      });
    },
    []
  );

  const handleUniformCatalogClear = useCallback(() => {
    setChecklistDialog((prev) => {
      if (!prev || prev.section !== 'uniformOptions') {
        return prev;
      }
      return {
        ...prev,
        uniformCatalogItemId: undefined
      };
    });
  }, []);

  const handleAddEquipmentLibraryItem = useCallback(() => {
    const name = newEquipmentItem.name.trim();
    if (!name) {
      toast.error('Equipment name is required');
      return;
    }

    updateOnboardingConfig((prev) => ({
      ...prev,
      equipmentLibrary: [
        ...prev.equipmentLibrary,
        {
          id: createTempId(),
          name,
          description: newEquipmentItem.description.trim() || undefined,
          sku: newEquipmentItem.sku.trim() || undefined,
          instructions: newEquipmentItem.instructions.trim() || undefined
        }
      ]
    }));

    setNewEquipmentItem({
      name: '',
      description: '',
      sku: '',
      instructions: ''
    });
    toast.success('Equipment item added');
  }, [newEquipmentItem, updateOnboardingConfig]);

  const handleRemoveEquipmentLibraryItem = useCallback(
    (itemId: string) => {
      updateOnboardingConfig((prev) => ({
        ...prev,
        equipmentLibrary: prev.equipmentLibrary.filter((item) => item.id !== itemId),
        equipmentList: prev.equipmentList.map((item) =>
          item.catalogItemId === itemId ? { ...item, catalogItemId: undefined } : item
        )
      }));
    },
    [updateOnboardingConfig]
  );

  const handleAddUniformCatalogItem = useCallback(() => {
    const name = newUniformItem.name.trim();
    if (!name) {
      toast.error('Uniform name is required');
      return;
    }

    const sizes = newUniformItem.sizes
      .split(',')
      .map((size) => size.trim())
      .filter((size) => size.length > 0);

    updateOnboardingConfig((prev) => ({
      ...prev,
      uniformLibrary: [
        ...prev.uniformLibrary,
        {
          id: createTempId(),
          name,
          description: newUniformItem.description.trim() || undefined,
          sizes,
          color: newUniformItem.color.trim() || undefined,
          notes: newUniformItem.notes.trim() || undefined
        }
      ]
    }));

    setNewUniformItem({
      name: '',
      description: '',
      sizes: '',
      color: '',
      notes: ''
    });
    toast.success('Uniform item added');
  }, [newUniformItem, updateOnboardingConfig]);

  const handleRemoveUniformCatalogItem = useCallback(
    (itemId: string) => {
      updateOnboardingConfig((prev) => ({
        ...prev,
        uniformLibrary: prev.uniformLibrary.filter((item) => item.id !== itemId),
        uniformOptions: prev.uniformOptions.map((item) =>
          item.catalogItemId === itemId ? { ...item, catalogItemId: undefined } : item
        )
      }));
    },
    [updateOnboardingConfig]
  );

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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Onboarding Checklists</h3>
              <p className="text-sm text-gray-600">
                Configure what every new hire needs before their first day. These lists power task templates and
                automated reminders.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="w-full md:w-auto"
              onClick={() => openChecklistDialog('customActions')}
            >
              Custom
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <Card className="p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900">Documents</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="flex items-center space-x-2"
                  onClick={() => openChecklistDialog('documentChecklist')}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Document</span>
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.documentChecklist.length === 0 && (
                  <li className="text-sm text-gray-500">No documents configured yet.</li>
                )}
                {onboardingConfig.documentChecklist.map((item) => (
                  <li key={item.id} className="flex items-start justify-between text-sm space-x-3">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{item.title}</span>
                      {item.description && (
                        <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                      )}
                      {item.driveFileId && (
                        <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                          <span className="text-gray-400">{renderDocumentIcon(item.driveFileType)}</span>
                          {item.driveFileUrl ? (
                            <a
                              href={item.driveFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {item.driveFileName ?? item.title}
                            </a>
                          ) : (
                            <span>{item.driveFileName ?? item.title}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
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
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="flex items-center space-x-2"
                  onClick={() => openChecklistDialog('equipmentList')}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Equipment</span>
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.equipmentList.length === 0 && (
                  <li className="text-sm text-gray-500">No equipment configured yet.</li>
                )}
                {onboardingConfig.equipmentList.map((item) => (
                  <li key={item.id} className="flex items-start justify-between text-sm space-x-3">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {item.description && (
                        <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.instructions && <span>{item.instructions}</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
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
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="flex items-center space-x-2"
                  onClick={() => openChecklistDialog('uniformOptions')}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Uniform</span>
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.uniformOptions.length === 0 && (
                  <li className="text-sm text-gray-500">No uniforms configured yet.</li>
                )}
                {onboardingConfig.uniformOptions.map((item) => (
                  <li key={item.id} className="flex items-start justify-between text-sm space-x-3">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {item.description && (
                        <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                        {item.color && <span>Color: {item.color}</span>}
                        {item.sizes && item.sizes.length > 0 && (
                          <span>Sizes: {item.sizes.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
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

            <Card className="p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900">Custom Actions</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="flex items-center space-x-2"
                  onClick={() => openChecklistDialog('customActions')}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </Button>
              </div>
              <ul className="space-y-2">
                {onboardingConfig.customActions.length === 0 && (
                  <li className="text-sm text-gray-500">No custom checklists configured yet.</li>
                )}
                {onboardingConfig.customActions.map((item) => (
                  <li key={item.id} className="flex flex-col space-y-2 rounded border border-gray-100 p-3">
                    <div className="flex items-start justify-between space-x-3">
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        {item.description && (
                          <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 pt-1">
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={(e) =>
                              handleToggleRequired('customActions', item.id, e.target.checked)
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500">Required</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem('customActions', item.id)}
                          className="rounded p-1 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    </div>
                    {item.actions.length > 0 && (
                      <ul className="space-y-1 pl-4">
                        {item.actions.map((action) => (
                          <li key={action.id} className="text-xs text-gray-600 leading-5">
                            • {action.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-gray-200">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Equipment Library</h3>
            <p className="text-sm text-gray-600">
              Build a reusable catalog of equipment assignments. You can attach these items to onboarding checklists and reuse them across templates.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Equipment name</label>
              <input
                type="text"
                value={newEquipmentItem.name}
                onChange={(event) =>
                  setNewEquipmentItem((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={'e.g. 15" MacBook Pro'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">SKU / Asset tag</label>
              <input
                type="text"
                value={newEquipmentItem.sku}
                onChange={(event) =>
                  setNewEquipmentItem((prev) => ({ ...prev, sku: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional identifier"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={newEquipmentItem.description}
                onChange={(event) =>
                  setNewEquipmentItem((prev) => ({ ...prev, description: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Notes about model, condition, or provisioning steps."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Handling instructions</label>
              <textarea
                value={newEquipmentItem.instructions}
                onChange={(event) =>
                  setNewEquipmentItem((prev) => ({ ...prev, instructions: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Optional setup steps or care instructions."
              />
            </div>
            <div className="md:col-span-2">
              <Button type="button" variant="secondary" onClick={handleAddEquipmentLibraryItem}>
                Add to equipment library
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {onboardingConfig.equipmentLibrary.length === 0 ? (
              <p className="text-sm text-gray-500">
                No equipment saved yet. Add items to reuse them across onboarding checklists.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                {onboardingConfig.equipmentLibrary.map((item) => (
                  <li key={item.id} className="px-4 py-3 flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-600">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.instructions && <span>{item.instructions}</span>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEquipmentLibraryItem(item.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-gray-200">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Uniform Catalog</h3>
            <p className="text-sm text-gray-600">
              Track company apparel and sizing information. Attach catalog items to onboarding checklists so employees know what to expect.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Uniform piece</label>
              <input
                type="text"
                value={newUniformItem.name}
                onChange={(event) =>
                  setNewUniformItem((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Branded Hoodie"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <input
                type="text"
                value={newUniformItem.color}
                onChange={(event) =>
                  setNewUniformItem((prev) => ({ ...prev, color: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional color"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={newUniformItem.description}
                onChange={(event) =>
                  setNewUniformItem((prev) => ({ ...prev, description: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Material, branding, or usage notes."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Available sizes</label>
              <input
                type="text"
                value={newUniformItem.sizes}
                onChange={(event) =>
                  setNewUniformItem((prev) => ({ ...prev, sizes: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comma separated (e.g. XS, S, M, L, XL)"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={newUniformItem.notes}
                onChange={(event) =>
                  setNewUniformItem((prev) => ({ ...prev, notes: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Care instructions or fitting guidance."
              />
            </div>
            <div className="md:col-span-2">
              <Button type="button" variant="secondary" onClick={handleAddUniformCatalogItem}>
                Add to uniform catalog
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {onboardingConfig.uniformLibrary.length === 0 ? (
              <p className="text-sm text-gray-500">
                No uniforms saved yet. Add catalog entries to connect them to onboarding flows.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                {onboardingConfig.uniformLibrary.map((item) => (
                  <li key={item.id} className="px-4 py-3 flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {item.color && <span>Color: {item.color}</span>}
                        {item.sizes.length > 0 && (
                          <span>Sizes: {item.sizes.join(', ')}</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-600">{item.description}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500">Notes: {item.notes}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveUniformCatalogItem(item.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={Boolean(checklistDialog)}
        onClose={closeChecklistDialog}
        title={
          checklistDialog
            ? CHECKLIST_SECTION_LABELS[checklistDialog.section].title
            : undefined
        }
      >
        {checklistDialog && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {CHECKLIST_SECTION_LABELS[checklistDialog.section].nameLabel}
              </label>
              <input
                type="text"
                value={checklistDialog.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setChecklistDialogError(null);
                  setChecklistDialog((prev) =>
                    prev ? { ...prev, name: value } : prev
                  );
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a name"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {CHECKLIST_SECTION_LABELS[checklistDialog.section].descriptionLabel}
              </label>
              <textarea
                value={checklistDialog.description}
                onChange={(event) => {
                  const value = event.target.value;
                  setChecklistDialog((prev) =>
                    prev ? { ...prev, description: value } : prev
                  );
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add additional details"
              />
            </div>

            {checklistDialog.section === 'documentChecklist' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Document</label>
                  <div className="flex items-center space-x-2">
                    <input
                      ref={documentUploadInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleDocumentUpload}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleDocumentUploadClick}
                      disabled={uploadingDocument}
                    >
                      <FilePlus2 className="mr-2 h-4 w-4" />
                      {uploadingDocument ? 'Uploading…' : 'Upload'}
                    </Button>
                  </div>
                </div>

                {documentLibraryError && (
                  <Alert type="error">
                    <span className="text-sm">{documentLibraryError}</span>
                  </Alert>
                )}

                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                  {documentLibraryLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner size={16} />
                      <span className="ml-2 text-xs text-gray-500">Loading documents…</span>
                    </div>
                  ) : documentLibrary?.files && documentLibrary.files.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                      {documentLibrary.files.map((file) => {
                        const isSelected = checklistDialog.driveFileId === file.id;
                        return (
                          <li key={file.id}>
                            <button
                              type="button"
                              onClick={() => handleDocumentSelect(file)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left transition ${
                                isSelected ? 'bg-white shadow-inner ring-1 ring-blue-200' : 'hover:bg-white'
                              }`}
                            >
                              <span className="flex items-center space-x-2">
                                <span className="text-gray-500">{renderDocumentIcon(file.type)}</span>
                                <span className="text-sm text-gray-800">{file.name}</span>
                              </span>
                              {isSelected ? (
                                <Badge color="blue" size="sm">Selected</Badge>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                  Select
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-3 py-4 text-xs text-gray-500">
                      No documents available yet. Upload a document to add it to your onboarding checklist.
                    </div>
                  )}
                </div>

                {checklistDialog.driveFileId && (
                  <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-500">{renderDocumentIcon(checklistDialog.driveFileType)}</span>
                      <div className="text-xs text-blue-900">
                        <p className="font-medium">
                          {checklistDialog.driveFileName ?? checklistDialog.name}
                        </p>
                        {checklistDialog.driveFileUrl && (
                          <a
                            href={checklistDialog.driveFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Open document
                          </a>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleDocumentClear}>
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}

            {checklistDialog.section === 'equipmentList' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Select from equipment library</label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                    {onboardingConfig.equipmentLibrary.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-gray-500">
                        No equipment items saved yet. Add items in the Equipment Library to reuse them here.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-200">
                        {onboardingConfig.equipmentLibrary.map((item) => {
                          const isSelected = checklistDialog.equipmentLibraryItemId === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => handleEquipmentLibrarySelect(item)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left transition ${
                                  isSelected ? 'bg-white shadow-inner ring-1 ring-blue-200' : 'hover:bg-white'
                                }`}
                              >
                                <span className="flex flex-col">
                                  <span className="text-sm text-gray-800">{item.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {[item.sku, item.description].filter(Boolean).join(' • ')}
                                  </span>
                                </span>
                                {isSelected ? (
                                  <Badge color="blue" size="sm">
                                    Selected
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                    Select
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {checklistDialog.equipmentLibraryItemId && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={handleEquipmentLibraryClear}>
                        Clear equipment selection
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">SKU / Asset tag</label>
                    <input
                      type="text"
                      value={checklistDialog.sku ?? ''}
                      onChange={(event) =>
                        setChecklistDialog((prev) =>
                          prev && prev.section === 'equipmentList'
                            ? { ...prev, sku: event.target.value }
                            : prev
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional identifier"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Instructions</label>
                    <textarea
                      value={checklistDialog.instructions ?? ''}
                      onChange={(event) =>
                        setChecklistDialog((prev) =>
                          prev && prev.section === 'equipmentList'
                            ? { ...prev, instructions: event.target.value }
                            : prev
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Optional setup or delivery notes."
                    />
                  </div>
                </div>
              </div>
            )}

            {checklistDialog.section === 'uniformOptions' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Select from uniform catalog</label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                    {onboardingConfig.uniformLibrary.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-gray-500">
                        No catalog entries yet. Add uniforms in the Uniform Catalog to reuse them here.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-200">
                        {onboardingConfig.uniformLibrary.map((item) => {
                          const isSelected = checklistDialog.uniformCatalogItemId === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => handleUniformCatalogSelect(item)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left transition ${
                                  isSelected ? 'bg-white shadow-inner ring-1 ring-blue-200' : 'hover:bg-white'
                                }`}
                              >
                                <span className="flex flex-col">
                                  <span className="text-sm text-gray-800">{item.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {[item.color, item.sizes.join(', ')].filter(Boolean).join(' • ')}
                                  </span>
                                </span>
                                {isSelected ? (
                                  <Badge color="blue" size="sm">
                                    Selected
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                    Select
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {checklistDialog.uniformCatalogItemId && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={handleUniformCatalogClear}>
                        Clear uniform selection
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Color</label>
                    <input
                      type="text"
                      value={checklistDialog.color ?? ''}
                      onChange={(event) =>
                        setChecklistDialog((prev) =>
                          prev && prev.section === 'uniformOptions'
                            ? { ...prev, color: event.target.value }
                            : prev
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional color"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Sizes</label>
                    <input
                      type="text"
                      value={checklistDialog.uniformSizesText ?? ''}
                      onChange={(event) =>
                        setChecklistDialog((prev) =>
                          prev && prev.section === 'uniformOptions'
                            ? { ...prev, uniformSizesText: event.target.value }
                            : prev
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Comma separated sizes (e.g. XS, S, M, L)"
                    />
                  </div>
                </div>
              </div>
            )}

            {checklistDialog.section === 'customActions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Actions</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleAddCustomActionField}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Action
                  </Button>
                </div>
                <div className="space-y-2">
                  {checklistDialog.actions.map((action, index) => (
                    <div key={action.id} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={action.label}
                        onChange={(event) =>
                          handleCustomActionLabelChange(action.id, event.target.value)
                        }
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Action ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomActionField(action.id)}
                        className="rounded p-1 text-gray-400 hover:text-gray-600"
                        disabled={checklistDialog.actions.length === 1}
                        aria-label="Remove action"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  List the specific actions or steps the admin wants to capture for this custom checklist item.
                </p>
              </div>
            )}

            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={checklistDialog.required}
                onChange={(event) =>
                  setChecklistDialog((prev) =>
                    prev ? { ...prev, required: event.target.checked } : prev
                  )
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Mark as required</span>
            </label>

            {checklistDialogError && (
              <p className="text-sm text-red-600">{checklistDialogError}</p>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={closeChecklistDialog}>
                Cancel
              </Button>
              <Button onClick={handleChecklistDialogSubmit}>Add Item</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

