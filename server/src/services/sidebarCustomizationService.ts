import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger';

// Type definitions (mirrored from web/src/types/sidebar.ts)
export interface SidebarFolder {
  id: string;
  name: string;
  icon?: string;
  modules: Array<{
    id: string;
    order: number;
  }>;
  collapsed: boolean;
  order: number;
}

export interface LeftSidebarConfig {
  folders: SidebarFolder[];
  looseModules: Array<{
    id: string;
    order: number;
  }>;
}

export interface RightSidebarConfig {
  context: 'personal' | string;
  pinnedModules: Array<{
    id: string;
    order: number;
  }>;
}

export interface SidebarCustomization {
  leftSidebar: {
    [dashboardTabId: string]: LeftSidebarConfig;
  };
  rightSidebar: {
    [context: string]: RightSidebarConfig;
  };
}

export interface DashboardPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultView?: 'grid' | 'list';
  refreshInterval?: number;
  notifications?: boolean;
  sidebarCustomization?: SidebarCustomization;
  [key: string]: unknown;
}

/**
 * Default sidebar configurations
 */

export const PERSONAL_LEFT_DEFAULTS: LeftSidebarConfig = {
  folders: [
    {
      id: 'core-apps',
      name: 'Core Apps',
      icon: 'grid',
      modules: [
        { id: 'drive', order: 0 },
        { id: 'chat', order: 1 },
        { id: 'calendar', order: 2 },
      ],
      collapsed: false,
      order: 0,
    },
    {
      id: 'social',
      name: 'Social',
      icon: 'users',
      modules: [
        { id: 'connections', order: 0 },
      ],
      collapsed: false,
      order: 1,
    },
  ],
  looseModules: [
    { id: 'dashboard', order: 0 },
    { id: 'todo', order: 1 },
  ],
};

export const BUSINESS_LEFT_DEFAULTS: LeftSidebarConfig = {
  folders: [
    {
      id: 'communication',
      name: 'Communication',
      icon: 'message-square',
      modules: [
        { id: 'chat', order: 0 },
        { id: 'calendar', order: 1 },
      ],
      collapsed: false,
      order: 0,
    },
    {
      id: 'productivity',
      name: 'Productivity',
      icon: 'briefcase',
      modules: [
        { id: 'drive', order: 0 },
        { id: 'todo', order: 1 },
      ],
      collapsed: false,
      order: 1,
    },
    {
      id: 'business',
      name: 'Business',
      icon: 'building',
      modules: [
        { id: 'hr', order: 0 },
        { id: 'scheduling', order: 1 },
        { id: 'members', order: 2 },
      ],
      collapsed: false,
      order: 2,
    },
  ],
  looseModules: [
    { id: 'dashboard', order: 0 },
  ],
};

export function getPersonalRightDefaults(): RightSidebarConfig {
  return {
    context: 'personal',
    pinnedModules: [
      { id: 'drive', order: 0 },
      { id: 'chat', order: 1 },
      { id: 'calendar', order: 2 },
      { id: 'todo', order: 3 },
    ],
  };
}

export function getBusinessRightDefaults(businessId: string): RightSidebarConfig {
  return {
    context: businessId,
    pinnedModules: [
      { id: 'drive', order: 0 },
      { id: 'chat', order: 1 },
      { id: 'hr', order: 2 },
      { id: 'scheduling', order: 3 },
    ],
  };
}

/**
 * Get default sidebar customization based on context
 */
export function getDefaultSidebarCustomization(
  context: 'personal' | 'business',
  businessId?: string
): SidebarCustomization {
  const leftDefault = context === 'personal' ? PERSONAL_LEFT_DEFAULTS : BUSINESS_LEFT_DEFAULTS;
  const rightDefault = context === 'personal'
    ? getPersonalRightDefaults()
    : getBusinessRightDefaults(businessId || '');

  return {
    leftSidebar: {},
    rightSidebar: {
      [rightDefault.context]: rightDefault,
    },
  };
}

/**
 * Migrate current module order to folder structure
 * Preserves existing order while organizing into default folders
 */
