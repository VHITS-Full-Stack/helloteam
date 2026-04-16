import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { AuditAction } from '@prisma/client';

// ============================================
// TIME RECORDS FOR ADJUSTMENT
// ============================================

// Get time records with search and filter for admin adjustment
export const getTimeRecordsForAdjustment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      clientId,
      employeeId,
      status,
      startDate,
      endDate,
      hasAdjustments,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    if (hasAdjustments === 'true') {
      where.adjustedAt = { not: null };
    } else if (hasAdjustments === 'false') {
      where.adjustedAt = null;
    }

    // Search by employee name
    if (search) {
      const searchTerm = (search as string).trim();
      const conds: any[] = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
      ];
      const parts = searchTerm.split(/\s+/);
      if (parts.length >= 2) {
        conds.push({ AND: [{ firstName: { contains: parts[0], mode: 'insensitive' } }, { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' } }] });
      }
      where.employee = { OR: conds };
    }

    const [timeRecords, total] = await Promise.all([
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
              timezone: true,
            },
          },
          adjustments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              adjuster: {
                select: { id: true, email: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.timeRecord.count({ where }),
    ]);

    // Format response
    const records = timeRecords.map(tr => ({
      id: tr.id,
      date: tr.date,
      employee: {
        id: tr.employee.id,
        name: `${tr.employee.firstName} ${tr.employee.lastName}`,
        profilePhoto: tr.employee.profilePhoto,
      },
      client: {
        id: tr.client.id,
        name: tr.client.companyName,
        timezone: tr.client.timezone,
      },
      scheduledStart: tr.scheduledStart,
      scheduledEnd: tr.scheduledEnd,
      actualStart: tr.actualStart,
      actualEnd: tr.actualEnd,
      billingStart: tr.billingStart,
      billingEnd: tr.billingEnd,
      billingMinutes: tr.billingMinutes,
      isLate: tr.isLate,
      totalMinutes: tr.totalMinutes,
      breakMinutes: tr.breakMinutes,
      overtimeMinutes: tr.overtimeMinutes,
      status: tr.status,
      approvedAt: tr.approvedAt,
      hasAdjustments: tr.adjustedAt !== null,
      lastAdjustment: tr.adjustments[0] || null,
      originalMinutes: tr.originalMinutes,
    }));

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get time records for adjustment error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch time records' });
  }
};

// Get single time record details with full adjustment history
export const getTimeRecordDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;

    const timeRecord = await prisma.timeRecord.findUnique({
      where: { id: recordId as string },
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
          orderBy: { createdAt: 'desc' },
          include: {
            adjuster: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    if (!timeRecord) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...timeRecord,
        employee: {
          id: timeRecord.employee.id,
          name: `${timeRecord.employee.firstName} ${timeRecord.employee.lastName}`,
          profilePhoto: timeRecord.employee.profilePhoto,
        },
        client: {
          id: timeRecord.client.id,
          name: timeRecord.client.companyName,
        },
      },
    });
  } catch (error) {
    console.error('Get time record details error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch time record details' });
  }
};

// ============================================
// TIME ADJUSTMENTS
// ============================================

