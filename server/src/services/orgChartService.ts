import { PrismaClient, Prisma } from '@prisma/client';
import { Business, OrganizationalTier, Department, Position } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface PermissionData {
  moduleId: string;
  featureId: string;
  action: string;
  description?: string;
  category?: string;
}

export interface ModuleData {
  moduleId: string;
  name: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
}

export interface CreateOrganizationalTierData {
  businessId: string;
  name: string;
  level: number;
  description?: string;
  defaultPermissions?: PermissionData[];
  defaultModules?: ModuleData[];
}

export interface CreateDepartmentData {
  businessId: string;
  name: string;
  description?: string;
  parentDepartmentId?: string;
  headPositionId?: string;
  departmentModules?: ModuleData[];
  departmentPermissions?: PermissionData[];
}

export interface CreatePositionData {
  businessId: string;
  title: string;
  tierId: string;
  departmentId?: string;
  reportsToId?: string;
  permissions?: PermissionData[];
  assignedModules?: ModuleData[];
  maxOccupants?: number;
  customPermissions?: PermissionData[];
  defaultStartTime?: string;
  defaultEndTime?: string;
}

export interface OrgChartStructure {
  business: Business;
  tiers: OrganizationalTier[];
  departments: Department[];
  positions: Position[];
}

export class OrgChartService {
  /**
   * Create a new organizational tier
   */
  async createOrganizationalTier(data: CreateOrganizationalTierData): Promise<OrganizationalTier> {
    return await prisma.organizationalTier.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        level: data.level,
        description: data.description,
        // TODO: Prisma JSON compatibility issue - using any temporarily
        // Need to research proper Prisma JSON field typing solutions
        defaultPermissions: data.defaultPermissions as unknown as Prisma.InputJsonValue,
        defaultModules: data.defaultModules as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get all organizational tiers for a business
   */
  async getOrganizationalTiers(businessId: string): Promise<OrganizationalTier[]> {
    return await prisma.organizationalTier.findMany({
      where: { businessId },
      orderBy: { level: 'asc' },
    });
  }

  /**
   * Update an organizational tier
   */
  async updateOrganizationalTier(
    id: string,
    data: Partial<Omit<CreateOrganizationalTierData, 'businessId'>>
  ): Promise<OrganizationalTier> {
    const updateData: Record<string, unknown> = { ...data };
    
    // Handle JSON fields separately for Prisma compatibility
    // TODO: Prisma JSON compatibility issue - using any temporarily
    if (data.defaultPermissions) {
      updateData.defaultPermissions = data.defaultPermissions as any;
    }
    if (data.defaultModules) {
      updateData.defaultModules = data.defaultModules as any;
    }
    
    return await prisma.organizationalTier.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete an organizational tier
   */
  async deleteOrganizationalTier(id: string): Promise<void> {
    await prisma.organizationalTier.delete({
      where: { id },
    });
  }

  /**
   * Create a new department
   */
  async createDepartment(data: CreateDepartmentData): Promise<Department> {
    return await prisma.department.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        description: data.description,
        parentDepartmentId: data.parentDepartmentId,
        headPositionId: data.headPositionId,
        // TODO: Prisma JSON compatibility issue - using any temporarily
        departmentModules: data.departmentModules as unknown as Prisma.InputJsonValue,
        departmentPermissions: data.departmentPermissions as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get all departments for a business
   */
  async getDepartments(businessId: string): Promise<Department[]> {
    return await prisma.department.findMany({
      where: { businessId },
      include: {
        parentDepartment: true,
        childDepartments: true,
        headPosition: true,
        positions: true,
      },
    });
  }

  /**
   * Get department hierarchy for a business
   */
  async getDepartmentHierarchy(businessId: string): Promise<Department[]> {
    return await prisma.department.findMany({
      where: { 
        businessId,
        parentDepartmentId: null, // Only root departments
      },
      include: {
        childDepartments: {
          include: {
            childDepartments: true,
            positions: true,
          },
        },
        positions: true,
      },
    });
  }

  /**
   * Update a department
   */
  async updateDepartment(
    id: string,
    data: Partial<Omit<CreateDepartmentData, 'businessId'>>
  ): Promise<Department> {
    const updateData: Record<string, unknown> = { ...data };
    
    // Handle JSON fields separately for Prisma compatibility
    // TODO: Prisma JSON compatibility issue - using any temporarily
    if (data.departmentModules) {
      updateData.departmentModules = data.departmentModules as any;
    }
    if (data.departmentPermissions) {
      updateData.departmentPermissions = data.departmentPermissions as any;
    }
    
    return await prisma.department.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a department
   */
  async deleteDepartment(id: string): Promise<void> {
    await prisma.department.delete({
      where: { id },
    });
  }

  /**
   * Create a new position
   */
  async createPosition(data: CreatePositionData): Promise<Position> {
    return await prisma.position.create({
      data: {
        businessId: data.businessId,
        title: data.title,
        tierId: data.tierId,
        departmentId: data.departmentId,
        reportsToId: data.reportsToId,
        // TODO: Prisma JSON compatibility issue - using any temporarily
        permissions: data.permissions as unknown as Prisma.InputJsonValue,
        assignedModules: data.assignedModules as unknown as Prisma.InputJsonValue,
        maxOccupants: data.maxOccupants || 1,
        customPermissions: data.customPermissions as unknown as Prisma.InputJsonValue,
        defaultStartTime: data.defaultStartTime || null,
        defaultEndTime: data.defaultEndTime || null,
      } as Prisma.PositionUncheckedCreateInput,
    });
  }

  /**
   * Get all positions for a business
   */
  async getPositions(businessId: string): Promise<Position[]> {
    return await prisma.position.findMany({
      where: { businessId },
      include: {
        tier: true,
        department: true,
        reportsTo: true,
        directReports: true,
        employeePositions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get position hierarchy for a business
   */
  async getPositionHierarchy(businessId: string): Promise<Position[]> {
    return await prisma.position.findMany({
      where: { 
        businessId,
        reportsToId: null, // Only top-level positions
      },
      include: {
        tier: true,
        department: true,
        directReports: {
          include: {
            tier: true,
            department: true,
            directReports: true,
            employeePositions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        employeePositions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update a position
   */
  async updatePosition(
    id: string,
    data: Partial<Omit<CreatePositionData, 'businessId'>>
  ): Promise<Position> {
    const updateData: Record<string, unknown> = { ...data };
    
    // Handle JSON fields separately for Prisma compatibility
    // TODO: Prisma JSON compatibility issue - using any temporarily
    if (data.permissions) {
      updateData.permissions = data.permissions as any;
    }
    if (data.assignedModules) {
      updateData.assignedModules = data.assignedModules as any;
    }
    if (data.customPermissions) {
      updateData.customPermissions = data.customPermissions as any;
    }
    if (data.defaultStartTime !== undefined) {
      updateData.defaultStartTime = data.defaultStartTime;
    }
    if (data.defaultEndTime !== undefined) {
      updateData.defaultEndTime = data.defaultEndTime;
    }
    
    return await prisma.position.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a position
   */
  async deletePosition(id: string): Promise<void> {
    await prisma.position.delete({
      where: { id },
    });
  }

  /**
   * Get complete org chart structure for a business
   */
  async getOrgChartStructure(businessId: string): Promise<OrgChartStructure> {
    const [business, tiers, departments, positions] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
      }),
      this.getOrganizationalTiers(businessId),
      this.getDepartments(businessId),
      this.getPositions(businessId),
    ]);

    if (!business) {
      throw new Error('Business not found');
    }

    return {
      business,
      tiers,
      departments,
      positions,
    };
  }

  /**
   * Create default org chart structure for a new business
   */
  async createDefaultOrgChart(businessId: string, industry?: string): Promise<void> {
    // Create default organizational tiers
    const defaultTiers = [
      { name: 'C-Suite', level: 1, description: 'Executive leadership' },
      { name: 'VP Level', level: 2, description: 'Vice Presidents and senior management' },
      { name: 'Director', level: 3, description: 'Department directors and managers' },
      { name: 'Manager', level: 4, description: 'Team managers and supervisors' },
      { name: 'Employee', level: 5, description: 'Individual contributors' },
    ];

    for (const tier of defaultTiers) {
      await this.createOrganizationalTier({
        businessId,
        ...tier,
      });
    }

    // Create industry-specific departments
    const departments = this.getIndustryDepartments(industry);
    for (const dept of departments) {
      await this.createDepartment({
        businessId,
        ...dept,
      });
    }
  }

  /**
   * Get industry-specific department templates
   */
  private getIndustryDepartments(industry?: string): Array<{ name: string; description?: string }> {
    const templates: Record<string, Array<{ name: string; description?: string }>> = {
      restaurant: [
        { name: 'Kitchen', description: 'Food preparation and cooking' },
        { name: 'Front of House', description: 'Customer service and dining room' },
        { name: 'Management', description: 'Business operations and leadership' },
      ],
      technology: [
        { name: 'Engineering', description: 'Software development and technical operations' },
        { name: 'Product', description: 'Product management and strategy' },
        { name: 'Sales', description: 'Customer acquisition and revenue' },
        { name: 'Marketing', description: 'Brand and demand generation' },
        { name: 'Operations', description: 'Business operations and support' },
      ],
      manufacturing: [
        { name: 'Production', description: 'Manufacturing and assembly' },
        { name: 'Quality Control', description: 'Quality assurance and testing' },
        { name: 'Engineering', description: 'Product design and process improvement' },
        { name: 'Operations', description: 'Business operations and logistics' },
      ],
      healthcare: [
        { name: 'Clinical', description: 'Medical care and patient services' },
        { name: 'Administrative', description: 'Business operations and support' },
        { name: 'Management', description: 'Leadership and strategic planning' },
      ],
    };

    return templates[industry?.toLowerCase() || 'technology'] || templates.technology;
  }

  /**
   * Validate org chart structure
   */
  async validateOrgChartStructure(businessId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const positions = await this.getPositions(businessId);
    const departments = await this.getDepartments(businessId);

    // Check for circular references in reporting structure
    for (const position of positions) {
      if (position.reportsToId) {
        const visited = new Set<string>();
        let current = position.reportsToId;
        
        while (current) {
          if (visited.has(current)) {
            errors.push(`Circular reference detected in position reporting structure: ${position.title}`);
            break;
          }
          visited.add(current);
          
          const nextPosition = positions.find(p => p.id === current);
          if (!nextPosition || !nextPosition.reportsToId) break;
          current = nextPosition.reportsToId;
        }
      }
    }

    // Check for orphaned positions
    for (const position of positions) {
      if (position.departmentId) {
        const department = departments.find(d => d.id === position.departmentId);
        if (!department) {
          errors.push(`Position ${position.title} references non-existent department`);
        }
      }
    }

    // Check for positions without employees
    const positionsWithEmployees = await prisma.position.findMany({
      where: { businessId },
      include: { employeePositions: true },
    });
    
    for (const position of positionsWithEmployees) {
      if (position.employeePositions?.length === 0) {
        warnings.push(`Position ${position.title} has no assigned employees`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default new OrgChartService();
