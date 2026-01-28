import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storageService } from '../services/storageService';
import sharp from 'sharp';
import { logger } from '../lib/logger';

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

type CropParams = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zoom?: number;
};

function parseCropParams(raw: unknown): CropParams | null {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseCropParams(parsed);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const x = obj.x;
  const y = obj.y;
  const width = obj.width;
  const height = obj.height;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
    return null;
  }
  const rotation = typeof obj.rotation === 'number' ? obj.rotation : undefined;
  const zoom = typeof obj.zoom === 'number' ? obj.zoom : undefined;
  return { x, y, width, height, rotation, zoom };
}

async function generateAvatarRendition(buffer: Buffer, crop: CropParams | null): Promise<Buffer> {
  // Produce a 512x512 square JPEG avatar rendition.
  // If crop is missing, do a center crop.
  let image = sharp(buffer).rotate(); // auto-orient by EXIF
  if (crop) {
    // Note: crop values are expected to be pixels in the preview image coordinate space.
    // For now, apply them directly; client should send pixelCrop from react-easy-crop.
    image = image.extract({
      left: Math.max(0, Math.round(crop.x)),
      top: Math.max(0, Math.round(crop.y)),
      width: Math.max(1, Math.round(crop.width)),
      height: Math.max(1, Math.round(crop.height)),
    });
    if (typeof crop.rotation === 'number' && crop.rotation !== 0) {
      image = image.rotate(crop.rotation);
    }
  } else {
    image = image.resize(512, 512, { fit: 'cover', position: 'centre' });
  }

  return await image
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// Configure multer for profile photo uploads
const upload = multer({
  storage: storageService.getProvider() === 'gcs' ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads/profile-photos');
      
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
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const multerUpload = upload.single('photo') as any;

export async function uploadProfilePhoto(req: RequestWithFile, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { photoType, crop } = req.body as { photoType?: string; crop?: unknown }; // photoType optional; crop optional

    if (photoType && !['personal', 'business'].includes(photoType)) {
      return res.status(400).json({ error: 'Invalid photo type. Must be "personal" or "business"' });
    }

    const cropParams = parseCropParams(crop);

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const timestamp = Date.now();
    const uniqueOriginalFilename = `profile-photos/${userId}-original-${timestamp}${fileExtension}`;
    const uniqueAvatarFilename = `profile-photos/${userId}-avatar-${timestamp}.jpg`;

    // Read original file buffer BEFORE uploading (important for disk storage)
    // For GCS, file is in memory (buffer). For local, file is on disk (path).
    let originalBuffer: Buffer | null = null;
    const provider = storageService.getProvider();
    
    if (provider === 'gcs') {
      if (req.file.buffer) {
        originalBuffer = req.file.buffer as Buffer;
      } else {
        console.error('GCS storage but req.file.buffer is missing');
        return res.status(400).json({ error: 'Failed to process uploaded file: buffer missing' });
      }
    } else {
      // Local storage: read file from disk
      if (!req.file.path) {
        console.error('Local storage but req.file.path is missing. File info:', {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          encoding: req.file.encoding,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });
        return res.status(400).json({ error: 'Failed to process uploaded file: file path missing' });
      }
      
      try {
        // Check if file exists
        if (!fs.existsSync(req.file.path)) {
          console.error('File does not exist at path:', req.file.path);
          return res.status(400).json({ error: 'Failed to process uploaded file: file not found on disk' });
        }
        originalBuffer = await fs.promises.readFile(req.file.path);
      } catch (err) {
        console.error('Error reading file from disk:', err);
        return res.status(400).json({ error: 'Failed to read uploaded file from disk' });
      }
    }

    if (!originalBuffer) {
      console.error('originalBuffer is null after processing. Provider:', provider);
      return res.status(400).json({ error: 'Failed to process uploaded file' });
    }

    // Upload original file using storage service
    const uploadOriginalResult = await storageService.uploadFile(req.file, uniqueOriginalFilename, {
      makePublic: true,
      metadata: {
        userId,
        kind: 'profile-photo-original',
        originalName: req.file.originalname,
      },
    });

    const originalUrl = uploadOriginalResult.url;

    const avatarBuffer = await generateAvatarRendition(originalBuffer, cropParams);
    const avatarFile: Express.Multer.File = {
      fieldname: 'photo',
      originalname: `avatar-${timestamp}.jpg`,
      encoding: req.file.encoding,
      mimetype: 'image/jpeg',
      size: avatarBuffer.length,
      buffer: avatarBuffer,
      destination: '',
      filename: '',
      path: '',
      stream: undefined as any,
    };

    const uploadAvatarResult = await storageService.uploadFile(avatarFile, uniqueAvatarFilename, {
      makePublic: true,
      metadata: {
        userId,
        kind: 'profile-photo-avatar',
        originalName: req.file.originalname,
      },
    });

    const avatarUrl = uploadAvatarResult.url;

    // Create library record
    const created = await prisma.userProfilePhoto.create({
      data: {
        userId,
        originalUrl,
        avatarUrl,
        crop: cropParams ? (cropParams as unknown as object) : undefined,
        rotation: typeof cropParams?.rotation === 'number' ? Math.round(cropParams.rotation) : undefined,
      },
    });

    // Optional: assign immediately if photoType provided (backward compatibility with existing UI)
    if (photoType === 'personal') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          personalPhotoId: created.id,
          personalPhoto: avatarUrl,
        },
      });
    } else if (photoType === 'business') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          businessPhotoId: created.id,
          businessPhoto: avatarUrl,
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {},
      select: {
        id: true,
        name: true,
        email: true,
        personalPhoto: true,
        businessPhoto: true,
        personalPhotoId: true,
        businessPhotoId: true,
        image: true,
      }
    });

    // Note: Activity creation removed to avoid Prisma schema issues
    // TODO: Add proper activity tracking when schema is updated

    res.json({
      success: true,
      message: `Profile photo uploaded successfully`,
      photo: created,
      user: updatedUser,
      photos: {
        personal: updatedUser.personalPhoto,
        business: updatedUser.businessPhoto,
        default: updatedUser.image,
      }
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const userId = req.user && typeof req.user === 'object' && 'id' in req.user
      ? String((req.user as { id?: string; sub?: string }).id ?? (req.user as { sub?: string }).sub)
      : undefined;
    logger.error('Profile photo upload failed', {
      operation: 'upload_profile_photo',
      userId,
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
}

export async function assignProfilePhoto(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { photoId, target } = req.body as { photoId?: string; target?: 'personal' | 'business' };
    if (!photoId || (target !== 'personal' && target !== 'business')) {
      return res.status(400).json({ error: 'photoId and target ("personal" | "business") are required' });
    }

    const photo = await prisma.userProfilePhoto.findFirst({
      where: { id: photoId, userId, trashedAt: null },
    });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Enforce: cannot assign same photo to both
    const updateData: Record<string, unknown> =
      target === 'personal'
        ? { personalPhotoId: photoId, personalPhoto: photo.avatarUrl }
        : { businessPhotoId: photoId, businessPhoto: photo.avatarUrl };

    // If assigning to personal, and business currently points to same photo, clear it (defensive)
    // Same for business.
    if (target === 'personal') {
      updateData.businessPhotoId = null;
    } else {
      updateData.personalPhotoId = null;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        personalPhoto: true,
        businessPhoto: true,
        personalPhotoId: true,
        businessPhotoId: true,
        image: true,
      },
    });

    res.json({
      success: true,
      user,
      photos: {
        personal: user.personalPhoto,
        business: user.businessPhoto,
        default: user.image,
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const userId = req.user && typeof req.user === 'object' && 'id' in req.user ? String((req.user as { id?: string }).id) : undefined;
    logger.error('Profile photo assign failed', {
      operation: 'assign_profile_photo',
      userId,
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to assign profile photo' });
  }
}

export async function updateProfilePhotoAvatar(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userId = (req.user as any).id || (req.user as any).sub;
    const { id } = req.params as { id: string };
    const cropParams = parseCropParams((req.body as any)?.crop);
    if (!cropParams) {
      return res.status(400).json({ error: 'Valid crop params are required' });
    }

    const photo = await prisma.userProfilePhoto.findFirst({
      where: { id, userId, trashedAt: null },
      select: { id: true, originalUrl: true },
    });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const originalPath = storageService.extractPathFromUrl(photo.originalUrl);
    if (!originalPath) {
      return res.status(400).json({ error: 'Could not resolve original storage path' });
    }

    const originalBuffer = await storageService.getFileBuffer(originalPath);
    const avatarBuffer = await generateAvatarRendition(originalBuffer, cropParams);

    const timestamp = Date.now();
    const uniqueAvatarFilename = `profile-photos/${userId}-avatar-${id}-${timestamp}.jpg`;

    const avatarFile: Express.Multer.File = {
      fieldname: 'photo',
      originalname: `avatar-${id}-${timestamp}.jpg`,
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: avatarBuffer.length,
      buffer: avatarBuffer,
      destination: '',
      filename: '',
      path: '',
      stream: undefined as any,
    };

    const uploadAvatarResult = await storageService.uploadFile(avatarFile, uniqueAvatarFilename, {
      makePublic: true,
      metadata: {
        userId,
        kind: 'profile-photo-avatar',
        originalName: avatarFile.originalname,
      },
    });

    const updatedPhoto = await prisma.userProfilePhoto.update({
      where: { id },
      data: {
        avatarUrl: uploadAvatarResult.url,
        crop: cropParams as unknown as object,
        rotation: typeof cropParams.rotation === 'number' ? Math.round(cropParams.rotation) : undefined,
      },
    });

    // If assigned, update backward-compat URL fields too
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalPhotoId: true, businessPhotoId: true },
    });
    if (user?.personalPhotoId === id) {
      await prisma.user.update({
        where: { id: userId },
        data: { personalPhoto: updatedPhoto.avatarUrl },
      });
    }
    if (user?.businessPhotoId === id) {
      await prisma.user.update({
        where: { id: userId },
        data: { businessPhoto: updatedPhoto.avatarUrl },
      });
    }

    res.json({ success: true, photo: updatedPhoto });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const userId = req.user && typeof req.user === 'object' && 'id' in req.user ? String((req.user as { id?: string }).id) : undefined;
    logger.error('Profile photo avatar update failed', {
      operation: 'update_profile_photo_avatar',
      userId,
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update profile photo avatar' });
  }
}

export async function removeProfilePhoto(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { photoType } = req.body; // 'personal' or 'business'

    if (!photoType || !['personal', 'business'].includes(photoType)) {
      return res.status(400).json({ error: 'Invalid photo type. Must be "personal" or "business"' });
    }

    // Get current user to find the photo URL
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        personalPhoto: true,
        businessPhoto: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPhotoUrl = photoType === 'personal' ? user.personalPhoto : user.businessPhoto;

    if (!currentPhotoUrl) {
      return res.status(400).json({ error: 'No photo to remove' });
    }

    // Remove file from storage
    try {
      // Extract the file path from the URL
      const url = new URL(currentPhotoUrl);
      const filePath = url.pathname.substring(1); // Remove leading slash
      
      const deleteResult = await storageService.deleteFile(filePath);
      if (!deleteResult.success) {
        console.warn(`Failed to delete file from storage: ${deleteResult.error}`);
        // Continue with database update even if storage deletion fails
      }
    } catch (error) {
      console.error('Error deleting file from storage:', error);
      // Continue with database update even if file deletion fails
    }

    // Update user record to remove the photo URL
    const updateData: Record<string, unknown> = {};
    if (photoType === 'personal') {
      updateData.personalPhoto = null;
    } else {
      updateData.businessPhoto = null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        personalPhoto: true,
        businessPhoto: true,
        image: true,
      }
    });

    // Note: Activity creation removed to avoid Prisma schema issues
    // TODO: Add proper activity tracking when schema is updated

    res.json({
      success: true,
      message: `${photoType} photo removed successfully`,
      user: updatedUser
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const userId = req.user && typeof req.user === 'object' && 'id' in req.user ? String((req.user as { id?: string }).id) : undefined;
    logger.error('Profile photo remove failed', {
      operation: 'remove_profile_photo',
      userId,
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to remove profile photo' });
  }
}

export async function getProfilePhotos(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        personalPhoto: true,
        businessPhoto: true,
        personalPhotoId: true,
        businessPhotoId: true,
        image: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const library = await prisma.userProfilePhoto.findMany({
      where: { userId, trashedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalUrl: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        rotation: true,
        crop: true,
      },
    });

    // Convert all URLs to backend serving URLs for consistent, authenticated access
    // This ensures images work regardless of storage provider or public access settings
    const baseUrl = process.env.BACKEND_URL || 
                   process.env.NEXT_PUBLIC_API_BASE_URL || 
                   'https://vssyl-server-235369681725.us-central1.run.app';

    const convertToBackendUrl = (url: string | null, photoId: string | null, type: 'avatar' | 'original'): string | null => {
      if (!url || !photoId) return url;
      
      // If it's already a backend serving URL, return as-is
      if (url.includes('/api/profile-photos/serve/')) {
        return url;
      }
      
      // Convert GCS URLs to backend serving URL
      if (url.includes('storage.googleapis.com')) {
        return `${baseUrl}/api/profile-photos/serve/${photoId}?type=${type}`;
      }
      
      // Convert local storage URLs (both full URLs and relative paths) to backend serving URL
      if (url.includes('/uploads/') || url.startsWith('/uploads/')) {
        return `${baseUrl}/api/profile-photos/serve/${photoId}?type=${type}`;
      }
      
      // For any other URL format, convert to backend serving URL as fallback
      return `${baseUrl}/api/profile-photos/serve/${photoId}?type=${type}`;
    };

    // Convert library URLs
    const libraryWithBackendUrls = library.map(photo => ({
      ...photo,
      avatarUrl: convertToBackendUrl(photo.avatarUrl, photo.id, 'avatar'),
      originalUrl: convertToBackendUrl(photo.originalUrl, photo.id, 'original'),
    }));

    // Convert user photo URLs
    const personalPhotoId = user.personalPhotoId;
    const businessPhotoId = user.businessPhotoId;
    const personalPhotoUrl = personalPhotoId 
      ? convertToBackendUrl(user.personalPhoto, personalPhotoId, 'avatar')
      : user.personalPhoto;
    const businessPhotoUrl = businessPhotoId
      ? convertToBackendUrl(user.businessPhoto, businessPhotoId, 'avatar')
      : user.businessPhoto;

    res.json({
      success: true,
      photos: {
        personal: personalPhotoUrl,
        business: businessPhotoUrl,
        default: user.image,
      },
      user: {
        ...user,
        personalPhoto: personalPhotoUrl,
        businessPhoto: businessPhotoUrl,
      },
      library: libraryWithBackendUrls
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const userId = req.user && typeof req.user === 'object' && 'id' in req.user ? String((req.user as { id?: string }).id) : undefined;
    logger.error('Profile photos fetch failed', {
      operation: 'get_profile_photos',
      userId,
      error: { message: err.message, stack: err.stack },
    });
    // Include error message in response for debugging (only in development)
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Failed to get profile photos';
    res.status(500).json({ 
      error: errorMessage,
      message: 'Failed to get profile photos',
      ...(process.env.NODE_ENV === 'development' && { details: err.stack })
    });
  }
}

/**
 * Serve a profile photo image file
 * This endpoint allows serving images even when GCS bucket has public access prevention
 */
export async function serveProfilePhoto(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { photoId } = req.params;
    const { type = 'avatar' } = req.query; // 'avatar' or 'original'

    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    // Find the photo (must belong to the user)
    const photo = await prisma.userProfilePhoto.findFirst({
      where: { 
        id: photoId,
        userId,
        trashedAt: null 
      },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Get the file path from the URL
    const photoUrl = type === 'original' ? photo.originalUrl : photo.avatarUrl;
    if (!photoUrl) {
      return res.status(404).json({ error: 'Photo URL not found' });
    }

    // Extract file path from URL
    let filePath: string;
    if (photoUrl.includes('storage.googleapis.com')) {
      // GCS URL: https://storage.googleapis.com/bucket/path
      const urlParts = photoUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part.includes('storage.googleapis.com'));
      if (bucketIndex >= 0 && urlParts[bucketIndex + 1]) {
        filePath = urlParts.slice(bucketIndex + 1).join('/');
      } else {
        return res.status(400).json({ error: 'Invalid GCS URL format' });
      }
    } else if (photoUrl.includes('/uploads/')) {
      // Local URL: can be either:
      // - Full URL: https://vssyl-server-235369681725.us-central1.run.app/uploads/profile-photos/...
      // - Relative URL: /uploads/profile-photos/...
      // Extract the path after /uploads/
      const uploadsIndex = photoUrl.indexOf('/uploads/');
      filePath = photoUrl.substring(uploadsIndex + '/uploads/'.length);
    } else {
      return res.status(400).json({ error: 'Unsupported URL format' });
    }

    // Get file buffer from storage
    const fileBuffer = await storageService.getFileBuffer(filePath);

    // Determine content type
    const contentType = photoUrl.endsWith('.jpg') || photoUrl.endsWith('.jpeg') 
      ? 'image/jpeg' 
      : photoUrl.endsWith('.png') 
      ? 'image/png' 
      : 'image/jpeg'; // default

    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Content-Length', fileBuffer.length.toString());
    res.send(fileBuffer);

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Profile photo serve failed', {
      operation: 'serve_profile_photo',
      photoId: req.params.photoId,
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ 
      error: 'Failed to serve profile photo',
      message: err.message 
    });
  }
}
