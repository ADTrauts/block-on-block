console.log('[DEBUG] fileRouter loaded');
import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { listFiles, uploadFile, downloadFile, updateFile, deleteFile, multerUploadWithErrorHandling, listFilePermissions, grantFilePermission, updateFilePermission, revokeFilePermission, listTrashedFiles, restoreFile, hardDeleteFile, toggleFileStarred, reorderFiles, moveFile } from '../controllers/fileController';

const router: express.Router = express.Router();

// List all files for the authenticated user (optionally by folder)
router.get('/', authenticateJWT, listFiles);

// List trashed files
router.get('/trashed', authenticateJWT, listTrashedFiles);

// Upload a new file
router.post('/', authenticateJWT, multerUploadWithErrorHandling, uploadFile);

// Reorder files within a folder (specific route before parameterized routes)
router.post('/reorder/:folderId', authenticateJWT, reorderFiles);

// All specific routes with /:id must come before the generic /:id route
// Download a file (specific route)
router.get('/:id/download', authenticateJWT, downloadFile);

// List all permissions for a file
router.get('/:id/permissions', authenticateJWT, listFilePermissions);

// Grant or update a user's permission for a file
router.post('/:id/permissions', authenticateJWT, grantFilePermission);

// Update a user's permission for a file
router.put('/:id/permissions/:userId', authenticateJWT, updateFilePermission);

// Revoke a user's permission for a file
router.delete('/:id/permissions/:userId', authenticateJWT, revokeFilePermission);

// Toggle the starred status of a file
router.put('/:id/star', authenticateJWT, toggleFileStarred);

// Restore a trashed file
router.post('/:id/restore', authenticateJWT, restoreFile);

// Permanently delete a trashed file
router.delete('/:id/hard-delete', authenticateJWT, hardDeleteFile);

// Move a file to a different folder
router.post('/:id/move', authenticateJWT, moveFile);

// Generic routes (must come after all specific routes)
// Download or preview a file
router.get('/:id', authenticateJWT, downloadFile);

// Update (rename/move) a file
router.put('/:id', authenticateJWT, updateFile);

// Delete a file (move to trash)
router.delete('/:id', authenticateJWT, deleteFile);

export default router;

// Log all registered routes in development (after all routes are registered)
if (process.env.NODE_ENV === 'development') {
  // Use setTimeout to ensure this runs after all routes are registered
  setTimeout(() => {
    console.log('📁 File router registered routes:', {
      totalRoutes: router.stack.length,
      downloadRoute: router.stack.find((layer: any) => 
        layer.route?.methods?.get && layer.route?.path === '/:id/download'
      ) ? '✅ Found' : '❌ Missing',
      directRoute: router.stack.find((layer: any) => 
        layer.route?.methods?.get && layer.route?.path === '/:id' && !layer.route?.path?.includes('download')
      ) ? '✅ Found' : '❌ Missing',
      allRoutes: router.stack.map((layer: any) => ({
        path: layer.route?.path,
        methods: Object.keys(layer.route?.methods || {}),
      })).filter((r: any) => r.path)
    });
  }, 100);
} 