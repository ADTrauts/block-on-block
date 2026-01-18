'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import HRPageLayout from '@/components/hr/HRPageLayout';
import { getAllOnboardingJourneys, EmployeeOnboardingJourney } from '@/api/hrOnboarding';
import { Card, Spinner, Alert, Badge, Button } from 'shared/components';
import { Eye, Search, Filter, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import StartOnboardingJourneyModal from '@/components/hr/onboarding/StartOnboardingJourneyModal';

export default function OnboardingJourneysPage() {
  const params = useParams();
  const businessId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<EmployeeOnboardingJourney[]>([]);
  const [filteredJourneys, setFilteredJourneys] = useState<EmployeeOnboardingJourney[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showStartModal, setShowStartModal] = useState(false);
  const [employees, setEmployees] = useState<Array<{
    id: string;
    user: { id: string; name: string | null; email: string };
    position: { title: string; department?: { name?: string | null } | null };
    hrProfile?: { id: string; hireDate?: string | null } | null;
  }>>([]);

  useEffect(() => {
    if (businessId) {
      loadJourneys();
      loadEmployees();
    }
  }, [businessId]);

  const loadEmployees = async () => {
    try {
      const res = await fetch(`/api/hr/admin/employees?businessId=${encodeURIComponent(businessId)}&status=ACTIVE&pageSize=1000`);
      if (res.ok) {
        const data = await res.json();
        // The API returns employees with hrProfile included
        // Map to the structure expected by StartOnboardingJourneyModal
        const mappedEmployees = (data.employees || []).map((emp: {
          id: string;
          user: { id: string; name: string | null; email: string };
          position: { title: string; department?: { name?: string | null } | null };
          hrProfile?: { id: string; hireDate?: string | null } | null;
        }) => ({
          id: emp.id,
          user: emp.user,
          position: emp.position,
          hrProfile: emp.hrProfile ? {
            id: emp.hrProfile.id,
            hireDate: emp.hrProfile.hireDate,
          } : null,
        }));
        setEmployees(mappedEmployees);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const loadJourneys = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllOnboardingJourneys(businessId);
      setJourneys(data);
      setFilteredJourneys(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load journeys';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredJourneys(journeys);
    } else {
      setFilteredJourneys(journeys.filter(j => j.status === statusFilter));
    }
  }, [statusFilter, journeys]);

  const getEmployeeName = (journey: EmployeeOnboardingJourney): string => {
    return journey.employeeHrProfile?.employeePosition?.user?.name || 
           journey.employeeHrProfile?.employeePosition?.user?.email || 
           'Unknown Employee';
  };

  const getProgress = (journey: EmployeeOnboardingJourney): number => {
    if (!journey.tasks || journey.tasks.length === 0) return 0;
    const completed = journey.tasks.filter(t => t.status === 'COMPLETED').length;
    return Math.round((completed / journey.tasks.length) * 100);
  };

  if (!businessId) {
    return (
      <HRPageLayout businessId="" currentView="onboarding-journeys">
        <div className="p-6">
          <Alert type="error" title="Error">
            Business ID is required
          </Alert>
        </div>
      </HRPageLayout>
    );
  }

  return (
    <HRPageLayout businessId={businessId} currentView="onboarding-journeys">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding Journeys</h1>
            <p className="text-sm text-gray-600 mt-1">
              View and manage all employee onboarding journeys
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setShowStartModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Start New Journey
            </Button>
            <Button variant="secondary" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="secondary" size="sm">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Button
            variant={statusFilter === 'all' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'IN_PROGRESS' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('IN_PROGRESS')}
          >
            In Progress
          </Button>
          <Button
            variant={statusFilter === 'COMPLETED' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('COMPLETED')}
          >
            Completed
          </Button>
          <Button
            variant={statusFilter === 'CANCELLED' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('CANCELLED')}
          >
            Cancelled
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size={32} />
          </div>
        ) : error ? (
          <Alert type="error" title="Error Loading Journeys">
            {error}
          </Alert>
        ) : filteredJourneys.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-2">
              {journeys.length === 0 
                ? 'No onboarding journeys found.' 
                : `No ${statusFilter === 'all' ? '' : statusFilter.toLowerCase().replace('_', ' ')} journeys found.`}
            </p>
            {journeys.length === 0 && (
              <p className="text-sm text-gray-500">
                Onboarding journeys will appear here once employees start their onboarding process.
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredJourneys.map((journey) => {
              const progress = getProgress(journey);
              const employeeName = getEmployeeName(journey);
              const startDate = journey.createdAt ? new Date(journey.createdAt).toLocaleDateString() : 'N/A';
              const completedTasks = journey.tasks?.filter(t => t.status === 'COMPLETED').length || 0;
              const totalTasks = journey.tasks?.length || 0;

              return (
                <Card key={journey.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {employeeName}
                        </h3>
                        <Badge variant={journey.status === 'COMPLETED' ? 'primary' : journey.status === 'CANCELLED' ? 'secondary' : 'secondary'}>
                          {journey.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Template: {journey.onboardingTemplate?.name || 'N/A'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Started: {startDate}</span>
                        <span>Progress: {progress}%</span>
                        <span>Tasks: {completedTasks}/{totalTasks}</span>
                      </div>
                      {progress > 0 && progress < 100 && (
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {showStartModal && (
          <StartOnboardingJourneyModal
            businessId={businessId}
            employees={employees}
            onJourneyStarted={() => {
              void loadJourneys();
            }}
            onClose={() => setShowStartModal(false)}
          />
        )}
      </div>
    </HRPageLayout>
  );
}

