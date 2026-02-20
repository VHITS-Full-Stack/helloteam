import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';

// Helper to get local date string from a Date (avoids timezone shift from toISOString)
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Helper to refresh presigned URL for profile photo
const refreshProfilePhotoUrl = async (profilePhoto: string | null): Promise<string | null> => {
  if (!profilePhoto) return null;
  const key = getKeyFromUrl(profilePhoto);
  if (!key) return profilePhoto;
  return await getPresignedUrl(key) || profilePhoto;
};

// Helper function to create session log for time record approvals
const createClientApprovalLog = async (
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
    const message = action === 'APPROVED'
      ? `.: Time entry approved by client: ${approverName || 'Client'}`
      : `.: Time entry rejected by client: ${approverName || 'Client'}${reason ? `. Reason: ${reason}` : ''}`;

    for (const session of sessions) {
      await prisma.sessionLog.create({
        data: {
          workSessionId: session.id,
          userId: approverId,
          userName: approverName || 'Client',
          action: action === 'APPROVED' ? 'CLIENT_APPROVED' : 'CLIENT_REJECTED',
          message,
          metadata: { timeRecordId, reason },
        },
      });
    }
  } catch (error) {
    console.error('Failed to create client approval log:', error);
  }
};

// Get client's dashboard stats
export const getClientDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    const clientId = client.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get all assigned employees
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: {
        clientId,
        isActive: true,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { status: true },
            },
          },
        },
      },
    });

    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    // Get active work sessions (employees currently working)
    const activeWorkSessions = await prisma.workSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
      },
      include: {
        breaks: {
          where: { endTime: null },
        },
      },
    });

    const workingCount = activeWorkSessions.filter(s => s.breaks.length === 0).length;
    const onBreakCount = activeWorkSessions.filter(s => s.breaks.length > 0).length;

    // Get pending time records for approval
    const pendingTimeRecords = await prisma.timeRecord.count({
      where: {
        clientId,
        status: 'PENDING',
      },
    });

    // Get pending leave requests
    const pendingLeaveRequests = await prisma.leaveRequest.count({
      where: {
        employeeId: { in: employeeIds },
        status: 'PENDING',
      },
    });

    // Get weekly hours
    const weeklyTimeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
        status: { in: ['APPROVED', 'AUTO_APPROVED', 'PENDING'] },
      },
      select: {
        totalMinutes: true,
        overtimeMinutes: true,
        status: true,
      },
    });

    const weeklyMinutes = weeklyTimeRecords.reduce((acc, tr) => {
      return acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0);
    }, 0);
    const weeklyHours = Math.round(weeklyMinutes / 60);

    // Calculate estimated monthly billing (placeholder - would be based on rates)
    const monthlyTimeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: { in: ['APPROVED', 'AUTO_APPROVED', 'PENDING'] },
      },
      select: {
        totalMinutes: true,
        overtimeMinutes: true,
      },
    });

    const monthlyMinutes = monthlyTimeRecords.reduce((acc, tr) => {
      return acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0);
    }, 0);

    // Placeholder hourly rate - in production this would come from client policies
    const hourlyRate = 35;
    const monthlyBilling = Math.round((monthlyMinutes / 60) * hourlyRate);

    res.json({
      success: true,
      data: {
        totalEmployees: assignedEmployees.length,
        activeNow: activeWorkSessions.length,
        workingNow: workingCount,
        onBreakNow: onBreakCount,
        pendingApprovals: pendingTimeRecords + pendingLeaveRequests,
        pendingTimeRecords,
        pendingLeaveRequests,
        weeklyHours,
        monthlyBilling,
      },
    });
  } catch (error) {
    console.error('Get client dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    });
  }
};

// Get pending unapproved overtime summary for dashboard alert / login blocker
export const getPendingOvertimeSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const unapprovedOT = await prisma.timeRecord.findMany({
      where: {
        clientId: client.id,
        overtimeMinutes: { gt: 0 },
        status: 'PENDING',
      },
      select: {
        id: true,
        overtimeMinutes: true,
        date: true,
        createdAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (unapprovedOT.length === 0) {
      res.json({
        success: true,
        data: { count: 0, totalHours: '0h', employees: [], entries: [] },
      });
      return;
    }

    const totalMinutes = unapprovedOT.reduce((sum, r) => sum + r.overtimeMinutes, 0);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalHours = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;

    // Unique employees with their total unapproved OT
    const empMap: Record<string, { name: string; minutes: number; count: number }> = {};
    for (const r of unapprovedOT) {
      const name = `${r.employee.firstName} ${r.employee.lastName}`;
      if (!empMap[name]) empMap[name] = { name, minutes: 0, count: 0 };
      empMap[name].minutes += r.overtimeMinutes;
      empMap[name].count += 1;
    }
    const employees = Object.values(empMap).map(e => ({
      name: e.name,
      hours: `${Math.floor(e.minutes / 60)}h ${e.minutes % 60 > 0 ? `${e.minutes % 60}m` : ''}`.trim(),
      entries: e.count,
    }));

    // Oldest entry date for urgency
    const oldestDate = unapprovedOT[0].createdAt;

    res.json({
      success: true,
      data: {
        count: unapprovedOT.length,
        totalHours,
        totalMinutes,
        employees,
        oldestDate,
      },
    });
  } catch (error) {
    console.error('Get pending overtime summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending overtime' });
  }
};

