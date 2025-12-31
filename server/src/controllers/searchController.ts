import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { SearchFilters, SearchResult, SearchProvider } from 'shared/types/search';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to get user from request
const getUserFromRequest = (req: Request) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return null;
  
  return {
    ...user,
    id: user.id
  };
};

// Helper function to handle errors
const handleError = async (res: Response, error: unknown, message: string = 'Internal server error') => {
  const err = error as Error;
  await logger.error('Search controller error', {
    operation: 'search_controller_error',
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
  });
  res.status(500).json({ success: false, error: message });
};

// --- Search Provider Implementations ---

const driveSearchProvider: SearchProvider = {
  moduleId: 'drive',
  moduleName: 'Drive',
  search: async (query, userId, filters) => await searchDrive(query, userId, filters),
};

const chatSearchProvider: SearchProvider = {
  moduleId: 'chat',
  moduleName: 'Chat',
  search: async (query, userId, filters) => await searchChat(query, userId, filters),
};

const dashboardSearchProvider: SearchProvider = {
  moduleId: 'dashboard',
  moduleName: 'Dashboard',
  search: async (query, userId, filters) => await searchDashboard(query, userId, filters),
};

// Member search provider implementation
const memberSearchProvider: SearchProvider = {
  moduleId: 'member',
  moduleName: 'Members',
  search: async (query, userId, filters) => {
    // Only search if query is at least 2 characters
    if (!query || query.length < 2) return [];
    // Search users by name or email, excluding self
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          { id: { not: userId } },
        ],
      },
      take: 10,
    });
    return users.map((user) => ({
      id: user.id,
      title: user.name || user.email,
      description: user.email,
      moduleId: 'member',
      moduleName: 'Members',
      url: `/member/profile/${user.id}`,
      type: 'user',
      metadata: {},
      permissions: [{ type: 'read', granted: true }],
      lastModified: user.updatedAt,
      relevanceScore: 0.7, // Basic score for now
    }));
  },
};

// Provider registry
const searchProviders: SearchProvider[] = [
  driveSearchProvider,
  chatSearchProvider,
  dashboardSearchProvider,
  memberSearchProvider,
];

// Refactored global search using provider registry
export const globalSearch = async (req: Request, res: Response) => {
  try {
    await logger.debug('Global search request received', {
      operation: 'search_global_request',
      context: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
      }
    });

    const user = getUserFromRequest(req);
    await logger.debug('Global search user extracted', {
      operation: 'search_user_extracted',
      userId: user?.id
    });
    
    if (!user) {
      await logger.debug('Global search no user found', {
        operation: 'search_no_user'
      });
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { query, filters }: { query: string; filters?: SearchFilters } = req.body;
    await logger.debug('Global search query and filters', {
      operation: 'search_query_filters',
      query,
      filters
    });

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      await logger.debug('Global search invalid query', {
        operation: 'search_invalid_query'
      });
      return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
    }

    const searchQuery = query.trim();
    let results: SearchResult[] = [];

    await logger.debug('Global search starting', {
      operation: 'search_start',
      query: searchQuery
    });

    // Use provider registry for modular search
    for (const provider of searchProviders) {
      await logger.debug('Global search provider search', {
        operation: 'search_provider',
        providerId: provider.moduleId
      });
      if (!filters?.moduleId || filters.moduleId === provider.moduleId) {
        const providerResults = await provider.search(searchQuery, user.id, filters);
        await logger.debug('Global search provider results', {
          operation: 'search_provider_results',
          providerId: provider.moduleId,
          resultCount: providerResults.length
        });
        results.push(...providerResults);
      }
    }

    await logger.debug('Global search results before sorting', {
      operation: 'search_results_pre_sort',
      count: results.length
    });

    // Sort results by relevance score
    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    await logger.debug('Global search final results', {
      operation: 'search_final_results',
      count: results.length
    });

    res.json({ success: true, results });
  } catch (error) {
    await logger.error('Global search error', {
      operation: 'search_global_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    await handleError(res, error, 'Failed to perform global search');
  }
};

// Get search suggestions
export const getSuggestions = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { q: query } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 1) {
      return res.json({ success: true, suggestions: [] });
    }

    const searchQuery = query.trim();
    const suggestions: Array<Record<string, unknown>> = [];

    // Get recent search history (from user preferences or cache)
    // For now, we'll return some basic suggestions
    suggestions.push(
      { text: searchQuery, type: 'query' },
      { text: `${searchQuery} in drive`, type: 'query' },
      { text: `${searchQuery} in chat`, type: 'query' },
      { text: `${searchQuery} in dashboard`, type: 'query' }
    );

    res.json({ success: true, suggestions });
  } catch (error) {
    await handleError(res, error, 'Failed to get suggestions');
  }
};

