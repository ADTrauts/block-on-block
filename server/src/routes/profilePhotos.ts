import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { 
  uploadProfilePhoto, 
  removeProfilePhoto, 
  getProfilePhotos,
  assignProfilePhoto,
  updateProfilePhotoAvatar,
  multerUpload 
} from '../controllers/profilePhotoController';

const router: express.Router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Get user's profile photos
router.get('/', getProfilePhotos);

// Upload a profile photo
router.post('/upload', multerUpload, uploadProfilePhoto);

// Assign a library photo as personal or business
router.post('/assign', assignProfilePhoto);

// Update avatar rendition (crop params) for a library photo (future enhancement)
router.post('/:id/avatar', updateProfilePhotoAvatar);

// Remove a profile photo
router.delete('/remove', removeProfilePhoto);

export default router;
