import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticate } from '../middleware/auth.middleware';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  getPermissionsByCategory,
  ALL_PERMISSIONS,
} from '../config/permissions';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get current user's permissions
router.get('/me', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const permissions = getRolePermissions(userRole);

    res.json({
      success: true,
      data: {
        role: userRole,
        permissions,
        permissionCount: permissions.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions',
    });
  }
});

// Get all permission constants (for frontend reference)
router.get('/constants', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        permissions: PERMISSIONS,
        allPermissions: ALL_PERMISSIONS,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permission constants',
    });
  }
});

// Get permissions grouped by category (for role management UI)
router.get('/categories', (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = getPermissionsByCategory();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permission categories',
    });
  }
});

// Get role-permission matrix (for admin role management)
router.get('/matrix', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only SUPER_ADMIN and ADMIN can view the full matrix
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.',
      });
    }

    // Get admin roles only (not CLIENT or EMPLOYEE)
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'];
    const matrix: Record<string, string[]> = {};

    adminRoles.forEach((role) => {
      matrix[role] = ROLE_PERMISSIONS[role] || [];
    });

    res.json({
      success: true,
      data: {
        roles: adminRoles,
        matrix,
        categories: getPermissionsByCategory(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permission matrix',
    });
  }
});

// Check if current user has a specific permission
router.get('/check/:permission', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { permission } = req.params;
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const permissions = getRolePermissions(userRole);
    const hasPermission = permissions.includes(permission as string);

    res.json({
      success: true,
      data: {
        permission,
        hasPermission,
        role: userRole,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check permission',
    });
  }
});

export default router;
