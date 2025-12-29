export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  permissions: string[];
  ownerOnly?: boolean;
  category: 'core' | 'business' | 'admin' | 'developer';
}

export const MODULES: ModuleConfig[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Main dashboard and overview',
    icon: 'dashboard',
    path: '/dashboard',
    permissions: ['view'],
    category: 'core',
  },
  {
    id: 'drive',
    name: 'File Hub',
    description: 'File and document management',
    icon: 'folder',
    path: '/drive',
    permissions: ['view', 'upload', 'delete'],
    category: 'core',
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Team communication and messaging',
    icon: 'message-circle',
    path: '/chat',
    permissions: ['view', 'send'],
    category: 'core',
  },
  {
    id: 'ai',
    name: 'AI Assistant',
    description: 'AI-powered assistant and conversation management',
    icon: 'brain',
    path: '/ai',
    permissions: ['view', 'chat'],
    category: 'core',
  },
  {
    id: 'members',
    name: 'Members',
    description: 'Team member management',
    icon: 'users',
    path: '/members',
    permissions: ['view', 'invite', 'manage'],
    category: 'business',
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative controls and settings',
    icon: 'shield',
    path: '/admin',
    permissions: ['view', 'manage'],
    ownerOnly: true,
    category: 'admin',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Business analytics and insights',
    icon: 'bar-chart',
    path: '/analytics',
    permissions: ['view'],
    category: 'business',
  },
  {
    id: 'developer-portal',
    name: 'Developer Portal',
    description: 'Module development and revenue management',
    icon: 'trending-up',
    path: '/developer-portal',
    permissions: ['view', 'manage', 'payout'],
    ownerOnly: true,
    category: 'developer',
  },
];

export const getModuleById = (id: string): ModuleConfig | undefined => {
  return MODULES.find(module => module.id === id);
};

export const getModulesByCategory = (category: string): ModuleConfig[] => {
  return MODULES.filter(module => module.category === category);
};

export const getModulesForUser = (userRole: string, isOwner: boolean): ModuleConfig[] => {
  return MODULES.filter(module => {
    // Owner can see all modules
    if (isOwner) return true;
    
    // Non-owners can't see owner-only modules
    if (module.ownerOnly) return false;
    
    // Add role-based filtering logic here
    return true;
  });
}; 