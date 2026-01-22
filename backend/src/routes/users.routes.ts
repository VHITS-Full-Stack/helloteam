import { Router } from 'express';
import {
  getAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getAdminUserStats,
  getAdminRoles,
} from '../controllers/users.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available admin roles (for dropdowns)
router.get('/admin-roles', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), getAdminRoles);

// Statistics - requires settings.roles_manage permission
router.get('/admins/stats', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), getAdminUserStats);

// Admin user CRUD operations (requires settings.roles_manage permission)
router.get('/admins', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), getAdminUsers);
router.get('/admins/:id', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), getAdminUser);
router.post('/admins', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), createAdminUser);
router.put('/admins/:id', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), updateAdminUser);
router.delete('/admins/:id', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), deleteAdminUser);

export default router;
