/**
 * Sidebar Customization Type Definitions
 * 
 * These types define the structure for customizing left and right sidebars
 * in both personal and business contexts.
 */

export interface SidebarFolder {
  id: string;              // Unique folder ID (UUID)
  name: string;           // Display name
  icon?: string;          // Optional folder icon (lucide-react icon name)
  modules: Array<{       // Modules inside this folder
    id: string;          // Module ID
    order: number;       // Order within folder (0-indexed)
  }>;
  collapsed: boolean;     // Is folder collapsed?
  order: number;         // Order of folder in sidebar (0-indexed)
}

export interface LeftSidebarConfig {
  folders: SidebarFolder[];
  looseModules: Array<{  // Modules not in folders
    id: string;
    order: number;
  }>;
}

export interface RightSidebarConfig {
  context: 'personal' | string; // 'personal' or businessId
  pinnedModules: Array<{  // Customizable middle section
    id: string;
    order: number;
  }>;
  // Fixed positions (handled in code):
  // - Dashboard: always index 0
  // - AI Assistant, Modules, Trash: always last 3
}

export interface SidebarCustomization {
  leftSidebar: {
    [dashboardTabId: string]: LeftSidebarConfig; // Tab-specific configs
  };
  rightSidebar: {
    [context: string]: RightSidebarConfig; // Context-specific configs
  };
}

// Full structure stored in Dashboard.preferences
export interface DashboardPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultView?: 'grid' | 'list';
  refreshInterval?: number;
  notifications?: boolean;
  sidebarCustomization?: SidebarCustomization;
  [key: string]: unknown;
}

// API Request/Response types
export interface GetSidebarConfigResponse {
  success: boolean;
  config: SidebarCustomization | null;
  message?: string;
}

export interface SaveSidebarConfigRequest {
  config: SidebarCustomization;
}

export interface SaveSidebarConfigResponse {
  success: boolean;
  message?: string;
}

export interface ResetSidebarConfigRequest {
  scope?: 'tab' | 'sidebar' | 'global';
  dashboardTabId?: string; // Required if scope is 'tab'
  context?: string;        // Required if scope is 'sidebar'
}

export interface ResetSidebarConfigResponse {
  success: boolean;
  message?: string;
}

