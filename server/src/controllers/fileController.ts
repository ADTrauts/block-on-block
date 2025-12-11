import { Request, Response, RequestHandler } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { getOrCreateChatFilesFolder } from '../services/driveService';
import { NotificationService } from '../services/notificationService';
import { storageService } from '../services/storageService';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

interface JWTPayload {
  sub?: string;
  id?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

// Configure multer based on storage provider
const upload = multer({
  storage: storageService.getProvider() === 'gcs' ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads');
      
      // Ensure directory exists
      const fs = require('fs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Accept all files for now, add type checks as needed
    cb(null, true);
  },
});

export const multerUpload = upload.single('file') as RequestHandler;

// Add error handling wrapper for multer
export const multerUploadWithErrorHandling = (req: Request, res: Response, next: Function) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  multerUpload(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: 'File upload error: ' + err.message });
    }
    next();
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasUserId(user: any): user is { id: string } {
  return user && typeof user.id === 'string';
}

// List files with dashboard context support
export async function listFiles(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const folderId = req.query.folderId as string;
    const starred = req.query.starred as string;
    const dashboardId = req.query.dashboardId as string; // NEW: Dashboard context filtering
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId };
    
    if (folderId) {
      where.folderId = folderId;
    } else {
      where.folderId = null;
    }
    
    // Add starred filtering
    if (starred === 'true') {
      where.starred = true;
    } else if (starred === 'false') {
      where.starred = false;
    }
    
    // Use raw SQL to include order field in sorting
    let query = `SELECT * FROM "files" WHERE "userId" = $1`;
    const params = [userId];
    let paramIndex = 2;
    
    // Dashboard context filtering
    // When fetching starred items, show across all dashboards (don't filter by dashboardId)
    if (starred === 'true') {
      // Show starred items from all dashboards
      await logger.debug('Starred items requested - showing across all dashboards', {
        operation: 'file_list_starred_all_dashboards'
      });
    } else if (dashboardId) {
      query += ` AND "dashboardId" = $${paramIndex}`;
      params.push(dashboardId);
      paramIndex++;
      await logger.debug('Dashboard context requested', {
        operation: 'file_list_dashboard_context',
        dashboardId
      });
    } else {
      query += ` AND "dashboardId" IS NULL`;
    }
    
    if (folderId) {
      query += ` AND "folderId" = $${paramIndex}`;
      params.push(folderId);
      paramIndex++;
    } else {
      query += ` AND "folderId" IS NULL`;
    }
    
    if (starred === 'true') {
      query += ` AND "starred" = true`;
    } else if (starred === 'false') {
      query += ` AND "starred" = false`;
    }
    
    // Exclude trashed files
    query += ` AND "trashedAt" IS NULL`;
    
    query += ` ORDER BY "order" ASC, "createdAt" DESC`;
    
    const files = await prisma.$queryRawUnsafe(query, ...params) as Array<any>;
    
    // Add full URLs to all files
    const filesWithFullUrls = files.map((file: Record<string, any>) => ({
      ...file,
      url: `${process.env.BACKEND_URL || 'https://vssyl-server-235369681725.us-central1.run.app'}${file.url}`
    }));
    
    // Return array directly to match folders API format
    res.json(filesWithFullUrls);
  } catch (err) {
    await logger.error('Failed to list files', {
      operation: 'file_list_files',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to fetch files' });
  }
}

export async function uploadFile(req: RequestWithFile, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  
  try {
    await logger.info('File upload request received', {
      operation: 'file_upload_request',
      context: {
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
        storageProvider: storageService.getProvider(),
        isGCSConfigured: storageService.isGCSConfigured(),
        userId: (req as AuthenticatedRequest).user?.id || '',
        environment: process.env.NODE_ENV,
        storageProviderEnv: process.env.STORAGE_PROVIDER,
        fileStorageTypeEnv: process.env.FILE_STORAGE_TYPE
      }
    });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!req.file.originalname || req.file.originalname.trim() === '') {
      return res.status(400).json({ message: 'File name is required' });
    }
    
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    let { folderId, chat, dashboardId } = req.body;
    
    // If this is a chat upload, always use the Chat Files folder
    if (chat) {
      const chatFolder = await getOrCreateChatFilesFolder(userId);
      folderId = chatFolder.id;
    }
    
    const { originalname, mimetype, size } = req.file;
    
    // Generate unique file path
    const fileExtension = path.extname(originalname);
    const uniqueFilename = `files/${userId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
    
    // Upload file using storage service
    await logger.info('Uploading file to storage', {
      operation: 'file_upload_to_storage',
      context: {
        filename: uniqueFilename,
        provider: storageService.getProvider(),
        isGCS: storageService.isGCSConfigured()
      }
    });
    
    const uploadResult = await storageService.uploadFile(req.file, uniqueFilename, {
      makePublic: true,
      metadata: {
        userId,
        originalName: originalname,
        folderId: folderId || '',
        dashboardId: dashboardId || '',
      },
    });
    
    await logger.info('File uploaded successfully', {
      operation: 'file_upload_success',
      context: {
        url: uploadResult.url,
        path: uploadResult.path
      }
    });
    
    // Create file record in database
    const fileRecord = await prisma.file.create({
      data: {
        userId,
        name: originalname,
        type: mimetype,
        size,
        url: uploadResult.url,
        path: uploadResult.path,
        folderId: folderId || null,
        dashboardId: dashboardId || null,
      },
    });

    // Create activity record for file upload
    await prisma.activity.create({
      data: {
        type: 'create',
        userId,
        fileId: fileRecord.id,
        details: {
          action: 'file_uploaded',
          fileName: originalname,
          fileSize: size,
          fileType: mimetype,
        },
      },
    });

    res.status(201).json({ file: fileRecord });
  } catch (err) {
    await logger.error('Failed to upload file', {
      operation: 'file_upload',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      },
      context: {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        storageProvider: storageService.getProvider()
      }
    });
    res.status(500).json({ 
      message: 'Failed to upload file',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}


export async function getItemActivity(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    return res.sendStatus(401);
  }
  try {
    const { itemId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.id;

    // Check if the item is a folder the user owns
    const folder = await prisma.folder.findFirst({
      where: { id: itemId, userId: userId },
    });

    // If it's a folder, it has no activities per the schema
    if (folder) {
      return res.json({ activities: [] });
    }

    // Check if the item is a file the user owns or has permission to see
    const file = await prisma.file.findFirst({
      where: {
        id: itemId,
        OR: [
          { userId: userId }, // User is the owner
          { permissions: { some: { userId: userId } } }, // User has explicit permission
        ],
      },
    });

    if (!file) {
      return res.status(404).json({ message: 'Item not found or access denied' });
    }

    // If it's a file, fetch its activities
    const activities = await prisma.activity.findMany({
      where: { fileId: itemId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    res.json({ activities });
  } catch (err) {
    await logger.error('Failed to get item activity', {
      operation: 'file_get_item_activity',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to get item activity' });
  }
}

export async function downloadFile(req: Request, res: Response) {
  // Log download request for debugging
  await logger.debug('Download file request received', {
    operation: 'file_download_request',
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    hasUser: !!req.user
  });

  // Check for token in query params (for file preview)
  let userId: string;
  if (req.query.token) {
    try {
      const decoded = jwt.verify(req.query.token as string, process.env.JWT_SECRET || '');
      const payload = decoded as JWTPayload;
      userId = payload.sub || payload.id || '';
    } catch (error) {
      return res.sendStatus(401);
    }
  } else if (hasUserId(req.user)) {
    userId = req.user.id;
  } else {
    await logger.warn('Download file request without authentication', {
      operation: 'file_download_unauthorized',
      path: req.path,
      params: req.params
    });
    return res.sendStatus(401);
  }
  
  if (!userId) {
    return res.sendStatus(401);
  }
  
  try {
    const { id } = req.params;
    if (!(await canReadFile(userId, id))) return res.status(403).json({ message: 'Forbidden' });
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ message: 'File not found' });
    
    // Log file details for debugging
    await logger.info('File download request', {
      operation: 'file_download_start',
      fileId: id,
      fileName: file.name,
      fileUrl: file.url,
      filePath: file.path,
      storageProvider: storageService.getProvider()
    });
    
    // If file has a direct URL that's accessible, use it first (simplest approach)
    if (file.url && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
      // Check if it's a GCS URL or any external URL
      const isExternalUrl = file.url.includes('storage.googleapis.com') ||
                           file.url.includes('googleapis.com') ||
                           file.url.includes('storage.cloud.google.com') ||
                           file.url.includes('vssyl-storage') ||
                           !file.url.includes('localhost');
      
      if (isExternalUrl) {
        await logger.info('Using file URL directly for download', {
          operation: 'file_download_direct_url',
          fileId: id,
          fileUrl: file.url
        });
        res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
        return res.redirect(file.url);
      }
    }
    
    // Determine file location from URL/path, not just current storage provider setting
    // Check if file URL indicates it's in GCS
    const isGCSFile = file.url && (
      file.url.includes('storage.googleapis.com') ||
      file.url.includes('googleapis.com') ||
      file.url.includes('storage.cloud.google.com') ||
      (file.path && !file.path.startsWith('/') && !file.path.includes('uploads'))
    );
    
    // Create activity record for file download
    await prisma.activity.create({
      data: {
        type: 'download',
        userId,
        fileId: id,
        details: {
          action: 'file_downloaded',
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
      },
    });
    
    if (isGCSFile || storageService.getProvider() === 'gcs') {
      // For Google Cloud Storage, use the public URL from storageService
      // The file.path should contain the GCS path (e.g., "files/userId-timestamp.pdf")
      // If file.path is not available, try to extract it from file.url
      let gcsPath = file.path;
      
      if (!gcsPath && file.url) {
        // Extract GCS path from URL
        // Handle URLs like: https://storage.googleapis.com/bucket-name/path/to/file
        // or: https://bucket-name.storage.googleapis.com/path/to/file
        const urlMatch = file.url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)$/) ||
                        file.url.match(/\.storage\.googleapis\.com\/(.+)$/) ||
                        file.url.match(/storage\.cloud\.google\.com\/[^\/]+\/(.+)$/);
        if (urlMatch) {
          gcsPath = urlMatch[1];
        } else {
          // Try to extract from any URL format
          gcsPath = file.url.split('/').slice(-2).join('/'); // Get last two segments
        }
      }
      
      if (gcsPath) {
        const publicUrl = storageService.getPublicUrl(gcsPath);
        
        await logger.info('Redirecting to GCS public URL for download', {
          operation: 'file_download_gcs',
          fileId: id,
          gcsPath,
          publicUrl,
          originalUrl: file.url
        });
        
        // Set Content-Disposition header for download
        res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
        return res.redirect(publicUrl);
      } else {
        // If we can't determine GCS path, try using the URL directly if it's a GCS URL
        if (file.url && isGCSFile) {
          await logger.info('Using file URL directly for GCS download', {
            operation: 'file_download_gcs_direct',
            fileId: id,
            fileUrl: file.url
          });
          res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
          return res.redirect(file.url);
        }
      }
    }
    
    // Local storage - serve file directly
    // Use file.path if available (actual file path), otherwise extract from file.url
    let filePath: string;
    
    if (file.path) {
      // file.path should be the actual file path (e.g., "files/userId-timestamp.pdf")
      const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads');
      filePath = path.join(uploadDir, file.path);
    } else if (file.url) {
      // Extract path from URL if file.path is not available
      // Handle both full URLs (http://localhost:5000/uploads/files/...) and relative paths (/uploads/files/...)
      const urlPath = file.url.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/uploads\//, 'uploads/');
      const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads');
      filePath = path.join(uploadDir, urlPath.replace(/^uploads\//, ''));
    } else {
      await logger.error('File has neither path nor url', {
        operation: 'file_download_missing_path',
        fileId: id,
        fileName: file.name
      });
      return res.status(500).json({ message: 'File path not found' });
    }
    
    await logger.info('Serving local file for download', {
      operation: 'file_download_local',
      fileId: id,
      filePath,
      fileName: file.name,
      fileUrl: file.url,
      filePathFromDb: file.path
    });
    
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        await logger.error('Local file not found', {
          operation: 'file_download_file_not_found',
          fileId: id,
          filePath,
          fileName: file.name,
          fileUrl: file.url,
          filePathFromDb: file.path,
          isGCSFile,
          storageProvider: storageService.getProvider(),
          uploadDir: process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads')
        });
        
        // If file doesn't exist locally but has a URL, try using the URL directly
        if (file.url && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
          await logger.info('File not found locally, trying file URL directly', {
            operation: 'file_download_fallback_url',
            fileId: id,
            fileUrl: file.url
          });
          res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
          return res.redirect(file.url);
        }
        
        return res.status(404).json({ 
          message: 'File not found on disk',
          details: {
            filePath,
            fileUrl: file.url,
            filePathFromDb: file.path
          }
        });
      }
    
    return res.download(filePath, file.name);
  } catch (err) {
    await logger.error('Failed to download file', {
      operation: 'file_download',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to download file' });
  }
}

export async function updateFile(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, folderId } = req.body;
    if (!(await canWriteFile(userId, id))) return res.status(403).json({ message: 'Forbidden' });
    
    // Get the original file to compare changes
    const originalFile = await prisma.file.findUnique({ where: { id } });
    if (!originalFile) return res.status(404).json({ message: 'File not found' });
    
    const file = await prisma.file.updateMany({
      where: { id, userId },
      data: { name, folderId },
    });
    if (file.count === 0) return res.status(404).json({ message: 'File not found' });
    const updated = await prisma.file.findUnique({ where: { id } });

    // Create activity record for file update
    await prisma.activity.create({
      data: {
        type: 'edit',
        userId,
        fileId: id,
        details: {
          action: 'file_updated',
          originalName: originalFile.name,
          newName: name || originalFile.name,
          originalFolderId: originalFile.folderId,
          newFolderId: folderId,
        },
      },
    });

    res.json({ file: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update file' });
  }
}

export async function deleteFile(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!(await canWriteFile(userId, id))) return res.status(403).json({ message: 'Forbidden' });
    
    // Get the file details before deletion for activity tracking
    const fileToDelete = await prisma.file.findUnique({ where: { id } });
    if (!fileToDelete) return res.status(404).json({ message: 'File not found' });
    
    const file = await prisma.file.updateMany({
      where: { id, userId, trashedAt: null },
      data: { trashedAt: new Date() },
    });
    if (file.count === 0) return res.status(404).json({ message: 'File not found' });

    // Create activity record for file deletion (moved to trash)
    await prisma.activity.create({
      data: {
        type: 'delete',
        userId,
        fileId: id,
        details: {
          action: 'file_moved_to_trash',
          fileName: fileToDelete.name,
          fileType: fileToDelete.type,
          fileSize: fileToDelete.size,
        },
      },
    });

    res.json({ trashed: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to move file to trash' });
  }
}

// List all permissions for a file
export async function listFilePermissions(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params; // file id
    // Only owner can list permissions
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file || file.userId !== userId) return res.status(403).json({ message: 'Forbidden' });
    const permissions = await prisma.filePermission.findMany({ where: { fileId: id }, include: { user: true } });
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list permissions' });
  }
}

// Grant or update a user's permission for a file
export async function grantFilePermission(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const ownerId = (req as AuthenticatedRequest).user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params; // file id
    const { userId, canRead, canWrite } = req.body;
    
    // Only owner can grant permissions
    const file = await prisma.file.findUnique({ 
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
    
    if (!file || file.userId !== ownerId) return res.status(403).json({ message: 'Forbidden' });
    
    const permission = await prisma.filePermission.upsert({
      where: { fileId_userId: { fileId: id, userId } },
      update: { canRead, canWrite },
      create: { fileId: id, userId, canRead, canWrite },
    });

    // Create notification for the user who was granted permission
    try {
      const permissionType = canRead && canWrite ? 'read and write' : canRead ? 'read' : 'write';
      
      await NotificationService.handleNotification({
        type: 'drive_permission',
        title: `${file.user?.name || 'Someone'} shared a file with you`,
        body: `You now have ${permissionType} access to "${file.name}"`,
        data: {
          fileId: id,
          fileName: file.name,
          permissionType,
          ownerId: file.userId,
          ownerName: file.user?.name
        },
        recipients: [userId],
        senderId: ownerId
      });
    } catch (notificationError) {
      await logger.error('Failed to create file permission notification', {
        operation: 'file_permission_notification',
        error: {
          message: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          stack: notificationError instanceof Error ? notificationError.stack : undefined
        }
      });
      // Don't fail the permission grant if notification fails
    }

    res.status(201).json({ permission });
  } catch (err) {
    res.status(500).json({ message: 'Failed to grant permission' });
  }
}

// Update a user's permission for a file
export async function updateFilePermission(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const ownerId = (req as AuthenticatedRequest).user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id, userId } = req.params; // file id, user id
    const { canRead, canWrite } = req.body;
    // Only owner can update permissions
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file || file.userId !== ownerId) return res.status(403).json({ message: 'Forbidden' });
    const permission = await prisma.filePermission.updateMany({
      where: { fileId: id, userId },
      data: { canRead, canWrite },
    });
    if (permission.count === 0) return res.status(404).json({ message: 'Permission not found' });
    res.json({ updated: permission.count });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update permission' });
  }
}

// Revoke a user's permission for a file
export async function revokeFilePermission(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const ownerId = (req as AuthenticatedRequest).user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id, userId } = req.params; // file id, user id
    
    // Only owner can revoke permissions
    const file = await prisma.file.findUnique({ 
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
    
    if (!file || file.userId !== ownerId) return res.status(403).json({ message: 'Forbidden' });
    
    await prisma.filePermission.deleteMany({ where: { fileId: id, userId } });
    
    // Create notification for the user whose permission was revoked
    try {
      await NotificationService.handleNotification({
        type: 'drive_permission',
        title: `File access revoked`,
        body: `Your access to "${file.name}" has been removed`,
        data: {
          fileId: id,
          fileName: file.name,
          action: 'revoked',
          ownerId: file.userId,
          ownerName: file.user?.name
        },
        recipients: [userId],
        senderId: ownerId
      });
    } catch (notificationError) {
      await logger.error('Failed to create file permission revocation notification', {
        operation: 'file_permission_revocation_notification',
        error: {
          message: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          stack: notificationError instanceof Error ? notificationError.stack : undefined
        }
      });
      // Don't fail the permission revocation if notification fails
    }
    
    res.json({ revoked: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to revoke permission' });
  }
}

// Helper: check if user can read a file
async function canReadFile(userId: string, fileId: string): Promise<boolean> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return false;
  if (file.userId === userId) return true;
  const perm = await prisma.filePermission.findFirst({ where: { fileId, userId, canRead: true } });
  return !!perm;
}

// Helper: check if user can write a file
async function canWriteFile(userId: string, fileId: string): Promise<boolean> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return false;
  if (file.userId === userId) return true;
  const perm = await prisma.filePermission.findFirst({ where: { fileId, userId, canWrite: true } });
  return !!perm;
}

// List trashed files for the user
export async function listTrashedFiles(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const files = await prisma.file.findMany({
      where: { userId, trashedAt: { not: null } },
      orderBy: { trashedAt: 'desc' },
    });
    res.json({ files });
  } catch (err) {
    await logger.error('Failed to list trashed files', {
      operation: 'file_list_trashed',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to list trashed files' });
  }
}

// Restore a trashed file
export async function restoreFile(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params;
    const file = await prisma.file.updateMany({
      where: { id, userId, trashedAt: { not: null } },
      data: { trashedAt: null },
    });
    if (file.count === 0) return res.status(404).json({ message: 'File not found or not trashed' });
    res.json({ restored: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to restore file' });
  }
}

// Permanently delete a trashed file
export async function hardDeleteFile(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params;
    
    // Get file details before deletion
    const fileToDelete = await prisma.file.findFirst({
      where: { id, userId, trashedAt: { not: null } },
    });
    
    if (!fileToDelete) {
      return res.status(404).json({ message: 'File not found or not trashed' });
    }
    
    // Delete file from storage if path exists
    if (fileToDelete.path) {
      const deleteResult = await storageService.deleteFile(fileToDelete.path);
      if (!deleteResult.success) {
        await logger.warn('Failed to delete file from storage', {
          operation: 'file_storage_delete',
          error: {
            message: deleteResult.error || 'Unknown error'
          }
        });
        // Continue with database deletion even if storage deletion fails
      }
    }
    
    // Delete from database
    const file = await prisma.file.deleteMany({
      where: { id, userId, trashedAt: { not: null } },
    });
    
    if (file.count === 0) {
      return res.status(404).json({ message: 'File not found or not trashed' });
    }
    
    res.json({ deleted: true });
  } catch (err) {
    await logger.error('Failed to hard delete file', {
      operation: 'file_hard_delete',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to permanently delete file' });
  }
} 

// Toggle the starred status of a file
export async function toggleFileStarred(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    const updatedFile = await prisma.file.update({
      where: { id },
      data: { starred: !file.starred },
    });
    res.json(updatedFile);
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle star on file' });
  }
}

// Get shared items for the current user
export async function getSharedItems(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;

    // Get files that have been shared with this user
    const sharedFiles = await prisma.file.findMany({
      where: {
        permissions: {
          some: {
            userId: userId,
            canRead: true
          }
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        permissions: {
          where: { userId: userId },
          select: { canRead: true, canWrite: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get folders that have been shared with this user
    const sharedFolders = await prisma.folder.findMany({
      where: {
        permissions: {
          some: {
            userId: userId,
            canRead: true
          }
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        permissions: {
          where: { userId: userId },
          select: { canRead: true, canWrite: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform the data to include permission information
    const transformedFiles = sharedFiles.map(file => ({
      ...file,
      permission: file.permissions[0]?.canWrite ? 'edit' : 'view'
    }));

    const transformedFolders = sharedFolders.map(folder => ({
      ...folder,
      permission: folder.permissions[0]?.canWrite ? 'edit' : 'view'
    }));

    res.json({
      files: transformedFiles,
      folders: transformedFolders
    });
  } catch (err) {
    await logger.error('Failed to get shared items', {
      operation: 'file_get_shared_items',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to fetch shared items' });
  }
}

// Reorder files within a folder
export async function reorderFiles(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { folderId } = req.params;
    const { fileIds } = req.body; // Array of file IDs in new order

    if (!Array.isArray(fileIds)) {
      return res.status(400).json({ message: 'fileIds must be an array' });
    }

    // Verify all files belong to the user and are in the specified folder
    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
        userId: userId,
        folderId: folderId || null
      }
    });

    if (files.length !== fileIds.length) {
      return res.status(400).json({ message: 'Some files not found or access denied' });
    }

    // Update the order of each file using raw SQL to avoid Prisma client issues
    for (let i = 0; i < fileIds.length; i++) {
      await prisma.$executeRawUnsafe(`UPDATE "File" SET "order" = $1 WHERE id = $2`, i, fileIds[i]);
    }

    res.json({ success: true, message: 'Files reordered successfully' });
  } catch (err) {
    await logger.error('Failed to reorder files', {
      operation: 'file_reorder',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to reorder files' });
  }
}

// Move a file to a different folder
export async function moveFile(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    res.sendStatus(401);
    return;
  }
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params;
    const { targetFolderId } = req.body;

    // Verify the file belongs to the user
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file || file.userId !== userId) {
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    // Verify the target folder exists and belongs to the user (if specified)
    if (targetFolderId) {
      const targetFolder = await prisma.folder.findUnique({ where: { id: targetFolderId } });
      if (!targetFolder || targetFolder.userId !== userId) {
        return res.status(400).json({ message: 'Target folder not found or access denied' });
      }
    }

    // Get the original file details for activity tracking
    const originalFolderId = file.folderId;

    // Move the file
    const updatedFile = await prisma.file.update({
      where: { id },
      data: { folderId: targetFolderId || null },
    });

    // Create activity record for file move
    await prisma.activity.create({
      data: {
        type: 'edit',
        userId,
        fileId: id,
        details: {
          action: 'file_moved',
          fileName: file.name,
          originalFolderId: originalFolderId,
          newFolderId: targetFolderId,
        },
      },
    });

    res.json({ file: updatedFile, message: 'File moved successfully' });
  } catch (err) {
    await logger.error('Failed to move file', {
      operation: 'file_move',
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    res.status(500).json({ message: 'Failed to move file' });
  }
} 