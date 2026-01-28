import { Router } from 'express';
import {
  getSettingsByCategory,
  updateSettingsByCategory,
  getAllSettings,
} from '../controllers/settings.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorizeRoles(['SUPER_ADMIN', 'ADMIN']));

// Get all settings
router.get('/', getAllSettings);

// Get settings by category
router.get('/:category', getSettingsByCategory);

// Update settings by category
router.put('/:category', updateSettingsByCategory);

export default router;
