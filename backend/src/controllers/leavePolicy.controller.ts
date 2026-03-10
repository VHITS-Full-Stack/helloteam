import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { PaidLeaveEntitlementType, Prisma } from '@prisma/client';
import { resolveEffectivePtoConfig } from '../utils/ptoResolver';
import { calculateCurrentBlock, calculateLeaveDays } from '../utils/ptoHalfYearlyCalculator';

// ============================================
// LEAVE POLICY CONFIGURATION
// ============================================

// Get all clients with their leave policies
export const getClientsWithPolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.companyName = { contains: search, mode: 'insensitive' };
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          clientPolicies: true,
          _count: {
            select: {
              employees: { where: { isActive: true } },
            },
          },
        },
        orderBy: { companyName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    const formattedClients = clients.map(client => ({
      id: client.id,
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      employeeCount: client._count.employees,
      hasPolicy: !!client.clientPolicies,
      policy: client.clientPolicies ? {
        id: client.clientPolicies.id,
        allowPaidLeave: client.clientPolicies.allowPaidLeave,
        paidLeaveEntitlementType: client.clientPolicies.paidLeaveEntitlementType,
        annualPaidLeaveDays: client.clientPolicies.annualPaidLeaveDays,
        accrualRatePerMonth: client.clientPolicies.accrualRatePerMonth ? Number(client.clientPolicies.accrualRatePerMonth) : null,
        milestoneYearsRequired: client.clientPolicies.milestoneYearsRequired,
        milestoneBonusDays: client.clientPolicies.milestoneBonusDays,
        maxCarryoverDays: client.clientPolicies.maxCarryoverDays,
        carryoverExpiryMonths: client.clientPolicies.carryoverExpiryMonths,
        allowUnpaidLeave: client.clientPolicies.allowUnpaidLeave,
        requireTwoWeeksNotice: client.clientPolicies.requireTwoWeeksNotice,
        allowOvertime: client.clientPolicies.allowOvertime,
        overtimeRequiresApproval: client.clientPolicies.overtimeRequiresApproval,
        overtimeThreshold: client.clientPolicies.overtimeThreshold,
      } : null,
    }));

    res.json({
      success: true,
      data: {
        clients: formattedClients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get clients with policies error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
};

// Get single client policy details
export const getClientPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clientId = req.params.clientId as string;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        clientPolicies: true,
        _count: {
          select: {
            employees: { where: { isActive: true } },
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: client.id,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        employeeCount: client._count.employees,
        policy: client.clientPolicies ? {
          id: client.clientPolicies.id,
          // Leave settings
          allowPaidLeave: client.clientPolicies.allowPaidLeave,
          paidLeaveEntitlementType: client.clientPolicies.paidLeaveEntitlementType,
          annualPaidLeaveDays: client.clientPolicies.annualPaidLeaveDays,
          accrualRatePerMonth: client.clientPolicies.accrualRatePerMonth ? Number(client.clientPolicies.accrualRatePerMonth) : null,
          milestoneYearsRequired: client.clientPolicies.milestoneYearsRequired,
          milestoneBonusDays: client.clientPolicies.milestoneBonusDays,
          maxCarryoverDays: client.clientPolicies.maxCarryoverDays,
          carryoverExpiryMonths: client.clientPolicies.carryoverExpiryMonths,
          allowUnpaidLeave: client.clientPolicies.allowUnpaidLeave,
          requireTwoWeeksNotice: client.clientPolicies.requireTwoWeeksNotice,
          // Overtime settings
          allowOvertime: client.clientPolicies.allowOvertime,
          overtimeRequiresApproval: client.clientPolicies.overtimeRequiresApproval,
          overtimeThreshold: client.clientPolicies.overtimeThreshold,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get client policy error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch client policy' });
  }
};

// Update client leave policy
export const updateClientPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clientId = req.params.clientId as string;
    const {
      allowPaidLeave,
      paidLeaveEntitlementType,
      annualPaidLeaveDays,
      accrualRatePerMonth,
      milestoneYearsRequired,
      milestoneBonusDays,
      maxCarryoverDays,
      carryoverExpiryMonths,
      allowUnpaidLeave,
      requireTwoWeeksNotice,
      allowPaidHolidays,
      paidHolidayType,
      numberOfPaidHolidays,
      allowUnpaidHolidays,
      unpaidHolidayType,
      numberOfUnpaidHolidays,
      allowOvertime,
      overtimeRequiresApproval,
      overtimeThreshold,
    } = req.body;

    // Check client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { clientPolicies: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Build update data
    const policyData: any = {};

    if (allowPaidLeave !== undefined) policyData.allowPaidLeave = allowPaidLeave;
    if (paidLeaveEntitlementType !== undefined) {
      policyData.paidLeaveEntitlementType = paidLeaveEntitlementType as PaidLeaveEntitlementType;
    }
    if (annualPaidLeaveDays !== undefined) policyData.annualPaidLeaveDays = parseInt(annualPaidLeaveDays, 10) || 0;
    if (accrualRatePerMonth !== undefined) {
      policyData.accrualRatePerMonth = accrualRatePerMonth ? new Prisma.Decimal(accrualRatePerMonth) : null;
    }
    if (milestoneYearsRequired !== undefined) policyData.milestoneYearsRequired = milestoneYearsRequired !== null ? parseInt(milestoneYearsRequired, 10) : null;
    if (milestoneBonusDays !== undefined) policyData.milestoneBonusDays = milestoneBonusDays !== null ? parseInt(milestoneBonusDays, 10) : null;
    if (maxCarryoverDays !== undefined) policyData.maxCarryoverDays = parseInt(maxCarryoverDays, 10) || 0;
    if (carryoverExpiryMonths !== undefined) policyData.carryoverExpiryMonths = carryoverExpiryMonths !== null ? parseInt(carryoverExpiryMonths, 10) : null;
    if (allowUnpaidLeave !== undefined) policyData.allowUnpaidLeave = allowUnpaidLeave;
    if (requireTwoWeeksNotice !== undefined) policyData.requireTwoWeeksNotice = requireTwoWeeksNotice;
    if (allowPaidHolidays !== undefined) policyData.allowPaidHolidays = allowPaidHolidays;
    if (paidHolidayType !== undefined) policyData.paidHolidayType = paidHolidayType;
    if (numberOfPaidHolidays !== undefined) policyData.numberOfPaidHolidays = parseInt(numberOfPaidHolidays, 10) || 0;
    if (allowUnpaidHolidays !== undefined) policyData.allowUnpaidHolidays = allowUnpaidHolidays;
    if (unpaidHolidayType !== undefined) policyData.unpaidHolidayType = unpaidHolidayType;
    if (numberOfUnpaidHolidays !== undefined) policyData.numberOfUnpaidHolidays = parseInt(numberOfUnpaidHolidays, 10) || 0;
    if (allowOvertime !== undefined) policyData.allowOvertime = allowOvertime;
    if (overtimeRequiresApproval !== undefined) policyData.overtimeRequiresApproval = overtimeRequiresApproval;
    if (overtimeThreshold !== undefined) policyData.overtimeThreshold = parseInt(overtimeThreshold, 10) || 40;

    let policy;
    if (client.clientPolicies) {
      // Update existing policy
      policy = await prisma.clientPolicy.update({
        where: { clientId },
        data: policyData,
      });
    } else {
      // Create new policy
      policy = await prisma.clientPolicy.create({
        data: {
          clientId,
          ...policyData,
        },
      });
    }

    // When holiday config changes at client level, reset all employee holiday
    // overrides to null so they inherit the updated client policy.
    // Per-employee overrides can be re-set from PTO config if needed.
    if (allowPaidHolidays !== undefined || allowUnpaidHolidays !== undefined) {
      const holidayReset: any = {};
      if (allowPaidHolidays !== undefined) holidayReset.ptoAllowPaidHolidays = null;
      if (allowUnpaidHolidays !== undefined) holidayReset.ptoAllowUnpaidHolidays = null;

      await prisma.clientEmployee.updateMany({
        where: { clientId, isActive: true },
        data: holidayReset,
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'ClientPolicy',
        entityId: policy.id,
        description: `Updated leave policy for client ${client.companyName}`,
        oldValues: client.clientPolicies as any,
        newValues: policy as any,
      },
    });

    res.json({
      success: true,
      message: 'Policy updated successfully',
      data: policy,
    });
  } catch (error) {
    console.error('Update client policy error:', error);
    res.status(500).json({ success: false, error: 'Failed to update policy' });
  }
};

// ============================================
// LEAVE BALANCE MANAGEMENT
// ============================================

// Get employees with leave balances for a client
export const getEmployeeBalances = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const search = req.query.search as string | undefined;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    // Build where clause for employees
    const employeeWhere: any = {};
    if (search) {
      employeeWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get client assignments with filter
    const clientAssignmentWhere: any = { isActive: true };
    if (clientId && clientId !== 'all') {
      clientAssignmentWhere.clientId = clientId;
    }

    const employees = await prisma.employee.findMany({
      where: {
        ...employeeWhere,
        clientAssignments: {
          some: clientAssignmentWhere,
        },
      },
      include: {
        clientAssignments: {
          where: clientAssignmentWhere,
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                clientPolicies: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take: limit,
    });

    const total = await prisma.employee.count({
      where: {
        ...employeeWhere,
        clientAssignments: {
          some: clientAssignmentWhere,
        },
      },
    });

    // Get balances for each employee
    const employeesWithBalances = await Promise.all(
      employees.map(async (emp) => {
        const assignment = emp.clientAssignments[0];
        if (!assignment) return null;

        // Get or create balance
        let balance = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_clientId_year: {
              employeeId: emp.id,
              clientId: assignment.clientId,
              year,
            },
          },
        });

        // If no balance exists, create one based on effective PTO config (employee override → client policy)
        if (!balance) {
          const policy = assignment.client.clientPolicies;
          const effectivePto = resolveEffectivePtoConfig(policy, assignment);
          const initialEntitlement = effectivePto.allowPaidLeave ? effectivePto.annualPaidLeaveDays : 0;

          balance = await prisma.leaveBalance.create({
            data: {
              employeeId: emp.id,
              clientId: assignment.clientId,
              year,
              paidLeaveEntitled: initialEntitlement,
            },
          });
        }

        const policy = assignment.client.clientPolicies;
        const effectivePto = resolveEffectivePtoConfig(policy, assignment);

        let entitled = Number(balance.paidLeaveEntitled);
        let carryover = Number(balance.paidLeaveCarryover);
        let used = Number(balance.paidLeaveUsed);
        let pending = Number(balance.paidLeavePending);

        // For FIXED_HALF_YEARLY: dynamically compute from hire date
        if (effectivePto.paidLeaveEntitlementType === 'FIXED_HALF_YEARLY' && emp.hireDate) {
          const now = new Date();
          const block = calculateCurrentBlock(emp.hireDate, now, effectivePto.annualPaidLeaveDays);
          entitled = block.entitledDays;
          carryover = 0;

          const blockRequests = await prisma.leaveRequest.findMany({
            where: {
              employeeId: emp.id,
              clientId: assignment.clientId,
              leaveType: 'PAID',
              startDate: { gte: block.blockStart },
              endDate: { lt: block.blockEnd },
            },
            select: { startDate: true, endDate: true, status: true },
          });
          used = blockRequests
            .filter(r => r.status === 'APPROVED')
            .reduce((sum, r) => sum + calculateLeaveDays(new Date(r.startDate), new Date(r.endDate)), 0);
          pending = blockRequests
            .filter(r => r.status === 'PENDING' || r.status === 'APPROVED_BY_CLIENT')
            .reduce((sum, r) => sum + calculateLeaveDays(new Date(r.startDate), new Date(r.endDate)), 0);
        }

        const paidLeaveAvailable = Math.max(0, entitled + carryover - used - pending);

        return {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          profilePhoto: emp.profilePhoto,
          clientId: assignment.clientId,
          clientName: assignment.client.companyName,
          year,
          balance: {
            entitled,
            carryover,
            used,
            pending,
            available: paidLeaveAvailable,
            accrued: Number(balance.accruedToDate),
            unpaidTaken: Number(balance.unpaidLeaveTaken),
          },
        };
      })
    );

    const filteredEmployees = employeesWithBalances.filter(e => e !== null);

    res.json({
      success: true,
      data: {
        employees: filteredEmployees,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get employee balances error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee balances' });
  }
};

// Get single employee balance details
export const getEmployeeBalanceDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId as string;
    const clientId = req.query.clientId as string;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    if (!clientId) {
      res.status(400).json({ success: false, error: 'Client ID is required' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        clientAssignments: {
          where: { clientId, isActive: true },
          include: {
            client: {
              select: {
                companyName: true,
                clientPolicies: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const assignment = employee.clientAssignments[0];
    if (!assignment) {
      res.status(400).json({ success: false, error: 'Employee not assigned to this client' });
      return;
    }

    // Get balance
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_clientId_year: {
          employeeId,
          clientId,
          year,
        },
      },
    });

    if (!balance) {
      const policy = assignment.client.clientPolicies;
      const effectivePto = resolveEffectivePtoConfig(policy, assignment);
      const initialEntitlement = effectivePto.allowPaidLeave ? effectivePto.annualPaidLeaveDays : 0;

      balance = await prisma.leaveBalance.create({
        data: {
          employeeId,
          clientId,
          year,
          paidLeaveEntitled: initialEntitlement,
        },
      });
    }

    // Get adjustment history
    const adjustments = await prisma.leaveBalanceAdjustment.findMany({
      where: {
        employeeId,
        clientId,
        year,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get leave request history for this year
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        clientId,
        startDate: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Resolve effective PTO config for display
    const effectivePto = resolveEffectivePtoConfig(assignment.client.clientPolicies, assignment);

    let entitled = Number(balance.paidLeaveEntitled);
    let carryover = Number(balance.paidLeaveCarryover);
    let used = Number(balance.paidLeaveUsed);
    let pending = Number(balance.paidLeavePending);
    let blockStart: Date | undefined;
    let blockEnd: Date | undefined;

    // For FIXED_HALF_YEARLY: dynamically compute from hire date
    if (effectivePto.paidLeaveEntitlementType === 'FIXED_HALF_YEARLY' && employee.hireDate) {
      const now = new Date();
      const block = calculateCurrentBlock(employee.hireDate, now, effectivePto.annualPaidLeaveDays);
      entitled = block.entitledDays;
      carryover = 0;
      blockStart = block.blockStart;
      blockEnd = block.blockEnd;

      const blockRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          clientId,
          leaveType: 'PAID',
          startDate: { gte: block.blockStart },
          endDate: { lt: block.blockEnd },
        },
        select: { startDate: true, endDate: true, status: true },
      });
      used = blockRequests
        .filter(r => r.status === 'APPROVED')
        .reduce((sum, r) => sum + calculateLeaveDays(new Date(r.startDate), new Date(r.endDate)), 0);
      pending = blockRequests
        .filter(r => r.status === 'PENDING' || r.status === 'APPROVED_BY_CLIENT')
        .reduce((sum, r) => sum + calculateLeaveDays(new Date(r.startDate), new Date(r.endDate)), 0);
    }

    const paidLeaveAvailable = Math.max(0, entitled + carryover - used - pending);

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          profilePhoto: employee.profilePhoto,
          hireDate: employee.hireDate,
        },
        client: {
          id: clientId,
          name: assignment.client.companyName,
        },
        year,
        balance: {
          entitled,
          carryover,
          used,
          pending,
          available: paidLeaveAvailable,
          accrued: Number(balance.accruedToDate),
          lastAccrualDate: balance.lastAccrualDate,
          unpaidTaken: Number(balance.unpaidLeaveTaken),
          unpaidPending: Number(balance.unpaidLeavePending),
          ...(blockStart ? { blockStart, blockEnd } : {}),
        },
        policy: assignment.client.clientPolicies,
        effectivePto,
        adjustments,
        leaveRequests: leaveRequests.map(lr => ({
          id: lr.id,
          type: lr.leaveType,
          startDate: lr.startDate,
          endDate: lr.endDate,
          status: lr.status,
          reason: lr.reason,
          createdAt: lr.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get employee balance details error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee balance details' });
  }
};

// Manually adjust employee leave balance
export const adjustEmployeeBalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId as string;
    const { clientId, year, adjustmentType, days, reason } = req.body;
    const adminId = req.user!.userId;

    // Validate input
    if (!clientId || !year || !adjustmentType || days === undefined || !reason) {
      res.status(400).json({
        success: false,
        error: 'Client ID, year, adjustment type, days, and reason are required',
      });
      return;
    }

    if (!['ADD', 'DEDUCT', 'CARRYOVER', 'RESET'].includes(adjustmentType)) {
      res.status(400).json({
        success: false,
        error: 'Invalid adjustment type. Must be ADD, DEDUCT, CARRYOVER, or RESET',
      });
      return;
    }

    if (reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: 'Reason must be at least 10 characters',
      });
      return;
    }

    // Get employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Get admin name
    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { firstName: true, lastName: true },
    });
    const adminName = admin ? `${admin.firstName} ${admin.lastName}` : 'Admin';

    // Get or create balance
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_clientId_year: {
          employeeId,
          clientId,
          year: parseInt(year, 10),
        },
      },
    });

    if (!balance) {
      balance = await prisma.leaveBalance.create({
        data: {
          employeeId,
          clientId,
          year: parseInt(year, 10),
          paidLeaveEntitled: 0,
        },
      });
    }

    // Calculate new values based on adjustment type
    const daysNum = parseFloat(days);
    let updateData: any = {};

    switch (adjustmentType) {
      case 'ADD':
        updateData = {
          paidLeaveEntitled: { increment: daysNum },
        };
        break;
      case 'DEDUCT':
        updateData = {
          paidLeaveEntitled: { decrement: daysNum },
        };
        break;
      case 'CARRYOVER':
        updateData = {
          paidLeaveCarryover: { increment: daysNum },
        };
        break;
      case 'RESET':
        updateData = {
          paidLeaveEntitled: daysNum,
          paidLeaveUsed: 0,
          paidLeavePending: 0,
          paidLeaveCarryover: 0,
        };
        break;
    }

    // Update balance
    const updatedBalance = await prisma.leaveBalance.update({
      where: {
        employeeId_clientId_year: {
          employeeId,
          clientId,
          year: parseInt(year, 10),
        },
      },
      data: updateData,
    });

    // Create adjustment record
    await prisma.leaveBalanceAdjustment.create({
      data: {
        employeeId,
        clientId,
        year: parseInt(year, 10),
        adjustmentType,
        days: daysNum,
        reason: reason.trim(),
        adjustedBy: adminId,
        adjustedByName: adminName,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADJUSTMENT',
        entityType: 'LeaveBalance',
        entityId: balance.id,
        description: `${adjustmentType} ${daysNum} days for ${employee.firstName} ${employee.lastName}`,
        oldValues: balance as any,
        newValues: updatedBalance as any,
        metadata: { reason, adjustmentType, days: daysNum },
      },
    });

    res.json({
      success: true,
      message: 'Balance adjusted successfully',
      data: {
        balance: {
          entitled: Number(updatedBalance.paidLeaveEntitled),
          carryover: Number(updatedBalance.paidLeaveCarryover),
          used: Number(updatedBalance.paidLeaveUsed),
          pending: Number(updatedBalance.paidLeavePending),
          available: Number(updatedBalance.paidLeaveEntitled) +
            Number(updatedBalance.paidLeaveCarryover) -
            Number(updatedBalance.paidLeaveUsed) -
            Number(updatedBalance.paidLeavePending),
        },
      },
    });
  } catch (error) {
    console.error('Adjust employee balance error:', error);
    res.status(500).json({ success: false, error: 'Failed to adjust balance' });
  }
};

