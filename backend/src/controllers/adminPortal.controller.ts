import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { LeaveStatus, ApprovalStatus } from '@prisma/client';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';

// Helper function to refresh presigned URL for profile photos
const refreshProfilePhotoUrl = async (photoUrl: string | null | undefined): Promise<string | null> => {
  if (!photoUrl) return null;
  const key = getKeyFromUrl(photoUrl);
  if (!key) return photoUrl;
  const freshUrl = await getPresignedUrl(key);
  return freshUrl || photoUrl;
};

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

// Get admin dashboard stats
export const getAdminDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get counts in parallel
    const [
      totalEmployees,
      activeEmployees,
      totalClients,
      activeClients,
      activeWorkSessions,
      pendingTimeRecords,
      pendingLeaveRequests,
      openTickets,
      weeklyTimeRecords,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      prisma.client.count(),
      prisma.client.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      prisma.workSession.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.timeRecord.count({
        where: { status: 'PENDING' },
      }),
      prisma.leaveRequest.count({
        where: { status: 'PENDING' },
      }),
      prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.timeRecord.findMany({
        where: {
          date: { gte: startOfWeek },
          status: { in: ['APPROVED', 'PENDING'] },
        },
        select: {
          totalMinutes: true,
          overtimeMinutes: true,
        },
      }),
    ]);

    // Calculate weekly hours
    const weeklyMinutes = weeklyTimeRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);
    const weeklyHours = Math.round(weeklyMinutes / 60);

    // Calculate monthly revenue (placeholder - based on hours * rate)
    const monthlyTimeRecords = await prisma.timeRecord.findMany({
      where: {
        date: { gte: startOfMonth },
        status: 'APPROVED',
      },
      select: {
        totalMinutes: true,
        overtimeMinutes: true,
      },
    });

    const monthlyMinutes = monthlyTimeRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);
    const hourlyRate = 35; // Placeholder
    const monthlyRevenue = Math.round((monthlyMinutes / 60) * hourlyRate);

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        totalClients,
        activeClients,
        activeNow: activeWorkSessions,
        pendingApprovals: pendingTimeRecords + pendingLeaveRequests,
        pendingTimeRecords,
        pendingLeaveRequests,
        openTickets,
        weeklyHours,
        monthlyRevenue,
      },
    });
  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    });
  }
};

