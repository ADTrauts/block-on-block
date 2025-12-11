'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { Badge } from 'shared/components';

interface SchedulingSidebarProps {
  businessId: string;
  currentView: string;
  onViewChange: (view: string) => void;
  userRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  stats?: {
    pendingSwaps?: number;
    openShifts?: number;
  };
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  roles: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[];
  badge?: number;
  badgeColor?: 'red' | 'yellow';
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  // Admin-only views
  {
    id: 'builder',
    label: 'Schedule Builder',
    icon: Calendar,
    roles: ['ADMIN'],
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    roles: ['ADMIN'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    roles: ['ADMIN'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['ADMIN'],
  },
  // Manager/Admin team views
  {
    id: 'team',
    label: 'Team Schedules',
    icon: Users,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'swaps',
    label: 'Swap Approvals',
    icon: CheckCircle2,
    roles: ['ADMIN', 'MANAGER'],
  },
  // Personal views (for all roles)
  {
    id: 'my-schedule',
    label: 'My Schedule',
    icon: Calendar,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    id: 'availability',
    label: 'My Availability',
    icon: Clock,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    id: 'shift-swaps',
    label: 'Shift Swaps',
    icon: RefreshCw,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    id: 'open-shifts',
    label: 'Open Shifts',
    icon: AlertCircle,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
];

export default function SchedulingSidebar({
  businessId,
  currentView,
  onViewChange,
  userRole,
  stats = {},
}: SchedulingSidebarProps) {
  const { data: session } = useSession();

  // Filter nav items based on user role
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  // Add badges to items
  const itemsWithBadges = visibleItems.map(item => {
    let badge: number | undefined;
    let badgeColor: 'red' | 'yellow' | undefined;

    if (item.id === 'swaps' && stats.pendingSwaps) {
      badge = stats.pendingSwaps;
      badgeColor = 'red';
    } else if (item.id === 'open-shifts' && stats.openShifts) {
      badge = stats.openShifts;
      badgeColor = 'yellow';
    } else if (item.id === 'shift-swaps' && stats.pendingSwaps) {
      badge = stats.pendingSwaps;
      badgeColor = 'yellow';
    }

    return { ...item, badge, badgeColor };
  });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Scheduling</h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {itemsWithBadges.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge
                      color={item.badgeColor || 'red'}
                      className="text-xs px-1.5 py-0.5 min-w-[20px] text-center"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

