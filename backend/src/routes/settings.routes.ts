import { Router } from 'express';
import multer from 'multer';
import {
  getSettingsByCategory,
  updateSettingsByCategory,
  getAllSettings,
  getCmsSettings,
  uploadNewHireGuidePdf,
  deleteNewHireGuidePdf,
  streamNewHireGuidePdf,
  uploadWelcomeTipsPdf,
  deleteWelcomeTipsPdf,
  streamWelcomeTipsPdf,
} from '../controllers/settings.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// CMS content (terms & conditions, new hire guide) is readable by clients for onboarding
router.get('/cms', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'CLIENT']), getCmsSettings);

// Stream PDFs — accessible to clients (for onboarding)
router.get('/cms/new-hire-guide-pdf', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'CLIENT']), streamNewHireGuidePdf);
router.get('/cms/welcome-tips-pdf', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'CLIENT']), streamWelcomeTipsPdf);

// All other routes require admin
router.use(authorizeRoles(['SUPER_ADMIN', 'ADMIN']));

// New hire guide PDF upload/delete
router.post('/cms/new-hire-guide-pdf', pdfUpload.single('pdf'), uploadNewHireGuidePdf);
router.delete('/cms/new-hire-guide-pdf', deleteNewHireGuidePdf);

// Welcome tips PDF upload/delete
router.post('/cms/welcome-tips-pdf', pdfUpload.single('pdf'), uploadWelcomeTipsPdf);
router.delete('/cms/welcome-tips-pdf', deleteWelcomeTipsPdf);

// Get all settings
router.get('/', getAllSettings);

// Get settings by category
router.get('/:category', getSettingsByCategory);

// Update settings by category
router.put('/:category', updateSettingsByCategory);

export default router;