// Get adjustment history
export const getAdjustmentHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (clientId && clientId !== 'all') where.clientId = clientId;
    if (employeeId) where.employeeId = employeeId;
    if (year) where.year = year;

    const [adjustments, total] = await Promise.all([
      prisma.leaveBalanceAdjustment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.leaveBalanceAdjustment.count({ where }),
    ]);

    // Get employee names
    const employeeIds = [...new Set(adjustments.map(a => a.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const employeeMap = new Map(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

    // Get client names
    const clientIds = [...new Set(adjustments.map(a => a.clientId))];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, companyName: true },
    });
    const clientMap = new Map(clients.map(c => [c.id, c.companyName]));

    const formattedAdjustments = adjustments.map(adj => ({
      id: adj.id,
      employeeId: adj.employeeId,
      employeeName: employeeMap.get(adj.employeeId) || 'Unknown',
      clientId: adj.clientId,
      clientName: clientMap.get(adj.clientId) || 'Unknown',
      year: adj.year,
      adjustmentType: adj.adjustmentType,
      days: Number(adj.days),
      reason: adj.reason,
      adjustedBy: adj.adjustedByName || adj.adjustedBy,
      createdAt: adj.createdAt,
    }));

    res.json({
      success: true,
      data: {
        adjustments: formattedAdjustments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get adjustment history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch adjustment history' });
  }
};

// ============================================
// ACCRUAL CALCULATION
// ============================================

// Run accrual calculation for all employees (can be triggered manually or via scheduled job)
// Now supports per-employee PTO overrides — iterates all active assignments and resolves effective config
export const runAccrualCalculation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Get all active client-employee assignments with their client policies
    const activeAssignments = await prisma.clientEmployee.findMany({
      where: { isActive: true },
      include: {
        employee: true,
        client: {
          include: { clientPolicies: true },
        },
      },
    });

    let processedCount = 0;
    let updatedCount = 0;

    for (const assignment of activeAssignments) {
      // Resolve effective PTO config (employee override → client policy)
      const effectivePto = resolveEffectivePtoConfig(assignment.client.clientPolicies, assignment);

      // Skip if not ACCRUED type or paid leave not allowed
      if (!effectivePto.allowPaidLeave) continue;
      if (effectivePto.paidLeaveEntitlementType !== 'ACCRUED') continue;
      if (!effectivePto.accrualRatePerMonth) continue;

      processedCount++;
      const emp = assignment.employee;
      const accrualRate = effectivePto.accrualRatePerMonth;

      // Get or create balance
      let balance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_clientId_year: {
            employeeId: emp.id,
            clientId: assignment.clientId,
            year: currentYear,
          },
        },
      });

      if (!balance) {
        balance = await prisma.leaveBalance.create({
          data: {
            employeeId: emp.id,
            clientId: assignment.clientId,
            year: currentYear,
            paidLeaveEntitled: 0,
          },
        });
      }

      // Check if accrual already run this month
      const lastAccrual = balance.lastAccrualDate;
      if (lastAccrual) {
        const lastMonth = lastAccrual.getMonth();
        const lastYear = lastAccrual.getFullYear();
        if (lastMonth === currentMonth && lastYear === currentYear) {
          continue; // Already accrued this month
        }
      }

      // Calculate accrual
      const newAccrued = Number(balance.accruedToDate) + accrualRate;
      const newEntitled = Number(balance.paidLeaveEntitled) + accrualRate;

      // Update balance
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: emp.id,
            clientId: assignment.clientId,
            year: currentYear,
          },
        },
        data: {
          accruedToDate: newAccrued,
          paidLeaveEntitled: newEntitled,
          lastAccrualDate: new Date(),
        },
      });

      // Create adjustment record
      await prisma.leaveBalanceAdjustment.create({
        data: {
          employeeId: emp.id,
          clientId: assignment.clientId,
          year: currentYear,
          adjustmentType: 'ACCRUAL',
          days: accrualRate,
          reason: `Monthly accrual for ${new Date().toLocaleString('default', { month: 'long' })} ${currentYear}`,
          adjustedBy: req.user!.userId,
          adjustedByName: 'System',
        },
      });

      updatedCount++;
    }

    res.json({
      success: true,
      message: `Accrual calculation complete. Processed: ${processedCount}, Updated: ${updatedCount}`,
      data: {
        processed: processedCount,
        updated: updatedCount,
      },
    });
  } catch (error) {
    console.error('Run accrual calculation error:', error);
    res.status(500).json({ success: false, error: 'Failed to run accrual calculation' });
  }
};

