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
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    // Refresh presigned URLs for profile photos
    const employeesWithFreshUrls = await Promise.all(
      employees.map(async (employee) => ({
        ...employee,
        profilePhoto: await refreshProfilePhotoUrl(employee.profilePhoto),
      }))
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
              },
            },
          },
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

    // Refresh presigned URL for profile photo
    const employeeWithFreshUrl = {
      ...employee,
      profilePhoto: await refreshProfilePhotoUrl(employee.profilePhoto),
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
      password,
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
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required',
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

    // Check if assignment already exists
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