// Get recent activity
export const getRecentActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;

    // Get recent time records, leave requests, support tickets in parallel
    const [recentTimeRecords, recentLeaveRequests, recentTickets, recentClients] = await Promise.all([
      prisma.timeRecord.findMany({
        where: { status: 'APPROVED' },
        orderBy: { approvedAt: 'desc' },
        take: 5,
        include: {
          employee: { select: { firstName: true, lastName: true } },
          client: { select: { companyName: true } },
        },
      }),
      prisma.leaveRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.client.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { companyName: true, createdAt: true },
      }),
    ]);

    // Combine and format activities
    const activities: any[] = [];

    recentTimeRecords.forEach(tr => {
      if (tr.approvedAt) {
        activities.push({
          id: `tr-${tr.id}`,
          type: 'approval',
          message: `${tr.client?.companyName || 'Client'} approved ${Math.round(((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60 * 10) / 10} hours for ${tr.employee.firstName} ${tr.employee.lastName}`,
          time: tr.approvedAt,
        });
      }
    });

    recentLeaveRequests.forEach(lr => {
      activities.push({
        id: `lr-${lr.id}`,
        type: 'leave',
        message: `${lr.employee.firstName} ${lr.employee.lastName} ${lr.status === 'PENDING' ? 'requested' : lr.status.toLowerCase()} ${lr.leaveType.toLowerCase()} leave`,
        time: lr.createdAt,
      });
    });

    recentTickets.forEach(ticket => {
      activities.push({
        id: `ticket-${ticket.id}`,
        type: 'ticket',
        message: `New support ticket from ${ticket.employee.firstName} ${ticket.employee.lastName}`,
        time: ticket.createdAt,
      });
    });

    recentClients.forEach(client => {
      activities.push({
        id: `client-${client.companyName}`,
        type: 'client',
        message: `New client ${client.companyName} added`,
        time: client.createdAt,
      });
    });

    // Sort by time and limit
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Format time to relative
    const formatRelativeTime = (date: Date) => {
      const now = new Date();
      const diff = now.getTime() - new Date(date).getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes} min ago`;
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      return `${days} day${days > 1 ? 's' : ''} ago`;
    };

    const formattedActivities = activities.slice(0, limit).map(a => ({
      ...a,
      time: formatRelativeTime(a.time),
    }));

    res.json({
      success: true,
      data: formattedActivities,
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity',
    });
  }
};

// Get pending actions
export const getPendingActions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [pendingTimeRecords, pendingLeaveRequests, openTickets] = await Promise.all([
      prisma.timeRecord.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);

    // Get payroll cutoff info
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (5 - today.getDay())); // Friday
    endOfWeek.setHours(18, 0, 0, 0);
    const daysUntilPayroll = Math.ceil((endOfWeek.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const actions = [];

    if (daysUntilPayroll <= 3) {
      actions.push({
        id: 'payroll',
        type: 'payroll',
        title: 'Payroll Deadline',
        description: `Weekly payroll cutoff in ${daysUntilPayroll} day${daysUntilPayroll > 1 ? 's' : ''}`,
        priority: daysUntilPayroll <= 1 ? 'high' : 'medium',
      });
    }

    if (pendingTimeRecords > 0) {
      actions.push({
        id: 'approvals',
        type: 'approval',
        title: `${pendingTimeRecords} Pending Time Records`,
        description: 'Awaiting approval',
        priority: pendingTimeRecords > 10 ? 'high' : 'medium',
      });
    }

    if (pendingLeaveRequests > 0) {
      actions.push({
        id: 'leave',
        type: 'leave',
        title: `${pendingLeaveRequests} Leave Requests`,
        description: 'Awaiting final approval',
        priority: 'medium',
      });
    }

    if (openTickets > 0) {
      actions.push({
        id: 'tickets',
        type: 'ticket',
        title: `${openTickets} Open Tickets`,
        description: 'Employee support requests',
        priority: 'low',
      });
    }

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    console.error('Get pending actions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending actions',
    });
  }
};

// Get client overview for dashboard
export const getClientOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clients = await prisma.client.findMany({
      where: { user: { status: 'ACTIVE' } },
      take: 10,
      include: {
        user: { select: { status: true } },
        employees: {
          where: { isActive: true },
          select: { employeeId: true },
        },
        _count: {
          select: {
            employees: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get active sessions and pending approvals per client
    const clientData = await Promise.all(
      clients.map(async (client) => {
        const employeeIds = client.employees.map(e => e.employeeId);

        const [activeSessions, pendingApprovals] = await Promise.all([
          prisma.workSession.count({
            where: {
              employeeId: { in: employeeIds },
              status: 'ACTIVE',
            },
          }),
          prisma.timeRecord.count({
            where: {
              clientId: client.id,
              status: 'PENDING',
            },
          }),
        ]);

        // Determine health status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (pendingApprovals > 10) status = 'warning';
        if (pendingApprovals > 20) status = 'critical';

        return {
          id: client.id,
          name: client.companyName,
          employees: client._count.employees,
          activeNow: activeSessions,
          pendingApprovals,
          status,
        };
      })
    );

    res.json({
      success: true,
      data: clientData,
    });
  } catch (error) {
    console.error('Get client overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client overview',
    });
  }
};

// Get payroll readiness stats
export const getPayrollReadiness = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get approved and pending hours for the week
    const [approvedRecords, pendingRecords] = await Promise.all([
      prisma.timeRecord.findMany({
        where: {
          date: { gte: startOfWeek, lt: endOfWeek },
          status: 'APPROVED',
        },
        select: { totalMinutes: true, overtimeMinutes: true },
      }),
      prisma.timeRecord.findMany({
        where: {
          date: { gte: startOfWeek, lt: endOfWeek },
          status: 'PENDING',
        },
        select: { totalMinutes: true, overtimeMinutes: true },
      }),
    ]);

    const approvedMinutes = approvedRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);
    const pendingMinutes = pendingRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);

    const approvedHours = Math.round(approvedMinutes / 60);
    const pendingHours = Math.round(pendingMinutes / 60);
    const totalHours = approvedHours + pendingHours;

    // Calculate payroll cutoff
    const payrollCutoff = new Date(today);
    payrollCutoff.setDate(today.getDate() + (5 - today.getDay())); // Friday
    payrollCutoff.setHours(18, 0, 0, 0);
    const daysUntilCutoff = Math.ceil((payrollCutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      data: {
        approvedHours,
        pendingHours,
        totalHours,
        approvedPercentage: totalHours > 0 ? Math.round((approvedHours / totalHours) * 100) : 0,
        payrollCutoff: payrollCutoff.toISOString(),
        daysUntilCutoff,
      },
    });
  } catch (error) {
    console.error('Get payroll readiness error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payroll readiness',
    });
  }
};

// ============================================
// TIME RECORDS ENDPOINTS
// ============================================

// Get all time records (admin view)
export const getAdminTimeRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (clientId && clientId !== 'all') {
      where.clientId = clientId;
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (search) {
      where.employee = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
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
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.timeRecord.count({ where }),
    ]);

    // Format records with presigned URLs refreshed
    const formattedRecords = await Promise.all(
      timeRecords.map(async (record) => ({
        id: record.id,
        employee: `${record.employee.firstName} ${record.employee.lastName}`,
        employeeId: record.employee.id,
        profilePhoto: await refreshProfilePhotoUrl(record.employee.profilePhoto),
        client: record.client?.companyName || 'N/A',
        clientId: record.clientId,
        date: record.date.toISOString().split('T')[0],
        clockIn: record.actualStart ? new Date(record.actualStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        clockOut: record.actualEnd ? new Date(record.actualEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        hours: Math.round(((record.totalMinutes || 0) + (record.overtimeMinutes || 0)) / 60 * 100) / 100,
        regularHours: Math.round((record.totalMinutes || 0) / 60 * 100) / 100,
        overtimeHours: Math.round((record.overtimeMinutes || 0) / 60 * 100) / 100,
        breaks: record.breakMinutes ? Math.round(record.breakMinutes / 60 * 100) / 100 : 0,
        status: record.status.toLowerCase(),
        notes: record.adjustmentNotes,
        approvedAt: record.approvedAt,
      }))
    );

    // Get summary stats
    const [totalRecords, pendingCount, adjustedCount, flaggedCount] = await Promise.all([
      prisma.timeRecord.count({ where: clientId && clientId !== 'all' ? { clientId } : {} }),
      prisma.timeRecord.count({ where: { ...where, status: 'PENDING' } }),
      prisma.timeRecord.count({ where: { ...where, adjustmentNotes: { not: null } } }),
      prisma.timeRecord.count({
        where: {
          ...where,
          overtimeMinutes: { gt: 0 },
          status: 'PENDING',
        }
      }),
    ]);

    res.json({
      success: true,
      data: {
        records: formattedRecords,
        stats: {
          totalRecords,
          pendingReview: pendingCount,
          adjustments: adjustedCount,
          flagged: flaggedCount,
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
    console.error('Get admin time records error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time records',
    });
  }
};

// Adjust a time record
export const adjustTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const recordId = req.params.recordId as string;
    const { clockIn, clockOut, notes } = req.body;
    const adminId = req.user?.userId;

    const record = await prisma.timeRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    // Calculate new minutes if times are provided
    let updateData: any = {
      adjustmentNotes: notes || record.adjustmentNotes,
    };

    if (clockIn && clockOut) {
      const startTime = new Date(`${record.date.toISOString().split('T')[0]}T${clockIn}`);
      const endTime = new Date(`${record.date.toISOString().split('T')[0]}T${clockOut}`);
      const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      const regularMinutes = Math.min(totalMinutes, 480); // 8 hours max regular
      const overtimeMinutes = Math.max(0, totalMinutes - 480);

      updateData = {
        ...updateData,
        actualStart: startTime,
        actualEnd: endTime,
        totalMinutes: regularMinutes,
        overtimeMinutes,
        adjustedBy: adminId,
        adjustedAt: new Date(),
        originalMinutes: record.originalMinutes || record.totalMinutes,
      };
    }

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Time record adjusted successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Adjust time record error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to adjust time record',
    });
  }
};

// ============================================
// APPROVALS ENDPOINTS
// ============================================

// Get all approvals (admin view)
export const getAdminApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || 'pending';
    const type = req.query.type as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    // Map query status to TimeRecord ApprovalStatus
    const timeRecordStatusMap: { [key: string]: ApprovalStatus } = {
      pending: ApprovalStatus.PENDING,
      approved: ApprovalStatus.APPROVED,
      rejected: ApprovalStatus.REJECTED,
    };
    const timeRecordStatus = timeRecordStatusMap[status] || ApprovalStatus.PENDING;

    // Map query status to LeaveRequest LeaveStatus
    const leaveStatusMap: { [key: string]: LeaveStatus } = {
      pending: LeaveStatus.PENDING,
      approved: LeaveStatus.APPROVED,
      rejected: LeaveStatus.REJECTED,
    };
    const leaveStatus = leaveStatusMap[status] || LeaveStatus.PENDING;

    // Get time records
    let timeRecordWhere: any = { status: timeRecordStatus };
    if (type === 'time-adjustment') {
      timeRecordWhere.adjustmentNotes = { not: null };
    } else if (type === 'overtime') {
      timeRecordWhere.overtimeMinutes = { gt: 0 };
    }

    const [timeRecords, leaveRequests] = await Promise.all([
      (!type || type !== 'leave') ? prisma.timeRecord.findMany({
        where: timeRecordWhere,
        include: {
          employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }) : [],
      (!type || type === 'leave') ? prisma.leaveRequest.findMany({
        where: { status: leaveStatus },
        include: {
          employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: type === 'leave' ? skip : 0,
        take: type === 'leave' ? limit : 10,
      }) : [],
    ]);

    // Format approvals with presigned URLs refreshed
    const approvals: any[] = [];

    // Process time records
    const timeRecordApprovals = await Promise.all(
      (timeRecords as any[]).map(async (tr) => {
        const isAdjustment = !!tr.adjustmentNotes;
        const isOvertime = (tr.overtimeMinutes || 0) > 0;
        return {
          id: tr.id,
          type: isAdjustment ? 'time-adjustment' : isOvertime ? 'overtime' : 'timesheet',
          employee: `${tr.employee.firstName} ${tr.employee.lastName}`,
          profilePhoto: await refreshProfilePhotoUrl(tr.employee.profilePhoto),
          client: tr.client?.companyName || 'N/A',
          description: isAdjustment
            ? 'Clock-out time correction'
            : isOvertime
              ? `${Math.round((tr.overtimeMinutes || 0) / 60 * 10) / 10}h overtime`
              : `${Math.round(((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60 * 10) / 10} hours total`,
          date: tr.date.toISOString().split('T')[0],
          details: tr.adjustmentNotes || `${Math.round(((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60 * 10) / 10} hours`,
          submitted: tr.createdAt,
          submittedBy: isAdjustment ? 'System' : 'Employee',
          clientApproved: tr.approvedBy ? true : status === 'approved' ? true : undefined,
          status: tr.status.toLowerCase(),
        };
      })
    );
    approvals.push(...timeRecordApprovals);

    // Process leave requests
    const leaveApprovals = await Promise.all(
      (leaveRequests as any[]).map(async (lr) => {
        const startDate = new Date(lr.startDate);
        const endDate = new Date(lr.endDate);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return {
          id: lr.id,
          type: 'leave',
          employee: `${lr.employee.firstName} ${lr.employee.lastName}`,
          profilePhoto: await refreshProfilePhotoUrl(lr.employee.profilePhoto),
          client: 'N/A',
          description: `${lr.leaveType} Leave Request`,
          date: `${lr.startDate.toISOString().split('T')[0]} - ${lr.endDate.toISOString().split('T')[0]}`,
          details: `${days} day${days > 1 ? 's' : ''} - ${lr.reason || 'No reason provided'}`,
          submitted: lr.createdAt,
          submittedBy: 'Employee',
          status: lr.status.toLowerCase(),
        };
      })
    );
    approvals.push(...leaveApprovals);

    // Sort by submitted date
    approvals.sort((a, b) => new Date(b.submitted).getTime() - new Date(a.submitted).getTime());

    // Get counts
    const [pendingCount, clientApprovedCount, approvedTodayCount, rejectedTodayCount] = await Promise.all([
      prisma.timeRecord.count({ where: { status: 'PENDING' } }),
      prisma.timeRecord.count({
        where: {
          status: 'PENDING',
          approvedBy: { not: null },
        }
      }),
      prisma.timeRecord.count({
        where: {
          status: 'APPROVED',
          approvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.timeRecord.count({
        where: {
          status: 'REJECTED',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const leaveCount = await prisma.leaveRequest.count({ where: { status: 'PENDING' } });

    res.json({
      success: true,
      data: {
        approvals,
        stats: {
          pending: pendingCount + leaveCount,
          clientApproved: clientApprovedCount,
          approvedToday: approvedTodayCount,
          rejectedToday: rejectedTodayCount,
        },
        pagination: {
          page,
          limit,
          total: approvals.length,
        },
      },
    });
  } catch (error) {
    console.error('Get admin approvals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch approvals',
    });
  }
};

// Final approve (admin approval after client approval)
export const finalApproveTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const recordId = req.params.recordId as string;
    const adminId = req.user?.userId;

    const record = await prisma.timeRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Time record approved',
      data: updated,
    });
  } catch (error) {
    console.error('Final approve error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve time record',
    });
  }
};

// Final reject
export const finalRejectTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const recordId = req.params.recordId as string;
    const { reason } = req.body;

    const record = await prisma.timeRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'REJECTED',
        adjustmentNotes: reason || record.adjustmentNotes,
      },
    });

    res.json({
      success: true,
      message: 'Time record rejected',
      data: updated,
    });
  } catch (error) {
    console.error('Final reject error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject time record',
    });
  }
};

// Bulk final approve
export const bulkFinalApprove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { recordIds } = req.body;
    const adminId = req.user?.userId;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      res.status(400).json({ success: false, error: 'No record IDs provided' });
      return;
    }

    const result = await prisma.timeRecord.updateMany({
      where: { id: { in: recordIds }, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `${result.count} time records approved`,
      count: result.count,
    });
  } catch (error) {
    console.error('Bulk final approve error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk approve records',
    });
  }
};

// Approve leave request
export const approveLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const adminId = req.user?.userId;

    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        adminApprovedBy: adminId,
        adminApprovedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Leave request approved',
      data: updated,
    });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve leave request',
    });
  }
};

// Reject leave request
export const rejectLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const { reason } = req.body;
    const adminId = req.user?.userId;

    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    res.json({
      success: true,
      message: 'Leave request rejected',
      data: updated,
    });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject leave request',
    });
  }
};
