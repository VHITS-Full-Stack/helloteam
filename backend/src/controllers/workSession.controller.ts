import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { WorkSessionStatus } from '@prisma/client';
import { sendOTWorkedEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import { createNotification } from './notification.controller';

// Helper function to get client IP address
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'Unknown';
};

// Helper function to create a session log
const createSessionLog = async (
  workSessionId: string,
  userId: string | null,
  userName: string | null,
  action: string,
  message: string,
  ipAddress?: string,
  metadata?: Record<string, any>
) => {
  try {
    await prisma.sessionLog.create({
      data: {
        workSessionId,
        userId,
        userName,
        action,
        message,
        ipAddress,
        metadata: metadata || null,
      },
    });
  } catch (error) {
    console.error('Failed to create session log:', error);
  }
};

// Clock in - Start a new work session
export const clockIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
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

    // Check if employee is assigned to a client
    const clientAssignment = await prisma.clientEmployee.findFirst({
      where: { employeeId: employee.id, isActive: true },
      include: { client: { select: { companyName: true } } },
    });

    if (!clientAssignment) {
      res.status(400).json({
        success: false,
        message: 'You are not assigned to any client. Please contact your administrator.',
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

    // Block clock-in if no schedule is assigned for today
    if (!schedule) {
      res.status(400).json({
        success: false,
        message: 'You do not have a schedule assigned for today. Please contact your administrator.',
      });
      return;
    }

    // Check early clock-in (before schedule start) and post-shift clock-in (after schedule end)
    if (schedule.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
      const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
      const shiftStart = new Date(today);
      shiftStart.setHours(startHour, startMinute, 0, 0);

      if (today < shiftStart && !req.body?.confirmEarlyClockIn) {
        // Before schedule start — warn employee about early clock-in
        res.status(200).json({
          success: false,
          requiresConfirmation: true,
          confirmationType: 'EARLY_CLOCK_IN',
          message: 'Your shift hasn\'t started. You may not get paid for these hours.',
          scheduledStart: schedule.startTime,
        });
        return;
      }
    }

    if (schedule.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
      const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
      const shiftEnd = new Date(today);
      shiftEnd.setHours(endHour, endMinute, 0, 0);

      if (today > shiftEnd) {
        // Check if employee has an approved OT request for today
        const recordDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const approvedOT = await prisma.overtimeRequest.findFirst({
          where: {
            employeeId: employee.id,
            clientId: clientAssignment.clientId,
            date: recordDate,
            status: 'APPROVED',
          },
        });

        if (!approvedOT && !req.body?.confirmPostShift) {
          // Return confirmation required — employee must acknowledge the warning
          res.status(200).json({
            success: false,
            requiresConfirmation: true,
            confirmationType: 'POST_SHIFT',
            message: 'No approved overtime. You may not get paid. This requires special approval at client\'s discretion.',
          });
          return;
        }
      }
    }

    // Get client IP
    const clientIp = getClientIp(req);

    // Get user email for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Create new work session
    const workSession = await prisma.workSession.create({
      data: {
        employeeId: employee.id,
        startTime: new Date(),
        status: 'ACTIVE',
        ipAddress: clientIp,
      },
      include: {
        breaks: true,
      },
    });

    // Create session log for clock in
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    await createSessionLog(
      workSession.id,
      userId,
      employeeName,
      'CLOCK_IN',
      `.: Clocked in user: ${user?.email || 'Unknown'}. Customer: ${clientAssignment?.client?.companyName || '-'}`,
      clientIp,
      { email: user?.email, customer: clientAssignment?.client?.companyName }
    );

    // Calculate arrival status if schedule exists
    let arrivalStatus = 'No Schedule';
    if (schedule) {
      const [scheduleHour, scheduleMinute] = schedule.startTime.split(':').map(Number);
      const scheduledStart = new Date(today);
      scheduledStart.setHours(scheduleHour, scheduleMinute, 0, 0);

      const timeDiffMinutes = Math.round((workSession.startTime.getTime() - scheduledStart.getTime()) / 60000);

      if (timeDiffMinutes < 0) {
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
    const userId = req.user?.userId;
    const notes = req.body?.notes;

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
    // Use UTC midnight of the local date to avoid timezone shift when storing in PostgreSQL DATE column
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Get all active client assignments for the employee
    const clientAssignments = await prisma.clientEmployee.findMany({
      where: {
        employeeId: employee.id,
        isActive: true,
      },
    });

    if (clientAssignments.length > 0) {
      // Look up today's schedule to calculate early overtime
      const dayOfWeek = now.getDay();
      const schedule = await prisma.schedule.findFirst({
        where: {
          employeeId: employee.id,
          dayOfWeek,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
      });

      // Calculate early overtime (pre-schedule minutes)
      let earlyOvertimeMinutes = 0;
      let scheduledStart: Date | null = null;
      let scheduledEnd: Date | null = null;

      if (schedule?.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
        const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
        scheduledStart = new Date(now);
        scheduledStart.setHours(startHour, startMinute, 0, 0);

        // If employee clocked in before schedule start, those minutes are overtime
        if (activeSession.startTime < scheduledStart) {
          earlyOvertimeMinutes = Math.round(
            (scheduledStart.getTime() - activeSession.startTime.getTime()) / 60000
          );
        }
      }

      if (schedule?.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
        const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
        scheduledEnd = new Date(now);
        scheduledEnd.setHours(endHour, endMinute, 0, 0);
      }

      // Overtime = early pre-schedule minutes + any hours beyond 8h of regular work
      const regularWorkMinutes = totalWorkMinutes - earlyOvertimeMinutes;
      const lateOvertimeMinutes = Math.max(0, regularWorkMinutes - 480);
      const overtimeMinutes = earlyOvertimeMinutes + lateOvertimeMinutes;

      // Create/update time record for each assigned client
      await Promise.all(
        clientAssignments.map(async (assignment) => {
          // Check if there's a pre-approved OvertimeRequest for this employee/client/date
          let status: 'PENDING' | 'APPROVED' = 'PENDING';
          if (overtimeMinutes > 0) {
            const approvedOT = await prisma.overtimeRequest.findFirst({
              where: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: today,
                status: 'APPROVED',
              },
            });
            if (approvedOT) {
              // Pre-approved OT → auto-approve the time record immediately
              status = 'APPROVED';
            }
          }

          const existing = await prisma.timeRecord.findUnique({
            where: {
              employeeId_clientId_date: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: today,
              },
            },
          });

          if (existing) {
            const newTotal = existing.totalMinutes + totalWorkMinutes;
            const newBreak = existing.breakMinutes + totalBreakMinutes;
            // Recalculate overtime with early minutes considered
            const newRegular = newTotal - earlyOvertimeMinutes;
            const newLateOT = Math.max(0, newRegular - 480);
            const newOvertime = earlyOvertimeMinutes + newLateOT;

            // If overtime was added and pre-approved, update status
            const updateData: any = {
              actualEnd: endTime,
              totalMinutes: newTotal,
              breakMinutes: newBreak,
              overtimeMinutes: newOvertime,
              scheduledStart: scheduledStart || existing.scheduledStart,
              scheduledEnd: scheduledEnd || existing.scheduledEnd,
            };
            if (newOvertime > 0 && status === 'APPROVED' && existing.status === 'PENDING') {
              updateData.status = 'APPROVED';
              updateData.approvedAt = new Date();
            }

            await prisma.timeRecord.update({
              where: { id: existing.id },
              data: updateData,
            });
          } else {
            await prisma.timeRecord.create({
              data: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: today,
                scheduledStart,
                scheduledEnd,
                actualStart: activeSession.startTime,
                actualEnd: endTime,
                totalMinutes: totalWorkMinutes,
                breakMinutes: totalBreakMinutes,
                overtimeMinutes,
                status,
                approvedAt: status === 'APPROVED' ? new Date() : undefined,
              },
            });
          }
        })
      );
      // --- Send OT notifications to client(s) if overtime was worked ---
      if (overtimeMinutes > 0) {
        const employeeName = `${employee.firstName} ${employee.lastName}`;
        const now2 = new Date();
        const dateStr = now2.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const otHrs = Math.floor(overtimeMinutes / 60);
        const otMins = overtimeMinutes % 60;
        const overtimeHoursStr = otMins > 0 ? `${otHrs}h ${otMins}m` : `${otHrs}h`;
        const totalHrs = Math.floor(totalWorkMinutes / 60);
        const totalMins = totalWorkMinutes % 60;
        const totalHoursStr = totalMins > 0 ? `${totalHrs}h ${totalMins}m` : `${totalHrs}h`;

        for (const assignment of clientAssignments) {
          try {
            const client = await prisma.client.findUnique({
              where: { id: assignment.clientId },
              include: {
                user: { select: { id: true, email: true } },
              },
            });
            if (!client) continue;

            const clientName = client.contactPerson || client.companyName;

            // 1. In-app notification
            try {
              await createNotification(
                client.userId,
                'OVERTIME_REQUEST',
                'Employee Worked Overtime',
                `${employeeName} worked ${overtimeHoursStr} overtime on ${dateStr}. Approve or deny.`,
                { employeeId: employee.id, date: dateStr },
                '/client/approvals?tab=overtime'
              );
            } catch (e) { console.error('[OT-Notify] In-app failed:', e); }

            // 2. Email notification
            try {
              await sendOTWorkedEmail(
                client.user.email,
                clientName,
                employeeName,
                dateStr,
                overtimeHoursStr,
                totalHoursStr
              );
            } catch (e) { console.error('[OT-Notify] Email failed:', e); }

            // 3. SMS notification
            if (client.phone) {
              try {
                await sendSMS(
                  client.phone,
                  `${employeeName} worked OT on ${dateStr} (${overtimeHoursStr}). Approve or deny. Log in to review.`
                );
              } catch (e) { console.error('[OT-Notify] SMS failed:', e); }
            }
          } catch (e) {
            console.error(`[OT-Notify] Failed for client ${assignment.clientId}:`, e);
          }
        }
      }
    } else {
      console.warn(`Employee ${employee.id} clocked out but has no active client assignment. No time record created.`);
    }

    // Get client IP and check for IP change
    const clientIp = getClientIp(req);
    const clockInIp = activeSession.ipAddress;

    // Get user email for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const employeeName = `${employee.firstName} ${employee.lastName}`;

    // Log IP change if different
    if (clockInIp && clientIp !== clockInIp) {
      await createSessionLog(
        activeSession.id,
        userId,
        employeeName,
        'IP_CHANGED',
        `.: IP address changed. Clocked in from ${clockInIp}, clocking out from ${clientIp}`,
        clientIp,
        { clockInIp, clockOutIp: clientIp }
      );
    }

    // Format shift total
    const hours = Math.floor(totalWorkMinutes / 60);
    const minutes = totalWorkMinutes % 60;
    const shiftTotal = `${hours}:${minutes.toString().padStart(2, '0')}`;

    // Create session log for clock out
    await createSessionLog(
      activeSession.id,
      userId,
      employeeName,
      'CLOCK_OUT',
      `.: Clocked out user: ${user?.email || 'Unknown'}. Shift total ${shiftTotal}`,
      clientIp,
      { email: user?.email, totalWorkMinutes, shiftTotal }
    );

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
    const userId = req.user?.userId;

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

    // Create session log for break start
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    await createSessionLog(
      activeSession.id,
      userId,
      employeeName,
      'BREAK_START',
      `.: Break started`,
      getClientIp(req)
    );

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
    const userId = req.user?.userId;

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

    // Create session log for break end
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    await createSessionLog(
      activeSession.id,
      userId,
      employeeName,
      'BREAK_END',
      `.: Break ended. Duration: ${durationMinutes} minutes`,
      getClientIp(req),
      { durationMinutes }
    );

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
    const userId = req.user?.userId;

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
    const userId = req.user?.userId;
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
      // Set to end of day so sessions on the last day are included
      const endDateObj = new Date(endDate as string);
      endDateObj.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = endDateObj;
    }

    const whereClause: any = {
      employeeId: employee.id,
      // Include completed, active, and on-break sessions
      status: { in: ['COMPLETED', 'ACTIVE', 'ON_BREAK'] },
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.startTime = dateFilter;
    }

    const [sessions, total] = await Promise.all([
      prisma.workSession.findMany({
        where: whereClause,
        include: {
          breaks: true,
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.workSession.count({ where: whereClause }),
    ]);

    // Get client info for the employee
    const clientAssignment = await prisma.clientEmployee.findFirst({
      where: {
        employeeId: employee.id,
        isActive: true,
      },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    // Fetch time records for these sessions to get approval status
    const sessionDates = sessions
      .filter(s => s.startTime)
      .map(s => {
        const d = new Date(s.startTime);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      });

    const timeRecords = sessionDates.length > 0
      ? await prisma.timeRecord.findMany({
          where: {
            employeeId: employee.id,
            date: { in: sessionDates },
          },
          select: {
            id: true,
            date: true,
            status: true,
            approvedAt: true,
            revisionReason: true,
            revisionRequestedBy: true,
            revisionRequestedAt: true,
          },
        })
      : [];

    // Build a lookup: date string -> time record
    const timeRecordMap = new Map<string, typeof timeRecords[0]>();
    for (const tr of timeRecords) {
      const dateKey = tr.date.toISOString().split('T')[0];
      timeRecordMap.set(dateKey, tr);
    }

    // Calculate work minutes for each session
    const sessionsWithStats = sessions.map(session => {
      const totalMinutes = session.endTime
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000)
        : 0;
      const workMinutes = totalMinutes - (session.totalBreakMinutes || 0);

      // Match time record by date
      const sessionDateKey = session.startTime.toISOString().split('T')[0];
      const timeRecord = timeRecordMap.get(sessionDateKey);

      return {
        ...session,
        totalMinutes,
        workMinutes,
        client: clientAssignment?.client || null,
        approvalStatus: timeRecord?.status || null,
        approvedAt: timeRecord?.approvedAt || null,
        timeRecordId: timeRecord?.id || null,
        revisionReason: timeRecord?.revisionReason || null,
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
    const userId = req.user?.userId;

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
    const userId = req.user?.userId;

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
      const dateKey = `${session.startTime.getFullYear()}-${String(session.startTime.getMonth() + 1).padStart(2, '0')}-${String(session.startTime.getDate()).padStart(2, '0')}`;

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

// Add manual time entry
export const addManualEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { date, startTime, endTime, notes } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!date || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'Date, start time, and end time are required' });
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

    // Parse the date and times
    const entryDate = new Date(date);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const sessionStartTime = new Date(entryDate);
    sessionStartTime.setHours(startHour, startMinute, 0, 0);

    const sessionEndTime = new Date(entryDate);
    sessionEndTime.setHours(endHour, endMinute, 0, 0);

    // Handle overnight shifts (end time before start time means next day)
    if (sessionEndTime <= sessionStartTime) {
      sessionEndTime.setDate(sessionEndTime.getDate() + 1);
    }

    // Calculate duration in minutes
    const totalMinutes = Math.round(
      (sessionEndTime.getTime() - sessionStartTime.getTime()) / 60000
    );

    // Check for overlapping sessions
    const existingSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        OR: [
          {
            startTime: { lte: sessionEndTime },
            endTime: { gte: sessionStartTime },
          },
          {
            startTime: { gte: sessionStartTime, lte: sessionEndTime },
          },
        ],
      },
    });

    if (existingSession) {
      res.status(400).json({
        success: false,
        message: 'A time entry already exists that overlaps with this time period',
      });
      return;
    }

    // Create the manual work session
    const workSession = await prisma.workSession.create({
      data: {
        employeeId: employee.id,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        status: 'COMPLETED',
        notes: notes || null,
        totalBreakMinutes: 0,
      },
    });

    // Get all active client assignments for the employee
    const clientAssignments = await prisma.clientEmployee.findMany({
      where: {
        employeeId: employee.id,
        isActive: true,
      },
    });

    // Create time record for each assigned client
    if (clientAssignments.length > 0) {
      // Use UTC midnight of the local date to avoid timezone shift in PostgreSQL DATE column
      const d = new Date(entryDate);
      const recordDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

      await Promise.all(
        clientAssignments.map((assignment) =>
          prisma.timeRecord.upsert({
            where: {
              employeeId_clientId_date: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: recordDate,
              },
            },
            create: {
              employeeId: employee.id,
              clientId: assignment.clientId,
              date: recordDate,
              actualStart: sessionStartTime,
              actualEnd: sessionEndTime,
              totalMinutes,
              breakMinutes: 0,
              status: 'PENDING',
            },
            update: {
              actualEnd: sessionEndTime,
              totalMinutes: { increment: totalMinutes },
            },
          })
        )
      );
    } else {
      console.warn(`Employee ${employee.id} added manual entry but has no active client assignment. No time record created.`);
    }

    res.status(201).json({
      success: true,
      message: 'Manual time entry added successfully',
      session: {
        ...workSession,
        workMinutes: totalMinutes,
        client: clientAssignments.length > 0 ? { id: clientAssignments[0].clientId } : null,
      },
    });
  } catch (error) {
    console.error('Add manual entry error:', error);
    res.status(500).json({ success: false, message: 'Failed to add manual time entry' });
  }
};

// Update notes for current session
export const updateSessionNotes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { notes } = req.body;

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

    // Find active session
    const activeSession = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
    });

    if (!activeSession) {
      res.status(404).json({ success: false, message: 'No active session found' });
      return;
    }

    // Update notes
    const updatedSession = await prisma.workSession.update({
      where: { id: activeSession.id },
      data: { notes: notes || null },
    });

    // Create session log for notes update
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    await createSessionLog(
      activeSession.id,
      userId,
      employeeName,
      'NOTES_UPDATED',
      `.: Timesheet notes added`,
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Notes updated successfully',
      session: updatedSession,
    });
  } catch (error) {
    console.error('Update session notes error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notes' });
  }
};

// Get session logs
export const getSessionLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.params.sessionId as string;

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

    // Verify the session belongs to this employee
    const session = await prisma.workSession.findFirst({
      where: {
        id: sessionId,
        employeeId: employee.id,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Get logs for the session
    const logs = await prisma.sessionLog.findMany({
      where: { workSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const employeeName = `${session.employee.firstName} ${session.employee.lastName}`;

    res.json({
      success: true,
      sessionId,
      employeeName,
      logs,
    });
  } catch (error) {
    console.error('Get session logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get session logs' });
  }
};
