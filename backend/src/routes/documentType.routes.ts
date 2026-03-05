import { Router } from 'express';
import {
  getDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '../controllers/documentType.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// GET is public (needed for token-based onboarding flow)
router.get('/', getDocumentTypes);

// CUD operations require authentication + admin roles
router.post('/', authenticate, authorizeRoles(['SUPER_ADMIN', 'ADMIN']), createDocumentType);
router.put('/:id', authenticate, authorizeRoles(['SUPER_ADMIN', 'ADMIN']), updateDocumentType);
router.delete('/:id', authenticate, authorizeRoles(['SUPER_ADMIN', 'ADMIN']), deleteDocumentType);

export default router;
