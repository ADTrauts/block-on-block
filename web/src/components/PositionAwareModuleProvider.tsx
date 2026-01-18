'use client';

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useWorkAuth } from '../contexts/WorkAuthContext';
import { useBusinessConfiguration } from '../contexts/BusinessConfigurationContext';
import { ModuleConfig } from '../config/modules';
import { getInstalledModules } from '../api/modules';

interface PositionAwareModule extends ModuleConfig {
  accessReason?: 'personal' | 'position' | 'department' | 'tier' | 'admin';
  businessModule?: boolean;
}

interface PositionAwareModuleContextType {
  getFilteredModules: () => PositionAwareModule[];
  hasModuleAccess: (moduleId: string) => boolean;
  getModuleAccessReason: (moduleId: string) => string;
}

const PositionAwareModuleContext = createContext<PositionAwareModuleContextType | undefined>(undefined);

interface PositionAwareModuleProviderProps {
  children: React.ReactNode;
}

// Default personal modules (always available)
const DEFAULT_PERSONAL_MODULES: ModuleConfig[] = [
  { id: 'dashboard', name: 'Dashboard', description: 'Main personal dashboard', icon: 'dashboard', path: '/dashboard', permissions: ['view'], category: 'core' },
  { id: 'drive', name: 'File Hub', description: 'File management system', icon: 'folder', path: '/drive', permissions: ['view', 'upload', 'delete'], category: 'core' },
  { id: 'chat', name: 'Chat', description: 'Team communication', icon: 'message-circle', path: '/chat', permissions: ['view', 'send'], category: 'core' },
  { id: 'calendar', name: 'Calendar', description: 'Schedule management', icon: 'calendar', path: '/calendar', permissions: ['view', 'create'], category: 'core' },
  { id: 'connections', name: 'Connections', description: 'Personal connections', icon: 'users', path: '/connections', permissions: ['view', 'manage'], category: 'core' },
];

