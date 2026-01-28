import { Router, Response } from 'express';
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
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Middleware to check if user is any admin role
const requireAdminRole = (req: AuthenticatedRequest, res: Response, next: Function) => {
  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'];
  if (!req.user || !adminRoles.includes(req.user.role)) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
};

// Get available admin roles (for dropdowns) - any admin can view
router.get('/admin-roles', requireAdminRole, getAdminRoles);

// Statistics - any admin can view
router.get('/admins/stats', requireAdminRole, getAdminUserStats);

// Admin user list and view - any admin can view
router.get('/admins', requireAdminRole, getAdminUsers);
router.get('/admins/:id', requireAdminRole, getAdminUser);

// Create, update, delete - requires settings.roles_manage permission (SUPER_ADMIN only)
router.post('/admins', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), createAdminUser);
router.put('/admins/:id', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), updateAdminUser);
router.delete('/admins/:id', requirePermission(PERMISSIONS.SETTINGS.ROLES_MANAGE), deleteAdminUser);

export default router;
