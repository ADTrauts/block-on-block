'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
// Use the correct path from web directory
import { Card } from 'shared/components';
import { Button } from 'shared/components';
import { Badge } from 'shared/components';
import { Alert } from 'shared/components';
import { authenticatedApiCall } from '../../lib/apiUtils';
import { 
  Settings, 
  Shield, 
  Users, 
  Clock, 
  DollarSign,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  MessageSquare
} from 'lucide-react';

// 12-Hour Time Picker Component
interface TimePicker12HourProps {
  value: string; // 24-hour format (HH:MM)
  onChange: (time24: string) => void;
}

const TimePicker12Hour: React.FC<TimePicker12HourProps> = ({ value, onChange }) => {
  // Parse 24-hour format to 12-hour components
  const parse24HourTo12Hour = (time24: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } => {
    try {
      if (!time24) return { hour: 9, minute: 0, ampm: 'AM' };
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

  const { hour, minute, ampm } = parse24HourTo12Hour(value || '09:00');

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
  
  // Generate minute options (00, 15, 30, 45 for common times)
  const minuteOptions = [0, 15, 30, 45];

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

interface AutonomySettings {
  scheduling: number;
  communication: number;
  fileManagement: number;
  taskCreation: number;
  dataAnalysis: number;
  crossModuleActions: number;
  workHoursOverride: boolean;
  workHoursStart?: string | null;
  workHoursEnd?: string | null;
  familyTimeOverride: boolean;
  familyTimeStart?: string | null;
  familyTimeEnd?: string | null;
  sleepHoursOverride: boolean;
  sleepHoursStart?: string | null;
  sleepHoursEnd?: string | null;
  financialThreshold: number;
  timeCommitmentThreshold: number;
  peopleAffectedThreshold: number;
}

interface AutonomyRecommendation {
  type: 'increase_autonomy' | 'decrease_autonomy';
  module: string;
  reason: string;
  suggestedLevel: number;
}

export default function AutonomyControls() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<AutonomySettings>({
    scheduling: 30,
    communication: 20,
    fileManagement: 40,
    taskCreation: 30,
    dataAnalysis: 60,
    crossModuleActions: 20,
    workHoursOverride: false,
    workHoursStart: '09:00',
    workHoursEnd: '17:00',
    familyTimeOverride: false,
    familyTimeStart: '18:00',
    familyTimeEnd: '20:00',
    sleepHoursOverride: false,
    sleepHoursStart: '22:00',
    sleepHoursEnd: '07:00',
    financialThreshold: 0,
    timeCommitmentThreshold: 60,
    peopleAffectedThreshold: 1
  });

  const [recommendations, setRecommendations] = useState<AutonomyRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const loadAutonomySettings = async () => {
    if (!session?.accessToken) {
      console.log('No access token available for loadAutonomySettings');
      return;
    }

    try {
      setError(null);
      console.log('Loading autonomy settings...');
      const response = await authenticatedApiCall<AutonomySettings | { success: boolean; data: AutonomySettings }>('/api/ai/autonomy/settings', {}, session.accessToken);
      console.log('API response received:', response);
      
      // Handle both response formats (wrapped or direct)
      if (response && typeof response === 'object') {
        let loadedSettings: AutonomySettings;
        if ('success' in response && response.success && response.data) {
          // Wrapped response format
          loadedSettings = response.data;
        } else if ('scheduling' in response || 'communication' in response) {
          // Direct response format (settings object)
          loadedSettings = response as AutonomySettings;
        } else {
          console.warn('Invalid response structure from API:', response);
          setError('Invalid response structure from API');
          return;
        }
        
        // Set default time values if not present
        if (loadedSettings.workHoursOverride && !loadedSettings.workHoursStart) {
          loadedSettings.workHoursStart = '09:00';
        }
        if (loadedSettings.workHoursOverride && !loadedSettings.workHoursEnd) {
          loadedSettings.workHoursEnd = '17:00';
        }
        if (loadedSettings.familyTimeOverride && !loadedSettings.familyTimeStart) {
          loadedSettings.familyTimeStart = '18:00';
        }
        if (loadedSettings.familyTimeOverride && !loadedSettings.familyTimeEnd) {
          loadedSettings.familyTimeEnd = '20:00';
        }
        if (loadedSettings.sleepHoursOverride && !loadedSettings.sleepHoursStart) {
          loadedSettings.sleepHoursStart = '22:00';
        }
        if (loadedSettings.sleepHoursOverride && !loadedSettings.sleepHoursEnd) {
          loadedSettings.sleepHoursEnd = '07:00';
        }
        
        setSettings(loadedSettings);
      } else {
        console.warn('Invalid response from API:', response);
        setError('Invalid response from API');
      }
    } catch (error: unknown) {
      console.error('Failed to load autonomy settings:', error);
      
      // Handle authentication errors specifically
      if (error && typeof error === 'object' && 'isAuthError' in error && error.isAuthError) {
        setError('Your session has expired. Please refresh the page to log in again.');
        setIsAuthenticated(false);
      } else {
        setError('Failed to load autonomy settings. Using default settings.');
      }
    }
  };

  const loadRecommendations = async () => {
    if (!session?.accessToken) {
      console.log('No access token available for loadRecommendations');
      return;
    }

    try {
      console.log('Loading recommendations...');
      const response = await authenticatedApiCall<AutonomyRecommendation[]>('/api/ai/autonomy/recommendations', {}, session.accessToken);
      console.log('Recommendations response:', response);
      
      // Check if response contains an error message
      if (response && typeof response === 'object' && 'error' in response) {
        console.warn('Recommendations API returned error:', response.error);
        setRecommendations([]);
        return;
      }
      
      // Handle the direct response structure (not wrapped)
      if (Array.isArray(response)) {
        console.log('Setting recommendations:', response);
        setRecommendations(response);
      } else {
        console.warn('Invalid recommendations response structure:', response);
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setRecommendations([]);
      // Don't set error for recommendations as they're not critical
    }
  };

  // Load autonomy settings on mount
  useEffect(() => {
    const loadData = async () => {
      if (!session?.accessToken) {
        console.log('No session available, skipping data load');
        setIsAuthenticated(false);
        return;
      }

      try {
        // Try to load autonomy settings
        await loadAutonomySettings();
        await loadRecommendations();
        setIsAuthenticated(true);
      } catch (error: unknown) {
        console.log('Failed to load autonomy data:', error);
        // If API calls fail due to auth issues, show auth required
        if (error && typeof error === 'object' && 'isAuthError' in error && error.isAuthError) {
          setIsAuthenticated(false);
        } else {
          // For other errors, show interface with default settings
          setIsAuthenticated(true);
          setError('Using default settings. Some features may be limited.');
        }
      }
    };

    loadData();
  }, [session?.accessToken]);

  // Safety check to prevent rendering with invalid settings
  if (!settings || typeof settings !== 'object') {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <span>Invalid settings data. Please refresh the page.</span>
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </div>
    );
  }

  // Show authentication required state
  if (isAuthenticated === false) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <span>{error || 'Authentication required'}</span>
        </Alert>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            You need to be logged in to access AI settings.
          </p>
          <Button onClick={() => window.location.href = '/auth/login'}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  const autonomyCategories = [
    { key: 'scheduling', label: 'Meeting & Schedule Management', icon: Clock },
    { key: 'communication', label: 'Message & Communication', icon: MessageSquare },
    { key: 'fileManagement', label: 'File & Document Organization', icon: FileText },
    { key: 'taskCreation', label: 'Task & Project Creation', icon: CheckCircle },
    { key: 'dataAnalysis', label: 'Data Analysis & Insights', icon: TrendingUp },
    { key: 'crossModuleActions', label: 'Cross-Module Coordination', icon: Users }
  ];

  const saveSettings = async () => {
    if (!session?.accessToken) {
      setError('Please sign in to save your autonomy settings');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedApiCall<AutonomySettings | { success: boolean; data?: AutonomySettings }>('/api/ai/autonomy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }, session.accessToken);
      
      // Handle both response formats
      if (response && typeof response === 'object') {
        if ('success' in response && response.success) {
          // Wrapped response
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          setError(null);
        } else if ('scheduling' in response || 'communication' in response) {
          // Direct response (settings object means success)
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          setError(null);
        } else {
          setError('Settings saved locally but failed to sync with server. Please try again later.');
        }
      } else {
        setError('Settings saved locally but failed to sync with server. Please try again later.');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError('Settings saved locally but failed to sync with server. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSliderChange = (key: keyof AutonomySettings, value: number[]) => {
    try {
      setSettings(prev => ({ ...prev, [key]: value[0] }));
    } catch (error) {
      console.error('Error updating slider value:', error);
      setError('Failed to update setting. Please try again.');
    }
  };

  const handleSwitchChange = (key: keyof AutonomySettings, value: boolean) => {
    try {
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Error updating switch value:', error);
      setError('Failed to update setting. Please try again.');
    }
  };

  const getAutonomyLevel = (value: number) => {
    try {
      if (value >= 80) return { level: 'High', color: 'bg-green-100 text-green-800' };
      if (value >= 60) return { level: 'Medium-High', color: 'bg-blue-100 text-blue-800' };
      if (value >= 40) return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
      if (value >= 20) return { level: 'Low', color: 'bg-orange-100 text-orange-800' };
      return { level: 'None', color: 'bg-red-100 text-red-800' };
    } catch (error) {
      console.error('Error calculating autonomy level:', error);
      return { level: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getRiskLevel = (value: number) => {
    try {
      if (value >= 80) return { level: 'High Risk', color: 'bg-red-100 text-red-800' };
      if (value >= 60) return { level: 'Medium-High Risk', color: 'bg-orange-100 text-orange-800' };
      if (value >= 40) return { level: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800' };
      if (value >= 20) return { level: 'Low Risk', color: 'bg-blue-100 text-blue-800' };
      return { level: 'No Risk', color: 'bg-green-100 text-green-800' };
    } catch (error) {
      console.error('Error calculating risk level:', error);
      return { level: 'Unknown Risk', color: 'bg-gray-100 text-gray-800' };
    }
  };

  // Show warning if there's an error, but don't block the interface
  // The error will be shown as a warning banner above the controls

  // Debug logging
  console.log('AutonomyControls render - settings:', settings);
  console.log('AutonomyControls render - recommendations:', recommendations);
  console.log('AutonomyControls render - error:', error);
  console.log('AutonomyControls render - isAuthenticated:', isAuthenticated);

  return (
    <div className="space-y-6">
        {/* Success Message */}
        {saved && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <span>Settings saved successfully!</span>
          </Alert>
        )}

        {/* Warning Message - Show error as warning, don't block interface */}
        {error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
            <Button 
              onClick={() => {
                setError(null);
                loadAutonomySettings();
              }}
              size="sm"
              className="ml-2"
            >
              Retry
            </Button>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Module-Specific Controls */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Module Autonomy Levels</h3>
            <p className="text-sm text-gray-600">
              Control how much autonomy your AI has in different areas. Higher levels mean the AI can take more actions without your approval.
            </p>
            
            {autonomyCategories && Array.isArray(autonomyCategories) ? autonomyCategories.map((category) => {
              try {
                const value = settings?.[category.key as keyof AutonomySettings] as number || 0;
                const autonomyInfo = getAutonomyLevel(value) || { level: 'Unknown', color: 'bg-gray-100 text-gray-800' };
                const riskInfo = getRiskLevel(value) || { level: 'Unknown Risk', color: 'bg-gray-100 text-gray-800' };
                const Icon = category.icon || AlertTriangle;
              
              return (
                <div key={category.key} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{category.label}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={autonomyInfo.color}>
                      {autonomyInfo.level}
                    </Badge>
                    <Badge className={riskInfo.color}>
                      {riskInfo.level}
                    </Badge>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => handleSliderChange(category.key as keyof AutonomySettings, [parseInt(e.target.value)])}
                    className="w-full"
                  />
                  
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>No Autonomy</span>
                    <span>Full Autonomy</span>
                  </div>
                </div>
              );
              } catch (error) {
                console.error('Error rendering autonomy category:', category.key, error);
                return (
                  <div key={category.key} className="space-y-3 p-4 border rounded-lg bg-red-50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="font-medium text-red-700">Error loading {category.label}</span>
                    </div>
                    <p className="text-sm text-red-600">Please refresh the page to try again.</p>
                  </div>
                );
              }
            }) : (
              <div className="text-center py-4 text-gray-500">
                Error loading autonomy categories. Please refresh the page.
              </div>
            )}
          </div>

          <hr />

          {/* Override Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Override Settings</h3>
            <p className="text-sm text-gray-600">
              Special overrides that take precedence over autonomy levels.
            </p>
            
            <div className="space-y-3">
              {/* Work Hours Override */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="font-medium">Work Hours Override</label>
                    <p className="text-sm text-gray-600">
                      Prevent AI actions during your work hours
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.workHoursOverride}
                    onChange={(e) => handleSwitchChange('workHoursOverride', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
                {settings.workHoursOverride && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Time
                        </label>
                        <TimePicker12Hour
                          value={settings.workHoursStart || '09:00'}
                          onChange={(time) => setSettings(prev => ({ ...prev, workHoursStart: time }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Time
                        </label>
                        <TimePicker12Hour
                          value={settings.workHoursEnd || '17:00'}
                          onChange={(time) => setSettings(prev => ({ ...prev, workHoursEnd: time }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Family Time Override */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="font-medium">Family Time Override</label>
                    <p className="text-sm text-gray-600">
                      Prevent AI actions during family time
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.familyTimeOverride}
                    onChange={(e) => handleSwitchChange('familyTimeOverride', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
                {settings.familyTimeOverride && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Time
                        </label>
                        <TimePicker12Hour
                          value={settings.familyTimeStart || '18:00'}
                          onChange={(time) => setSettings(prev => ({ ...prev, familyTimeStart: time }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Time
                        </label>
                        <TimePicker12Hour
                          value={settings.familyTimeEnd || '20:00'}
                          onChange={(time) => setSettings(prev => ({ ...prev, familyTimeEnd: time }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Sleep Hours Override */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="font-medium">Sleep Hours Override</label>
                    <p className="text-sm text-gray-600">
                      Prevent AI actions during your sleep hours
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sleepHoursOverride}
                    onChange={(e) => handleSwitchChange('sleepHoursOverride', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
                {settings.sleepHoursOverride && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Time
                        </label>
                        <TimePicker12Hour
                          value={settings.sleepHoursStart || '22:00'}
                          onChange={(time) => setSettings(prev => ({ ...prev, sleepHoursStart: time }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Time
                        </label>
                        <TimePicker12Hour
                          value={settings.sleepHoursEnd || '07:00'}
                          onChange={(time) => setSettings(prev => ({ ...prev, sleepHoursEnd: time }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <hr />

          {/* Approval Thresholds */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Approval Thresholds</h3>
            <p className="text-sm text-gray-600">
              Set thresholds for when AI actions require your approval.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="font-medium">Financial Threshold ($)</label>
                <input
                  type="number"
                  value={settings.financialThreshold}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    financialThreshold: parseFloat(e.target.value) || 0 
                  }))}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
                <p className="text-xs text-gray-600">
                  Actions with financial impact above this amount require approval
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">Time Commitment (minutes)</label>
                <input
                  type="number"
                  value={settings.timeCommitmentThreshold}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    timeCommitmentThreshold: parseInt(e.target.value) || 0 
                  }))}
                  className="w-full p-2 border rounded"
                  placeholder="60"
                />
                <p className="text-xs text-gray-600">
                  Actions requiring more time than this require approval
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">People Affected</label>
                <input
                  type="number"
                  value={settings.peopleAffectedThreshold}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    peopleAffectedThreshold: parseInt(e.target.value) || 0 
                  }))}
                  className="w-full p-2 border rounded"
                  placeholder="1"
                />
                <p className="text-xs text-gray-600">
                  Actions affecting more people than this require approval
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations && Array.isArray(recommendations) && recommendations.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-semibold">AI Recommendations</h2>
            </div>
            
            <div className="space-y-3">
              {recommendations && Array.isArray(recommendations) ? recommendations.map((rec, index) => {
                try {
                  return (
                    <Alert key={index}>
                      {rec.type === 'increase_autonomy' ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <span>
                        <strong>{rec.type === 'increase_autonomy' ? 'Increase' : 'Decrease'} Autonomy</strong>
                        <br />
                        {rec.reason}
                        <br />
                        <span className="text-sm text-gray-600">
                          Suggested level: {rec.suggestedLevel}%
                        </span>
                      </span>
                    </Alert>
                  );
                } catch (error) {
                  console.error('Error rendering recommendation:', index, error);
                  return (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Error loading recommendation. Please refresh the page.</span>
                    </Alert>
                  );
                }
              }) : (
                <div className="text-center py-4 text-gray-500">
                  No recommendations available at this time.
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
} 