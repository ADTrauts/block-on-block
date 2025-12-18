'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { generateWorkCredentials, verifyWorkCredentials, WorkCredentials } from '../api/sso';

interface WorkAuthContextType {
  // Current work state
  workCredentials: WorkCredentials | null;
  workToken: string | null;
  isWorkAuthenticated: boolean;
  currentBusinessId: string | null;
  
  // Loading and error states
  loading: boolean;
  error: string | null;
  
  // Actions
  authenticateWork: (businessId: string) => Promise<boolean>;
  logoutWork: () => void;
  verifyWorkToken: (token: string) => Promise<boolean>;
  
  // Utility functions
  hasPermission: (permission: string) => boolean;
  getWorkPermissions: () => string[];
}

const WorkAuthContext = createContext<WorkAuthContextType | undefined>(undefined);

interface WorkAuthProviderProps {
  children: ReactNode;
}

export function WorkAuthProvider({ children }: WorkAuthProviderProps) {
  const { data: session } = useSession();
  const [workCredentials, setWorkCredentials] = useState<WorkCredentials | null>(null);
  const [workToken, setWorkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearWorkUIActiveFlag = () => {
    try {
      localStorage.removeItem('vssyl_work_ui_active');
    } catch {
      // ignore
    }
    // Notify same-tab listeners (AvatarContextMenu)
    window.dispatchEvent(
      new CustomEvent('vssyl:work-ui-active', { detail: { active: false } })
    );
  };

  // Check for existing work token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('workToken');
    if (storedToken) {
      verifyWorkToken(storedToken);
    }
  }, []);

  // Clear work auth when personal session changes
  useEffect(() => {
    if (!session?.accessToken) {
      logoutWork();
    }
  }, [session?.accessToken]);

  const authenticateWork = async (businessId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      if (!session?.accessToken) {
        throw new Error('No personal authentication available');
      }

      const response = await generateWorkCredentials(businessId, session.accessToken);
      
      if (response.success) {
        const { workToken, credentials } = response.data;
        
        // Store work token
        localStorage.setItem('workToken', workToken);
        
        setWorkToken(workToken);
        setWorkCredentials(credentials);
        
        return true;
      } else {
        throw new Error('Failed to generate work credentials');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to authenticate work';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logoutWork = () => {
    localStorage.removeItem('workToken');
    clearWorkUIActiveFlag();
    setWorkToken(null);
    setWorkCredentials(null);
    setError(null);
  };

  const verifyWorkToken = async (token: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await verifyWorkCredentials(token);
      
      if (response.success) {
        setWorkToken(token);
        setWorkCredentials(response.data);
        return true;
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('workToken');
        clearWorkUIActiveFlag();
        setWorkToken(null);
        setWorkCredentials(null);
        return false;
      }
    } catch (err) {
      // Token is invalid, remove it
      localStorage.removeItem('workToken');
      clearWorkUIActiveFlag();
      setWorkToken(null);
      setWorkCredentials(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!workCredentials) return false;
    
    // Admin has all permissions
    if (workCredentials.permissions.includes('*')) return true;
    
    return workCredentials.permissions.includes(permission);
  };

  const getWorkPermissions = (): string[] => {
    return workCredentials?.permissions || [];
  };

  const value: WorkAuthContextType = {
    workCredentials,
    workToken,
    isWorkAuthenticated: !!workCredentials && !!workToken,
    currentBusinessId: workCredentials?.businessId || null,
    loading,
    error,
    authenticateWork,
    logoutWork,
    verifyWorkToken,
    hasPermission,
    getWorkPermissions,
  };

  return (
    <WorkAuthContext.Provider value={value}>
      {children}
    </WorkAuthContext.Provider>
  );
}

export function useWorkAuth() {
  const context = useContext(WorkAuthContext);
  if (context === undefined) {
    throw new Error('useWorkAuth must be used within a WorkAuthProvider');
  }
  return context;
} 