// Get client's workforce with live status
export const getClientWorkforce = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const filterStatus = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    const clientId = client.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Get all assigned employees with their work sessions
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: {
        clientId,
        isActive: true,
        ...(search ? {
          employee: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        } : {}),
      },
      include: {
        employee: {
          include: {
            user: {
              select: { email: true, status: true },
            },
            workSessions: {
              where: {
                OR: [
                  { status: 'ACTIVE' },
                  {
                    startTime: { gte: today },
                  },
                ],
              },
              include: {
                breaks: true,
              },
              orderBy: { startTime: 'desc' },
              take: 1,
            },
            timeRecords: {
              where: {
                clientId,
                date: { gte: startOfWeek },
              },
              select: {
                totalMinutes: true,
                overtimeMinutes: true,
                date: true,
              },
            },
          },
        },
      },
    });

    // Process employee data with live status
    const workforceData = await Promise.all(assignedEmployees.map(async (ce) => {
      const emp = ce.employee;
      const activeSession = emp.workSessions.find(s => s.status === 'ACTIVE');
      const todaySession = emp.workSessions[0];

      // Determine current status
      let status: 'working' | 'break' | 'offline' = 'offline';
      let currentBreak = null;

      if (activeSession) {
        const ongoingBreak = activeSession.breaks.find((b: any) => !b.endTime);
        if (ongoingBreak) {
          status = 'break';
          currentBreak = ongoingBreak;
        } else {
          status = 'working';
        }
      }

      // Calculate today's hours
      let todayMinutes = 0;
      if (todaySession) {
        // Calculate work minutes from session (no totalWorkMinutes field, so calculate it)
        todayMinutes = 0;
        // If session is still in progress, calculate live duration
        if (activeSession) {
          const startTime = new Date(activeSession.startTime);
          const now = new Date();
          const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);
          const breakMinutes = activeSession.breaks.reduce((acc: number, b: any) => {
            if (b.endTime) {
              return acc + Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000);
            } else {
              return acc + Math.floor((now.getTime() - new Date(b.startTime).getTime()) / 60000);
            }
          }, 0);
          todayMinutes = elapsedMinutes - breakMinutes;
        }
      }

      // Calculate weekly hours
      const weeklyMinutes = emp.timeRecords.reduce((acc, tr) => {
        return acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0);
      }, 0) + (activeSession && new Date(activeSession.startTime) >= startOfWeek ? todayMinutes : 0);

      const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins.toString().padStart(2, '0')}m`;
      };

      // Refresh presigned URL for profile photo
      const profilePhoto = await refreshProfilePhotoUrl(emp.profilePhoto);

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: 'Employee',
        email: emp.user.email,
        profilePhoto,
        status,
        startTime: activeSession?.startTime || null,
        todayHours: formatDuration(todayMinutes),
        todayMinutes,
        weeklyHours: formatDuration(weeklyMinutes),
        weeklyMinutes,
        isActive: emp.user.status === 'ACTIVE',
        currentBreak: currentBreak ? {
          startTime: currentBreak.startTime,
          breakType: currentBreak.breakType,
        } : null,
      };
    }));

    // Apply status filter if provided
    let filteredWorkforce = workforceData;
    if (filterStatus && filterStatus !== 'all') {
      filteredWorkforce = workforceData.filter(e => e.status === filterStatus);
    }

    // Calculate summary stats
    const summary = {
      total: workforceData.length,
      working: workforceData.filter(e => e.status === 'working').length,
      onBreak: workforceData.filter(e => e.status === 'break').length,
      offline: workforceData.filter(e => e.status === 'offline').length,
    };

    res.json({
      success: true,
      data: {
        employees: filteredWorkforce,
        summary,
      },
    });
  } catch (error) {
    console.error('Get client workforce error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workforce data',
    });
  }
};

// Get active employees (employees currently working or on break)
export const getActiveEmployees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    const clientId = client.id;

    // Get employee IDs assigned to this client
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: {
        clientId,
        isActive: true,
      },
      select: { employeeId: true },
    });

    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    // Get active work sessions for these employees
    const activeSessions = await prisma.workSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
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
        breaks: {
          where: { endTime: null },
          take: 1,
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Process active employees
    const activeEmployees = await Promise.all(activeSessions.map(async (session) => {
      const now = new Date();
      const startTime = new Date(session.startTime);
      const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);

      // Calculate total break time
      const breakMinutes = session.totalBreakMinutes || 0;
      const currentBreak = session.breaks[0];
      let currentBreakMinutes = 0;
      if (currentBreak) {
        currentBreakMinutes = Math.floor((now.getTime() - new Date(currentBreak.startTime).getTime()) / 60000);
      }

      const workMinutes = elapsedMinutes - breakMinutes - currentBreakMinutes;

      const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins.toString().padStart(2, '0')}m`;
      };

      // Refresh presigned URL for profile photo
      const profilePhoto = await refreshProfilePhotoUrl(session.employee.profilePhoto);

      return {
        id: session.employee.id,
        name: `${session.employee.firstName} ${session.employee.lastName}`,
        role: 'Employee',
        profilePhoto,
        status: currentBreak ? 'break' : 'working',
        startTime: session.startTime,
        duration: formatDuration(workMinutes),
        durationMinutes: workMinutes,
      };
    }));

    res.json({
      success: true,
      data: activeEmployees,
    });
  } catch (error) {
    console.error('Get active employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active employees',
    });
  }
};

// Get pending approvals for the client
export const getPendingApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const limit = (req.query.limit as string) || '10';

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    const clientId = client.id;
    const limitNum = parseInt(limit as string, 10);

    // Get employee IDs assigned to this client
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: {
        clientId,
        isActive: true,
      },
      select: { employeeId: true },
    });

    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    // Get pending time records
    const pendingTimeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        status: 'PENDING',
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: limitNum,
    });

    // Get pending leave requests
    const pendingLeaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'PENDING',
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    });

    // Combine and format approvals
    const approvals: any[] = [];

    pendingTimeRecords.forEach(tr => {
      // Calculate hours from actualStart/actualEnd if totalMinutes is 0
      let totalMinutes = tr.totalMinutes || 0;
      if (totalMinutes === 0 && tr.actualStart && tr.actualEnd) {
        totalMinutes = Math.round(
          (new Date(tr.actualEnd).getTime() - new Date(tr.actualStart).getTime()) / 60000
        ) - (tr.breakMinutes || 0);
      }
      const totalHours = totalMinutes / 60;
      const overtimeMinutes = tr.overtimeMinutes || Math.max(0, totalMinutes - 480);
      approvals.push({
        id: tr.id,
        type: overtimeMinutes > 0 ? 'overtime' : 'time-entry',
        employee: `${tr.employee.firstName} ${tr.employee.lastName}`,
        hours: Math.round(totalHours * 10) / 10,
        date: tr.date,
        description: overtimeMinutes > 0
          ? `${Math.round(overtimeMinutes / 60 * 10) / 10} overtime hours`
          : `${Math.round(totalHours * 10) / 10} regular hours`,
        createdAt: tr.createdAt,
      });
    });

    pendingLeaveRequests.forEach(lr => {
      const startDate = new Date(lr.startDate);
      const endDate = new Date(lr.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      approvals.push({
        id: lr.id,
        type: 'leave',
        employee: `${lr.employee.firstName} ${lr.employee.lastName}`,
        days,
        date: `${lr.startDate.toISOString().split('T')[0]} - ${lr.endDate.toISOString().split('T')[0]}`,
        description: `${lr.leaveType} - ${days} day(s)`,
        reason: lr.reason,
        createdAt: lr.createdAt,
      });
    });

    // Sort by createdAt
    approvals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: approvals.slice(0, limitNum),
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals',
    });
  }
};

// Approve a time record
export const approveTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const recordId = req.params.recordId as string;

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Verify the time record belongs to this client
    const timeRecord = await prisma.timeRecord.findFirst({
      where: {
        id: recordId,
        clientId: client.id,
      },
    });

    if (!timeRecord) {
      res.status(404).json({
        success: false,
        error: 'Time record not found',
      });
      return;
    }

    // Get client name for log
    const clientFull = await prisma.client.findUnique({
      where: { id: client.id },
      select: { companyName: true, contactPerson: true },
    });
    const approverName = clientFull?.contactPerson || clientFull?.companyName || 'Client';

    // Update the time record
    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Create approval log
    await createClientApprovalLog(recordId, userId!, 'APPROVED', approverName);

    res.json({
      success: true,
      message: 'Time record approved',
      data: updated,
    });
  } catch (error) {
    console.error('Approve time record error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve time record',
    });
  }
};

// Reject a time record
export const rejectTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const recordId = req.params.recordId as string;
    const { reason } = req.body;

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Verify the time record belongs to this client
    const timeRecord = await prisma.timeRecord.findFirst({
      where: {
        id: recordId,
        clientId: client.id,
      },
    });

    if (!timeRecord) {
      res.status(404).json({
        success: false,
        error: 'Time record not found',
      });
      return;
    }

    // Guard: Regular timesheets cannot be denied — only overtime can be rejected
    if ((timeRecord.overtimeMinutes || 0) === 0) {
      res.status(400).json({
        success: false,
        error: 'Regular timesheets cannot be denied. Use "Request Revisions" instead.',
      });
      return;
    }

    // Get client name for log
    const clientFull = await prisma.client.findUnique({
      where: { id: client.id },
      select: { companyName: true, contactPerson: true },
    });
    const rejecterName = clientFull?.contactPerson || clientFull?.companyName || 'Client';

    // Update the time record
    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'REJECTED',
      },
    });

    // Create rejection log
    await createClientApprovalLog(recordId, userId!, 'REJECTED', rejecterName, reason);

    res.json({
      success: true,
      message: 'Time record rejected',
      data: updated,
    });
  } catch (error) {
    console.error('Reject time record error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject time record',
    });
  }
};

