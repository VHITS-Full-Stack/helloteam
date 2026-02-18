import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';
import { sendEmployeeOnboardingEmail } from '../services/email.service';

// Helper function to refresh presigned URL for profile photos
const refreshProfilePhotoUrl = async (photoUrl: string | null | undefined): Promise<string | null> => {
  if (!photoUrl) return null;
  const key = getKeyFromUrl(photoUrl);
  if (!key) return photoUrl;
  const freshUrl = await getPresignedUrl(key);
  return freshUrl || photoUrl;
};

/**
 * Deactivate any existing active client assignments for an employee
 * before assigning to a new client (enforces 1-client-per-employee rule).
 * Uses a Prisma transaction client if provided, otherwise uses the default client.
 */
export const deactivateOtherClientAssignments = async (
  employeeId: string,
  newClientId: string,
  tx?: any
) => {
  const db = tx || prisma;
  await db.clientEmployee.updateMany({
    where: {
      employeeId,
      clientId: { not: newClientId },
      isActive: true,
    },
    data: { isActive: false },
  });
};

// Get all employees with pagination and filters
export const getEmployees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      status = '',
      clientId = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.user = { ...where.user, status: status as string };
    }

    if (clientId) {
      where.clientAssignments = {
        some: {
          clientId: clientId as string,
          isActive: true,
        },
      };
    }

    // Get employees with relations
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
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
          clientAssignments: {
            where: { isActive: true },
            include: {
              client: {
                select: {
                  id: true,
                  companyName: true,
                  contactPerson: true,
                },
              },
            },
          },
          schedules: {
            where: { isActive: true },
          },
          groupAssignments: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                  billingRate: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    // Fetch client-specific group billing rates for each employee's active client + group
    const clientGroupPairs: { clientId: string; groupId: string }[] = [];
    employees.forEach((employee) => {
      const activeClient = employee.clientAssignments?.[0];
      const groupAssignment = employee.groupAssignments?.[0];
      if (activeClient && groupAssignment) {
        clientGroupPairs.push({ clientId: activeClient.clientId, groupId: groupAssignment.groupId });
      }
    });

    const clientGroupRateMap = new Map<string, number | null>();
    if (clientGroupPairs.length > 0) {
      const clientGroupRecords = await prisma.clientGroup.findMany({
        where: {
          OR: clientGroupPairs.map((p) => ({ clientId: p.clientId, groupId: p.groupId })),
        },
        select: { clientId: true, groupId: true, billingRate: true },
      });
      clientGroupRecords.forEach((cg) => {
        clientGroupRateMap.set(`${cg.clientId}-${cg.groupId}`, cg.billingRate ? Number(cg.billingRate) : null);
      });
    }

    // Refresh presigned URLs for profile photos and convert Decimal fields
    const employeesWithFreshUrls = await Promise.all(
      employees.map(async (employee) => {
        const activeClient = employee.clientAssignments?.[0];
        const groupAssignment = employee.groupAssignments?.[0];
        const clientGroupBillingRate = activeClient && groupAssignment
          ? clientGroupRateMap.get(`${activeClient.clientId}-${groupAssignment.groupId}`) ?? null
          : null;

        return {
          ...employee,
          profilePhoto: await refreshProfilePhotoUrl(employee.profilePhoto),
          billingRate: employee.billingRate ? Number(employee.billingRate) : null,
          payableRate: employee.payableRate ? Number(employee.payableRate) : null,
          clientGroupBillingRate,
          groupAssignments: employee.groupAssignments.map((ga) => ({
            ...ga,
            group: {
              ...ga.group,
              billingRate: ga.group.billingRate ? Number(ga.group.billingRate) : null,
            },
          })),
        };
      })
    );

    res.json({
      success: true,
      data: {
        employees: employeesWithFreshUrls,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees',
    });
  }
};

// Get single employee by ID
export const getEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.findUnique({
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
        clientAssignments: {
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                contactPerson: true,
              },
            },
          },
        },
        schedules: {
          where: { isActive: true },
        },
        groupAssignments: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                billingRate: true,
              },
            },
          },
        },
        emergencyContacts: {
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
        workSessions: {
          take: 10,
          orderBy: { startTime: 'desc' },
        },
      },
    });

    if (!employee) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    // Refresh presigned URL for profile photo and convert Decimal fields
    const employeeWithFreshUrl = {
      ...employee,
      profilePhoto: await refreshProfilePhotoUrl(employee.profilePhoto),
      billingRate: employee.billingRate ? Number(employee.billingRate) : null,
      payableRate: employee.payableRate ? Number(employee.payableRate) : null,
      groupAssignments: employee.groupAssignments.map((ga) => ({
        ...ga,
        group: {
          ...ga.group,
          billingRate: ga.group.billingRate ? Number(ga.group.billingRate) : null,
        },
      })),
    };

    res.json({
      success: true,
      data: employeeWithFreshUrl,
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee',
    });
  }
};