// Search in Drive module
async function searchDrive(query: string, userId: string, filters?: SearchFilters): Promise<SearchResult[]> {
  await logger.debug('Drive search starting', {
    operation: 'search_drive_start',
    query,
    userId
  });
  const results: SearchResult[] = [];

  // Normalize optional filters (date range, pinned, mime category)
  let dateStart: Date | undefined;
  let dateEnd: Date | undefined;
  if (filters?.dateRange) {
    const startValue = filters.dateRange.start;
    const endValue = filters.dateRange.end;
    dateStart = startValue ? new Date(startValue) : undefined;
    dateEnd = endValue ? new Date(endValue) : undefined;
  }

  const pinnedOnly = filters?.pinned === true;
  const driveMimeCategory = filters?.driveMimeCategory;

  // Build file where conditions
  const fileAndConditions: Prisma.FileWhereInput[] = [
    {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
      ],
    },
    { userId: userId },
    { trashedAt: null },
  ];

  if (dateStart || dateEnd) {
    fileAndConditions.push({
      updatedAt: {
        ...(dateStart ? { gte: dateStart } : {}),
        ...(dateEnd ? { lte: dateEnd } : {}),
      },
    });
  }

  if (pinnedOnly) {
    fileAndConditions.push({ starred: true });
  }

  if (driveMimeCategory) {
    // Map high-level category to underlying Prisma conditions
    const mimeConditions: Prisma.FileWhereInput[] = [];
    if (driveMimeCategory === 'documents') {
      mimeConditions.push(
        { type: { contains: 'pdf', mode: 'insensitive' } },
        { type: { contains: 'word', mode: 'insensitive' } },
        { type: { contains: 'document', mode: 'insensitive' } },
      );
    } else if (driveMimeCategory === 'spreadsheets') {
      mimeConditions.push(
        { type: { contains: 'excel', mode: 'insensitive' } },
        { type: { contains: 'spreadsheet', mode: 'insensitive' } },
      );
    } else if (driveMimeCategory === 'images') {
      mimeConditions.push({ type: { startsWith: 'image/', mode: 'insensitive' } });
    } else if (driveMimeCategory === 'videos') {
      mimeConditions.push({ type: { startsWith: 'video/', mode: 'insensitive' } });
    }

    if (mimeConditions.length > 0) {
      fileAndConditions.push({
        OR: mimeConditions,
      });
    }
  }

  // Search files
  await logger.debug('Drive search files', {
    operation: 'search_drive_files',
    filtersApplied: {
      dateStart,
      dateEnd,
      pinnedOnly,
      driveMimeCategory,
    },
  });
  const files = await prisma.file.findMany({
    where: {
      AND: fileAndConditions,
    },
    include: {
      folder: true,
    },
    take: 10,
  });

  await logger.debug('Drive search files found', {
    operation: 'search_drive_files_found',
    count: files.length
  });

  for (const file of files) {
    const relevanceScore = calculateRelevanceScore(file.name, query);
    results.push({
      id: file.id,
      title: file.name,
      description: `File in ${file.folder?.name || 'root'}`,
      moduleId: 'drive',
      moduleName: 'Drive',
      url: `/drive?file=${file.id}`,
      type: 'file',
      metadata: {
        size: file.size,
        type: file.type,
        folderId: file.folderId,
      },
      permissions: [{ type: 'read', granted: true }],
      lastModified: file.updatedAt,
      relevanceScore,
    });
  }

  // Build folder where conditions (share date/pinned filters where appropriate)
  const folderAndConditions: Prisma.FolderWhereInput[] = [
    { name: { contains: query, mode: 'insensitive' } },
    { userId: userId },
    { trashedAt: null },
  ];

  if (dateStart || dateEnd) {
    folderAndConditions.push({
      updatedAt: {
        ...(dateStart ? { gte: dateStart } : {}),
        ...(dateEnd ? { lte: dateEnd } : {}),
      },
    });
  }

  if (pinnedOnly) {
    folderAndConditions.push({ starred: true });
  }

  // Search folders
  await logger.debug('Drive search folders', {
    operation: 'search_drive_folders',
    filtersApplied: {
      dateStart,
      dateEnd,
      pinnedOnly,
    },
  });
  const folders = await prisma.folder.findMany({
    where: {
      AND: folderAndConditions,
    },
    take: 5,
  });

  await logger.debug('Drive search folders found', {
    operation: 'search_drive_folders_found',
    count: folders.length
  });

  for (const folder of folders) {
    const relevanceScore = calculateRelevanceScore(folder.name, query);
    results.push({
      id: folder.id,
      title: folder.name,
      description: 'Folder',
      moduleId: 'drive',
      moduleName: 'Drive',
      url: `/drive?folder=${folder.id}`,
      type: 'folder',
      metadata: {
        parentId: folder.parentId,
      },
      permissions: [{ type: 'read', granted: true }],
      lastModified: folder.updatedAt,
      relevanceScore,
    });
  }

  await logger.debug('Drive search total results', {
    operation: 'search_drive_total',
    count: results.length
  });
  return results;
}

