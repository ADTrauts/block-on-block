import { businessApiCall } from '@/lib/apiUtils';
import { getSession } from 'next-auth/react';

// Business data interfaces
export interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  formattedAddress?: string;
}

export interface BusinessBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  customCSS?: string;
  faviconUrl?: string;
}

export interface SSOConfiguration {
  provider: 'google' | 'azure' | 'okta' | 'saml';
  name?: string;
  isEnabled: boolean;
  isActive?: boolean;
  config: Record<string, unknown>;
}

export interface Business {
  id: string;
  name: string;
  ein: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: BusinessAddress;
  phone?: string;
  email?: string;
  description?: string;
  branding?: BusinessBranding;
  ssoConfig?: SSOConfiguration;
  schedulingMode?: 'RESTAURANT' | 'HEALTHCARE' | 'RETAIL' | 'MANUFACTURING' | 'OFFICE' | 'COFFEE_SHOP' | 'OTHER';
  schedulingStrategy?: 'AVAILABILITY_FIRST' | 'BUDGET_FIRST' | 'COMPLIANCE_FIRST' | 'TEMPLATE_BASED' | 'AUTO_GENERATE';
  schedulingConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  status: 'active' | 'inactive' | 'suspended';
  // Additional properties included in getUserBusinesses response
  members?: BusinessMember[];
  dashboards?: Array<{
    id: string;
    name: string;
  }>;
  _count?: {
    members: number;
  };
}

export interface BusinessMember {
  id: string;
  businessId: string;
  userId: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
  title?: string;
  department?: string;
  isActive: boolean;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface BusinessInvitation {
  id: string;
  businessId: string;
  email: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
  title?: string;
  department?: string;
  status: 'pending' | 'accepted' | 'expired';
  invitedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface BusinessFollower {
  id: string;
  businessId: string;
  userId: string;
  followedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface BusinessFollowing {
  id: string;
  businessId: string;
  userId: string;
  followedAt: string;
  business: {
    id: string;
    name: string;
    industry?: string;
    logoUrl?: string;
  };
}

export interface BusinessStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  totalFollowers: number;
  totalFollowing: number;
  createdAt: string;
  lastActivityAt: string;
}

export interface BusinessModuleAnalytics {
  moduleId: string;
  moduleName: string;
  totalUsage: number;
  activeUsers: number;
  lastUsed: string;
  usageTrend: 'increasing' | 'decreasing' | 'stable';
  userSatisfaction: number;
  featureUsage: Record<string, number>;
}

// Helper function to make authenticated API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<T> {
  return businessApiCall<T>(endpoint, options, token);
}

// Business API functions
export const createBusiness = async (
  businessData: {
    name: string;
    ein: string;
    industry?: string;
    size?: string;
    website?: string;
    address?: BusinessAddress;
    phone?: string;
    email?: string;
    description?: string;
  }, 
  token: string
): Promise<{ success: boolean; data: Business }> => {
  return apiCall('/', {
    method: 'POST',
    body: JSON.stringify(businessData),
  }, token);
};

export const getUserBusinesses = async (token: string): Promise<{ success: boolean; data: Business[] }> => {
  return apiCall('/', { method: 'GET' }, token);
};

export const getBusiness = async (id: string, token: string): Promise<{ success: boolean; data: Business }> => {
  return apiCall(`/${id}`, { method: 'GET' }, token);
};

export const inviteMember = async (
  businessId: string,
  inviteData: {
    email: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    title?: string;
    department?: string;
  },
  token: string
): Promise<{ success: boolean; data: BusinessInvitation }> => {
  return apiCall(`/${businessId}/invite`, {
    method: 'POST',
    body: JSON.stringify(inviteData),
  }, token);
};

export const acceptInvitation = async (token: string, invitationToken: string): Promise<{ success: boolean; data: BusinessMember }> => {
  return apiCall(`/invite/accept/${invitationToken}`, {
    method: 'POST',
  }, token);
};

// Business profile management functions
export const updateBusiness = async (
  id: string,
  businessData: {
    name?: string;
    industry?: string;
    size?: string;
    website?: string;
    address?: BusinessAddress;
    phone?: string;
    email?: string;
    description?: string;
    branding?: BusinessBranding;
    ssoConfig?: SSOConfiguration;
    schedulingMode?: 'RESTAURANT' | 'HEALTHCARE' | 'RETAIL' | 'MANUFACTURING' | 'OFFICE' | 'COFFEE_SHOP' | 'OTHER';
    schedulingStrategy?: 'AVAILABILITY_FIRST' | 'BUDGET_FIRST' | 'COMPLIANCE_FIRST' | 'TEMPLATE_BASED' | 'AUTO_GENERATE';
    schedulingConfig?: Record<string, unknown>;
  },
  token: string
): Promise<{ success: boolean; data: Business }> => {
  return apiCall(`/${id}`, {
    method: 'PUT',
    body: JSON.stringify(businessData),
  }, token);
};

export const uploadLogo = async (
  id: string,
  logoUrl: string,
  token: string
): Promise<{ success: boolean; data: { logoUrl: string } }> => {
  return apiCall(`/${id}/logo`, {
    method: 'POST',
    body: JSON.stringify({ logoUrl }),
  }, token);
};

export const removeLogo = async (
  id: string,
  token: string
): Promise<{ success: boolean; data: { logoRemoved: boolean } }> => {
  return apiCall(`/${id}/logo`, {
    method: 'DELETE',
  }, token);
};

// Member management functions
export const getBusinessMembers = async (
  id: string,
  token: string
): Promise<{ success: boolean; data: BusinessMember[] }> => {
  return apiCall(`/${id}/members`, { method: 'GET' }, token);
};

export const updateBusinessMember = async (
  businessId: string,
  userId: string,
  memberData: {
    role?: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    title?: string;
    department?: string;
    canInvite?: boolean;
    canManage?: boolean;
    canBilling?: boolean;
  },
  token: string
): Promise<{ success: boolean; data: BusinessMember }> => {
  return apiCall(`/${businessId}/members/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(memberData),
  }, token);
};

export const removeBusinessMember = async (
  businessId: string,
  userId: string,
  token: string
): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/${businessId}/members/${userId}`, {
    method: 'DELETE',
  }, token);
};

// Analytics functions
export const getBusinessAnalytics = async (
  id: string,
  token: string
): Promise<{ success: boolean; data: BusinessStats }> => {
  return apiCall(`/${id}/analytics`, { method: 'GET' }, token);
};

export const getBusinessModuleAnalytics = async (
  id: string,
  token: string
): Promise<{ success: boolean; data: BusinessModuleAnalytics[] }> => {
  return apiCall(`/${id}/module-analytics`, { method: 'GET' }, token);
};

export interface BusinessSetupStatus {
  orgChart: boolean;
  branding: boolean;
  modules: boolean;
  aiAssistant: boolean;
  employees: boolean;
}

export const getBusinessSetupStatus = async (
  id: string,
  token: string
): Promise<{ success: boolean; data: BusinessSetupStatus }> => {
  return apiCall(`/${id}/setup-status`, { method: 'GET' }, token);
};

export const followBusiness = async (businessId: string, token: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/${businessId}/follow`, { method: 'POST' }, token);
};

export const unfollowBusiness = async (businessId: string, token: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/${businessId}/follow`, { method: 'DELETE' }, token);
};

