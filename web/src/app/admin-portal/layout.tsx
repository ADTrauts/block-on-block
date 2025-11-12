'use client';

import React, { useState } from 'react';
import { redirect } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Shield, LayoutDashboard, Users, BarChart3, CreditCard, Code, Lock, Settings, Activity, LogOut, User, Eye, Home, DollarSign, Package, UserCheck, Key, Bug, Brain, MessageSquare, Search, FileText, Gauge } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ImpersonationProvider } from '../../contexts/ImpersonationContext';
import { ImpersonationBanner } from '../../components/admin-portal/ImpersonationBanner';
import AvatarContextMenu from '../../components/AvatarContextMenu';

interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

const AdminPortalLayout = ({ children }: AdminPortalLayoutProps) => {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log('Admin Portal Debug:', {
    status,
    hasSession: !!session,
    sessionUser: session?.user,
    userRole: session?.user?.role,
    isAdmin: session?.user?.role === 'ADMIN',
    sessionKeys: session ? Object.keys(session) : []
  });

  if (!session) {
    console.log('No session found, redirecting to login');
    redirect('/auth/login');
  }

  if (session.user.role !== 'ADMIN') {
    console.log('User role is not ADMIN:', session.user.role);
    redirect('/auth/login');
  }

  const adminNavigation = [
    { id: 'dashboard', label: 'Overview', icon: Home, path: '/admin-portal/dashboard' },
    { id: 'users', label: 'User Management', icon: Users, path: '/admin-portal/users' },
    { id: 'overrides', label: 'Admin Overrides', icon: Key, path: '/admin-portal/overrides' },
    { id: 'moderation', label: 'Content Moderation', icon: Shield, path: '/admin-portal/moderation' },
    { id: 'analytics', label: 'Platform Analytics', icon: BarChart3, path: '/admin-portal/analytics' },
    { id: 'billing', label: 'Financial Management', icon: DollarSign, path: '/admin-portal/billing' },
    { id: 'developers', label: 'Developer Management', icon: Code, path: '/admin-portal/developers' },
    { id: 'security', label: 'Security & Compliance', icon: Lock, path: '/admin-portal/security' },
    { id: 'system-logs', label: 'System Logs', icon: FileText, path: '/admin-portal/system-logs' },
    { id: 'system', label: 'System Administration', icon: Settings, path: '/admin-portal/system' },
    { id: 'modules', label: 'Modules', icon: Package, path: '/admin-portal/modules' },
    { id: 'business-intelligence', label: 'Business Intelligence', icon: Brain, path: '/admin-portal/business-intelligence' },
    { id: 'ai-learning', label: 'AI Learning', icon: Brain, path: '/admin-portal/ai-learning' },
    { id: 'ai-context', label: 'AI Context Debug', icon: Search, path: '/admin-portal/ai-context' },
    { id: 'business-ai', label: 'Business AI Global', icon: Brain, path: '/admin-portal/business-ai' },
    { id: 'support', label: 'Support', icon: MessageSquare, path: '/admin-portal/support' },
    { id: 'performance', label: 'Performance & Scalability', icon: Gauge, path: '/admin-portal/performance' },
    { id: 'impersonate', label: 'Impersonation Lab', icon: Eye, path: '/admin-portal/impersonate' },
    { id: 'test-auth', label: 'Test Auth', icon: Key, path: '/admin-portal/test-auth' },
    { id: 'debug-session', label: 'Debug Session', icon: Bug, path: '/admin-portal/debug-session' },
    { id: 'test-api', label: 'Test API', icon: Code, path: '/admin-portal/test-api' },
  ];

  const currentSection = pathname?.split('/')[2] || 'dashboard';

  return (
    <ImpersonationProvider>
      <div className="min-h-screen bg-gray-50">
        <ImpersonationBanner />
        <header className="bg-gray-900 text-white border-b border-gray-800">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Shield className="w-8 h-8 text-blue-400" />
                <div>
                  <h1 className="text-xl font-bold">Admin Portal</h1>
                  <p className="text-sm text-gray-400">Platform Administration</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-gray-300">System Online</span>
              </div>
              <AvatarContextMenu className="text-white" />
            </div>
          </div>
        </header>
        <div className="flex">
          <aside className={`bg-gray-900 text-white flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
            <nav className="flex-1 py-4">
              {adminNavigation.map(item => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full flex items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
              >
                <Activity className="w-5 h-5" />
                {!sidebarCollapsed && <span className="ml-2 text-sm">Toggle Sidebar</span>}
              </button>
            </div>
          </aside>
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ImpersonationProvider>
  );
};

export default AdminPortalLayout; 