import { prisma } from '../lib/prisma';
import { HouseholdRole, Prisma } from '@prisma/client';
import { logger } from '../lib/logger';
import { seedBusinessWorkspaceResources } from './businessWorkspaceSeeder';

export interface DashboardLayout {
  widgets?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
  }>;
  [key: string]: unknown;
}

export interface DashboardPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultView?: 'grid' | 'list';
  refreshInterval?: number;
  notifications?: boolean;
  [key: string]: unknown;
}

export interface DashboardUpdateData {
  name?: string;
  layout?: DashboardLayout;
  preferences?: DashboardPreferences;
}

// Dashboard service stubs
export async function getDashboards(userId: string) {
  // First, validate that the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  return prisma.dashboard.findMany({
    where: { userId },
    include: { widgets: true },
    orderBy: { createdAt: 'asc' },
  });
}

// Get all dashboards including business and educational contexts
export async function getAllUserDashboards(userId: string) {
  // First, validate that the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Get personal dashboards
  const personalDashboards = await prisma.dashboard.findMany({
    where: { 
      userId,
      businessId: null,
      institutionId: null,
      householdId: null
    },
    include: { widgets: true },
    orderBy: { createdAt: 'asc' },
  });

  // Get business dashboards
  const businessDashboards = await prisma.dashboard.findMany({
    where: { 
      userId,
      businessId: { not: null }
    },
    include: { 
      widgets: true,
      business: {
        select: {
          id: true,
          name: true,
          ein: true
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get educational dashboards
  const educationalDashboards = await prisma.dashboard.findMany({
    where: { 
      userId,
      institutionId: { not: null }
    },
    include: { 
      widgets: true,
      institution: {
        select: {
          id: true,
          name: true,
          type: true
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get household dashboards
  const householdDashboards = await prisma.dashboard.findMany({
    where: { 
      userId,
      householdId: { not: null }
    },
    include: { 
      widgets: true,
      household: {
        select: {
          id: true,
          name: true,
          type: true,
          isPrimary: true
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    personal: personalDashboards,
    business: businessDashboards,
    educational: educationalDashboards,
    household: householdDashboards
  };
}

export async function createDashboard(userId: string, data: { name: string; layout?: DashboardLayout; preferences?: DashboardPreferences; businessId?: string; institutionId?: string; householdId?: string }) {
  // First, validate that the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // If businessId, institutionId, or householdId is provided, check for existing dashboard
  if (data.businessId) {
    const existing = await prisma.dashboard.findFirst({ where: { userId, businessId: data.businessId } });
    if (existing) return prisma.dashboard.findUnique({ where: { id: existing.id }, include: { widgets: true } });
  }
  if (data.institutionId) {
    const existing = await prisma.dashboard.findFirst({ where: { userId, institutionId: data.institutionId } });
    if (existing) return prisma.dashboard.findUnique({ where: { id: existing.id }, include: { widgets: true } });
  }
  if (data.householdId) {
    const existing = await prisma.dashboard.findFirst({ where: { userId, householdId: data.householdId } });
    if (existing) return prisma.dashboard.findUnique({ where: { id: existing.id }, include: { widgets: true } });
  }
  // Create the dashboard first
  const dashboard = await prisma.dashboard.create({
    data: {
      userId,
      name: data.name,
      layout: data.layout as Prisma.InputJsonValue,
      preferences: data.preferences as Prisma.InputJsonValue,
      businessId: data.businessId,
      institutionId: data.institutionId,
      householdId: data.householdId,
    },
  });
  
  // NOTE: No longer auto-creating default widgets
  // Frontend DashboardBuildOutModal will prompt user to select modules
  // This allows for customizable dashboard creation experience

  // Auto-provision personal primary calendar if this is a personal dashboard
  if (!data.businessId && !data.institutionId && !data.householdId) {
    try {
      const existingCalendar = await prisma.calendar.findFirst({
        where: {
          contextType: 'PERSONAL',
          contextId: userId,
          isPrimary: true,
        },
      });

      if (!existingCalendar) {
        const createdCalendar = await prisma.calendar.create({
          data: {
            name: data.name,
            contextType: 'PERSONAL',
            contextId: userId,
            isPrimary: true,
            isSystem: true,
            isDeletable: false,
            defaultReminderMinutes: 10,
            members: {
              create: {
                userId,
                role: 'OWNER',
              },
            },
          },
        });
        await logger.info('Auto-provisioned personal primary calendar on dashboard creation', {
          operation: 'auto_provision_personal_calendar',
          context: { userId, dashboardId: dashboard.id, calendarId: createdCalendar.id, calendarName: data.name },
        });
      }
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Failed to auto-provision personal calendar on dashboard creation', {
        operation: 'auto_provision_personal_calendar',
        error: { message: err.message, stack: err.stack },
        context: { userId, dashboardId: dashboard.id },
      });
      // Don't fail dashboard creation if calendar creation fails
    }
  }

  const dashboardWithWidgets = await prisma.dashboard.findUnique({
    where: { id: dashboard.id },
    include: { widgets: true },
  });

  if (dashboardWithWidgets && data.businessId) {
    const business = await prisma.business.findUnique({
      where: { id: data.businessId },
      select: { name: true },
    });

    try {
      await seedBusinessWorkspaceResources({
        userId,
        businessId: data.businessId,
        businessName: business?.name,
        dashboardId: dashboardWithWidgets.id,
      });
    } catch (error) {
      await logger.error('Failed to seed business workspace resources', {
        operation: 'seed_business_workspace',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        context: {
          userId,
          businessId: data.businessId,
          dashboardId: dashboardWithWidgets.id,
        },
      });
    }
  }

  // Return the dashboard with empty widgets array
  return dashboardWithWidgets;
}

export async function getDashboardById(userId: string, dashboardId: string) {
  // First, validate that the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  return prisma.dashboard.findFirst({
    where: { id: dashboardId, userId },
    include: { widgets: true },
  });
}

export async function ensureBusinessDashboardForUser(userId: string, businessId: string) {
  const existing = await prisma.dashboard.findFirst({
    where: { userId, businessId },
    include: { widgets: true }
  });

  if (existing) {
    return existing;
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true }
  });

  const dashboardName = business?.name ? `${business.name} Workspace` : 'Business Workspace';

  const dashboard = await createDashboard(userId, {
    name: dashboardName,
    businessId
  });

  return dashboard;
}

export async function updateDashboard(userId: string, dashboardId: string, data: DashboardUpdateData) {
  // First, validate that the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  const updateData: Record<string, unknown> = {};
  
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.layout !== undefined) {
    // Use proper Prisma JSON type with validation
    updateData.layout = data.layout as Prisma.InputJsonValue;
  }
  if (data.preferences !== undefined) {
    // Use proper Prisma JSON type with validation
    updateData.preferences = data.preferences as Prisma.InputJsonValue;
  }

  const updated = await prisma.dashboard.updateMany({
    where: { id: dashboardId, userId },
    data: updateData,
  });
  if (updated.count === 0) return null;
  return prisma.dashboard.findFirst({ where: { id: dashboardId, userId }, include: { widgets: true } });
}

export async function deleteDashboard(userId: string, dashboardId: string) {
  // First, validate that the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Fetch the dashboard to check its associations
  const dashboard = await prisma.dashboard.findFirst({ where: { id: dashboardId, userId } });
  if (!dashboard) return { count: 0 };
  
  // Business and educational dashboards are protected
  if (dashboard.businessId || dashboard.institutionId) {
    // Protected: do not delete
    return { count: 0 };
  }
  
  // If this is a household dashboard, we need to handle the household deletion
  if (dashboard.householdId) {
    // Check if user is the household owner before allowing deletion
    const ownerMembership = await prisma.householdMember.findFirst({
      where: {
        householdId: dashboard.householdId,
        userId: userId,
        isActive: true,
        role: HouseholdRole.OWNER
      }
    });

    if (!ownerMembership) {
      // Only household owner can delete household dashboard
      return { count: 0 };
    }

    // Delete widgets and conversations first to avoid foreign key issues
    await prisma.widget.deleteMany({
      where: { dashboardId },
    });
    
    await prisma.conversation.deleteMany({
      where: { dashboardId },
    });

    // Delete the dashboard first
    const dashboardDeleteResult = await prisma.dashboard.deleteMany({
      where: { id: dashboardId, userId },
    });

    // Then delete the household and its members
    await prisma.household.delete({
      where: { id: dashboard.householdId }
    });

    return dashboardDeleteResult;
  } else {
    // For regular dashboards, delete widgets and conversations first
    await prisma.widget.deleteMany({
      where: { dashboardId },
    });
    
    await prisma.conversation.deleteMany({
      where: { dashboardId },
    });

    // Delete the dashboard
    return prisma.dashboard.deleteMany({
      where: { id: dashboardId, userId },
    });
  }
}
