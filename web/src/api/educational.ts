import { getSession } from 'next-auth/react';

// Use relative URLs to go through Next.js API proxy
// This ensures all API calls go through the Next.js API proxy which handles authentication and CORS
const API_BASE = '/api/educational';

// Helper function to make authenticated API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export interface CreateInstitutionRequest {
  name: string;
  type: 'UNIVERSITY' | 'COLLEGE' | 'HIGH_SCHOOL' | 'ELEMENTARY_SCHOOL';
  country: string;
  state?: string;
  city?: string;
  website?: string;
  email?: string;
  phone?: string;
  description?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'STAFF';
  title?: string;
  department?: string;
}

export interface EducationalInstitution {
  id: string;
  name: string;
  type: 'UNIVERSITY' | 'COLLEGE' | 'HIGH_SCHOOL' | 'ELEMENTARY_SCHOOL';
  country: string;
  state?: string;
  city?: string;
  website?: string;
  email?: string;
  phone?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members: InstitutionMember[];
  dashboards: Dashboard[];
  _count: {
    members: number;
  };
}

export interface InstitutionMember {
  id: string;
  institutionId: string;
  userId: string;
  role: 'STUDENT' | 'FACULTY' | 'STAFF';
  title?: string;
  department?: string;
  canInvite: boolean;
  canManage: boolean;
  isActive: boolean;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Dashboard {
  id: string;
  name: string;
  userId: string;
  institutionId?: string;
  businessId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionInvitation {
  id: string;
  institutionId: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'STAFF';
  title?: string;
  department?: string;
  invitedById: string;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

// Educational Institution API functions
export const createInstitution = async (
  institutionData: CreateInstitutionRequest, 
  token: string
): Promise<{ success: boolean; data: EducationalInstitution }> => {
  return apiCall('/', {
    method: 'POST',
    body: JSON.stringify(institutionData),
  }, token);
};

export const getUserInstitutions = async (token: string): Promise<{ success: boolean; data: EducationalInstitution[] }> => {
  return apiCall('/', { method: 'GET' }, token);
};

export const getInstitution = async (id: string, token: string): Promise<{ success: boolean; data: EducationalInstitution }> => {
  return apiCall(`/${id}`, { method: 'GET' }, token);
};

export const inviteMember = async (
  institutionId: string,
  inviteData: InviteMemberRequest,
  token: string
): Promise<{ success: boolean; data: InstitutionInvitation }> => {
  return apiCall(`/${institutionId}/invite`, {
    method: 'POST',
    body: JSON.stringify(inviteData),
  }, token);
};

export const acceptInvitation = async (token: string, invitationToken: string): Promise<{ success: boolean; data: { member: InstitutionMember; dashboard: Dashboard } }> => {
  return apiCall(`/invite/accept/${invitationToken}`, {
    method: 'POST',
  }, token);
};

// Educational Institution API Client class
class EducationalAPI {
  private token?: string;

  async setToken(token: string) {
    this.token = token;
  }

  async createInstitution(institutionData: CreateInstitutionRequest) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return createInstitution(institutionData, this.token);
  }

  async getUserInstitutions() {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getUserInstitutions(this.token);
  }

  async getInstitution(id: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return getInstitution(id, this.token);
  }

  async inviteMember(institutionId: string, inviteData: InviteMemberRequest) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return inviteMember(institutionId, inviteData, this.token);
  }

  async acceptInvitation(invitationToken: string) {
    if (!this.token) {
      const session = await getSession();
      if (!session?.accessToken) {
        throw new Error('No authentication token available');
      }
      this.token = session.accessToken;
    }

    return acceptInvitation(this.token, invitationToken);
  }
}

export const educationalAPI = new EducationalAPI(); 