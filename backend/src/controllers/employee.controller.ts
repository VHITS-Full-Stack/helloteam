import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword, generateMagicLinkToken } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';
import { refreshPresignedUrl } from '../services/s3.service';
import { sendEmployeeOnboardingEmail, sendNotificationEmail, sendWelcomeEmail } from '../services/email.service';
import { config } from '../config';
import { logRateChange } from '../utils/rateChangeLogger';

// Helper function to refresh presigned URL (handles both S3 and local URLs)
const refreshUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  return await refreshPresignedUrl(url) || url;
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
      startDate = '',
      endDate = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      const searchTerm = (search as string).trim();
      const searchConditions: any[] = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];

      // Sanitize phone search term by removing non-numeric characters
      const sanitizedSearchTerm = searchTerm.replace(/\D/g, '');
      if (sanitizedSearchTerm) {
        searchConditions.push({ phone: { contains: sanitizedSearchTerm, mode: 'insensitive' } });
      }

      // Full name search: "John Doe" → firstName contains "John" AND lastName contains "Doe"
      const parts = searchTerm.split(/\s+/);
      if (parts.length >= 2) {
        searchConditions.push({
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' } },
          ],
        });
      }
      where.OR = searchConditions;
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

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate as string}T00:00:00.000Z`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate as string}T23:59:59.999Z`);
      }
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
                  timezone: true,
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
          profilePhoto: await refreshUrl(employee.profilePhoto),
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

    // Refresh presigned URLs for profile photo, documents and convert Decimal fields
    const [profilePhoto, governmentIdUrl, governmentId2Url, proofOfAddressUrl] = await Promise.all([
      refreshUrl(employee.profilePhoto),
      refreshUrl(employee.governmentIdUrl),
      refreshUrl(employee.governmentId2Url),
      refreshUrl(employee.proofOfAddressUrl),
    ]);

    const employeeWithFreshUrl = {
      ...employee,
      profilePhoto,
      governmentIdUrl,
      governmentId2Url,
      proofOfAddressUrl,
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
      countryCode,
      phone,
      address,
      hireDate,
      clientId,
      payableRate,
      billingRate,
      overtimeRate,
      deduction,
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
          status: 'INACTIVE',
        },
      });

      // Create employee
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          countryCode: countryCode || '+1',
          phone,
          address,
          hireDate: hireDate ? new Date(hireDate) : null,
          payableRate: payableRate !== undefined && payableRate !== '' ? parseFloat(payableRate) : null,
          billingRate: billingRate !== undefined && billingRate !== '' ? parseFloat(billingRate) : null,
            // Interpreted as overtime multiplier.
            // UI sends 0 when user leaves default, so backend can keep existing 1x fallback behavior.
            overtimeRate: overtimeRate !== undefined && overtimeRate !== '' ? parseFloat(overtimeRate) : 0,
          deduction: deduction !== undefined && deduction !== '' ? parseFloat(deduction) : 0,
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

    // Send onboarding email with credentials and direct onboarding link
    try {
      const onboardingToken = generateMagicLinkToken(result.user.id, 'onboarding');
      const onboardingUrl = `${config.frontendUrl}/employee/onboarding?token=${onboardingToken}`;
      await sendEmployeeOnboardingEmail(email, firstName, onboardingUrl);
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
      countryCode,
      phone,
      address,
      hireDate,
      status,
      payableRate,
      billingRate,
      overtimeRate,
      deduction,
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

    // Capture old rates for change logging
    const oldPayableRate = existingEmployee.payableRate;
    const oldBillingRate = existingEmployee.billingRate;
    const oldOvertimeRate = existingEmployee.overtimeRate;

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
          ...(countryCode !== undefined && { countryCode }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
          ...(hireDate && { hireDate: new Date(hireDate) }),
          ...(payableRate !== undefined && { payableRate: payableRate !== '' ? parseFloat(payableRate) : null }),
          ...(billingRate !== undefined && { billingRate: billingRate !== '' ? parseFloat(billingRate) : null }),
              ...(overtimeRate !== undefined && {
                overtimeRate: overtimeRate !== '' ? parseFloat(overtimeRate) : 0,
              }),
          ...(deduction !== undefined && { deduction: deduction !== '' ? parseFloat(deduction) : 0 }),
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

    // Log rate changes (non-blocking)
    const changedBy = req.user!.userId;
    const changedByName = req.user!.email;
    if (payableRate !== undefined) {
      logRateChange({
        employeeId: id,
        changedBy,
        changedByName,
        rateType: 'PAYABLE_RATE',
        oldValue: oldPayableRate,
        newValue: payableRate !== '' ? parseFloat(payableRate) : null,
        source: 'EMPLOYEE_PROFILE',
      });
    }
    if (billingRate !== undefined) {
      logRateChange({
        employeeId: id,
        changedBy,
        changedByName,
        rateType: 'BILLING_RATE',
        oldValue: oldBillingRate,
        newValue: billingRate !== '' ? parseFloat(billingRate) : null,
        source: 'EMPLOYEE_PROFILE',
      });
    }

    if (overtimeRate !== undefined) {
      logRateChange({
        employeeId: id,
        changedBy,
        changedByName,
        rateType: 'OVERTIME_RATE',
        oldValue: oldOvertimeRate,
        newValue: overtimeRate !== '' ? parseFloat(overtimeRate) : null,
        source: 'EMPLOYEE_PROFILE',
      });
    }

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
        where: { user: { status: 'ACTIVE' }, onboardingStatus: 'COMPLETED' },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      }),
      prisma.employee.count({
        where: {
          OR: [
            { user: { status: 'INACTIVE' } },
            { onboardingStatus: { not: 'COMPLETED' } },
          ],
        },
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

// Helper: compute overall kycStatus from per-document statuses
const computeOverallKycStatus = (employee: {
  governmentIdStatus: string;
  governmentId2Status: string;
  proofOfAddressStatus: string;
}): 'APPROVED' | 'REJECTED' | 'PENDING' => {
  const statuses = [employee.governmentIdStatus, employee.governmentId2Status, employee.proofOfAddressStatus];
  if (statuses.every(s => s === 'APPROVED')) return 'APPROVED';
  if (statuses.some(s => s === 'REJECTED')) return 'REJECTED';
  return 'PENDING';
};

// Review a single KYC document (approve or reject)
export const reviewEmployeeDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { document, action, reason, sendEmail = true } = req.body as {
      document: 'governmentId' | 'governmentId2' | 'proofOfAddress';
      action: 'approve' | 'reject';
      reason?: string;
      sendEmail?: boolean;
    };

    const validDocs = ['governmentId', 'governmentId2', 'proofOfAddress'];
    if (!validDocs.includes(document) || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, error: 'Invalid document or action' });
      return;
    }

    if (action === 'reject' && !reason?.trim()) {
      res.status(400).json({ success: false, error: 'Rejection reason is required' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Build per-document update
    const statusField = `${document}Status` as string;
    const rejectNoteField = `${document}RejectNote` as string;

    const docUpdate: any = {
      [statusField]: action === 'approve' ? 'APPROVED' : 'REJECTED',
      [rejectNoteField]: action === 'reject' ? reason : null,
      kycReviewedAt: new Date(),
      kycReviewerId: req.user?.userId ?? null,
    };

    // Apply the per-document update first
    await prisma.employee.update({ where: { id }, data: docUpdate });

    // Re-fetch to compute overall status with the fresh per-document values
    const refreshed = await prisma.employee.findUnique({ where: { id } });
    if (!refreshed) {
      res.status(500).json({ success: false, error: 'Failed to refresh employee' });
      return;
    }

    // Compute overall status but do NOT auto-set to APPROVED — that requires explicit "Submit Review" (finalizeKycReview)
    const overallStatus = computeOverallKycStatus(refreshed);
    // Only update kycStatus to PENDING or REJECTED automatically; APPROVED must go through finalize
    const effectiveStatus = overallStatus === 'APPROVED' ? 'PENDING' : overallStatus;

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        kycStatus: effectiveStatus,
        kycRejectionNote: effectiveStatus === 'REJECTED'
          ? [
              refreshed.governmentIdStatus === 'REJECTED' ? `Gov ID #1: ${refreshed.governmentIdRejectNote}` : null,
              refreshed.governmentId2Status === 'REJECTED' ? `Gov ID #2: ${refreshed.governmentId2RejectNote}` : null,
              refreshed.proofOfAddressStatus === 'REJECTED' ? `Proof of Address: ${refreshed.proofOfAddressRejectNote}` : null,
            ].filter(Boolean).join('; ')
          : null,
      },
    });

    // Do NOT send approval/rejection emails here — emails are sent only via finalizeKycReview

    res.json({
      success: true,
      message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Review employee document error:', error);
    res.status(500).json({ success: false, error: 'Failed to review document' });
  }
};

