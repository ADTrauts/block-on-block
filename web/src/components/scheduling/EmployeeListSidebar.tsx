'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Users, Briefcase, MapPin, User } from 'lucide-react';

type LayoutMode = 'employee' | 'position' | 'station';

interface Employee {
  id: string;
  name: string;
  position?: string;
  email?: string;
}

interface Position {
  id: string;
  title?: string;
  name?: string;
}

interface Station {
  id: string;
  name: string;
  stationType?: string;
}

type ResourceTab = 'employees' | 'positions' | 'stations';

interface BuilderResourceSidebarProps {
  employees: Employee[];
  positions: Position[];
  stations: Station[];
  layoutMode: LayoutMode;
}

interface DraggableResourceProps {
  id: string;
  label: string;
  subLabel?: string;
  type: 'employee' | 'position' | 'station';
  data: Employee | Position | Station;
}

function DraggableResourceCard({ id, label, subLabel, type, data }: DraggableResourceProps) {
  const dragPayload =
    type === 'employee'
      ? { type: 'employee' as const, employee: data as Employee }
      : type === 'position'
      ? { type: 'position' as const, position: data as Position }
      : { type: 'station' as const, station: data as Station };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: dragPayload,
  });

  const Icon = type === 'employee' ? User : type === 'position' ? Briefcase : MapPin;

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        p-3 rounded-lg border border-gray-200 bg-white cursor-grab active:cursor-grabbing
        hover:border-blue-400 hover:shadow-md transition-all
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
      `}
    >
      <div className="flex items-center space-x-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${type === 'station' ? 'bg-purple-100' : type === 'position' ? 'bg-amber-100' : 'bg-blue-100'} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${type === 'station' ? 'text-purple-600' : type === 'position' ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
          {subLabel && (
            <p className="text-xs text-gray-500 truncate">
              {subLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployeeListSidebar({
  employees,
  positions,
  stations,
  layoutMode,
}: BuilderResourceSidebarProps) {
  const layoutTabMap: Record<LayoutMode, ResourceTab> = {
    employee: 'employees',
    position: 'positions',
    station: 'stations',
  };

  const [activeTab, setActiveTab] = useState<ResourceTab>(layoutTabMap[layoutMode]);

  useEffect(() => {
    setActiveTab(layoutTabMap[layoutMode]);
  }, [layoutMode]);

  const tabConfigs = useMemo(() => ([
    {
      id: 'employees' as ResourceTab,
      label: 'Employees',
      icon: Users,
      items: employees,
      emptyTitle: 'No employees yet',
      emptySubtitle: 'Invite employees from Org Chart to start scheduling.',
      getProps: (item: Employee) => ({
        id: `employee-${item.id}`,
        label: item.name,
        subLabel: item.position,
        type: 'employee' as const,
        data: item,
      }),
    },
    {
      id: 'positions' as ResourceTab,
      label: 'Positions',
      icon: Briefcase,
      items: positions,
      emptyTitle: 'No positions yet',
      emptySubtitle: 'Create positions from settings or the filters sidebar.',
      getProps: (item: Position) => ({
        id: `position-${item.id}`,
        label: item.title || item.name || 'Untitled position',
        subLabel: item.name && item.title && item.title !== item.name ? item.name : undefined,
        type: 'position' as const,
        data: item,
      }),
    },
    {
      id: 'stations' as ResourceTab,
      label: 'Stations',
      icon: MapPin,
      items: stations,
      emptyTitle: 'No stations yet',
      emptySubtitle: 'Add stations from settings or the filters sidebar.',
      getProps: (item: Station) => ({
        id: `station-${item.id}`,
        label: item.name,
        subLabel: item.stationType,
        type: 'station' as const,
        data: item,
      }),
    },
  ]), [employees, positions, stations]);

  const activeConfig = tabConfigs.find((tab) => tab.id === activeTab) ?? tabConfigs[0];

  const renderContent = () => {
    if (activeTab === 'employees') {
      const config = tabConfigs[0];
      if (config.items.length === 0) {
        return (
          <div className="text-center py-10 px-4 border border-dashed border-gray-200 rounded-lg bg-gray-50">
            <config.icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">{config.emptyTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{config.emptySubtitle}</p>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          {(config.items as Employee[]).map((item) => (
            <DraggableResourceCard key={item.id} {...(config.getProps as (item: Employee) => DraggableResourceProps)(item)} />
          ))}
        </div>
      );
    } else if (activeTab === 'positions') {
      const config = tabConfigs[1];
      if (config.items.length === 0) {
        return (
          <div className="text-center py-10 px-4 border border-dashed border-gray-200 rounded-lg bg-gray-50">
            <config.icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">{config.emptyTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{config.emptySubtitle}</p>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          {(config.items as Position[]).map((item) => (
            <DraggableResourceCard key={item.id} {...(config.getProps as (item: Position) => DraggableResourceProps)(item)} />
          ))}
        </div>
      );
    } else {
      const config = tabConfigs[2];
      if (config.items.length === 0) {
        return (
          <div className="text-center py-10 px-4 border border-dashed border-gray-200 rounded-lg bg-gray-50">
            <config.icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">{config.emptyTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{config.emptySubtitle}</p>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          {(config.items as Station[]).map((item) => (
            <DraggableResourceCard key={item.id} {...(config.getProps as (item: Station) => DraggableResourceProps)(item)} />
          ))}
        </div>
      );
    }
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Build tools</h3>
            <p className="text-xs text-gray-500">Drag any resource to create a shift</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
          {tabConfigs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-medium py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${
                activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  );
}

