import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { notifyPayrollDeadline } from './notification.controller';
import { sendPayrollReminderEmail } from '../services/email.service';

const prisma = new PrismaClient();

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

    const approvedMinutes = timeRecords
      .filter((r) => r.status === 'APPROVED')
      .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

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
      .filter((r) => r.status === 'APPROVED')
      .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

    const stats = {
      totalRecords: timeRecords.length,
      pending: timeRecords.filter((r) => r.status === 'PENDING').length,
      approved: timeRecords.filter((r) => r.status === 'APPROVED').length,
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
