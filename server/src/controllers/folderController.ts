import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { canReadFolder, canWriteFolder } from './folderPermissionController';
import { AuthenticatedRequest } from '../middleware/auth';
import { getChatSocketService } from '../services/chatSocketService';
import { Prisma } from '@prisma/client';

// List folders with dashboard context support
export async function listFolders(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id || (req.user as any)?.id || (req.user as any)?.sub;
    
    // Validate userId exists
    if (!userId) {
      await logger.error('User ID not found in request', {
        operation: 'listFolders',
        user: (req as AuthenticatedRequest).user,
        reqUser: (req as any).user
      });
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const parentId = req.query.parentId as string;
    const starred = req.query.starred as string;
    const dashboardId = req.query.dashboardId as string; // NEW: Dashboard context filtering
    
    // Build where conditions for Prisma ORM query
    // Start with folders owned by the user (we'll add shared folders later if needed)
    const whereConditions: Prisma.FolderWhereInput = {
      userId,
      trashedAt: null,
    };

    // Dashboard context filtering
    if (starred === 'true') {
      whereConditions.starred = true;
      // Don't filter by dashboardId when fetching starred items - show across all dashboards
    } else {
      if (dashboardId) {
        whereConditions.dashboardId = dashboardId;
        await logger.debug('Dashboard context requested for folders', {
          operation: 'folder_list_dashboard_context',
          dashboardId
        });
      } else {
        // Only set to null if we're NOT fetching starred items
        whereConditions.dashboardId = null;
      }
    }

    // Parent folder filtering
    if (parentId) {
      whereConditions.parentId = parentId;
    } else {
      // Root level folders have parentId = null
      whereConditions.parentId = null;
    }

    if (starred === 'false') {
      whereConditions.starred = false;
    }

    // Fetch folders with Prisma ORM
    const folders = await prisma.folder.findMany({
      where: whereConditions,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Add hasChildren count for each folder
    const foldersWithChildren = await Promise.all(
      folders.map(async (folder) => {
        const childCount = await prisma.folder.count({
          where: {
            parentId: folder.id,
            userId: folder.userId,
            trashedAt: null,
          },
        });
        return {
          ...folder,
          hasChildren: childCount,
        };
      })
    );
    
    res.json(foldersWithChildren);
    } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Error in listFolders', {
      operation: 'listFolders',
      error: { message: error.message, stack: error.stack }
    });
    res.status(500).json({ message: 'Failed to fetch folders' });
  }
}

export async function createFolder(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id || (req.user as any).id || (req.user as any).sub;
    const { name, parentId, dashboardId } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    
    // If creating in a parent folder, check write permissions
    if (parentId) {
      const canWrite = await canWriteFolder(userId, parentId);
      if (!canWrite) {
        return res.status(403).json({ message: 'You do not have permission to create folders here' });
      }
    }
    
    const folder = await prisma.folder.create({
      data: { userId, name, parentId: parentId || null, dashboardId: dashboardId || null },
    });

    // Create activity record for folder creation
    // Note: Since Activity model requires a fileId, we'll create a placeholder activity
    // or we could modify the schema to make fileId optional for folder activities
    // For now, we'll skip folder activities until the schema is updated

    // Broadcast real-time drive event to owner
    try {
      const socketService = getChatSocketService();
      socketService.broadcastDriveEvent(userId, 'drive:item:created', {
        itemId: folder.id,
        itemType: 'folder',
        dashboardId: folder.dashboardId,
        folderId: folder.parentId,
      });
    } catch (socketError) {
      await logger.error('Failed to broadcast drive:item:created event', {
        operation: 'folder_create_socket_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
      // Do not fail the operation if socket broadcast fails
    }

    res.status(201).json({ folder });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Error in createFolder', {
      operation: 'createFolder',
      error: { message: error.message, stack: error.stack },
      context: { userId: (req as AuthenticatedRequest).user?.id || (req.user as { id?: string })?.id }
    });
    res.status(500).json({ message: 'Failed to create folder' });
  }
}