// Request revision for a regular time record
export const requestRevisionTimeRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const recordId = req.params.recordId as string;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({
        success: false,
        error: 'Revision reason is required',
      });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const timeRecord = await prisma.timeRecord.findFirst({
      where: {
        id: recordId,
        clientId: client.id,
      },
      include: {
        employee: {
          select: { id: true, userId: true, firstName: true, lastName: true },
        },
      },
    });

    if (!timeRecord) {
      res.status(404).json({ success: false, error: 'Time record not found' });
      return;
    }

    if (timeRecord.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Only pending records can have revisions requested' });
      return;
    }

    // Get client name for log
    const clientFull = await prisma.client.findUnique({
      where: { id: client.id },
      select: { companyName: true, contactPerson: true },
    });
    const requesterName = clientFull?.contactPerson || clientFull?.companyName || 'Client';

    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'REVISION_REQUESTED',
        revisionReason: reason.trim(),
        revisionRequestedBy: userId,
        revisionRequestedAt: new Date(),
      },
    });

    // Create log
    await createClientApprovalLog(recordId, userId!, 'REJECTED', requesterName, `Revision requested: ${reason.trim()}`);

    // Notify employee
    try {
      const { createNotification } = await import('./notification.controller');
      await createNotification(
        timeRecord.employee.userId,
        'REVISION_REQUESTED',
        'Revision Requested',
        `${requesterName} has requested revisions for your time entry on ${timeRecord.date.toISOString().split('T')[0]}: ${reason.trim()}`,
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
    console.error('Request revision error:', error);
    res.status(500).json({ success: false, error: 'Failed to request revision' });
  }
};

// Get weekly hours overview for chart
export const getWeeklyHoursOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    // Get the client associated with this user
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    const clientId = client.id;

    // Get the current week's date range
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get time records for the week
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: { gte: startOfWeek },
      },
      select: {
        date: true,
        totalMinutes: true,
        overtimeMinutes: true,
        status: true,
      },
    });

    // Initialize daily data
    const dailyData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return {
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
        date: toLocalDateStr(date),
        approved: 0,
        pending: 0,
        total: 0,
      };
    });

    // Populate with actual data
    timeRecords.forEach(tr => {
      const recordDate = new Date(tr.date);
      const dayIndex = recordDate.getDay();
      const hours = ((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60;

      if (tr.status === 'APPROVED') {
        dailyData[dayIndex].approved += hours;
      } else if (tr.status === 'PENDING') {
        dailyData[dayIndex].pending += hours;
      }
      dailyData[dayIndex].total += hours;
    });

    // Round values
    dailyData.forEach(d => {
      d.approved = Math.round(d.approved * 10) / 10;
      d.pending = Math.round(d.pending * 10) / 10;
      d.total = Math.round(d.total * 10) / 10;
    });

    res.json({
      success: true,
      data: dailyData,
    });
  } catch (error) {
    console.error('Get weekly hours overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly hours overview',
    });
  }
};

// ============================================
// TIME RECORDS ENDPOINTS
// ============================================

// Sync missing TimeRecords from completed WorkSessions for a specific client
const syncClientTimeRecords = async (clientId: string, employeeIds: string[], dateStart: Date, dateEnd: Date): Promise<void> => {
  try {
    if (employeeIds.length === 0) return;

    const endOfDay = new Date(dateEnd);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Find completed work sessions for assigned employees in date range
    const completedSessions = await prisma.workSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'COMPLETED',
        endTime: { not: null },
        startTime: { gte: dateStart, lte: endOfDay },
      },
      orderBy: { startTime: 'asc' },
    });

    for (const session of completedSessions) {
      // Use local date components to avoid timezone shift in PostgreSQL DATE column
      const st = session.startTime;
      const sessionDate = new Date(Date.UTC(st.getFullYear(), st.getMonth(), st.getDate()));

      // Check if a TimeRecord already exists for this employee+client+date
      const existingRecord = await prisma.timeRecord.findUnique({
        where: {
          employeeId_clientId_date: {
            employeeId: session.employeeId,
            clientId,
            date: sessionDate,
          },
        },
      });

      if (existingRecord) continue;

      const totalMinutes = session.endTime
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000) - (session.totalBreakMinutes || 0)
        : 0;

      await prisma.timeRecord.create({
        data: {
          employeeId: session.employeeId,
          clientId,
          date: sessionDate,
          actualStart: session.startTime,
          actualEnd: session.endTime!,
          totalMinutes,
          breakMinutes: session.totalBreakMinutes || 0,
          status: 'PENDING',
        },
      });
    }
  } catch (error) {
    console.error('Sync client time records error:', error);
  }
};

// Helper: get all dates in a range
const getDatesInRange = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setUTCHours(0, 0, 0, 0);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

