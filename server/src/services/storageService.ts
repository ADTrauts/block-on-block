import { Storage, Bucket } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { logger } from '../lib/logger';

export interface StorageConfig {
  provider: 'local' | 'gcs';
  gcs?: {
    projectId: string;
    keyFilename?: string;
    bucketName: string;
  };
  local?: {
    uploadDir: string;
  };
}

export interface UploadResult {
  url: string;
  path: string;
  publicUrl?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export class StorageService {
  private static instance: StorageService;
  private config: StorageConfig;
  private storage?: Storage;
  private bucket?: Bucket;

  private constructor() {
    this.config = this.loadConfig();
    this.initializeStorage();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private loadConfig(): StorageConfig {
    // Check both STORAGE_PROVIDER and FILE_STORAGE_TYPE for compatibility
    const provider = (process.env.STORAGE_PROVIDER as 'local' | 'gcs') || 
                    (process.env.FILE_STORAGE_TYPE === 'cloud-storage' ? 'gcs' : 'local') || 
                    'local';
    
    if (provider === 'gcs') {
      return {
        provider: 'gcs',
        gcs: {
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
          // Use Application Default Credentials instead of key file
          keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
          bucketName: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'vssyl-storage',
        },
      };
    }

    return {
      provider: 'local',
      local: {
        uploadDir: process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads'),
      },
    };
  }

  private async initializeStorage() {
    await logger.info('Initializing storage service', {
      operation: 'storage_service_init',
      context: {
        provider: this.config.provider,
        gcsConfig: this.config.gcs,
        localConfig: this.config.local
      }
    });

    if (this.config.provider === 'gcs' && this.config.gcs) {
      try {
        // Use Application Default Credentials (ADC) - no key file needed
        this.storage = new Storage({
          projectId: this.config.gcs.projectId,
          // keyFilename is optional when using ADC
          ...(this.config.gcs.keyFilename && { keyFilename: this.config.gcs.keyFilename }),
        });
        this.bucket = this.storage.bucket(this.config.gcs.bucketName);
        await logger.info('Google Cloud Storage initialized', {
          operation: 'storage_gcs_initialized',
          context: {
            projectId: this.config.gcs.projectId,
            bucketName: this.config.gcs.bucketName,
            hasKeyFile: !!this.config.gcs.keyFilename
          }
        });
      } catch (error) {
        await logger.error('Failed to initialize Google Cloud Storage, falling back to local', {
          operation: 'storage_gcs_init_fallback',
          projectId: this.config.gcs.projectId,
          bucketName: this.config.gcs.bucketName,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        
        // Fall back to local storage
        this.config.provider = 'local';
        this.config.local = {
          uploadDir: process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads'),
        };
        await logger.info('Fallback to local storage initialized', {
          operation: 'storage_local_fallback_init',
          context: {
            uploadDir: this.config.local.uploadDir
          }
        });
      }
    } else {
      await logger.info('Local storage initialized', {
        operation: 'storage_local_initialized',
        context: {
          uploadDir: this.config.local?.uploadDir
        }
      });
    }
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    file: Express.Multer.File,
    destinationPath: string,
    options: {
      makePublic?: boolean;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<UploadResult> {
    if (this.config.provider === 'gcs' && this.bucket) {
      try {
        return await this.uploadToGCS(file, destinationPath, options);
      } catch (error) {
        await logger.error('GCS upload failed, falling back to local storage', {
          operation: 'storage_gcs_upload_fallback',
          destinationPath,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        // Fall back to local storage on GCS failure
        return this.uploadToLocal(file, destinationPath);
      }
    } else {
      return this.uploadToLocal(file, destinationPath);
    }
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<UploadResult> {
    await logger.info('Copying file in storage', {
      operation: 'storage_copy_file_start',
      sourcePath,
      destinationPath,
      provider: this.config.provider
    });

    if (this.config.provider === 'gcs' && this.bucket) {
      const sourceFile = this.bucket.file(sourcePath);
      const [exists] = await sourceFile.exists();
      if (!exists) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      const destinationFile = this.bucket.file(destinationPath);
      await sourceFile.copy(destinationFile);

      const publicUrl = this.getPublicUrl(destinationPath);

      await logger.info('Copied file in GCS', {
        operation: 'storage_copy_file_success',
        destinationPath,
        publicUrl
      });

      return {
        path: destinationPath,
        url: publicUrl,
        publicUrl
      };
    }

    const uploadDir = this.config.local?.uploadDir || path.join(__dirname, '../../uploads');
    // Preserve full directory structure for source path
    const sourceFullPath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.join(uploadDir, sourcePath);

    if (!fs.existsSync(sourceFullPath)) {
      throw new Error(`Source file not found: ${sourceFullPath}`);
    }

    // Preserve full directory structure for destination path
    const destinationFullPath = path.isAbsolute(destinationPath)
      ? destinationPath
      : path.join(uploadDir, destinationPath);
    const destinationDir = path.dirname(destinationFullPath);

    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }

    fs.copyFileSync(sourceFullPath, destinationFullPath);

    await logger.info('Copied file in local storage', {
      operation: 'storage_copy_file_success_local',
      destinationFullPath
    });

    return {
      path: destinationFullPath,
      url: this.getPublicUrl(destinationPath)
    };
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(filePath: string): Promise<DeleteResult> {
    if (this.config.provider === 'gcs' && this.bucket) {
      return this.deleteFromGCS(filePath);
    } else {
      return this.deleteFromLocal(filePath);
    }
  }

  /**
   * Get a public URL for a file
   */
  getPublicUrl(filePath: string): string {
    if (this.config.provider === 'gcs' && this.config.gcs) {
      return `https://storage.googleapis.com/${this.config.gcs.bucketName}/${filePath}`;
    } else {
      // Use environment variable with production fallback (never localhost in production)
      const baseUrl = process.env.BACKEND_URL || 
                     process.env.NEXT_PUBLIC_API_BASE_URL || 
                     'https://vssyl-server-235369681725.us-central1.run.app';
      
      // Extract relative path from uploads directory
      // filePath can be either:
      // 1. A relative path like "profile-photos/user123-avatar.jpg" (from destinationPath)
      // 2. A full path like "/app/uploads/profile-photos/user123-avatar.jpg" (from stored path)
      const uploadDir = this.config.local?.uploadDir || path.join(__dirname, '../../uploads');
      
      // If it's already a relative path (no leading slash, contains subdirectories), use it directly
      if (!path.isAbsolute(filePath) && filePath.includes('/')) {
        return `${baseUrl}/uploads/${filePath}`;
      }
      
      // If it's a full path, extract the relative path from uploads directory
      if (path.isAbsolute(filePath)) {
        const relativePath = path.relative(uploadDir, filePath);
        // Normalize path separators for URLs (use forward slashes)
        const urlPath = relativePath.split(path.sep).join('/');
        return `${baseUrl}/uploads/${urlPath}`;
      }
      
      // Fallback: just the filename (for backward compatibility)
      return `${baseUrl}/uploads/${path.basename(filePath)}`;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (this.config.provider === 'gcs' && this.bucket) {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } else {
      const uploadDir = this.config.local?.uploadDir || path.join(__dirname, '../../uploads');
      // Preserve full directory structure - filePath can be relative like "profile-photos/user123-avatar.jpg"
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(uploadDir, filePath);
      return fs.existsSync(fullPath);
    }
  }

  /**
   * Download a file as a Buffer.
   * For GCS: filePath should be the object path inside the bucket (e.g. "profile-photos/abc.jpg").
   * For Local: filePath can be a full path or a filename; we resolve against uploadDir.
   */
  async getFileBuffer(filePath: string): Promise<Buffer> {
    if (this.config.provider === 'gcs' && this.bucket) {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }
      const [data] = await file.download();
      return data;
    }

    const uploadDir = this.config.local?.uploadDir || path.join(__dirname, '../../uploads');
    // Preserve full directory structure - filePath can be relative like "profile-photos/user123-avatar.jpg"
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(uploadDir, filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }
    return fs.readFileSync(resolved);
  }

  /**
   * Extract a provider-specific storage path from a public URL.
   * Returns null if the URL isn't recognized.
   */
  extractPathFromUrl(urlString: string): string | null {
    try {
      const u = new URL(urlString);
      // GCS public URL: https://storage.googleapis.com/<bucket>/<path>
      if (u.hostname === 'storage.googleapis.com') {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          // parts[0] = bucket name, rest = object path
          return parts.slice(1).join('/');
        }
      }
      // Local public URL: <base>/uploads/<filename>
      const segments = u.pathname.split('/').filter(Boolean);
      const uploadsIdx = segments.indexOf('uploads');
      if (uploadsIdx >= 0 && segments[uploadsIdx + 1]) {
        return segments.slice(uploadsIdx + 1).join('/');
      }
      return null;
    } catch {
      return null;
    }
  }

  private async uploadToGCS(
    file: Express.Multer.File,
    destinationPath: string,
    options: { makePublic?: boolean; metadata?: Record<string, string> }
  ): Promise<UploadResult> {
    if (!this.bucket) {
      throw new Error('Google Cloud Storage bucket not initialized');
    }

    await logger.info('Uploading to GCS', {
      operation: 'storage_gcs_upload',
      context: {
        destinationPath,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        bucketName: this.config.gcs?.bucketName
      }
    });

    try {
      const gcsFile = this.bucket.file(destinationPath);
      const stream = gcsFile.createWriteStream({
        resumable: false, // Use simple upload instead of resumable for better reliability
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            ...options.metadata,
          },
        },
      });

      // Upload the file
      await new Promise((resolve, reject) => {
        stream.on('error', (error: Error) => {
          logger.error('GCS upload stream error', {
            operation: 'storage_gcs_stream_error',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
          reject(error);
        });
        stream.on('finish', () => {
          logger.debug('GCS upload stream finished', {
            operation: 'storage_gcs_stream_finished'
          });
          resolve(undefined);
        });
        stream.end(file.buffer);
      });

      // Make public if requested
      // Note: With uniform bucket-level access, individual objects cannot be made public
      // The bucket itself needs to be configured for public access
      if (options.makePublic) {
        try {
          await gcsFile.makePublic();
          await logger.debug('File made public', {
            operation: 'storage_gcs_file_public'
          });
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes('uniform bucket-level access')) {
            await logger.debug('Bucket has uniform access', {
              operation: 'storage_gcs_uniform_access'
            });
          } else {
            await logger.error('Failed to make file public', {
              operation: 'storage_gcs_make_public_error',
              error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
              }
            });
            throw error;
          }
        }
      }

      const publicUrl = this.getPublicUrl(destinationPath);
      await logger.info('GCS upload successful', {
        operation: 'storage_gcs_upload_success',
        publicUrl,
        destinationPath
      });

      return {
        url: publicUrl,
        path: destinationPath,
        publicUrl: options.makePublic ? publicUrl : undefined,
      };
    } catch (error) {
      await logger.error('GCS upload failed', {
        operation: 'storage_gcs_upload_failed',
        destinationPath,
        fileName: file.originalname,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  private async uploadToLocal(
    file: Express.Multer.File,
    destinationPath: string
  ): Promise<UploadResult> {
    const uploadDir = this.config.local?.uploadDir || path.join(__dirname, '../../uploads');
    
    // Preserve the full directory structure from destinationPath
    // destinationPath can be like "profile-photos/user123-avatar.jpg"
    // We want to store it at uploads/profile-photos/user123-avatar.jpg
    const fullPath = path.isAbsolute(destinationPath)
      ? destinationPath
      : path.join(uploadDir, destinationPath);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Handle both memory storage (file.buffer) and disk storage (file.path)
    if (file.buffer) {
      // File is in memory (from multer.memoryStorage())
      fs.writeFileSync(fullPath, file.buffer);
    } else if (file.path) {
      // File is already on disk (from multer.diskStorage())
      // Copy from temp location to final destination
      if (file.path !== fullPath) {
        fs.copyFileSync(file.path, fullPath);
        // Clean up temp file
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          // Ignore cleanup errors
          await logger.warn('Failed to cleanup temp file', {
            operation: 'storage_local_cleanup_temp',
            tempPath: file.path,
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
        }
      }
    } else {
      throw new Error('File buffer or path not available');
    }

    return {
      url: this.getPublicUrl(destinationPath),
      path: fullPath,
    };
  }

  private async deleteFromGCS(filePath: string): Promise<DeleteResult> {
    if (!this.bucket) {
      return { success: false, error: 'Google Cloud Storage bucket not initialized' };
    }

    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      
      if (exists) {
        await file.delete();
        return { success: true };
      } else {
        return { success: false, error: 'File not found' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async deleteFromLocal(filePath: string): Promise<DeleteResult> {
    try {
      const uploadDir = this.config.local?.uploadDir || path.join(__dirname, '../../uploads');
      // Preserve full directory structure - filePath can be relative like "profile-photos/user123-avatar.jpg"
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(uploadDir, filePath);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return { success: true };
      } else {
        return { success: false, error: 'File not found' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get the current storage provider
   */
  getProvider(): 'local' | 'gcs' {
    return this.config.provider;
  }

  /**
   * Check if Google Cloud Storage is properly configured
   */
  isGCSConfigured(): boolean {
    return (
      this.config.provider === 'gcs' &&
      !!this.config.gcs?.projectId &&
      !!this.config.gcs?.bucketName &&
      !!this.storage &&
      !!this.bucket
    );
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();
