import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ALL_PERMISSIONS, PERMISSION_CATEGORIES } from '../config/permissions';

const prisma = new PrismaClient();

// Get all roles with their permissions
export const getRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      where: { isActive: true },
      include: {
        permissions: {
          select: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map(p => p.permission),
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    res.json({
      success: true,
      data: formattedRoles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles',
    });
  }
};

// Get a single role by ID
export const getRoleById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          select: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      res.status(404).json({
        success: false,
        error: 'Role not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions: role.permissions.map(p => p.permission),
        userCount: role._count.users,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role',
    });
  }
};

// Create a new role
export const createRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, displayName, description, permissions = [] } = req.body;

    // Validate required fields
    if (!name || !displayName) {
      res.status(400).json({
        success: false,
        error: 'Name and display name are required',
      });
      return;
    }

    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: name.toUpperCase().replace(/\s+/g, '_') },
    });

    if (existingRole) {
      res.status(400).json({
        success: false,
        error: 'A role with this name already exists',
      });
      return;
    }

    // Validate permissions
    const invalidPermissions = permissions.filter((p: string) => !ALL_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid permissions: ${invalidPermissions.join(', ')}`,
      });
      return;
    }

    // Create role with permissions
    const role = await prisma.role.create({
      data: {
        name: name.toUpperCase().replace(/\s+/g, '_'),
        displayName,
        description,
        isSystem: false,
        isActive: true,
        permissions: {
          create: permissions.map((permission: string) => ({ permission })),
        },
      },
      include: {
        permissions: {
          select: {
            permission: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions: role.permissions.map(p => p.permission),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create role',
    });
  }
};

// Update a role
export const updateRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { displayName, description, permissions, isActive } = req.body;

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      res.status(404).json({
        success: false,
        error: 'Role not found',
      });
      return;
    }

    // Cannot modify system role name
    if (existingRole.isSystem && req.body.name && req.body.name !== existingRole.name) {
      res.status(400).json({
        success: false,
        error: 'Cannot change the name of a system role',
      });
      return;
    }

    // Validate permissions if provided
    if (permissions) {
      const invalidPermissions = permissions.filter((p: string) => !ALL_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid permissions: ${invalidPermissions.join(', ')}`,
        });
        return;
      }
    }

    // Update role
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Start transaction for updating role and permissions
    const role = await prisma.$transaction(async (tx) => {
      // Update role basic info
      const updatedRole = await tx.role.update({
        where: { id },
        data: updateData,
      });

      // If permissions are provided, update them
      if (permissions) {
        // Delete existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        // Create new permissions
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((permission: string) => ({
              roleId: id,
              permission,
            })),
          });
        }
      }

      // Fetch updated role with permissions
      return tx.role.findUnique({
        where: { id },
        include: {
          permissions: {
            select: {
              permission: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      });
    });

    res.json({
      success: true,
      data: {
        id: role!.id,
        name: role!.name,
        displayName: role!.displayName,
        description: role!.description,
        isSystem: role!.isSystem,
        isActive: role!.isActive,
        permissions: role!.permissions.map(p => p.permission),
        userCount: role!._count.users,
        createdAt: role!.createdAt,
        updatedAt: role!.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update role',
    });
  }
};

// Delete a role
export const deleteRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existingRole) {
      res.status(404).json({
        success: false,
        error: 'Role not found',
      });
      return;
    }

    // Cannot delete system roles
    if (existingRole.isSystem) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete system roles',
      });
      return;
    }

    // Cannot delete roles that have users assigned
    if (existingRole._count.users > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete role. ${existingRole._count.users} user(s) are assigned to this role.`,
      });
      return;
    }

    // Delete role (cascade will delete permissions)
    await prisma.role.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete role',
    });
  }
};

// Get all available permissions
export const getAvailablePermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        permissions: ALL_PERMISSIONS,
        categories: PERMISSION_CATEGORIES,
      },
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions',
    });
  }
};

// Get permissions for a specific user (from their role)
export const getUserPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        dynamicRole: {
          include: {
            permissions: {
              select: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const permissions = user.dynamicRole?.permissions.map(p => p.permission) || [];

    res.json({
      success: true,
      data: {
        role: user.dynamicRole?.name || user.role,
        permissions,
      },
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user permissions',
    });
  }
};

// Assign role to user
export const assignRoleToUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      res.status(400).json({
        success: false,
        error: 'User ID and Role ID are required',
      });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      res.status(404).json({
        success: false,
        error: 'Role not found',
      });
      return;
    }

    // Update user's role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        roleId,
        role: role.name as any, // Also update legacy role enum for backward compatibility
      },
      include: {
        dynamicRole: {
          include: {
            permissions: {
              select: {
                permission: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.dynamicRole?.displayName,
        permissions: updatedUser.dynamicRole?.permissions.map(p => p.permission) || [],
      },
    });
  } catch (error) {
    console.error('Error assigning role to user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign role to user',
    });
  }
};
