import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { LeaveStatus, ApprovalStatus } from '@prisma/client';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';
import { formatDuration } from '../utils/timezone';

// Helper function to refresh presigned URL for profile photos
const refreshProfilePhotoUrl = async (photoUrl: string | null | undefined): Promise<string | null> => {
  if (!photoUrl) return null;
  const key = getKeyFromUrl(photoUrl);
  if (!key) return photoUrl;
  const freshUrl = await getPresignedUrl(key);
  return freshUrl || photoUrl;
};

// Helper function to create session log for time record approvals
const createApprovalLog = async (
  timeRecordId: string,
  approverId: string,
  action: 'APPROVED' | 'REJECTED',
  approverName?: string,
  reason?: string
) => {
  try {
    // Get the time record details
    const timeRecord = await prisma.timeRecord.findUnique({
      where: { id: timeRecordId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!timeRecord) return;

    // Find work sessions for this employee on this date
    const recordDate = new Date(timeRecord.date);
    const startOfDay = new Date(recordDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(recordDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await prisma.workSession.findMany({
      where: {
        employeeId: timeRecord.employeeId,
        startTime: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Create a log for each session on that date
    const employeeName = `${timeRecord.employee.firstName} ${timeRecord.employee.lastName}`;
    const message = action === 'APPROVED'
      ? `.: Time entry approved by ${approverName || 'Admin'}`
      : `.: Time entry rejected by ${approverName || 'Admin'}${reason ? `. Reason: ${reason}` : ''}`;

    for (const session of sessions) {
      await prisma.sessionLog.create({
        data: {
          workSessionId: session.id,
          userId: approverId,
          userName: approverName || 'Admin',
          action: action === 'APPROVED' ? 'TIME_APPROVED' : 'TIME_REJECTED',
          message,
          metadata: { timeRecordId, reason },
        },
      });
    }
  } catch (error) {
    console.error('Failed to create approval log:', error);
  }
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
          status: { in: ['APPROVED', 'AUTO_APPROVED', 'PENDING'] },
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

    // Calculate monthly revenue using actual employee billing rates
    const monthlyTimeRecords = await prisma.timeRecord.findMany({
      where: {
        date: { gte: startOfMonth },
        status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      },
      select: {
        totalMinutes: true,
        overtimeMinutes: true,
        employee: {
          select: { billingRate: true },
        },
      },
    });

    const monthlyRevenue = monthlyTimeRecords.reduce((acc, tr) => {
      const totalMins = (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0);
      const rate = tr.employee?.billingRate ? Number(tr.employee.billingRate) : 0;
      return acc + (totalMins / 60) * rate;
    }, 0);
    const roundedMonthlyRevenue = Math.round(monthlyRevenue * 100) / 100;

    // Calculate weekly revenue using actual employee billing rates
    const weeklyBillableRecords = await prisma.timeRecord.findMany({
      where: {
        date: { gte: startOfWeek },
        status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      },
      select: {
        totalMinutes: true,
        overtimeMinutes: true,
        employee: {
          select: { billingRate: true },
        },
      },
    });

    const weeklyRevenue = weeklyBillableRecords.reduce((acc, tr) => {
      const totalMins = (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0);
      const rate = tr.employee?.billingRate ? Number(tr.employee.billingRate) : 0;
      return acc + (totalMins / 60) * rate;
    }, 0);
    const roundedWeeklyRevenue = Math.round(weeklyRevenue * 100) / 100;

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
        weeklyRevenue: roundedWeeklyRevenue,
        monthlyRevenue: roundedMonthlyRevenue,
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

    // Get recent time records, leave requests, support tickets, clock-ins, clients in parallel
    const [recentTimeRecords, recentLeaveRequests, recentTickets, recentClients, recentClockIns] = await Promise.all([
      prisma.timeRecord.findMany({
        where: { status: { in: ['APPROVED', 'AUTO_APPROVED'] } },
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
      prisma.workSession.findMany({
        orderBy: { startTime: 'desc' },
        take: 5,
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    // Combine and format activities
    const activities: any[] = [];

    recentTimeRecords.forEach(tr => {
      if (tr.approvedAt) {
        const hours = Math.round(((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60 * 100) / 100;
        activities.push({
          id: `tr-${tr.id}`,
          type: 'approval',
          message: `${tr.employee.firstName} ${tr.employee.lastName}'s ${hours}h timesheet approved`,
          time: tr.approvedAt,
        });
      }
    });

    recentLeaveRequests.forEach(lr => {
      const action = lr.status === 'PENDING' ? 'requested' : lr.status === 'APPROVED' ? 'approved' : lr.status.toLowerCase();
      activities.push({
        id: `lr-${lr.id}`,
        type: 'leave',
        message: `${lr.employee.firstName} ${lr.employee.lastName} ${action} ${lr.leaveType.replace(/_/g, ' ').toLowerCase()} leave`,
        time: lr.createdAt,
      });
    });

    recentTickets.forEach(ticket => {
      activities.push({
        id: `ticket-${ticket.id}`,
        type: 'ticket',
        message: `${ticket.employee.firstName} ${ticket.employee.lastName} opened a support ticket`,
        time: ticket.createdAt,
      });
    });

    recentClients.forEach(client => {
      activities.push({
        id: `client-${client.companyName}`,
        type: 'client',
        message: `New client ${client.companyName} onboarded`,
        time: client.createdAt,
      });
    });

    recentClockIns.forEach(session => {
      activities.push({
        id: `session-${session.id}`,
        type: 'clock-in',
        message: `${session.employee.firstName} ${session.employee.lastName} clocked in${session.arrivalStatus ? ` (${session.arrivalStatus})` : ''}`,
        time: session.startTime,
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
    const [pendingTimeRecords, pendingLeaveRequests, pendingOvertimeRequests, openTickets] = await Promise.all([
      prisma.timeRecord.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.overtimeRequest.count({ where: { status: 'PENDING' } }),
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
      counts: {
        pendingLeave: pendingLeaveRequests,
        pendingOvertime: pendingOvertimeRequests,
        pendingTimeRecords,
      },
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

    // Get issues per client
    const clientData = await Promise.all(
      clients.map(async (client) => {
        const employeeIds = client.employees.map(e => e.employeeId);

        const [pendingApprovals, pendingLeaves, unapprovedOT] = await Promise.all([
          prisma.timeRecord.count({
            where: {
              clientId: client.id,
              status: 'PENDING',
            },
          }),
          prisma.leaveRequest.count({
            where: {
              employeeId: { in: employeeIds },
              status: 'PENDING',
            },
          }),
          prisma.timeRecord.count({
            where: {
              clientId: client.id,
              overtimeMinutes: { gt: 0 },
              status: 'PENDING',
            },
          }),
        ]);

        // Build issues list
        const issues: string[] = [];
        if (pendingApprovals > 0) issues.push(`${pendingApprovals} pending timesheet${pendingApprovals > 1 ? 's' : ''}`);
        if (unapprovedOT > 0) issues.push(`${unapprovedOT} unapproved OT`);
        if (pendingLeaves > 0) issues.push(`${pendingLeaves} pending leave request${pendingLeaves > 1 ? 's' : ''}`);

        // Determine severity
        const totalIssues = pendingApprovals + pendingLeaves + unapprovedOT;
        let severity: 'red' | 'yellow' | 'blue' | 'green' = 'green';
        if (totalIssues > 20) severity = 'red';
        else if (totalIssues > 5) severity = 'yellow';
        else if (totalIssues > 0) severity = 'blue';

        return {
          id: client.id,
          name: client.companyName,
          employees: client._count.employees,
          issues: issues.join(' · '),
          issueCount: totalIssues,
          severity,
          pendingApprovals,
          pendingLeaves,
          unapprovedOT,
        };
      })
    );

    // Sort by issue count (most issues first)
    clientData.sort((a, b) => b.issueCount - a.issueCount);

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
          status: { in: ['APPROVED', 'AUTO_APPROVED'] },
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

    // Determine date range
    let rangeStart: Date;
    let rangeEnd: Date;
    if (startDate && endDate) {
      rangeStart = new Date(startDate as string);
      rangeEnd = new Date(endDate as string);
    } else {
      const today = new Date();
      rangeStart = new Date(today);
      rangeStart.setDate(today.getDate() - today.getDay());
      rangeStart.setUTCHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 6);
    }
    const rangeEndWithTime = new Date(rangeEnd);
    rangeEndWithTime.setUTCHours(23, 59, 59, 999);

    // Get employees (optionally filtered by client and search)
    const employeeWhere: any = {};
    if (search) {
      employeeWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    let employeeIdFilter: string[] | undefined;
    if (clientId && clientId !== 'all') {
      const clientEmployees = await prisma.clientEmployee.findMany({
        where: { clientId, isActive: true },
        select: { employeeId: true },
      });
      employeeIdFilter = clientEmployees.map(ce => ce.employeeId);
      employeeWhere.id = { in: employeeIdFilter };
    }

    // Build employee filter for work sessions query
    const sessionWhere: any = {
      status: { in: ['COMPLETED', 'ACTIVE', 'ON_BREAK'] },
      startTime: { gte: rangeStart, lte: rangeEndWithTime },
    };
    if (Object.keys(employeeWhere).length > 0) {
      sessionWhere.employee = employeeWhere;
    }

    // Fetch all work sessions in date range
    const sessions = await prisma.workSession.findMany({
      where: sessionWhere,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Get unique employee IDs from sessions
    const sessionEmployeeIds = [...new Set(sessions.map(s => s.employeeId))];

    // Get client assignments for these employees
    const allClientAssignments = sessionEmployeeIds.length > 0 ? await prisma.clientEmployee.findMany({
      where: {
        employeeId: { in: sessionEmployeeIds },
        isActive: true,
      },
      include: {
        client: { select: { id: true, companyName: true, timezone: true } },
      },
    }) : [];

    const employeeClientMap = new Map<string, { clientId: string; companyName: string; timezone: string | null }>();
    for (const a of allClientAssignments) {
      if (!employeeClientMap.has(a.employeeId)) {
        employeeClientMap.set(a.employeeId, { clientId: a.clientId, companyName: a.client.companyName, timezone: a.client.timezone });
      }
    }

    // If filtering by client, only keep sessions from employees assigned to that client
    const filteredSessions = (clientId && clientId !== 'all')
      ? sessions.filter(s => {
          const ci = employeeClientMap.get(s.employeeId);
          return ci && ci.clientId === clientId;
        })
      : sessions;

    // Helper: get date string from a @db.Date field (stored as UTC midnight)
    const toDateStr = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Helper: get date string from a timestamp in a given timezone
    const toTzDateStr = (d: Date, timezone: string) =>
      d.toLocaleDateString('en-CA', { timeZone: timezone });

    // Build session lookup: employeeId_dateStr -> session[] (all sessions per day)
    // Group by date in the employee's client timezone
    const sessionsByEmpDate = new Map<string, typeof filteredSessions>();
    for (const session of filteredSessions) {
      const clientInfo = employeeClientMap.get(session.employeeId);
      const tz = clientInfo?.timezone || 'America/New_York';
      const dateStr = toTzDateStr(session.startTime, tz);
      const key = `${session.employeeId}_${dateStr}`;
      if (!sessionsByEmpDate.has(key)) sessionsByEmpDate.set(key, []);
      sessionsByEmpDate.get(key)!.push(session);
    }

    // Fetch OvertimeRequests in this date range for all relevant employees
    const overtimeRequests = sessionEmployeeIds.length > 0
      ? await prisma.overtimeRequest.findMany({
          where: {
            employeeId: { in: sessionEmployeeIds },
            date: { gte: rangeStart, lte: rangeEndWithTime },
          },
          select: {
            id: true,
            employeeId: true,
            clientId: true,
            date: true,
            type: true,
            requestedMinutes: true,
            requestedStartTime: true,
            requestedEndTime: true,
            estimatedEndTime: true,
            status: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Build OvertimeRequest lookup: employeeId_dateStr -> overtimeRequest[]
    const otRequestMap = new Map<string, typeof overtimeRequests>();
    for (const ot of overtimeRequests) {
      const dateStr = toDateStr(ot.date);
      const key = `${ot.employeeId}_${dateStr}`;
      if (!otRequestMap.has(key)) otRequestMap.set(key, []);
      otRequestMap.get(key)!.push(ot);
    }

    // Fetch TimeRecords for billing data
    const timeRecords = sessionEmployeeIds.length > 0
      ? await prisma.timeRecord.findMany({
          where: {
            employeeId: { in: sessionEmployeeIds },
            date: { gte: rangeStart, lte: rangeEndWithTime },
          },
          select: {
            employeeId: true,
            date: true,
            billingStart: true,
            billingEnd: true,
            billingMinutes: true,
            isLate: true,
            status: true,
          },
        })
      : [];
    const timeRecordMap = new Map<string, typeof timeRecords[0]>();
    for (const tr of timeRecords) {
      const dateStr = toDateStr(tr.date);
      const key = `${tr.employeeId}_${dateStr}`;
      timeRecordMap.set(key, tr);
    }

    // Build per-session records (each session = one row)
    const allRecords: any[] = [];

    for (const session of filteredSessions) {
      const emp = session.employee;
      const clientInfo = employeeClientMap.get(session.employeeId);
      const empTz = clientInfo?.timezone || 'America/New_York';
      const dateStr = toTzDateStr(session.startTime, empTz);

      const isActive = session.status === 'ACTIVE' || session.status === 'ON_BREAK';

      const clockIn = session.startTime;
      const clockOut = session.endTime || null;

      // Get billing data from TimeRecord
      const trKey = `${session.employeeId}_${dateStr}`;
      const dayTimeRecord = timeRecordMap.get(trKey);

      // Always calculate per-session (admin shows per-session rows, same day can have multiple)
      const breakMins = session.totalBreakMinutes || 0;
      const workMinutes = (() => {
        if (!session.endTime) return 0;
        const rawMs = session.endTime.getTime() - session.startTime.getTime();
        const fullMin = Math.floor(rawMs / 60000);
        const remSec = Math.floor((rawMs % 60000) / 1000);
        return Math.max(0, (remSec >= 30 ? fullMin + 1 : fullMin) - breakMins);
      })();

      const hours = Math.round(workMinutes / 60 * 100) / 100;
      const breakHours = Math.round(breakMins / 60 * 100) / 100;
      const recordStatus = isActive ? 'active' : 'pending';

      // Get OT requests for this employee on this date, matched to this session
      const otKey = `${session.employeeId}_${dateStr}`;
      const sameDayOTs = otRequestMap.get(otKey) || [];
      let sessionOTEntries: typeof sameDayOTs;
      if (session.endTime) {
        // Completed session — match OTs by createdAt (auto-created at clock-out)
        const sessionEnd = session.endTime.getTime();
        const sessionStart = session.startTime.getTime();
        sessionOTEntries = sameDayOTs.filter(ot => {
          if (!ot.createdAt) return false;
          const otCreated = ot.createdAt.getTime();
          return otCreated >= sessionStart - 2 * 60000 && otCreated <= sessionEnd + 10 * 60000;
        });
      } else {
        // Active session — show all same-day OTs
        sessionOTEntries = sameDayOTs;
      }

      const overtimeMinutes = sessionOTEntries
        .filter(ot => ot.status === 'APPROVED')
        .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
      const overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100;
      const regularHours = Math.round((hours - overtimeHours) * 100) / 100;

      allRecords.push({
        id: session.id,
        employee: `${emp.firstName} ${emp.lastName}`,
        employeeId: session.employeeId,
        profilePhoto: emp.profilePhoto,
        client: clientInfo?.companyName || 'Unassigned',
        clientId: clientInfo?.clientId || null,
        clientTimezone: clientInfo?.timezone || null,
        date: dateStr,
        clockIn,
        clockOut,
        billingStart: dayTimeRecord?.billingStart || null,
        billingEnd: dayTimeRecord?.billingEnd || null,
        billingMinutes: dayTimeRecord?.billingMinutes || 0,
        isLate: dayTimeRecord?.isLate || false,
        hours,
        regularHours,
        overtimeHours,
        breaks: breakHours,
        status: (() => {
          const trStatus = dayTimeRecord?.status?.toLowerCase() || recordStatus;
          if (trStatus === 'approved' && dayTimeRecord?.status === 'APPROVED') {
            const dayKey = `${session.employeeId}_${dateStr}`;
            const daySessions = sessionsByEmpDate.get(dayKey) || [];
            const allDayOTs = otRequestMap.get(dayKey) || [];
            // If multiple sessions on this day with OT requests,
            // sessions without OT show auto_approved, sessions with OT show approved
            if (daySessions.length > 1 && allDayOTs.length > 0) {
              const thisSessionHasOT = sessionOTEntries.length > 0 || overtimeHours > 0;
              if (!thisSessionHasOT) return 'auto_approved';
            }
          }
          return trStatus;
        })(),
        notes: session.notes || null,
        arrivalStatus: session.arrivalStatus || null,
        lateMinutes: session.lateMinutes || null,
        sessions: [{
          id: session.id,
          clockIn: session.startTime,
          clockOut: session.endTime || null,
          hours,
          breakMinutes: breakMins,
          status: session.status,
          notes: session.notes || null,
        }],
        overtimeEntries: sessionOTEntries.map(ot => ({
          id: ot.id,
          type: ot.type,
          requestedMinutes: ot.requestedMinutes,
          requestedStartTime: ot.requestedStartTime,
          requestedEndTime: ot.requestedEndTime,
          estimatedEndTime: ot.estimatedEndTime,
          status: ot.status,
          reason: ot.reason,
        })),
      });
    }

    // Group records by employee
    const groupedMap = new Map<string, any>();
    for (const record of allRecords) {
      if (!groupedMap.has(record.employeeId)) {
        groupedMap.set(record.employeeId, {
          employeeId: record.employeeId,
          employee: record.employee,
          profilePhoto: record.profilePhoto,
          client: record.client,
          clientId: record.clientId,
          clientTimezone: record.clientTimezone,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalBreaks: 0,
          workedDays: 0,
          hasActive: false,
          dailyRecords: [] as any[],
        });
      }
      const group = groupedMap.get(record.employeeId);
      group.totalHours += record.hours;
      group.regularHours += record.regularHours;
      group.overtimeHours += record.overtimeHours;
      group.totalBreaks += record.breaks;
      group.workedDays++;
      if (record.status === 'active') group.hasActive = true;
      group.dailyRecords.push({
        id: record.id,
        date: record.date,
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        billingStart: record.billingStart,
        billingEnd: record.billingEnd,
        billingMinutes: record.billingMinutes,
        isLate: record.isLate,
        hours: record.hours,
        regularHours: record.regularHours,
        overtimeHours: record.overtimeHours,
        breaks: record.breaks,
        status: record.status,
        notes: record.notes,
        arrivalStatus: record.arrivalStatus,
        lateMinutes: record.lateMinutes,
        sessions: record.sessions || [],
        overtimeEntries: record.overtimeEntries || [],
      });
    }

    // Sort records by date ascending, then by clockIn within same date
    for (const group of groupedMap.values()) {
      group.dailyRecords.sort((a: any, b: any) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime();
      });
      group.totalHours = Math.round(group.totalHours * 100) / 100;
      group.regularHours = Math.round(group.regularHours * 100) / 100;
      group.overtimeHours = Math.round(group.overtimeHours * 100) / 100;
      group.totalBreaks = Math.round(group.totalBreaks * 100) / 100;
      group.status = group.hasActive ? 'active' : 'pending';
    }

    let groupedRecords = Array.from(groupedMap.values());

    // Filter by status if requested
    if (status && status !== 'all') {
      groupedRecords = groupedRecords.filter(r => r.status === status.toLowerCase());
    }

    // Paginate
    const paginatedRecords = groupedRecords.slice((page - 1) * limit, page * limit);

    // Refresh profile photo URLs
    const finalRecords = await Promise.all(
      paginatedRecords.map(async (record) => ({
        ...record,
        profilePhoto: await refreshProfilePhotoUrl(record.profilePhoto),
      }))
    );

    // Summary stats
    const activeCount = groupedRecords.filter(r => r.status === 'active').length;
    const pendingCount = groupedRecords.filter(r => r.status === 'pending').length;
    const flaggedCount = groupedRecords.filter(r => r.overtimeHours > 0).length;

    res.json({
      success: true,
      data: {
        records: finalRecords,
        stats: {
          totalRecords: groupedRecords.length,
          pendingReview: pendingCount,
          adjustments: activeCount,
          flagged: flaggedCount,
        },
        pagination: {
          page,
          limit,
          total: groupedRecords.length,
          totalPages: Math.ceil(groupedRecords.length / limit),
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

// Adjust a time record (legacy — operates on TimeRecord)
export const adjustTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const recordId = req.params.recordId as string;
    const { clockIn, clockOut, notes, sessions: sessionAdjustments, billingIn, billingOut, timezone } = req.body;
    const adminId = req.user?.userId;
    const tz = timezone || 'America/New_York';

    // Helper: convert a date string (YYYY-MM-DD) + time (HH:MM) in the client timezone to UTC Date
    // Uses binary-search approach: create a UTC guess, format it in the target tz, and adjust
    const toUTCDate = (dateStr: string, time: string): Date => {
      const [inputH, inputM] = time.split(':').map(Number);
      // Start with a naive UTC guess
      const guess = new Date(`${dateStr}T${String(inputH).padStart(2, '0')}:${String(inputM).padStart(2, '0')}:00Z`);
      // Format guess in the target timezone to see what local time it maps to
      const fmt = (d: Date) => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
          hour12: false,
        }).formatToParts(d);
        const get = (t: string) => parts.find(p => p.type === t)?.value || '0';
        return { h: parseInt(get('hour'), 10) % 24, m: parseInt(get('minute'), 10) };
      };
      const local = fmt(guess);
      // Calculate the difference between what we want and what we got
      const wantMinutes = inputH * 60 + inputM;
      const gotMinutes = local.h * 60 + local.m;
      let diffMinutes = gotMinutes - wantMinutes;
      // Handle day wrap (e.g., EST is UTC-5, so if we want 9:00 EST, naive UTC gives 9:00 UTC = 4:00 EST, diff = -300)
      if (diffMinutes > 720) diffMinutes -= 1440;
      if (diffMinutes < -720) diffMinutes += 1440;
      // Adjust: subtract the diff to get the correct UTC time
      // If got < want (diff negative), we need to move UTC forward; if got > want, move UTC backward
      return new Date(guess.getTime() - diffMinutes * 60000);
    };

    // New flow: adjust individual work sessions
    if (sessionAdjustments && Array.isArray(sessionAdjustments) && sessionAdjustments.length > 0) {
      const results = [];
      let firstSession: any = null;
      for (const adj of sessionAdjustments) {
        if (!adj.id || (!adj.clockIn && !adj.clockOut)) continue;

        const session = await prisma.workSession.findUnique({ where: { id: adj.id } });
        if (!session) continue;
        if (!firstSession) firstSession = session;

        // Get the date in the client timezone for this session
        const sessionDateInTz = new Date(session.startTime).toLocaleDateString('en-CA', { timeZone: tz });
        const updateData: any = {};

        if (adj.clockIn) {
          updateData.startTime = toUTCDate(sessionDateInTz, adj.clockIn);
        }
        if (adj.clockOut) {
          const endRef = session.endTime || session.startTime;
          const endDateInTz = new Date(endRef).toLocaleDateString('en-CA', { timeZone: tz });
          updateData.endTime = toUTCDate(endDateInTz, adj.clockOut);
        }
        if (adj.notes) {
          updateData.notes = adj.notes;
        }

        const updated = await prisma.workSession.update({
          where: { id: adj.id },
          data: updateData,
        });
        results.push(updated);
      }

      // Update billing times on the TimeRecord if provided
      if ((billingIn || billingOut) && firstSession) {
        const sessionDateInTz = new Date(firstSession.startTime).toLocaleDateString('en-CA', { timeZone: tz });
        const timeRecord = await prisma.timeRecord.findFirst({
          where: {
            employeeId: firstSession.employeeId,
            date: new Date(`${sessionDateInTz}T00:00:00Z`),
          },
        });
        if (timeRecord) {
          const billingUpdateData: any = {
            adjustedBy: adminId,
            adjustedAt: new Date(),
          };
          if (billingIn) {
            billingUpdateData.billingStart = toUTCDate(sessionDateInTz, billingIn);
          }
          if (billingOut) {
            billingUpdateData.billingEnd = toUTCDate(sessionDateInTz, billingOut);
          }
          if (billingIn && billingOut) {
            const bStart = toUTCDate(sessionDateInTz, billingIn);
            const bEnd = toUTCDate(sessionDateInTz, billingOut);
            billingUpdateData.billingMinutes = Math.max(0, Math.round((bEnd.getTime() - bStart.getTime()) / 60000));
          }
          await prisma.timeRecord.update({
            where: { id: timeRecord.id },
            data: billingUpdateData,
          });
        }
      }

      res.json({
        success: true,
        message: `${results.length} session(s) adjusted successfully`,
      });
      return;
    }

    // Legacy flow: adjust TimeRecord directly
    const record = await prisma.timeRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    let updateData: any = {
      adjustmentNotes: notes || record.adjustmentNotes,
    };

    if (clockIn && clockOut) {
      const startTime = new Date(`${record.date.toISOString().split('T')[0]}T${clockIn}Z`);
      const endTime = new Date(`${record.date.toISOString().split('T')[0]}T${clockOut}Z`);
      const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      const regularMinutes = Math.min(totalMinutes, 480);
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
    const clientId = req.query.clientId as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    // Map query status to TimeRecord ApprovalStatus
    const timeRecordStatusMap: { [key: string]: ApprovalStatus | ApprovalStatus[] } = {
      pending: ApprovalStatus.PENDING,
      approved: [ApprovalStatus.APPROVED, ApprovalStatus.AUTO_APPROVED],
      rejected: ApprovalStatus.REJECTED,
      revision_requested: ApprovalStatus.REVISION_REQUESTED,
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
    let timeRecordWhere: any = {
      status: Array.isArray(timeRecordStatus) ? { in: timeRecordStatus } : timeRecordStatus,
    };
    if (clientId) {
      timeRecordWhere.clientId = clientId;
    }
    if (type === 'time-adjustment') {
      timeRecordWhere.adjustmentNotes = { not: null };
    } else if (type === 'overtime') {
      timeRecordWhere.overtimeMinutes = { gt: 0 };
    }

    // Map query status for overtime requests
    const otStatusMap: { [key: string]: string } = {
      pending: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
    };
    const otStatus = otStatusMap[status] || 'PENDING';

    const [timeRecords, leaveRequests, overtimeRequests] = await Promise.all([
      (!type || !['leave', 'overtime-request'].includes(type)) ? prisma.timeRecord.findMany({
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
      (!type || type === 'overtime-request') ? prisma.overtimeRequest.findMany({
        where: { status: otStatus as any },
        orderBy: { createdAt: 'desc' },
        skip: type === 'overtime-request' ? skip : 0,
        take: type === 'overtime-request' ? limit : 10,
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
              ? `${formatDuration(tr.overtimeMinutes || 0)} overtime`
              : `${formatDuration(tr.totalMinutes || 0)} total`,
          date: tr.date.toISOString().split('T')[0],
          details: tr.adjustmentNotes || formatDuration(tr.totalMinutes || 0),
          totalMinutes: tr.totalMinutes || 0,
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
          totalMinutes: days * 8 * 60,
          submitted: lr.createdAt,
          submittedBy: 'Employee',
          status: lr.status.toLowerCase(),
        };
      })
    );
    approvals.push(...leaveApprovals);

    // Process overtime requests (no relations, look up employee/client separately)
    const otApprovals = await Promise.all(
      (overtimeRequests as any[]).map(async (ot) => {
        const [emp, cli] = await Promise.all([
          prisma.employee.findUnique({ where: { id: ot.employeeId }, select: { firstName: true, lastName: true, profilePhoto: true } }),
          prisma.client.findUnique({ where: { id: ot.clientId }, select: { companyName: true } }),
        ]);
        return {
          id: ot.id,
          type: 'overtime-request',
          employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
          profilePhoto: await refreshProfilePhotoUrl(emp?.profilePhoto || null),
          client: cli?.companyName || 'N/A',
          description: `${ot.type === 'SHIFT_EXTENSION' ? 'Shift Extension' : 'Off-Shift'} OT Request`,
          date: ot.date.toISOString().split('T')[0],
          details: `${formatDuration(ot.requestedMinutes || 0)} ${ot.type === 'SHIFT_EXTENSION' ? 'ext' : 'off-shift'}`,
          totalMinutes: ot.requestedMinutes || 0,
          submitted: ot.createdAt,
          submittedBy: 'System',
          status: ot.status.toLowerCase(),
        };
      })
    );
    approvals.push(...otApprovals);

    // Sort by submitted date
    approvals.sort((a, b) => new Date(b.submitted).getTime() - new Date(a.submitted).getTime());

    // Get counts
    const [pendingCount, clientApprovedCount, approvedTodayCount, rejectedTodayCount, revisionRequestedCount] = await Promise.all([
      prisma.timeRecord.count({ where: { status: 'PENDING' } }),
      prisma.timeRecord.count({
        where: {
          status: 'PENDING',
          approvedBy: { not: null },
        }
      }),
      prisma.timeRecord.count({
        where: {
          status: { in: ['APPROVED', 'AUTO_APPROVED'] },
          approvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.timeRecord.count({
        where: {
          status: 'REJECTED',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.timeRecord.count({ where: { status: 'REVISION_REQUESTED' } }),
    ]);

    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const [leaveCount, otPendingCount, approvedLeaveCount, approvedOtCount, rejectedLeaveCount, rejectedOtCount] = await Promise.all([
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.overtimeRequest.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { status: 'APPROVED' } }),
      prisma.overtimeRequest.count({ where: { status: 'APPROVED' } }),
      prisma.leaveRequest.count({ where: { status: 'REJECTED' } }),
      prisma.overtimeRequest.count({ where: { status: 'REJECTED' } }),
    ]);

    // Total approved time records (APPROVED + AUTO_APPROVED)
    const totalApprovedTimeRecords = await prisma.timeRecord.count({
      where: { status: { in: ['APPROVED', 'AUTO_APPROVED'] } },
    });
    const totalRejectedTimeRecords = await prisma.timeRecord.count({
      where: { status: 'REJECTED' },
    });

    res.json({
      success: true,
      data: {
        approvals,
        stats: {
          pending: pendingCount + leaveCount + otPendingCount,
          clientApproved: clientApprovedCount,
          approvedToday: approvedTodayCount,
          rejectedToday: rejectedTodayCount,
          revisionRequested: revisionRequestedCount,
          approved: totalApprovedTimeRecords + approvedLeaveCount + approvedOtCount,
          rejected: totalRejectedTimeRecords + rejectedLeaveCount + rejectedOtCount,
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

    // Get admin details for log
    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { firstName: true, lastName: true },
    });
    const approverName = admin ? `${admin.firstName} ${admin.lastName}` : 'Admin';

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    // Create approval log
    await createApprovalLog(recordId, adminId!, 'APPROVED', approverName);

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

    // Guard: Regular timesheets cannot be denied — only overtime can be rejected
    if ((record.overtimeMinutes || 0) === 0) {
      res.status(400).json({
        success: false,
        error: 'Regular timesheets cannot be denied. Use "Request Revisions" instead.',
      });
      return;
    }

    const adminId = req.user?.userId;

    // Get admin details for log
    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { firstName: true, lastName: true },
    });
    const rejecterName = admin ? `${admin.firstName} ${admin.lastName}` : 'Admin';

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'REJECTED',
        adjustmentNotes: reason || record.adjustmentNotes,
      },
    });

    // Create rejection log
    await createApprovalLog(recordId, adminId!, 'REJECTED', rejecterName, reason);

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

// Request revision for a regular time record (admin)
export const adminRequestRevisionTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const recordId = req.params.recordId as string;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: 'Revision reason is required' });
      return;
    }

    const record = await prisma.timeRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: { select: { id: true, userId: true, firstName: true, lastName: true } },
      },
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    if (record.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Only pending records can have revisions requested' });
      return;
    }

    const adminId = req.user?.userId;

    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { firstName: true, lastName: true },
    });
    const requesterName = admin ? `${admin.firstName} ${admin.lastName}` : 'Admin';

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'REVISION_REQUESTED',
        revisionReason: reason.trim(),
        revisionRequestedBy: adminId,
        revisionRequestedAt: new Date(),
      },
    });

    await createApprovalLog(recordId, adminId!, 'REJECTED', requesterName, `Revision requested: ${reason.trim()}`);

    // Notify employee
    try {
      const { createNotification } = await import('./notification.controller');
      await createNotification(
        record.employee.userId,
        'REVISION_REQUESTED',
        'Revision Requested',
        `${requesterName} has requested revisions for your time entry on ${record.date.toISOString().split('T')[0]}: ${reason.trim()}`,
        { timeRecordId: recordId, reason: reason.trim() },
        '/employee/time-records'
      );
    } catch (e) {
      console.error('Failed to send revision notification:', e);
    }

    res.json({
      success: true,
      message: 'Revision requested successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Admin request revision error:', error);
    res.status(500).json({ success: false, error: 'Failed to request revision' });
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
