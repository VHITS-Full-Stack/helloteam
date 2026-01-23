import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

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
        status: { in: ['APPROVED', 'PENDING'] },
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
        status: { in: ['APPROVED', 'PENDING'] },
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

// Get client's workforce with live status
export const getClientWorkforce = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
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
    const workforceData = assignedEmployees.map(ce => {
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
        todayMinutes = todaySession.totalWorkMinutes || 0;
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

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: 'Employee',
        email: emp.user.email,
        profilePhoto: emp.profilePhoto,
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
    const activeEmployees = activeSessions.map(session => {
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

      return {
        id: session.employee.id,
        name: `${session.employee.firstName} ${session.employee.lastName}`,
        role: 'Employee',
        profilePhoto: session.employee.profilePhoto,
        status: currentBreak ? 'break' : 'working',
        startTime: session.startTime,
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
    const userId = req.user?.userId;
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
      const totalHours = ((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60;
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
    const userId = req.user?.userId;
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
        approvedBy: userId,
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
    const userId = req.user?.userId;
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
        rejectedBy: userId,
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

// Get time records with filtering (weekly view)
export const getClientTimeRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { startDate, endDate, status, search, page = '1', limit = '50' } = req.query;

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

    // Default to current week if no dates provided
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const today = new Date();
      start = new Date(today);
      start.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6); // End of week (Saturday)
      end.setHours(23, 59, 59, 999);
    }

    // Get employee IDs assigned to this client
    const assignedEmployees = await prisma.clientEmployee.findMany({
      where: { clientId, isActive: true },
      select: { employeeId: true },
    });
    const employeeIds = assignedEmployees.map(ce => ce.employeeId);

    // Build where clause
    const whereClause: any = {
      clientId,
      date: { gte: start, lte: end },
    };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.employee = {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    // Get time records
    const [timeRecords, total] = await Promise.all([
      prisma.timeRecord.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { employee: { firstName: 'asc' } }],
        skip,
        take: limitNum,
      }),
      prisma.timeRecord.count({ where: whereClause }),
    ]);

    // Group records by employee for weekly view
    const employeeRecordsMap = new Map<string, any>();

    timeRecords.forEach(record => {
      const empId = record.employeeId;
      if (!employeeRecordsMap.has(empId)) {
        employeeRecordsMap.set(empId, {
          id: empId,
          employee: `${record.employee.firstName} ${record.employee.lastName}`,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
          profilePhoto: record.employee.profilePhoto,
          dailyHours: {},
          totalMinutes: 0,
          overtimeMinutes: 0,
          records: [],
          hasOvertimeRecord: false,
          hasPendingRecord: false,
        });
      }

      const empData = employeeRecordsMap.get(empId);
      const dayOfWeek = new Date(record.date).getDay();
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayKey = dayNames[dayOfWeek];

      const totalHours = ((record.totalMinutes || 0) + (record.overtimeMinutes || 0)) / 60;
      empData.dailyHours[dayKey] = Math.round(totalHours * 10) / 10;
      empData.totalMinutes += (record.totalMinutes || 0) + (record.overtimeMinutes || 0);
      empData.overtimeMinutes += record.overtimeMinutes || 0;
      empData.records.push({
        id: record.id,
        date: record.date,
        totalMinutes: record.totalMinutes,
        overtimeMinutes: record.overtimeMinutes,
        status: record.status,
        notes: record.notes,
      });

      if (record.overtimeMinutes && record.overtimeMinutes > 0) {
        empData.hasOvertimeRecord = true;
      }
      if (record.status === 'PENDING') {
        empData.hasPendingRecord = true;
      }
    });

    // Convert to array and calculate totals
    const employeeWeeklyData = Array.from(employeeRecordsMap.values()).map(emp => ({
      ...emp,
      totalHours: Math.round((emp.totalMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((emp.overtimeMinutes / 60) * 10) / 10,
      status: emp.hasPendingRecord ? 'pending' : 'approved',
    }));

    // Calculate summary
    const summary = {
      totalEmployees: employeeWeeklyData.length,
      totalHours: Math.round(employeeWeeklyData.reduce((acc, e) => acc + e.totalHours, 0) * 10) / 10,
      regularHours: Math.round(employeeWeeklyData.reduce((acc, e) => acc + e.totalHours - e.overtimeHours, 0) * 10) / 10,
      overtimeHours: Math.round(employeeWeeklyData.reduce((acc, e) => acc + e.overtimeHours, 0) * 10) / 10,
      pendingCount: employeeWeeklyData.filter(e => e.status === 'pending').length,
    };

    res.json({
      success: true,
      data: {
        records: employeeWeeklyData,
        summary,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
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
    const { status = 'pending', type, page = '1', limit = '20' } = req.query;

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
    const dbStatus = statusMap[status as string] || 'PENDING';

    // Get time records based on filter
    const timeRecordWhere: any = { clientId, status: dbStatus };
    if (type === 'overtime') {
      timeRecordWhere.overtimeMinutes = { gt: 0 };
    } else if (type === 'time-entry') {
      timeRecordWhere.OR = [
        { overtimeMinutes: null },
        { overtimeMinutes: 0 },
      ];
    }

    const [timeRecords, timeRecordCount] = await Promise.all([
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

    // Format approvals
    const approvals: any[] = [];

    timeRecords.forEach(tr => {
      const totalHours = ((tr.totalMinutes || 0) + (tr.overtimeMinutes || 0)) / 60;
      const isOvertime = (tr.overtimeMinutes || 0) > 0;
      approvals.push({
        id: tr.id,
        type: isOvertime ? 'overtime' : 'time-entry',
        employee: `${tr.employee.firstName} ${tr.employee.lastName}`,
        profilePhoto: tr.employee.profilePhoto,
        description: isOvertime
          ? `${Math.round((tr.overtimeMinutes || 0) / 60 * 10) / 10}h overtime`
          : `${Math.round(totalHours * 10) / 10}h regular work`,
        date: tr.date,
        hours: Math.round(totalHours * 10) / 10,
        status: tr.status.toLowerCase(),
        submittedAt: tr.createdAt,
        approvedAt: tr.approvedAt,
        rejectionReason: tr.rejectionReason,
      });
    });

    leaveRequests.forEach(lr => {
      const startDate = new Date(lr.startDate);
      const endDate = new Date(lr.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      approvals.push({
        id: lr.id,
        type: 'leave',
        employee: `${lr.employee.firstName} ${lr.employee.lastName}`,
        profilePhoto: lr.employee.profilePhoto,
        description: `${lr.leaveType} - ${days} day(s)`,
        date: `${lr.startDate.toISOString().split('T')[0]} to ${lr.endDate.toISOString().split('T')[0]}`,
        days,
        reason: lr.reason,
        status: lr.status.toLowerCase(),
        submittedAt: lr.createdAt,
      });
    });

    // Sort by submittedAt
    approvals.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // Calculate summary counts
    const [pendingTimeCount, pendingLeaveCount, approvedWeekCount, rejectedWeekCount] = await Promise.all([
      prisma.timeRecord.count({ where: { clientId, status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { employeeId: { in: employeeIds }, status: 'PENDING' } }),
      prisma.timeRecord.count({
        where: {
          clientId,
          status: 'APPROVED',
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

    // Verify all records belong to this client
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

    // Bulk update
    const result = await prisma.timeRecord.updateMany({
      where: { id: { in: recordIds }, clientId: client.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Bulk rejected by client',
        rejectedBy: userId,
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

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// Get analytics data
export const getClientAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { period = 'month' } = req.query;

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
          status: { in: ['APPROVED', 'PENDING'] },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      }),
      prisma.timeRecord.findMany({
        where: {
          clientId,
          date: { gte: previousStartDate, lt: startDate },
          status: { in: ['APPROVED', 'PENDING'] },
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
      .filter(tr => tr.status === 'APPROVED')
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
      if (tr.status === 'APPROVED') emp.approvedHours += hours;
    });

    const topPerformers = Array.from(employeeHoursMap.values())
      .map(e => ({
        ...e,
        hours: Math.round(e.hours * 10) / 10,
        productivity: e.hours > 0 ? Math.round((e.approvedHours / e.hours) * 100) : 0,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

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
        billingEmail: true,
        billingAddress: true,
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

    // Get hourly rate (placeholder - should come from client contract)
    const hourlyRate = 35;

    // Current period (this month so far)
    const currentMonthRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: { gte: startOfMonth, lte: now },
        status: { in: ['APPROVED', 'PENDING'] },
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

    // YTD totals
    const ytdRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: { gte: startOfYear, lte: now },
        status: 'APPROVED',
      },
    });

    const ytdMinutes = ytdRecords.reduce((acc, tr) =>
      acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);
    const ytdHours = ytdMinutes / 60;
    const ytdTotal = ytdHours * hourlyRate;

    // Monthly average
    const monthsElapsed = now.getMonth() + 1;
    const avgMonthly = ytdTotal / monthsElapsed;

    // Generate invoice history (last 6 months - simulated)
    const invoices: any[] = [];
    for (let i = 1; i <= 6; i++) {
      const invoiceMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const invoiceEndMonth = new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth() + 1, 0);

      const monthRecords = await prisma.timeRecord.findMany({
        where: {
          clientId,
          date: { gte: invoiceMonth, lte: invoiceEndMonth },
          status: 'APPROVED',
        },
      });

      const monthMinutes = monthRecords.reduce((acc, tr) =>
        acc + (tr.totalMinutes || 0) + (tr.overtimeMinutes || 0), 0);
      const monthHours = monthMinutes / 60;

      if (monthHours > 0) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        invoices.push({
          id: `INV-${invoiceMonth.getFullYear()}-${String(invoiceMonth.getMonth() + 1).padStart(2, '0')}`,
          period: `${monthNames[invoiceMonth.getMonth()]} ${invoiceMonth.getFullYear()}`,
          hours: Math.round(monthHours * 10) / 10,
          amount: Math.round(monthHours * hourlyRate * 100) / 100,
          status: 'paid',
          dueDate: new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth() + 1, 15).toISOString().split('T')[0],
          paidDate: new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth() + 1, 12).toISOString().split('T')[0],
        });
      }
    }

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
          billingEmail: client.billingEmail,
          billingAddress: client.billingAddress,
        },
      },
    });
  } catch (error) {
    console.error('Get client billing error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing data' });
  }
};