export async function updateFolder(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id || (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;
    const { name, parentId } = req.body;
    
    // Check write permissions
    const canWrite = await canWriteFolder(userId, id);
    if (!canWrite) {
      return res.status(403).json({ message: 'You do not have permission to modify this folder' });
    }
    
    // If moving to a parent folder, check write permissions on target
    if (parentId) {
      const canWriteParent = await canWriteFolder(userId, parentId);
      if (!canWriteParent) {
        return res.status(403).json({ message: 'You do not have permission to move folders here' });
      }
    }
    
    // Get folder before update to check if parent changed
    const folderBeforeUpdate = await prisma.folder.findUnique({ where: { id } });
    if (!folderBeforeUpdate) return res.status(404).json({ message: 'Folder not found' });
    
    const folder = await prisma.folder.updateMany({
      where: { id },
      data: { name, parentId },
    });
    if (folder.count === 0) return res.status(404).json({ message: 'Folder not found' });
    const updated = await prisma.folder.findUnique({ where: { id } });
    
    // Broadcast real-time drive event
    try {
      const socketService = getChatSocketService();
      // If parent changed, it's a move operation
      if (parentId !== undefined && parentId !== folderBeforeUpdate.parentId) {
        socketService.broadcastDriveEvent(userId, 'drive:item:moved', {
          itemId: updated!.id,
          itemType: 'folder',
          dashboardId: updated!.dashboardId,
          folderId: updated!.parentId,
          previousFolderId: folderBeforeUpdate.parentId,
        });
      } else {
        // Otherwise it's just an update (rename)
        socketService.broadcastDriveEvent(userId, 'drive:item:updated', {
          itemId: updated!.id,
          itemType: 'folder',
          dashboardId: updated!.dashboardId,
          folderId: updated!.parentId,
        });
      }
    } catch (socketError) {
      await logger.error('Failed to broadcast drive event', {
        operation: 'folder_update_socket_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
      // Do not fail the operation if socket broadcast fails
    }
    
    res.json({ folder: updated });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Error in updateFolder', {
      operation: 'updateFolder',
      error: { message: error.message, stack: error.stack }
    });
    res.status(500).json({ message: 'Failed to update folder' });
  }
}

export async function deleteFolder(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id || (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;
    
    // Check write permissions
    const canWrite = await canWriteFolder(userId, id);
    if (!canWrite) {
      return res.status(403).json({ message: 'You do not have permission to delete this folder' });
    }
    
    // Get folder before deleting to broadcast event
    const folderToDelete = await prisma.folder.findUnique({ where: { id } });
    if (!folderToDelete) return res.status(404).json({ message: 'Folder not found' });
    
    const folder = await prisma.folder.updateMany({
      where: { id, trashedAt: null },
      data: { trashedAt: new Date() },
    });
    if (folder.count === 0) return res.status(404).json({ message: 'Folder not found' });
    
    // Broadcast real-time drive event
    try {
      const socketService = getChatSocketService();
      socketService.broadcastDriveEvent(folderToDelete.userId, 'drive:item:deleted', {
        itemId: folderToDelete.id,
        itemType: 'folder',
        dashboardId: folderToDelete.dashboardId,
        folderId: folderToDelete.parentId,
      });
    } catch (socketError) {
      await logger.error('Failed to broadcast drive:item:deleted event', {
        operation: 'folder_delete_socket_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
      // Do not fail the operation if socket broadcast fails
    }
    
    res.json({ trashed: true });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Error in deleteFolder', {
      operation: 'deleteFolder',
      error: { message: error.message, stack: error.stack }
    });
    res.status(500).json({ message: 'Failed to move folder to trash' });
  }
}

// List trashed folders for the user
export async function listTrashedFolders(req: Request, res: Response) {
  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const folders = await prisma.folder.findMany({
      where: { userId, trashedAt: { not: null } },
      orderBy: { trashedAt: 'desc' },
    });
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list trashed folders' });
  }
}