// Create new employee
export const createEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      email,
      firstName,
      lastName,
      phone,
      address,
      hireDate,
      clientId,
      payableRate,
      billingRate,
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: 'Email, first name, and last name are required',
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

    // Auto-generate password (same as client creation)
    const password = 'Welcome@123';
    const hashedPassword = await hashPassword(password);

    // Create user and employee in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find the EMPLOYEE dynamic role
      const employeeRole = await tx.role.findUnique({ where: { name: 'EMPLOYEE' } });

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'EMPLOYEE',
          roleId: employeeRole?.id,
          status: 'ACTIVE',
        },
      });

      // Create employee
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone,
          address,
          hireDate: hireDate ? new Date(hireDate) : null,
          payableRate: payableRate !== undefined && payableRate !== '' ? parseFloat(payableRate) : null,
          billingRate: billingRate !== undefined && billingRate !== '' ? parseFloat(billingRate) : null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      });

      // If clientId provided, create assignment
      if (clientId) {
        await tx.clientEmployee.create({
          data: {
            clientId,
            employeeId: employee.id,
            isActive: true,
          },
        });
      }

      return employee;
    });

    // Send onboarding email with credentials
    try {
      await sendEmployeeOnboardingEmail(email, firstName, password);
    } catch (emailError) {
      console.error('Failed to send onboarding email:', emailError);
      // Don't fail the creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create employee',
    });
  }
};

// Update employee
export const updateEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      email,
      firstName,
      lastName,
      phone,
      address,
      hireDate,
      status,
      payableRate,
      billingRate,
    } = req.body;

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    // If email is being changed, check if it's already taken
    if (email && email !== existingEmployee.user.email) {
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
          where: { id: existingEmployee.userId },
          data: {
            ...(email && { email }),
            ...(status && { status }),
          },
        });
      }

      // Update employee
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
          ...(hireDate && { hireDate: new Date(hireDate) }),
          ...(payableRate !== undefined && { payableRate: payableRate !== '' ? parseFloat(payableRate) : null }),
          ...(billingRate !== undefined && { billingRate: billingRate !== '' ? parseFloat(billingRate) : null }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          clientAssignments: {
            where: { isActive: true },
            include: {
              client: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
        },
      });

      return employee;
    });

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update employee',
    });
  }
};

// Delete employee (soft delete by setting status to INACTIVE)
export const deleteEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    // Soft delete by setting user status to INACTIVE
    await prisma.user.update({
      where: { id: employee.userId },
      data: { status: 'INACTIVE' },
    });

    // Deactivate all client assignments
    await prisma.clientEmployee.updateMany({
      where: { employeeId: id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete employee',
    });
  }
};

// Assign employee to client
export const assignToClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { clientId } = req.body;

    if (!clientId) {
      res.status(400).json({
        success: false,
        error: 'Client ID is required',
      });
      return;
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Deactivate any existing assignment to other clients (1-client-per-employee rule)
    await deactivateOtherClientAssignments(id, clientId);

    // Check if assignment already exists for this client
    const existingAssignment = await prisma.clientEmployee.findUnique({
      where: {
        clientId_employeeId: {
          clientId,
          employeeId: id,
        },
      },
    });

    if (existingAssignment) {
      // Reactivate if inactive
      if (!existingAssignment.isActive) {
        await prisma.clientEmployee.update({
          where: { id: existingAssignment.id },
          data: { isActive: true },
        });
      }
    } else {
      // Create new assignment
      await prisma.clientEmployee.create({
        data: {
          clientId,
          employeeId: id,
          isActive: true,
        },
      });
    }

    res.json({
      success: true,
      message: 'Employee assigned to client successfully',
    });
  } catch (error) {
    console.error('Assign to client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign employee to client',
    });
  }
};

// Remove employee from client
export const removeFromClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { clientId } = req.body;

    if (!clientId) {
      res.status(400).json({
        success: false,
        error: 'Client ID is required',
      });
      return;
    }

    await prisma.clientEmployee.updateMany({
      where: {
        employeeId: id,
        clientId,
      },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Employee removed from client successfully',
    });
  } catch (error) {
    console.error('Remove from client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove employee from client',
    });
  }
};

// Get employee statistics
export const getEmployeeStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [total, active, onLeave, inactive] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      }),
      prisma.employee.count({
        where: { user: { status: 'INACTIVE' } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        onLeave,
        inactive,
      },
    });
  } catch (error) {
    console.error('Get employee stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee statistics',
    });
  }
};

// Terminate employee (set INACTIVE + record termination date)
export const terminateEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { terminationDate } = req.body;

    if (!terminationDate) {
      res.status(400).json({
        success: false,
        error: 'Termination date is required',
      });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Set termination date on employee
      await tx.employee.update({
        where: { id },
        data: { terminationDate: new Date(terminationDate) },
      });

      // Set user status to INACTIVE
      await tx.user.update({
        where: { id: employee.userId },
        data: { status: 'INACTIVE' },
      });

      // Deactivate all client assignments
      await tx.clientEmployee.updateMany({
        where: { employeeId: id },
        data: { isActive: false },
      });
    });

    res.json({
      success: true,
      message: 'Employee terminated successfully',
    });
  } catch (error) {
    console.error('Terminate employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to terminate employee',
    });
  }
};

// Reactivate a terminated employee
export const reactivateEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Clear termination date
      await tx.employee.update({
        where: { id },
        data: { terminationDate: null },
      });

      // Set user status back to ACTIVE
      await tx.user.update({
        where: { id: employee.userId },
        data: { status: 'ACTIVE' },
      });
    });

    res.json({
      success: true,
      message: 'Employee reactivated successfully',
    });
  } catch (error) {
    console.error('Reactivate employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate employee',
    });
  }
};