// Finalize KYC review - sends appropriate email based on overall status
export const finalizeKycReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Compute the real overall status from per-document statuses
    const overallStatus = computeOverallKycStatus(employee);
    console.log(`[KYC Finalize] Computed overallStatus=${overallStatus}, current kycStatus=${employee.kycStatus}`);
    console.log(`[KYC Finalize] Per-doc: govId=${employee.governmentIdStatus}, govId2=${employee.governmentId2Status}, proof=${employee.proofOfAddressStatus}`);

    // Update the kycStatus in DB now that admin is explicitly finalizing
    await prisma.employee.update({
      where: { id },
      data: {
        kycStatus: overallStatus,
        kycRejectionNote: overallStatus === 'REJECTED'
          ? [
              employee.governmentIdStatus === 'REJECTED' ? `Gov ID #1: ${employee.governmentIdRejectNote}` : null,
              employee.governmentId2Status === 'REJECTED' ? `Gov ID #2: ${employee.governmentId2RejectNote}` : null,
              employee.proofOfAddressStatus === 'REJECTED' ? `Proof of Address: ${employee.proofOfAddressRejectNote}` : null,
            ].filter(Boolean).join('; ')
          : null,
      },
    });

    // Activate or deactivate user based on KYC status
    if (overallStatus === 'APPROVED') {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { status: 'ACTIVE' },
      });
      console.log(`[KYC Finalize] User ${employee.userId} status set to ACTIVE`);
    }

    const email = employee.personalEmail || employee.user?.email;

    if (!email) {
      console.warn('[KYC Finalize] No email found for employee', id);
      res.json({ success: true, message: 'Review finalized (no email to send)' });
      return;
    }

    console.log(`[KYC Finalize] employeeId=${id}, overallStatus=${overallStatus}, email=${email}`);
    console.log(`[KYC Finalize] Per-doc statuses: govId=${employee.governmentIdStatus}, govId2=${employee.governmentId2Status}, proof=${employee.proofOfAddressStatus}`);

    if (overallStatus === 'APPROVED') {
      console.log(`[KYC Finalize] Sending welcome email with credentials to ${email}`);
      const result = await sendWelcomeEmail(
        email,
        employee.firstName,
        'Welcome@123',
      ).catch((err) => { console.error('[KYC Finalize] Failed to send welcome email:', err); return { success: false, error: err?.message || 'Unknown error' }; });
      console.log('[KYC Finalize] Welcome email result:', JSON.stringify(result));
    } else if (overallStatus === 'REJECTED') {
      // Build list of rejected documents
      const rejectedDocs: string[] = [];
      if (employee.governmentIdStatus === 'REJECTED') {
        rejectedDocs.push(`Government ID #1: ${employee.governmentIdRejectNote || 'No reason provided'}`);
      }
      if (employee.governmentId2Status === 'REJECTED') {
        rejectedDocs.push(`Government ID #2: ${employee.governmentId2RejectNote || 'No reason provided'}`);
      }
      if (employee.proofOfAddressStatus === 'REJECTED') {
        rejectedDocs.push(`Proof of Address: ${employee.proofOfAddressRejectNote || 'No reason provided'}`);
      }

      const token = generateMagicLinkToken(employee.userId, 'kyc-reupload');
      const reuploadUrl = `${config.frontendUrl}/employee/onboarding?token=${token}`;
      console.log('[KYC Finalize] Rejection reupload URL:', reuploadUrl);
      const result = await sendNotificationEmail(
        email,
        'KYC Documents Rejected',
        `Some of your identity documents were not approved. Please re-upload the rejected documents.\n\nRejected documents:\n${rejectedDocs.join('\n')}`,
        reuploadUrl,
        'Re-upload Documents',
      ).catch((err) => { console.error('[KYC Finalize] Failed to send rejection email:', err); return null; });
      console.log('[KYC Finalize] Rejection email result:', result);
    } else {
      // PENDING - some documents still need review
      console.log('[KYC Finalize] Status is PENDING, not sending email');
      res.json({ success: true, message: 'Review is still in progress. Please review all documents before submitting.' });
      return;
    }

    res.json({ success: true, message: `KYC review finalized. ${overallStatus === 'APPROVED' ? 'Approval' : 'Rejection'} email sent.` });
  } catch (error) {
    console.error('Finalize KYC review error:', error);
    res.status(500).json({ success: false, error: 'Failed to finalize KYC review' });
  }
};

