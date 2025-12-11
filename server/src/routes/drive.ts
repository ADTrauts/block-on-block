import { Router } from 'express';
import fileRouter from './file';
import folderRouter from './folder';
import { getItemActivity, getSharedItems } from '../controllers/fileController';
import { 
  getRecentFilesContext, 
  getStorageStatsContext,
  getFileCount 
} from '../controllers/driveAIContextController';
import { authenticateJWT } from '../middleware/auth';

const driveRouter: Router = Router();

driveRouter.use('/files', fileRouter);
driveRouter.use('/folders', folderRouter);
driveRouter.get('/items/:itemId/activity', getItemActivity);
driveRouter.get('/shared', authenticateJWT, getSharedItems);

// AI Context Provider Endpoints
driveRouter.get('/ai/context/recent', authenticateJWT, getRecentFilesContext);
driveRouter.get('/ai/context/storage', authenticateJWT, getStorageStatsContext);
driveRouter.get('/ai/query/count', authenticateJWT, getFileCount);

export default driveRouter; 