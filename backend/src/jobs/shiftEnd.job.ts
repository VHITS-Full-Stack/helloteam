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
        // Extra Time sessions: started AFTER scheduled shift end (off-shift work)
        // Check if they have approved OFF_SHIFT OT with an end time — auto-clock-out when it passes
        console.log(`[Shift-End] Extra-time check: session.startTime=${session.startTime.toISOString()} vs shiftEndUTC=${shiftEndUTC.toISOString()} → isExtraTime=${session.startTime > shiftEndUTC}`);
        if (session.startTime > shiftEndUTC) {
          // Check for approved OFF_SHIFT OT with end time
          const offShiftOT = await prisma.overtimeRequest.findMany({
            where: {
              employeeId: employee.id,
              clientId: assignment.clientId,
              date: recordDate,
              type: 'OFF_SHIFT',
              status: 'APPROVED',
            },
          });

          if (offShiftOT.length > 0) {
            // Find the latest end time from approved off-shift OT
            const otEndTimes = offShiftOT
              .filter(ot => ot.requestedEndTime)
              .map(ot => buildScheduleTimestamp(clientTimezone, ot.requestedEndTime!, now));

            let offShiftEndUTC: Date | null = null;
            if (otEndTimes.length > 0) {
              offShiftEndUTC = new Date(Math.max(...otEndTimes.map(d => d.getTime())));
            } else {
              // No end time specified — use start time + requested minutes
              const totalOTMinutes = offShiftOT.reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
              const otStart = offShiftOT[0].requestedStartTime
                ? buildScheduleTimestamp(clientTimezone, offShiftOT[0].requestedStartTime, now)
                : session.startTime;
              offShiftEndUTC = new Date(otStart.getTime() + totalOTMinutes * 60000);
            }

            const minutesUntilOffShiftEnd = (offShiftEndUTC.getTime() - now.getTime()) / 60000;
            console.log(`[Shift-End] ${employee.firstName} ${employee.lastName}: off-shift OT, endUTC=${offShiftEndUTC.toISOString()}, minutesUntil=${minutesUntilOffShiftEnd.toFixed(1)}`);

            if (minutesUntilOffShiftEnd > 0) {
              // Still within approved off-shift window
              continue;
            }

            // Off-shift OT time has elapsed — auto-clock-out
            if (!session.shiftEndAction) {
              await prisma.workSession.update({
                where: { id: session.id },
                data: { shiftEndAction: 'OT_AUTO_CLOCKOUT' },
              });
              await autoClockOut(session, employee, offShiftEndUTC, schedule, clientTimezone, otRequiresApproval, io);
              console.log(`[Shift-End] Auto-clock-out after off-shift OT for ${employee.firstName} ${employee.lastName} at ${offShiftEndUTC.toISOString()}`);
            }
            continue;
          }

          // No approved off-shift OT — skip (let employee work, will be tracked as unapproved at manual clock-out)
          console.log(`[Shift-End] SKIPPING extra-time session for ${employee.firstName} ${employee.lastName} (no approved off-shift OT)`);
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

        // Check if the employee has APPROVED or PENDING OT requests for today
        // Include PENDING so that requested shift extensions still trigger auto clock-out when time expires
        console.log(`[Shift-End] ${employee.firstName} ${employee.lastName}: checking OT for date=${recordDate.toISOString()}, shiftEndAction=${session.shiftEndAction}, shiftEndPausedAt=${session.shiftEndPausedAt?.toISOString() || 'null'}`);
        const approvedOTRequests = await prisma.overtimeRequest.findMany({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: recordDate,
            status: { in: ['APPROVED', 'PENDING'] },
          },
        });
        console.log(`[Shift-End] ${employee.firstName} ${employee.lastName}: found ${approvedOTRequests.length} OT(s)${approvedOTRequests.length > 0 ? ': ' + approvedOTRequests.map(o => `${o.type}/${o.status}/${o.requestedMinutes}m`).join(', ') : ''}`);

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
              await autoClockOut(session, employee, extendedEndUTC, schedule, clientTimezone, otRequiresApproval, io);
              console.log(`[Shift-End] Auto-clock-out after approved OT for ${employee.firstName} ${employee.lastName} at ${extendedEndUTC.toISOString()}`);
            }
            continue;
          }
          // Non-continuous OT (starts after shift end) — proceed with normal clock-out
          // Employee will clock in separately for the off-shift OT session
        }

        // If employee chose to continue working, check if they still have valid OT
        if (session.shiftEndAction === 'CONTINUE_WORKING') {
          // Re-check: do they have any approved or pending OT left?
          const remainingOT = await prisma.overtimeRequest.findFirst({
            where: {
              employeeId: employee.id,
              clientId: assignment.clientId,
              date: recordDate,
              status: { in: ['APPROVED', 'PENDING'] },
            },
          });

          if (!remainingOT) {
            // All OT rejected — auto-clock out at shift end time
            await prisma.workSession.update({
              where: { id: session.id },
              data: { shiftEndAction: 'OT_REJECTED_CLOCKOUT' },
            });
            await autoClockOut(session, employee, shiftEndUTC, schedule, clientTimezone, otRequiresApproval, io);
            console.log(`[Shift-End] Auto-clock-out for ${employee.firstName} ${employee.lastName} — all OT rejected, no approved OT remaining`);
          }
          continue;
        }

        // If already handled by other action (e.g. OT_AUTO_CLOCKOUT, AUTO_TIMEOUT), skip
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
          await autoClockOut(session, employee, shiftEndUTC, schedule, clientTimezone, otRequiresApproval, io);
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
 * Mirrors manual clock-out logic from workSession.controller.ts.
 */