// Approve all employee KYC documents (admin) - kept for backwards compat
export const approveEmployeeKyc = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        kycStatus: 'APPROVED',
        kycReviewedAt: new Date(),
        kycReviewerId: req.user?.userId ?? null,
        kycRejectionNote: null,
        governmentIdStatus: 'APPROVED',
        governmentIdRejectNote: null,
        governmentId2Status: 'APPROVED',
        governmentId2RejectNote: null,
        proofOfAddressStatus: 'APPROVED',
        proofOfAddressRejectNote: null,
      },
    });

    // Activate the user so they can log in
    await prisma.user.update({
      where: { id: employee.userId },
      data: { status: 'ACTIVE' },
    });

    const email = employee.personalEmail || employee.user?.email;
    if (email) {
      await sendWelcomeEmail(
        email,
        employee.firstName,
        'Welcome@123',
      ).catch((err) => console.error('Failed to send KYC approved welcome email:', err));
    }

    res.json({ success: true, message: 'KYC approved successfully', data: updated });
  } catch (error) {
    console.error('Approve employee KYC error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve KYC' });
  }
};

// Reject all employee KYC documents (admin) - kept for backwards compat
// Resend onboarding email to employee
export const resendOnboardingEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const email = employee.personalEmail || employee.user?.email;
    if (!email) {
      res.status(400).json({ success: false, error: 'No email address found for this employee' });
      return;
    }

    const onboardingToken = generateMagicLinkToken(employee.user.id, 'onboarding');
    const onboardingUrl = `${config.frontendUrl}/employee/onboarding?token=${onboardingToken}`;
    await sendEmployeeOnboardingEmail(email, employee.firstName, onboardingUrl);

    res.json({ success: true, message: 'Onboarding email sent successfully' });
  } catch (error) {
    console.error('Resend onboarding email error:', error);
    res.status(500).json({ success: false, error: 'Failed to send onboarding email' });
  }
};