// ============================================
// ADMIN LEAVE APPROVAL QUEUE
// ============================================

// Get all pending leave requests across all clients
export const getAllPendingLeaveRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string || 'all';
    const clientId = req.query.clientId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by status
    if (status === 'pending') {
      where.status = 'PENDING';
    } else if (status === 'client-approved') {
      where.status = 'APPROVED_BY_CLIENT';
    } else if (status === 'approved') {
      where.status = 'APPROVED';
    } else if (status === 'rejected') {
      where.status = 'REJECTED';
    }

    if (clientId && clientId !== 'all') {
      where.clientId = clientId;
    }

    if (search) {
      where.employee = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: true,
            },
          },
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    // Calculate days for each request
    const formattedRequests = requests.map(req => {
      const startDate = new Date(req.startDate);
      const endDate = new Date(req.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      return {
        id: req.id,
        employee: {
          id: req.employee.id,
          name: `${req.employee.firstName} ${req.employee.lastName}`,
          profilePhoto: req.employee.profilePhoto,
        },
        client: {
          id: req.client.id,
          name: req.client.companyName,
        },
        leaveType: req.leaveType,
        startDate: req.startDate,
        endDate: req.endDate,
        days,
        reason: req.reason,
        status: req.status,
        isShortNotice: req.isShortNotice,
        clientApprovedAt: req.clientApprovedAt,
        adminApprovedAt: req.adminApprovedAt,
        rejectedAt: req.rejectedAt,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
      };
    });

    // Get stats
    const [pendingCount, clientApprovedCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { status: 'APPROVED_BY_CLIENT' } }),
      prisma.leaveRequest.count({ where: { status: 'APPROVED' } }),
      prisma.leaveRequest.count({ where: { status: 'REJECTED' } }),
    ]);

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        stats: {
          pending: pendingCount,
          clientApproved: clientApprovedCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all pending leave requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leave requests' });
  }
};

