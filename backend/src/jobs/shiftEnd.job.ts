import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import { sendOTWorkedEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import type { Server } from 'socket.io';
import { buildScheduleTimestamp, getDayOfWeekInTimezone, formatTime12 } from '../utils/timezone';
import { computeBillingTimes } from '../utils/helpers';

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

      // Check if overtime requires approval for this client
      const clientPolicy = await prisma.clientPolicy.findUnique({
        where: { clientId: assignment.clientId },
        select: { overtimeRequiresApproval: true },
      });
      const otRequiresApproval = clientPolicy?.overtimeRequiresApproval ?? true;

      // Get today's date and day-of-week IN THE CLIENT TIMEZONE
      const dayOfWeek = getDayOfWeekInTimezone(clientTimezone, now);
      const todayInTz = new Date(now.toLocaleString('en-US', { timeZone: clientTimezone }));
      const recordDate = new Date(Date.UTC(todayInTz.getFullYear(), todayInTz.getMonth(), todayInTz.getDate()));

      // Find the employee's schedule for today
      // Use `now` (not midnight recordDate) for effectiveFrom comparison to avoid
      // missing schedules whose effectiveFrom timestamp is between midnight and now.
      let schedule = await prisma.schedule.findFirst({
        where: {
          employeeId: employee.id,
          dayOfWeek,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: recordDate } },
          ],
        },
        select: {
          startTime: true,
          endTime: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // Fallback: if no schedule found for current day, try the session start day
      // (handles timezone edge cases where clock-in day differs from current day)
      if (!schedule) {
        const sessionDayOfWeek = getDayOfWeekInTimezone(clientTimezone, session.startTime);
        if (sessionDayOfWeek !== dayOfWeek) {
          schedule = await prisma.schedule.findFirst({
            where: {
              employeeId: employee.id,
              dayOfWeek: sessionDayOfWeek,
              isActive: true,
              effectiveFrom: { lte: now },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: recordDate } },
              ],
            },
            select: {
              startTime: true,
              endTime: true,
            },
            orderBy: { effectiveFrom: 'desc' },
          });
        }
      }

      // Final fallback: use schedule stored on the work session at clock-in time
      if (!schedule || !schedule.endTime || !/^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
        if (session.scheduledEndTime && /^\d{1,2}:\d{2}$/.test(session.scheduledEndTime)) {
          schedule = {
            startTime: session.scheduledStartTime || '',
            endTime: session.scheduledEndTime,
          };
        } else {
          continue;
        }
      }

      const shiftEndUTC = buildScheduleTimestamp(clientTimezone, schedule.endTime, now);
      const minutesUntilEnd = (shiftEndUTC.getTime() - now.getTime()) / 60000;

      console.log(`[Shift-End] ${employee.firstName} ${employee.lastName}: schedule=${schedule.endTime}, tz=${clientTimezone}, shiftEndUTC=${shiftEndUTC.toISOString()}, now=${now.toISOString()}, minutesUntilEnd=${minutesUntilEnd.toFixed(1)}`);

      // --- 30-minute warning (fires once around the 30-min mark) ---
      if (minutesUntilEnd <= 30 && minutesUntilEnd > 0 && !session.shiftEndNotifiedAt) {
        const minutesLeft = Math.round(minutesUntilEnd);

        // Check if employee has approved OT that starts at or before shift end (continuous OT)
        // If OT starts AFTER shift end (e.g., off-shift 7:45 when shift ends 7:30),
        // still show popup and clock out at shift end — employee will clock in separately for OT
        const approvedOTRequests30 = await prisma.overtimeRequest.findMany({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: recordDate,
            status: 'APPROVED',
          },
        });

        const hasContinuousOT = approvedOTRequests30.some(ot => {
          // SHIFT_EXTENSION always extends from shift end — continuous
          if (ot.type === 'SHIFT_EXTENSION') return true;
          // OFF_SHIFT: check if start time is at or before shift end
          if (ot.requestedStartTime) {
            const otStartUTC = buildScheduleTimestamp(clientTimezone, ot.requestedStartTime, now);
            return otStartUTC.getTime() <= shiftEndUTC.getTime();
          }
          // No start time specified — treat as continuous
          return true;
        });

        if (hasContinuousOT) {
          await prisma.workSession.update({
            where: { id: session.id },
            data: { shiftEndNotifiedAt: now },
          });
          console.log(`[Shift-End] Skipped popup for ${employee.firstName} ${employee.lastName} — continuous OT approved`);
          continue;
        }

        const endTime12 = formatTime12(schedule.endTime);

        await createNotification(
          employee.userId,
          'SHIFT_ENDING',
          'Shift Ending Soon',
          `Your shift ends at ${endTime12}. If you need to continue working, the extra time will be tracked as overtime without prior approval.`,
          {
            sessionId: session.id,
            shiftEnd: schedule.endTime,
            clientId: assignment.clientId,
            hasApprovedOT: false,
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
            type: 'SHIFT_ENDING',
            message: `Your shift ends at ${endTime12}. If you need to continue working, the extra time will be tracked as overtime without prior approval.`,
            data: {
              sessionId: session.id,
              shiftEnd: schedule.endTime,
              clientId: assignment.clientId,
              hasApprovedOT: false,
            },
          });
        }

        console.log(`[Shift-End] Notified ${employee.firstName} ${employee.lastName} — shift ends at ${schedule.endTime} (${minutesLeft} min)`);
      }

      // --- Controlled pause / Auto-clock-out at shift end ---
      if (minutesUntilEnd <= 0) {
        // Skip sessions that started AFTER the scheduled shift end.
        // These are "Extra Time" sessions — the employee deliberately clocked in
        // after their shift to do additional work. Don't auto-clock them out.
        console.log(`[Shift-End] Extra-time check: session.startTime=${session.startTime.toISOString()} vs shiftEndUTC=${shiftEndUTC.toISOString()} → isExtraTime=${session.startTime > shiftEndUTC}`);
        if (session.startTime > shiftEndUTC) {
          console.log(`[Shift-End] SKIPPING extra-time session for ${employee.firstName} ${employee.lastName} (clocked in after shift end)`);
          continue;
        }

        // Auto-reject PENDING non-auto-generated SHIFT_EXTENSION OT requests for today — shift has ended without client approval
        // Skip OFF_SHIFT OT requests — they are for work after the shift and should remain pending for client approval
        // Skip if employee chose to continue working (their OT will be tracked as auto-generated at clock-out)
        if (session.shiftEndAction !== 'CONTINUE_WORKING') {
          const pendingOTRequests = await prisma.overtimeRequest.findMany({
            where: {
              employeeId: employee.id,
              clientId: assignment.clientId,
              date: recordDate,
              status: 'PENDING',
              isAutoGenerated: false,
              type: 'SHIFT_EXTENSION',
            },
          });

          if (pendingOTRequests.length > 0) {
            await prisma.overtimeRequest.updateMany({
              where: {
                id: { in: pendingOTRequests.map(ot => ot.id) },
              },
              data: {
                status: 'REJECTED',
                rejectionReason: 'Auto-rejected: shift ended without client approval',
              },
            });
            console.log(`[Shift-End] Auto-rejected ${pendingOTRequests.length} pending OT request(s) for ${employee.firstName} ${employee.lastName}`);
          }
        }

        // Check if the employee has APPROVED OT requests for today
        const approvedOTRequests = await prisma.overtimeRequest.findMany({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: recordDate,
            status: 'APPROVED',
          },
        });

        if (approvedOTRequests.length > 0) {
          // Only consider OT that is continuous (starts at or before shift end)
          // OFF_SHIFT OT that starts AFTER shift end = separate session, don't extend
          const continuousOT = approvedOTRequests.filter(ot => {
            if (ot.type === 'SHIFT_EXTENSION') return true;
            if (ot.requestedStartTime) {
              const otStartUTC = buildScheduleTimestamp(clientTimezone, ot.requestedStartTime, now);
              return otStartUTC.getTime() <= shiftEndUTC.getTime();
            }
            return true;
          });

          if (continuousOT.length > 0) {
            // Calculate extended end from continuous OT only
            let extendedEndUTC: Date;
            const otWithEndTime = continuousOT
              .filter(ot => ot.requestedEndTime || ot.estimatedEndTime)
              .map(ot => {
                const endTimeStr = ot.requestedEndTime || ot.estimatedEndTime;
                return buildScheduleTimestamp(clientTimezone, endTimeStr!, now);
              });

            if (otWithEndTime.length > 0) {
              extendedEndUTC = new Date(Math.max(...otWithEndTime.map(d => d.getTime())));
            } else {
              const totalContinuousOTMinutes = continuousOT.reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
              extendedEndUTC = new Date(shiftEndUTC.getTime() + totalContinuousOTMinutes * 60000);
            }

            const minutesUntilExtendedEnd = (extendedEndUTC.getTime() - now.getTime()) / 60000;

            console.log(`[Shift-End] ${employee.firstName} ${employee.lastName}: continuous OT, extendedEndUTC=${extendedEndUTC.toISOString()}, minutesUntilExtendedEnd=${minutesUntilExtendedEnd.toFixed(1)}`);

            if (minutesUntilExtendedEnd > 0) {
              // Still within approved OT window — let them work
              continue;
            }

            // Approved OT time has elapsed — auto-clock-out at extended end time
            if (!session.shiftEndAction) {
              await prisma.workSession.update({
                where: { id: session.id },
                data: { shiftEndAction: 'OT_AUTO_CLOCKOUT' },
              });
              await autoClockOut(session, employee, extendedEndUTC, schedule, io);
              console.log(`[Shift-End] Auto-clock-out after approved OT for ${employee.firstName} ${employee.lastName} at ${extendedEndUTC.toISOString()}`);
            }
            continue;
          }
          // Non-continuous OT (starts after shift end) — proceed with normal clock-out
          // Employee will clock in separately for the off-shift OT session
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
    const rawMs = endTime.getTime() - session.startTime.getTime();
    const fullMinutes = Math.floor(rawMs / 60000);
    const remainingSeconds = Math.floor((rawMs % 60000) / 1000);
    const totalWorkMinutes = (remainingSeconds >= 30 ? fullMinutes + 1 : fullMinutes) - totalBreakMinutes;

    const today = new Date(Date.UTC(endTime.getFullYear(), endTime.getMonth(), endTime.getDate()));

    // Calculate scheduled start/end timestamps for the time record
    // Must use buildScheduleTimestamp with client timezone (not setHours which uses server local time)
    const clientAssignments = employee.clientAssignments || [];
    const clientTz = clientAssignments[0]?.client?.timezone || 'UTC';
    let scheduledStart: Date | null = null;
    let scheduledEnd: Date | null = null;

    if (schedule.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
      scheduledStart = buildScheduleTimestamp(clientTz, schedule.startTime, endTime);
    }

    if (schedule.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
      scheduledEnd = buildScheduleTimestamp(clientTz, schedule.endTime, endTime);
    }

    // Auto-clock-out happens at scheduled end time, so overtime is 0 by definition.
    // The employee did not work past their shift — no overtime to report to client.
    const overtimeMinutes = 0;

    // Create/update time records for each client assignment
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
        const updActualStart = existing.actualStart || session.startTime;
        const updSchedStart = scheduledStart || existing.scheduledStart;
        const updSchedEnd = scheduledEnd || existing.scheduledEnd;
        const billingUpd = computeBillingTimes(updActualStart, endTime, updSchedStart, updSchedEnd);
        const billingRawMsUpd = billingUpd.billingEnd.getTime() - billingUpd.billingStart.getTime();
        const billingFullMinUpd = Math.floor(billingRawMsUpd / 60000);
        const billingRemSecUpd = Math.floor((billingRawMsUpd % 60000) / 1000);
        const billingMinsUpd = Math.max(0, (billingRemSecUpd >= 30 ? billingFullMinUpd + 1 : billingFullMinUpd) - newBreak);
        await prisma.timeRecord.update({
          where: { id: existing.id },
          data: {
            actualEnd: endTime,
            billingStart: billingUpd.billingStart,
            billingEnd: billingUpd.billingEnd,
            billingMinutes: billingMinsUpd,
            isLate: billingUpd.isLate,
            totalMinutes: newTotal,
            breakMinutes: newBreak,
            overtimeMinutes: 0,
            scheduledStart: scheduledStart || existing.scheduledStart,
            scheduledEnd: scheduledEnd || existing.scheduledEnd,
          },
        });
      } else {
        const billingNew = computeBillingTimes(session.startTime, endTime, scheduledStart, scheduledEnd);
        const billingRawMsNew = billingNew.billingEnd.getTime() - billingNew.billingStart.getTime();
        const billingFullMinNew = Math.floor(billingRawMsNew / 60000);
        const billingRemSecNew = Math.floor((billingRawMsNew % 60000) / 1000);
        const billingMinsNew = Math.max(0, (billingRemSecNew >= 30 ? billingFullMinNew + 1 : billingFullMinNew) - totalBreakMinutes);
        await prisma.timeRecord.create({
          data: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: today,
            scheduledStart,
            scheduledEnd,
            actualStart: session.startTime,
            actualEnd: endTime,
            billingStart: billingNew.billingStart,
            billingEnd: billingNew.billingEnd,
            billingMinutes: billingMinsNew,
            isLate: billingNew.isLate,
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
              '/client/approvals?type=overtime'
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
