import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { WorkSessionStatus } from '@prisma/client';

// Clock in - Start a new work session
export const clockIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Check if there's already an active session
    const activeSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
    });

    if (activeSession) {
      res.status(400).json({
        success: false,
        message: 'You already have an active work session. Please clock out first.',
        session: activeSession,
      });
      return;
    }

    // Get today's schedule for arrival status
    const today = new Date();
    const dayOfWeek = today.getDay();
    const schedule = await prisma.schedule.findFirst({
      where: {
        employeeId: employee.id,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { lte: today },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: today } },
        ],
      },
    });

    // Create new work session
    const workSession = await prisma.workSession.create({
      data: {
        employeeId: employee.id,
        startTime: new Date(),
        status: 'ACTIVE',
      },
      include: {
        breaks: true,
      },
    });

    // Calculate arrival status if schedule exists
    let arrivalStatus = 'No Schedule';
    if (schedule) {
      const [scheduleHour, scheduleMinute] = schedule.startTime.split(':').map(Number);
      const scheduledStart = new Date(today);
      scheduledStart.setHours(scheduleHour, scheduleMinute, 0, 0);

      const timeDiffMinutes = Math.round((workSession.startTime.getTime() - scheduledStart.getTime()) / 60000);

      if (timeDiffMinutes <= -5) {
        arrivalStatus = 'Early';
      } else if (timeDiffMinutes <= 5) {
        arrivalStatus = 'On Time';
      } else {
        arrivalStatus = 'Late';
      }
    }

    res.status(201).json({
      success: true,
      message: 'Clocked in successfully',
      session: {
        ...workSession,
        arrivalStatus,
        schedule: schedule ? {
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        } : null,
      },
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ success: false, message: 'Failed to clock in' });
  }
};

// Clock out - End current work session
export const clockOut = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { notes } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Find active session
    const activeSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
      include: {
        breaks: true,
      },
    });

    if (!activeSession) {
      res.status(400).json({
        success: false,
        message: 'No active work session found',
      });
      return;
    }

    // End any ongoing break
    const ongoingBreak = activeSession.breaks.find(b => !b.endTime);
    if (ongoingBreak) {
      const breakEndTime = new Date();
      const breakDuration = Math.round(
        (breakEndTime.getTime() - ongoingBreak.startTime.getTime()) / 60000
      );

      await prisma.break.update({
        where: { id: ongoingBreak.id },
        data: {
          endTime: breakEndTime,
          durationMinutes: breakDuration,
        },
      });
    }

    // Calculate total break time
    const breaks = await prisma.break.findMany({
      where: { workSessionId: activeSession.id },
    });

    const totalBreakMinutes = breaks.reduce((total, brk) => {
      if (brk.durationMinutes) {
        return total + brk.durationMinutes;
      }
      if (brk.endTime) {
        return total + Math.round((brk.endTime.getTime() - brk.startTime.getTime()) / 60000);
      }
      return total;
    }, 0);

    // Update work session
    const endTime = new Date();
    const updatedSession = await prisma.workSession.update({
      where: { id: activeSession.id },
      data: {
        endTime,
        status: 'COMPLETED',
        totalBreakMinutes,
        notes: notes || null,
      },
      include: {
        breaks: true,
      },
    });

    // Calculate total work time
    const totalWorkMinutes = Math.round(
      (endTime.getTime() - activeSession.startTime.getTime()) / 60000
    ) - totalBreakMinutes;

    // Create or update time record for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get employee's client assignment
    const clientAssignment = await prisma.clientEmployee.findFirst({
      where: {
        employeeId: employee.id,
        isActive: true,
      },
    });

    if (clientAssignment) {
      await prisma.timeRecord.upsert({
        where: {
          employeeId_clientId_date: {
            employeeId: employee.id,
            clientId: clientAssignment.clientId,
            date: today,
          },
        },
        create: {
          employeeId: employee.id,
          clientId: clientAssignment.clientId,
          date: today,
          actualStart: activeSession.startTime,
          actualEnd: endTime,
          totalMinutes: totalWorkMinutes,
          breakMinutes: totalBreakMinutes,
          status: 'PENDING',
        },
        update: {
          actualEnd: endTime,
          totalMinutes: { increment: totalWorkMinutes },
          breakMinutes: { increment: totalBreakMinutes },
        },
      });
    }

    res.json({
      success: true,
      message: 'Clocked out successfully',
      session: {
        ...updatedSession,
        totalWorkMinutes,
      },
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ success: false, message: 'Failed to clock out' });
  }
};

