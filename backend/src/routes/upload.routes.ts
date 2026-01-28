import { Router } from 'express';
import multer from 'multer';
import { uploadProfilePhoto, deleteProfilePhoto, uploadClientLogo, deleteClientLogo } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: JPEG, PNG, WebP, GIF'));
    }
  },
});

// Employee profile photo routes
router.post('/profile-photo', authenticate, upload.single('photo'), uploadProfilePhoto);
router.delete('/profile-photo', authenticate, deleteProfilePhoto);

// Client logo routes
router.post('/client-logo', authenticate, upload.single('photo'), uploadClientLogo);
router.delete('/client-logo', authenticate, deleteClientLogo);

export default router;
