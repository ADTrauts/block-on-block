'use client';

import React, { useState, useEffect } from 'react';
import { useScheduling } from '@/hooks/useScheduling';
import { EmployeeAvailability } from '@/api/scheduling';
import { getBusiness } from '@/api/business';
import { useSession } from 'next-auth/react';
import { Button, Card, Input, Spinner, Alert, Textarea } from 'shared/components';
import { Clock, Plus, Edit, Trash2, Check, X, Calendar } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface AvailabilityManagementProps {
  businessId: string;
}

interface TimeOffRequest {
  id: string;
  type: 'PTO' | 'SICK' | 'PERSONAL' | 'UNPAID';
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELED';
  reason?: string;
  requestedAt: string;
}

const DAYS_OF_WEEK_FULL = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

const AVAILABILITY_TYPES = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'UNAVAILABLE', label: 'Unavailable', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'PREFERRED', label: 'Preferred', color: 'bg-blue-100 text-blue-800 border-blue-300' },
];

// 12-Hour Time Picker Component
interface TimePicker12HourProps {
  value: string; // 24-hour format (HH:MM)
  onChange: (time24: string) => void;
}

const TimePicker12Hour: React.FC<TimePicker12HourProps> = ({ value, onChange }) => {
  // Parse 24-hour format to 12-hour components
  const parse24HourTo12Hour = (time24: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } => {
    try {
      const [hours, minutes] = time24.split(':').map(Number);
      const hour24 = hours || 0;
      const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 || 12;
      return { hour: hour12, minute: minutes || 0, ampm };
    } catch {
      return { hour: 9, minute: 0, ampm: 'AM' };
    }
  };

  // Convert 12-hour format to 24-hour format
  const convert12HourTo24Hour = (hour: number, minute: number, ampm: 'AM' | 'PM'): string => {
    let hour24 = hour;
    if (ampm === 'PM' && hour !== 12) {
      hour24 = hour + 12;
    } else if (ampm === 'AM' && hour === 12) {
      hour24 = 0;
    }
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const { hour, minute, ampm } = parse24HourTo12Hour(value);

  const handleHourChange = (newHour: number) => {
    onChange(convert12HourTo24Hour(newHour, minute, ampm));
  };

  const handleMinuteChange = (newMinute: number) => {
    onChange(convert12HourTo24Hour(hour, newMinute, ampm));
  };

  const handleAmPmChange = (newAmPm: 'AM' | 'PM') => {
    onChange(convert12HourTo24Hour(hour, minute, newAmPm));
  };

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // Generate minute options (00, 15, 30, 45 for common times, or all minutes)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="flex items-center gap-2">
      {/* Hour Select */}
      <select
        value={hour}
        onChange={(e) => handleHourChange(Number(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring focus:border-blue-400"
      >
        {hourOptions.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <span className="text-gray-600 font-medium">:</span>

      {/* Minute Select */}
      <select
        value={minute}
        onChange={(e) => handleMinuteChange(Number(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring focus:border-blue-400"
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m.toString().padStart(2, '0')}
          </option>
        ))}
      </select>

      {/* AM/PM Toggle */}
      <div className="flex border border-gray-300 rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => handleAmPmChange('AM')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            ampm === 'AM'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => handleAmPmChange('PM')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
            ampm === 'PM'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          PM
        </button>
      </div>
    </div>
  );
};

export default function AvailabilityManagement({ businessId }: AvailabilityManagementProps) {
  const { data: session } = useSession();
  const {
    availability,
    loading,
    error,
    fetchOwnAvailability,
    setAvailability,
    updateAvailability,
    deleteAvailability,
    refresh,
  } = useScheduling({ businessId, scope: 'employee', autoFetch: false });

  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1); // Default to Monday
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [editingDay, setEditingDay] = useState<string | null>(null); // Track which day is being edited
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null); // Track which availability block is being edited
  const [dayFormData, setDayFormData] = useState<Record<string, {
    startTime: string;
    endTime: string;
    availabilityType: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
    notes: string;
    cannotWork: boolean;
  }>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Load business config, availability data, and PTO requests
  useEffect(() => {
    if (businessId && session?.accessToken) {
      const loadData = async () => {
        try {
          // Load week start day
          const response = await getBusiness(businessId, session.accessToken as string);
          if (response.success && response.data?.schedulingConfig) {
            const config = response.data.schedulingConfig as Record<string, unknown>;
            const weekStartDay = config.weekStartDay as 'monday' | 'sunday' | undefined;
            if (weekStartDay) {
              setWeekStartsOn(weekStartDay === 'sunday' ? 0 : 1);
            }
          }
          // Load availability
          await fetchOwnAvailability();
          // Load PTO requests
          await loadTimeOffRequests();
        } catch (err) {
          console.error('Failed to load data:', err);
        }
      };
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.accessToken]);

  // Load time-off requests from HR module
  const loadTimeOffRequests = async () => {
    if (!session?.accessToken) return;
    
    try {
      const response = await fetch(`/api/hr/me/time-off/requests?businessId=${encodeURIComponent(businessId)}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTimeOffRequests(data.requests || []);
        console.log('✅ Time-off requests loaded', { count: (data.requests || []).length });
      } else {
        console.warn('Failed to load time-off requests (HR module may not be installed)');
      }
    } catch (err) {
      console.warn('Failed to load time-off requests:', err);
    }
  };

  // Get days of week ordered by week start
  const getOrderedDays = () => {
    if (weekStartsOn === 0) {
      // Sunday first
      return [
        DAYS_OF_WEEK_FULL[6], // Sunday
        ...DAYS_OF_WEEK_FULL.slice(0, 6), // Monday-Saturday
      ];
    } else {
      // Monday first (default)
      return DAYS_OF_WEEK_FULL;
    }
  };

  const orderedDays = getOrderedDays();

  // Get availability for a specific day
  const getAvailabilityForDay = (dayOfWeek: string): EmployeeAvailability[] => {
    return availability.filter(av => av.dayOfWeek === dayOfWeek);
  };

  // Get upcoming PTO requests (for reference, not tied to specific days)
  const getUpcomingPTO = (): TimeOffRequest[] => {
    const now = new Date();
    return timeOffRequests
      .filter(request => {
        if (request.status === 'DENIED' || request.status === 'CANCELED') return false;
        const requestEnd = new Date(request.endDate);
        return requestEnd >= now; // Only show upcoming or current requests
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5); // Show next 5 upcoming requests
  };

  // Format time for display
  const formatTime = (timeStr: string): string => {
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // Start editing a day
  const handleStartEdit = (dayOfWeek: string, availabilityItem?: EmployeeAvailability) => {
    if (availabilityItem) {
      setEditingAvailabilityId(availabilityItem.id);
      setEditingDay(dayOfWeek);
      setDayFormData({
        [dayOfWeek]: {
          startTime: availabilityItem.startTime,
          endTime: availabilityItem.endTime,
          availabilityType: availabilityItem.availabilityType,
          notes: availabilityItem.notes || '',
          cannotWork: false,
        }
      });
    } else {
      setEditingAvailabilityId(null);
      setEditingDay(dayOfWeek);
      setDayFormData({
        [dayOfWeek]: {
          startTime: '09:00', // Default 9:00 AM in 24-hour format
          endTime: '17:00', // Default 5:00 PM in 24-hour format
          availabilityType: 'AVAILABLE',
          notes: '',
          cannotWork: false,
        }
      });
    }
    setFormError(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingDay(null);
    setEditingAvailabilityId(null);
    setDayFormData({});
    setFormError(null);
  };

  // Handle form submission
  const handleSubmit = async (dayOfWeek: string) => {
    setFormError(null);

    const formData = dayFormData[dayOfWeek];
    if (!formData) return;

    // If "can't work this day" is checked, set as unavailable all day
    if (formData.cannotWork) {
      formData.startTime = '00:00';
      formData.endTime = '23:59';
      formData.availabilityType = 'UNAVAILABLE';
    }

    // Validate time format (still using 24-hour internally)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(formData.startTime) || !timeRegex.test(formData.endTime)) {
      setFormError('Invalid time format');
      return;
    }

    // Validate end time is after start time
    const [startHour, startMin] = formData.startTime.split(':').map(Number);
    const [endHour, endMin] = formData.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes && !formData.cannotWork) {
      setFormError('End time must be after start time');
      return;
    }

    try {
      if (editingAvailabilityId) {
        // Update existing availability
        await updateAvailability(editingAvailabilityId, {
          dayOfWeek,
          startTime: formData.startTime,
          endTime: formData.endTime,
          availabilityType: formData.availabilityType,
          recurring: true,
          notes: formData.notes || undefined,
        });
      } else {
        // Create new availability
        await setAvailability({
          dayOfWeek,
          startTime: formData.startTime,
          endTime: formData.endTime,
          availabilityType: formData.availabilityType,
          recurring: true,
          notes: formData.notes || undefined,
          effectiveFrom: new Date().toISOString(),
        });
      }
      await fetchOwnAvailability();
      handleCancelEdit();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save availability';
      setFormError(errorMessage);
    }
  };

  // Handle delete
  const handleDelete = async (availabilityId: string) => {
    if (!confirm('Are you sure you want to delete this availability?')) return;

    try {
      await deleteAvailability(availabilityId);
      await fetchOwnAvailability();
    } catch (err) {
      console.error('Failed to delete availability:', err);
    }
  };

  // Update form data for a day
  const updateDayFormData = (dayOfWeek: string, updates: Partial<typeof dayFormData[string]>) => {
    setDayFormData(prev => ({
      ...prev,
      [dayOfWeek]: {
        startTime: prev[dayOfWeek]?.startTime || '09:00', // 9:00 AM in 24-hour format
        endTime: prev[dayOfWeek]?.endTime || '17:00', // 5:00 PM in 24-hour format
        availabilityType: prev[dayOfWeek]?.availabilityType || 'AVAILABLE' as const,
        notes: prev[dayOfWeek]?.notes || '',
        cannotWork: prev[dayOfWeek]?.cannotWork || false,
        ...updates,
      }
    }));
  };

  if (loading && availability.length === 0 && timeOffRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">My Availability</h2>
              <p className="text-sm text-gray-600 mt-1">
                Set your recurring weekly availability pattern (e.g., "Available Monday-Friday 9am-5pm" or "Only work mornings on Tuesdays")
              </p>
            </div>
          </div>
        </div>

      {error && (
        <Alert className="mb-4" type="error">
          {error}
        </Alert>
      )}

      {formError && (
        <Alert className="mb-4" type="error">
          {formError}
        </Alert>
      )}

      {/* Upcoming PTO Section */}
      {getUpcomingPTO().length > 0 && (
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Time-Off Requests</h3>
            </div>
            <div className="space-y-2">
              {getUpcomingPTO().map((pto) => (
                <div key={pto.id} className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    pto.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    pto.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {pto.type}
                  </span>
                  <span className="text-gray-700">
                    {format(new Date(pto.startDate), 'MMM d')} - {format(new Date(pto.endDate), 'MMM d, yyyy')}
                  </span>
                  {pto.status === 'PENDING' && (
                    <span className="text-xs text-gray-500">(Pending approval)</span>
                  )}
                  {pto.status === 'APPROVED' && (
                    <span className="text-xs text-green-600 font-medium">✓ Approved</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Vertical Days List */}
      <div className="space-y-4">
        <div className="mb-2">
          <p className="text-sm text-gray-600">
            Set your recurring weekly availability. These preferences apply every week.
          </p>
        </div>
        {orderedDays.map((day) => {
          const dayAvailabilities = getAvailabilityForDay(day.value);
          const isEditing = editingDay === day.value;
          const formData = dayFormData[day.value] || {
            startTime: '09:00', // 9:00 AM in 24-hour format
            endTime: '17:00', // 5:00 PM in 24-hour format
            availabilityType: 'AVAILABLE' as const,
            notes: '',
            cannotWork: false,
          };

          return (
            <Card key={day.value}>
              <div className="p-4">
                {/* Day Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium text-lg text-gray-900">{day.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Recurring weekly availability
                    </div>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(day.value)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Availability
                    </Button>
                  )}
                </div>

                {/* Editing Mode */}
                {isEditing ? (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id={`cannotWork-${day.value}`}
                        checked={formData.cannotWork}
                        onChange={(e) => updateDayFormData(day.value, { cannotWork: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`cannotWork-${day.value}`} className="text-sm font-medium text-gray-700">
                        Can't work this day at all
                      </label>
                    </div>

                    {!formData.cannotWork && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Start Time
                            </label>
                            <TimePicker12Hour
                              value={formData.startTime}
                              onChange={(newTime24) => updateDayFormData(day.value, { startTime: newTime24 })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              End Time
                            </label>
                            <TimePicker12Hour
                              value={formData.endTime}
                              onChange={(newTime24) => updateDayFormData(day.value, { endTime: newTime24 })}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Availability Type
                          </label>
                          <select
                            value={formData.availabilityType}
                            onChange={(e) => updateDayFormData(day.value, { 
                              availabilityType: e.target.value as 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED' 
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                          >
                            {AVAILABILITY_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => updateDayFormData(day.value, { notes: e.target.value })}
                        rows={2}
                        placeholder="Additional notes..."
                        className="w-full"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="secondary" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button variant="primary" onClick={() => handleSubmit(day.value)}>
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="space-y-2">
                    {dayAvailabilities.length === 0 ? (
                      <div className="text-sm text-gray-400 italic py-2">
                        No availability set for this day
                      </div>
                    ) : (
                      dayAvailabilities.map((av) => {
                        const typeConfig = AVAILABILITY_TYPES.find(t => t.value === av.availabilityType);
                        return (
                          <div
                            key={av.id}
                            className={`flex items-start justify-between p-3 rounded-lg border ${typeConfig?.color || 'bg-gray-100 border-gray-300'}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <Clock className="h-4 w-4 text-gray-600" />
                                <span className="font-medium text-sm">
                                  {formatTime(av.startTime)} - {formatTime(av.endTime)}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-white/50">
                                  {typeConfig?.label}
                                </span>
                              </div>
                              {av.notes && (
                                <div className="text-sm text-gray-600 mt-1 italic">
                                  {av.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-4">
                              <button
                                onClick={() => handleStartEdit(day.value, av)}
                                className="p-1.5 hover:bg-white/50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => handleDelete(av.id)}
                                className="p-1.5 hover:bg-white/50 rounded text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