export function PositionAwareModuleProvider({ children }: PositionAwareModuleProviderProps) {
  const { data: session } = useSession();
  const { isWorkAuthenticated, currentBusinessId, workCredentials } = useWorkAuth();
  const businessConfig = useBusinessConfiguration();
  const [installedPersonalModules, setInstalledPersonalModules] = useState<ModuleConfig[]>([]);

  // Load installed personal modules
  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const loadInstalledModules = async () => {
      try {
        const installed = await getInstalledModules({ scope: 'personal' });
        
        // Convert installed modules to ModuleConfig format
        const moduleConfigs: ModuleConfig[] = installed.map(module => ({
          id: module.id,
          name: module.name,
          description: module.description || '',
          icon: module.icon || module.id,
          path: `/${module.id}`,
          permissions: module.permissions || ['view'],
          category: 'core' as const
        }));
        
        setInstalledPersonalModules(moduleConfigs);
      } catch (error) {
        console.error('[ModuleProvider] Error loading installed modules:', error);
      }
    };

    loadInstalledModules();
  }, [session?.accessToken]);

  const getFilteredModules = useMemo(() => {
    return (): PositionAwareModule[] => {
      let availableModules: PositionAwareModule[] = [];

      // Always include personal modules
      availableModules = DEFAULT_PERSONAL_MODULES.map(module => ({
        ...module,
        accessReason: 'personal' as const,
        businessModule: false
      }));

      // Add installed personal modules (avoid duplicates)
      installedPersonalModules.forEach(module => {
        if (!availableModules.some(m => m.id === module.id)) {
          availableModules.push({
            ...module,
            accessReason: 'personal' as const,
            businessModule: false
          });
        }
      });

      // If user is authenticated in work context, add business modules based on position
      if (isWorkAuthenticated && currentBusinessId && session?.user?.id && businessConfig.configuration) {
        try {
          const businessModules = businessConfig.getModulesForUser(session.user.id);
          
          // Convert business modules to ModuleConfig format and add them
          const convertedBusinessModules: PositionAwareModule[] = businessModules.map(bModule => {
            const userPosition = businessConfig.getUserPosition(session.user.id);
            const userDepartment = businessConfig.getUserDepartment(session.user.id);
            
            let accessReason: 'position' | 'department' | 'tier' | 'admin' = 'position';
            
            // Determine access reason
            if (userPosition) {
              const positionPermissions = businessConfig.configuration?.positionPermissions[userPosition.id] || [];
              const tierPermissions = businessConfig.configuration?.tierPermissions[userPosition.tierId] || [];
              
              if (positionPermissions.includes('*') || tierPermissions.includes('*')) {
                accessReason = 'admin';
              } else if (tierPermissions.length > 0) {
                accessReason = 'tier';
              } else if (userDepartment && businessConfig.configuration?.departmentModules[userDepartment.id]?.includes(bModule.id)) {
                accessReason = 'department';
              }
            }

            return {
              id: bModule.id,
              name: bModule.name || bModule.id,
              description: bModule.description || 'Business module',
              icon: bModule.id, // Use module ID as icon key
              path: `/${bModule.id}`, // Use simple module path for navigation
              permissions: bModule.permissions,
              category: bModule.category as 'core' | 'business' | 'admin' | 'developer',
              accessReason,
              businessModule: true
            };
          });

          // Add business modules to available modules (avoid duplicates)
          convertedBusinessModules.forEach(bModule => {
            if (!availableModules.some(m => m.id === bModule.id)) {
              availableModules.push(bModule);
            }
          });

          // Special handling for members/connections: remove personal connections if business has members
          const hasBusinessMembers = convertedBusinessModules.some(m => m.id === 'members');
          if (hasBusinessMembers) {
            availableModules = availableModules.filter(m => m.id !== 'connections');
          }

          // Add admin module if user has admin permissions
          const userPosition = businessConfig.getUserPosition(session.user.id);
          if (userPosition) {
            const positionPermissions = businessConfig.configuration?.positionPermissions[userPosition.id] || [];
            const tierPermissions = businessConfig.configuration?.tierPermissions[userPosition.tierId] || [];
            
            if (positionPermissions.includes('*') || tierPermissions.includes('*') || 
                positionPermissions.includes('admin') || tierPermissions.includes('admin')) {
              
              if (!availableModules.some(m => m.id === 'admin')) {
                availableModules.push({
                  id: 'admin',
                  name: 'Admin',
                  description: 'Administrative controls',
                  icon: 'shield',
                  path: '/admin',
                  permissions: ['view', 'manage'],
                  category: 'admin',
                  accessReason: 'admin',
                  businessModule: false
                });
              }
            }
          }
        } catch (error) {
          console.error('Error filtering business modules:', error);
        }
      }

      return availableModules;
    };
  }, [isWorkAuthenticated, currentBusinessId, session?.user?.id, businessConfig.configuration, businessConfig.getModulesForUser, businessConfig.getUserPosition, businessConfig.getUserDepartment, installedPersonalModules]);

  const hasModuleAccess = useMemo(() => {
    return (moduleId: string): boolean => {
      const modules = getFilteredModules();
      return modules.some(m => m.id === moduleId);
    };
  }, [getFilteredModules]);

  const getModuleAccessReason = useMemo(() => {
    return (moduleId: string): string => {
      const modules = getFilteredModules();
      const module = modules.find(m => m.id === moduleId);
      
      if (!module) return 'No access';
      
      switch (module.accessReason) {
        case 'personal':
          return 'Personal access';
        case 'position':
          return 'Position-based access';
        case 'department':
          return 'Department access';
        case 'tier':
          return 'Tier-level access';
        case 'admin':
          return 'Administrator access';
        default:
          return 'Unknown access';
      }
    };
  }, [getFilteredModules]);

  const value: PositionAwareModuleContextType = {
    getFilteredModules,
    hasModuleAccess,
    getModuleAccessReason
  };

  return (
    <PositionAwareModuleContext.Provider value={value}>
      {children}
    </PositionAwareModuleContext.Provider>
  );
}

export function usePositionAwareModules() {
  const context = useContext(PositionAwareModuleContext);
  if (context === undefined) {
    throw new Error('usePositionAwareModules must be used within a PositionAwareModuleProvider');
  }
  return context;
}