async function autoClockOut(
  session: any,
  employee: any,
  endTime: Date,
  schedule: { startTime: string; endTime: string },
  clientTimezone: string,
  otRequiresApproval: boolean,
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
        data: { endTime, durationMinutes: breakDuration },
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
      data: { endTime, status: 'COMPLETED', totalBreakMinutes },
    });

    // Calculate total work time (same as manual clock-out: Math.round)
    const totalWorkMinutes = Math.round(
      (endTime.getTime() - session.startTime.getTime()) / 60000
    ) - totalBreakMinutes;

    // Use client timezone for "today" date (consistent with manual clock-out)
    const todayInTz = new Date(endTime.toLocaleString('en-US', { timeZone: clientTimezone }));
    const today = new Date(Date.UTC(todayInTz.getFullYear(), todayInTz.getMonth(), todayInTz.getDate()));

    // Calculate scheduled start/end timestamps
    let scheduledStart: Date | null = null;
    let scheduledEnd: Date | null = null;
    if (schedule.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
      scheduledStart = buildScheduleTimestamp(clientTimezone, schedule.startTime, session.startTime);
    }
    if (schedule.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
      scheduledEnd = buildScheduleTimestamp(clientTimezone, schedule.endTime, session.startTime);
    }

    // Detect Extra Time: session started AFTER scheduled end
    const isExtraTime = scheduledEnd && session.startTime > scheduledEnd;

    const OT_GRACE_MINUTES = 7;

    // Calculate early overtime (clocked in before schedule start)
    let earlyOvertimeMinutes = 0;
    if (scheduledStart && session.startTime < scheduledStart) {
      earlyOvertimeMinutes = Math.round(
        (scheduledStart.getTime() - session.startTime.getTime()) / 60000
      );
    }

    // Calculate overtime
    const scheduledDurationMinutes = scheduledEnd && scheduledStart
      ? Math.round((scheduledEnd.getTime() - scheduledStart.getTime()) / 60000)
      : 480;
    const effectiveEarlyOT = earlyOvertimeMinutes > OT_GRACE_MINUTES ? earlyOvertimeMinutes : 0;
    const regularWorkMinutes = totalWorkMinutes - effectiveEarlyOT;
    const lateOvertimeMinutes = Math.max(0, regularWorkMinutes - scheduledDurationMinutes);
    const effectiveLateOT = lateOvertimeMinutes > OT_GRACE_MINUTES ? lateOvertimeMinutes : 0;
    let overtimeMinutes = effectiveEarlyOT + effectiveLateOT;

    // Calculate shift extension (minutes worked past scheduled end)
    let shiftExtensionMinutes = scheduledEnd && endTime > scheduledEnd
      ? Math.round((endTime.getTime() - scheduledEnd.getTime()) / 60000)
      : 0;

    // Extra Time override: ALL work is overtime, no shift extension
    if (isExtraTime) {
      overtimeMinutes = totalWorkMinutes;
      shiftExtensionMinutes = 0;
    }
    const shiftExtensionReason = session.shiftEndAction === 'CONTINUE_WORKING'
      ? (session.notes || null)
      : null;

    // When OT doesn't require approval: treat ALL hours as regular approved time
    if (!otRequiresApproval) {
      overtimeMinutes = 0;
      shiftExtensionMinutes = 0;
    }

    // Get all active client assignments
    const clientAssignments = employee.clientAssignments || [];

    // Create/update time record for each assigned client
    for (const assignment of clientAssignments) {
      let status: 'PENDING' | 'APPROVED' = 'PENDING';
      let shiftExtensionStatus: 'NONE' | 'APPROVED' | 'PENDING' | 'UNAPPROVED' | 'DENIED' = 'NONE';
      let extraTimeStatus: 'NONE' | 'APPROVED' | 'PENDING' | 'UNAPPROVED' | 'DENIED' = 'NONE';
      let extraTimeMinutes = 0;

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
          status = 'APPROVED';
        }
      }

      // Determine shift extension approval status
      if (shiftExtensionMinutes > OT_GRACE_MINUTES) {
        const otRequest = await prisma.overtimeRequest.findFirst({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: today,
            type: 'SHIFT_EXTENSION',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (otRequest) {
          if (otRequest.status === 'APPROVED') shiftExtensionStatus = 'APPROVED';
          else if (otRequest.status === 'PENDING') shiftExtensionStatus = 'UNAPPROVED';
          else if (otRequest.status === 'REJECTED') shiftExtensionStatus = 'DENIED';
        } else {
          shiftExtensionStatus = 'UNAPPROVED';
        }
      }

      // Determine extra time approval status
      const hasExtraTime = otRequiresApproval && (isExtraTime || earlyOvertimeMinutes > OT_GRACE_MINUTES);
      if (hasExtraTime) {
        extraTimeMinutes = isExtraTime ? totalWorkMinutes : earlyOvertimeMinutes;
        const otRequest = await prisma.overtimeRequest.findFirst({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: today,
            type: 'OFF_SHIFT',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (otRequest) {
          if (otRequest.status === 'APPROVED') extraTimeStatus = 'APPROVED';
          else if (otRequest.status === 'PENDING') extraTimeStatus = 'UNAPPROVED';
          else if (otRequest.status === 'REJECTED') extraTimeStatus = 'DENIED';
        } else {
          extraTimeStatus = 'UNAPPROVED';
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
        const newRegular = newTotal - earlyOvertimeMinutes;
        const newLateOT = Math.max(0, newRegular - scheduledDurationMinutes);
        const newOvertime = earlyOvertimeMinutes + newLateOT;

        const updActualStart = existing.actualStart || session.startTime;
        const updSchedStart = scheduledStart || existing.scheduledStart;
        const updSchedEnd = scheduledEnd || existing.scheduledEnd;
        const billingUpd = computeBillingTimes(updActualStart, endTime, updSchedStart, updSchedEnd);
        const billingMinsUpd = Math.max(0, Math.floor((billingUpd.billingEnd.getTime() - billingUpd.billingStart.getTime()) / 60000) - newBreak);

        const updateData: any = {
          actualEnd: endTime,
          billingStart: billingUpd.billingStart,
          billingEnd: billingUpd.billingEnd,
          billingMinutes: billingMinsUpd,
          isLate: billingUpd.isLate,
          totalMinutes: newTotal,
          breakMinutes: newBreak,
          overtimeMinutes: isExtraTime ? (existing.overtimeMinutes + totalWorkMinutes) : newOvertime,
          shiftExtensionMinutes: isExtraTime ? (existing.shiftExtensionMinutes || 0) : shiftExtensionMinutes,
          shiftExtensionStatus: isExtraTime ? existing.shiftExtensionStatus : shiftExtensionStatus,
          shiftExtensionReason: isExtraTime ? existing.shiftExtensionReason : shiftExtensionReason,
          extraTimeMinutes: isExtraTime
            ? (existing.extraTimeMinutes || 0) + totalWorkMinutes
            : (earlyOvertimeMinutes > 0 ? earlyOvertimeMinutes : (existing.extraTimeMinutes || 0)),
          extraTimeStatus: hasExtraTime ? extraTimeStatus : existing.extraTimeStatus,
          scheduledStart: scheduledStart || existing.scheduledStart,
          scheduledEnd: scheduledEnd || existing.scheduledEnd,
        };
        if (newOvertime > 0 && status === 'APPROVED' && existing.status === 'PENDING') {
          updateData.status = 'APPROVED';
          updateData.approvedAt = new Date();
        }

        await prisma.timeRecord.update({ where: { id: existing.id }, data: updateData });
      } else {
        const billing = computeBillingTimes(session.startTime, endTime, scheduledStart, scheduledEnd);
        const billingMins = Math.max(0, Math.floor((billing.billingEnd.getTime() - billing.billingStart.getTime()) / 60000) - totalBreakMinutes);
        await prisma.timeRecord.create({
          data: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            date: today,
            scheduledStart,
            scheduledEnd,
            actualStart: session.startTime,
            actualEnd: endTime,
            billingStart: billing.billingStart,
            billingEnd: billing.billingEnd,
            billingMinutes: billingMins,
            isLate: billing.isLate,
            totalMinutes: totalWorkMinutes,
            breakMinutes: totalBreakMinutes,
            overtimeMinutes,
            shiftExtensionMinutes,
            shiftExtensionStatus,
            shiftExtensionReason,
            extraTimeStatus,
            extraTimeMinutes,
            status,
            approvedAt: status === 'APPROVED' ? new Date() : undefined,
          },
        });
      }

      // Auto-create OvertimeRequest(s) if OT was worked without a prior request
      if (otRequiresApproval) {
        const fmtHHMM = (d: Date) => {
          const parts = d.toLocaleString('en-US', { timeZone: clientTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).split(':');
          return `${parts[0].padStart(2, '0')}:${parts[1]}`;
        };

        // Early clock-in overtime → OFF_SHIFT
        if (earlyOvertimeMinutes > OT_GRACE_MINUTES && !isExtraTime) {
          try {
            const existingEarlyOT = await prisma.overtimeRequest.findFirst({
              where: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: today,
                type: 'OFF_SHIFT',
                isAutoGenerated: true,
                status: { not: 'REJECTED' },
                requestedStartTime: fmtHHMM(session.startTime),
              },
            });
            if (!existingEarlyOT) {
              await prisma.overtimeRequest.create({
                data: {
                  employeeId: employee.id,
                  clientId: assignment.clientId,
                  date: today,
                  type: 'OFF_SHIFT',
                  requestedMinutes: earlyOvertimeMinutes,
                  requestedStartTime: fmtHHMM(session.startTime),
                  requestedEndTime: scheduledStart ? fmtHHMM(scheduledStart) : undefined,
                  reason: 'Auto-generated — employee clocked in before scheduled shift',
                  isAutoGenerated: true,
                  status: 'PENDING',
                },
              });
              console.log(`[Shift-End OT-Auto] Created OFF_SHIFT (early) for ${employee.firstName} ${employee.lastName}, ${earlyOvertimeMinutes} min`);
            }
          } catch (e) { console.error('[Shift-End OT-Auto] Failed early OT request:', e); }
        }

        // Shift extension or extra time session
        const sessionOT = isExtraTime ? totalWorkMinutes : shiftExtensionMinutes;
        if (sessionOT > OT_GRACE_MINUTES) {
          try {
            const otType = isExtraTime ? 'OFF_SHIFT' : 'SHIFT_EXTENSION';
            // For OFF_SHIFT sessions, match by start time so each session gets its own OT entry.
            // For SHIFT_EXTENSION, one entry per day is correct (only one shift end).
            const sessionStartHHMM = isExtraTime ? fmtHHMM(session.startTime) : null;
            const existingOT = await prisma.overtimeRequest.findFirst({
              where: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: today,
                type: otType,
                status: { not: 'REJECTED' },
                ...(sessionStartHHMM ? { requestedStartTime: sessionStartHHMM } : {}),
              },
            });
            if (!existingOT) {
              await prisma.overtimeRequest.create({
                data: {
                  employeeId: employee.id,
                  clientId: assignment.clientId,
                  date: today,
                  type: otType,
                  requestedMinutes: sessionOT,
                  reason: 'Auto-generated — employee worked overtime (auto clock-out)',
                  isAutoGenerated: true,
                  status: 'PENDING',
                  ...(otType === 'SHIFT_EXTENSION'
                    ? { estimatedEndTime: fmtHHMM(endTime) }
                    : { requestedStartTime: fmtHHMM(session.startTime), requestedEndTime: fmtHHMM(endTime) }),
                },
              });
              console.log(`[Shift-End OT-Auto] Created ${otType} for ${employee.firstName} ${employee.lastName}, ${sessionOT} min`);
            } else {
              console.log(`[Shift-End OT-Auto] Skipped — existing ${otType} OT request found for ${employee.firstName} ${employee.lastName}`);
            }
          } catch (e) { console.error('[Shift-End OT-Auto] Failed OT request:', e); }
        }
      }
    }

    // --- Notify client(s) if overtime was worked ---
    if (overtimeMinutes > 0 && otRequiresApproval) {
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

          try {
            await createNotification(
              client.userId, 'OVERTIME_REQUEST', 'Employee Worked Overtime',
              `${employeeName} worked ${overtimeHoursStr} overtime on ${dateStr}. Approve or deny.`,
              { employeeId: employee.id, date: dateStr },
              '/client/approvals?type=overtime'
            );
          } catch (e) { console.error('[Shift-End OT] In-app notify failed:', e); }

          try {
            await sendOTWorkedEmail(client.user.email, clientName, employeeName, dateStr, overtimeHoursStr, totalHoursStr);
          } catch (e) { console.error('[Shift-End OT] Email failed:', e); }

          if (client.phone) {
            try {
              await sendSMS(client.phone, `${employeeName} worked OT on ${dateStr} (${overtimeHoursStr}). Approve or deny. Log in to review.`);
            } catch (e) { console.error('[Shift-End OT] SMS failed:', e); }
          }
        } catch (e) { console.error(`[Shift-End OT] Failed for client ${assignment.clientId}:`, e); }
      }
    }

    // Notify the employee
    await createNotification(
      employee.userId, 'AUTO_CLOCK_OUT', 'Auto Clocked Out',
      'You have been automatically clocked out at the end of your shift.',
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
