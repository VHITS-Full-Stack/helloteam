import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { authenticate } from '../middleware/auth.middleware';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  getPermissionsByCategory,
  ALL_PERMISSIONS,
} from '../config/permissions';

const prisma = new PrismaClient();
const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get current user's permissions
router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get permissions from database (dynamicRole) only
    let permissions: string[] = [];

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          dynamicRole: {
            include: {
              permissions: {
                select: { permission: true },
              },
            },
          },
        },
      });

      if (user?.dynamicRole?.permissions?.length) {
        // User has a linked dynamicRole with permissions
        permissions = user.dynamicRole.permissions.map(p => p.permission);
      } else {
        // User has no dynamicRole linked — look up role by name and assign it
        const role = await prisma.role.findUnique({
          where: { name: userRole },
          include: {
            permissions: {
              select: { permission: true },
            },
          },
        });

        if (role) {
          permissions = role.permissions.map(p => p.permission);

          // Auto-link the role to the user so future lookups are faster
          await prisma.user.update({
            where: { id: userId },
            data: { roleId: role.id },
          });
        }
      }
    }

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
