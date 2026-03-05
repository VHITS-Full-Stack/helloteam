import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import {
  getOnboardingStatus,
  savePersonalInfo,
  saveEmergencyContacts,
  saveGovernmentIdType,
  uploadGovernmentId,
  uploadGovernmentId2,
  uploadProofOfAddress,
  completeOnboarding,
  resubmitKyc,
} from '../controllers/employeeOnboarding.controller';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Wrapper to catch multer file-size errors and return a clean JSON response
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB' });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: err.message || 'File upload error' });
      return;
    }
    next();
  });
};

router.get('/status', getOnboardingStatus);
router.post('/personal-info', savePersonalInfo);
router.post('/emergency-contacts', saveEmergencyContacts);
router.post('/government-id-type', saveGovernmentIdType);
router.post('/government-id', handleUpload, uploadGovernmentId);
router.post('/government-id-2', handleUpload, uploadGovernmentId2);
router.post('/proof-of-address', handleUpload, uploadProofOfAddress);
router.post('/complete', completeOnboarding);
router.post('/resubmit-kyc', resubmitKyc);

export default router;
