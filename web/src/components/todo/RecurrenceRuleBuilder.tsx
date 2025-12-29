'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input } from 'shared/components';
import { Repeat, X } from 'lucide-react';

export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

interface RecurrenceRuleBuilderProps {
  value?: string | null;
  recurrenceEndAt?: string | null;
  onChange: (rrule: string | null, endAt: string | null) => void;
}

/**
 * RecurrenceRuleBuilder - Builds RRULE strings for recurring tasks
 * 
 * Supports common patterns:
 * - Daily: FREQ=DAILY
 * - Weekly: FREQ=WEEKLY;BYDAY=MO (or selected days)
 * - Monthly: FREQ=MONTHLY;BYMONTHDAY=1
 * - Yearly: FREQ=YEARLY
 * - Custom: Direct RRULE input
 */
export function RecurrenceRuleBuilder({ 
  value, 
  recurrenceEndAt,
  onChange 
}: RecurrenceRuleBuilderProps) {
  const [pattern, setPattern] = useState<RecurrencePattern>('none');
  const [interval, setInterval] = useState(1);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [customRule, setCustomRule] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endAfter, setEndAfter] = useState('');
  const [endType, setEndType] = useState<'never' | 'date' | 'after'>('never');

  // Day name abbreviations for RRULE
  const dayAbbr = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Parse existing RRULE to populate form
  useEffect(() => {
    if (!value) {
      setPattern('none');
      return;
    }

    // Try to parse as common pattern
    if (value.includes('FREQ=DAILY')) {
      setPattern('daily');
      const match = value.match(/INTERVAL=(\d+)/);
      if (match) setInterval(parseInt(match[1], 10));
    } else if (value.includes('FREQ=WEEKLY')) {
      setPattern('weekly');
      const match = value.match(/INTERVAL=(\d+)/);
      if (match) setInterval(parseInt(match[1], 10));
      const dayMatch = value.match(/BYDAY=([A-Z,]+)/);
      if (dayMatch) {
        const days = dayMatch[1].split(',').map(d => dayAbbr.indexOf(d));
        setWeeklyDays(days.filter(d => d >= 0));
      }
    } else if (value.includes('FREQ=MONTHLY')) {
      setPattern('monthly');
      const match = value.match(/INTERVAL=(\d+)/);
      if (match) setInterval(parseInt(match[1], 10));
      const dayMatch = value.match(/BYMONTHDAY=(\d+)/);
      if (dayMatch) setMonthlyDay(parseInt(dayMatch[1], 10));
    } else if (value.includes('FREQ=YEARLY')) {
      setPattern('yearly');
      const match = value.match(/INTERVAL=(\d+)/);
      if (match) setInterval(parseInt(match[1], 10));
    } else {
      setPattern('custom');
      setCustomRule(value);
    }
  }, [value]);

  // Parse recurrenceEndAt
  useEffect(() => {
    if (recurrenceEndAt) {
      setEndType('date');
      const date = new Date(recurrenceEndAt);
      setEndDate(date.toISOString().split('T')[0]);
    }
  }, [recurrenceEndAt]);

  // Generate RRULE from pattern
  const generateRRULE = (): string | null => {
    if (pattern === 'none') return null;
    if (pattern === 'custom') return customRule.trim() || null;

    let rrule = '';

    switch (pattern) {
      case 'daily':
        rrule = `FREQ=DAILY`;
        if (interval > 1) rrule += `;INTERVAL=${interval}`;
        break;

      case 'weekly':
        rrule = `FREQ=WEEKLY`;
        if (interval > 1) rrule += `;INTERVAL=${interval}`;
        if (weeklyDays.length > 0) {
          const days = weeklyDays.map(d => dayAbbr[d]).join(',');
          rrule += `;BYDAY=${days}`;
        }
        break;

      case 'monthly':
        rrule = `FREQ=MONTHLY`;
        if (interval > 1) rrule += `;INTERVAL=${interval}`;
        rrule += `;BYMONTHDAY=${monthlyDay}`;
        break;

      case 'yearly':
        rrule = `FREQ=YEARLY`;
        if (interval > 1) rrule += `;INTERVAL=${interval}`;
        break;
    }

    return rrule || null;
  };

  // Handle pattern change - just update state, don't call onChange
  const handlePatternChange = (newPattern: RecurrencePattern) => {
    setPattern(newPattern);
  };

  // Handle any change that affects RRULE - only update when user finishes configuring
  useEffect(() => {
    if (pattern === 'none') {
      // Only call onChange if we're explicitly setting to none (not on initial load)
      if (value !== null && value !== undefined) {
        onChange(null, null);
      }
      return;
    }

    // Only generate RRULE if we have enough info (pattern is set)
    // Don't call onChange on initial mount or when just changing pattern
    const rrule = generateRRULE();
    if (!rrule && pattern !== 'custom') {
      return; // Not enough info yet, don't update
    }

    let endAt: string | null = null;

    if (endType === 'date' && endDate) {
      endAt = new Date(endDate).toISOString();
    } else if (endType === 'after' && endAfter) {
      // For "after N occurrences", we'd need to calculate the end date
      // For now, we'll just set a far future date
      const count = parseInt(endAfter, 10);
      if (!isNaN(count) && count > 0) {
        // This is a simplification - actual implementation would need to calculate
        // based on the RRULE. For now, we'll use a date-based approach.
        endAt = new Date(Date.now() + count * 30 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    // Only call onChange if RRULE actually changed
    const newRRULE = pattern === 'custom' ? customRule : rrule;
    if (newRRULE !== value || endAt !== (recurrenceEndAt || null)) {
      onChange(newRRULE, endAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, interval, weeklyDays, monthlyDay, customRule, endType, endDate, endAfter]);

  const toggleWeeklyDay = (day: number) => {
    setWeeklyDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-gray-500" />
        <label className="text-sm font-medium text-gray-700">Recurrence</label>
      </div>

      {/* Pattern Selection */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={pattern === 'none' ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePatternChange('none');
          }}
        >
          None
        </Button>
        <Button
          type="button"
          variant={pattern === 'daily' ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePatternChange('daily');
          }}
        >
          Daily
        </Button>
        <Button
          type="button"
          variant={pattern === 'weekly' ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePatternChange('weekly');
          }}
        >
          Weekly
        </Button>
        <Button
          type="button"
          variant={pattern === 'monthly' ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePatternChange('monthly');
          }}
        >
          Monthly
        </Button>
        <Button
          type="button"
          variant={pattern === 'yearly' ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePatternChange('yearly');
          }}
        >
          Yearly
        </Button>
        <Button
          type="button"
          variant={pattern === 'custom' ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePatternChange('custom');
          }}
        >
          Custom
        </Button>
      </div>

      {/* Pattern-specific options */}
      {pattern !== 'none' && pattern !== 'custom' && (
        <div className="space-y-3 pl-6 border-l-2 border-gray-200">
          {/* Interval */}
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Repeat every</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
                className="w-20"
              />
              <span className="text-sm text-gray-600">
                {pattern === 'daily' && 'day(s)'}
                {pattern === 'weekly' && 'week(s)'}
                {pattern === 'monthly' && 'month(s)'}
                {pattern === 'yearly' && 'year(s)'}
              </span>
            </div>
          </div>

          {/* Weekly: Day selection */}
          {pattern === 'weekly' && (
            <div>
              <label className="text-xs text-gray-600 mb-2 block">On days</label>
              <div className="flex flex-wrap gap-2">
                {dayNames.map((day, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant={weeklyDays.includes(idx) ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleWeeklyDay(idx);
                    }}
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: Day of month */}
          {pattern === 'monthly' && (
            <div>
              <label className="text-xs text-gray-600 mb-1 block">On day</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(parseInt(e.target.value, 10) || 1)}
                className="w-20"
              />
            </div>
          )}
        </div>
      )}

      {/* Custom RRULE input */}
      {pattern === 'custom' && (
        <div className="pl-6 border-l-2 border-gray-200">
          <label className="text-xs text-gray-600 mb-1 block">RRULE (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)</label>
          <Input
            type="text"
            value={customRule}
            onChange={(e) => setCustomRule(e.target.value)}
            placeholder="FREQ=WEEKLY;BYDAY=MO"
            className="font-mono text-sm"
          />
        </div>
      )}

      {/* End date options */}
      {pattern !== 'none' && (
        <div className="pl-6 border-l-2 border-gray-200 space-y-2">
          <label className="text-xs text-gray-600 block">Ends</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="endType"
                value="never"
                checked={endType === 'never'}
                onChange={() => {
                  setEndType('never');
                  onChange(generateRRULE(), null);
                }}
              />
              <span className="text-sm">Never</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="endType"
                value="date"
                checked={endType === 'date'}
                onChange={() => setEndType('date')}
              />
              <span className="text-sm">On date:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={endType !== 'date'}
                className="flex-1"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