// Search in Chat module
async function searchChat(query: string, userId: string, filters?: SearchFilters): Promise<SearchResult[]> {
  await logger.debug('Chat search starting', {
    operation: 'search_chat_start',
    query,
    userId
  });
  const results: SearchResult[] = [];

  // Search messages
  await logger.debug('Chat search messages', {
    operation: 'search_chat_messages'
  });
  const messages = await prisma.message.findMany({
    where: {
      content: { contains: query, mode: 'insensitive' },
      conversation: {
        participants: {
          some: {
            userId: userId,
            isActive: true,
          },
        },
      },
      deletedAt: null,
    },
    include: {
      sender: {
        select: { id: true, name: true, email: true },
      },
      conversation: {
        select: { id: true, name: true, type: true },
      },
    },
    take: 10,
  });

  await logger.debug('Chat search messages found', {
    operation: 'search_chat_messages_found',
    count: messages.length
  });

  for (const message of messages) {
    const relevanceScore = calculateRelevanceScore(message.content, query);
    results.push({
      id: message.id,
      title: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
      description: `Message from ${message.sender.name || message.sender.email} in ${message.conversation.name || 'conversation'}`,
      moduleId: 'chat',
      moduleName: 'Chat',
      url: `/chat?conversation=${message.conversation.id}&message=${message.id}`,
      type: 'message',
      metadata: {
        senderId: message.sender.id,
        conversationId: message.conversation.id,
        conversationType: message.conversation.type,
      },
      permissions: [{ type: 'read', granted: true }],
      lastModified: message.createdAt,
      relevanceScore,
    });
  }

  // Search conversations
  await logger.debug('Chat search conversations', {
    operation: 'search_chat_conversations'
  });
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { messages: { some: { content: { contains: query, mode: 'insensitive' } } } },
      ],
      participants: {
        some: {
          userId: userId,
          isActive: true,
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    take: 5,
  });

  await logger.debug('Chat search conversations found', {
    operation: 'search_chat_conversations_found',
    count: conversations.length
  });

  for (const conversation of conversations) {
    const relevanceScore = calculateRelevanceScore(conversation.name || '', query);
    results.push({
      id: conversation.id,
      title: conversation.name || `${conversation.type} conversation`,
      description: `${conversation.participants.length} participants`,
      moduleId: 'chat',
      moduleName: 'Chat',
      url: `/chat?conversation=${conversation.id}`,
      type: 'conversation',
      metadata: {
        type: conversation.type,
        participantCount: conversation.participants.length,
      },
      permissions: [{ type: 'read', granted: true }],
      lastModified: conversation.updatedAt,
      relevanceScore,
    });
  }

  await logger.debug('Chat search total results', {
    operation: 'search_chat_total',
    count: results.length
  });
  return results;
}

// Search in Dashboard module
async function searchDashboard(query: string, userId: string, filters?: SearchFilters): Promise<SearchResult[]> {
  await logger.debug('Dashboard search starting', {
    operation: 'search_dashboard_start',
    query,
    userId
  });
  const results: SearchResult[] = [];

  // Search dashboards
  await logger.debug('Dashboard search dashboards', {
    operation: 'search_dashboard_dashboards'
  });
  const dashboards = await prisma.dashboard.findMany({
    where: {
      AND: [
        { name: { contains: query, mode: 'insensitive' } },
        { userId: userId },
      ],
    },
    take: 5,
  });

  await logger.debug('Dashboard search dashboards found', {
    operation: 'search_dashboard_dashboards_found',
    count: dashboards.length
  });

  for (const dashboard of dashboards) {
    const relevanceScore = calculateRelevanceScore(dashboard.name, query);
    results.push({
      id: dashboard.id,
      title: dashboard.name,
      description: 'Dashboard',
      moduleId: 'dashboard',
      moduleName: 'Dashboard',
      url: `/dashboard/${dashboard.id}`,
      type: 'dashboard',
      metadata: {
        userId: dashboard.userId,
      },
      permissions: [{ type: 'read', granted: true }],
      lastModified: dashboard.updatedAt,
      relevanceScore,
    });
  }

  await logger.debug('Dashboard search total results', {
    operation: 'search_dashboard_total',
    count: results.length
  });
  return results;
}

// Calculate relevance score for search results
function calculateRelevanceScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 1.0;
  
  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 0.9;
  
  // Contains query gets medium score
  if (lowerText.includes(lowerQuery)) return 0.7;
  
  // Partial word match gets lower score
  const queryWords = lowerQuery.split(' ');
  const textWords = lowerText.split(' ');
  const matchingWords = queryWords.filter(word => 
    textWords.some(textWord => textWord.includes(word))
  );
  
  if (matchingWords.length > 0) {
    return 0.5 * (matchingWords.length / queryWords.length);
  }
  
  return 0.1;
} 