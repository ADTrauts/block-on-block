'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert, Input } from 'shared/components';
import { Tabs } from 'shared/components';
import { Calendar, CheckCircle, AlertCircle, Info, Sparkles, Settings, Users } from 'lucide-react';
import { getSchedulingRecommendations, type SchedulingRecommendation } from '@/api/scheduling';
import { updateBusiness } from '@/api/business';
import { getBusiness } from '@/api/business';
import StationsAndPositionsEditor from './StationsAndPositionsEditor';

interface SchedulingConfigurationProps {
  businessId: string;
  businessIndustry?: string;
  currentMode?: string;
  currentStrategy?: string;
  token: string;
  canManage: boolean;
  onSave?: () => void;
}

const SCHEDULING_MODES = [
  { value: 'RESTAURANT', label: 'Restaurant', description: 'Station-based scheduling with kitchen and front-of-house' },
  { value: 'COFFEE_SHOP', label: 'Coffee Shop', description: 'AM/PM rush optimization with task rotation' },
  { value: 'HEALTHCARE', label: 'Healthcare', description: '12-hour shifts with compliance requirements' },
  { value: 'RETAIL', label: 'Retail', description: 'Template-based scheduling with seasonal variations' },
  { value: 'MANUFACTURING', label: 'Manufacturing', description: '3-shift rotation with labor minimums' },
  { value: 'OFFICE', label: 'Office/Corporate', description: 'Flexible hours with WFH support' },
  { value: 'OTHER', label: 'Other', description: 'Standard employee-based scheduling' },
];

const SCHEDULING_STRATEGIES = [
  { value: 'AVAILABILITY_FIRST', label: 'Availability-First', description: 'Prioritize employee availability and preferences' },
  { value: 'BUDGET_FIRST', label: 'Budget-First', description: 'Optimize labor costs while maintaining coverage' },
  { value: 'COMPLIANCE_FIRST', label: 'Compliance-First', description: 'Enforce labor laws and safety requirements' },
  { value: 'TEMPLATE_BASED', label: 'Template-Based', description: 'Use reusable weekly/monthly templates' },
  { value: 'AUTO_GENERATE', label: 'Auto-Generate', description: 'AI-powered automatic schedule generation' },
];

// Common timezones for scheduling
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
];