export const rejectEmployeeKyc = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body as { reason?: string };

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        kycStatus: 'REJECTED',
        kycReviewedAt: new Date(),
        kycReviewerId: req.user?.userId ?? null,
        kycRejectionNote: reason || null,
        governmentIdStatus: 'REJECTED',
        governmentIdRejectNote: reason || null,
        governmentId2Status: 'REJECTED',
        governmentId2RejectNote: reason || null,
        proofOfAddressStatus: 'REJECTED',
        proofOfAddressRejectNote: reason || null,
      },
    });

    const email = employee.personalEmail || employee.user?.email;
    if (email) {
      const token = generateMagicLinkToken(employee.userId, 'kyc-reupload');
      const reuploadUrl = `${config.frontendUrl}/employee/onboarding?token=${token}`;
      const baseMessage = 'One or more of your identity documents were not approved. Please re-upload your documents.';
      const fullMessage = reason ? `${baseMessage}\n\nReviewer note: ${reason}` : baseMessage;
      await sendNotificationEmail(email, 'KYC Verification Required', fullMessage, reuploadUrl, 'Re-upload Documents');
    }

    res.json({ success: true, message: 'KYC rejected and employee notified', data: updated });
  } catch (error) {
    console.error('Reject employee KYC error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject KYC' });
  }
};
