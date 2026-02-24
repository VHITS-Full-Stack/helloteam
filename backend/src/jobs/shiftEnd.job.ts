import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import { sendOTWorkedEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import type { Server } from 'socket.io';

/**
 * Convert a date + HH:MM time string in a given timezone to a UTC Date object.
 */
const toUTCDate = (date: Date, timeStr: string, timezone: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateStr = date.toISOString().split('T')[0];
  // Parse as UTC (Z suffix) so the offset calculation works regardless of server timezone
  const naiveUTC = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);

  try {
    const utcStr = naiveUTC.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = naiveUTC.toLocaleString('en-US', { timeZone: timezone });
    const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
    return new Date(naiveUTC.getTime() + offsetMs);
  } catch {
    return naiveUTC;
  }
};

/**
 * Shift End Job — runs every minute.
 *
 * 1. 5 minutes before shift end → notify employee: "Your shift is ending."
 * 2. At shift end → auto-clock out if no OT request exists for today.
 */
export const runShiftEndJob = async (io?: Server): Promise<void> => {
  try {
    const now = new Date();

    // Find all active work sessions
    const activeSessions = await prisma.workSession.findMany({
      where: {
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            clientAssignments: {
              where: { isActive: true },
              select: {
                clientId: true,
                client: {
                  select: {
                    id: true,
                    timezone: true,
                    companyName: true,
                  },
                },
              },
            },
          },
        },
        breaks: true,
      },
    });

    if (activeSessions.length === 0) return;

    for (const session of activeSessions) {
      const employee = session.employee;
      if (!employee || employee.clientAssignments.length === 0) continue;

      // Use the first client assignment for schedule/timezone
      const assignment = employee.clientAssignments[0];
      const clientTimezone = assignment.client.timezone || 'UTC';

      // Get the record date (today in UTC terms)
      const recordDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayOfWeek = recordDate.getUTCDay();

      // Find the employee's schedule for today
      const schedule = await prisma.schedule.findFirst({
        where: {
          employeeId: employee.id,
          dayOfWeek,
          isActive: true,
          effectiveFrom: { lte: recordDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: recordDate } },
          ],
        },
        select: {
          startTime: true,
          endTime: true,
        },
      });

      if (!schedule || !schedule.endTime || !/^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
        continue;
      }

      const shiftEndUTC = toUTCDate(recordDate, schedule.endTime, clientTimezone);
      const minutesUntilEnd = (shiftEndUTC.getTime() - now.getTime()) / 60000;

      console.log(`[Shift-End] ${employee.firstName} ${employee.lastName}: schedule=${schedule.endTime}, tz=${clientTimezone}, shiftEndUTC=${shiftEndUTC.toISOString()}, now=${now.toISOString()}, minutesUntilEnd=${minutesUntilEnd.toFixed(1)}`);

      // --- 30-minute warning ---
      if (minutesUntilEnd <= 30 && minutesUntilEnd > 0 && !session.shiftEndNotifiedAt) {
        const minutesLeft = Math.round(minutesUntilEnd);

        // Check if employee already has an approved OT request for today
        const approvedOT = await prisma.overtimeRequest.findFirst({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: recordDate,
            status: 'APPROVED',
          },
        });

        const notificationType = approvedOT ? 'SHIFT_ENDING_OT_APPROVED' : 'SHIFT_ENDING';
        const notificationTitle = approvedOT ? 'Approved Overtime Available' : 'Shift Ending Soon';
        const notificationMessage = approvedOT
          ? `You have approved overtime. Do you want to use it? Your shift ends at ${schedule.endTime}.`
          : `You will be automatically clocked out at ${schedule.endTime}. If you need overtime, please request it now.`;

        await createNotification(
          employee.userId,
          notificationType,
          notificationTitle,
          notificationMessage,
          {
            sessionId: session.id,
            shiftEnd: schedule.endTime,
            clientId: assignment.clientId,
            hasApprovedOT: !!approvedOT,
          },
          '/employee/dashboard'
        );

        // Mark session as notified
        await prisma.workSession.update({
          where: { id: session.id },
          data: { shiftEndNotifiedAt: now },
        });

        // Real-time socket event
        if (io) {
          io.emit(`notification:${employee.userId}`, {
            type: notificationType,
            message: notificationMessage,
            data: {
              sessionId: session.id,
              shiftEnd: schedule.endTime,
              clientId: assignment.clientId,
              hasApprovedOT: !!approvedOT,
            },
          });
        }

        console.log(`[Shift-End] Notified ${employee.firstName} ${employee.lastName} — shift ends at ${schedule.endTime} (${minutesLeft} min)${approvedOT ? ' [OT approved]' : ''}`);
      }

      // --- Controlled pause / Auto-clock-out at shift end ---
      if (minutesUntilEnd <= 0) {
        // Skip sessions that started AFTER the scheduled shift end.
        // These are "Extra Time" sessions — the employee deliberately clocked in
        // after their shift to do additional work. Don't auto-clock them out.
        if (session.startTime > shiftEndUTC) {
          continue;
        }

        // Check if the employee has an active/pending OT request for today
        const otRequest = await prisma.overtimeRequest.findFirst({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: recordDate,
            status: { in: ['PENDING', 'APPROVED'] },
          },
        });

        if (otRequest) {
          // Employee has an OT request — skip auto-clock-out
          continue;
        }

        // If already handled (employee responded to pause), skip
        if (session.shiftEndAction) {
          continue;
        }

        // If not yet paused, initiate controlled pause
        if (!session.shiftEndPausedAt) {
          await prisma.workSession.update({
            where: { id: session.id },
            data: { shiftEndPausedAt: now },
          });

          // Emit SHIFT_END_PAUSE socket event for frontend modal
          if (io) {
            io.emit(`notification:${employee.userId}`, {
              type: 'SHIFT_END_PAUSE',
              message: 'Your shift has ended. Choose to continue working or stay clocked out.',
              data: {
                sessionId: session.id,
                shiftEnd: schedule.endTime,
                clientId: assignment.clientId,
              },
            });
          }

          console.log(`[Shift-End] Controlled pause initiated for ${employee.firstName} ${employee.lastName} — shift ended at ${schedule.endTime}`);
          continue;
        }

        // If paused and 2-minute timeout expired, auto-clock-out at scheduled end time
        const pausedMinutes = (now.getTime() - session.shiftEndPausedAt.getTime()) / 60000;
        if (pausedMinutes >= 2) {
          await prisma.workSession.update({
            where: { id: session.id },
            data: { shiftEndAction: 'AUTO_TIMEOUT' },
          });
          // Auto-clock out at scheduled end time (not current time)
          await autoClockOut(session, employee, shiftEndUTC, schedule, io);
          console.log(`[Shift-End] Auto-clock-out (2-min timeout) for ${employee.firstName} ${employee.lastName}`);
        }
        // else: still within 2-minute window, wait for employee response
      }
    }
  } catch (error) {
    console.error('[Shift-End] Job failed:', error);
  }
};