// Start break
export const startBreak = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Find active session
    const activeSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: 'ACTIVE',
      },
    });

    if (!activeSession) {
      res.status(400).json({
        success: false,
        message: 'No active work session found. Please clock in first.',
      });
      return;
    }

    // Create break record
    const breakRecord = await prisma.break.create({
      data: {
        workSessionId: activeSession.id,
        startTime: new Date(),
      },
    });

    // Update session status
    await prisma.workSession.update({
      where: { id: activeSession.id },
      data: { status: 'ON_BREAK' },
    });

    res.status(201).json({
      success: true,
      message: 'Break started',
      break: breakRecord,
    });
  } catch (error) {
    console.error('Start break error:', error);
    res.status(500).json({ success: false, message: 'Failed to start break' });
  }
};

// End break
export const endBreak = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Find session on break
    const activeSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: 'ON_BREAK',
      },
      include: {
        breaks: {
          where: { endTime: null },
          orderBy: { startTime: 'desc' },
          take: 1,
        },
      },
    });

    if (!activeSession) {
      res.status(400).json({
        success: false,
        message: 'You are not currently on break',
      });
      return;
    }

    const currentBreak = activeSession.breaks[0];
    if (!currentBreak) {
      res.status(400).json({
        success: false,
        message: 'No active break found',
      });
      return;
    }

    // Calculate break duration
    const endTime = new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - currentBreak.startTime.getTime()) / 60000
    );

    // Update break record
    const updatedBreak = await prisma.break.update({
      where: { id: currentBreak.id },
      data: {
        endTime,
        durationMinutes,
      },
    });

    // Update session status back to ACTIVE
    await prisma.workSession.update({
      where: { id: activeSession.id },
      data: { status: 'ACTIVE' },
    });

    res.json({
      success: true,
      message: 'Break ended',
      break: updatedBreak,
    });
  } catch (error) {
    console.error('End break error:', error);
    res.status(500).json({ success: false, message: 'Failed to end break' });
  }
};

// Get current work session status
export const getCurrentSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Find active session
    const activeSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
      include: {
        breaks: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    // Get today's schedule
    const today = new Date();
    const dayOfWeek = today.getDay();
    const schedule = await prisma.schedule.findFirst({
      where: {
        employeeId: employee.id,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { lte: today },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: today } },
        ],
      },
    });

    if (!activeSession) {
      res.json({
        success: true,
        isWorking: false,
        session: null,
        schedule: schedule ? {
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        } : null,
      });
      return;
    }

    // Calculate current work duration
    const now = new Date();
    const elapsedMinutes = Math.round(
      (now.getTime() - activeSession.startTime.getTime()) / 60000
    );

    // Calculate total break time so far
    let totalBreakMinutes = 0;
    for (const brk of activeSession.breaks) {
      if (brk.endTime) {
        totalBreakMinutes += brk.durationMinutes || Math.round(
          (brk.endTime.getTime() - brk.startTime.getTime()) / 60000
        );
      } else {
        // Ongoing break
        totalBreakMinutes += Math.round(
          (now.getTime() - brk.startTime.getTime()) / 60000
        );
      }
    }

    const currentWorkMinutes = elapsedMinutes - totalBreakMinutes;

    // Get current break if on break
    const currentBreak = activeSession.breaks.find(b => !b.endTime);

    res.json({
      success: true,
      isWorking: true,
      session: {
        ...activeSession,
        elapsedMinutes,
        currentWorkMinutes,
        totalBreakMinutes,
        currentBreak: currentBreak ? {
          id: currentBreak.id,
          startTime: currentBreak.startTime,
          durationMinutes: Math.round(
            (now.getTime() - currentBreak.startTime.getTime()) / 60000
          ),
        } : null,
      },
      schedule: schedule ? {
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      } : null,
    });
  } catch (error) {
    console.error('Get current session error:', error);
    res.status(500).json({ success: false, message: 'Failed to get current session' });
  }
};

