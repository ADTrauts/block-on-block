'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import HRPageLayout from '@/components/hr/HRPageLayout';
import { Card, Spinner, Alert, Tabs, TabsList, TabsTrigger } from 'shared/components';
import { TrendingUp, Users, Clock, Calendar } from 'lucide-react';
import OnboardingAnalyticsDashboard from '@/components/hr/analytics/OnboardingAnalyticsDashboard';
import AttendanceAnalyticsDashboard from '@/components/hr/analytics/AttendanceAnalyticsDashboard';
import TimeOffAnalyticsDashboard from '@/components/hr/analytics/TimeOffAnalyticsDashboard';

export default function HRAnalyticsPage() {
  const params = useParams();
  const businessId = params?.id as string;
  const [activeTab, setActiveTab] = useState<'onboarding' | 'attendance' | 'time-off'>('onboarding');

  if (!businessId) {
    return (
      <HRPageLayout businessId="" currentView="analytics">
        <div className="p-6">
          <Alert type="error" title="Error">
            Business ID is required
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  return (
    <HRPageLayout businessId={businessId} currentView="analytics">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">HR Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            View insights and trends for onboarding, attendance, and time-off
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'onboarding' | 'attendance' | 'time-off')}
        >
          <TabsList>
            <TabsTrigger value="onboarding" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="time-off" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Time-Off
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-6">
          {activeTab === 'onboarding' && (
            <OnboardingAnalyticsDashboard businessId={businessId} />
          )}
          {activeTab === 'attendance' && (
            <AttendanceAnalyticsDashboard businessId={businessId} />
          )}
          {activeTab === 'time-off' && (
            <TimeOffAnalyticsDashboard businessId={businessId} />
          )}
        </div>
      </div>
    </HRPageLayout>
  );
}

