/**
 * Drive AI Context Provider Controller
 * 
 * Provides context data about a user's Drive usage to the AI system.
 * These endpoints are called by the CrossModuleContextEngine when processing AI queries.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { Prisma } from '@prisma/client';

// Type definitions for AI context responses
interface RecentFileData {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  starred: boolean;
  folderId: string | null;
  folder: {
    id: string;
    name: string;
  } | null;
}

interface FileCountWhere {
  userId: string;
  trashedAt: null;
  folderId?: string;
  updatedAt?: {
    gte: Date;
  };
}

/**
 * GET /api/drive/ai/context/recent
 * 
 * Returns recent files for AI context
 * Used by AI to understand what files the user has been working with
 */
export async function getRecentFilesContext(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    // Get user's most recent files (last 10)
    const recentFiles = await prisma.file.findMany({
      where: {
        userId,
        trashedAt: null
      },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        createdAt: true,
        updatedAt: true,
        starred: true,
        folderId: true,
        folder: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 10
    });
    
    // Format for AI consumption
    const context = {
      recentFiles: recentFiles.map((file: RecentFileData) => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: formatFileSize(file.size),
        lastModified: file.updatedAt.toISOString(),
        folder: file.folder?.name || 'Root',
        starred: file.starred
      })),
      summary: {
        totalRecentFiles: recentFiles.length,
        hasStarredFiles: recentFiles.some((f: RecentFileData) => f.starred),
        mostRecentUpdate: recentFiles[0]?.updatedAt.toISOString()
      }
    };
    
    res.json({
      success: true,
      context,
      metadata: {
        provider: 'drive',
        endpoint: 'recentFiles',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error in getRecentFilesContext', {
      operation: 'getRecentFilesContext',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent files context',
      error: err.message || 'Unknown error'
    });
  }
}

/**
 * GET /api/drive/ai/context/storage
 * 
 * Returns storage statistics for AI context
 * Used by AI to answer questions about storage usage
 */
export async function getStorageStatsContext(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    // Get file counts by type and calculate storage
    const [
      totalFiles,
      documentFiles,
      imageFiles,
      videoFiles,
      files
    ] = await Promise.all([
      prisma.file.count({
        where: { userId, trashedAt: null }
      }),
      prisma.file.count({
        where: { 
          userId, 
          trashedAt: null,
          type: {
            in: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain']
          }
        }
      }),
      prisma.file.count({
        where: { 
          userId, 
          trashedAt: null,
          type: {
            startsWith: 'image/'
          }
        }
      }),
      prisma.file.count({
        where: { 
          userId, 
          trashedAt: null,
          type: {
            startsWith: 'video/'
          }
        }
      }),
      prisma.file.findMany({
        where: { userId, trashedAt: null },
        select: { size: true }
      })
    ]);
    
    // Calculate storage usage from actual files
    const storageUsed = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const storageLimit = 10737418240; // 10GB default
    const percentageUsed = (storageUsed / storageLimit) * 100;
    
    // Format for AI consumption
    const context = {
      storage: {
        used: formatFileSize(storageUsed),
        usedBytes: storageUsed,
        limit: formatFileSize(storageLimit),
        limitBytes: storageLimit,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        available: formatFileSize(storageLimit - storageUsed)
      },
      files: {
        total: totalFiles,
        byType: {
          documents: documentFiles,
          images: imageFiles,
          videos: videoFiles,
          other: totalFiles - documentFiles - imageFiles - videoFiles
        }
      },
      status: percentageUsed >= 90 ? 'critical' : percentageUsed >= 75 ? 'warning' : 'normal'
    };
    
    res.json({
      success: true,
      context,
      metadata: {
        provider: 'drive',
        endpoint: 'storageStats',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error in getStorageStatsContext', {
      operation: 'getStorageStatsContext',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch storage stats context',
      error: err.message || 'Unknown error'
    });
  }
}

/**
 * GET /api/drive/ai/query/count
 * 
 * Queryable endpoint for file counts
 * Supports dynamic queries from the AI system
 */
export async function getFileCount(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { type = 'all', folderId } = req.query;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const where: FileCountWhere = {
      userId,
      trashedAt: null
    };
    
    // Apply type filter
    if (type === 'folder' && folderId && typeof folderId === 'string') {
      where.folderId = folderId;
    } else if (type === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      where.updatedAt = {
        gte: sevenDaysAgo
      };
    }
    
    const count = await prisma.file.count({ 
      where: where as Prisma.FileWhereInput 
    });
    
    res.json({
      success: true,
      count,
      parameters: {
        type,
        folderId: folderId || null
      },
      metadata: {
        provider: 'drive',
        endpoint: 'fileCount',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error in getFileCount', {
      operation: 'getFileCount',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get file count',
      error: err.message || 'Unknown error'
    });
  }
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

