import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

// Get client's dashboard stats
export const getClientDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

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
        status: 'IN_PROGRESS',
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
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: {
        regularMinutes: true,
        overtimeMinutes: true,
        status: true,
      },
    });

    const weeklyMinutes = weeklyTimeRecords.reduce((acc, tr) => {
      return acc + (tr.regularMinutes || 0) + (tr.overtimeMinutes || 0);
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
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: {
        regularMinutes: true,
        overtimeMinutes: true,
      },
    });

    const monthlyMinutes = monthlyTimeRecords.reduce((acc, tr) => {
      return acc + (tr.regularMinutes || 0) + (tr.overtimeMinutes || 0);
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

// Get client's workforce with live status
export const getClientWorkforce = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { status: filterStatus, search } = req.query;

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
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName: { contains: search as string, mode: 'insensitive' } },
              { position: { contains: search as string, mode: 'insensitive' } },
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
                  { status: 'IN_PROGRESS' },
                  {
                    clockInTime: { gte: today },
                  },
                ],
              },
              include: {
                breaks: true,
              },
              orderBy: { clockInTime: 'desc' },
              take: 1,
            },
            timeRecords: {
              where: {
                clientId,
                date: { gte: startOfWeek },
              },
              select: {
                regularMinutes: true,
                overtimeMinutes: true,
                date: true,
              },
            },
          },
        },
      },
    });

    // Process employee data with live status
    const workforceData = assignedEmployees.map(ce => {
      const emp = ce.employee;
      const activeSession = emp.workSessions.find(s => s.status === 'IN_PROGRESS');
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
        todayMinutes = todaySession.totalWorkMinutes || 0;
        // If session is still in progress, calculate live duration
        if (activeSession) {
          const clockInTime = new Date(activeSession.clockInTime);
          const now = new Date();
          const elapsedMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);
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
        return acc + (tr.regularMinutes || 0) + (tr.overtimeMinutes || 0);
      }, 0) + (activeSession && new Date(activeSession.clockInTime) >= startOfWeek ? todayMinutes : 0);

      const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins.toString().padStart(2, '0')}m`;
      };

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: emp.position || 'Employee',
        email: emp.user.email,
        profilePhoto: emp.profilePhoto,
        status,
        clockInTime: activeSession?.clockInTime || null,
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
    });

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
    const userId = req.user?.id;

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
        status: 'IN_PROGRESS',
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            profilePhoto: true,
          },
        },
        breaks: {
          where: { endTime: null },
          take: 1,
        },
      },
      orderBy: { clockInTime: 'desc' },
    });

    // Process active employees
    const activeEmployees = activeSessions.map(session => {
      const now = new Date();
      const clockInTime = new Date(session.clockInTime);
      const elapsedMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);

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

      return {
        id: session.employee.id,
        name: `${session.employee.firstName} ${session.employee.lastName}`,
        role: session.employee.position || 'Employee',
        profilePhoto: session.employee.profilePhoto,
        status: currentBreak ? 'break' : 'working',
        clockInTime: session.clockInTime,
        duration: formatDuration(workMinutes),
        durationMinutes: workMinutes,
      };
    });

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
    const userId = req.user?.id;
    const { limit = '10' } = req.query;

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
      const totalHours = ((tr.regularMinutes || 0) + (tr.overtimeMinutes || 0)) / 60;
      approvals.push({
        id: tr.id,
        type: tr.overtimeMinutes && tr.overtimeMinutes > 0 ? 'overtime' : 'time-entry',
        employee: `${tr.employee.firstName} ${tr.employee.lastName}`,
        hours: Math.round(totalHours * 10) / 10,
        date: tr.date,
        description: tr.overtimeMinutes && tr.overtimeMinutes > 0
          ? `${Math.round((tr.overtimeMinutes || 0) / 60 * 10) / 10} overtime hours`
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
    const userId = req.user?.id;
    const { recordId } = req.params;

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

    // Update the time record
    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

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
    const userId = req.user?.id;
    const { recordId } = req.params;
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

    // Update the time record
    const updated = await prisma.timeRecord.update({
      where: { id: recordId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Rejected by client',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

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

// Get weekly hours overview for chart
export const getWeeklyHoursOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

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
        regularMinutes: true,
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
        date: date.toISOString().split('T')[0],
        approved: 0,
        pending: 0,
        total: 0,
      };
    });

    // Populate with actual data
    timeRecords.forEach(tr => {
      const recordDate = new Date(tr.date);
      const dayIndex = recordDate.getDay();
      const hours = ((tr.regularMinutes || 0) + (tr.overtimeMinutes || 0)) / 60;

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
