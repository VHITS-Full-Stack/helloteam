import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import {
  getOnboardingStatus,
  savePersonalInfo,
  saveEmergencyContacts,
  saveGovernmentIdType,
  uploadGovernmentId,
  completeOnboarding,
} from '../controllers/employeeOnboarding.controller';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get('/status', getOnboardingStatus);
router.post('/personal-info', savePersonalInfo);
router.post('/emergency-contacts', saveEmergencyContacts);
router.post('/government-id-type', saveGovernmentIdType);
router.post('/government-id', upload.single('file'), uploadGovernmentId);
router.post('/complete', completeOnboarding);

export default router;
