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

// Get user's profile photos
router.get('/', authenticateJWT, getProfilePhotos);

// Upload a profile photo
router.post('/upload', authenticateJWT, multerUpload, uploadProfilePhoto);

// Assign a library photo as personal or business
router.post('/assign', authenticateJWT, assignProfilePhoto);

// Update avatar rendition (crop params) for a library photo (future enhancement)
router.post('/:id/avatar', authenticateJWT, updateProfilePhotoAvatar);

// Remove a profile photo
router.delete('/remove', authenticateJWT, removeProfilePhoto);

export default router;
