import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';

// Helper function to refresh presigned URL for profile photos
const refreshProfilePhotoUrl = async (photoUrl: string | null | undefined): Promise<string | null> => {
  if (!photoUrl) return null;
  const key = getKeyFromUrl(photoUrl);
  if (!key) return photoUrl;
  const freshUrl = await getPresignedUrl(key);
  return freshUrl || photoUrl;
};

// Get all clients with pagination and filters
export const getClients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      status = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search as string, mode: 'insensitive' } },
        { contactPerson: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.user = { ...where.user, status: status as string };
    }

    // Get clients with relations
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          employees: {
            where: { isActive: true },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePhoto: true,
                  user: {
                    select: {
                      status: true,
                    },
                  },
                },
              },
            },
          },
          clientPolicies: true,
          _count: {
            select: {
              employees: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    // Transform data to include employee counts and refresh presigned URLs
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const activeEmployees = client.employees.filter(
          (ce) => ce.employee.user.status === 'ACTIVE'
        ).length;

        // Refresh presigned URLs for employee profile photos
        const employeesWithFreshUrls = await Promise.all(
          client.employees.map(async (ce) => ({
            ...ce,
            employee: {
              ...ce.employee,
              profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
            },
          }))
        );

        // Refresh presigned URL for client logo
        const freshLogoUrl = await refreshProfilePhotoUrl(client.logoUrl);

        return {
          ...client,
          logoUrl: freshLogoUrl,
          employees: employeesWithFreshUrls,
          employeeCount: client._count.employees,
          activeEmployeeCount: activeEmployees,
        };
      })
    );

    res.json({
      success: true,
      data: {
        clients: clientsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
    });
  }
};

// Get single client by ID
export const getClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              include: {
                user: {
                  select: {
                    email: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        clientPolicies: true,
      },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Refresh presigned URLs for employee profile photos
    const employeesWithFreshUrls = await Promise.all(
      client.employees.map(async (ce) => ({
        ...ce,
        employee: {
          ...ce.employee,
          profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
        },
      }))
    );

    // Refresh presigned URL for client logo
    const freshLogoUrl = await refreshProfilePhotoUrl(client.logoUrl);

    const clientWithFreshUrls = {
      ...client,
      logoUrl: freshLogoUrl,
      employees: employeesWithFreshUrls,
    };

    res.json({
      success: true,
      data: clientWithFreshUrls,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client',
    });
  }
};

// Create new client
export const createClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      companyName,
      contactPerson,
      phone,
      address,
      timezone,
      // Policy fields
      allowPaidLeave,
      paidLeaveEntitlementType,
      annualPaidLeaveDays,
      allowUnpaidLeave,
      requireTwoWeeksNotice,
      allowOvertime,
      overtimeRequiresApproval,
    } = req.body;

    // Validate required fields
    if (!email || !password || !companyName || !contactPerson) {
      res.status(400).json({
        success: false,
        error: 'Email, password, company name, and contact person are required',
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

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user, client, and policies in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      });

      // Create client
      const client = await tx.client.create({
        data: {
          userId: user.id,
          companyName,
          contactPerson,
          phone,
          address,
          timezone: timezone || 'UTC',
        },
      });

      // Create client policy
      await tx.clientPolicy.create({
        data: {
          clientId: client.id,
          allowPaidLeave: allowPaidLeave ?? false,
          paidLeaveEntitlementType,
          annualPaidLeaveDays: annualPaidLeaveDays ?? 0,
          allowUnpaidLeave: allowUnpaidLeave ?? true,
          requireTwoWeeksNotice: requireTwoWeeksNotice ?? true,
          allowOvertime: allowOvertime ?? true,
          overtimeRequiresApproval: overtimeRequiresApproval ?? true,
        },
      });

      // Fetch complete client data
      const completeClient = await tx.client.findUnique({
        where: { id: client.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          clientPolicies: true,
        },
      });

      return completeClient;
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
    });
  }
};

