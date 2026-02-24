import { Router } from 'express';
import {
  getDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '../controllers/documentType.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET is accessible to all authenticated users (employees need it for onboarding)
router.get('/', getDocumentTypes);

// CUD operations require admin roles
router.post('/', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), createDocumentType);
router.put('/:id', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), updateDocumentType);
router.delete('/:id', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), deleteDocumentType);

export default router;
