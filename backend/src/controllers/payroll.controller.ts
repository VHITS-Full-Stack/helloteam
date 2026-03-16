import { Response } from 'express';
import prisma from '../config/database';
import { PayrollStatus, AdjustmentType } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { notifyPayrollDeadline } from './notification.controller';
import { sendPayrollReminderEmail } from '../services/email.service';

// Helper function to determine readiness status
const getReadinessStatus = (
  approvedPercentage: number,
  daysUntilCutoff: number
): 'ready' | 'warning' | 'critical' => {
  if (approvedPercentage >= 95 && daysUntilCutoff >= 0) {
    return 'ready';
  } else if (approvedPercentage >= 70 || daysUntilCutoff > 3) {
    return 'warning';
  }
  return 'critical';
};

// Get payroll periods for a client
export const getPayrollPeriods = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { status, limit = 10, offset = 0 } = req.query;

    let clientId: string | undefined;

    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }
      clientId = client.id;
    }

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    const [periods, total] = await Promise.all([
      prisma.payrollPeriod.findMany({
        where,
        orderBy: { periodStart: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.payrollPeriod.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        periods,
        total,
      },
    });
  } catch (error) {
    console.error('Get payroll periods error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payroll periods' });
  }
};

// Create a payroll period
export const createPayrollPeriod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, periodStart, periodEnd, cutoffDate, notes } = req.body;

    if (!clientId || !periodStart || !periodEnd || !cutoffDate) {
      return res.status(400).json({
        success: false,
        error: 'Client ID, period start, period end, and cutoff date are required',
      });
    }

    // Check for overlapping periods
    const overlapping = await prisma.payrollPeriod.findFirst({
      where: {
        clientId,
        OR: [
          {
            periodStart: { lte: new Date(periodEnd) },
            periodEnd: { gte: new Date(periodStart) },
          },
        ],
      },
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: 'A payroll period already exists for this date range',
      });
    }

    const period = await prisma.payrollPeriod.create({
      data: {
        clientId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        cutoffDate: new Date(cutoffDate),
        notes,
      },
    });

    res.status(201).json({
      success: true,
      data: period,
    });
  } catch (error) {
    console.error('Create payroll period error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payroll period' });
  }
};

// Finalize a payroll period
export const finalizePayrollPeriod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res.status(404).json({ success: false, error: 'Payroll period not found' });
    }

    if (period.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Only open payroll periods can be finalized',
      });
    }

    // Calculate totals from approved time records
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId: period.clientId,
        date: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
      },
    });

    // Only count payable time: regular hours + approved OT (denied OT deducted)
    const approvedMinutes = timeRecords
      .filter((r) => r.status === 'APPROVED' || r.status === 'AUTO_APPROVED')
      .reduce((sum, r) => {
        let approvedOT = 0;
        if (r.shiftExtensionStatus === 'APPROVED') approvedOT += r.shiftExtensionMinutes || 0;
        if (r.extraTimeStatus === 'APPROVED') approvedOT += r.extraTimeMinutes || 0;
        const deniedOT = Math.max(0, (r.overtimeMinutes || 0) - approvedOT);
        return sum + Math.max(0, (r.totalMinutes || 0) - deniedOT);
      }, 0);

    const pendingMinutes = timeRecords
      .filter((r) => r.status === 'PENDING')
      .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

    const totalMinutes = approvedMinutes + pendingMinutes;

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedBy: userId,
        approvedHours: approvedMinutes / 60,
        pendingHours: pendingMinutes / 60,
        totalHours: totalMinutes / 60,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Finalize payroll period error:', error);
    res.status(500).json({ success: false, error: 'Failed to finalize payroll period' });
  }
};