/**
 * Auto-clock out an employee's active session.
 */
async function autoClockOut(
  session: any,
  employee: any,
  endTime: Date,
  schedule: { startTime: string; endTime: string },
  io?: Server
): Promise<void> {
  try {
    // End any ongoing break
    const ongoingBreak = session.breaks?.find((b: any) => !b.endTime);
    if (ongoingBreak) {
      const breakDuration = Math.round(
        (endTime.getTime() - ongoingBreak.startTime.getTime()) / 60000
      );
      await prisma.break.update({
        where: { id: ongoingBreak.id },
        data: {
          endTime,
          durationMinutes: breakDuration,
        },
      });
    }

    // Calculate total break time
    const breaks = await prisma.break.findMany({
      where: { workSessionId: session.id },
    });

    const totalBreakMinutes = breaks.reduce((total: number, brk: any) => {
      if (brk.durationMinutes) return total + brk.durationMinutes;
      if (brk.endTime) return total + Math.round((brk.endTime.getTime() - brk.startTime.getTime()) / 60000);
      return total;
    }, 0);

    // Update work session
    await prisma.workSession.update({
      where: { id: session.id },
      data: {
        endTime,
        status: 'COMPLETED',
        totalBreakMinutes,
      },
    });

    // Calculate total work time
    const totalWorkMinutes = Math.round(
      (endTime.getTime() - session.startTime.getTime()) / 60000
    ) - totalBreakMinutes;

    const today = new Date(Date.UTC(endTime.getFullYear(), endTime.getMonth(), endTime.getDate()));

    // Calculate scheduled start/end timestamps for the time record
    let scheduledStart: Date | null = null;
    let scheduledEnd: Date | null = null;

    if (schedule.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
      const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
      scheduledStart = new Date(endTime);
      scheduledStart.setHours(startHour, startMinute, 0, 0);
    }

    if (schedule.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
      const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
      scheduledEnd = new Date(endTime);
      scheduledEnd.setHours(endHour, endMinute, 0, 0);
    }

    // Auto-clock-out happens at scheduled end time, so overtime is 0 by definition.
    // The employee did not work past their shift — no overtime to report to client.
    const overtimeMinutes = 0;

    // Create/update time records for each client assignment
    const clientAssignments = employee.clientAssignments || [];
    for (const assignment of clientAssignments) {
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
        await prisma.timeRecord.update({
          where: { id: existing.id },
          data: {
            actualEnd: endTime,
            totalMinutes: newTotal,
            breakMinutes: newBreak,
            overtimeMinutes: 0,
            scheduledStart: scheduledStart || existing.scheduledStart,
            scheduledEnd: scheduledEnd || existing.scheduledEnd,
          },
        });
      } else {
        await prisma.timeRecord.create({
          data: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: today,
            scheduledStart,
            scheduledEnd,
            actualStart: session.startTime,
            actualEnd: endTime,
            totalMinutes: totalWorkMinutes,
            breakMinutes: totalBreakMinutes,
            overtimeMinutes: 0,
            status: 'PENDING',
          },
        });
      }
    }

    // --- Notify client(s) if overtime was worked ---
    if (overtimeMinutes > 0) {
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const dateStr = endTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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
            include: { user: { select: { id: true, email: true } } },
          });
          if (!client) continue;

          const clientName = client.contactPerson || client.companyName;

          // In-app notification
          try {
            await createNotification(
              client.userId,
              'OVERTIME_REQUEST',
              'Employee Worked Overtime',
              `${employeeName} worked ${overtimeHoursStr} overtime on ${dateStr}. Approve or deny.`,
              { employeeId: employee.id, date: dateStr },
              '/client/approvals?tab=overtime'
            );
          } catch (e) { console.error('[Shift-End OT] In-app notify failed:', e); }

          // Email
          try {
            await sendOTWorkedEmail(client.user.email, clientName, employeeName, dateStr, overtimeHoursStr, totalHoursStr);
          } catch (e) { console.error('[Shift-End OT] Email failed:', e); }

          // SMS
          if (client.phone) {
            try {
              await sendSMS(client.phone, `${employeeName} worked OT on ${dateStr} (${overtimeHoursStr}). Approve or deny. Log in to review.`);
            } catch (e) { console.error('[Shift-End OT] SMS failed:', e); }
          }
        } catch (e) {
          console.error(`[Shift-End OT] Failed for client ${assignment.clientId}:`, e);
        }
      }
    }

    // Notify the employee
    await createNotification(
      employee.userId,
      'AUTO_CLOCK_OUT',
      'Auto Clocked Out',
      `You have been automatically clocked out at the end of your shift.`,
      { sessionId: session.id },
      '/employee/dashboard'
    );

    if (io) {
      io.emit(`notification:${employee.userId}`, {
        type: 'AUTO_CLOCK_OUT',
        message: 'You have been automatically clocked out',
      });
    }

    console.log(`[Shift-End] Auto-clocked out ${employee.firstName} ${employee.lastName}`);
  } catch (error) {
    console.error(`[Shift-End] Failed to auto-clock-out session ${session.id}:`, error);
  }
}