// Admin approve leave request (final approval)
export const adminApproveLeave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const adminId = req.user!.userId;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: true,
      },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    // Calculate days
    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Update request status
    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        adminApprovedBy: adminId,
        adminApprovedAt: new Date(),
      },
    });

    // Update leave balance - move from pending to used
    const currentYear = new Date().getFullYear();
    if (leaveRequest.leaveType === 'PAID') {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: leaveRequest.employeeId,
            clientId: leaveRequest.clientId,
            year: currentYear,
          },
        },
        data: {
          paidLeavePending: { decrement: days },
          paidLeaveUsed: { increment: days },
        },
      });
    } else {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: leaveRequest.employeeId,
            clientId: leaveRequest.clientId,
            year: currentYear,
          },
        },
        data: {
          unpaidLeavePending: { decrement: days },
          unpaidLeaveTaken: { increment: days },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'APPROVE',
        entityType: 'LeaveRequest',
        entityId: requestId,
        description: `Approved ${leaveRequest.leaveType} leave for ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} (${days} days)`,
      },
    });

    res.json({
      success: true,
      message: 'Leave request approved',
      data: updated,
    });
  } catch (error) {
    console.error('Admin approve leave error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve leave request' });
  }
};

// Admin reject leave request
export const adminRejectLeave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const { reason } = req.body;
    const adminId = req.user!.userId;

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: 'Rejection reason must be at least 10 characters',
      });
      return;
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: true,
      },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    // Calculate days
    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Update request status
    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    });

    // Update leave balance - remove from pending
    const currentYear = new Date().getFullYear();
    if (leaveRequest.leaveType === 'PAID') {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: leaveRequest.employeeId,
            clientId: leaveRequest.clientId,
            year: currentYear,
          },
        },
        data: {
          paidLeavePending: { decrement: days },
        },
      });
    } else {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: leaveRequest.employeeId,
            clientId: leaveRequest.clientId,
            year: currentYear,
          },
        },
        data: {
          unpaidLeavePending: { decrement: days },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REJECT',
        entityType: 'LeaveRequest',
        entityId: requestId,
        description: `Rejected ${leaveRequest.leaveType} leave for ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}. Reason: ${reason.trim()}`,
      },
    });

    res.json({
      success: true,
      message: 'Leave request rejected',
      data: updated,
    });
  } catch (error) {
    console.error('Admin reject leave error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject leave request' });
  }
};

