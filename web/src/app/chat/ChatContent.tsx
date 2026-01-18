'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, MessageSquare, Users, Search, Plus } from 'lucide-react';
import ChatLeftPanel from './ChatLeftPanel';
import ChatMainPanel from './ChatMainPanel';
import ChatRightPanel from './ChatRightPanel';
import { ChatPanelState, Conversation } from 'shared/types/chat';
import { useChat } from '../../contexts/ChatContext';

interface FileReference {
  fileId: string;
  fileName: string;
}

interface ChatContentProps {
  fileReference?: FileReference;
}

export default function ChatContent({ fileReference }: ChatContentProps) {
  const { data: session, status } = useSession();
  const { setActiveConversation } = useChat();
  
  const [panelState, setPanelState] = useState<ChatPanelState>({
    globalLeftSidebarExpanded: true, // Will be updated based on actual state
    leftPanelWidth: 280,
    rightPanelWidth: 320,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    rightPanelExpanded: true,
    isMobile: false,
    isTablet: false,
    activeConversationId: null,
    activeThreadId: null,
    searchQuery: '',
    activeFilters: [],
    expandedTeams: [],
  });

  // Add a timeout to show if session is stuck loading
  useEffect(() => {
    if (status === 'loading') {
      const timer = setTimeout(() => {
        // Session still loading after 5 seconds
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;
      
      setPanelState((prev: ChatPanelState) => ({
        ...prev,
        isMobile,
        isTablet,
        // Adjust panel widths based on screen size
        leftPanelWidth: isMobile ? 0 : (prev.globalLeftSidebarExpanded ? 280 : 320),
        rightPanelWidth: isMobile ? 0 : (prev.rightPanelExpanded ? 320 : 64),
        leftPanelCollapsed: isMobile,
        // Keep right panel open by default on desktop/tablet when conversation is selected
        rightPanelCollapsed: isMobile,
        rightPanelExpanded: isMobile ? false : prev.rightPanelExpanded,
      }));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update panel state when global sidebar state changes
  const updateGlobalSidebarState = (expanded: boolean) => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      globalLeftSidebarExpanded: expanded,
      leftPanelWidth: expanded ? 280 : 320,
      rightPanelWidth: prev.rightPanelExpanded ? 320 : 64,
    }));
  };

  const toggleLeftPanel = () => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      leftPanelCollapsed: !prev.leftPanelCollapsed,
    }));
  };

  const toggleRightPanel = () => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      rightPanelCollapsed: !prev.rightPanelCollapsed,
      rightPanelExpanded: prev.rightPanelCollapsed ? true : false,
      rightPanelWidth: prev.rightPanelCollapsed ? 320 : 64,
    }));
  };

  const updateActiveConversation = (conversation: Conversation | null) => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      activeConversationId: conversation?.id || null,
      activeThreadId: null, // Reset thread when changing conversation
      // Open right panel when conversation is selected (on desktop/tablet)
      rightPanelCollapsed: prev.isMobile ? prev.rightPanelCollapsed : false,
      rightPanelExpanded: prev.isMobile ? false : true,
      rightPanelWidth: prev.isMobile ? 0 : 320,
    }));
    
    // Update the shared chat context
    setActiveConversation(conversation);
  };

  const updateActiveThread = (threadId: string | null) => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      activeThreadId: threadId,
    }));
  };

  const updateSearchQuery = (query: string) => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      searchQuery: query,
    }));
  };

  const updateActiveFilters = (filters: string[]) => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      activeFilters: filters,
    }));
  };

  const toggleTeamExpanded = (teamId: string) => {
    setPanelState((prev: ChatPanelState) => ({
      ...prev,
      expandedTeams: prev.expandedTeams.includes(teamId)
        ? prev.expandedTeams.filter((id: string) => id !== teamId)
        : [...prev.expandedTeams, teamId],
    }));
  };

  if (status === 'loading') {
    return (
      <div className="flex h-full w-full bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.accessToken) {
    return (
      <div className="flex h-full w-full bg-gray-50 items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access the chat.</p>
          <a 
            href="/auth/login" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel - Conversation List */}
      <div 
        className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${panelState.leftPanelCollapsed ? 'w-16' : 'w-[260px]'}`}
        style={{ width: panelState.leftPanelCollapsed ? '64px' : '260px', minWidth: panelState.leftPanelCollapsed ? '64px' : '260px', maxWidth: panelState.leftPanelCollapsed ? '64px' : '260px' }}
      >
        <ChatLeftPanel
          panelState={panelState}
          onToggleCollapse={toggleLeftPanel}
          onConversationSelect={updateActiveConversation}
          onSearchQueryChange={updateSearchQuery}
          onFiltersChange={updateActiveFilters}
          onTeamToggle={toggleTeamExpanded}
        />
      </div>

      {/* Main Panel - Active Conversation */}
      <div className="flex-1 min-w-0 flex flex-col bg-gray-50 overflow-hidden">
        <ChatMainPanel
          panelState={panelState}
          onThreadSelect={updateActiveThread}
          onToggleRightPanel={toggleRightPanel}
          fileReference={fileReference}
        />
      </div>

      {/* Right Panel - Thread Details */}
      {panelState.rightPanelCollapsed ? (
        <div className="flex flex-col items-center justify-center bg-white border-l border-gray-200 transition-all duration-300 w-12 min-w-[48px] max-w-[48px] relative">
          <button
            className="absolute top-1/2 transform -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-gray-600 text-white border border-gray-500 cursor-pointer z-20 flex items-center justify-center hover:bg-gray-700 transition-colors"
            onClick={toggleRightPanel}
            title="Expand details panel"
            aria-label="Expand details panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <div 
          className="bg-white border-l border-gray-200 transition-all duration-300 w-[320px] relative flex flex-col overflow-hidden"
          style={{ width: '320px', minWidth: '320px', maxWidth: '320px' }}
        >
          <button
            className="absolute top-1/2 transform -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-gray-600 text-white border border-gray-500 cursor-pointer z-20 flex items-center justify-center hover:bg-gray-700 transition-colors"
            onClick={toggleRightPanel}
            title="Collapse details panel"
            aria-label="Collapse details panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <ChatRightPanel
            panelState={panelState}
            onToggleCollapse={toggleRightPanel}
            onThreadSelect={updateActiveThread}
          />
        </div>
      )}

      {/* Mobile overlay for right panel */}
      {panelState.isMobile && !panelState.rightPanelCollapsed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40">
          <div className="absolute right-0 top-0 h-full bg-white w-80">
            <ChatRightPanel
              panelState={panelState}
              onToggleCollapse={toggleRightPanel}
              onThreadSelect={updateActiveThread}
            />
          </div>
        </div>
      )}

      {/* Panel toggle buttons for mobile/tablet */}
      {panelState.isMobile && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          <button
            onClick={toggleLeftPanel}
            className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          >
            {panelState.leftPanelCollapsed ? <MessageSquare size={20} /> : <ChevronLeft size={20} />}
          </button>
          {panelState.activeConversationId && (
            <button
              onClick={toggleRightPanel}
              className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            >
              {panelState.rightPanelExpanded ? <ChevronRight size={20} /> : <Users size={20} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
} 