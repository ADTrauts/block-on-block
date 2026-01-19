'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { authenticatedApiCall } from '../../lib/apiUtils';
import { getInstalledModules } from '../../api/modules';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Users,
  Calendar,
  Puzzle,
  Folder,
  Building2,
  User,
  Tag,
  X,
  Lightbulb,
  Sparkles
} from 'lucide-react';

interface UserAIContext {
  id: string;
  userId: string;
  scope: 'personal' | 'business' | 'module' | 'folder' | 'project';
  scopeId?: string | null;
  moduleId?: string | null;
  contextType: 'instruction' | 'fact' | 'preference' | 'workflow';
  title: string;
  content: string;
  tags: string[];
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Module {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
}

interface Business {
  id: string;
  name: string;
}

export default function CustomContext() {
  const { data: session } = useSession();
  const [contexts, setContexts] = useState<UserAIContext[]>([]);
  const [personalModules, setPersonalModules] = useState<Module[]>([]);
  const [businessModulesMap, setBusinessModulesMap] = useState<Record<string, Module[]>>({});
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['personal', 'modules']));
  const [editingContext, setEditingContext] = useState<UserAIContext | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedScope, setSelectedScope] = useState<'personal' | 'business' | 'module' | 'folder' | 'project'>('personal');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load dismissed suggestions from localStorage
    const dismissed = localStorage.getItem('ai-context-dismissed-suggestions');
    if (dismissed) {
      try {
        setDismissedSuggestions(new Set(JSON.parse(dismissed)));
      } catch (err) {
        console.warn('Failed to parse dismissed suggestions:', err);
      }
    }
    
    if (session?.accessToken) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      // Load contexts
      const contextsResponse = await authenticatedApiCall<{ success: boolean; data: UserAIContext[] }>(
        '/api/ai/context',
        { method: 'GET' },
        session.accessToken
      );
      if (contextsResponse.success && Array.isArray(contextsResponse.data)) {
        setContexts(contextsResponse.data);
      } else {
        setContexts([]); // Ensure contexts is always an array
      }

      // Load personal modules
      const personalMods = await getInstalledModules({ scope: 'personal' });
      setPersonalModules(personalMods);

      // Load businesses (for business scope)
      let loadedBusinesses: Business[] = [];
      try {
        const businessesResponse = await authenticatedApiCall<{ success: boolean; data: Business[] }>(
          '/api/business',
          { method: 'GET' },
          session.accessToken
        );
        if (businessesResponse.success && Array.isArray(businessesResponse.data)) {
          loadedBusinesses = businessesResponse.data;
          setBusinesses(loadedBusinesses);
        }
      } catch (err) {
        console.warn('Failed to load businesses:', err);
      }

      // Load business modules for each business
      const modulesMap: Record<string, Module[]> = {};
      for (const business of loadedBusinesses) {
        try {
          const businessMods = await getInstalledModules({ 
            scope: 'business', 
            businessId: business.id 
          });
          modulesMap[business.id] = businessMods;
        } catch (err) {
          console.warn(`Failed to load modules for business ${business.id}:`, err);
          modulesMap[business.id] = [];
        }
      }
      setBusinessModulesMap(modulesMap);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load context data. Please try again.');
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

  const handleDelete = async (id: string) => {
    if (!session?.accessToken || !confirm('Are you sure you want to delete this context entry?')) {
      return;
    }

    try {
      await authenticatedApiCall(
        `/api/ai/context/${id}`,
        { method: 'DELETE' },
        session.accessToken
      );
      await loadData();
    } catch (err) {
      console.error('Error deleting context:', err);
      setError('Failed to delete context entry.');
    }
  };

  const handleSave = async (data: Partial<UserAIContext>) => {
    if (!session?.accessToken) return;

    try {
      if (editingContext) {
        // Update
        await authenticatedApiCall(
          `/api/ai/context/${editingContext.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          },
          session.accessToken
        );
      } else {
        // Create
        await authenticatedApiCall(
          '/api/ai/context',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          },
          session.accessToken
        );
      }
      setShowAddModal(false);
      setEditingContext(null);
      await loadData();
    } catch (err) {
      console.error('Error saving context:', err);
      setError('Failed to save context entry.');
    }
  };

  const getModuleIcon = (moduleId: string) => {
    switch (moduleId.toLowerCase()) {
      case 'drive':
        return <FileText className="w-5 h-5" />;
      case 'chat':
        return <Users className="w-5 h-5" />;
      case 'calendar':
        return <Calendar className="w-5 h-5" />;
      default:
        return <Puzzle className="w-5 h-5" />;
    }
  };

  const getContextsByScope = (scope: string, moduleId?: string) => {
    if (!Array.isArray(contexts)) {
      return [];
    }
    return contexts.filter(ctx => {
      if (ctx.scope !== scope) return false;
      if (moduleId && ctx.moduleId !== moduleId) return false;
      return true;
    });
  };

  // Keep modules separate by scope - don't combine them
  // Personal modules are only for personal scope
  // Business modules are only for their respective business scope

  // Check if user has any contexts (if not, show suggestions)
  const hasAnyContexts = contexts.length > 0;
  const shouldShowSuggestions = !hasAnyContexts;

  const dismissSuggestion = (suggestionId: string) => {
    const newDismissed = new Set(dismissedSuggestions);
    newDismissed.add(suggestionId);
    setDismissedSuggestions(newDismissed);
    localStorage.setItem('ai-context-dismissed-suggestions', JSON.stringify(Array.from(newDismissed)));
  };

  // Suggestion content based on section
  const getSuggestionForSection = (section: string) => {
    const suggestions: Record<string, { title: string; content: string; action?: string }> = {
      personal: {
        title: 'Add Personal Context',
        content: 'Tell your AI about your preferences, work style, and how you like things done. This helps it understand you better across all modules.',
        action: 'Add personal context'
      },
      business: {
        title: 'Business-Specific Context',
        content: 'Add context that applies to a specific business. Perfect for company policies, team preferences, or business workflows.',
        action: 'Add business context'
      },
      personalModules: {
        title: 'Module-Specific Instructions',
        content: 'Give your AI specific instructions for how to work with your personal modules. For example, "Always organize File Hub files by project name."',
        action: 'Add module context'
      },
      businessModules: {
        title: 'Business Module Context',
        content: 'Add context for how your AI should handle business modules. Great for team workflows and business-specific processes.',
        action: 'Add business module context'
      }
    };
    return suggestions[section];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Custom Context</h2>
          <p className="text-gray-600 mt-1">
            Add custom instructions and context to help your AI understand your preferences and workflows
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingContext(null);
            setSelectedScope('personal');
            setSelectedModuleId(null);
            setSelectedBusinessId(null);
            setShowAddModal(true);
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Context
        </Button>
      </div>

      {/* Personal Context Section */}
      <Card className="p-6 relative">
        {shouldShowSuggestions && !dismissedSuggestions.has('personal') && expandedSections.has('personal') && (
          <SuggestionBubble
            title={getSuggestionForSection('personal')?.title || ''}
            content={getSuggestionForSection('personal')?.content || ''}
            action={getSuggestionForSection('personal')?.action}
            onDismiss={() => dismissSuggestion('personal')}
            onAction={() => {
              setEditingContext(null);
              setSelectedScope('personal');
              setSelectedModuleId(null);
              setSelectedBusinessId(null);
              setShowAddModal(true);
            }}
            position="top-right"
          />
        )}
        <button
          onClick={() => toggleSection('personal')}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has('personal') ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Personal Context</h3>
            <Badge color="blue" size="sm">
              {getContextsByScope('personal').length}
            </Badge>
          </div>
        </button>

        {expandedSections.has('personal') && (
          <div className="mt-4 space-y-3">
            {getContextsByScope('personal').length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No personal context entries yet.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setEditingContext(null);
                    setSelectedScope('personal');
                    setShowAddModal(true);
                  }}
                >
                  Add Personal Context
                </Button>
              </div>
            ) : (
              getContextsByScope('personal').map(context => (
                <ContextEntry
                  key={context.id}
                  context={context}
                  onEdit={() => {
                    setEditingContext(context);
                    setSelectedScope(context.scope);
                    setShowAddModal(true);
                  }}
                  onDelete={() => handleDelete(context.id)}
                />
              ))
            )}
          </div>
        )}
      </Card>

      {/* Business Context Section */}
      {businesses.length > 0 && (
        <Card className="p-6 relative">
          {shouldShowSuggestions && !dismissedSuggestions.has('business') && expandedSections.has('business') && (
            <SuggestionBubble
              title="Business-Specific Context"
              content="Add context that applies to a specific business. Perfect for company policies, team preferences, or business workflows."
              action="Add business context"
              onDismiss={() => dismissSuggestion('business')}
              onAction={() => {
                setEditingContext(null);
                setSelectedScope('business');
                setSelectedModuleId(null);
                setSelectedBusinessId(businesses[0]?.id || null);
                setShowAddModal(true);
              }}
              position="top-right"
            />
          )}
          <button
            onClick={() => toggleSection('business')}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('business') ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
              <Building2 className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
              <Badge color="green" size="sm">
                {getContextsByScope('business').length}
              </Badge>
            </div>
          </button>

          {expandedSections.has('business') && (
            <div className="mt-4 space-y-4">
              {businesses.map(business => {
                const businessContexts = contexts.filter(
                  ctx => ctx.scope === 'business' && ctx.scopeId === business.id
                );
                return (
                  <div key={business.id} className="border-l-2 border-gray-200 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{business.name}</h4>
                      <Badge color="gray" size="sm">{businessContexts.length}</Badge>
                    </div>
                    {businessContexts.length === 0 ? (
                      <p className="text-sm text-gray-500">No context entries for this business.</p>
                    ) : (
                      <div className="space-y-2">
                        {businessContexts.map(context => (
                          <ContextEntry
                            key={context.id}
                            context={context}
                            onEdit={() => {
                              setEditingContext(context);
                              setSelectedScope(context.scope);
                              setSelectedBusinessId(context.scopeId || null);
                              setShowAddModal(true);
                            }}
                            onDelete={() => handleDelete(context.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Module Context Section - Personal Modules */}
      {personalModules.length > 0 && (
        <Card className="p-6 relative">
          {shouldShowSuggestions && !dismissedSuggestions.has('personalModules') && expandedSections.has('personal-modules') && (
            <SuggestionBubble
              title="Module-Specific Instructions"
              content="Give your AI specific instructions for how to work with your personal modules. For example, 'Always organize File Hub files by project name.'"
              action="Add module context"
              onDismiss={() => dismissSuggestion('personalModules')}
              onAction={() => {
                setEditingContext(null);
                setSelectedScope('module');
                setSelectedModuleId(personalModules[0]?.id || null);
                setSelectedBusinessId(null);
                setShowAddModal(true);
              }}
              position="top-right"
            />
          )}
          <button
            onClick={() => toggleSection('personal-modules')}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('personal-modules') ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
              <Puzzle className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Personal Module Context</h3>
              <Badge color="blue" size="sm">
                {getContextsByScope('module').filter(ctx => 
                  personalModules.some(m => m.id === ctx.moduleId)
                ).length}
              </Badge>
            </div>
          </button>

          {expandedSections.has('personal-modules') && (
            <div className="mt-4 space-y-4">
              {personalModules.map(module => {
                const moduleContexts = getContextsByScope('module', module.id).filter(ctx =>
                  !ctx.scopeId // Personal module contexts don't have scopeId
                );
                return (
                  <div key={module.id} className="border-l-2 border-gray-200 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getModuleIcon(module.id)}
                        <h4 className="font-medium text-gray-900">{module.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color="gray" size="sm">{moduleContexts.length}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingContext(null);
                            setSelectedScope('module');
                            setSelectedModuleId(module.id);
                            setShowAddModal(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                    {moduleContexts.length === 0 ? (
                      <p className="text-sm text-gray-500">No context entries for this module.</p>
                    ) : (
                      <div className="space-y-2">
                        {moduleContexts.map(context => (
                          <ContextEntry
                            key={context.id}
                            context={context}
                            onEdit={() => {
                              setEditingContext(context);
                              setSelectedScope(context.scope);
                              setSelectedModuleId(context.moduleId || null);
                              setShowAddModal(true);
                            }}
                            onDelete={() => handleDelete(context.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Module Context Section - Business Modules */}
      {businesses.length > 0 && Object.keys(businessModulesMap).length > 0 && (
        <Card className="p-6">
          <button
            onClick={() => toggleSection('business-modules')}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has('business-modules') ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
              <Puzzle className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Business Module Context</h3>
              <Badge color="blue" size="sm">
                {getContextsByScope('module').filter(ctx => 
                  ctx.scopeId && businesses.some(b => b.id === ctx.scopeId)
                ).length}
              </Badge>
            </div>
          </button>

          {expandedSections.has('business-modules') && (
            <div className="mt-4 space-y-4">
              {businesses.map(business => {
                const businessModulesForBusiness = businessModulesMap[business.id] || [];
                const businessModuleContexts = getContextsByScope('module').filter(ctx => 
                  ctx.scopeId === business.id
                );
                
                if (businessModulesForBusiness.length === 0) {
                  return null;
                }
                
                return (
                  <div key={business.id} className="border-l-2 border-gray-200 pl-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{business.name}</h4>
                      <Badge color="gray" size="sm">
                        {businessModuleContexts.length} context entries
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {businessModulesForBusiness.map(module => {
                        const moduleContexts = getContextsByScope('module', module.id).filter(ctx =>
                          ctx.scopeId === business.id
                        );
                        return (
                          <div key={module.id} className="ml-4 border-l-2 border-gray-100 pl-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getModuleIcon(module.id)}
                                <h5 className="font-medium text-gray-700">{module.name}</h5>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge color="gray" size="sm">{moduleContexts.length}</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingContext(null);
                                    setSelectedScope('module');
                                    setSelectedModuleId(module.id);
                                    setSelectedBusinessId(business.id);
                                    setShowAddModal(true);
                                  }}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add
                                </Button>
                              </div>
                            </div>
                            {moduleContexts.length === 0 ? (
                              <p className="text-sm text-gray-500">No context entries for this module.</p>
                            ) : (
                              <div className="space-y-2">
                                {moduleContexts.map(context => (
                                  <ContextEntry
                                    key={context.id}
                                    context={context}
                                    onEdit={() => {
                                      setEditingContext(context);
                                      setSelectedScope(context.scope);
                                      setSelectedModuleId(context.moduleId || null);
                                      setSelectedBusinessId(context.scopeId || null);
                                      setShowAddModal(true);
                                    }}
                                    onDelete={() => handleDelete(context.id)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AddContextModal
          context={editingContext}
          scope={selectedScope as 'personal' | 'business' | 'module' | 'folder'}
          moduleId={selectedModuleId}
          businessId={selectedBusinessId}
          personalModules={personalModules}
          businessModulesMap={businessModulesMap}
          businesses={businesses}
          onClose={() => {
            setShowAddModal(false);
            setEditingContext(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// Context Entry Component
function ContextEntry({ 
  context, 
  onEdit, 
  onDelete 
}: { 
  context: UserAIContext; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  return (
    <Card className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-gray-900">{context.title}</h4>
            <Badge 
              color={
                context.contextType === 'instruction' ? 'blue' :
                context.contextType === 'preference' ? 'green' :
                context.contextType === 'workflow' ? 'blue' : 'gray'
              }
              size="sm"
            >
              {context.contextType}
            </Badge>
            {!context.active && (
              <Badge color="gray" size="sm">Inactive</Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{context.content}</p>
          {context.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {context.tags.map(tag => (
                <Badge key={tag} color="gray" size="sm">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Add/Edit Context Modal
function AddContextModal({
  context,
  scope,
  moduleId,
  businessId,
  personalModules,
  businessModulesMap,
  businesses,
  onClose,
  onSave
}: {
  context: UserAIContext | null;
  scope: 'personal' | 'business' | 'module' | 'folder';
  moduleId: string | null;
  businessId: string | null;
  personalModules: Module[];
  businessModulesMap: Record<string, Module[]>;
  businesses: Business[];
  onClose: () => void;
  onSave: (data: Partial<UserAIContext>) => Promise<void>;
}) {
  const [title, setTitle] = useState(context?.title || '');
  const [content, setContent] = useState(context?.content || '');
  const [contextType, setContextType] = useState<'instruction' | 'fact' | 'preference' | 'workflow'>(
    context?.contextType || 'instruction'
  );
  const [tags, setTags] = useState<string[]>(context?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [priority, setPriority] = useState(context?.priority ?? 50);
  const [active, setActive] = useState(context?.active ?? true);
  const [selectedScope, setSelectedScope] = useState<'personal' | 'business' | 'module' | 'folder' | 'project'>(scope);
  const [selectedModuleId, setSelectedModuleId] = useState(moduleId);
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId);
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Determine which modules to show based on scope
  const availableModules = useMemo(() => {
    if (selectedScope === 'module') {
      // If business is selected, show that business's modules
      if (selectedBusinessId) {
        return businessModulesMap[selectedBusinessId] || [];
      }
      // Otherwise show personal modules
      return personalModules;
    }
    if (selectedScope === 'business' && selectedBusinessId) {
      return businessModulesMap[selectedBusinessId] || [];
    }
    return [];
  }, [selectedScope, selectedBusinessId, personalModules, businessModulesMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const data: Partial<UserAIContext> = {
      scope: selectedScope,
      // For module scope with business, set scopeId to businessId
      scopeId: selectedScope === 'business' 
        ? selectedBusinessId || undefined 
        : (selectedScope === 'module' && selectedBusinessId) 
          ? selectedBusinessId 
          : undefined,
      moduleId: selectedScope === 'module' ? selectedModuleId || undefined : undefined,
      contextType,
      title,
      content,
      tags,
      priority,
      active
    };

    await onSave(data);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {context ? 'Edit Context' : 'Add Context'}
            </h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Scope Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scope
              </label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value as typeof selectedScope)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="personal">Personal</option>
                <option value="business">Business</option>
                <option value="module">Module</option>
                <option value="folder">Folder</option>
              </select>
            </div>

            {/* Business Selection */}
            {selectedScope === 'business' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business
                </label>
                <select
                  value={selectedBusinessId || ''}
                  onChange={(e) => setSelectedBusinessId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select a business</option>
                  {businesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Business Selection for Module Scope */}
            {selectedScope === 'module' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business (Optional - leave empty for personal module context)
                </label>
                <select
                  value={selectedBusinessId || ''}
                  onChange={(e) => {
                    setSelectedBusinessId(e.target.value || null);
                    setSelectedModuleId(null); // Reset module when business changes
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Personal (No Business)</option>
                  {businesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Module Selection */}
            {selectedScope === 'module' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module
                </label>
                <select
                  value={selectedModuleId || ''}
                  onChange={(e) => setSelectedModuleId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  disabled={availableModules.length === 0}
                >
                  <option value="">
                    {availableModules.length === 0 
                      ? selectedBusinessId 
                        ? 'No modules installed for this business' 
                        : 'No personal modules installed'
                      : 'Select a module'}
                  </option>
                  {availableModules.map(module => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </select>
                {availableModules.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedBusinessId 
                      ? 'This business has no modules installed. Install modules from the Modules page.'
                      : 'You have no personal modules installed. Install modules from the Modules page.'}
                  </p>
                )}
              </div>
            )}

            {/* Context Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context Type
              </label>
              <select
                value={contextType}
                onChange={(e) => setContextType(e.target.value as typeof contextType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="instruction">Instruction</option>
                <option value="fact">Fact</option>
                <option value="preference">Preference</option>
                <option value="workflow">Workflow</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                placeholder="e.g., Always organize PDFs in Documents folder"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={4}
                required
                placeholder="Describe what the AI should remember..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Add a tag and press Enter"
                />
                <Button type="button" variant="secondary" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge key={tag} color="gray" size="sm">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority: {priority}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="active" className="text-sm font-medium text-gray-700">
                Active (AI will use this context)
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : context ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

// Suggestion Bubble Component
function SuggestionBubble({
  title,
  content,
  action,
  onDismiss,
  onAction,
  position = 'top-right'
}: {
  title: string;
  content: string;
  action?: string;
  onDismiss: () => void;
  onAction?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`absolute ${positionClasses[position]} z-10 max-w-sm`}>
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg shadow-lg p-4 relative">
        {/* Sparkle decoration */}
        <div className="absolute -top-2 -right-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
        </div>
        
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss suggestion"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="pr-6">
          <div className="flex items-start gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <h4 className="font-semibold text-gray-900">{title}</h4>
          </div>
          <p className="text-sm text-gray-700 mb-3">{content}</p>
          {action && onAction && (
            <Button
              size="sm"
              variant="primary"
              onClick={onAction}
              className="w-full"
            >
              {action}
            </Button>
          )}
        </div>

        {/* Arrow pointing down */}
        <div className="absolute bottom-0 left-6 transform translate-y-full">
          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-200" />
        </div>
      </div>
    </div>
  );
}

