import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
  getUserPermissions,
  assignRoleToUser,
} from '../controllers/roles.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current user's permissions (accessible by all authenticated users)
router.get('/my-permissions', getUserPermissions);

// Get all available permissions (for building UI)
router.get('/available-permissions', requirePermission(PERMISSIONS.SETTINGS.VIEW), getAvailablePermissions);

// CRUD operations for roles (require appropriate permissions)
router.get('/', requirePermission(PERMISSIONS.SETTINGS.VIEW), getRoles);
router.get('/:id', requirePermission(PERMISSIONS.SETTINGS.VIEW), getRoleById);
router.post('/', requirePermission(PERMISSIONS.SETTINGS.MANAGE_ROLES), createRole);
router.put('/:id', requirePermission(PERMISSIONS.SETTINGS.MANAGE_ROLES), updateRole);
router.delete('/:id', requirePermission(PERMISSIONS.SETTINGS.MANAGE_ROLES), deleteRole);

// Assign role to user
router.post('/assign', requirePermission(PERMISSIONS.SETTINGS.MANAGE_ROLES), assignRoleToUser);

export default router;