// Send payroll deadline reminders
export const sendPayrollReminders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { daysBeforeCutoff = 3 } = req.body;

    // Find all open payroll periods with cutoff within specified days
    const cutoffThreshold = new Date();
    cutoffThreshold.setDate(cutoffThreshold.getDate() + daysBeforeCutoff);

    const upcomingPeriods = await prisma.payrollPeriod.findMany({
      where: {
        status: 'OPEN',
        cutoffDate: {
          gte: new Date(),
          lte: cutoffThreshold,
        },
      },
    });

    const remindersSent = [];

    for (const period of upcomingPeriods) {
      // Get client info with user
      const client = await prisma.client.findUnique({
        where: { id: period.clientId },
        include: {
          user: true,
        },
      });

      if (!client) continue;

      // Count pending time records
      const pendingCount = await prisma.timeRecord.count({
        where: {
          clientId: period.clientId,
          date: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
          status: 'PENDING',
        },
      });

      // Calculate days remaining
      const now = new Date();
      const cutoff = new Date(period.cutoffDate);
      const daysRemaining = Math.ceil((cutoff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Send in-app notification
      await notifyPayrollDeadline(client.user.id, daysRemaining, pendingCount);

      // Send email notification - use contactPerson from client
      const clientName = client.contactPerson || client.companyName;
      await sendPayrollReminderEmail(
        client.user.email,
        clientName,
        daysRemaining,
        pendingCount,
        cutoff.toLocaleDateString()
      );

      remindersSent.push({
        clientId: client.id,
        clientName,
        daysRemaining,
        pendingCount,
      });
    }

    res.json({
      success: true,
      data: {
        remindersSent: remindersSent.length,
        details: remindersSent,
      },
    });
  } catch (error) {
    console.error('Send payroll reminders error:', error);
    res.status(500).json({ success: false, error: 'Failed to send payroll reminders' });
  }
};

// Get current payroll period for a client
export const getCurrentPayrollPeriod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    let clientId: string | undefined;

    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }
      clientId = client.id;
    } else {
      clientId = req.query.clientId as string;
    }

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client ID is required' });
    }

    const today = new Date();
    const currentPeriod = await prisma.payrollPeriod.findFirst({
      where: {
        clientId,
        periodStart: { lte: today },
        periodEnd: { gte: today },
        status: 'OPEN',
      },
    });

    if (!currentPeriod) {
      return res.json({
        success: true,
        data: null,
        message: 'No active payroll period found',
      });
    }

    // Calculate statistics
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: {
          gte: currentPeriod.periodStart,
          lte: currentPeriod.periodEnd,
        },
      },
    });

    const totalMinutes = timeRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
    const approvedMinutes = timeRecords
      .filter((r) => r.status === 'APPROVED' || r.status === 'AUTO_APPROVED')
      .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

    const stats = {
      totalRecords: timeRecords.length,
      pending: timeRecords.filter((r) => r.status === 'PENDING').length,
      approved: timeRecords.filter((r) => r.status === 'APPROVED' || r.status === 'AUTO_APPROVED').length,
      rejected: timeRecords.filter((r) => r.status === 'REJECTED').length,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      approvedHours: Math.round(approvedMinutes / 60 * 100) / 100,
    };

    // Days until cutoff
    const cutoff = new Date(currentPeriod.cutoffDate);
    const daysUntilCutoff = Math.ceil((cutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      data: {
        ...currentPeriod,
        stats,
        daysUntilCutoff,
      },
    });
  } catch (error) {
    console.error('Get current payroll period error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch current payroll period' });
  }
};

