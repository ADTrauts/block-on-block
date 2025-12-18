'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

export interface TrashedItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'conversation' | 'dashboard_tab' | 'module' | 'message' | 'ai_conversation' | 'event';
  moduleId: string;
  moduleName: string;
  trashedAt: string;
  metadata?: {
    size?: number;
    owner?: string;
    conversationId?: string;
    senderId?: string;
    calendarId?: string;
    calendarName?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

interface GlobalTrashContextType {
  trashedItems: TrashedItem[];
  loading: boolean;
  error: string | null;
  itemCount: number;
  refreshTrash: () => Promise<void>;
  trashItem: (item: Omit<TrashedItem, 'trashedAt'>) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
}

const GlobalTrashContext = createContext<GlobalTrashContextType | undefined>(undefined);

export function GlobalTrashProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [trashedItems, setTrashedItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTrash = useCallback(async () => {
    if (!session?.accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/trash/items', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch trashed items');
      }
      
      const data = await response.json();
      setTrashedItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  const trashItem = async (item: Omit<TrashedItem, 'trashedAt'>) => {
    if (!session?.accessToken) return;
    
    try {
      const response = await fetch('/api/trash/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      });
      
      if (!response.ok) {
        throw new Error('Failed to trash item');
      }
      
      // Refresh the trash list
      await refreshTrash();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trash item');
      throw err;
    }
  };

  const restoreItem = async (id: string) => {
    if (!session?.accessToken) return;
    
    // Find the item being restored to get its metadata
    const itemToRestore = trashedItems.find(item => item.id === id);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/939a7e45-5358-479f-aafd-320e00e09c1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GlobalTrashContext.tsx:95',message:'restoreItem called',data:{id,itemToRestore:itemToRestore?{id:itemToRestore.id,moduleId:itemToRestore.moduleId,type:itemToRestore.type}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    try {
      const response = await fetch(`/api/trash/restore/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to restore item');
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/939a7e45-5358-479f-aafd-320e00e09c1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GlobalTrashContext.tsx:110',message:'restore API success',data:{id,moduleId:itemToRestore?.moduleId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Dispatch generic itemRestored event for all modules
      if (itemToRestore) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/939a7e45-5358-479f-aafd-320e00e09c1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GlobalTrashContext.tsx:115',message:'Dispatching itemRestored event',data:{id:itemToRestore.id,moduleId:itemToRestore.moduleId,type:itemToRestore.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Dispatch generic event that all modules can listen to
        window.dispatchEvent(new CustomEvent('itemRestored', {
          detail: {
            id: itemToRestore.id,
            type: itemToRestore.type,
            moduleId: itemToRestore.moduleId,
            moduleName: itemToRestore.moduleName,
            name: itemToRestore.name,
            metadata: itemToRestore.metadata,
          }
        }));
      }
      
      // Refresh the trash list
      await refreshTrash();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore item');
      throw err;
    }
  };

  const deleteItem = async (id: string) => {
    if (!session?.accessToken) return;
    
    try {
      const response = await fetch(`/api/trash/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete item');
      }
      
      // Refresh the trash list
      await refreshTrash();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      throw err;
    }
  };

  const emptyTrash = async () => {
    if (!session?.accessToken) return;
    
    try {
      const response = await fetch('/api/trash/empty', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to empty trash');
      }
      
      // Clear the local state
      setTrashedItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to empty trash');
      throw err;
    }
  };

  // Refresh trash when session changes
  useEffect(() => {
    if (session?.accessToken) {
      refreshTrash();
    }
  }, [session?.accessToken]);

  const value: GlobalTrashContextType = {
    trashedItems,
    loading,
    error,
    itemCount: trashedItems.length,
    refreshTrash,
    trashItem,
    restoreItem,
    deleteItem,
    emptyTrash,
  };

  return (
    <GlobalTrashContext.Provider value={value}>
      {children}
    </GlobalTrashContext.Provider>
  );
}

export function useGlobalTrash() {
  const context = useContext(GlobalTrashContext);
  if (context === undefined) {
    throw new Error('useGlobalTrash must be used within a GlobalTrashProvider');
  }
  return context;
} 