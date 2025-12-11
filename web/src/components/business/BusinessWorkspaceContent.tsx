'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../../contexts/DashboardContext';
import { CalendarProvider } from '../../contexts/CalendarContext';
import { Card, Button, Spinner, Alert } from 'shared/components';
import { 
  LayoutDashboard, 
  Folder, 
  MessageSquare, 
  Calendar,
  BarChart3,
  Users,
  Brain,
  Plus,
  Settings
} from 'lucide-react';

// Import existing widgets
import ChatWidget from '../widgets/ChatWidget';
import DriveWidget from '../widgets/DriveWidget';
import AIWidget from '../widgets/AIWidget';

// Import module wrappers for full-page modules
import ChatModuleWrapper from '../chat/ChatModuleWrapper';
import DriveModuleWrapper from '../drive/DriveModuleWrapper';
import CalendarModuleWrapper from '../calendar/CalendarModuleWrapper';
import DriveSidebar from '../../app/drive/DriveSidebar';
import CalendarListSidebar from '../calendar/CalendarListSidebar';
import HRWorkspaceLanding from '../hr/HRWorkspaceLanding';
import SchedulingLayout from '../scheduling/SchedulingLayout';

interface Business {
  id: string;
  name: string;
  logo?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    customCSS?: string;
  };
}

interface BusinessWorkspaceContentProps {
  business: Business;
  currentModule: string;
  businessDashboardId: string | null;
}