// Get time records with filtering (weekly view)
// Shows scheduled entries + actual work sessions so records always appear
export const getClientTimeRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const clientId = client.id;

    // Default to current week if no dates provided
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const today = new Date();
      start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    const endOfDay = new Date(end);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Get employee IDs assigned to this client
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: { clientId, isActive: true },
      select: { employeeId: true },
    });
    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    if (employeeIds.length === 0) {
      res.json({
        success: true,
        data: {
          records: [],
          summary: { totalEmployees: 0, totalHours: 0, regularHours: 0, overtimeHours: 0, pendingCount: 0 },
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          dateRange: { start: toLocalDateStr(start), end: toLocalDateStr(end) },
        },
      });
      return;
    }

    // Get work sessions for assigned employees in date range
    const sessionWhere: any = {
      employeeId: { in: employeeIds },
      status: { in: ['COMPLETED', 'ACTIVE', 'ON_BREAK'] },
      startTime: { gte: start, lte: endOfDay },
    };
    if (search) {
      sessionWhere.employee = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
        ],
      };
    }

    const sessions = await prisma.workSession.findMany({
      where: sessionWhere,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
      },
    });

    // Build session lookup: employeeId_dateStr -> session[]
    const sessionsByEmpDate = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const dateStr = toLocalDateStr(session.startTime);
      const key = `${session.employeeId}_${dateStr}`;
      if (!sessionsByEmpDate.has(key)) sessionsByEmpDate.set(key, []);
      sessionsByEmpDate.get(key)!.push(session);
    }

    // Track unique employees from sessions
    const employeeMap = new Map<string, { id: string; firstName: string; lastName: string; profilePhoto: string | null }>();
    for (const session of sessions) {
      if (!employeeMap.has(session.employeeId)) employeeMap.set(session.employeeId, session.employee);
    }

    // Fetch actual TimeRecords for the date range to get approval statuses
    const startUTC = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const endUTC = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        employeeId: { in: employeeIds },
        date: { gte: startUTC, lte: endUTC },
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        totalMinutes: true,
        overtimeMinutes: true,
        status: true,
        revisionReason: true,
      },
    });

    // Build TimeRecord lookup: employeeId_dateStr -> timeRecord
    const timeRecordMap = new Map<string, typeof timeRecords[0]>();
    for (const tr of timeRecords) {
      const dateStr = toLocalDateStr(tr.date);
      const key = `${tr.employeeId}_${dateStr}`;
      timeRecordMap.set(key, tr);
    }

    // Generate weekly data per employee (only from actual work sessions)
    const allDates = getDatesInRange(start, end);
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const employeeRecordsMap = new Map<string, any>();

    for (const [empId, emp] of employeeMap) {
      const empData: any = {
        id: empId,
        employee: `${emp.firstName} ${emp.lastName}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        profilePhoto: emp.profilePhoto,
        dailyHours: {} as Record<string, number>,
        dailyOvertimeHours: {} as Record<string, number>,
        totalMinutes: 0,
        overtimeMinutes: 0,
        approvedOvertimeMinutes: 0,
        unapprovedOvertimeMinutes: 0,
        records: [] as any[],
        hasActiveRecord: false,
        hasOvertimeRecord: false,
      };

      for (const date of allDates) {
        const dayOfWeek = date.getUTCDay();
        const dayKey = dayNames[dayOfWeek];
        const dateStr = toLocalDateStr(date);
        const sessionKey = `${empId}_${dateStr}`;
        const daySessions = sessionsByEmpDate.get(sessionKey);

        if (!daySessions || daySessions.length === 0) continue;

        let dayMinutes = 0;
        let hasActive = false;
        for (const session of daySessions) {
          if (session.status === 'ACTIVE' || session.status === 'ON_BREAK') hasActive = true;
          const totalMins = session.endTime
            ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000) - (session.totalBreakMinutes || 0)
            : 0;
          dayMinutes += totalMins;
        }

        // Look up the actual TimeRecord for this day to get approval status
        const trKey = `${empId}_${dateStr}`;
        const timeRecord = timeRecordMap.get(trKey);
        const dayOvertime = timeRecord ? (timeRecord.overtimeMinutes || 0) : Math.max(0, dayMinutes - 480);
        const dayOvertimeStatus = timeRecord ? timeRecord.status : 'PENDING';

        const dayHours = Math.round((dayMinutes / 60) * 10) / 10;
        empData.dailyHours[dayKey] = (empData.dailyHours[dayKey] || 0) + dayHours;
        if (dayOvertime > 0) {
          empData.dailyOvertimeHours[dayKey] = (empData.dailyOvertimeHours[dayKey] || 0) + Math.round((dayOvertime / 60) * 10) / 10;
        }
        empData.totalMinutes += dayMinutes;
        empData.overtimeMinutes += dayOvertime;

        if (dayOvertime > 0) {
          if (dayOvertimeStatus === 'APPROVED' || dayOvertimeStatus === 'AUTO_APPROVED') {
            empData.approvedOvertimeMinutes += dayOvertime;
          } else {
            empData.unapprovedOvertimeMinutes += dayOvertime;
          }
        }

        empData.records.push({
          id: timeRecord ? timeRecord.id : daySessions[0].id,
          timeRecordId: timeRecord ? timeRecord.id : null,
          date,
          totalMinutes: dayMinutes,
          overtimeMinutes: dayOvertime,
          status: hasActive ? 'ACTIVE' : (dayOvertimeStatus || 'PENDING'),
          overtimeStatus: dayOvertime > 0 ? dayOvertimeStatus : null,
          revisionReason: timeRecord?.revisionReason || null,
        });

        if (hasActive) empData.hasActiveRecord = true;
        if (dayOvertime > 0) empData.hasOvertimeRecord = true;
      }

      if (empData.records.length > 0) {
        employeeRecordsMap.set(empId, empData);
      }
    }

    // Convert to array
    let employeeWeeklyData = await Promise.all(
      Array.from(employeeRecordsMap.values()).map(async (emp: any) => ({
        ...emp,
        profilePhoto: await refreshProfilePhotoUrl(emp.profilePhoto),
        totalHours: Math.round((emp.totalMinutes / 60) * 10) / 10,
        overtimeHours: Math.round((emp.overtimeMinutes / 60) * 10) / 10,
        approvedOvertimeHours: Math.round((emp.approvedOvertimeMinutes / 60) * 10) / 10,
        unapprovedOvertimeHours: Math.round((emp.unapprovedOvertimeMinutes / 60) * 10) / 10,
        status: emp.hasActiveRecord ? 'active' : 'pending',
      }))
    );

    // Filter by status if requested
    if (status && status !== 'all') {
      employeeWeeklyData = employeeWeeklyData.filter((e: any) => e.status === status.toLowerCase());
    }

    // Calculate summary
    const summary = {
      totalEmployees: employeeWeeklyData.length,
      totalHours: Math.round(employeeWeeklyData.reduce((acc: number, e: any) => acc + e.totalHours, 0) * 10) / 10,
      regularHours: Math.round(employeeWeeklyData.reduce((acc: number, e: any) => acc + e.totalHours - e.overtimeHours, 0) * 10) / 10,
      overtimeHours: Math.round(employeeWeeklyData.reduce((acc: number, e: any) => acc + e.overtimeHours, 0) * 10) / 10,
      approvedOvertimeHours: Math.round(employeeWeeklyData.reduce((acc: number, e: any) => acc + (e.approvedOvertimeHours || 0), 0) * 10) / 10,
      unapprovedOvertimeHours: Math.round(employeeWeeklyData.reduce((acc: number, e: any) => acc + (e.unapprovedOvertimeHours || 0), 0) * 10) / 10,
      pendingCount: employeeWeeklyData.filter((e: any) => e.status === 'pending').length,
    };

    res.json({
      success: true,
      data: {
        records: employeeWeeklyData,
        summary,
        pagination: {
          page: 1,
          limit: 50,
          total: employeeWeeklyData.length,
          totalPages: 1,
        },
        dateRange: {
          start: toLocalDateStr(start),
          end: toLocalDateStr(end),
        },
      },
    });
  } catch (error) {
    console.error('Get client time records error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch time records' });
  }
};

// Get approvals list with filtering
export const getClientApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const status = (req.query.status as string) || 'pending';
    const type = req.query.type as string | undefined;
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '20';

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const clientId = client.id;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get employee IDs assigned to this client
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: { clientId, isActive: true },
      select: { employeeId: true },
    });
    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    // Build status filter
    const statusMap: { [key: string]: string } = {
      pending: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
    };
    const dbStatus = statusMap[status] || 'PENDING';

    // Get time records based on filter (skip when type is 'leave' — leave-only requests don't need time records)
    let timeRecords: any[] = [];
    let timeRecordCount = 0;
    if (type !== 'leave') {
      const timeRecordWhere: any = { clientId, status: dbStatus };
      if (type === 'overtime') {
        timeRecordWhere.overtimeMinutes = { gt: 0 };
      } else if (type === 'time-entry') {
        timeRecordWhere.OR = [
          { overtimeMinutes: null },
          { overtimeMinutes: 0 },
        ];
      }

      [timeRecords, timeRecordCount] = await Promise.all([
        prisma.timeRecord.findMany({
          where: timeRecordWhere,
          include: {
            employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.timeRecord.count({ where: timeRecordWhere }),
      ]);
    }

    // Get leave requests
    const leaveRequestWhere: any = {
      employeeId: { in: employeeIds },
      status: dbStatus,
    };
    if (type && type !== 'leave') {
      // Skip leave requests if filtering by time-entry or overtime
    }

    let leaveRequests: any[] = [];
    let leaveRequestCount = 0;
    if (!type || type === 'leave') {
      [leaveRequests, leaveRequestCount] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: leaveRequestWhere,
          include: {
            employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'leave' ? skip : 0,
          take: type === 'leave' ? limitNum : 5,
        }),
        prisma.leaveRequest.count({ where: leaveRequestWhere }),
      ]);
    }

    // Format approvals (refresh presigned URLs for profile photos)
    const approvals: any[] = [];

    // Process time records with presigned URL refresh
    await Promise.all(timeRecords.map(async tr => {
      // Calculate hours from actualStart/actualEnd if totalMinutes is 0
      let totalMinutes = tr.totalMinutes || 0;
      if (totalMinutes === 0 && tr.actualStart && tr.actualEnd) {
        totalMinutes = Math.round(
          (new Date(tr.actualEnd).getTime() - new Date(tr.actualStart).getTime()) / 60000
        ) - (tr.breakMinutes || 0);
      }
      const totalHours = totalMinutes / 60;
      const overtimeMinutes = tr.overtimeMinutes || Math.max(0, totalMinutes - 480);
      const isOvertime = overtimeMinutes > 0;
      const profilePhoto = await refreshProfilePhotoUrl(tr.employee.profilePhoto);
      approvals.push({
        id: tr.id,
        type: isOvertime ? 'overtime' : 'time-entry',
        employee: `${tr.employee.firstName} ${tr.employee.lastName}`,
        profilePhoto,
        description: isOvertime
          ? `${Math.round(overtimeMinutes / 60 * 10) / 10}h overtime`
          : `${Math.round(totalHours * 10) / 10}h regular work`,
        date: tr.date,
        hours: Math.round(totalHours * 10) / 10,
        status: tr.status.toLowerCase(),
        submittedAt: tr.createdAt,
        approvedAt: tr.approvedAt,
      });
    }));

    // Process leave requests with presigned URL refresh
    await Promise.all(leaveRequests.map(async lr => {
      const startDate = new Date(lr.startDate);
      const endDate = new Date(lr.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const profilePhoto = await refreshProfilePhotoUrl(lr.employee.profilePhoto);
      approvals.push({
        id: lr.id,
        type: 'leave',
        employee: `${lr.employee.firstName} ${lr.employee.lastName}`,
        profilePhoto,
        description: `${lr.leaveType} - ${days} day(s)`,
        date: `${lr.startDate.toISOString().split('T')[0]} to ${lr.endDate.toISOString().split('T')[0]}`,
        days,
        reason: lr.reason,
        status: lr.status.toLowerCase(),
        submittedAt: lr.createdAt,
      });
    }));

    // Sort by submittedAt
    approvals.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // Calculate summary counts
    const [pendingTimeCount, pendingLeaveCount, approvedWeekCount, rejectedWeekCount] = await Promise.all([
      prisma.timeRecord.count({ where: { clientId, status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { employeeId: { in: employeeIds }, status: 'PENDING' } }),
      prisma.timeRecord.count({
        where: {
          clientId,
          status: { in: ['APPROVED', 'AUTO_APPROVED'] },
          approvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.timeRecord.count({
        where: {
          clientId,
          status: 'REJECTED',
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const overtimePendingCount = await prisma.timeRecord.count({
      where: { clientId, status: 'PENDING', overtimeMinutes: { gt: 0 } },
    });

    res.json({
      success: true,
      data: {
        approvals,
        summary: {
          pending: pendingTimeCount + pendingLeaveCount,
          overtimePending: overtimePendingCount,
          approvedThisWeek: approvedWeekCount,
          rejectedThisWeek: rejectedWeekCount,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: type === 'leave' ? leaveRequestCount : timeRecordCount,
          totalPages: Math.ceil((type === 'leave' ? leaveRequestCount : timeRecordCount) / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get client approvals error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch approvals' });
  }
};

// Bulk approve time records
export const bulkApproveTimeRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { recordIds } = req.body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      res.status(400).json({ success: false, error: 'No record IDs provided' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Verify all records belong to this client
    const records = await prisma.timeRecord.findMany({
      where: { id: { in: recordIds }, clientId: client.id, status: 'PENDING' },
    });

    if (records.length !== recordIds.length) {
      res.status(400).json({
        success: false,
        error: 'Some records not found or not pending',
        found: records.length,
        requested: recordIds.length,
      });
      return;
    }

    // Bulk update
    const result = await prisma.timeRecord.updateMany({
      where: { id: { in: recordIds }, clientId: client.id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `${result.count} time records approved`,
      count: result.count,
    });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk approve records' });
  }
};

// Bulk reject time records
export const bulkRejectTimeRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { recordIds, reason } = req.body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      res.status(400).json({ success: false, error: 'No record IDs provided' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Verify all records belong to this client and are overtime only
    const records = await prisma.timeRecord.findMany({
      where: { id: { in: recordIds }, clientId: client.id, status: 'PENDING' },
    });

    if (records.length !== recordIds.length) {
      res.status(400).json({
        success: false,
        error: 'Some records not found or not pending',
      });
      return;
    }

    // Guard: Only overtime records can be bulk rejected
    const regularRecords = records.filter(r => (r.overtimeMinutes || 0) === 0);
    if (regularRecords.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Regular timesheets cannot be denied. Use "Request Revisions" instead.',
      });
      return;
    }

    // Bulk update
    const result = await prisma.timeRecord.updateMany({
      where: { id: { in: recordIds }, clientId: client.id },
      data: {
        status: 'REJECTED',
      },
    });

    res.json({
      success: true,
      message: `${result.count} time records rejected`,
      count: result.count,
    });
  } catch (error) {
    console.error('Bulk reject error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk reject records' });
  }
};

// Bulk request revision for regular time records
export const bulkRequestRevision = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { recordIds, reason } = req.body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      res.status(400).json({ success: false, error: 'No record IDs provided' });
      return;
    }

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: 'Revision reason is required' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const records = await prisma.timeRecord.findMany({
      where: { id: { in: recordIds }, clientId: client.id, status: 'PENDING' },
    });

    if (records.length !== recordIds.length) {
      res.status(400).json({ success: false, error: 'Some records not found or not pending' });
      return;
    }

    const result = await prisma.timeRecord.updateMany({
      where: { id: { in: recordIds }, clientId: client.id },
      data: {
        status: 'REVISION_REQUESTED',
        revisionReason: reason.trim(),
        revisionRequestedBy: userId,
        revisionRequestedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Revision requested for ${result.count} time records`,
      count: result.count,
    });
  } catch (error) {
    console.error('Bulk request revision error:', error);
    res.status(500).json({ success: false, error: 'Failed to request revisions' });
  }
};

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// Get analytics data
export const getClientAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const period = (req.query.period as string) || 'month';

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const clientId = client.id;
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(startDate.getDate() - 7);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default: // month
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(startDate.getMonth() - 1);
    }

    // Get assigned employees
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: { clientId, isActive: true },
      include: {
        employee: {
          include: { user: { select: { status: true } } },
        },
      },
    });
    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    // Get active work sessions (currently online)
    const activeSessions = await prisma.workSession.findMany({
      where: { employeeId: { in: employeeIds }, status: 'ACTIVE' },
    });

    // Get time records for current and previous period
    const [currentTimeRecords, previousTimeRecords] = await Promise.all([
      prisma.timeRecord.findMany({
        where: {
          clientId,
          date: { gte: startDate, lte: now },
          status: { in: ['APPROVED', 'AUTO_APPROVED', 'PENDING'] },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      }),
      prisma.timeRecord.findMany({
        where: {
          clientId,
          date: { gte: previousStartDate, lt: startDate },
          status: { in: ['APPROVED', 'AUTO_APPROVED', 'PENDING'] },
        },
      }),
    ]);

    // Calculate current period stats
    const currentHours = currentTimeRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0) / 60;
    const previousHours = previousTimeRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0) / 60;

    const hoursChange = previousHours > 0
      ? Math.round(((currentHours - previousHours) / previousHours) * 1000) / 10
      : 0;

    // Calculate productivity (approved / total)
    const approvedHours = currentTimeRecords
      .filter(tr => tr.status === 'APPROVED' || tr.status === 'AUTO_APPROVED')
      .reduce((acc, tr) => acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0) / 60;
    const productivity = currentHours > 0 ? Math.round((approvedHours / currentHours) * 1000) / 10 : 0;

    // Top performers (by hours)
    const employeeHoursMap = new Map<string, any>();
    currentTimeRecords.forEach(tr => {
      const empId = tr.employeeId;
      if (!employeeHoursMap.has(empId)) {
        employeeHoursMap.set(empId, {
          id: empId,
          name: `${tr.employee.firstName} ${tr.employee.lastName}`,
          profilePhoto: tr.employee.profilePhoto,
          hours: 0,
          approvedHours: 0,
        });
      }
      const emp = employeeHoursMap.get(empId);
      const hours = ((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60;
      emp.hours += hours;
      if (tr.status === 'APPROVED' || tr.status === 'AUTO_APPROVED') emp.approvedHours += hours;
    });

    const topPerformersRaw = Array.from(employeeHoursMap.values())
      .map(e => ({
        ...e,
        hours: Math.round(e.hours * 10) / 10,
        productivity: e.hours > 0 ? Math.round((e.approvedHours / e.hours) * 100) : 0,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // Refresh presigned URLs for top performers
    const topPerformers = await Promise.all(
      topPerformersRaw.map(async e => ({
        ...e,
        profilePhoto: await refreshProfilePhotoUrl(e.profilePhoto),
      }))
    );

    // Weekly activity breakdown
    const weeklyActivity: { day: string; hours: number; target: number }[] = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetHoursPerDay = assignedEmployees.length * 8; // 8 hours per employee

    for (let i = 0; i < 7; i++) {
      const dayRecords = currentTimeRecords.filter(tr => {
        const recordDay = new Date(tr.date).getDay();
        return recordDay === i;
      });
      const dayHours = dayRecords.reduce((acc, tr) =>
        acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0) / 60;

      weeklyActivity.push({
        day: daysOfWeek[i],
        hours: Math.round(dayHours * 10) / 10,
        target: targetHoursPerDay,
      });
    }

    res.json({
      success: true,
      data: {
        overview: {
          activeWorkforce: assignedEmployees.length,
          onlineNow: activeSessions.length,
          hoursThisPeriod: Math.round(currentHours * 10) / 10,
          hoursChange,
          productivity,
        },
        weeklyActivity,
        topPerformers,
        period,
      },
    });
  } catch (error) {
    console.error('Get client analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
};

// ============================================
// SETTINGS ENDPOINTS
// ============================================

// Get client settings (company info + policies + assigned employees)
export const getClientSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const client = await prisma.client.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        clientPolicies: true,
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: true,
                user: {
                  select: {
                    email: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Format assigned employees (refresh presigned URLs)
    const assignedEmployees = await Promise.all(client.employees.map(async ce => ({
      id: ce.employee.id,
      name: `${ce.employee.firstName} ${ce.employee.lastName}`,
      firstName: ce.employee.firstName,
      lastName: ce.employee.lastName,
      email: ce.employee.user.email,
      status: ce.employee.user.status,
      profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
      assignedAt: ce.assignedAt,
    })));

    res.json({
      success: true,
      data: {
        company: {
          id: client.id,
          companyName: client.companyName,
          contactPerson: client.contactPerson,
          phone: client.phone,
          address: client.address,
          timezone: client.timezone,
          email: client.user.email,
          status: client.user.status,
          createdAt: client.createdAt,
          lastLoginAt: client.user.lastLoginAt,
        },
        policies: client.clientPolicies ? {
          allowPaidLeave: client.clientPolicies.allowPaidLeave,
          paidLeaveEntitlementType: client.clientPolicies.paidLeaveEntitlementType,
          annualPaidLeaveDays: client.clientPolicies.annualPaidLeaveDays,
          allowUnpaidLeave: client.clientPolicies.allowUnpaidLeave,
          requireTwoWeeksNotice: client.clientPolicies.requireTwoWeeksNotice,
          allowOvertime: client.clientPolicies.allowOvertime,
          overtimeRequiresApproval: client.clientPolicies.overtimeRequiresApproval,
          autoApproveTimesheets: client.clientPolicies.autoApproveTimesheets,
          autoApproveMinutes: client.clientPolicies.autoApproveMinutes,
        } : {
          allowPaidLeave: false,
          paidLeaveEntitlementType: null,
          annualPaidLeaveDays: 0,
          allowUnpaidLeave: true,
          requireTwoWeeksNotice: true,
          allowOvertime: true,
          overtimeRequiresApproval: true,
          autoApproveTimesheets: false,
          autoApproveMinutes: 15,
        },
        notifications: client.clientPolicies ? {
          timeEntrySubmissions: client.clientPolicies.notifyTimeEntrySubmissions,
          overtimeAlerts: client.clientPolicies.notifyOvertimeAlerts,
          leaveRequests: client.clientPolicies.notifyLeaveRequests,
          weeklySummary: client.clientPolicies.notifyWeeklySummary,
          invoiceNotifications: client.clientPolicies.notifyInvoice,
        } : {
          timeEntrySubmissions: true,
          overtimeAlerts: true,
          leaveRequests: true,
          weeklySummary: false,
          invoiceNotifications: true,
        },
        preferences: client.clientPolicies ? {
          dateFormat: client.clientPolicies.dateFormat,
          timeFormat: client.clientPolicies.timeFormat,
          workWeekStart: client.clientPolicies.workWeekStart,
          overtimeThreshold: client.clientPolicies.overtimeThreshold,
        } : {
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12-hour',
          workWeekStart: 'Sunday',
          overtimeThreshold: 40,
        },
        assignedEmployees,
        employeeCount: assignedEmployees.length,
      },
    });
  } catch (error) {
    console.error('Get client settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

// Update client settings (policies, notifications, preferences)
export const updateClientSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const {
      // Policy fields
      allowPaidLeave,
      paidLeaveEntitlementType,
      annualPaidLeaveDays,
      allowUnpaidLeave,
      requireTwoWeeksNotice,
      allowOvertime,
      overtimeRequiresApproval,
      autoApproveTimesheets,
      autoApproveMinutes,
      // Notification fields
      notifications,
      // Preference fields
      preferences,
    } = req.body;

    const client = await prisma.client.findUnique({
      where: { userId },
      include: { clientPolicies: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Build update data object
    const updateData: any = {};

    // Policy fields
    if (allowPaidLeave !== undefined) updateData.allowPaidLeave = allowPaidLeave;
    if (paidLeaveEntitlementType !== undefined) updateData.paidLeaveEntitlementType = paidLeaveEntitlementType;
    if (annualPaidLeaveDays !== undefined) updateData.annualPaidLeaveDays = parseInt(annualPaidLeaveDays, 10) || 0;
    if (allowUnpaidLeave !== undefined) updateData.allowUnpaidLeave = allowUnpaidLeave;
    if (requireTwoWeeksNotice !== undefined) updateData.requireTwoWeeksNotice = requireTwoWeeksNotice;
    if (allowOvertime !== undefined) updateData.allowOvertime = allowOvertime;
    if (overtimeRequiresApproval !== undefined) updateData.overtimeRequiresApproval = overtimeRequiresApproval;
    if (autoApproveTimesheets !== undefined) updateData.autoApproveTimesheets = autoApproveTimesheets;
    if (autoApproveMinutes !== undefined) updateData.autoApproveMinutes = parseInt(autoApproveMinutes, 10) || 15;

    // Notification fields
    if (notifications) {
      if (notifications.timeEntrySubmissions !== undefined) updateData.notifyTimeEntrySubmissions = notifications.timeEntrySubmissions;
      if (notifications.overtimeAlerts !== undefined) updateData.notifyOvertimeAlerts = notifications.overtimeAlerts;
      if (notifications.leaveRequests !== undefined) updateData.notifyLeaveRequests = notifications.leaveRequests;
      if (notifications.weeklySummary !== undefined) updateData.notifyWeeklySummary = notifications.weeklySummary;
      if (notifications.invoiceNotifications !== undefined) updateData.notifyInvoice = notifications.invoiceNotifications;
    }

    // Preference fields
    if (preferences) {
      if (preferences.dateFormat !== undefined) updateData.dateFormat = preferences.dateFormat;
      if (preferences.timeFormat !== undefined) updateData.timeFormat = preferences.timeFormat;
      if (preferences.workWeekStart !== undefined) updateData.workWeekStart = preferences.workWeekStart;
      if (preferences.overtimeThreshold !== undefined) updateData.overtimeThreshold = preferences.overtimeThreshold;
    }

    // Update or create policies
    if (client.clientPolicies) {
      await prisma.clientPolicy.update({
        where: { clientId: client.id },
        data: updateData,
      });
    } else {
      await prisma.clientPolicy.create({
        data: {
          clientId: client.id,
          allowPaidLeave: allowPaidLeave ?? false,
          paidLeaveEntitlementType,
          annualPaidLeaveDays: parseInt(annualPaidLeaveDays, 10) || 0,
          allowUnpaidLeave: allowUnpaidLeave ?? true,
          requireTwoWeeksNotice: requireTwoWeeksNotice ?? true,
          allowOvertime: allowOvertime ?? true,
          overtimeRequiresApproval: overtimeRequiresApproval ?? true,
          autoApproveTimesheets: autoApproveTimesheets ?? false,
          autoApproveMinutes: autoApproveMinutes ? parseInt(autoApproveMinutes, 10) : 15,
          notifyTimeEntrySubmissions: notifications?.timeEntrySubmissions ?? true,
          notifyOvertimeAlerts: notifications?.overtimeAlerts ?? true,
          notifyLeaveRequests: notifications?.leaveRequests ?? true,
          notifyWeeklySummary: notifications?.weeklySummary ?? false,
          notifyInvoice: notifications?.invoiceNotifications ?? true,
          dateFormat: preferences?.dateFormat ?? 'MM/DD/YYYY',
          timeFormat: preferences?.timeFormat ?? '12-hour',
          workWeekStart: preferences?.workWeekStart ?? 'Sunday',
          overtimeThreshold: preferences?.overtimeThreshold ?? 40,
        },
      });
    }

    // Fetch updated data
    const updatedClient = await prisma.client.findUnique({
      where: { userId },
      include: { clientPolicies: true },
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        policies: updatedClient?.clientPolicies ? {
          allowPaidLeave: updatedClient.clientPolicies.allowPaidLeave,
          paidLeaveEntitlementType: updatedClient.clientPolicies.paidLeaveEntitlementType,
          annualPaidLeaveDays: updatedClient.clientPolicies.annualPaidLeaveDays,
          allowUnpaidLeave: updatedClient.clientPolicies.allowUnpaidLeave,
          requireTwoWeeksNotice: updatedClient.clientPolicies.requireTwoWeeksNotice,
          allowOvertime: updatedClient.clientPolicies.allowOvertime,
          overtimeRequiresApproval: updatedClient.clientPolicies.overtimeRequiresApproval,
          autoApproveTimesheets: updatedClient.clientPolicies.autoApproveTimesheets,
          autoApproveMinutes: updatedClient.clientPolicies.autoApproveMinutes,
        } : null,
        notifications: updatedClient?.clientPolicies ? {
          timeEntrySubmissions: updatedClient.clientPolicies.notifyTimeEntrySubmissions,
          overtimeAlerts: updatedClient.clientPolicies.notifyOvertimeAlerts,
          leaveRequests: updatedClient.clientPolicies.notifyLeaveRequests,
          weeklySummary: updatedClient.clientPolicies.notifyWeeklySummary,
          invoiceNotifications: updatedClient.clientPolicies.notifyInvoice,
        } : null,
        preferences: updatedClient?.clientPolicies ? {
          dateFormat: updatedClient.clientPolicies.dateFormat,
          timeFormat: updatedClient.clientPolicies.timeFormat,
          workWeekStart: updatedClient.clientPolicies.workWeekStart,
          overtimeThreshold: updatedClient.clientPolicies.overtimeThreshold,
        } : null,
      },
    });
  } catch (error) {
    console.error('Update client settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

// ============================================
// BILLING ENDPOINTS
// ============================================

// Get billing summary
export const getClientBilling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        address: true,
        user: {
          select: { email: true },
        },
        clientPolicies: {
          select: { defaultHourlyRate: true },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const clientId = client.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const hourlyRate = client.clientPolicies ? Number(client.clientPolicies.defaultHourlyRate) || 0 : 0;

    // Current period (this month so far)
    const currentMonthRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: { gte: startOfMonth, lte: now },
        status: { in: ['APPROVED', 'AUTO_APPROVED', 'PENDING'] },
      },
    });

    const currentMonthMinutes = currentMonthRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);
    const currentMonthHours = currentMonthMinutes / 60;

    // Calculate days remaining in billing period
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = endOfMonth.getDate() - now.getDate();

    // Get assigned employee count
    const employeeCount = await prisma.clientEmployee.count({
      where: { clientId, isActive: true },
    });

    // YTD totals from real invoices
    const ytdInvoices = await prisma.invoice.findMany({
      where: {
        clientId,
        periodStart: { gte: startOfYear },
        status: { in: ['DRAFT', 'SENT', 'PAID'] },
      },
    });

    const ytdTotal = ytdInvoices.reduce((acc, inv) => acc + Number(inv.total), 0);
    const ytdHours = ytdInvoices.reduce((acc, inv) => acc + Number(inv.totalHours), 0);
    const monthsElapsed = now.getMonth() + 1;
    const avgMonthly = monthsElapsed > 0 ? ytdTotal / monthsElapsed : 0;

    // Fetch real invoices from database
    const invoices = await prisma.invoice.findMany({
      where: { clientId },
      include: { lineItems: true },
      orderBy: { periodStart: 'desc' },
      take: 24,
    });

    res.json({
      success: true,
      data: {
        currentPeriod: {
          period: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
          hoursWorked: Math.round(currentMonthHours * 10) / 10,
          estimatedAmount: Math.round(currentMonthHours * hourlyRate * 100) / 100,
          daysRemaining,
          employees: employeeCount,
          hourlyRate,
        },
        stats: {
          ytdTotal: Math.round(ytdTotal * 100) / 100,
          avgMonthly: Math.round(avgMonthly * 100) / 100,
          totalHours: Math.round(ytdHours * 10) / 10,
        },
        invoices,
        billingInfo: {
          companyName: client.companyName,
          billingEmail: client.user?.email || null,
          billingAddress: client.address || null,
        },
      },
    });
  } catch (error) {
    console.error('Get client billing error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing data' });
  }
};

// ============================================
// LEAVE APPROVAL ENDPOINTS
// ============================================

// Approve leave request (client approval)
export const approveLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const userId = req.user?.userId;

    // Get the client
    const client = await prisma.client.findUnique({
      where: { userId },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Get the leave request and verify it belongs to this client
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    // Verify the leave request is for this client
    if (request.clientId !== client.id) {
      res.status(403).json({ success: false, error: 'Not authorized to approve this request' });
      return;
    }

    // Update leave request with client approval
    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        clientApprovedBy: userId,
        clientApprovedAt: new Date(),
        status: 'APPROVED',
      },
    });

    res.json({
      success: true,
      message: 'Leave request approved',
      data: updated,
    });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve leave request' });
  }
};

// Reject leave request (client rejection)
export const rejectLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const { reason } = req.body;
    const userId = req.user?.userId;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: 'Rejection reason is required' });
      return;
    }

    // Get the client
    const client = await prisma.client.findUnique({
      where: { userId },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Get the leave request and verify it belongs to this client
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    // Verify the leave request is for this client
    if (request.clientId !== client.id) {
      res.status(403).json({ success: false, error: 'Not authorized to reject this request' });
      return;
    }

    // Update leave request as rejected
    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
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
    res.status(500).json({ success: false, error: 'Failed to reject leave request' });
  }
};

