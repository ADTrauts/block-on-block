'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { SearchState, SearchContextType, SearchFilters, SearchResult, SearchSuggestion } from 'shared/types/search';
import { searchAPI } from '../api/search';
import { useSession } from 'next-auth/react';

// Initial state
const initialState: SearchState = {
  query: '',
  results: [],
  suggestions: [],
  loading: false,
  error: null,
  filters: {},
  history: [],
  favorites: [],
};

// Action types
type SearchAction =
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_RESULTS'; payload: SearchResult[] }
  | { type: 'SET_SUGGESTIONS'; payload: SearchSuggestion[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: SearchFilters }
  | { type: 'ADD_TO_HISTORY'; payload: string }
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'LOAD_STATE'; payload: Partial<SearchState> };

// Reducer
function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.payload };
    
    case 'SET_RESULTS':
      return { ...state, results: action.payload };
    
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.payload };
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    
    case 'ADD_TO_HISTORY':
      const newHistory = [action.payload, ...state.history.filter(q => q !== action.payload)].slice(0, 10);
      return { ...state, history: newHistory };
    
    case 'TOGGLE_FAVORITE':
      const newFavorites = state.favorites.includes(action.payload)
        ? state.favorites.filter(f => f !== action.payload)
        : [...state.favorites, action.payload];
      return { ...state, favorites: newFavorites };
    
    case 'CLEAR_RESULTS':
      return { ...state, results: [], suggestions: [], error: null };
    
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

// Create context
const GlobalSearchContext = createContext<SearchContextType | undefined>(undefined);

// Provider component
export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { data: session } = useSession();
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get auth token from NextAuth session
  const getAuthToken = () => {
    if (!isClient) return null;
    return session?.accessToken;
  };

  // Load state from localStorage on mount (client-side only)
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const savedState = localStorage.getItem('globalSearchState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        dispatch({ type: 'LOAD_STATE', payload: parsed });
      }
    } catch (error) {
      console.error('Failed to load search state from localStorage:', error);
    }
  }, [isClient]);

  // Save state to localStorage when it changes (client-side only)
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const stateToSave = {
        history: state.history,
        favorites: state.favorites,
        filters: state.filters,
      };
      localStorage.setItem('globalSearchState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save search state to localStorage:', error);
    }
  }, [state.history, state.favorites, state.filters, isClient]);

  // Search function
  const search = useCallback(async (query: string, filters?: SearchFilters) => {
    if (!query.trim()) {
      dispatch({ type: 'CLEAR_RESULTS' });
      return;
    }

    const effectiveFilters = filters ?? state.filters;

    console.log('🔍 Frontend Search Debug - Starting search with:', { query, filters: effectiveFilters });

    dispatch({ type: 'SET_QUERY', payload: query });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Call search API with auth token
      const token = getAuthToken();
      console.log('🔍 Frontend Search Debug:', { query, token: token ? 'Present' : 'Missing', session: !!session });
      const results = await searchAPI.search(query, effectiveFilters, token || undefined);
      console.log('🔍 Frontend Search Debug - API response:', results);
      dispatch({ type: 'SET_RESULTS', payload: results });
      dispatch({ type: 'ADD_TO_HISTORY', payload: query });
    } catch (error) {
      console.error('🔍 Frontend Search Debug - Error:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Search failed' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [session, isClient]);

  // Get suggestions function
  const getSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      dispatch({ type: 'SET_SUGGESTIONS', payload: [] });
      return;
    }

    try {
      const token = getAuthToken();
      const suggestions = await searchAPI.getSuggestions(query, token || undefined);
      dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions });
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  }, [session, isClient]);

  // Clear results function
  const clearResults = useCallback(() => {
    dispatch({ type: 'CLEAR_RESULTS' });
  }, []);

  // Add to history function
  const addToHistory = useCallback((query: string) => {
    dispatch({ type: 'ADD_TO_HISTORY', payload: query });
  }, []);

  // Toggle favorite function
  const toggleFavorite = useCallback((query: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: query });
  }, []);

  // Set filters function
  const setFilters = useCallback((filters: SearchFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const value: SearchContextType = {
    state,
    search,
    getSuggestions,
    clearResults,
    addToHistory,
    toggleFavorite,
    setFilters,
  };

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

// Hook to use the search context
export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);
  if (context === undefined) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider');
  }
  return context;
} 