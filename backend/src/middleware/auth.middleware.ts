import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { AuthenticatedRequest, JwtPayload } from '../types';
// Dynamic permissions are now fully database-driven (no static fallback)

const prisma = new PrismaClient();

// Cache for user permissions to avoid repeated DB queries
const permissionsCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get user permissions from database
async function getUserPermissions(userId: string | undefined, role?: string): Promise<string[]> {
  // If userId is undefined, null, or empty, return empty permissions
  if (!userId || userId === 'undefined' || userId.trim() === '') {
    console.log('getUserPermissions called with invalid userId:', userId);
    return [];
  }

  // Check cache first
  const cached = permissionsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  // Fetch from database
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

  let permissions = user?.dynamicRole?.permissions.map(p => p.permission) || [];

  // If user has no dynamicRole linked, look up role by name
  if (permissions.length === 0 && (role || user?.role)) {
    const roleName = role || user?.role;
    const roleRecord = await prisma.role.findUnique({
      where: { name: roleName },
      include: {
        permissions: {
          select: { permission: true },
        },
      },
    });

    if (roleRecord) {
      permissions = roleRecord.permissions.map(p => p.permission);

      // Auto-link the role to the user for future lookups
      if (user && !user.roleId) {
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: roleRecord.id },
        }).catch(() => {}); // Non-critical, don't fail the request
      }
    }
  }

  // Cache the result
  permissionsCache.set(userId, { permissions, timestamp: Date.now() });

  return permissions;
}

// Helper to invalidate cache when permissions change
export function invalidatePermissionsCache(userId?: string) {
  if (userId) {
    permissionsCache.delete(userId);
  } else {
    permissionsCache.clear();
  }
}

// Check if user has permission (database-driven only)
async function hasPermission(userId: string | undefined, role: string, permission: string): Promise<boolean> {
  const dbPermissions = await getUserPermissions(userId, role);
  return dbPermissions.includes(permission);
}

// Check if user has any of the permissions (database-driven only)
async function hasAnyPermission(userId: string | undefined, role: string, permissions: string[]): Promise<boolean> {
  const dbPermissions = await getUserPermissions(userId, role);
  return permissions.some(p => dbPermissions.includes(p));
}

// Check if user has all permissions (database-driven only)
async function hasAllPermissions(userId: string | undefined, role: string, permissions: string[]): Promise<boolean> {
  const dbPermissions = await getUserPermissions(userId, role);
  return permissions.every(p => dbPermissions.includes(p));
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access denied. Invalid token format.',
      });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token.',
    });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Access denied. User not authenticated.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
      });
      return;
    }

    next();
  };
};

// Alias for authorize that accepts an array of roles
export const authorizeRoles = (allowedRoles: string[]) => {
  return authorize(...allowedRoles);
};

// Permission-based authorization middleware
// Checks if the user's role has the required permission (database-driven)
export const requirePermission = (permission: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Access denied. User not authenticated.',
      });
      return;
    }

    try {
      const allowed = await hasPermission(req.user.userId, req.user.role, permission);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to perform this action.',
          requiredPermission: permission,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Error checking permissions',
      });
    }
  };
};

// Require any of the given permissions
export const requireAnyPermission = (permissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Access denied. User not authenticated.',
      });
      return;
    }

    try {
      const allowed = await hasAnyPermission(req.user.userId, req.user.role, permissions);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to perform this action.',
          requiredPermissions: permissions,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Error checking permissions',
      });
    }
  };
};

// Require all of the given permissions
export const requireAllPermissions = (permissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Access denied. User not authenticated.',
      });
      return;
    }

    try {
      const allowed = await hasAllPermissions(req.user.userId, req.user.role, permissions);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You do not have all required permissions.',
          requiredPermissions: permissions,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Error checking permissions',
      });
    }
  };
};

// Alias for authenticate
export const authenticateToken = authenticate;