// Create a time adjustment
export const createTimeAdjustment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;
    const userId = req.user?.userId;
    const {
      newTotalMinutes,
      newActualStart,
      newActualEnd,
      reason,
    } = req.body;

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: 'Adjustment reason is required (minimum 10 characters)',
      });
      return;
    }

    // Get current time record
    const timeRecord = await prisma.timeRecord.findUnique({
      where: { id: recordId as string },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        client: { select: { companyName: true } },
      },
    });

    if (!timeRecord) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    // Prepare adjustment data
    const adjustmentData: any = {
      timeRecordId: recordId as string,
      adjustedBy: userId!,
      reason: reason.trim(),
      fieldChanged: 'totalMinutes',
      oldTotalMinutes: timeRecord.totalMinutes,
      requiresReapproval: timeRecord.status === 'APPROVED' || timeRecord.status === 'AUTO_APPROVED',
    };

    const updateData: any = {
      adjustedBy: userId,
      adjustedAt: new Date(),
      adjustmentNotes: reason.trim(),
    };

    // Track what was changed
    const changes: string[] = [];

    // Handle totalMinutes change
    if (newTotalMinutes !== undefined && newTotalMinutes !== timeRecord.totalMinutes) {
      // Store original if first adjustment
      if (timeRecord.originalMinutes === null) {
        updateData.originalMinutes = timeRecord.totalMinutes;
      }

      adjustmentData.oldValue = String(timeRecord.totalMinutes);
      adjustmentData.newValue = String(newTotalMinutes);
      adjustmentData.newTotalMinutes = newTotalMinutes;
      adjustmentData.minutesDifference = newTotalMinutes - timeRecord.totalMinutes;

      updateData.totalMinutes = newTotalMinutes;
      changes.push(`totalMinutes: ${timeRecord.totalMinutes} → ${newTotalMinutes}`);
    }

    // Handle actualStart change
    if (newActualStart !== undefined) {
      const newStart = new Date(newActualStart);
      if (timeRecord.actualStart?.getTime() !== newStart.getTime()) {
        adjustmentData.fieldChanged = 'actualStart';
        adjustmentData.oldValue = timeRecord.actualStart?.toISOString() || null;
        adjustmentData.newValue = newStart.toISOString();

        updateData.actualStart = newStart;
        changes.push(`actualStart changed`);
      }
    }

    // Handle actualEnd change
    if (newActualEnd !== undefined) {
      const newEnd = new Date(newActualEnd);
      if (timeRecord.actualEnd?.getTime() !== newEnd.getTime()) {
        adjustmentData.fieldChanged = 'actualEnd';
        adjustmentData.oldValue = timeRecord.actualEnd?.toISOString() || null;
        adjustmentData.newValue = newEnd.toISOString();

        updateData.actualEnd = newEnd;
        changes.push(`actualEnd changed`);
      }
    }

    // If previously approved, require re-approval
    if (timeRecord.status === 'APPROVED' || timeRecord.status === 'AUTO_APPROVED') {
      updateData.status = 'PENDING';
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }

    // Use transaction
    const [updatedRecord, adjustment] = await prisma.$transaction([
      prisma.timeRecord.update({
        where: { id: recordId as string },
        data: updateData,
      }),
      prisma.timeAdjustment.create({
        data: adjustmentData,
      }),
      // Create audit log
      prisma.auditLog.create({
        data: {
          userId: userId!,
          action: AuditAction.ADJUSTMENT,
          entityType: 'TimeRecord',
          entityId: recordId as string,
          description: `Time record adjusted for ${timeRecord.employee.firstName} ${timeRecord.employee.lastName} (${timeRecord.client.companyName}): ${changes.join(', ')}`,
          oldValues: {
            totalMinutes: timeRecord.totalMinutes,
            actualStart: timeRecord.actualStart,
            actualEnd: timeRecord.actualEnd,
            status: timeRecord.status,
          },
          newValues: updateData,
          metadata: { reason: reason.trim() },
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'Time record adjusted successfully',
      data: {
        timeRecord: updatedRecord,
        adjustment,
        requiresReapproval: adjustmentData.requiresReapproval,
      },
    });
  } catch (error) {
    console.error('Create time adjustment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create adjustment' });
  }
};

// Get adjustment history for a time record
export const getAdjustmentHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;

    const adjustments = await prisma.timeAdjustment.findMany({
      where: { timeRecordId: recordId as string },
      include: {
        adjuster: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: adjustments,
    });
  } catch (error) {
    console.error('Get adjustment history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch adjustment history' });
  }
};

// ============================================
// AUDIT LOGS
// ============================================

// Get audit logs with filtering
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
};

// Get audit log summary stats
export const getAuditLogStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - 7);

    const [todayCount, weekCount, byAction, byEntityType] = await Promise.all([
      prisma.auditLog.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.auditLog.count({
        where: { createdAt: { gte: thisWeek } },
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        where: { createdAt: { gte: thisWeek } },
      }),
      prisma.auditLog.groupBy({
        by: ['entityType'],
        _count: true,
        where: { createdAt: { gte: thisWeek } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        todayCount,
        weekCount,
        byAction: byAction.map(a => ({ action: a.action, count: a._count })),
        byEntityType: byEntityType.map(e => ({ entityType: e.entityType, count: e._count })),
      },
    });
  } catch (error) {
    console.error('Get audit log stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log stats' });
  }
};

// ============================================
// CLIENT RE-APPROVAL
// ============================================

// Get time records pending re-approval (adjusted after client approval)
export const getPendingReapprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { clientId, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      adjustedAt: { not: null },
      status: 'PENDING',
      originalMinutes: { not: null }, // Was previously approved then adjusted
    };

    if (clientId) where.clientId = clientId;

    const [records, total] = await Promise.all([
      prisma.timeRecord.findMany({
        where,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
          client: {
            select: { id: true, companyName: true },
          },
          adjustments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              adjuster: { select: { id: true, email: true } },
            },
          },
        },
        orderBy: { adjustedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.timeRecord.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        records: records.map(r => ({
          id: r.id,
          date: r.date,
          employee: {
            id: r.employee.id,
            name: `${r.employee.firstName} ${r.employee.lastName}`,
            profilePhoto: r.employee.profilePhoto,
          },
          client: {
            id: r.client.id,
            name: r.client.companyName,
          },
          originalMinutes: r.originalMinutes,
          currentMinutes: r.totalMinutes,
          adjustedAt: r.adjustedAt,
          adjustmentNotes: r.adjustmentNotes,
          lastAdjustment: r.adjustments[0] || null,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get pending reapprovals error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending reapprovals' });
  }
};
