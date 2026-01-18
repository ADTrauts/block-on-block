'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  UserCheck,
  FileText,
  TrendingUp,
  Settings,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  BookOpen,
} from 'lucide-react';
import { Badge } from 'shared/components';

interface HRSidebarProps {
  businessId: string;
  currentView: string;
  onViewChange: (view: string) => void;
  userRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  stats?: {
    pendingTimeOff?: number;
    pendingApprovals?: number;
    openExceptions?: number;
  };
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  roles: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[];
  section: 'top' | 'admin' | 'manager' | 'personal';
  badge?: number;
  badgeColor?: 'red' | 'yellow';
}

const navItems: NavItem[] = [
  // Top level (all roles)
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    section: 'top',
  },
  // Admin-only views
  {
    id: 'employees',
    label: 'Employees',
    icon: Users,
    roles: ['ADMIN'],
    section: 'admin',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    roles: ['ADMIN'],
    section: 'admin',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['ADMIN'],
    section: 'admin',
  },
  {
    id: 'onboarding-templates',
    label: 'Onboarding Templates',
    icon: ClipboardList,
    roles: ['ADMIN'],
    section: 'admin',
  },
  {
    id: 'onboarding-journeys',
    label: 'Onboarding Journeys',
    icon: BookOpen,
    roles: ['ADMIN'],
    section: 'admin',
  },
  // Manager/Admin team views
  {
    id: 'time-off',
    label: 'Time-Off Requests',
    icon: Calendar,
    roles: ['ADMIN', 'MANAGER'],
    section: 'manager',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Clock,
    roles: ['ADMIN', 'MANAGER'],
    section: 'manager',
  },
  {
    id: 'team',
    label: 'My Team',
    icon: Users,
    roles: ['ADMIN', 'MANAGER'],
    section: 'manager',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: CheckCircle2,
    roles: ['ADMIN', 'MANAGER'],
    section: 'manager',
  },
  // Personal views (for all roles)
  {
    id: 'my-profile',
    label: 'My Profile',
    icon: UserCheck,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    section: 'personal',
  },
  {
    id: 'my-time-off',
    label: 'My Time Off',
    icon: Calendar,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    section: 'personal',
  },
  {
    id: 'my-attendance',
    label: 'My Attendance',
    icon: Clock,
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    section: 'personal',
  },
];

export default function HRSidebar({
  businessId,
  currentView,
  onViewChange,
  userRole,
  stats = {},
}: HRSidebarProps) {
  // Filter nav items based on user role
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  // Add badges to items
  const itemsWithBadges = visibleItems.map(item => {
    let badge: number | undefined;
    let badgeColor: 'red' | 'yellow' | undefined;

    if (item.id === 'time-off' && stats.pendingTimeOff) {
      badge = stats.pendingTimeOff;
      badgeColor = 'red';
    } else if (item.id === 'approvals' && stats.pendingApprovals) {
      badge = stats.pendingApprovals;
      badgeColor = 'red';
    } else if (item.id === 'attendance' && stats.openExceptions) {
      badge = stats.openExceptions;
      badgeColor = 'yellow';
    }

    return { ...item, badge, badgeColor };
  });

  // Group items by section
  const groupedItems = itemsWithBadges.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof itemsWithBadges>);

  // Define section order
  const sectionOrder: Array<'top' | 'admin' | 'manager' | 'personal'> = ['top', 'admin', 'manager', 'personal'];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Human Resources</h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {sectionOrder.map((section) => {
            const sectionItems = groupedItems[section] || [];
            if (sectionItems.length === 0) return null;

            return (
              <React.Fragment key={section}>
                {sectionItems.map((item) => {
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
                {/* Add divider after section (except for last section) */}
                {section !== 'personal' && sectionItems.length > 0 && (
                  <li className="my-2">
                    <div className="border-t border-gray-200" />
                  </li>
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

