import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';
import { logger } from '../lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasUserId(user: any): user is { id: string } {
  return user && typeof user.id === 'string';
}

// List all permissions for a folder
export async function listFolderPermissions(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params; // folder id
    // Only owner can list permissions
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const permissions = await prisma.folderPermission.findMany({ 
      where: { folderId: id }, 
      include: { user: true } 
    });
    res.json({ permissions });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Failed to list folder permissions', {
      operation: 'folder_list_permissions',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ message: 'Failed to list permissions' });
  }
}

// Grant or update a user's permission for a folder
export async function grantFolderPermission(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const ownerId = (req as AuthenticatedRequest).user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params; // folder id
    const { userId, canRead, canWrite } = req.body;
    
    // Only owner can grant permissions
    const folder = await prisma.folder.findUnique({ 
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!folder || folder.userId !== ownerId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const permission = await prisma.folderPermission.upsert({
      where: { folderId_userId: { folderId: id, userId } },
      update: { canRead, canWrite },
      create: { folderId: id, userId, canRead, canWrite },
    });

    // Create notification for the user who was granted permission
    try {
      const permissionType = canRead && canWrite ? 'read and write' : canRead ? 'read' : 'write';
      
      await NotificationService.handleNotification({
        type: 'drive_permission',
        title: `${folder.user?.name || 'Someone'} shared a folder with you`,
        body: `You now have ${permissionType} access to "${folder.name}"`,
        data: {
          folderId: id,
          folderName: folder.name,
          permissionType,
          ownerId: folder.userId,
          ownerName: folder.user?.name
        },
        recipients: [userId],
        senderId: ownerId
      });
    } catch (notificationError) {
      await logger.error('Failed to create folder permission notification', {
        operation: 'folder_permission_notification',
        error: {
          message: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          stack: notificationError instanceof Error ? notificationError.stack : undefined
        }
      });
      // Don't fail the permission grant if notification fails
    }

    res.status(201).json({ permission });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Failed to grant folder permission', {
      operation: 'folder_grant_permission',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ message: 'Failed to grant permission' });
  }
}

// Update a user's permission for a folder
export async function updateFolderPermission(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const ownerId = (req as AuthenticatedRequest).user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id, userId } = req.params; // folder id, user id
    const { canRead, canWrite } = req.body;
    // Only owner can update permissions
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== ownerId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const permission = await prisma.folderPermission.updateMany({
      where: { folderId: id, userId },
      data: { canRead, canWrite },
    });
    if (permission.count === 0) {
      return res.status(404).json({ message: 'Permission not found' });
    }
    res.json({ updated: permission.count });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Failed to update folder permission', {
      operation: 'folder_update_permission',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ message: 'Failed to update permission' });
  }
}

// Revoke a user's permission for a folder
export async function revokeFolderPermission(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const ownerId = (req as AuthenticatedRequest).user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id, userId } = req.params; // folder id, user id
    
    // Only owner can revoke permissions
    const folder = await prisma.folder.findUnique({ 
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!folder || folder.userId !== ownerId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    await prisma.folderPermission.deleteMany({ where: { folderId: id, userId } });
    
    // Create notification for the user whose permission was revoked
    try {
      await NotificationService.handleNotification({
        type: 'drive_permission',
        title: `Folder access revoked`,
        body: `Your access to "${folder.name}" has been removed`,
        data: {
          folderId: id,
          folderName: folder.name,
          action: 'revoked',
          ownerId: folder.userId,
          ownerName: folder.user?.name
        },
        recipients: [userId],
        senderId: ownerId
      });
    } catch (notificationError) {
      await logger.error('Failed to create folder permission revocation notification', {
        operation: 'folder_permission_revocation_notification',
        error: {
          message: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          stack: notificationError instanceof Error ? notificationError.stack : undefined
        }
      });
      // Don't fail the permission revocation if notification fails
    }
    
    res.json({ revoked: true });
  } catch (err: unknown) {
    const error = err as Error;
    await logger.error('Failed to revoke folder permission', {
      operation: 'folder_revoke_permission',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ message: 'Failed to revoke permission' });
  }
}

// Helper: check if user can read a folder
export async function canReadFolder(userId: string, folderId: string): Promise<boolean> {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return false;
  if (folder.userId === userId) return true;
  const perm = await prisma.folderPermission.findFirst({ 
    where: { folderId, userId, canRead: true } 
  });
  return !!perm;
}

// Helper: check if user can write a folder
export async function canWriteFolder(userId: string, folderId: string): Promise<boolean> {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return false;
  if (folder.userId === userId) return true;
  const perm = await prisma.folderPermission.findFirst({ 
    where: { folderId, userId, canWrite: true } 
  });
  return !!perm;
}

