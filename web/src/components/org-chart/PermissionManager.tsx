'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Input, Textarea, Spinner, Badge, Checkbox } from 'shared/components';
import { 
  getPermissions,
  getPermissionSets,
  getTemplatePermissionSets,
  createPermissionSet,
  updatePermissionSet,
  deletePermissionSet,
  copyPermissionSet,
  type Permission,
  type PermissionSet,
  type PermissionData,
  type OrganizationalTier,
  type Department,
  type Position,
  type CreatePermissionSetData
} from '@/api/orgChart';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Copy,
  Users,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface OrgChartData {
  tiers: OrganizationalTier[];
  departments: Department[];
  positions: Position[];
}

interface PermissionManagerProps {
  orgChartData: OrgChartData;
  businessId: string;
  onUpdate: () => void;
}

type EditMode = 'none' | 'permission-set';
type EditAction = 'create' | 'edit';

const modulePermissions = {
  'drive': {
    name: 'File Hub',
    icon: '📁',
    permissions: [
      { id: 'drive_view', name: 'View Files', description: 'View files and folders' },
      { id: 'drive_upload', name: 'Upload Files', description: 'Upload new files' },
      { id: 'drive_download', name: 'Download Files', description: 'Download files' },
      { id: 'drive_edit', name: 'Edit Files', description: 'Edit file content' },
      { id: 'drive_delete', name: 'Delete Files', description: 'Delete files and folders' },
      { id: 'drive_share', name: 'Share Files', description: 'Share files with others' },
      { id: 'drive_admin', name: 'Admin Files', description: 'Full file system access' }
    ]
  },
  'chat': {
    name: 'Chat',
    icon: '💬',
    permissions: [
      { id: 'chat_view', name: 'View Messages', description: 'View chat messages' },
      { id: 'chat_send', name: 'Send Messages', description: 'Send chat messages' },
      { id: 'chat_delete', name: 'Delete Messages', description: 'Delete own messages' },
      { id: 'chat_moderate', name: 'Moderate Chat', description: 'Moderate all messages' },
      { id: 'chat_admin', name: 'Admin Chat', description: 'Full chat management' }
    ]
  },
  'calendar': {
    name: 'Calendar',
    icon: '📅',
    permissions: [
      { id: 'calendar_view', name: 'View Events', description: 'View calendar events' },
      { id: 'calendar_create', name: 'Create Events', description: 'Create new events' },
      { id: 'calendar_edit', name: 'Edit Events', description: 'Edit events' },
      { id: 'calendar_delete', name: 'Delete Events', description: 'Delete events' },
      { id: 'calendar_admin', name: 'Admin Calendar', description: 'Full calendar access' }
    ]
  },
  'business': {
    name: 'Business',
    icon: '🏢',
    permissions: [
      { id: 'business_view', name: 'View Business', description: 'View business information' },
      { id: 'business_edit', name: 'Edit Business', description: 'Edit business details' },
      { id: 'business_admin', name: 'Admin Business', description: 'Full business management' }
    ]
  },
  'org-chart': {
    name: 'Org Chart',
    icon: '👥',
    permissions: [
      { id: 'org_view', name: 'View Org Chart', description: 'View organizational structure' },
      { id: 'org_edit', name: 'Edit Org Chart', description: 'Edit org chart structure' },
      { id: 'org_admin', name: 'Admin Org Chart', description: 'Full org chart management' }
    ]
  },
  'analytics': {
    name: 'Analytics',
    icon: '📊',
    permissions: [
      { id: 'analytics_view', name: 'View Analytics', description: 'View business analytics' },
      { id: 'analytics_export', name: 'Export Data', description: 'Export analytics data' },
      { id: 'analytics_admin', name: 'Admin Analytics', description: 'Full analytics access' }
    ]
  }
};