// Bulk approve leave requests
export const bulkApproveLeave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { requestIds } = req.body;
    const adminId = req.user!.userId;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      res.status(400).json({ success: false, error: 'No request IDs provided' });
      return;
    }

    let approvedCount = 0;

    for (const requestId of requestIds) {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
      });

      if (!leaveRequest || leaveRequest.status === 'APPROVED' || leaveRequest.status === 'REJECTED') {
        continue;
      }

      // Calculate days
      const startDate = new Date(leaveRequest.startDate);
      const endDate = new Date(leaveRequest.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Update request
      await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          adminApprovedBy: adminId,
          adminApprovedAt: new Date(),
        },
      });

      // Update balance
      const currentYear = new Date().getFullYear();
      if (leaveRequest.leaveType === 'PAID') {
        await prisma.leaveBalance.update({
          where: {
            employeeId_clientId_year: {
              employeeId: leaveRequest.employeeId,
              clientId: leaveRequest.clientId,
              year: currentYear,
            },
          },
          data: {
            paidLeavePending: { decrement: days },
            paidLeaveUsed: { increment: days },
          },
        });
      } else {
        await prisma.leaveBalance.update({
          where: {
            employeeId_clientId_year: {
              employeeId: leaveRequest.employeeId,
              clientId: leaveRequest.clientId,
              year: currentYear,
            },
          },
          data: {
            unpaidLeavePending: { decrement: days },
            unpaidLeaveTaken: { increment: days },
          },
        });
      }

      approvedCount++;
    }

    res.json({
      success: true,
      message: `${approvedCount} leave requests approved`,
      count: approvedCount,
    });
  } catch (error) {
    console.error('Bulk approve leave error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk approve leave requests' });
  }
};