// Business-specific widgets
function BusinessDashboardWidget() {
  const [stats, setStats] = useState({
    members: 0,
    files: 0,
    conversations: 0,
    events: 0,
    storageUsed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load business stats
    setTimeout(() => {
      setStats({
        members: 25,
        files: 156,
        conversations: 342,
        events: 28,
        storageUsed: 2.4
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Overview</h1>
          <p className="text-gray-600">Your business workspace at a glance</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Widget
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Members</p>
              <p className="text-2xl font-bold text-gray-900">{stats.members}</p>
            </div>
            <Users className="w-6 h-6 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Files</p>
              <p className="text-2xl font-bold text-gray-900">{stats.files}</p>
            </div>
            <Folder className="w-6 h-6 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conversations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.conversations}</p>
            </div>
            <MessageSquare className="w-6 h-6 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.events}</p>
            </div>
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900">{stats.storageUsed} GB</p>
            </div>
            <BarChart3 className="w-6 h-6 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">New member joined</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">File uploaded</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Meeting scheduled</span>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">JD</div>
              <div>
                <p className="text-sm font-medium text-gray-900">John Doe</p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">JS</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Jane Smith</p>
                <p className="text-xs text-gray-500">Manager</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start">
              <Users className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              <Folder className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface CalendarEvent {
  id: number;
  title: string;
  time: string;
  type: string;
}

function BusinessCalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load business events
    setTimeout(() => {
      setEvents([
        { id: 1, title: 'Team Standup', time: '9:00 AM', type: 'meeting' },
        { id: 2, title: 'Project Review', time: '2:00 PM', type: 'meeting' },
        { id: 3, title: 'Company Holiday', time: 'All Day', type: 'event' }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Calendar</h1>
          <p className="text-gray-600">Manage your business events and meetings</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Events</h3>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${
                    event.type === 'meeting' ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button variant="secondary" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Team Availability
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BusinessAnalyticsWidget() {
  const [analytics, setAnalytics] = useState({
    activeMembers: 18,
    totalFiles: 156,
    totalMessages: 342,
    storageUsed: 2.4
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load business analytics
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Analytics</h1>
          <p className="text-gray-600">Insights into your business activity</p>
        </div>
        <Button>
          <Settings className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Members</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.activeMembers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalFiles}</p>
            </div>
            <Folder className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalMessages}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.storageUsed} GB</p>
            </div>
            <BarChart3 className="w-8 h-8 text-indigo-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Chart placeholder - Activity over time</p>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">#1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">John Doe</p>
                  <p className="text-sm text-gray-500">45 activities</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-green-600">#2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Jane Smith</p>
                  <p className="text-sm text-gray-500">38 activities</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface BusinessMember {
  id: number;
  name: string;
  role: string;
  email: string;
}

function BusinessMembersWidget() {
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load business members
    setTimeout(() => {
      setMembers([
        { id: 1, name: 'John Doe', role: 'Admin', email: 'john@company.com' },
        { id: 2, name: 'Jane Smith', role: 'Manager', email: 'jane@company.com' },
        { id: 3, name: 'Mike Johnson', role: 'Employee', email: 'mike@company.com' }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600">Manage your business team</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All Members</h3>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {member.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    member.role === 'Admin' ? 'bg-red-100 text-red-800' :
                    member.role === 'Manager' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Members</span>
                <span className="font-medium text-gray-900">{members.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Admins</span>
                <span className="font-medium text-gray-900">{members.filter((m) => m.role === 'Admin').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Managers</span>
                <span className="font-medium text-gray-900">{members.filter((m) => m.role === 'Manager').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Employees</span>
                <span className="font-medium text-gray-900">{members.filter((m) => m.role === 'Employee').length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function BusinessWorkspaceContent({ business, currentModule, businessDashboardId }: BusinessWorkspaceContentProps) {
  const { data: session } = useSession();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);

  // File upload handler for Drive
  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (!files || !session?.accessToken) return;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append('file', file);
          if (businessDashboardId) formData.append('dashboardId', businessDashboardId);

          await fetch('/api/drive/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.accessToken}` },
            body: formData,
          });
        }
        
        setRefreshTrigger(prev => prev + 1);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    };
    input.click();
  }, [session, businessDashboardId]);

  // Folder creation handler for Drive
  const handleCreateFolder = useCallback(async () => {
    if (!session?.accessToken) return;

    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
      await fetch('/api/drive/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ 
          name,
          dashboardId: businessDashboardId || null,
          parentId: null
        }),
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create folder');
    }
  }, [session, businessDashboardId]);

  const handleContextSwitch = useCallback(async (dashboardId: string) => {
    await navigateToDashboard(dashboardId);
    router.push(`/business/${business.id}/workspace?module=drive`);
  }, [navigateToDashboard, router, business.id]);

  const renderModuleContent = () => {
    switch (currentModule) {
      case 'dashboard':
        return <BusinessDashboardWidget />;
      case 'drive':
        console.log('📁 Rendering Drive with businessDashboardId:', businessDashboardId);
        return (
          <div className="flex h-full">
            <DriveSidebar
              onNewFolder={handleCreateFolder}
              onFileUpload={handleFileUpload}
              onFolderUpload={handleFileUpload}
              onContextSwitch={handleContextSwitch}
              onFolderSelect={setSelectedFolder}
              selectedFolderId={selectedFolder?.id}
              lockedDashboardId={businessDashboardId || undefined}
            />
            <DriveModuleWrapper 
              className="flex-1"
              refreshTrigger={refreshTrigger}
              dashboardId={businessDashboardId}
              businessId={business.id}
            />
          </div>
        );
      case 'chat':
        return (
          <ChatModuleWrapper 
            className="h-full"
            refreshTrigger={refreshTrigger}
            businessId={business.id}
            dashboardId={businessDashboardId}
          />
        );
      case 'calendar':
        console.log('📅 Rendering Calendar with businessDashboardId:', businessDashboardId);
        return (
          <CalendarProvider>
            <div className="flex h-full">
              <CalendarListSidebar 
                contextType="BUSINESS" 
                contextId={business.id} 
              />
              <CalendarModuleWrapper 
                className="flex-1"
                refreshTrigger={refreshTrigger}
                dashboardId={businessDashboardId}
                contextType="BUSINESS"
                businessId={business.id}
              />
            </div>
          </CalendarProvider>
        );
      case 'hr':
        return <HRWorkspaceLanding businessId={business.id} />;
      case 'scheduling':
        return <SchedulingLayout businessId={business.id} />;
      case 'analytics':
        return <BusinessAnalyticsWidget />;
      case 'members':
        return <BusinessMembersWidget />;
      case 'ai':
        return (
          <AIWidget
            id="business-ai"
            dashboardId={business.id}
            dashboardType="business"
            dashboardName={business.name}
          />
        );
      default:
        return <BusinessDashboardWidget />;
    }
  };

  return (
    <div className="h-full">
      {renderModuleContent()}
    </div>
  );
}