export default function SchedulingConfiguration({
  businessId,
  businessIndustry,
  currentMode,
  currentStrategy,
  token,
  canManage,
  onSave
}: SchedulingConfigurationProps) {
  const [activeTab, setActiveTab] = useState('preferences');
  const [loading, setLoading] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [recommendation, setRecommendation] = useState<SchedulingRecommendation | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>(currentMode || '');
  const [selectedStrategy, setSelectedStrategy] = useState<string>(currentStrategy || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState({
    viewPreference: 'weekly' as 'weekly' | 'two_weeks' | 'monthly',
    weekStartDay: 'monday' as 'monday' | 'sunday',
    defaultTimezone: 'America/New_York',
    defaultScheduleDuration: 7, // days
    operatingHoursStart: 6, // hour (0-23), default 6 AM
    operatingHoursEnd: 24, // hour (0-24), default 12 AM (midnight)
  });

  useEffect(() => {
    if (businessId && token) {
      loadRecommendations();
      loadBusinessConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, token, businessIndustry]);

  const loadBusinessConfig = async () => {
    try {
      setLoadingBusiness(true);
      const response = await getBusiness(businessId, token);
      if (response.success && response.data) {
        const config = response.data.schedulingConfig as Record<string, unknown> | undefined;
        if (config) {
          setPreferences({
            viewPreference: (config.viewPreference as 'weekly' | 'two_weeks' | 'monthly') || 'weekly',
            weekStartDay: (config.weekStartDay as 'monday' | 'sunday') || 'monday',
            defaultTimezone: (config.defaultTimezone as string) || 'America/New_York',
            defaultScheduleDuration: (config.defaultScheduleDuration as number) || 7,
            operatingHoursStart: (config.operatingHoursStart as number) || 6,
            operatingHoursEnd: (config.operatingHoursEnd as number) || 24,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load business config:', err);
    } finally {
      setLoadingBusiness(false);
    }
  };

  useEffect(() => {
    if (recommendation && !currentMode) {
      setSelectedMode(recommendation.mode);
      setSelectedStrategy(recommendation.strategy);
    } else if (currentMode) {
      setSelectedMode(currentMode);
      setSelectedStrategy(currentStrategy || '');
    }
  }, [recommendation, currentMode, currentStrategy]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSchedulingRecommendations(businessId, businessIndustry, token);
      if (response.success) {
        setRecommendation(response.recommendation);
        if (!currentMode && response.recommendation) {
          setSelectedMode(response.recommendation.mode);
          setSelectedStrategy(response.recommendation.strategy);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedMode || !selectedStrategy) {
      setError('Please select both scheduling mode and strategy');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await updateBusiness(
        businessId,
        {
          schedulingMode: selectedMode as any,
          schedulingStrategy: selectedStrategy as any,
          schedulingConfig: {
            layout: recommendation?.layout || 'employee',
            viewPreference: preferences.viewPreference,
            weekStartDay: preferences.weekStartDay,
            defaultTimezone: preferences.defaultTimezone,
            defaultScheduleDuration: preferences.defaultScheduleDuration,
            operatingHoursStart: preferences.operatingHoursStart,
            operatingHoursEnd: preferences.operatingHoursEnd,
          },
        },
        token
      );

      if (response.success) {
        setSuccess(true);
        if (onSave) {
          onSave();
        }
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scheduling configuration');
    } finally {
      setSaving(false);
    }
  };

  const isRecommended = (value: string, field: 'mode' | 'strategy') => {
    if (!recommendation) return false;
    return field === 'mode' 
      ? recommendation.mode === value
      : recommendation.strategy === value;
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="preferences">
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </Tabs.Trigger>
          <Tabs.Trigger value="stations">
            <Users className="w-4 h-4 mr-2" />
            Stations & Positions
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="preferences">
          <div className="space-y-6">
      {/* Recommendation Card */}
      {recommendation && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Recommended Configuration
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                {recommendation.description}
              </p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge color="blue">Mode: {recommendation.mode.replace('_', ' ')}</Badge>
                  <Badge color="blue">Strategy: {recommendation.strategy.replace('_', ' ')}</Badge>
                  <Badge color="blue">Layout: {recommendation.layout}</Badge>
                </div>
                {recommendation.rationale && recommendation.rationale.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-gray-600">Why this configuration:</p>
                    <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                      {recommendation.rationale.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {recommendation.defaultStations && recommendation.defaultStations.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Recommended Stations:</p>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.defaultStations.map((station, idx) => (
                      <div key={idx} title={station.description}>
                        <Badge 
                          color={station.required ? 'blue' : 'gray'}
                        >
                          {station.name}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert type="error" title="Error">
          {error}
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert type="success" title="Success">
          Scheduling configuration saved successfully!
        </Alert>
      )}

      {/* Scheduling Mode Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Scheduling Mode</h3>
            <p className="text-sm text-gray-600 mt-1">
              Select the scheduling mode that best fits your business type
            </p>
          </div>
          {loading && <Spinner size={20} />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCHEDULING_MODES.map((mode) => {
            const isRecommendedMode = isRecommended(mode.value, 'mode');
            const isSelected = selectedMode === mode.value;

            return (
              <button
                key={mode.value}
                onClick={() => canManage && setSelectedMode(mode.value)}
                disabled={!canManage}
                className={`p-4 text-left rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!canManage ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{mode.label}</span>
                      {isRecommendedMode && (
                        <Badge color="blue" size="sm">Recommended</Badge>
                      )}
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{mode.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Scheduling Strategy Selection */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Scheduling Strategy</h3>
          <p className="text-sm text-gray-600 mt-1">
            Choose how schedules should be generated and optimized
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCHEDULING_STRATEGIES.map((strategy) => {
            const isRecommendedStrategy = isRecommended(strategy.value, 'strategy');
            const isSelected = selectedStrategy === strategy.value;

            return (
              <button
                key={strategy.value}
                onClick={() => canManage && setSelectedStrategy(strategy.value)}
                disabled={!canManage}
                className={`p-4 text-left rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!canManage ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{strategy.label}</span>
                      {isRecommendedStrategy && (
                        <Badge color="blue" size="sm">Recommended</Badge>
                      )}
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{strategy.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-gray-50 border-gray-200">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">About Scheduling Configuration</p>
            <ul className="space-y-1 ml-4 list-disc text-xs">
              <li>The scheduling mode determines the layout and station structure</li>
              <li>The strategy controls how schedules are generated and optimized</li>
              <li>You can change these settings at any time</li>
              <li>Changes only affect newly created schedules</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      {canManage && (
        <div className="flex justify-end space-x-3">
          <Button
            onClick={handleSave}
            disabled={saving || !selectedMode || !selectedStrategy}
            className="flex items-center"
          >
            {saving ? (
              <>
                <div className="mr-2">
                  <Spinner size={16} />
                </div>
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      )}

      {/* Preferences Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Display Preferences</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Default View Preference
            </label>
            <select
              value={preferences.viewPreference}
              onChange={(e) => setPreferences({ ...preferences, viewPreference: e.target.value as typeof preferences.viewPreference })}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="weekly">Weekly (7 days)</option>
              <option value="two_weeks">Two Weeks (14 days)</option>
              <option value="monthly">Monthly (30 days)</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">How many days to show in the schedule view by default</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Week Starts On
            </label>
            <select
              value={preferences.weekStartDay}
              onChange={(e) => setPreferences({ ...preferences, weekStartDay: e.target.value as typeof preferences.weekStartDay })}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">First day of the week for schedule display</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Default Timezone
            </label>
            <select
              value={preferences.defaultTimezone}
              onChange={(e) => setPreferences({ ...preferences, defaultTimezone: e.target.value })}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              Default timezone for schedules. Individual schedules can override this if your business has multiple locations.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Default Schedule Duration (days)
            </label>
            <Input
              type="number"
              min="1"
              max="90"
              value={preferences.defaultScheduleDuration.toString()}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 90) {
                  setPreferences({ ...preferences, defaultScheduleDuration: val });
                }
              }}
              disabled={!canManage}
              placeholder="7"
            />
            <p className="text-xs text-gray-600 mt-1">
              Default number of days for new schedules (typically 7 for weekly, 14 for biweekly)
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Operating Hours for Shift Coverage</h4>
            <p className="text-xs text-gray-600 mb-4">
              Set the time range that will be displayed in the schedule builder day view. This determines when shifts can be scheduled.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Start Hour
                </label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={preferences.operatingHoursStart.toString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 0 && val <= 23) {
                      setPreferences({ ...preferences, operatingHoursStart: val });
                    }
                  }}
                  disabled={!canManage}
                  placeholder="6"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Hour of day to start showing shifts (0-23, e.g., 6 for 6 AM)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  End Hour
                </label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={preferences.operatingHoursEnd.toString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= 24) {
                      setPreferences({ ...preferences, operatingHoursEnd: val });
                    }
                  }}
                  disabled={!canManage}
                  placeholder="24"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Hour of day to stop showing shifts (1-24, e.g., 24 for midnight)
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-gray-700">
                <strong>Example:</strong> Start: 6, End: 24 will show shifts from 6:00 AM to 12:00 AM (midnight).
                This setting controls the time range visible in the day view of the schedule builder.
              </p>
            </div>
          </div>
        </div>
      </Card>
          </div>
        </Tabs.Content>

        <Tabs.Content value="stations">
          <StationsAndPositionsEditor
            businessId={businessId}
            token={token}
            canManage={canManage}
            onSave={onSave}
          />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}