// Get payroll readiness dashboard (all clients overview)
export const getPayrollReadinessDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { periodStart, periodEnd } = req.query;

    // Default to current biweekly period if not specified
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() <= 15 ? 1 : 16);
    const defaultEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() <= 15 ? 15 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());

    const startDate = periodStart ? new Date(periodStart as string) : defaultStart;
    const endDate = periodEnd ? new Date(periodEnd as string) : defaultEnd;

    // Get all active clients
    const clients = await prisma.client.findMany({
      where: {
        user: { status: 'ACTIVE' },
      },
      include: {
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Get payroll periods for the date range
    const periods = await prisma.payrollPeriod.findMany({
      where: {
        periodStart: { lte: endDate },
        periodEnd: { gte: startDate },
      },
    });

    // Calculate stats per client
    const clientStats = await Promise.all(
      clients.map(async (client) => {
        const period = periods.find((p) => p.clientId === client.id);

        // Get time records for this client in the period
        const timeRecords = await prisma.timeRecord.findMany({
          where: {
            clientId: client.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            adjustments: {
              where: {
                requiresReapproval: true,
                clientReapprovedAt: null,
              },
            },
          },
        });

        const totalMinutes = timeRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
        const overtimeMinutes = timeRecords.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
        const approvedRecords = timeRecords.filter((r) => r.status === 'APPROVED' || r.status === 'AUTO_APPROVED');
        const pendingRecords = timeRecords.filter((r) => r.status === 'PENDING');
        const rejectedRecords = timeRecords.filter((r) => r.status === 'REJECTED');
        const disputedRecords = timeRecords.filter((r) => r.adjustments.length > 0);

        const approvedMinutes = approvedRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
        const pendingMinutes = pendingRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

        // Calculate readiness
        const totalRecords = timeRecords.length;
        const approvedPercentage = totalRecords > 0 ? (approvedRecords.length / totalRecords) * 100 : 100;

        // Days until cutoff
        const cutoffDate = period?.cutoffDate || new Date(endDate.getTime() + 2 * 24 * 60 * 60 * 1000);
        const daysUntilCutoff = Math.ceil((cutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const readiness = getReadinessStatus(approvedPercentage, daysUntilCutoff);

        return {
          clientId: client.id,
          companyName: client.companyName,
          employeeCount: client.employees.length,
          periodStatus: period?.status || 'OPEN',
          totalHours: Math.round(totalMinutes / 60 * 100) / 100,
          approvedHours: Math.round(approvedMinutes / 60 * 100) / 100,
          pendingHours: Math.round(pendingMinutes / 60 * 100) / 100,
          overtimeHours: Math.round(overtimeMinutes / 60 * 100) / 100,
          totalRecords,
          approvedRecords: approvedRecords.length,
          pendingRecords: pendingRecords.length,
          rejectedRecords: rejectedRecords.length,
          disputedRecords: disputedRecords.length,
          approvedPercentage: Math.round(approvedPercentage),
          daysUntilCutoff,
          cutoffDate,
          readiness,
          isLocked: period?.status === 'LOCKED' || period?.status === 'FINALIZED',
        };
      })
    );

    // Calculate overall summary
    const summary = {
      totalClients: clientStats.length,
      totalEmployees: clientStats.reduce((sum, c) => sum + c.employeeCount, 0),
      totalHours: Math.round(clientStats.reduce((sum, c) => sum + c.totalHours, 0) * 100) / 100,
      approvedHours: Math.round(clientStats.reduce((sum, c) => sum + c.approvedHours, 0) * 100) / 100,
      pendingHours: Math.round(clientStats.reduce((sum, c) => sum + c.pendingHours, 0) * 100) / 100,
      overtimeHours: Math.round(clientStats.reduce((sum, c) => sum + c.overtimeHours, 0) * 100) / 100,
      readyClients: clientStats.filter((c) => c.readiness === 'ready').length,
      warningClients: clientStats.filter((c) => c.readiness === 'warning').length,
      criticalClients: clientStats.filter((c) => c.readiness === 'critical').length,
      totalUnapproved: clientStats.reduce((sum, c) => sum + c.pendingRecords, 0),
      totalDisputed: clientStats.reduce((sum, c) => sum + c.disputedRecords, 0),
    };

    res.json({
      success: true,
      data: {
        periodStart: startDate,
        periodEnd: endDate,
        summary,
        clients: clientStats,
      },
    });
  } catch (error) {
    console.error('Get payroll readiness dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payroll readiness dashboard' });
  }
};

// Get unapproved time records
export const getUnapprovedTimeRecords = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, periodStart, periodEnd, limit = 100, offset = 0 } = req.query;

    // Default to current biweekly period
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() <= 15 ? 1 : 16);
    const defaultEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() <= 15 ? 15 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());

    const where: any = {
      status: 'PENDING',
      date: {
        gte: periodStart ? new Date(periodStart as string) : defaultStart,
        lte: periodEnd ? new Date(periodEnd as string) : defaultEnd,
      },
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    const [records, total] = await Promise.all([
      prisma.timeRecord.findMany({
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
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.timeRecord.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        records,
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('Get unapproved time records error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unapproved time records' });
  }
};

// Get disputed time records (adjusted but not re-approved)
export const getDisputedTimeRecords = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, limit = 100, offset = 0 } = req.query;

    // Find time records with pending re-approval adjustments
    const adjustmentsWhere: any = {
      requiresReapproval: true,
      clientReapprovedAt: null,
    };

    const timeRecordWhere: any = {};
    if (clientId) {
      timeRecordWhere.clientId = clientId as string;
    }

    const records = await prisma.timeRecord.findMany({
      where: {
        ...timeRecordWhere,
        adjustments: {
          some: adjustmentsWhere,
        },
      },
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
        adjustments: {
          where: adjustmentsWhere,
          orderBy: { adjustedAt: 'desc' },
          include: {
            adjuster: {
              select: {
                id: true,
                email: true,
                admin: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.timeRecord.count({
      where: {
        ...timeRecordWhere,
        adjustments: {
          some: adjustmentsWhere,
        },
      },
    });

    res.json({
      success: true,
      data: {
        records,
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('Get disputed time records error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch disputed time records' });
  }
};

// Lock payroll period
export const lockPayrollPeriod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res.status(404).json({ success: false, error: 'Payroll period not found' });
    }

    if (period.status === 'FINALIZED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot lock a finalized payroll period',
      });
    }

    if (period.status === 'LOCKED') {
      return res.status(400).json({
        success: false,
        error: 'Payroll period is already locked',
      });
    }

    // Check for pending items
    const pendingCount = await prisma.timeRecord.count({
      where: {
        clientId: period.clientId,
        date: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
        status: 'PENDING',
      },
    });

    // Allow locking even with pending items, but warn
    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: 'LOCKED',
        notes: pendingCount > 0
          ? `Locked with ${pendingCount} pending time records`
          : period.notes,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: userId!,
        action: 'UPDATE',
        entityType: 'PayrollPeriod',
        entityId: id,
        description: `Locked payroll period for ${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]}`,
        oldValues: { status: period.status },
        newValues: { status: 'LOCKED' },
      },
    });

    res.json({
      success: true,
      data: updatedPeriod,
      warning: pendingCount > 0 ? `Period locked with ${pendingCount} pending time records` : undefined,
    });
  } catch (error) {
    console.error('Lock payroll period error:', error);
    res.status(500).json({ success: false, error: 'Failed to lock payroll period' });
  }
};