// Update client
export const updateClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      email,
      companyName,
      contactPerson,
      phone,
      address,
      timezone,
      status,
      // Policy fields
      allowPaidLeave,
      paidLeaveEntitlementType,
      annualPaidLeaveDays,
      allowUnpaidLeave,
      requireTwoWeeksNotice,
      allowOvertime,
      overtimeRequiresApproval,
    } = req.body;

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id },
      include: { user: true, clientPolicies: true },
    });

    if (!existingClient) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // If email is being changed, check if it's already taken
    if (email && email !== existingClient.user.email) {
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

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if email or status changed
      if (email || status) {
        await tx.user.update({
          where: { id: existingClient.userId },
          data: {
            ...(email && { email }),
            ...(status && { status }),
          },
        });
      }

      // Update client
      const client = await tx.client.update({
        where: { id },
        data: {
          ...(companyName && { companyName }),
          ...(contactPerson && { contactPerson }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
          ...(timezone && { timezone }),
        },
      });

      // Update or create policy
      if (existingClient.clientPolicies) {
        await tx.clientPolicy.update({
          where: { clientId: id },
          data: {
            ...(allowPaidLeave !== undefined && { allowPaidLeave }),
            ...(paidLeaveEntitlementType !== undefined && { paidLeaveEntitlementType }),
            ...(annualPaidLeaveDays !== undefined && { annualPaidLeaveDays }),
            ...(allowUnpaidLeave !== undefined && { allowUnpaidLeave }),
            ...(requireTwoWeeksNotice !== undefined && { requireTwoWeeksNotice }),
            ...(allowOvertime !== undefined && { allowOvertime }),
            ...(overtimeRequiresApproval !== undefined && { overtimeRequiresApproval }),
          },
        });
      } else {
        await tx.clientPolicy.create({
          data: {
            clientId: id,
            allowPaidLeave: allowPaidLeave ?? false,
            paidLeaveEntitlementType,
            annualPaidLeaveDays: annualPaidLeaveDays ?? 0,
            allowUnpaidLeave: allowUnpaidLeave ?? true,
            requireTwoWeeksNotice: requireTwoWeeksNotice ?? true,
            allowOvertime: allowOvertime ?? true,
            overtimeRequiresApproval: overtimeRequiresApproval ?? true,
          },
        });
      }

      // Fetch complete client data
      const completeClient = await tx.client.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          clientPolicies: true,
          _count: {
            select: {
              employees: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      return completeClient;
    });

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client',
    });
  }
};

// Delete client (soft delete by setting status to INACTIVE)
export const deleteClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Soft delete by setting user status to INACTIVE
    await prisma.user.update({
      where: { id: client.userId },
      data: { status: 'INACTIVE' },
    });

    // Deactivate all employee assignments
    await prisma.clientEmployee.updateMany({
      where: { clientId: id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client',
    });
  }
};

// Get client's employees
export const getClientEmployees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employees = await prisma.clientEmployee.findMany({
      where: {
        clientId: id,
        isActive: true,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                email: true,
                status: true,
              },
            },
            schedules: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    // Refresh presigned URLs for employee profile photos
    const employeesWithFreshUrls = await Promise.all(
      employees.map(async (ce) => ({
        ...ce.employee,
        profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
      }))
    );

    res.json({
      success: true,
      data: employeesWithFreshUrls,
    });
  } catch (error) {
    console.error('Get client employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client employees',
    });
  }
};

// Assign multiple employees to client
export const assignEmployees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Employee IDs array is required',
      });
      return;
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Create or update assignments
    for (const employeeId of employeeIds) {
      const existingAssignment = await prisma.clientEmployee.findUnique({
        where: {
          clientId_employeeId: {
            clientId: id,
            employeeId,
          },
        },
      });

      if (existingAssignment) {
        if (!existingAssignment.isActive) {
          await prisma.clientEmployee.update({
            where: { id: existingAssignment.id },
            data: { isActive: true },
          });
        }
      } else {
        await prisma.clientEmployee.create({
          data: {
            clientId: id,
            employeeId,
            isActive: true,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Employees assigned successfully',
    });
  } catch (error) {
    console.error('Assign employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign employees',
    });
  }
};

// Remove employee from client
export const removeEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const employeeId = req.params.employeeId as string;

    await prisma.clientEmployee.updateMany({
      where: {
        clientId: id,
        employeeId,
      },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Employee removed from client successfully',
    });
  } catch (error) {
    console.error('Remove employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove employee',
    });
  }
};

// Get client statistics
export const getClientStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [total, active, totalEmployees, activeEmployees] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      prisma.clientEmployee.count({
        where: { isActive: true },
      }),
      prisma.clientEmployee.count({
        where: {
          isActive: true,
          employee: { user: { status: 'ACTIVE' } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalClients: total,
        activeClients: active,
        totalAssignedEmployees: totalEmployees,
        activeAssignedEmployees: activeEmployees,
      },
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client statistics',
    });
  }
};