export function PermissionManager({ orgChartData, businessId, onUpdate }: PermissionManagerProps) {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
  const [templatePermissionSets, setTemplatePermissionSets] = useState<PermissionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [editAction, setEditAction] = useState<EditAction>('create');
  const [editingItem, setEditingItem] = useState<PermissionSet | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['permission-sets', 'templates', 'department-modules']));
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});

  // Form states
  const [permissionSetForm, setPermissionSetForm] = useState({
    name: '',
    description: '',
    permissions: {} as Record<string, boolean>
  });

  useEffect(() => {
    if (businessId && session?.accessToken) {
      loadPermissionData();
    }
  }, [businessId, session?.accessToken]);

  const loadPermissionData = async () => {
    try {
      setLoading(true);
      if (!session?.accessToken) return;
      
      const [permissionsRes, permissionSetsRes, templatesRes] = await Promise.all([
        getPermissions(businessId, session.accessToken),
        getPermissionSets(businessId, session.accessToken),
        getTemplatePermissionSets(session.accessToken)
      ]);

      if (permissionsRes.success) {
        setPermissions(permissionsRes.data);
      }
      if (permissionSetsRes.success) {
        setPermissionSets(permissionSetsRes.data);
      }
      if (templatesRes.success) {
        setTemplatePermissionSets(templatesRes.data);
      }
    } catch (error) {
      console.error('Error loading permission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const startEdit = (mode: EditMode, action: EditAction, item?: PermissionSet) => {
    setEditMode(mode);
    setEditAction(action);
    setEditingItem(item || null);
    
    if (action === 'edit' && item) {
      setPermissionSetForm({
        name: item.name,
        description: item.description,
        permissions: (item.permissions || []).reduce((acc, perm) => {
          acc[perm.id] = true;
          return acc;
        }, {} as Record<string, boolean>)
      });
      setSelectedPermissions((item.permissions || []).reduce((acc, perm) => {
        acc[perm.id] = true;
        return acc;
      }, {} as Record<string, boolean>));
    } else {
      setPermissionSetForm({
        name: '',
        description: '',
        permissions: {}
      });
      setSelectedPermissions({});
    }
  };

  const cancelEdit = () => {
    setEditMode('none');
    setEditAction('create');
    setEditingItem(null);
  };

  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [permissionId]: checked
    }));
  };

  const handlePermissionSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    setLoading(true);
    try {
      const permissions = Object.entries(permissionSetForm.permissions)
        .filter(([_, enabled]) => enabled)
        .map(([permissionId, _]) => ({ 
          id: permissionId,
          name: '',
          description: '',
          moduleId: '',
          category: 'basic' as const,
          action: '',
          resource: ''
        }));

      const data: CreatePermissionSetData = {
        businessId,
        name: permissionSetForm.name,
        description: permissionSetForm.description,
        permissions: permissions,
        isTemplate: false
      };

      if (editAction === 'create') {
        await createPermissionSet(data, session.accessToken);
      } else {
        await updatePermissionSet(editingItem!.id, data, session.accessToken);
      }
      
      onUpdate();
      cancelEdit();
    } catch (error) {
      console.error('Error saving permission set:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTemplate = async (templateId: string, newName: string) => {
    if (!session?.accessToken) return;

    setLoading(true);
    try {
      await copyPermissionSet(templateId, newName, businessId, session.accessToken);
      onUpdate();
    } catch (error) {
      console.error('Error copying template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session?.accessToken || !confirm('Are you sure you want to delete this permission set?')) return;

    setLoading(true);
    try {
      await deletePermissionSet(id, session.accessToken);
      onUpdate();
    } catch (error) {
      console.error('Error deleting permission set:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermissionCount = (permissionSet: PermissionSet) => {
    const perms = permissionSet.permissions || [];
    return perms.length;
  };

  const getPermissionStatus = (permissionId: string, permissionSet: PermissionSet) => {
    const perms = permissionSet.permissions || [];
    return perms.some(perm => perm.id === permissionId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Permission Management</h2>
          <p className="text-gray-600">Manage access control and role-based permissions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            onClick={() => startEdit('permission-set', 'create')}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Permission Set</span>
          </Button>
        </div>
      </div>

      {/* Permission Sets */}
      <Card>
        <div className="p-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('permission-sets')}
          >
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">Permission Sets</h3>
              <Badge color="blue">{permissionSets.length}</Badge>
            </div>
            {expandedSections.has('permission-sets') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {expandedSections.has('permission-sets') && (
            <div className="mt-4 space-y-4">
              {permissionSets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No permission sets created yet</p>
                  <Button
                    variant="secondary"
                    onClick={() => startEdit('permission-set', 'create')}
                    className="mt-2"
                  >
                    Create First Permission Set
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {permissionSets.map((permissionSet) => (
                    <div key={permissionSet.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-gray-50">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-blue-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">{permissionSet.name}</h4>
                            {permissionSet.description && (
                              <p className="text-sm text-gray-600">{permissionSet.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge color="green">{getPermissionCount(permissionSet)} permissions</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit('permission-set', 'edit', permissionSet)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(permissionSet.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Permission Details */}
                      <div className="p-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(modulePermissions).map(([moduleId, module]) => (
                            <div key={moduleId} className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{module.icon}</span>
                                <h5 className="font-medium text-gray-900">{module.name}</h5>
                              </div>
                              <div className="space-y-1">
                                {module.permissions.map((perm) => (
                                  <div key={perm.id} className="flex items-center space-x-2 text-sm">
                                    {getPermissionStatus(perm.id, permissionSet) ? (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-gray-300" />
                                    )}
                                    <span className={getPermissionStatus(perm.id, permissionSet) ? 'text-gray-900' : 'text-gray-500'}>
                                      {perm.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Template Permission Sets */}
      <Card>
        <div className="p-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('templates')}
          >
            <div className="flex items-center space-x-3">
              <Copy className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-medium text-gray-900">Template Permission Sets</h3>
              <Badge color="green">{templatePermissionSets.length}</Badge>
            </div>
            {expandedSections.has('templates') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {expandedSections.has('templates') && (
            <div className="mt-4 space-y-4">
              {templatePermissionSets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Copy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No template permission sets available</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {templatePermissionSets.map((template) => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-green-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            {template.description && (
                              <p className="text-sm text-gray-600">{template.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge color="green">{getPermissionCount(template)} permissions</Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const newName = prompt('Enter a name for the copied permission set:', `${template.name} Copy`);
                              if (newName) {
                                handleCopyTemplate(template.id, newName);
                              }
                            }}
                            className="flex items-center space-x-2"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copy</span>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Template Permission Preview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(modulePermissions).map(([moduleId, module]) => (
                          <div key={moduleId} className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{module.icon}</span>
                              <h5 className="font-medium text-gray-900">{module.name}</h5>
                            </div>
                            <div className="space-y-1">
                              {module.permissions.map((perm) => (
                                <div key={perm.id} className="flex items-center space-x-2 text-sm">
                                  {getPermissionStatus(perm.id, template) ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-300" />
                                  )}
                                  <span className={getPermissionStatus(perm.id, template) ? 'text-gray-900' : 'text-gray-500'}>
                                    {perm.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Department Module Assignment */}
      <Card>
        <div className="p-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('department-modules')}
          >
            <div className="flex items-center space-x-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Department Module Access</h3>
              <Badge color="blue">{orgChartData.departments.length}</Badge>
            </div>
            {expandedSections.has('department-modules') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
          
          {expandedSections.has('department-modules') && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-gray-600">
                Assign specific modules to departments. Employees in each department will only see modules assigned to their department.
              </p>
              
              {orgChartData.departments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No departments found. Create departments in the Organization Chart tab first.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orgChartData.departments.map((department) => (
                    <div key={department.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{department.name}</h4>
                        <Badge color="blue">{department.positions?.length || 0} positions</Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Available Modules
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.keys(modulePermissions).map((moduleId) => (
                            <label key={moduleId} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                // TODO: Connect to actual department module assignment
                                defaultChecked={false}
                              />
                              <span className="text-sm text-gray-700">
                                {(modulePermissions as any)[moduleId]?.name || moduleId}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Edit Permission Set Modal */}
      {editMode === 'permission-set' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editAction === 'create' ? 'Create New Permission Set' : 'Edit Permission Set'}
            </h3>
            <form onSubmit={handlePermissionSetSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Permission Set Name
                  </label>
                  <Input
                    value={permissionSetForm.name}
                    onChange={(e) => setPermissionSetForm({ ...permissionSetForm, name: e.target.value })}
                    placeholder="e.g., Manager Access, Employee Access"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Input
                    value={permissionSetForm.description}
                    onChange={(e) => setPermissionSetForm({ ...permissionSetForm, description: e.target.value })}
                    placeholder="Description of this permission set"
                  />
                </div>
              </div>

              {/* Permission Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Permissions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(modulePermissions).map(([moduleId, module]) => (
                    <div key={moduleId} className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        <span className="text-lg">{module.icon}</span>
                        <h4 className="font-medium text-gray-900">{module.name}</h4>
                      </div>
                      <div className="space-y-2 pl-3">
                        {module.permissions.map((perm) => (
                          <label key={perm.id} className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              checked={selectedPermissions[perm.id] || false}
                              onChange={(e) => handlePermissionToggle(perm.id, e.target.checked)}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{perm.name}</div>
                              <div className="text-xs text-gray-500">{perm.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" onClick={cancelEdit} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Spinner size={16} /> : (editAction === 'create' ? 'Create' : 'Save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
