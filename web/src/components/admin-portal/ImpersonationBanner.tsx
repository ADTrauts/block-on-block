'use client';

import React from 'react';
import { AlertTriangle, User, X } from 'lucide-react';
import { useImpersonation } from '../../contexts/ImpersonationContext';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, currentSession, endImpersonation } = useImpersonation();

  if (!isImpersonating || !currentSession) {
    return null;
  }

  const handleEndImpersonation = async () => {
    const success = await endImpersonation();
    if (success) {
      // Optionally refresh the page or redirect
      window.location.reload();
    }
  };

  const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 border-b border-yellow-600">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5" />
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <div className="flex flex-col">
              <span className="font-medium">
                You are impersonating{' '}
                <span className="font-bold">{currentSession.targetUser.name}</span>
                <span className="text-yellow-700"> ({currentSession.targetUser.email})</span>
              </span>
              {(currentSession.business || currentSession.context) && (
                <span className="text-sm text-yellow-800">
                  {currentSession.business && (
                    <span>
                      Business:{' '}
                      <span className="font-semibold">{currentSession.business.name}</span>
                    </span>
                  )}
                  {currentSession.business && currentSession.context && <span className="mx-2">•</span>}
                  {currentSession.context && (
                    <span>
                      Context: <span className="font-semibold">{currentSession.context}</span>
                    </span>
                  )}
                </span>
              )}
            </div>
            {currentSession.duration && (
              <span className="text-sm text-yellow-700">
                • Duration: {formatDuration(currentSession.duration)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleEndImpersonation}
          className="flex items-center space-x-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-yellow-900 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
          <span className="text-sm font-medium">Exit Impersonation</span>
        </button>
      </div>
    </div>
  );
}; 