// Get groups assigned to this client
export const getClientGroups = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const clientGroups = await prisma.clientGroup.findMany({
      where: { clientId: client.id },
      include: {
        group: {
          include: {
            employees: {
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePhoto: true,
                    user: {
                      select: { email: true, status: true },
                    },
                  },
                },
              },
            },
            _count: { select: { employees: true } },
          },
        },
      },
    });

    const groups = clientGroups.map((cg) => ({
      ...cg.group,
      billingRate: cg.billingRate ? Number(cg.billingRate) : (cg.group.billingRate ? Number(cg.group.billingRate) : null),
      employeeCount: cg.group._count.employees,
      assignedAt: cg.assignedAt,
    }));

    res.json({ success: true, data: { groups } });
  } catch (error) {
    console.error('Get client groups error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch groups' });
  }
};

// Create a new group for this client
export const createClientGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { name, description, billingRate } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Group name is required' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const parsedRate = billingRate ? parseFloat(billingRate) : null;

    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name,
          description,
        },
      });

      await tx.clientGroup.create({
        data: { clientId: client.id, groupId: newGroup.id, billingRate: parsedRate },
      });

      return newGroup;
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: {
        ...group,
        billingRate: parsedRate,
      },
    });
  } catch (error) {
    console.error('Create client group error:', error);
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
};

