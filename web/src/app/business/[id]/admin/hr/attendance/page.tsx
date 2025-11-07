'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Spinner, Alert, EmptyState } from 'shared/components';
import { toast } from 'react-hot-toast';

interface TimeOffCalendarRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  employeePosition: {
    user: {
      id: string;
      name: string | null;
      email: string;
    };
    position: {
      title: string;
      department?: {
        id: string;
        name: string;
      } | null;
    };
  };
}

export default function HRAttendancePage() {
  const params = useParams();
  const { data: session } = useSession();
  const businessId = (params?.id as string) || '';
  
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TimeOffCalendarRequest[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load departments for filter
        const deptRes = await fetch(`/api/hr/admin/employees/filter-options?businessId=${encodeURIComponent(businessId)}`);
        if (deptRes.ok) {
          const deptData = await deptRes.json();
          setDepartments(deptData.departments || []);
        }
        
        // Load calendar data
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const params = new URLSearchParams({
          businessId,
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate: endOfMonth.toISOString().split('T')[0]
        });
        if (selectedDepartment) {
          params.set('departmentId', selectedDepartment);
        }
        
        const res = await fetch(`/api/hr/admin/time-off/calendar?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load time-off calendar');
        }
        
        const data = await res.json();
        setRequests(data.requests || []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load calendar';
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [businessId, currentMonth, selectedDepartment]);

  // Generate calendar days
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
    
    const days: Array<{ date: Date; isCurrentMonth: boolean; requests: TimeOffCalendarRequest[] }> = [];
    const currentDate = new Date(startDate);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayRequests = requests.filter((r) => {
        const start = new Date(r.startDate).toISOString().split('T')[0];
        const end = new Date(r.endDate).toISOString().split('T')[0];
        return dateStr >= start && dateStr <= end;
      });
      
      days.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
        requests: dayRequests
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const calendarDays = getCalendarDays();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert type="error" title="Error Loading Calendar">
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Time-Off Calendar</h1>
        <p className="text-gray-600">View all employee time-off requests on a calendar</p>
      </div>

      {/* Filters and Navigation */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="px-3 py-2 border rounded hover:bg-gray-50"
          >
            ← Previous
          </button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="px-3 py-2 border rounded hover:bg-gray-50"
          >
            Next →
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            Today
          </button>
        </div>
        
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {dayNames.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-semibold text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const typeColors: Record<string, string> = {
              PTO: 'bg-blue-100 text-blue-800',
              SICK: 'bg-red-100 text-red-800',
              PERSONAL: 'bg-purple-100 text-purple-800',
              UNPAID: 'bg-gray-100 text-gray-800'
            };
            
            return (
              <div
                key={idx}
                className={`min-h-[100px] border-r border-b p-1 ${
                  !day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                }`}
              >
                <div className={`text-sm mb-1 ${!day.isCurrentMonth ? 'text-gray-400' : ''}`}>
                  {day.date.getDate()}
                </div>
                <div className="space-y-1">
                  {day.requests.slice(0, 3).map((req) => (
                    <div
                      key={req.id}
                      className={`text-xs px-1 py-0.5 rounded truncate ${typeColors[req.type] || 'bg-gray-100'}`}
                      title={`${req.employeePosition.user.name || req.employeePosition.user.email} - ${req.type} (${req.status})`}
                    >
                      {req.employeePosition.user.name?.split(' ')[0] || req.employeePosition.user.email.split('@')[0]}: {req.type}
                    </div>
                  ))}
                  {day.requests.length > 3 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{day.requests.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-semibold">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
          <span className="text-sm">PTO</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
          <span className="text-sm">Sick</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
          <span className="text-sm">Personal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
          <span className="text-sm">Unpaid</span>
        </div>
      </div>
    </div>
  );
}