// Get work session history
export const getSessionHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate, page = '1', limit = '10' } = req.query;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    const whereClause: any = {
      employeeId: employee.id,
      status: 'COMPLETED',
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.startTime = dateFilter;
    }

    const [sessions, total] = await Promise.all([
      prisma.workSession.findMany({
        where: whereClause,
        include: {
          breaks: true,
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.workSession.count({ where: whereClause }),
    ]);

    // Calculate work minutes for each session
    const sessionsWithStats = sessions.map(session => {
      const totalMinutes = session.endTime
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000)
        : 0;
      const workMinutes = totalMinutes - (session.totalBreakMinutes || 0);

      return {
        ...session,
        totalMinutes,
        workMinutes,
      };
    });

    res.json({
      success: true,
      sessions: sessionsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get session history' });
  }
};

// Get today's work summary
export const getTodaySummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get all sessions today
    const todaySessions = await prisma.workSession.findMany({
      where: {
        employeeId: employee.id,
        startTime: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        breaks: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Calculate totals
    let totalWorkMinutes = 0;
    let totalBreakMinutes = 0;
    const now = new Date();

    for (const session of todaySessions) {
      const sessionEnd = session.endTime || now;
      const sessionTotalMinutes = Math.round(
        (sessionEnd.getTime() - session.startTime.getTime()) / 60000
      );

      // Calculate breaks for this session
      let sessionBreakMinutes = 0;
      for (const brk of session.breaks) {
        if (brk.endTime) {
          sessionBreakMinutes += brk.durationMinutes || Math.round(
            (brk.endTime.getTime() - brk.startTime.getTime()) / 60000
          );
        } else {
          sessionBreakMinutes += Math.round(
            (now.getTime() - brk.startTime.getTime()) / 60000
          );
        }
      }

      totalBreakMinutes += sessionBreakMinutes;
      totalWorkMinutes += sessionTotalMinutes - sessionBreakMinutes;
    }

    // Get today's schedule
    const dayOfWeek = todayStart.getDay();
    const schedule = await prisma.schedule.findFirst({
      where: {
        employeeId: employee.id,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { lte: todayStart },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: todayStart } },
        ],
      },
    });

    // Calculate scheduled hours
    let scheduledMinutes = 0;
    if (schedule) {
      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      const [endHour, endMin] = schedule.endTime.split(':').map(Number);
      scheduledMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    }

    // Calculate overtime
    const overtimeMinutes = Math.max(0, totalWorkMinutes - scheduledMinutes);

    res.json({
      success: true,
      summary: {
        totalWorkMinutes,
        totalBreakMinutes,
        scheduledMinutes,
        overtimeMinutes,
        sessionsCount: todaySessions.length,
        firstClockIn: todaySessions.length > 0 ? todaySessions[0].startTime : null,
        lastActivity: todaySessions.length > 0
          ? todaySessions[todaySessions.length - 1].endTime || todaySessions[todaySessions.length - 1].startTime
          : null,
        schedule: schedule ? {
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get today summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get today summary' });
  }
};

// Get weekly summary
export const getWeeklySummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Get start of current week (Sunday)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get all sessions this week
    const weekSessions = await prisma.workSession.findMany({
      where: {
        employeeId: employee.id,
        startTime: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
      include: {
        breaks: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by day and calculate totals
    const dailySummary: { [key: string]: { workMinutes: number; breakMinutes: number; sessions: number } } = {};
    let totalWorkMinutes = 0;
    let totalBreakMinutes = 0;

    for (const session of weekSessions) {
      const dateKey = session.startTime.toISOString().split('T')[0];

      if (!dailySummary[dateKey]) {
        dailySummary[dateKey] = { workMinutes: 0, breakMinutes: 0, sessions: 0 };
      }

      const sessionEnd = session.endTime || now;
      const sessionTotalMinutes = Math.round(
        (sessionEnd.getTime() - session.startTime.getTime()) / 60000
      );

      let sessionBreakMinutes = session.totalBreakMinutes || 0;
      if (session.status !== 'COMPLETED') {
        // Calculate for active session
        sessionBreakMinutes = 0;
        for (const brk of session.breaks) {
          if (brk.endTime) {
            sessionBreakMinutes += brk.durationMinutes || Math.round(
              (brk.endTime.getTime() - brk.startTime.getTime()) / 60000
            );
          } else {
            sessionBreakMinutes += Math.round(
              (now.getTime() - brk.startTime.getTime()) / 60000
            );
          }
        }
      }

      const sessionWorkMinutes = sessionTotalMinutes - sessionBreakMinutes;

      dailySummary[dateKey].workMinutes += sessionWorkMinutes;
      dailySummary[dateKey].breakMinutes += sessionBreakMinutes;
      dailySummary[dateKey].sessions += 1;

      totalWorkMinutes += sessionWorkMinutes;
      totalBreakMinutes += sessionBreakMinutes;
    }

    // Get weekly schedule for comparison
    const schedules = await prisma.schedule.findMany({
      where: {
        employeeId: employee.id,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
    });

    let scheduledWeeklyMinutes = 0;
    for (const schedule of schedules) {
      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      const [endHour, endMin] = schedule.endTime.split(':').map(Number);
      scheduledWeeklyMinutes += (endHour * 60 + endMin) - (startHour * 60 + startMin);
    }

    res.json({
      success: true,
      summary: {
        totalWorkMinutes,
        totalBreakMinutes,
        scheduledWeeklyMinutes,
        overtimeMinutes: Math.max(0, totalWorkMinutes - scheduledWeeklyMinutes),
        dailyBreakdown: dailySummary,
        daysWorked: Object.keys(dailySummary).length,
        weekStart: startOfWeek,
        weekEnd: endOfWeek,
      },
    });
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get weekly summary' });
  }
};