// Update a group (client-scoped)
export const updateClientGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const groupId = req.params.groupId as string;
    const { name, description, billingRate } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Group name is required' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Verify this group belongs to this client
    const clientGroup = await prisma.clientGroup.findUnique({
      where: { clientId_groupId: { clientId: client.id, groupId } },
    });

    if (!clientGroup) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    const parsedRate = billingRate !== undefined ? (billingRate ? parseFloat(billingRate) : null) : undefined;

    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });

    // Update billing rate on the client-group link (per-client rate)
    if (parsedRate !== undefined) {
      await prisma.clientGroup.update({
        where: { clientId_groupId: { clientId: client.id, groupId } },
        data: { billingRate: parsedRate },
      });
    }

    res.json({
      success: true,
      message: 'Group updated successfully',
      data: {
        ...group,
        billingRate: parsedRate !== undefined ? parsedRate : (clientGroup.billingRate ? Number(clientGroup.billingRate) : null),
      },
    });
  } catch (error) {
    console.error('Update client group error:', error);
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
};

// Delete a group from this client
export const deleteClientGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const groupId = req.params.groupId as string;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Verify this group belongs to this client
    const clientGroup = await prisma.clientGroup.findUnique({
      where: { clientId_groupId: { clientId: client.id, groupId } },
    });

    if (!clientGroup) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Remove the client-group link
      await tx.clientGroup.delete({
        where: { clientId_groupId: { clientId: client.id, groupId } },
      });

      // Deactivate employee assignments from this group
      const groupEmployees = await tx.groupEmployee.findMany({
        where: { groupId },
        select: { employeeId: true },
      });

      for (const ge of groupEmployees) {
        await tx.clientEmployee.updateMany({
          where: { clientId: client.id, employeeId: ge.employeeId },
          data: { isActive: false },
        });
      }
    });

    res.json({ success: true, message: 'Group removed successfully' });
  } catch (error) {
    console.error('Delete client group error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove group' });
  }
};

