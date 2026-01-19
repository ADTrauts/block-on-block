
'use client';

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { SidebarFolder } from '../../types/sidebar';
import type { ModuleConfig } from '../../config/modules';
import { LayoutDashboard, Folder, MessageSquare, Users, BarChart3, Brain, Calendar, CheckSquare } from 'lucide-react';

// Module icons mapping (mirrored from DashboardLayout)
const MODULE_ICONS: Record<string, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  drive: Folder,
  chat: MessageSquare,
  members: Users,
  analytics: BarChart3,
  connections: Users,
  ai: Brain,
  calendar: Calendar,
  todo: CheckSquare,
};

interface SidebarFolderRendererProps {
  folder: SidebarFolder;
  modules: ModuleConfig[];
  onToggleCollapse: (folderId: string) => void;
  onModuleClick: (moduleId: string) => void;
  activeModuleId?: string;
  textColor?: string;
}

export function SidebarFolderRenderer({
  folder,
  modules,
  onToggleCollapse,
  onModuleClick,
  activeModuleId,
  textColor = '#fff',
}: SidebarFolderRendererProps) {
  // Get modules in this folder
  const folderModules = folder.modules
    .sort((a, b) => a.order - b.order)
    .map(ref => modules.find(m => m.id === ref.id))
    .filter((m): m is ModuleConfig => m !== undefined);

  const FolderIcon = folder.icon ? 
    (() => {
      // Map icon names to lucide-react icons (simplified)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const iconMap: Record<string, React.ComponentType<any>> = {
        grid: Folder,
        users: Folder,
        messageSquare: Folder,
        briefcase: Folder,
        building: Folder,
      };
      return iconMap[folder.icon] || Folder;
    })() : Folder;

  return (
    <li style={{ marginBottom: 8 }}>
      {/* Folder Header */}
      <button
        onClick={() => onToggleCollapse(folder.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'transparent',
          color: textColor,
          textDecoration: 'none',
          gap: 8,
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {folder.collapsed ? (
          <ChevronRight size={16} />
        ) : (
          <ChevronDown size={16} />
        )}
        <FolderIcon size={18} />
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{folder.name}</span>
      </button>

      {/* Modules inside folder */}
      {!folder.collapsed && folderModules.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginLeft: 24, marginTop: 4 }}>
          {folderModules.map(module => {
            const Icon = MODULE_ICONS[module.id] || LayoutDashboard;
            const isActive = activeModuleId === module.id;
            return (
              <li key={module.id} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => onModuleClick(module.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: textColor,
                    textDecoration: 'none',
                    gap: 10,
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '13px',
                  }}
                >
                  <Icon size={18} />
                  <span>{module.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