// Unlock payroll period
export const unlockPayrollPeriod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required to unlock a payroll period',
      });
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res.status(404).json({ success: false, error: 'Payroll period not found' });
    }

    if (period.status === 'FINALIZED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot unlock a finalized payroll period',
      });
    }

    if (period.status !== 'LOCKED') {
      return res.status(400).json({
        success: false,
        error: 'Payroll period is not locked',
      });
    }

    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: 'OPEN',
        notes: `Unlocked: ${reason}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: userId!,
        action: 'UPDATE',
        entityType: 'PayrollPeriod',
        entityId: id,
        description: `Unlocked payroll period - Reason: ${reason}`,
        oldValues: { status: 'LOCKED' },
        newValues: { status: 'OPEN' },
      },
    });

    res.json({
      success: true,
      data: updatedPeriod,
    });
  } catch (error) {
    console.error('Unlock payroll period error:', error);
    res.status(500).json({ success: false, error: 'Failed to unlock payroll period' });
  }
};

// Get payroll export data
export const getPayrollExportData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { periodStart, periodEnd, clientId, format = 'json' } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Period start and end dates are required',
      });
    }

    const where: any = {
      date: {
        gte: new Date(periodStart as string),
        lte: new Date(periodEnd as string),
      },
      status: { in: ['APPROVED', 'AUTO_APPROVED'] }, // Export all approved records
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    const records = await prisma.timeRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              select: { email: true },
            },
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { employee: { lastName: 'asc' } }],
    });

    // Group by employee
    const employeeData: Record<string, any> = {};

    records.forEach((record) => {
      const empId = record.employeeId;
      if (!employeeData[empId]) {
        employeeData[empId] = {
          employeeId: empId,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
          email: record.employee.user?.email || '',
          client: record.client.companyName,
          clientId: record.client.id,
          records: [],
          totalMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          breakMinutes: 0,
          workDays: 0,
        };
      }

      // Only include approved OT in export (denied OT excluded from payable time)
      let approvedOT = 0;
      if (record.shiftExtensionStatus === 'APPROVED') approvedOT += record.shiftExtensionMinutes || 0;
      if (record.extraTimeStatus === 'APPROVED') approvedOT += record.extraTimeMinutes || 0;
      const deniedOT = Math.max(0, (record.overtimeMinutes || 0) - approvedOT);
      const payableMinutes = Math.max(0, (record.totalMinutes || 0) - deniedOT);
      const payableRegular = payableMinutes - approvedOT;

      employeeData[empId].records.push({
        date: record.date,
        totalMinutes: payableMinutes,
        regularMinutes: payableRegular,
        overtimeMinutes: approvedOT,
        breakMinutes: record.breakMinutes || 0,
      });

      employeeData[empId].totalMinutes += payableMinutes;
      employeeData[empId].regularMinutes += payableRegular;
      employeeData[empId].overtimeMinutes += approvedOT;
      employeeData[empId].breakMinutes += record.breakMinutes || 0;
      employeeData[empId].workDays += 1;
    });

    // Convert to array and calculate hours
    const exportData = Object.values(employeeData).map((emp: any) => ({
      ...emp,
      totalHours: Math.round(emp.totalMinutes / 60 * 100) / 100,
      regularHours: Math.round(emp.regularMinutes / 60 * 100) / 100,
      overtimeHours: Math.round(emp.overtimeMinutes / 60 * 100) / 100,
      breakHours: Math.round(emp.breakMinutes / 60 * 100) / 100,
    }));

    // Calculate totals
    const totals = {
      totalEmployees: exportData.length,
      totalHours: Math.round(exportData.reduce((sum, e) => sum + e.totalHours, 0) * 100) / 100,
      regularHours: Math.round(exportData.reduce((sum, e) => sum + e.regularHours, 0) * 100) / 100,
      overtimeHours: Math.round(exportData.reduce((sum, e) => sum + e.overtimeHours, 0) * 100) / 100,
      breakHours: Math.round(exportData.reduce((sum, e) => sum + e.breakHours, 0) * 100) / 100,
      totalRecords: records.length,
    };

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Employee ID',
        'First Name',
        'Last Name',
        'Email',
        'Client',
        'Work Days',
        'Total Hours',
        'Regular Hours',
        'Overtime Hours',
        'Break Hours',
      ];

      const csvRows = exportData.map((emp) => [
        emp.employeeId,
        emp.firstName,
        emp.lastName,
        emp.email,
        emp.client,
        emp.workDays,
        emp.totalHours,
        emp.regularHours,
        emp.overtimeHours,
        emp.breakHours,
      ]);

      const csv = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payroll-${periodStart}-${periodEnd}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        periodStart,
        periodEnd,
        totals,
        employees: exportData,
      },
    });
  } catch (error) {
    console.error('Get payroll export data error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate payroll export' });
  }
};

// Get employee payroll summary for a period
export const getEmployeePayrollSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { periodStart, periodEnd, clientId } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Period start and end dates are required',
      });
    }

    const where: any = {
      date: {
        gte: new Date(periodStart as string),
        lte: new Date(periodEnd as string),
      },
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    // Fetch time records
    const records = await prisma.timeRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            billingRate: true,
            groupAssignments: {
              select: {
                groupId: true,
                group: {
                  select: {
                    billingRate: true,
                  },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    // Fetch client policies for rates
    const clientIds = [...new Set(records.map((r) => r.clientId))];
    const clientPolicies = await prisma.clientPolicy.findMany({
      where: { clientId: { in: clientIds } },
    });
    const policyMap = new Map(clientPolicies.map((p) => [p.clientId, p]));

    // Fetch employee assignments for rate overrides
    const employeeIds = [...new Set(records.map((r) => r.employeeId))];
    const assignments = await prisma.clientEmployee.findMany({
      where: {
        clientId: { in: clientIds },
        employeeId: { in: employeeIds },
        isActive: true,
      },
    });
    const assignmentMap = new Map(
      assignments.map((a) => [`${a.clientId}-${a.employeeId}`, a])
    );

    // Fetch client-group billing rates
    const clientGroupRecords = await prisma.clientGroup.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, groupId: true, billingRate: true },
    });
    const clientGroupRateMap = new Map(
      clientGroupRecords.map((cg) => [`${cg.clientId}-${cg.groupId}`, cg.billingRate ? Number(cg.billingRate) : null])
    );

    // Group by employee
    const employeeSummary: Record<string, any> = {};

    records.forEach((record) => {
      const empId = record.employeeId;
      if (!employeeSummary[empId]) {
        // Get rates: assignment override > employee billing rate > client-group billing rate > group billing rate > client default
        const assignment = assignmentMap.get(`${record.clientId}-${record.employeeId}`);
        const policy = policyMap.get(record.clientId);
        const employeeBillingRate = record.employee.billingRate ? Number(record.employee.billingRate) : null;
        const groupAssignment = record.employee.groupAssignments?.[0];
        const clientGroupBillingRate = groupAssignment?.groupId
          ? clientGroupRateMap.get(`${record.clientId}-${groupAssignment.groupId}`) ?? null
          : null;
        const groupBillingRate = groupAssignment?.group?.billingRate
          ? Number(groupAssignment.group.billingRate)
          : null;

        const hourlyRate = assignment?.hourlyRate
          ? Number(assignment.hourlyRate)
          : employeeBillingRate
            ? employeeBillingRate
            : clientGroupBillingRate
              ? clientGroupBillingRate
              : groupBillingRate
                ? groupBillingRate
                : policy?.defaultHourlyRate
                  ? Number(policy.defaultHourlyRate)
                  : 0;

        let overtimeRate = assignment?.overtimeRate
          ? Number(assignment.overtimeRate)
          : policy?.defaultOvertimeRate
            ? Number(policy.defaultOvertimeRate)
            : 0;

        // If overtime rate is 0, default to 1.5x hourly rate
        if (overtimeRate === 0 && hourlyRate > 0) {
          overtimeRate = hourlyRate * 1.5;
        }

        employeeSummary[empId] = {
          employee: record.employee,
          client: record.client,
          records: [],
          totalMinutes: 0,
          overtimeMinutes: 0,
          approvedMinutes: 0,
          pendingMinutes: 0,
          workDays: 0,
          approvedDays: 0,
          pendingDays: 0,
          rejectedDays: 0,
          hourlyRate,
          overtimeRate,
        };
      }

      employeeSummary[empId].workDays += 1;

      if (record.status === 'APPROVED' || record.status === 'AUTO_APPROVED') {
        // Calculate approved OT from the record's own fields
        let approvedOTMinutes = 0;
        if (record.shiftExtensionStatus === 'APPROVED') {
          approvedOTMinutes += record.shiftExtensionMinutes || 0;
        }
        if (record.extraTimeStatus === 'APPROVED') {
          approvedOTMinutes += record.extraTimeMinutes || 0;
        }
        const deniedOTMinutes = Math.max(0, (record.overtimeMinutes || 0) - approvedOTMinutes);
        const payableMinutes = Math.max(0, (record.totalMinutes || 0) - deniedOTMinutes);

        employeeSummary[empId].totalMinutes += payableMinutes;
        employeeSummary[empId].overtimeMinutes += approvedOTMinutes;
        employeeSummary[empId].approvedMinutes += payableMinutes;
        employeeSummary[empId].approvedDays += 1;
      } else if (record.status === 'PENDING') {
        employeeSummary[empId].pendingMinutes += record.totalMinutes || 0;
        employeeSummary[empId].pendingDays += 1;
      } else if (record.status === 'REJECTED') {
        employeeSummary[empId].rejectedDays += 1;
      }
    });

    // Fetch payroll adjustments for this period
    // Use T12:00:00Z to avoid timezone date shifts with @db.Date fields
    // Also use ±1 day range to catch old entries saved without the timezone fix
    const pStart = new Date((periodStart as string) + 'T12:00:00Z');
    const pEnd = new Date((periodEnd as string) + 'T12:00:00Z');
    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: { in: employeeIds },
        periodStart: {
          gte: new Date(pStart.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(pStart.getTime() + 24 * 60 * 60 * 1000),
        },
        periodEnd: {
          gte: new Date(pEnd.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(pEnd.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // Group adjustments by employee
    const adjustmentsByEmployee: Record<string, any[]> = {};
    adjustments.forEach((adj) => {
      if (!adjustmentsByEmployee[adj.employeeId]) {
        adjustmentsByEmployee[adj.employeeId] = [];
      }
      adjustmentsByEmployee[adj.employeeId].push({
        id: adj.id,
        type: adj.type,
        amount: Number(adj.amount),
        reason: adj.reason,
        createdAt: adj.createdAt,
      });
    });

    // Convert to array with calculated fields including gross pay
    const employees = Object.values(employeeSummary).map((emp: any) => {
      const status = emp.pendingDays > 0 ? 'pending' : emp.rejectedDays > 0 ? 'flagged' : 'ready';
      // Pay only for approved time: regular hours + approved OT
      const totalHours = emp.totalMinutes / 60;
      const overtimeHours = emp.overtimeMinutes / 60;
      const regularHours = totalHours - overtimeHours;

      // Calculate gross pay (only approved time is payable)
      const regularPay = regularHours * emp.hourlyRate;
      const overtimePay = overtimeHours * emp.overtimeRate;

      // Apply adjustments (bonuses add, deductions subtract)
      const empAdjustments = adjustmentsByEmployee[emp.employee.id] || [];
      const totalBonuses = empAdjustments
        .filter((a: any) => a.type === 'BONUS')
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      const totalDeductions = empAdjustments
        .filter((a: any) => a.type === 'DEDUCTION')
        .reduce((sum: number, a: any) => sum + a.amount, 0);

      const grossPay = regularPay + overtimePay + totalBonuses - totalDeductions;

      return {
        ...emp,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        approvedHours: Math.round(emp.approvedMinutes / 60 * 100) / 100,
        pendingHours: Math.round(emp.pendingMinutes / 60 * 100) / 100,
        regularHours: Math.round(regularHours * 100) / 100,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        grossPay: Math.round(grossPay * 100) / 100,
        adjustments: empAdjustments,
        totalBonuses: Math.round(totalBonuses * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        status,
        note: emp.pendingDays > 0 ? `${emp.pendingDays} day(s) pending approval` :
              emp.rejectedDays > 0 ? `${emp.rejectedDays} day(s) rejected` : undefined,
      };
    });

    res.json({
      success: true,
      data: {
        employees: employees.sort((a, b) => b.totalHours - a.totalHours),
        totals: {
          totalEmployees: employees.length,
          totalHours: Math.round(employees.reduce((sum, e) => sum + e.totalHours, 0) * 100) / 100,
          overtimeHours: Math.round(employees.reduce((sum, e) => sum + e.overtimeHours, 0) * 100) / 100,
          approvedHours: Math.round(employees.reduce((sum, e) => sum + e.approvedHours, 0) * 100) / 100,
          pendingHours: Math.round(employees.reduce((sum, e) => sum + e.pendingHours, 0) * 100) / 100,
          totalGrossPay: Math.round(employees.reduce((sum, e) => sum + e.grossPay, 0) * 100) / 100,
          readyCount: employees.filter((e) => e.status === 'ready').length,
          pendingCount: employees.filter((e) => e.status === 'pending').length,
          flaggedCount: employees.filter((e) => e.status === 'flagged').length,
        },
      },
    });
  } catch (error) {
    console.error('Get employee payroll summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee payroll summary' });
  }
};

// Create or update payroll cutoff settings
export const updatePayrollCutoff = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { cutoffDate, notes } = req.body;

    if (!cutoffDate) {
      return res.status(400).json({
        success: false,
        error: 'Cutoff date is required',
      });
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res.status(404).json({ success: false, error: 'Payroll period not found' });
    }

    if (period.status === 'LOCKED' || period.status === 'FINALIZED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update cutoff for locked or finalized periods',
      });
    }

    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        cutoffDate: new Date(cutoffDate),
        notes: notes || period.notes,
      },
    });

    res.json({
      success: true,
      data: updatedPeriod,
    });
  } catch (error) {
    console.error('Update payroll cutoff error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payroll cutoff' });
  }
};

// Add payroll adjustment (bonus or deduction)
export const addPayrollAdjustment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, type, amount, reason, periodStart, periodEnd } = req.body;

    if (!employeeId || !type || !amount || !reason || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, type, amount, reason, period start and end are required',
      });
    }

    if (!['BONUS', 'DEDUCTION'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be BONUS or DEDUCTION',
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0',
      });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId,
        type: type as AdjustmentType,
        amount: Number(amount),
        reason,
        periodStart: new Date(periodStart + 'T12:00:00Z'),
        periodEnd: new Date(periodEnd + 'T12:00:00Z'),
        createdBy: req.user!.userId,
      },
    });

    res.json({
      success: true,
      data: adjustment,
      message: `${type === 'BONUS' ? 'Bonus' : 'Deduction'} added successfully`,
    });
  } catch (error) {
    console.error('Add payroll adjustment error:', error);
    res.status(500).json({ success: false, error: 'Failed to add payroll adjustment' });
  }
};

// Get payroll adjustments for an employee in a period
export const getPayrollAdjustments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, periodStart, periodEnd } = req.query;

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;
    if (periodStart && periodEnd) {
      where.periodStart = new Date(periodStart as string);
      where.periodEnd = new Date(periodEnd as string);
    }

    const adjustments = await prisma.payrollAdjustment.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: adjustments.map((a) => ({
        ...a,
        amount: Number(a.amount),
      })),
    });
  } catch (error) {
    console.error('Get payroll adjustments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payroll adjustments' });
  }
};

// Delete payroll adjustment
export const deletePayrollAdjustment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const adjustment = await prisma.payrollAdjustment.findUnique({ where: { id } });
    if (!adjustment) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    await prisma.payrollAdjustment.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Adjustment deleted successfully',
    });
  } catch (error) {
    console.error('Delete payroll adjustment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete payroll adjustment' });
  }
};