// Add employees to a group (client-scoped)
export const addEmployeesToClientGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const groupId = req.params.groupId as string;
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ success: false, error: 'Employee IDs array is required' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Verify this group belongs to this client
    const clientGroup = await prisma.clientGroup.findUnique({
      where: { clientId_groupId: { clientId: client.id, groupId } },
    });

    if (!clientGroup) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    for (const employeeId of employeeIds) {
      await prisma.groupEmployee.upsert({
        where: { groupId_employeeId: { groupId, employeeId } },
        create: { groupId, employeeId },
        update: {},
      });
    }

    res.json({ success: true, message: 'Employees added to group successfully' });
  } catch (error) {
    console.error('Add employees to client group error:', error);
    res.status(500).json({ success: false, error: 'Failed to add employees' });
  }
};

// Remove employee from a group (client-scoped)
export const removeEmployeeFromClientGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const groupId = req.params.groupId as string;
    const employeeId = req.params.employeeId as string;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Verify this group belongs to this client
    const clientGroup = await prisma.clientGroup.findUnique({
      where: { clientId_groupId: { clientId: client.id, groupId } },
    });

    if (!clientGroup) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    await prisma.groupEmployee.deleteMany({
      where: { groupId, employeeId },
    });

    res.json({ success: true, message: 'Employee removed from group successfully' });
  } catch (error) {
    console.error('Remove employee from client group error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove employee' });
  }
};

// Get employees assigned to this client (for adding to groups)
export const getClientEmployeesList = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const clientEmployees = await prisma.clientEmployee.findMany({
      where: { clientId: client.id, isActive: true },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            user: {
              select: { email: true, status: true },
            },
          },
        },
      },
    });

    const employees = clientEmployees.map((ce) => ce.employee);

    res.json({ success: true, data: { employees } });
  } catch (error) {
    console.error('Get client employees list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
};
