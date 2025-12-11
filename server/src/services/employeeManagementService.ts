import { PrismaClient, Prisma } from '@prisma/client';
import { EmployeePosition, Position, User, Business } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface CustomPermission {
  id: string;
  moduleId: string;
  featureId: string;
  action: string;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
}

export interface AssignEmployeeData {
  userId: string;
  positionId: string;
  businessId: string;
  assignedById: string;
  startDate: Date;
  endDate?: Date;
  customPermissions?: CustomPermission[];
}

export interface EmployeePositionData {
  id: string;
  userId: string;
  positionId: string;
  businessId: string;
  assignedAt: Date;
  assignedBy: string;
  startDate: Date;
  endDate?: Date;
  active: boolean;
  customPermissions?: CustomPermission[];
  position: Position;
  user: User;
}

export interface BusinessEmployeeSummary {
  totalEmployees: number;
  activeEmployees: number;
  positionsWithEmployees: number;
  totalPositions: number;
  departmentDistribution: Record<string, number>;
  tierDistribution: Record<string, number>;
}

export class EmployeeManagementService {
  /**
   * Assign an employee to a position
   */
  async assignEmployeeToPosition(data: AssignEmployeeData): Promise<EmployeePosition> {
    // Check if position exists and has capacity
    const position = await prisma.position.findUnique({
      where: { id: data.positionId },
      include: {
        employeePositions: {
          where: { active: true },
        },
      },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.employeePositions.length >= position.maxOccupants) {
      throw new Error(`Position ${position.title} is at maximum capacity`);
    }

    // Check if user is already assigned to this position
    const existingAssignment = await prisma.employeePosition.findFirst({
      where: {
        userId: data.userId,
        positionId: data.positionId,
        businessId: data.businessId,
        active: true,
      },
    });

    if (existingAssignment) {
      throw new Error('User is already assigned to this position');
    }

    // Create the assignment
    return await prisma.employeePosition.create({
      data: {
        userId: data.userId,
        positionId: data.positionId,
        businessId: data.businessId,
        assignedById: data.assignedById,
        startDate: data.startDate,
        endDate: data.endDate,
        // TODO: Prisma JSON compatibility issue - using any temporarily
        // Need to research proper Prisma JSON field typing solutions
        customPermissions: data.customPermissions as unknown as Prisma.InputJsonValue,
        active: true,
      },
      include: {
        position: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Remove an employee from a position
   */
  async removeEmployeeFromPosition(
    userId: string,
    positionId: string,
    businessId: string
  ): Promise<void> {
    await prisma.employeePosition.updateMany({
      where: {
        userId,
        positionId,
        businessId,
        active: true,
      },
      data: {
        active: false,
        endDate: new Date(),
      },
    });
  }

  /**
   * Transfer an employee to a different position
   */
  async transferEmployee(
    userId: string,
    fromPositionId: string,
    toPositionId: string,
    businessId: string,
    transferredById: string,
    effectiveDate: Date = new Date()
  ): Promise<EmployeePosition> {
    // Remove from current position
    await this.removeEmployeeFromPosition(userId, fromPositionId, businessId);

    // Assign to new position
    return await this.assignEmployeeToPosition({
      userId,
      positionId: toPositionId,
      businessId,
      assignedById: transferredById,
      startDate: effectiveDate,
    });
  }

  /**
   * Get all employees for a business
   * Includes both users with EmployeePosition records AND business members without positions
   */
  async getBusinessEmployees(businessId: string): Promise<EmployeePositionData[]> {
    // Get all users with active employee positions
    const employeePositions = await prisma.employeePosition.findMany({
      where: { businessId, active: true },
      include: {
        position: {
          include: {
            tier: true,
            department: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { position: { tier: { level: 'asc' } } },
        { position: { title: 'asc' } },
        { user: { name: 'asc' } },
      ],
    });

    // Get all business members (including those without employee positions)
    const businessMembers = await prisma.businessMember.findMany({
      where: { businessId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create a map of users who already have employee positions
    const usersWithPositions = new Set(employeePositions.map(ep => ep.userId));

    // Convert employee positions to the return format
    const employeesWithPositions = employeePositions.map(ep => ({
      id: ep.id,
      userId: ep.userId,
      positionId: ep.positionId,
      businessId: ep.businessId,
      assignedAt: ep.assignedAt,
      assignedBy: ep.assignedById,
      startDate: ep.startDate,
      endDate: ep.endDate || undefined,
      active: ep.active,
      // TODO: Prisma JSON compatibility issue - using any temporarily
      customPermissions: ep.customPermissions as any,
      position: ep.position,
      user: ep.user,
    })) as any;

    // Add business members who don't have employee positions yet
    // These will appear in the list so they can be scheduled even without a formal position
    const membersWithoutPositions = businessMembers
      .filter(member => !usersWithPositions.has(member.userId))
      .map(member => ({
        id: `member-${member.userId}`, // Temporary ID for members without positions
        userId: member.userId,
        positionId: null,
        businessId: member.businessId,
        assignedAt: member.joinedAt,
        assignedBy: null,
        startDate: member.joinedAt,
        endDate: undefined,
        active: true,
        customPermissions: null,
        position: null, // No position assigned yet
        user: member.user,
      })) as any;

    // Combine and sort by user name
    const allEmployees = [...employeesWithPositions, ...membersWithoutPositions];
    allEmployees.sort((a, b) => {
      const nameA = a.user?.name || '';
      const nameB = b.user?.name || '';
      return nameA.localeCompare(nameB);
    });

    return allEmployees;
  }

  /**
   * Get employees by department
   */
  async getEmployeesByDepartment(businessId: string, departmentId: string): Promise<EmployeePositionData[]> {
    const employeePositions = await prisma.employeePosition.findMany({
      where: {
        businessId,
        active: true,
        position: {
          departmentId,
        },
      },
      include: {
        position: {
          include: {
            tier: true,
            department: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { position: { tier: { level: 'asc' } } },
        { position: { title: 'asc' } },
        { user: { name: 'asc' } },
      ],
    });

    return employeePositions.map(ep => ({
      id: ep.id,
      userId: ep.userId,
      positionId: ep.positionId,
      businessId: ep.businessId,
      assignedAt: ep.assignedAt,
      assignedBy: ep.assignedById,
      startDate: ep.startDate,
      endDate: ep.endDate || undefined,
      active: ep.active,
      // TODO: Prisma JSON compatibility issue - using any temporarily
      customPermissions: ep.customPermissions as any,
      position: ep.position,
      user: ep.user,
    })) as any;
  }

  /**
   * Get employees by organizational tier
   */
  async getEmployeesByTier(businessId: string, tierId: string): Promise<EmployeePositionData[]> {
    const employeePositions = await prisma.employeePosition.findMany({
      where: {
        businessId,
        active: true,
        position: {
          tierId,
        },
      },
      include: {
        position: {
          include: {
            tier: true,
            department: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { position: { title: 'asc' } },
        { user: { name: 'asc' } },
      ],
    });

    return employeePositions.map(ep => ({
      id: ep.id,
      userId: ep.userId,
      positionId: ep.positionId,
      businessId: ep.businessId,
      assignedAt: ep.assignedAt,
      assignedBy: ep.assignedById,
      startDate: ep.startDate,
      endDate: ep.endDate || undefined,
      active: ep.active,
      // TODO: Prisma JSON compatibility issue - using any temporarily
      customPermissions: ep.customPermissions as any,
      position: ep.position,
      user: ep.user,
    })) as any;
  }

  /**
   * Get employee's current positions
   */
  async getEmployeePositions(userId: string, businessId: string): Promise<EmployeePositionData[]> {
    const employeePositions = await prisma.employeePosition.findMany({
      where: {
        userId,
        businessId,
        active: true,
      },
      include: {
        position: {
          include: {
            tier: true,
            department: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { position: { tier: { level: 'asc' } } },
        { position: { title: 'asc' } },
      ],
    });

    return employeePositions.map(ep => ({
      id: ep.id,
      userId: ep.userId,
      positionId: ep.positionId,
      businessId: ep.businessId,
      assignedAt: ep.assignedAt,
      assignedBy: ep.assignedById,
      startDate: ep.startDate,
      endDate: ep.endDate || undefined,
      active: ep.active,
      // TODO: Prisma JSON compatibility issue - using any temporarily
      customPermissions: ep.customPermissions as any,
      position: ep.position,
      user: ep.user,
    })) as any;
  }

  /**
   * Get employee assignment history
   */
  async getEmployeeAssignmentHistory(
    userId: string,
    businessId: string
  ): Promise<EmployeePositionData[]> {
    const employeePositions = await prisma.employeePosition.findMany({
      where: {
        userId,
        businessId,
      },
      include: {
        position: {
          include: {
            tier: true,
            department: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { startDate: 'desc' },
        { assignedAt: 'desc' },
      ],
    });

    return employeePositions.map(ep => ({
      id: ep.id,
      userId: ep.userId,
      positionId: ep.positionId,
      businessId: ep.businessId,
      assignedAt: ep.assignedAt,
      assignedBy: ep.assignedById,
      startDate: ep.startDate,
      endDate: ep.endDate || undefined,
      active: ep.active,
      // TODO: Prisma JSON compatibility issue - using any temporarily
      customPermissions: ep.customPermissions as any,
      position: ep.position,
      user: ep.user,
    })) as any;
  }

  /**
   * Update employee position assignment
   */
  async updateEmployeePosition(
    assignmentId: string,
    updates: Partial<{
      startDate: Date;
      endDate: Date;
      customPermissions: CustomPermission[];
    }>
  ): Promise<EmployeePosition> {
    const updateData: Record<string, unknown> = { ...updates };
    
    // Handle JSON fields separately for Prisma compatibility
    // TODO: Prisma JSON compatibility issue - using any temporarily
    if (updates.customPermissions) {
      updateData.customPermissions = updates.customPermissions as any;
    }
    
    return await prisma.employeePosition.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        position: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get business employee summary
   */
  async getBusinessEmployeeSummary(businessId: string): Promise<BusinessEmployeeSummary> {
    const [
      totalEmployees,
      activeEmployees,
      positionsWithEmployees,
      totalPositions,
      departmentDistribution,
      tierDistribution,
    ] = await Promise.all([
      prisma.employeePosition.count({ where: { businessId } }),
      prisma.employeePosition.count({ where: { businessId, active: true } }),
      prisma.position.count({
        where: {
          businessId,
          employeePositions: {
            some: { active: true },
          },
        },
      }),
      prisma.position.count({ where: { businessId } }),
      this.getDepartmentEmployeeDistribution(businessId),
      this.getTierEmployeeDistribution(businessId),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      positionsWithEmployees,
      totalPositions,
      departmentDistribution,
      tierDistribution,
    };
  }

  /**
   * Get department employee distribution
   */
  private async getDepartmentEmployeeDistribution(businessId: string): Promise<Record<string, number>> {
    const distribution = await prisma.employeePosition.groupBy({
      by: ['positionId'],
      where: {
        businessId,
        active: true,
        position: {
          departmentId: { not: null },
        },
      },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const item of distribution) {
      // Get position details to find department
      const position = await prisma.position.findUnique({
        where: { id: item.positionId },
        include: { department: true },
      });
      
      if (position?.department) {
        const count = item._count ? (typeof item._count === 'object' ? item._count.id || 0 : item._count) : 0;
        result[position.department.name] = (result[position.department.name] || 0) + count;
      }
    }

    return result;
  }

  /**
   * Get tier employee distribution
   */
  private async getTierEmployeeDistribution(businessId: string): Promise<Record<string, number>> {
    const distribution = await prisma.employeePosition.groupBy({
      by: ['positionId'],
      where: {
        businessId,
        active: true,
      },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const item of distribution) {
      // Get position details to find tier
      const position = await prisma.position.findUnique({
        where: { id: item.positionId },
        include: { tier: true },
      });
      
      if (position?.tier) {
        const count = item._count ? (typeof item._count === 'object' ? item._count.id || 0 : item._count) : 0;
        result[position.tier.name] = (result[position.tier.name] || 0) + count;
      }
    }

    return result;
  }

  /**
   * Bulk assign employees to positions
   */
  async bulkAssignEmployees(
    assignments: Array<{
      userId: string;
      positionId: string;
      businessId: string;
      assignedById: string;
      startDate: Date;
      customPermissions?: CustomPermission[];
    }>
  ): Promise<EmployeePosition[]> {
    const results: EmployeePosition[] = [];

    for (const assignment of assignments) {
      try {
        const result = await this.assignEmployeeToPosition(assignment);
        results.push(result);
      } catch (error) {
        console.error(`Failed to assign employee ${assignment.userId} to position ${assignment.positionId}:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Get vacant positions
   */
  async getVacantPositions(businessId: string): Promise<Position[]> {
    const positions = await prisma.position.findMany({
      where: {
        businessId,
        employeePositions: {
          none: { active: true },
        },
      },
      include: {
        tier: true,
        department: true,
      },
      orderBy: [
        { tier: { level: 'asc' } },
        { title: 'asc' },
      ],
    });

    return positions;
  }

  /**
   * Get positions with available capacity
   */
  async getPositionsWithCapacity(businessId: string): Promise<Array<Position & { availableSlots: number }>> {
    const positions = await prisma.position.findMany({
      where: { businessId },
      include: {
        tier: true,
        department: true,
        employeePositions: {
          where: { active: true },
        },
      },
      orderBy: [
        { tier: { level: 'asc' } },
        { title: 'asc' },
      ],
    });

    return positions.map(position => ({
      ...position,
      availableSlots: position.maxOccupants - position.employeePositions.length,
    }));
  }

  /**
   * Validate employee assignment
   */
  async validateEmployeeAssignment(
    userId: string,
    positionId: string,
    businessId: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if position exists
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        employeePositions: {
          where: { active: true },
        },
      },
    });

    if (!position) {
      errors.push('Position not found');
      return { isValid: false, errors, warnings };
    }

    // Check if position is in the same business
    if (position.businessId !== businessId) {
      errors.push('Position does not belong to the specified business');
    }

    // Check capacity
    if (position.employeePositions.length >= position.maxOccupants) {
      errors.push(`Position ${position.title} is at maximum capacity`);
    }

    // Check if user is already assigned
    const existingAssignment = await prisma.employeePosition.findFirst({
      where: {
        userId,
        positionId,
        businessId,
        active: true,
      },
    });

    if (existingAssignment) {
      errors.push('User is already assigned to this position');
    }

    // Check for potential conflicts (e.g., overlapping time periods)
    const userAssignments = await prisma.employeePosition.findMany({
      where: {
        userId,
        businessId,
        active: true,
      },
    });

    if (userAssignments.length > 0) {
      warnings.push('User has other active positions in this business');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default new EmployeeManagementService();