export function migrateCurrentOrderToFolders(
  currentModules: Array<{ id: string }>,
  context: 'personal' | 'business'
): LeftSidebarConfig {
  const defaults = context === 'personal' ? PERSONAL_LEFT_DEFAULTS : BUSINESS_LEFT_DEFAULTS;
  
  // Create a map of module IDs to their current order
  const moduleOrderMap = new Map<string, number>();
  currentModules.forEach((module, index) => {
    moduleOrderMap.set(module.id, index);
  });

  // Organize modules into folders based on defaults
  const folders = defaults.folders.map(folder => {
    const modulesInFolder = folder.modules
      .filter(m => moduleOrderMap.has(m.id))
      .sort((a, b) => {
        const orderA = moduleOrderMap.get(a.id) ?? Infinity;
        const orderB = moduleOrderMap.get(b.id) ?? Infinity;
        return orderA - orderB;
      })
      .map((m, index) => ({ id: m.id, order: index }));

    return {
      ...folder,
      modules: modulesInFolder,
    };
  });

  // Find modules not in any folder
  const allFolderModuleIds = new Set(
    defaults.folders.flatMap(f => f.modules.map(m => m.id))
  );
  const looseModules = currentModules
    .filter(m => !allFolderModuleIds.has(m.id))
    .map((m, index) => ({
      id: m.id,
      order: index,
    }));

  return {
    folders,
    looseModules,
  };
}

/**
 * Get sidebar customization for a dashboard
 */
export async function getSidebarConfig(
  userId: string,
  dashboardId: string
): Promise<SidebarCustomization | null> {
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, userId },
    select: { preferences: true, businessId: true },
  });

  if (!dashboard) {
    return null;
  }

  const preferences = dashboard.preferences as DashboardPreferences | null;
  if (!preferences?.sidebarCustomization) {
    return null;
  }

  return preferences.sidebarCustomization;
}

/**
 * Save sidebar customization for a dashboard
 */
export async function saveSidebarConfig(
  userId: string,
  dashboardId: string,
  config: SidebarCustomization
): Promise<void> {
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, userId },
    select: { preferences: true },
  });

  if (!dashboard) {
    throw new Error('Dashboard not found');
  }

  const currentPreferences = (dashboard.preferences as DashboardPreferences) || {};
  const updatedPreferences: DashboardPreferences = {
    ...currentPreferences,
    sidebarCustomization: config,
  };

  await prisma.dashboard.update({
    where: { id: dashboardId },
    data: {
      preferences: updatedPreferences as Prisma.InputJsonValue,
    },
  });

  await logger.info('Sidebar customization saved', {
    operation: 'save_sidebar_config',
    context: { userId, dashboardId },
  });
}

/**
 * Reset sidebar customization to defaults
 */
export async function resetSidebarConfig(
  userId: string,
  dashboardId: string,
  options?: {
    scope?: 'tab' | 'sidebar' | 'global';
    dashboardTabId?: string;
    context?: string;
  }
): Promise<void> {
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, userId },
    select: { preferences: true, businessId: true },
  });

  if (!dashboard) {
    throw new Error('Dashboard not found');
  }

  const currentPreferences = (dashboard.preferences as DashboardPreferences) || {};
  const currentCustomization = currentPreferences.sidebarCustomization || {
    leftSidebar: {},
    rightSidebar: {},
  };

  const context = dashboard.businessId ? 'business' : 'personal';
  const defaults = getDefaultSidebarCustomization(
    context,
    dashboard.businessId || undefined
  );

  let updatedCustomization: SidebarCustomization;

  if (options?.scope === 'global') {
    // Reset everything
    updatedCustomization = defaults;
  } else if (options?.scope === 'tab' && options.dashboardTabId) {
    // Reset specific tab
    updatedCustomization = {
      ...currentCustomization,
      leftSidebar: {
        ...currentCustomization.leftSidebar,
        [options.dashboardTabId]: defaults.leftSidebar[options.dashboardTabId] || defaults.leftSidebar[''] || PERSONAL_LEFT_DEFAULTS,
      },
    };
  } else if (options?.scope === 'sidebar' && options.context) {
    // Reset specific sidebar context
    updatedCustomization = {
      ...currentCustomization,
      rightSidebar: {
        ...currentCustomization.rightSidebar,
        [options.context]: defaults.rightSidebar[options.context] || getPersonalRightDefaults(),
      },
    };
  } else {
    // Default: reset everything
    updatedCustomization = defaults;
  }

  const updatedPreferences: DashboardPreferences = {
    ...currentPreferences,
    sidebarCustomization: updatedCustomization,
  };

  await prisma.dashboard.update({
    where: { id: dashboardId },
    data: {
      preferences: updatedPreferences as Prisma.InputJsonValue,
    },
  });

  await logger.info('Sidebar customization reset', {
    operation: 'reset_sidebar_config',
    context: { userId, dashboardId, scope: options?.scope },
  });
}

