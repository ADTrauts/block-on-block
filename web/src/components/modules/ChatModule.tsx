'use client';

import React, { useEffect } from 'react';
import ChatContent from '../../app/chat/ChatContent';
import { useChat } from '../../contexts/ChatContext';

interface ChatModuleProps {
  businessId?: string;
  className?: string;
  refreshTrigger?: number;
  dashboardId?: string;
}

/**
 * Standard Chat Module - Personal and basic business chat
 * 
 * This is the full-featured chat system with:
 * - Three-panel layout (Conversations, Messages, Details)
 * - Real-time messaging with WebSocket
 * - File sharing and attachments
 * - Thread support
 * - Reactions and read receipts
 * - Search and discovery
 */
export default function ChatModule({ 
  businessId: _businessId,
  className = '',
  refreshTrigger: _refreshTrigger,
  dashboardId
}: ChatModuleProps) {
  const { setDashboardOverride, clearDashboardOverride } = useChat();

  useEffect(() => {
    if (!dashboardId) {
      return;
    }

    setDashboardOverride(dashboardId);

    return () => {
      clearDashboardOverride(dashboardId);
    };
  }, [dashboardId, setDashboardOverride, clearDashboardOverride]);
  
  return (
    <div className={`h-full ${className}`}>
      {/* Use the existing full-featured ChatContent component */}
      <ChatContent />
    </div>
  );
}