// Restore a trashed folder
export async function restoreFolder(req: Request, res: Response) {
  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;
    const folder = await prisma.folder.updateMany({
      where: { id, userId, trashedAt: { not: null } },
      data: { trashedAt: null },
    });
    if (folder.count === 0) return res.status(404).json({ message: 'Folder not found or not trashed' });
    res.json({ restored: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to restore folder' });
  }
}

// Permanently delete a trashed folder
export async function hardDeleteFolder(req: Request, res: Response) {
  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;
    const folder = await prisma.folder.deleteMany({
      where: { id, userId, trashedAt: { not: null } },
    });
    if (folder.count === 0) return res.status(404).json({ message: 'Folder not found or not trashed' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to permanently delete folder' });
  }
} 

// Get recent activity for the user
export async function getRecentActivity(req: Request, res: Response) {
  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 20,
      include: {
        file: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get recent activity' });
  }
} 

// Toggle the starred status of a folder
export async function toggleFolderStarred(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    const updatedFolder = await prisma.folder.update({
      where: { id },
      data: { starred: !folder.starred },
    });
    
    // Broadcast real-time drive event
    try {
      const socketService = getChatSocketService();
      socketService.broadcastDriveEvent(folder.userId, 'drive:item:pinned', {
        itemId: updatedFolder.id,
        itemType: 'folder',
        dashboardId: updatedFolder.dashboardId,
        folderId: updatedFolder.parentId,
        starred: updatedFolder.starred,
      });
    } catch (socketError) {
      await logger.error('Failed to broadcast drive:item:pinned event', {
        operation: 'folder_pin_socket_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
      // Do not fail the operation if socket broadcast fails
    }
    
    res.json(updatedFolder);
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle star on folder' });
  }
}

// Reorder folders within a parent folder
export async function reorderFolders(req: Request, res: Response) {
  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const { parentId } = req.params;
    const { folderIds } = req.body; // Array of folder IDs in new order

    if (!Array.isArray(folderIds)) {
      return res.status(400).json({ message: 'folderIds must be an array' });
    }

    // Verify all folders belong to the user and are in the specified parent
    const folders = await prisma.folder.findMany({
      where: {
        id: { in: folderIds },
        userId: userId,
        parentId: parentId || null
      }
    });

    if (folders.length !== folderIds.length) {
      return res.status(400).json({ message: 'Some folders not found or access denied' });
    }

    // Update the order of each folder using raw SQL to avoid Prisma client issues
    for (let i = 0; i < folderIds.length; i++) {
      await prisma.$executeRawUnsafe(`UPDATE "Folder" SET "order" = $1 WHERE id = $2`, i, folderIds[i]);
    }

    res.json({ success: true, message: 'Folders reordered successfully' });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Error in reorderFolders', {
      operation: 'reorderFolders',
      error: { message: error.message, stack: error.stack }
    });
    res.status(500).json({ message: 'Failed to reorder folders' });
  }
}

// Move a folder to a different parent folder
export async function moveFolder(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id || (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;
    const { targetParentId } = req.body;

    // Check write permissions on the folder being moved
    const canWrite = await canWriteFolder(userId, id);
    if (!canWrite) {
      return res.status(403).json({ message: 'You do not have permission to move this folder' });
    }

    // Verify the folder exists
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Verify the target parent folder exists and user has write permissions (if specified)
    if (targetParentId) {
      const canWriteParent = await canWriteFolder(userId, targetParentId);
      if (!canWriteParent) {
        return res.status(403).json({ message: 'You do not have permission to move folders here' });
      }
      
      // Prevent moving a folder into itself or its descendants
      if (targetParentId === id) {
        return res.status(400).json({ message: 'Cannot move folder into itself' });
      }
      
      // Check if target is a descendant of the folder being moved
      let currentParent: any = await prisma.folder.findUnique({ where: { id: targetParentId } });
      while (currentParent && currentParent.parentId) {
        if (currentParent.parentId === id) {
          return res.status(400).json({ message: 'Cannot move folder into its descendant' });
        }
        currentParent = await prisma.folder.findUnique({ where: { id: currentParent.parentId } });
        if (!currentParent) break;
      }
    }

    // Get the original parent details for activity tracking and broadcasting
    const originalParentId = folder.parentId;

    // Move the folder
    const updatedFolder = await prisma.folder.update({
      where: { id },
      data: { parentId: targetParentId || null },
    });

    // Broadcast real-time drive event
    try {
      const socketService = getChatSocketService();
      socketService.broadcastDriveEvent(folder.userId, 'drive:item:moved', {
        itemId: updatedFolder.id,
        itemType: 'folder',
        dashboardId: updatedFolder.dashboardId,
        folderId: updatedFolder.parentId,
        previousFolderId: originalParentId,
      });
    } catch (socketError) {
      await logger.error('Failed to broadcast drive:item:moved event', {
        operation: 'folder_move_socket_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
      // Do not fail the operation if socket broadcast fails
    }

    // Note: We could create activity records for folders if we extend the Activity model
    // For now, we'll skip folder activity tracking

    res.json({ folder: updatedFolder, message: 'Folder moved successfully' });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Error in moveFolder', {
      operation: 'moveFolder',
      error: { message: error.message, stack: error.stack }
    });
    res.status(500).json({ message: 'Failed to move folder' });
  }
} 