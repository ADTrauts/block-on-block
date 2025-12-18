// Global Search Types and Interfaces

export interface SearchFilters {
  moduleId?: string;
  type?: string;
  dateRange?: {
    start: Date | string;
    end: Date | string;
  };
  permissions?: string[];
  // Optional: pinned results across modules (e.g. pinned files, chats)
  pinned?: boolean;
  // Optional Drive-specific mime category for file-type filters
  driveMimeCategory?: 'documents' | 'spreadsheets' | 'images' | 'videos';
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  moduleId: string;
  moduleName: string;
  url: string;
  type: string;
  metadata: Record<string, unknown>;
  permissions: Permission[];
  lastModified: Date;
  relevanceScore?: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'result';
  moduleId?: string;
  url?: string;
}

// Interface for modular search providers (Phase 2.5)
export interface SearchProvider {
  moduleId: string;
  moduleName: string;
  search: (query: string, userId: string, filters?: SearchFilters) => Promise<SearchResult[]>;
  getSuggestions?: (query: string, userId: string) => Promise<string[]>;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  loading: boolean;
  error: string | null;
  filters: SearchFilters;
  history: string[];
  favorites: string[];
}

export interface SearchContextType {
  state: SearchState;
  search: (query: string, filters?: SearchFilters) => Promise<void>;
  getSuggestions: (query: string) => Promise<void>;
  clearResults: () => void;
  addToHistory: (query: string) => void;
  toggleFavorite: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
}

// Permission interface for search results
export interface Permission {
  type: 'read' | 'write' | 'admin';
  granted: boolean;
  inherited?: boolean;
}

// Search result types
export const SEARCH_RESULT_TYPES = {
  FILE: 'file',
  FOLDER: 'folder',
  MESSAGE: 'message',
  CONVERSATION: 'conversation',
  USER: 'user',
  TASK: 'task',
  CALENDAR_EVENT: 'calendar_event',
  DASHBOARD: 'dashboard',
  WIDGET: 'widget',
} as const;

export type SearchResultType = typeof SEARCH_RESULT_TYPES[keyof typeof SEARCH_RESULT_TYPES];

// Module IDs for search providers
export const MODULE_IDS = {
  DRIVE: 'drive',
  CHAT: 'chat',
  DASHBOARD: 'dashboard',
  TASKS: 'tasks',
  CALENDAR: 'calendar',
  ADMIN: 'admin',
} as const;

export type ModuleId = typeof MODULE_IDS[keyof typeof MODULE_IDS];