export const getBusinessFollowers = async (businessId: string, token: string): Promise<{ success: boolean; followers: BusinessFollower[] }> => {
  return apiCall(`/${businessId}/followers`, { method: 'GET' }, token);
};

export const getUserFollowing = async (token: string): Promise<{ success: boolean; following: BusinessFollowing[] }> => {
  return apiCall('/user/following', { method: 'GET' }, token);
};

// Business API Client class
class BusinessAPI {
  private token?: string;

  async setToken(token: string) {
    this.token = token;
  }

  async createBusiness(businessData: {
    name: string;
    ein: string;
    industry?: string;
    size?: string;
    website?: string;
    address?: BusinessAddress;
    phone?: string;
    email?: string;
    description?: string;
  }) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return createBusiness(businessData, this.token!);
  }

  async getUserBusinesses() {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getUserBusinesses(this.token!);
  }

  async getBusiness(id: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getBusiness(id, this.token!);
  }

  async inviteMember(businessId: string, inviteData: {
    email: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    title?: string;
    department?: string;
  }) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return inviteMember(businessId, inviteData, this.token!);
  }

  async acceptInvitation(invitationToken: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return acceptInvitation(this.token!, invitationToken);
  }

  // Business profile management methods
  async updateBusiness(id: string, businessData: {
    name?: string;
    industry?: string;
    size?: string;
    website?: string;
    address?: BusinessAddress;
    phone?: string;
    email?: string;
    description?: string;
    branding?: BusinessBranding;
    ssoConfig?: SSOConfiguration;
  }) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return updateBusiness(id, businessData, this.token!);
  }

  async uploadLogo(id: string, logoUrl: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return uploadLogo(id, logoUrl, this.token!);
  }

  async removeLogo(id: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return removeLogo(id, this.token!);
  }

  // Member management methods
  async getBusinessMembers(id: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getBusinessMembers(id, this.token!);
  }

  async updateBusinessMember(businessId: string, userId: string, memberData: {
    role?: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    title?: string;
    department?: string;
    canInvite?: boolean;
    canManage?: boolean;
    canBilling?: boolean;
  }) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return updateBusinessMember(businessId, userId, memberData, this.token!);
  }

  async removeBusinessMember(businessId: string, userId: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return removeBusinessMember(businessId, userId, this.token!);
  }

  // Analytics methods
  async getBusinessAnalytics(id: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getBusinessAnalytics(id, this.token!);
  }

  async getBusinessSetupStatus(id: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getBusinessSetupStatus(id, this.token!);
  }
}

export const businessAPI = new BusinessAPI(); 