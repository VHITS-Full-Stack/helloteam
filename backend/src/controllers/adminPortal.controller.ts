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
// Get client-wise pending unapproved overtime (auto-generated, worked without prior approval)
export const getClientWiseUnapprovedOT = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pendingAutoOT = await prisma.overtimeRequest.findMany({
      where: {
        isAutoGenerated: true,
        status: 'PENDING',
      },
      select: {
        id: true,
        clientId: true,
        employeeId: true,
        requestedMinutes: true,
        date: true,
      },
    });

    if (pendingAutoOT.length === 0) {
      res.json({ success: true, data: { clients: [], totalCount: 0, totalMinutes: 0 } });
      return;
    }

    // Get client and employee names
    const clientIds = [...new Set(pendingAutoOT.map(r => r.clientId))];
    const employeeIds = [...new Set(pendingAutoOT.map(r => r.employeeId))];

    const [clients, employees] = await Promise.all([
      prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } }),
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true } }),
    ]);

    const clientMap = new Map(clients.map(c => [c.id, c.companyName]));
    const empMap = new Map(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

    // Group by client
    const clientData: Record<string, { clientName: string; totalMinutes: number; count: number; employees: Record<string, { name: string; minutes: number; count: number }> }> = {};
    for (const ot of pendingAutoOT) {
      const clientName = clientMap.get(ot.clientId) || 'Unknown';
      if (!clientData[ot.clientId]) {
        clientData[ot.clientId] = { clientName, totalMinutes: 0, count: 0, employees: {} };
      }
      clientData[ot.clientId].totalMinutes += ot.requestedMinutes;
      clientData[ot.clientId].count += 1;

      const empName = empMap.get(ot.employeeId) || 'Unknown';
      if (!clientData[ot.clientId].employees[ot.employeeId]) {
        clientData[ot.clientId].employees[ot.employeeId] = { name: empName, minutes: 0, count: 0 };
      }
      clientData[ot.clientId].employees[ot.employeeId].minutes += ot.requestedMinutes;
      clientData[ot.clientId].employees[ot.employeeId].count += 1;
    }

    const fmtHours = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const result = Object.entries(clientData).map(([clientId, data]) => ({
      clientId,
      clientName: data.clientName,
      totalHours: fmtHours(data.totalMinutes),
      totalMinutes: data.totalMinutes,
      count: data.count,
      employees: Object.values(data.employees).map(e => ({
        name: e.name,
        hours: fmtHours(e.minutes),
        count: e.count,
      })),
    }));

    res.json({
      success: true,
      data: {
        clients: result,
        totalCount: pendingAutoOT.length,
        totalMinutes: pendingAutoOT.reduce((s, r) => s + r.requestedMinutes, 0),
      },
    });
  } catch (error) {
    console.error('Get client-wise unapproved OT error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unapproved overtime' });
  }
};

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
      orderBy: { startTime: 'asc' },
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
            isAutoGenerated: true,
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
            id: true,
            employeeId: true,
            date: true,
            billingStart: true,
            billingEnd: true,
            billingMinutes: true,
            isLate: true,
            status: true,
            shiftExtensionMinutes: true,
            shiftExtensionStatus: true,
            shiftExtensionReason: true,
            extraTimeMinutes: true,
            extraTimeStatus: true,
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
    const matchedOTIds = new Set<string>();

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

      // Calculate per-session work minutes from clock in/out, rounded to nearest minute
      const breakMins = session.totalBreakMinutes || 0;
      const workMinutes = (() => {
        if (!session.endTime) return 0;
        const rawMs = session.endTime.getTime() - session.startTime.getTime();
        return Math.max(0, Math.round(rawMs / 60000) - breakMins);
      })();

      const breakHours = Math.round(breakMins / 60 * 100) / 100;
      const recordStatus = isActive ? 'active' : 'pending';

      // Get OT requests for this employee on this date, matched to this session
      const otKey = `${session.employeeId}_${dateStr}`;
      const sameDayOTs = otRequestMap.get(otKey) || [];
      let sessionOTEntries: typeof sameDayOTs;
      if (session.endTime) {
        // Completed session
        const sessionEnd = session.endTime.getTime();
        const sessionStart = session.startTime.getTime();
        sessionOTEntries = sameDayOTs.filter(ot => {
          if (matchedOTIds.has(ot.id)) return false;
          if (!ot.createdAt) return false;
          const otCreated = ot.createdAt.getTime();

          if (ot.isAutoGenerated) {
            // Auto-generated OTs: tight window around session (created at clock-out)
            return otCreated >= sessionStart - 2 * 60000 && otCreated <= sessionEnd + 10 * 60000;
          }

          // Pre-requested OTs: wider window — created anytime from start of day up to session end
          // This handles OTs submitted before clocking in or during any session
          return otCreated <= sessionEnd + 10 * 60000;
        });
      } else {
        // Active session
        const sessionStart = session.startTime.getTime();
        sessionOTEntries = sameDayOTs.filter(ot => {
          if (matchedOTIds.has(ot.id)) return false;
          if (!ot.createdAt) return false;
          const otCreated = ot.createdAt.getTime();

          if (ot.isAutoGenerated) {
            return otCreated >= sessionStart - 2 * 60000;
          }

          // Pre-requested OTs: any created up to now
          return true;
        });
      }
      // Mark matched OTs so they aren't reused by later sessions
      for (const ot of sessionOTEntries) {
        matchedOTIds.add(ot.id);
      }

      const overtimeMinutes = sessionOTEntries
        .filter(ot => {
          if (ot.status !== 'APPROVED') return false;
          // Pre-requested OTs are just approvals — only auto-generated OTs represent actual worked overtime
          if (!ot.isAutoGenerated) return false;
          return true;
        })
        .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
      const overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100;
      // Always use actual work minutes calculated from session clock in/out
      const effectiveMinutes = workMinutes;
      const hours = Math.round(effectiveMinutes / 60 * 100) / 100;
      const regularHours = isActive ? 0 : Math.max(0, Math.round((hours - overtimeHours) * 100) / 100);

      // Detect off-shift sessions: session started after schedule end, OR has auto-generated OFF_SHIFT OT matched to it
      const hasAutoOffShift = sessionOTEntries.some(ot => ot.type === 'OFF_SHIFT' && ot.isAutoGenerated);
      const isOffShiftSession = hasAutoOffShift || (() => {
        if (!session.scheduledEndTime || !session.startTime) return false;
        const [endH, endM] = session.scheduledEndTime.split(':').map(Number);
        const schedEndMinutes = endH * 60 + endM;
        const sessionStart = new Date(session.startTime);
        const startInTz = new Date(sessionStart.toLocaleString('en-US', { timeZone: clientInfo?.timezone || 'UTC' }));
        const sessionStartMinutes = startInTz.getHours() * 60 + startInTz.getMinutes();
        return sessionStartMinutes > schedEndMinutes;
      })();

      // For off-shift sessions, override schedule, late, and regular hours using OT request times
      let effectiveScheduledStart = session.scheduledStartTime || null;
      let effectiveScheduledEnd = session.scheduledEndTime || null;
      let effectiveArrivalStatus = session.arrivalStatus || null;
      let effectiveLateMinutes = session.lateMinutes || null;
      let effectiveIsLate = dayTimeRecord?.isLate || false;
      let effectiveRegularHours = regularHours;

      if (isOffShiftSession) {
        // Look at ALL same-day OFF_SHIFT pre-requested OTs (not just matched to this session)
        // because the pre-requested OT is matched to the regular session where it was submitted
        const sameDayPreRequestedOT = sameDayOTs.find(ot =>
          ot.type === 'OFF_SHIFT' && !ot.isAutoGenerated && ot.requestedStartTime && ot.requestedEndTime
        );

        if (sameDayPreRequestedOT) {
          // Use the pre-requested OT's times as the off-shift schedule
          effectiveScheduledStart = sameDayPreRequestedOT.requestedStartTime;
          effectiveScheduledEnd = sameDayPreRequestedOT.requestedEndTime;

          // Recalculate late against OT requestedStartTime (HH:MM string)
          const [otH, otM] = sameDayPreRequestedOT.requestedStartTime.split(':').map(Number);
          const otStartMinutes = otH * 60 + otM;
          const sessionStart = new Date(session.startTime);
          const startInTz = new Date(sessionStart.toLocaleString('en-US', { timeZone: clientInfo?.timezone || 'UTC' }));
          const sessionStartMinutes = startInTz.getHours() * 60 + startInTz.getMinutes();
          const diffMin = sessionStartMinutes - otStartMinutes;
          if (diffMin > 0) {
            effectiveArrivalStatus = 'Late';
            effectiveLateMinutes = diffMin;
            effectiveIsLate = true;
          } else {
            effectiveArrivalStatus = diffMin < 0 ? 'Early' : 'On Time';
            effectiveLateMinutes = null;
            effectiveIsLate = false;
          }
        } else {
          // No pre-requested OT: keep the regular schedule visible but clear late/arrival
          // (late against regular schedule is not meaningful for off-shift sessions)
          // If this session has no stored schedule, try the first session of the day
          if (!effectiveScheduledStart && !effectiveScheduledEnd) {
            const empDayKey = `${session.employeeId}_${dateStr}`;
            const empDaySessions = sessionsByEmpDate.get(empDayKey) || [];
            const firstSession = empDaySessions[0];
            if (firstSession && firstSession.id !== session.id) {
              effectiveScheduledStart = firstSession.scheduledStartTime || null;
              effectiveScheduledEnd = firstSession.scheduledEndTime || null;
            }
          }
          effectiveArrivalStatus = 'No Schedule';
          effectiveLateMinutes = null;
          effectiveIsLate = false;
        }
        // Off-shift sessions: all time is OT, regular = 0
        effectiveRegularHours = 0;
      }

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
        scheduledStart: effectiveScheduledStart,
        scheduledEnd: effectiveScheduledEnd,
        billingStart: isActive ? null : (dayTimeRecord?.billingStart || null),
        billingEnd: isActive ? null : (dayTimeRecord?.billingEnd || null),
        billingMinutes: isActive ? 0 : (dayTimeRecord?.billingMinutes || 0),
        isLate: effectiveIsLate,
        hours,
        regularHours: effectiveRegularHours,
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
        arrivalStatus: effectiveArrivalStatus,
        lateMinutes: effectiveLateMinutes,
        sessions: [{
          id: session.id,
          clockIn: session.startTime,
          clockOut: session.endTime || null,
          hours,
          breakMinutes: breakMins,
          status: session.status,
          notes: session.notes || null,
        }],
        overtimeEntries: (() => {
          const entries = sessionOTEntries.map(ot => ({
            id: ot.id,
            type: ot.type,
            requestedMinutes: ot.requestedMinutes,
            requestedStartTime: ot.requestedStartTime,
            requestedEndTime: ot.requestedEndTime,
            estimatedEndTime: ot.estimatedEndTime,
            status: ot.status,
            isAutoGenerated: ot.isAutoGenerated || false,
            reason: ot.reason,
          }));
          // Synthetic entries for old records with no OvertimeRequest
          // Only add synthetic entries for the session they belong to:
          // - shiftExtension: only for sessions that ended after schedule (not off-shift sessions)
          // - extraTime: only for off-shift sessions (not regular sessions)
          if (entries.length === 0 && dayTimeRecord && !isActive) {
            const trExtMins = dayTimeRecord.shiftExtensionMinutes || 0;
            const trExtraMins = dayTimeRecord.extraTimeMinutes || 0;
            if (trExtMins > 0 && !isOffShiftSession) {
              const extStatus = dayTimeRecord.shiftExtensionStatus || 'UNAPPROVED';
              entries.push({
                id: `synth-ext-${dayTimeRecord.id}-${session.id}`,
                type: 'SHIFT_EXTENSION',
                requestedMinutes: trExtMins,
                requestedStartTime: null as any,
                requestedEndTime: null as any,
                estimatedEndTime: null as any,
                status: extStatus === 'APPROVED' ? 'APPROVED' : extStatus === 'DENIED' ? 'REJECTED' : 'PENDING',
                isAutoGenerated: true,
                reason: dayTimeRecord.shiftExtensionReason || 'Worked past shift end',
              });
            }
            if (trExtraMins > 0 && isOffShiftSession) {
              const extraStatus = dayTimeRecord.extraTimeStatus || 'UNAPPROVED';
              entries.push({
                id: `synth-extra-${dayTimeRecord.id}-${session.id}`,
                type: 'EXTRA_TIME' as any,
                requestedMinutes: trExtraMins,
                requestedStartTime: null as any,
                requestedEndTime: null as any,
                estimatedEndTime: null as any,
                status: extraStatus === 'APPROVED' ? 'APPROVED' : extraStatus === 'DENIED' ? 'REJECTED' : 'PENDING',
                isAutoGenerated: true,
                reason: 'Extra time worked',
              });
            }
          }
          return entries;
        })(),
      });
    }

    // Filter by status if provided
    const filteredRecords = status && status !== 'all'
      ? allRecords.filter(r => {
          const s = status.toLowerCase();
          if (s === 'approved') return r.status === 'approved' || r.status === 'auto_approved';
          return r.status === s;
        })
      : allRecords;

    // Group records by employee
    const groupedMap = new Map<string, any>();
    for (const record of filteredRecords) {
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
        scheduledStart: record.scheduledStart,
        scheduledEnd: record.scheduledEnd,
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

    // Sort records by date descending, then by clockIn ascending within same date
    for (const group of groupedMap.values()) {
      group.dailyRecords.sort((a: any, b: any) => {
        const dateCmp = b.date.localeCompare(a.date);
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
    const isAllStatus = status === 'all';
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
    const timeRecordStatus = isAllStatus ? undefined : (timeRecordStatusMap[status] || ApprovalStatus.PENDING);

    // Map query status to LeaveRequest LeaveStatus
    const leaveStatusMap: { [key: string]: LeaveStatus } = {
      pending: LeaveStatus.PENDING,
      approved: LeaveStatus.APPROVED,
      rejected: LeaveStatus.REJECTED,
    };
    const leaveStatus = isAllStatus ? undefined : (leaveStatusMap[status] || LeaveStatus.PENDING);

    // Map query status for overtime requests
    const otStatusMap: { [key: string]: string } = {
      pending: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
    };
    const otStatus = isAllStatus ? undefined : (otStatusMap[status] || 'PENDING');

    // Get time records
    let timeRecordWhere: any = {};
    if (timeRecordStatus) {
      timeRecordWhere.status = Array.isArray(timeRecordStatus) ? { in: timeRecordStatus } : timeRecordStatus;
    }
    if (clientId) {
      timeRecordWhere.clientId = clientId;
    }
    if (type === 'time-adjustment') {
      timeRecordWhere.adjustmentNotes = { not: null };
    } else if (type === 'overtime') {
      timeRecordWhere.overtimeMinutes = { gt: 0 };
    }

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
        where: {
          ...(leaveStatus ? { status: leaveStatus } : {}),
          ...(clientId ? { clientId } : {}),
        },
        include: {
          employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: type === 'leave' ? skip : 0,
        take: type === 'leave' ? limit : 10,
      }) : [],
      (!type || type === 'overtime-request') ? prisma.overtimeRequest.findMany({
        where: otStatus ? { status: otStatus as any } : {},
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
          clockIn: tr.actualStart || null,
          clockOut: tr.actualEnd || null,
          scheduledStart: tr.scheduledStart || null,
          scheduledEnd: tr.scheduledEnd || null,
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
          client: lr.client?.companyName || 'N/A',
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

    // Also approve any matching OvertimeRequest records so the pending count stays in sync
    await prisma.overtimeRequest.updateMany({
      where: {
        employeeId: record.employeeId,
        clientId: record.clientId,
        date: record.date,
        status: { in: ['PENDING'] },
      },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    // Also update shiftExtensionStatus / extraTimeStatus on the time record if unapproved
    const statusUpdates: any = {};
    if (['PENDING', 'UNAPPROVED', 'NONE'].includes(record.shiftExtensionStatus || '') && (record.shiftExtensionMinutes || 0) > 0) {
      statusUpdates.shiftExtensionStatus = 'APPROVED';
    }
    if (['PENDING', 'UNAPPROVED', 'NONE'].includes(record.extraTimeStatus || '') && (record.extraTimeMinutes || 0) > 0) {
      statusUpdates.extraTimeStatus = 'APPROVED';
    }
    if (Object.keys(statusUpdates).length > 0) {
      await prisma.timeRecord.update({
        where: { id: recordId },
        data: statusUpdates,
      });
    }

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

// ============================================
// RAISE REQUESTS
// ============================================

/**
 * Get all client requests (bonuses + raises) with optional status/type filter
 */
export const getRaiseRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type } = req.query;
    const where: any = {};
    if (status && status !== 'all') {
      where.status = (status as string).toUpperCase();
    }
    if (type && type !== 'all') {
      where.type = (type as string).toUpperCase();
    }

    const requests = await prisma.clientRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true, payableRate: true, billingRate: true } },
        client: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = await Promise.all(
      requests.map(async (rr) => {
        const profilePhoto = await refreshProfilePhotoUrl(rr.employee.profilePhoto);
        const clientEmployee = await prisma.clientEmployee.findFirst({
          where: { employeeId: rr.employeeId, clientId: rr.clientId, isActive: true },
          select: { hourlyRate: true },
        });
        return {
          ...rr,
          amount: rr.amount ? Number(rr.amount) : null,
          payRate: rr.payRate ? Number(rr.payRate) : null,
          billRate: rr.billRate ? Number(rr.billRate) : null,
          currentPayRate: rr.employee.payableRate ? Number(rr.employee.payableRate) : null,
          currentBillRate: clientEmployee?.hourlyRate ? Number(clientEmployee.hourlyRate) : null,
          employee: { ...rr.employee, profilePhoto },
        };
      })
    );

    res.json({ success: true, data: { requests: data } });
  } catch (error) {
    console.error('Get client requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
};

/**
 * Approve a client request (bonus or raise)
 */
export const approveRaiseRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let raiseId = req.params.raiseId;
    if (Array.isArray(raiseId)) raiseId = raiseId[0];
    const userId = req.user?.userId;
    const { adminNotes, newPayRate } = req.body;

    const request = await prisma.clientRequest.findUnique({
      where: { id: raiseId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, billingRate: true, payableRate: true } },
        client: { select: { id: true, companyName: true } },
      },
    });

    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Request is not pending' });

    if (request.type === 'BONUS') {
      // Approve bonus — create PayrollAdjustment
      await prisma.$transaction(async (tx) => {
        await tx.clientRequest.update({
          where: { id: raiseId },
          data: { status: 'APPROVED', reviewedBy: userId, reviewedAt: new Date(), adminNotes: adminNotes?.trim() || null },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await tx.payrollAdjustment.create({
          data: {
            employeeId: request.employeeId,
            type: 'BONUS',
            amount: Number(request.amount),
            reason: request.reason || `Bonus from client: ${request.client.companyName}`,
            periodStart: today,
            periodEnd: today,
            createdBy: userId!,
          },
        });
      });

      res.json({ success: true, message: 'Bonus approved and added to payroll' });
    } else {
      // Approve raise — update rates (admin can override pay rate)
      const finalPayRate = newPayRate != null ? Number(newPayRate) : Number(request.payRate);
      const newBillRate = Number(request.billRate);

      const clientEmployee = await prisma.clientEmployee.findFirst({
        where: { employeeId: request.employeeId, clientId: request.clientId, isActive: true },
      });

      const oldBillingRate = request.employee.billingRate ? Number(request.employee.billingRate) : 0;
      const oldPayableRate = request.employee.payableRate ? Number(request.employee.payableRate) : 0;

      await prisma.$transaction(async (tx) => {
        await tx.clientRequest.update({
          where: { id: raiseId },
          data: { status: 'APPROVED', reviewedBy: userId, reviewedAt: new Date(), adminNotes: adminNotes?.trim() || null },
        });

        if (clientEmployee) {
          await tx.clientEmployee.update({ where: { id: clientEmployee.id }, data: { hourlyRate: newBillRate } });
        }

        await tx.employee.update({
          where: { id: request.employeeId },
          data: { billingRate: newBillRate, payableRate: finalPayRate },
        });

        const changeDate = request.effectiveDate || new Date();
        if (newBillRate !== oldBillingRate) {
          await tx.rateChangeHistory.create({
            data: {
              employeeId: request.employeeId, clientId: request.clientId, changedBy: userId!,
              changeDate, rateType: 'BILLING_RATE', oldValue: oldBillingRate, newValue: newBillRate,
              source: 'CLIENT_RAISE_REQUEST', notes: `Raise approved — requested by ${request.client.companyName}`,
            },
          });
        }
        if (finalPayRate !== oldPayableRate) {
          await tx.rateChangeHistory.create({
            data: {
              employeeId: request.employeeId, clientId: request.clientId, changedBy: userId!,
              changeDate, rateType: 'PAYABLE_RATE', oldValue: oldPayableRate, newValue: finalPayRate,
              source: 'CLIENT_RAISE_REQUEST', notes: `Raise approved — requested by ${request.client.companyName}`,
            },
          });
        }
      });

      res.json({ success: true, message: 'Raise approved and rates updated' });
    }
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
};

/**
 * Reject a client request (bonus or raise)
 */
export const rejectRaiseRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let raiseId = req.params.raiseId;
    if (Array.isArray(raiseId)) raiseId = raiseId[0];
    const userId = req.user?.userId;
    const { adminNotes } = req.body;

    const request = await prisma.clientRequest.findUnique({ where: { id: raiseId } });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Request is not pending' });

    await prisma.clientRequest.update({
      where: { id: raiseId },
      data: { status: 'REJECTED', reviewedBy: userId, reviewedAt: new Date(), adminNotes: adminNotes?.trim() || null },
    });

    res.json({ success: true, message: `${request.type === 'BONUS' ? 'Bonus' : 'Raise'} request rejected` });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
};
