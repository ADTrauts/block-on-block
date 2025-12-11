/**
 * Scheduling Recommendation Service
 * 
 * Provides industry-specific scheduling mode and strategy recommendations
 * based on business type and characteristics.
 */

import { SchedulingMode, SchedulingStrategy } from '@prisma/client';

export interface BusinessSchedulingRecommendation {
  mode: SchedulingMode;
  strategy: SchedulingStrategy;
  layout: 'employee' | 'role' | 'station';
  defaultStations?: Array<{
    name: string;
    jobFunction: string;
    stationType: string;
    required: boolean;
    description?: string;
  }>;
  shiftPatterns?: {
    typicalShifts: Array<{ start: string; end: string; name: string; description?: string }>;
    peakHours?: Array<{ day: string; hours: string[]; description?: string }>;
  };
  description: string;
  rationale: string[];
}

/**
 * Get recommended scheduling configuration based on industry
 */
export function getRecommendedSchedulingConfig(
  industry: string | null | undefined
): BusinessSchedulingRecommendation {
  if (!industry) {
    return getDefaultRecommendation();
  }

  const normalizedIndustry = industry.toLowerCase().trim();

  // Restaurant
  if (
    normalizedIndustry.includes('restaurant') ||
    normalizedIndustry.includes('dining') ||
    normalizedIndustry.includes('cafe') ||
    normalizedIndustry.includes('bistro') ||
    normalizedIndustry.includes('bar') ||
    normalizedIndustry.includes('tavern')
  ) {
    return {
      mode: SchedulingMode.RESTAURANT,
      strategy: SchedulingStrategy.AVAILABILITY_FIRST,
      layout: 'station',
      defaultStations: [
        {
          name: 'Grill 1',
          jobFunction: 'GRILL',
          stationType: 'BOH',
          required: true,
          description: 'Primary grill station',
        },
        {
          name: 'Grill 2',
          jobFunction: 'GRILL',
          stationType: 'BOH',
          required: false,
          description: 'Secondary grill station (peak hours)',
        },
        {
          name: 'Fry',
          jobFunction: 'FRY',
          stationType: 'BOH',
          required: true,
          description: 'Fry station',
        },
        {
          name: 'Prep',
          jobFunction: 'PREP',
          stationType: 'BOH',
          required: true,
          description: 'Prep station',
        },
        {
          name: 'Expo',
          jobFunction: 'EXPO',
          stationType: 'BOH',
          required: true,
          description: 'Expediter - coordinates orders',
        },
        {
          name: 'Server 1-10',
          jobFunction: 'SERVER',
          stationType: 'FOH',
          required: true,
          description: 'Front of house servers',
        },
        {
          name: 'Host',
          jobFunction: 'HOST',
          stationType: 'FOH',
          required: false,
          description: 'Host/greeter',
        },
        {
          name: 'Bar',
          jobFunction: 'BARTENDER',
          stationType: 'FOH',
          required: false,
          description: 'Bar service',
        },
      ],
      shiftPatterns: {
        typicalShifts: [
          { start: '10:00', end: '18:00', name: 'Day Shift' },
          { start: '17:00', end: '23:00', name: 'Evening Shift' },
          { start: '11:00', end: '19:00', name: 'Swing Shift' },
        ],
        peakHours: [
          { day: 'Friday', hours: ['17:00', '18:00', '19:00', '20:00', '21:00'], description: 'Dinner rush' },
          { day: 'Saturday', hours: ['17:00', '18:00', '19:00', '20:00', '21:00'], description: 'Dinner rush' },
          { day: 'Sunday', hours: ['11:00', '12:00', '13:00', '14:00'], description: 'Brunch' },
        ],
      },
      description: 'Restaurant scheduling with station-based assignments',
      rationale: [
        'Station-based layout is ideal for restaurants',
        'Availability-first strategy respects employee preferences',
        'Peak hour optimization for busy periods',
        'Multiple stations support kitchen and front-of-house operations',
      ],
    };
  }

  // Coffee Shop
  if (
    normalizedIndustry.includes('coffee') ||
    normalizedIndustry.includes('espresso') ||
    normalizedIndustry.includes('roastery')
  ) {
    return {
      mode: SchedulingMode.COFFEE_SHOP,
      strategy: SchedulingStrategy.AVAILABILITY_FIRST,
      layout: 'station',
      defaultStations: [
        {
          name: 'Bar',
          jobFunction: 'BARISTA',
          stationType: 'FOH',
          required: true,
          description: 'Primary barista station',
        },
        {
          name: 'Register',
          jobFunction: 'CASHIER',
          stationType: 'FOH',
          required: true,
          description: 'Point of sale',
        },
        {
          name: 'Warming',
          jobFunction: 'PREP',
          stationType: 'FOH',
          required: false,
          description: 'Food warming station',
        },
        {
          name: 'Drive-Thru',
          jobFunction: 'BARISTA',
          stationType: 'FOH',
          required: false,
          description: 'Drive-thru station',
        },
      ],
      shiftPatterns: {
        typicalShifts: [
          { start: '05:00', end: '13:00', name: 'Opening Shift' },
          { start: '07:00', end: '15:00', name: 'Mid Shift' },
          { start: '09:00', end: '17:00', name: 'Swing Shift' },
          { start: '14:00', end: '22:00', name: 'Closing Shift' },
        ],
        peakHours: [
          { day: 'Monday-Friday', hours: ['07:00', '08:00', '09:00'], description: 'Morning rush' },
          { day: 'Saturday', hours: ['08:00', '09:00', '10:00', '11:00'], description: 'Weekend morning' },
          { day: 'Sunday', hours: ['09:00', '10:00', '11:00', '12:00'], description: 'Sunday morning' },
        ],
      },
      description: 'Coffee shop scheduling with morning/afternoon rush optimization',
      rationale: [
        'Rigid AM/PM rush peaks require station coverage',
        'Task rotation between stations maintains efficiency',
        'Availability-first respects part-time worker constraints',
      ],
    };
  }

  // Healthcare
  if (
    normalizedIndustry.includes('healthcare') ||
    normalizedIndustry.includes('hospital') ||
    normalizedIndustry.includes('clinic') ||
    normalizedIndustry.includes('nursing') ||
    normalizedIndustry.includes('medical')
  ) {
    return {
      mode: SchedulingMode.HEALTHCARE,
      strategy: SchedulingStrategy.COMPLIANCE_FIRST,
      layout: 'role',
      defaultStations: [
        {
          name: 'ICU',
          jobFunction: 'NURSE',
          stationType: 'HEALTHCARE',
          required: true,
          description: 'Intensive Care Unit',
        },
        {
          name: 'Med/Surg',
          jobFunction: 'NURSE',
          stationType: 'HEALTHCARE',
          required: true,
          description: 'Medical/Surgical',
        },
        {
          name: 'ER',
          jobFunction: 'NURSE',
          stationType: 'HEALTHCARE',
          required: true,
          description: 'Emergency Room',
        },
      ],
      shiftPatterns: {
        typicalShifts: [
          { start: '07:00', end: '19:00', name: 'Day Shift (12hr)' },
          { start: '19:00', end: '07:00', name: 'Night Shift (12hr)' },
        ],
      },
      description: 'Healthcare scheduling with 12-hour shifts and compliance requirements',
      rationale: [
        'Compliance-first ensures patient-to-nurse ratios',
        '12-hour shifts are standard in healthcare',
        'Role-based layout shows department coverage',
        'Credentialing requirements enforced',
      ],
    };
  }

  // Retail
  if (
    normalizedIndustry.includes('retail') ||
    normalizedIndustry.includes('store') ||
    normalizedIndustry.includes('shop') ||
    normalizedIndustry.includes('boutique')
  ) {
    return {
      mode: SchedulingMode.RETAIL,
      strategy: SchedulingStrategy.TEMPLATE_BASED,
      layout: 'employee',
      shiftPatterns: {
        typicalShifts: [
          { start: '09:00', end: '17:00', name: 'Opening Shift' },
          { start: '14:00', end: '22:00', name: 'Closing Shift' },
          { start: '10:00', end: '18:00', name: 'Mid Shift' },
        ],
        peakHours: [
          { day: 'Saturday', hours: ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'], description: 'Weekend shopping' },
          { day: 'Sunday', hours: ['12:00', '13:00', '14:00', '15:00', '16:00'], description: 'Weekend shopping' },
        ],
      },
      description: 'Retail scheduling with predictable hours and seasonal variations',
      rationale: [
        'Template-based scheduling works well for predictable hours',
        'Employee-based layout is standard for retail',
        'Seasonal scheduling supports holiday rushes',
      ],
    };
  }

  // Manufacturing
  if (
    normalizedIndustry.includes('manufacturing') ||
    normalizedIndustry.includes('factory') ||
    normalizedIndustry.includes('production') ||
    normalizedIndustry.includes('warehouse')
  ) {
    return {
      mode: SchedulingMode.MANUFACTURING,
      strategy: SchedulingStrategy.COMPLIANCE_FIRST,
      layout: 'role',
      shiftPatterns: {
        typicalShifts: [
          { start: '06:00', end: '14:00', name: 'Day Shift' },
          { start: '14:00', end: '22:00', name: 'Afternoon Shift' },
          { start: '22:00', end: '06:00', name: 'Night Shift' },
        ],
      },
      description: 'Manufacturing scheduling with 3-shift rotation and labor minimums',
      rationale: [
        'Compliance-first ensures safety staffing minimums',
        '24/7 operations require shift rotation',
        'Role-based layout shows line coverage',
      ],
    };
  }

  // Office/Corporate
  if (
    normalizedIndustry.includes('office') ||
    normalizedIndustry.includes('corporate') ||
    normalizedIndustry.includes('business') ||
    normalizedIndustry.includes('consulting')
  ) {
    return {
      mode: SchedulingMode.OFFICE,
      strategy: SchedulingStrategy.AVAILABILITY_FIRST,
      layout: 'employee',
      shiftPatterns: {
        typicalShifts: [
          { start: '09:00', end: '17:00', name: 'Standard 9-5' },
          { start: '08:00', end: '16:00', name: 'Early Shift' },
          { start: '10:00', end: '18:00', name: 'Late Shift' },
        ],
      },
      description: 'Office scheduling with flexible hours and WFH support',
      rationale: [
        'Availability-first supports flexible work arrangements',
        'Employee-based layout is standard for offices',
        'Core hours model (10-3) with flexible start/end times',
      ],
    };
  }

  // Default recommendation
  return getDefaultRecommendation();
}

/**
 * Get default scheduling recommendation for unspecified industries
 */
function getDefaultRecommendation(): BusinessSchedulingRecommendation {
  return {
    mode: SchedulingMode.OTHER,
    strategy: SchedulingStrategy.AVAILABILITY_FIRST,
    layout: 'employee',
    description: 'Standard employee-based scheduling',
    rationale: [
      'Employee-based layout is the most flexible',
      'Availability-first respects employee preferences',
      'Can be customized based on specific business needs',
    ],
  };
}

/**
 * Get recommended stations for a scheduling mode
 */
export function getRecommendedStations(
  mode: SchedulingMode
): Array<{
  name: string;
  jobFunction: string;
  stationType: string;
  required: boolean;
  description?: string;
}> {
  const config = getRecommendedSchedulingConfig(
    mode === SchedulingMode.RESTAURANT
      ? 'restaurant'
      : mode === SchedulingMode.COFFEE_SHOP
      ? 'coffee shop'
      : mode === SchedulingMode.HEALTHCARE
      ? 'healthcare'
      : mode === SchedulingMode.RETAIL
      ? 'retail'
      : mode === SchedulingMode.MANUFACTURING
      ? 'manufacturing'
      : mode === SchedulingMode.OFFICE
      ? 'office'
      : null
  );

  return config.defaultStations || [];
}

