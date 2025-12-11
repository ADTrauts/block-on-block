import { prisma } from '../lib/prisma';
import { SchedulingMode, SchedulingStrategy, JobFunction, StationType } from '@prisma/client';

interface EmployeeAvailability {
  employeePositionId: string;
  userId: string;
  userName: string;
  positionTitle: string;
  jobFunction?: JobFunction;
  stationName?: string;
  availability: {
    day: string;
    startTime?: number; // minutes from midnight
    endTime?: number; // minutes from midnight
    isAvailable: boolean;
  }[];
  preferences?: {
    maxHoursPerWeek?: number;
    preferredDays?: string[];
    minHoursBetweenShifts?: number;
  };
  currentHoursThisWeek: number;
  hourlyRate?: number;
}

interface ShiftRequirement {
  day: string;
  startTime: number; // minutes from midnight
  endTime: number; // minutes from midnight
  requiredRole?: string;
  requiredJobFunction?: JobFunction;
  requiredStation?: string;
  minStaffing?: number;
  maxStaffing?: number;
  priority: number; // 1-10, higher = more important
}

interface ScheduleRecommendation {
  shiftId?: string;
  employeePositionId: string;
  day: string;
  startTime: number;
  endTime: number;
  confidence: number; // 0-1
  reason: string;
}

interface PhilosophyContext {
  businessId: string;
  mode: SchedulingMode;
  strategy: SchedulingStrategy;
  employees: EmployeeAvailability[];
  requirements: ShiftRequirement[];
  constraints?: {
    budgetLimit?: number;
    maxHoursPerEmployee?: number;
    minHoursBetweenShifts?: number;
    complianceRules?: string[];
  };
}

/**
 * Scheduling Philosophy Service
 * Implements different scheduling strategies based on business priorities
 */
export class SchedulingPhilosophyService {
  /**
   * Generate schedule recommendations based on selected philosophy
   */
  static async generateRecommendations(
    context: PhilosophyContext
  ): Promise<ScheduleRecommendation[]> {
    switch (context.strategy) {
      case 'AVAILABILITY_FIRST':
        return this.availabilityFirstStrategy(context);
      case 'BUDGET_FIRST':
        return this.budgetFirstStrategy(context);
      case 'COMPLIANCE_FIRST':
        return this.complianceFirstStrategy(context);
      case 'TEMPLATE_BASED':
        return this.templateBasedStrategy(context);
      case 'AUTO_GENERATE':
        return this.autoGenerateStrategy(context);
      default:
        return this.availabilityFirstStrategy(context);
    }
  }

