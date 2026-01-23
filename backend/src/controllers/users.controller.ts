import { Response } from 'express';
import prisma from '../config/database';
import { hashPassword } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';

// Admin user roles that can be managed
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'];

// Get all admin users with pagination and filters
export const getAdminUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      status = '',
      role = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause for admin users
    const where: any = {
      admin: { isNot: null }, // Only users with admin record
    };

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { admin: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { admin: { lastName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status as string;
    }

    if (role) {
      where.role = role as string;
    }

    // Get admin users with relations
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          admin: true,
          dynamicRole: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Format response
    const adminUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.admin?.firstName || '',
      lastName: user.admin?.lastName || '',
      department: user.admin?.department || null,
      role: user.role,
      roleId: user.roleId,
      dynamicRole: user.dynamicRole,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        users: adminUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin users',
    });
  }
};

// Get single admin user by ID
export const getAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        admin: true,
        dynamicRole: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!user || !user.admin) {
      res.status(404).json({
        success: false,
        error: 'Admin user not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.admin.firstName,
        lastName: user.admin.lastName,
        department: user.admin.department,
        role: user.role,
        roleId: user.roleId,
        dynamicRole: user.dynamicRole,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin user',
    });
  }
};

// Create new admin user
export const createAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      department,
      role = 'ADMIN',
      roleId,
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required',
      });
      return;
    }

    // Validate role is an admin role
    if (!ADMIN_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${ADMIN_ROLES.join(', ')}`,
      });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'Email already exists',
      });
      return;
    }

    // If roleId provided, verify it exists
    if (roleId) {
      const dynamicRole = await prisma.role.findUnique({
        where: { id: roleId },
      });
      if (!dynamicRole) {
        res.status(400).json({
          success: false,
          error: 'Invalid role ID',
        });
        return;
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user and admin in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role as any,
          roleId: roleId || null,
          status: 'ACTIVE',
        },
      });

      // Create admin record
      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          department: department || null,
        },
      });

      return { user, admin };
    });

    // Fetch full user with relations
    const fullUser = await prisma.user.findUnique({
      where: { id: result.user.id },
      include: {
        admin: true,
        dynamicRole: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: fullUser!.id,
        email: fullUser!.email,
        firstName: fullUser!.admin!.firstName,
        lastName: fullUser!.admin!.lastName,
        department: fullUser!.admin!.department,
        role: fullUser!.role,
        roleId: fullUser!.roleId,
        dynamicRole: fullUser!.dynamicRole,
        status: fullUser!.status,
        createdAt: fullUser!.createdAt,
      },
    });
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin user',
    });
  }
};

// Update admin user
export const updateAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      email,
      firstName,
      lastName,
      department,
      role,
      roleId,
      status,
      password,
    } = req.body;

    // Check if user exists and is an admin
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { admin: true },
    });

    if (!existingUser || !existingUser.admin) {
      res.status(404).json({
        success: false,
        error: 'Admin user not found',
      });
      return;
    }

    // Validate role if provided
    if (role && !ADMIN_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${ADMIN_ROLES.join(', ')}`,
      });
      return;
    }

    // If email is being changed, check if it's already taken
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        res.status(400).json({
          success: false,
          error: 'Email already exists',
        });
        return;
      }
    }

    // If roleId provided, verify it exists
    if (roleId) {
      const dynamicRole = await prisma.role.findUnique({
        where: { id: roleId },
      });
      if (!dynamicRole) {
        res.status(400).json({
          success: false,
          error: 'Invalid role ID',
        });
        return;
      }
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id },
        data: {
          ...(email && { email }),
          ...(role && { role: role as any }),
          ...(roleId !== undefined && { roleId: roleId || null }),
          ...(status && { status: status as any }),
          ...(hashedPassword && { password: hashedPassword }),
        },
      });

      // Update admin record
      await tx.admin.update({
        where: { userId: id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(department !== undefined && { department: department || null }),
        },
      });
    });

    // Fetch updated user with relations
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: {
        admin: true,
        dynamicRole: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Admin user updated successfully',
      data: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        firstName: updatedUser!.admin!.firstName,
        lastName: updatedUser!.admin!.lastName,
        department: updatedUser!.admin!.department,
        role: updatedUser!.role,
        roleId: updatedUser!.roleId,
        dynamicRole: updatedUser!.dynamicRole,
        status: updatedUser!.status,
        lastLoginAt: updatedUser!.lastLoginAt,
        createdAt: updatedUser!.createdAt,
        updatedAt: updatedUser!.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update admin user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin user',
    });
  }
};

// Delete admin user (soft delete by setting status to INACTIVE)
export const deleteAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const currentUserId = req.user?.userId;

    // Prevent self-deletion
    if (id === currentUserId) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { admin: true },
    });

    if (!user || !user.admin) {
      res.status(404).json({
        success: false,
        error: 'Admin user not found',
      });
      return;
    }

    // Prevent deleting the last super admin
    if (user.role === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });

      if (superAdminCount <= 1) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete the last super admin',
        });
        return;
      }
    }

    // Soft delete by setting user status to INACTIVE
    await prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    res.json({
      success: true,
      message: 'Admin user deleted successfully',
    });
  } catch (error) {
    console.error('Delete admin user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete admin user',
    });
  }
};

// Get admin user statistics
export const getAdminUserStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const baseWhere = { admin: { isNot: null } };

    const [total, active, inactive, byRole] = await Promise.all([
      prisma.user.count({ where: baseWhere }),
      prisma.user.count({
        where: { ...baseWhere, status: 'ACTIVE' },
      }),
      prisma.user.count({
        where: { ...baseWhere, status: 'INACTIVE' },
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: baseWhere,
        _count: { id: true },
      }),
    ]);

    const roleStats = byRole.reduce((acc, item) => {
      acc[item.role] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        byRole: roleStats,
      },
    });
  } catch (error) {
    console.error('Get admin user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin user statistics',
    });
  }
};

// Get available admin roles for dropdown
export const getAdminRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Get dynamic roles from database
    const dynamicRoles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        isSystem: true,
      },
      orderBy: { displayName: 'asc' },
    });

    res.json({
      success: true,
      data: {
        legacyRoles: ADMIN_ROLES.map(role => ({
          value: role,
          label: role.replace('_', ' '),
        })),
        dynamicRoles,
      },
    });
  } catch (error) {
    console.error('Get admin roles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin roles',
    });
  }
};
