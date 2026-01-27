import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { 
  uploadProfilePhoto, 
  removeProfilePhoto, 
  getProfilePhotos,
  assignProfilePhoto,
  updateProfilePhotoAvatar,
  serveProfilePhoto,
  multerUpload 
} from '../controllers/profilePhotoController';

const router: express.Router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Get user's profile photos
router.get('/', getProfilePhotos);

// Serve profile photo image (authenticated endpoint)
// This allows images to be served even when bucket has public access prevention
router.get('/serve/:photoId', serveProfilePhoto);

// Upload a profile photo
router.post('/upload', multerUpload, uploadProfilePhoto);

// Assign a library photo as personal or business
router.post('/assign', assignProfilePhoto);

// Update avatar rendition (crop params) for a library photo (future enhancement)
router.post('/:id/avatar', updateProfilePhotoAvatar);

// Remove a profile photo
router.delete('/remove', removeProfilePhoto);

export default router;
