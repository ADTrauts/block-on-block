import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  BarChart3, 
  CreditCard, 
  Code, 
  Lock, 
  Settings,
  Activity,
  LogOut,
  User,
  Eye,
  Home,
  DollarSign,
  Package,
  UserCheck,
  Key,
  Bug,
  Brain,
  MessageSquare,
  Gauge
} from 'lucide-react';

interface AdminNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  badge?: string;
}

const adminNavigation: AdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    path: '/admin-portal/dashboard',
  },
  {
    id: 'users',
    label: 'User Management',
    icon: Users,
    path: '/admin-portal/users',
  },
  {
    id: 'moderation',
    label: 'Content Moderation',
    icon: Shield,
    path: '/admin-portal/moderation',
  },
  {
    id: 'analytics',
    label: 'Platform Analytics',
    icon: BarChart3,
    path: '/admin-portal/analytics',
  },
  {
    id: 'billing',
    label: 'Financial Management',
    icon: CreditCard,
    path: '/admin-portal/billing',
  },
  {
    id: 'developers',
    label: 'Developer Management',
    icon: Code,
    path: '/admin-portal/developers',
  },
  {
    id: 'security',
    label: 'Security & Compliance',
    icon: Lock,
    path: '/admin-portal/security',
  },
  {
    id: 'system',
    label: 'System Administration',
    icon: Settings,
    path: '/admin-portal/system',
  },
  { id: 'modules', label: 'Modules', icon: Package, path: '/admin-portal/modules' },
  { id: 'business-intelligence', label: 'Business Intelligence', icon: Brain, path: '/admin-portal/business-intelligence' },
  { id: 'support', label: 'Support', icon: MessageSquare, path: '/admin-portal/support' },
  { id: 'performance', label: 'Performance & Scalability', icon: Gauge, path: '/admin-portal/performance' },
  { id: 'impersonation', label: 'Impersonation Lab', icon: Eye, path: '/admin-portal/impersonate' },
  { id: 'test-impersonation', label: 'Test Impersonation', icon: UserCheck, path: '/admin-portal/test-impersonation' },
  { id: 'test-auth', label: 'Test Auth', icon: Key, path: '/admin-portal/test-auth' },
  { id: 'debug-session', label: 'Debug Session', icon: Bug, path: '/admin-portal/debug-session' },
  { id: 'test-api', label: 'Test API', icon: Code, path: '/admin-portal/test-api' },
];

interface AdminNavigationProps {
  collapsed?: boolean;
}

export const AdminNavigation = ({ collapsed = false }: AdminNavigationProps) => {
  const pathname = usePathname();

  return (
    <nav className="flex-1 py-4">
      {adminNavigation.map(item => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        
        return (
          <Link
            key={item.id}
            href={item.path}
            className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
              isActive 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5 mr-3" />
            {!collapsed && (
              <>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}; 