'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Badge, Input, Textarea, Modal } from 'shared/components';
import { Plus, X, Edit, Trash2, Folder, Palette } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as todoAPI from '@/api/todo';
import type { TaskProject } from '@/api/todo';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
  businessId?: string | null;
  selectedProjectId?: string | null;
  onProjectSelect?: (projectId: string | null) => void;
  onProjectsChange?: () => void;
}

const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export function ProjectManager({
  isOpen,
  onClose,
  dashboardId,
  businessId,
  selectedProjectId,
  onProjectSelect,
  onProjectsChange,
}: ProjectManagerProps) {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<TaskProject | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PROJECT_COLORS[0],
  });

  useEffect(() => {
    if (isOpen && session?.accessToken) {
      loadProjects();
    }
  }, [isOpen, session?.accessToken, dashboardId, businessId]);

  const loadProjects = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const fetchedProjects = await todoAPI.getProjects(
        session.accessToken,
        dashboardId,
        businessId || undefined
      );
      setProjects(fetchedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!session?.accessToken || !formData.name.trim()) return;
    try {
      await todoAPI.createProject(session.accessToken, {
        name: formData.name,
        description: formData.description || undefined,
        dashboardId,
        businessId: businessId || undefined,
        color: formData.color,
      });
      toast.success('Project created');
      setShowCreateModal(false);
      setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
      await loadProjects();
      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    }
  };

  const handleUpdate = async () => {
    if (!session?.accessToken || !editingProject || !formData.name.trim()) return;
    try {
      await todoAPI.updateProject(session.accessToken, editingProject.id, {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
      });
      toast.success('Project updated');
      setEditingProject(null);
      setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
      await loadProjects();
      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error('Failed to update project');
    }
  };

  const handleDelete = async (project: TaskProject) => {
    if (!session?.accessToken) return;
    if (!confirm(`Delete project "${project.name}"? Tasks will be unassigned from this project.`)) return;
    try {
      await todoAPI.deleteProject(session.accessToken, project.id);
      toast.success('Project deleted');
      await loadProjects();
      if (onProjectsChange) {
        onProjectsChange();
      }
      if (selectedProjectId === project.id && onProjectSelect) {
        onProjectSelect(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  };

  const handleEdit = (project: TaskProject) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      color: project.color || PROJECT_COLORS[0],
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Projects</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingProject(null);
                setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
                setShowCreateModal(true);
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant={selectedProjectId === null ? 'primary' : 'ghost'}
            size="sm"
            className="w-full justify-start"
            onClick={() => onProjectSelect?.(null)}
          >
            All Tasks
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="text-sm text-gray-500 text-center py-4">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              No projects yet
              <br />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingProject(null);
                  setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
                  setShowCreateModal(true);
                }}
                className="mt-2"
              >
                Create one
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`group flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                    selectedProjectId === project.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => onProjectSelect?.(project.id)}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color || PROJECT_COLORS[0] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{project.name}</div>
                    {project._count && project._count.tasks > 0 && (
                      <div className="text-xs text-gray-500">{project._count.tasks} tasks</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(project);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project);
                      }}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingProject) && (
        <Modal
          open={true}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProject(null);
            setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
          }}
          title={editingProject ? 'Edit Project' : 'Create Project'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color
                        ? 'border-gray-900 scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProject(null);
                  setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={editingProject ? handleUpdate : handleCreate}
                disabled={!formData.name.trim()}
              >
                {editingProject ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