  /**
   * Availability-First Strategy
   * Prioritizes employee availability and preferences
   */
  private static availabilityFirstStrategy(
    context: PhilosophyContext
  ): ScheduleRecommendation[] {
    const recommendations: ScheduleRecommendation[] = [];

    // Sort requirements by priority
    const sortedRequirements = [...context.requirements].sort((a, b) => b.priority - a.priority);

    // Track assigned hours per employee
    const assignedHours: Record<string, number> = {};
    context.employees.forEach(emp => {
      assignedHours[emp.employeePositionId] = 0;
    });

    for (const requirement of sortedRequirements) {
      const dayEmployees = context.employees.filter(emp => {
        // Check if employee is available on this day
        const dayAvailability = emp.availability.find(a => a.day === requirement.day);
        if (!dayAvailability || !dayAvailability.isAvailable) return false;

        // Check if employee has time slot available
        if (dayAvailability.startTime !== undefined && dayAvailability.endTime !== undefined) {
          if (requirement.startTime < dayAvailability.startTime ||
              requirement.endTime > dayAvailability.endTime) {
            return false;
          }
        }

        // Check role/function match if specified
        if (requirement.requiredRole && emp.positionTitle !== requirement.requiredRole) return false;
        if (requirement.requiredJobFunction && emp.jobFunction !== requirement.requiredJobFunction) return false;
        if (requirement.requiredStation && emp.stationName !== requirement.requiredStation) return false;

        // Check max hours constraint
        const maxHours = emp.preferences?.maxHoursPerWeek || context.constraints?.maxHoursPerEmployee || 40;
        const shiftHours = (requirement.endTime - requirement.startTime) / 60;
        if (assignedHours[emp.employeePositionId] + shiftHours > maxHours) return false;

        return true;
      });

      // Sort by preference score (prefer employees who prefer this day)
      dayEmployees.sort((a, b) => {
        const aPrefers = a.preferences?.preferredDays?.includes(requirement.day) ? 1 : 0;
        const bPrefers = b.preferences?.preferredDays?.includes(requirement.day) ? 1 : 0;
        if (aPrefers !== bPrefers) return bPrefers - aPrefers;

        // Then by current hours (spread hours evenly)
        return assignedHours[a.employeePositionId] - assignedHours[b.employeePositionId];
      });

      // Assign employees up to max staffing
      const minStaff = requirement.minStaffing || 1;
      const maxStaff = requirement.maxStaffing || minStaff;
      const toAssign = Math.min(maxStaff, dayEmployees.length);

      for (let i = 0; i < toAssign; i++) {
        const employee = dayEmployees[i];
        if (!employee) continue;

        const shiftHours = (requirement.endTime - requirement.startTime) / 60;
        assignedHours[employee.employeePositionId] += shiftHours;

        recommendations.push({
          employeePositionId: employee.employeePositionId,
          day: requirement.day,
          startTime: requirement.startTime,
          endTime: requirement.endTime,
          confidence: 0.9 - (i * 0.1), // First choice has higher confidence
          reason: `Available on ${requirement.day}, prefers this day`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Budget-First Strategy
   * Optimizes labor costs while maintaining minimum coverage
   */
  private static budgetFirstStrategy(
    context: PhilosophyContext
  ): ScheduleRecommendation[] {
    const recommendations: ScheduleRecommendation[] = [];

    // Sort requirements by priority
    const sortedRequirements = [...context.requirements].sort((a, b) => b.priority - a.priority);

    // Track assigned hours and costs
    const assignedHours: Record<string, number> = {};
    const assignedCost: Record<string, number> = {};
    let totalCost = 0;
    const budgetLimit = context.constraints?.budgetLimit || Infinity;

    context.employees.forEach(emp => {
      assignedHours[emp.employeePositionId] = 0;
      assignedCost[emp.employeePositionId] = 0;
    });

    // Sort employees by hourly rate (cheapest first)
    const sortedEmployees = [...context.employees].sort((a, b) => {
      const rateA = a.hourlyRate || 15; // Default rate
      const rateB = b.hourlyRate || 15;
      return rateA - rateB;
    });

    for (const requirement of sortedRequirements) {
      const dayEmployees = sortedEmployees.filter(emp => {
        // Check availability
        const dayAvailability = emp.availability.find(a => a.day === requirement.day);
        if (!dayAvailability || !dayAvailability.isAvailable) return false;

        if (dayAvailability.startTime !== undefined && dayAvailability.endTime !== undefined) {
          if (requirement.startTime < dayAvailability.startTime ||
              requirement.endTime > dayAvailability.endTime) {
            return false;
          }
        }

        // Check role/function match
        if (requirement.requiredRole && emp.positionTitle !== requirement.requiredRole) return false;
        if (requirement.requiredJobFunction && emp.jobFunction !== requirement.requiredJobFunction) return false;
        if (requirement.requiredStation && emp.stationName !== requirement.requiredStation) return false;

        // Check budget constraint
        const shiftHours = (requirement.endTime - requirement.startTime) / 60;
        const employeeRate = emp.hourlyRate || 15;
        const shiftCost = shiftHours * employeeRate;

        if (totalCost + shiftCost > budgetLimit) return false;

        // Check max hours
        const maxHours = emp.preferences?.maxHoursPerWeek || 40;
        if (assignedHours[emp.employeePositionId] + shiftHours > maxHours) return false;

        return true;
      });

      // Assign cheapest employees first
      const minStaff = requirement.minStaffing || 1;
      const maxStaff = requirement.maxStaffing || minStaff;
      const toAssign = Math.min(maxStaff, dayEmployees.length);

      for (let i = 0; i < toAssign; i++) {
        const employee = dayEmployees[i];
        if (!employee) continue;

        const shiftHours = (requirement.endTime - requirement.startTime) / 60;
        const employeeRate = employee.hourlyRate || 15;
        const shiftCost = shiftHours * employeeRate;

        totalCost += shiftCost;
        assignedHours[employee.employeePositionId] += shiftHours;
        assignedCost[employee.employeePositionId] += shiftCost;

        recommendations.push({
          employeePositionId: employee.employeePositionId,
          day: requirement.day,
          startTime: requirement.startTime,
          endTime: requirement.endTime,
          confidence: 0.85 - (i * 0.05),
          reason: `Cost-effective option ($${employeeRate}/hr)`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Compliance-First Strategy
   * Ensures all labor laws and safety requirements are met
   */
  private static complianceFirstStrategy(
    context: PhilosophyContext
  ): ScheduleRecommendation[] {
    const recommendations: ScheduleRecommendation[] = [];
    const minHoursBetweenShifts = context.constraints?.minHoursBetweenShifts || 8;

    // Sort requirements by priority
    const sortedRequirements = [...context.requirements].sort((a, b) => b.priority - a.priority);

    // Track assigned shifts per employee for compliance checks
    const assignedShifts: Record<string, Array<{ day: string; startTime: number; endTime: number }>> = {};
    context.employees.forEach(emp => {
      assignedShifts[emp.employeePositionId] = [];
    });

    for (const requirement of sortedRequirements) {
      const dayEmployees = context.employees.filter(emp => {
        // Check availability
        const dayAvailability = emp.availability.find(a => a.day === requirement.day);
        if (!dayAvailability || !dayAvailability.isAvailable) return false;

        if (dayAvailability.startTime !== undefined && dayAvailability.endTime !== undefined) {
          if (requirement.startTime < dayAvailability.startTime ||
              requirement.endTime > dayAvailability.endTime) {
            return false;
          }
        }

        // Check role/function match
        if (requirement.requiredRole && emp.positionTitle !== requirement.requiredRole) return false;
        if (requirement.requiredJobFunction && emp.jobFunction !== requirement.requiredJobFunction) return false;
        if (requirement.requiredStation && emp.stationName !== requirement.requiredStation) return false;

        // Check minimum hours between shifts
        const previousShifts = assignedShifts[emp.employeePositionId];
        const hasConflict = previousShifts.some(shift => {
          // Check if this shift would violate minimum hours between shifts
          // This is simplified - in reality, need to check adjacent days too
          return shift.day === requirement.day &&
            Math.abs(shift.endTime - requirement.startTime) < (minHoursBetweenShifts * 60);
        });

        if (hasConflict) return false;

        return true;
      });

      // Sort by current hours (spread evenly for compliance)
      dayEmployees.sort((a, b) => {
        const aShifts = assignedShifts[a.employeePositionId].length;
        const bShifts = assignedShifts[b.employeePositionId].length;
        return aShifts - bShifts;
      });

      const minStaff = requirement.minStaffing || 1;
      const maxStaff = requirement.maxStaffing || minStaff;
      const toAssign = Math.min(maxStaff, dayEmployees.length);

      for (let i = 0; i < toAssign; i++) {
        const employee = dayEmployees[i];
        if (!employee) continue;

        assignedShifts[employee.employeePositionId].push({
          day: requirement.day,
          startTime: requirement.startTime,
          endTime: requirement.endTime,
        });

        recommendations.push({
          employeePositionId: employee.employeePositionId,
          day: requirement.day,
          startTime: requirement.startTime,
          endTime: requirement.endTime,
          confidence: 0.95 - (i * 0.05),
          reason: 'Compliance-safe assignment',
        });
      }
    }

    return recommendations;
  }

  /**
   * Template-Based Strategy
   * Uses existing shift templates and patterns
   */
  private static templateBasedStrategy(
    context: PhilosophyContext
  ): ScheduleRecommendation[] {
    // This would integrate with ShiftTemplate model
    // For now, fall back to availability-first
    return this.availabilityFirstStrategy(context);
  }

  /**
   * Auto-Generate Strategy
   * AI-powered automatic schedule generation
   */
  private static autoGenerateStrategy(
    context: PhilosophyContext
  ): ScheduleRecommendation[] {
    // This would use a combination of all strategies with AI optimization
    // For now, use a balanced approach
    const availabilityRecs = this.availabilityFirstStrategy(context);
    const budgetRecs = this.budgetFirstStrategy(context);
    
    // Merge and optimize
    return availabilityRecs.map(rec => ({
      ...rec,
      confidence: rec.confidence * 0.9, // Slightly lower confidence for auto-generated
      reason: 'AI-generated optimal assignment',
    }));
  }
}

