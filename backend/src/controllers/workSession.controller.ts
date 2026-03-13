import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { WorkSessionStatus } from '@prisma/client';
import { sendOTWorkedEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import { createNotification } from './notification.controller';
import { getTimeInTimezone, buildScheduleTimestamp } from '../utils/timezone';
import { computeBillingTimes } from '../utils/helpers';

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
      include: { client: { select: { companyName: true, timezone: true } } },
    });

    if (!clientAssignment) {
      res.status(400).json({
        success: false,
        message: 'You are not assigned to any client. Please contact your administrator.',
      });
      return;
    }

    // Get current time in the client's timezone for schedule comparison
    const now = new Date();
    const clientTz = clientAssignment.client.timezone || 'UTC';
    const clientTime = getTimeInTimezone(clientTz, now);
    const { totalMinutes: nowTotalMinutes, dayOfWeek } = clientTime;

    console.log(`[Clock-in] Client TZ: ${clientTz}, Client time: ${clientTime.hour}:${String(clientTime.minute).padStart(2, '0')} (${nowTotalMinutes} mins), Day: ${dayOfWeek}, Server UTC: ${now.toISOString()}`);

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
      orderBy: { effectiveFrom: 'desc' },
    });

    console.log(`[Clock-in] Schedule found:`, schedule ? `startTime=${schedule.startTime}, endTime=${schedule.endTime}, dayOfWeek=${schedule.dayOfWeek}` : 'NONE');

    // Check if overtime requires approval for clock-in warnings
    const clockInPolicy = await prisma.clientPolicy.findUnique({
      where: { clientId: clientAssignment.clientId },
      select: { overtimeRequiresApproval: true },
    });
    const clockInOtRequiresApproval = clockInPolicy?.overtimeRequiresApproval ?? true;

    // Warn on unscheduled day — allow as Extra Time after confirmation
    // Skip warning when OT doesn't require approval (all hours are regular approved time)
    if (!schedule) {
      if (clockInOtRequiresApproval && !req.body?.confirmUnscheduledDay) {
        res.status(200).json({
          success: false,
          requiresConfirmation: true,
          confirmationType: 'UNSCHEDULED_DAY',
          message: 'You do not have a schedule assigned for today. Clocking in will be recorded as Extra Time and requires client approval.',
        });
        return;
      }
    }

    // Check early clock-in (before schedule start), late arrival, and post-shift clock-in (after schedule end)
    if (schedule && schedule.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
      const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
      const startTotalMinutes = startHour * 60 + startMinute;

      console.log(`[Clock-in] Time check: nowTotalMinutes=${nowTotalMinutes}, startTotalMinutes=${startTotalMinutes}, isEarly=${nowTotalMinutes < startTotalMinutes}, isLate=${nowTotalMinutes >= startTotalMinutes + 1}, confirmFlags=`, { confirmEarlyClockIn: req.body?.confirmEarlyClockIn, confirmLateArrival: req.body?.confirmLateArrival });

      if (clockInOtRequiresApproval && nowTotalMinutes < startTotalMinutes && !req.body?.confirmEarlyClockIn) {
        const currentTimeStr = `${String(clientTime.hour).padStart(2, '0')}:${String(clientTime.minute).padStart(2, '0')}`;
        // Before schedule start — warn employee about early clock-in
        res.status(200).json({
          success: false,
          requiresConfirmation: true,
          confirmationType: 'EARLY_CLOCK_IN',
          message: `Your shift hasn't started yet. Current time in ${clientTz} is ${currentTimeStr}, shift starts at ${schedule.startTime}. You may not get paid for these hours.`,
          scheduledStart: schedule.startTime,
        });
        return;
      }

      // Check late arrival (1+ minutes after shift start, but before shift end)
      const lateThresholdMinutes = 1;
      if (nowTotalMinutes >= startTotalMinutes + lateThresholdMinutes && !req.body?.confirmLateArrival) {
        // Only show late arrival warning if we're still within the shift (before end time)
        const [endH, endM] = (schedule.endTime || '23:59').split(':').map(Number);
        const endTotal = endH * 60 + endM;
        if (nowTotalMinutes <= endTotal) {
          const lateMinutes = nowTotalMinutes - startTotalMinutes;
          const lateDisplay = lateMinutes >= 60
            ? `${Math.floor(lateMinutes / 60)} hour${Math.floor(lateMinutes / 60) > 1 ? 's' : ''} ${lateMinutes % 60 > 0 ? `${lateMinutes % 60} minutes` : ''}`
            : `${lateMinutes} minutes`;
          const startTimeFormatted = (() => {
            const [h, m] = schedule.startTime.split(':').map(Number);
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${String(m).padStart(2, '0')} ${period}`;
          })();
          res.status(200).json({
            success: false,
            requiresConfirmation: true,
            confirmationType: 'LATE_ARRIVAL',
            message: `You are ${lateDisplay.trim()} late. Your shift started at ${startTimeFormatted}. This will be recorded as a late arrival.`,
            scheduledStart: schedule.startTime,
            lateMinutes,
          });
          return;
        }
      }
    }

    if (schedule?.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
      const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
      const endTotalMinutes = endHour * 60 + endMinute;

      console.log(`[Clock-in] Post-shift check: nowTotalMinutes=${nowTotalMinutes} vs endTotalMinutes=${endTotalMinutes} (endTime=${schedule.endTime}), isPostShift=${nowTotalMinutes > endTotalMinutes}`);

      if (nowTotalMinutes > endTotalMinutes) {
        // Check if employee has an OT request for today
        const todayDate = new Date(now.toLocaleString('en-US', { timeZone: clientTz }));
        const recordDate = new Date(Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()));
        const approvedOT = await prisma.overtimeRequest.findFirst({
          where: {
            employeeId: employee.id,
            clientId: clientAssignment.clientId,
            date: recordDate,
            status: 'APPROVED',
          },
        });

        if (clockInOtRequiresApproval && !approvedOT && !req.body?.confirmPostShift) {
          // Check if there's a pending/rejected OT request to tailor the message
          const anyOTRequest = await prisma.overtimeRequest.findFirst({
            where: {
              employeeId: employee.id,
              clientId: clientAssignment.clientId,
              date: recordDate,
            },
          });

          const endTimeFormatted = (() => {
            const [h, m] = schedule.endTime.split(':').map(Number);
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${String(m).padStart(2, '0')} ${period}`;
          })();

          let confirmationType = 'POST_SHIFT';
          let message = '';

          if (anyOTRequest && anyOTRequest.status === 'PENDING') {
            message = `Your overtime request is pending approval. Your shift ended at ${endTimeFormatted}. Hours worked without approved overtime may not be compensated.`;
          } else if (anyOTRequest && anyOTRequest.status === 'REJECTED') {
            message = `Your overtime request was denied. Your shift ended at ${endTimeFormatted}. Clocking in now requires special approval at client's discretion.`;
          } else {
            // No OT request — this is a late clock-in after shift ended
            confirmationType = 'LATE_CLOCK_IN';
            message = `Your shift ended at ${endTimeFormatted}. You are clocking in after your scheduled hours. These hours may be counted as overtime and require client approval.`;
          }

          res.status(200).json({
            success: false,
            requiresConfirmation: true,
            confirmationType,
            message,
          });
          return;
        }
      }
    }

    // Calculate arrival status using client timezone (before creating session so we can store it)
    let arrivalStatus = 'No Schedule';
    let lateMinutes: number | null = null;
    if (schedule) {
      const [scheduleHour, scheduleMinute] = schedule.startTime.split(':').map(Number);
      const scheduledStartMinutes = scheduleHour * 60 + scheduleMinute;
      const timeDiffMinutes = nowTotalMinutes - scheduledStartMinutes;

      if (timeDiffMinutes < 0) {
        arrivalStatus = 'Early';
      } else if (timeDiffMinutes < 1) {
        arrivalStatus = 'On Time';
      } else {
        arrivalStatus = 'Late';
        lateMinutes = timeDiffMinutes;
      }
    }

    // Get client IP
    const clientIp = getClientIp(req);

    // Get user email for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Create new work session (store schedule times for shift-end job fallback)
    const workSession = await prisma.workSession.create({
      data: {
        employeeId: employee.id,
        startTime: new Date(),
        status: 'ACTIVE',
        ipAddress: clientIp,
        arrivalStatus,
        lateMinutes,
        scheduledStartTime: schedule?.startTime || null,
        scheduledEndTime: schedule?.endTime || null,
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
    const now = new Date();

    // Get all active client assignments for the employee
    const clientAssignments = await prisma.clientEmployee.findMany({
      where: {
        employeeId: employee.id,
        isActive: true,
      },
    });

    if (clientAssignments.length > 0) {
      // Get client timezone for schedule lookup
      const firstClient = await prisma.client.findUnique({
        where: { id: clientAssignments[0].clientId },
        select: { timezone: true, clientPolicies: { select: { overtimeRequiresApproval: true } } },
      });
      const clockOutTz = firstClient?.timezone || 'UTC';
      const otRequiresApproval = firstClient?.clientPolicies?.overtimeRequiresApproval ?? true;

      // Use client timezone to determine "today" date (same approach as clock-in)
      // This ensures the TimeRecord date matches the employee's local calendar date
      const todayInTz = new Date(now.toLocaleString('en-US', { timeZone: clockOutTz }));
      const today = new Date(Date.UTC(todayInTz.getFullYear(), todayInTz.getMonth(), todayInTz.getDate()));
      const { dayOfWeek: clockOutDow } = getTimeInTimezone(clockOutTz, now);

      let schedule = await prisma.schedule.findFirst({
        where: {
          employeeId: employee.id,
          dayOfWeek: clockOutDow,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // Fallback: if no schedule found for clock-out day, try the session start day
      // (handles timezone edge cases or late clock-outs past midnight)
      if (!schedule) {
        const { dayOfWeek: sessionDow } = getTimeInTimezone(clockOutTz, activeSession.startTime);
        if (sessionDow !== clockOutDow) {
          schedule = await prisma.schedule.findFirst({
            where: {
              employeeId: employee.id,
              dayOfWeek: sessionDow,
              isActive: true,
              effectiveFrom: { lte: now },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: now } },
              ],
            },
            orderBy: { effectiveFrom: 'desc' },
          });
        }
      }

      // Final fallback: use schedule stored on the work session at clock-in time
      if (!schedule && activeSession.scheduledStartTime && activeSession.scheduledEndTime) {
        schedule = {
          startTime: activeSession.scheduledStartTime,
          endTime: activeSession.scheduledEndTime,
          dayOfWeek: clockOutDow,
        } as any;
      }

      // Calculate early overtime (pre-schedule minutes) using proper timezone
      let earlyOvertimeMinutes = 0;
      let scheduledStart: Date | null = null;
      let scheduledEnd: Date | null = null;

      if (schedule?.startTime && /^\d{1,2}:\d{2}$/.test(schedule.startTime)) {
        scheduledStart = buildScheduleTimestamp(clockOutTz, schedule.startTime, activeSession.startTime);

        // If employee clocked in before schedule start, those minutes are overtime
        if (activeSession.startTime < scheduledStart) {
          earlyOvertimeMinutes = Math.round(
            (scheduledStart.getTime() - activeSession.startTime.getTime()) / 60000
          );
        }
      }

      if (schedule?.endTime && /^\d{1,2}:\d{2}$/.test(schedule.endTime)) {
        scheduledEnd = buildScheduleTimestamp(clockOutTz, schedule.endTime, activeSession.startTime);
      }

      // Detect Extra Time: session started AFTER scheduled end, or no schedule exists for the day
      const isExtraTime = !schedule || (scheduledEnd && activeSession.startTime > scheduledEnd);

      const OT_GRACE_MINUTES = 7; // Minutes of early/late allowed before counting as OT

      // Overtime = early pre-schedule minutes + any hours beyond scheduled duration
      // Only count as OT if beyond the grace period
      const scheduledDurationMinutes = scheduledEnd && scheduledStart
        ? Math.round((scheduledEnd.getTime() - scheduledStart.getTime()) / 60000)
        : 480; // fallback to 8h if no schedule
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
      const shiftExtensionReason = activeSession.shiftEndAction === 'CONTINUE_WORKING'
        ? (activeSession.notes || null)
        : null;

      // When "Overtime Requires Approval" is UNCHECKED: treat ALL hours as regular approved time
      if (!otRequiresApproval) {
        overtimeMinutes = 0;
        shiftExtensionMinutes = 0;
      }

      // Create/update time record for each assigned client
      await Promise.all(
        clientAssignments.map(async (assignment) => {
          // Check if there's a pre-approved OvertimeRequest for this employee/client/date
          let status: 'PENDING' | 'APPROVED' = !otRequiresApproval ? 'APPROVED' : 'PENDING';
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
              // Pre-approved OT → auto-approve the time record immediately
              status = 'APPROVED';
            }
          }

          // Determine shift extension approval status (only if beyond grace period)
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
              if (otRequest.status === 'APPROVED') {
                shiftExtensionStatus = 'APPROVED';
              } else if (otRequest.status === 'PENDING') {
                // Pending ≠ Approved: if employee actually worked past shift end,
                // status is UNAPPROVED (spec: "pending ≠ approved")
                shiftExtensionStatus = 'UNAPPROVED';
              } else if (otRequest.status === 'REJECTED') {
                shiftExtensionStatus = 'DENIED';
              }
            } else {
              // Worked past shift end without any OT request
              shiftExtensionStatus = 'UNAPPROVED';
            }
          }

          // Determine extra time approval status (early clock-in or post-shift session)
          // Skip when OT doesn't require approval — all hours are regular approved time
          // Only count early clock-in as extra time if it exceeds the grace period
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
              if (otRequest.status === 'APPROVED') {
                extraTimeStatus = 'APPROVED';
              } else if (otRequest.status === 'PENDING') {
                extraTimeStatus = 'UNAPPROVED';
              } else if (otRequest.status === 'REJECTED') {
                extraTimeStatus = 'DENIED';
              }
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
            // Recalculate overtime with early minutes considered
            const newRegular = newTotal - earlyOvertimeMinutes;
            const newLateOT = Math.max(0, newRegular - scheduledDurationMinutes);
            const newOvertime = earlyOvertimeMinutes + newLateOT;

            // Recompute billing times with updated actual times
            const updatedActualStart = existing.actualStart || activeSession.startTime;
            const updatedScheduledStart = scheduledStart || existing.scheduledStart;
            const updatedScheduledEnd = scheduledEnd || existing.scheduledEnd;
            const billingUpdate = computeBillingTimes(updatedActualStart, endTime, updatedScheduledStart, updatedScheduledEnd);
            const billingMinsUpdate = Math.max(0, Math.floor((billingUpdate.billingEnd.getTime() - billingUpdate.billingStart.getTime()) / 60000) - newBreak);

            // If overtime was added and pre-approved, update status
            const updateData: any = {
              actualEnd: endTime,
              billingStart: billingUpdate.billingStart,
              billingEnd: billingUpdate.billingEnd,
              billingMinutes: billingMinsUpdate,
              isLate: billingUpdate.isLate,
              totalMinutes: newTotal,
              breakMinutes: newBreak,
              overtimeMinutes: isExtraTime ? (existing.overtimeMinutes + totalWorkMinutes) : newOvertime,
              // For Extra Time sessions, preserve existing shift extension data from the regular shift
              shiftExtensionMinutes: isExtraTime ? (existing.shiftExtensionMinutes || 0) : shiftExtensionMinutes,
              shiftExtensionStatus: isExtraTime ? existing.shiftExtensionStatus : shiftExtensionStatus,
              shiftExtensionReason: isExtraTime ? existing.shiftExtensionReason : shiftExtensionReason,
              // Extra Time: accumulate minutes, update status
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

            await prisma.timeRecord.update({
              where: { id: existing.id },
              data: updateData,
            });
          } else {
            const billing = computeBillingTimes(activeSession.startTime, endTime, scheduledStart, scheduledEnd);
            const billingMins = Math.max(0, Math.floor((billing.billingEnd.getTime() - billing.billingStart.getTime()) / 60000) - totalBreakMinutes);
            await prisma.timeRecord.create({
              data: {
                employeeId: employee.id,
                clientId: assignment.clientId,
                date: today,
                scheduledStart,
                scheduledEnd,
                actualStart: activeSession.startTime,
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

          // --- Auto-create OvertimeRequest(s) if overtime was worked without a prior request ---
          // Skip entirely when OT doesn't require approval — no OT tracking needed
          if (!otRequiresApproval) { /* no-op: all hours are regular */ }
          else {
          const fmtHHMM = (d: Date) => {
            const parts = d.toLocaleString('en-US', { timeZone: clockOutTz, hour: '2-digit', minute: '2-digit', hour12: false }).split(':');
            return `${parts[0].padStart(2, '0')}:${parts[1]}`;
          };

          // Early clock-in overtime → OFF_SHIFT (Extra Time per spec: "early clock-in is Extra Time, not Shift Extension")
          // Only auto-create if early minutes exceed grace period and no existing request
          if (earlyOvertimeMinutes > OT_GRACE_MINUTES && !isExtraTime) {
            try {
              const existingEarlyOT = await prisma.overtimeRequest.findFirst({
                where: {
                  employeeId: employee.id,
                  clientId: assignment.clientId,
                  date: today,
                  type: 'OFF_SHIFT',
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
                    requestedStartTime: fmtHHMM(activeSession.startTime),
                    requestedEndTime: scheduledStart ? fmtHHMM(scheduledStart) : undefined,
                    reason: 'Auto-generated — employee clocked in before scheduled shift',
                    status: 'PENDING',
                  },
                });
                console.log(`[OT-Auto] Created OFF_SHIFT (early clock-in) OvertimeRequest for employee ${employee.id}, client ${assignment.clientId}, ${earlyOvertimeMinutes} min`);
              }
            } catch (e) {
              console.error(`[OT-Auto] Failed to auto-create early OvertimeRequest:`, e);
            }
          }

          // Shift extension overtime (stayed late) or full extra time session (post-shift clock-in)
          // Only auto-create if OT is significant (> 7 min grace) and no existing request for this type
          const sessionOT = isExtraTime ? totalWorkMinutes : shiftExtensionMinutes;
          if (sessionOT > OT_GRACE_MINUTES) {
            try {
              const otType = isExtraTime ? 'OFF_SHIFT' : 'SHIFT_EXTENSION';
              // Check for existing OT request to avoid duplicates
              const existingOT = await prisma.overtimeRequest.findFirst({
                where: {
                  employeeId: employee.id,
                  clientId: assignment.clientId,
                  date: today,
                  type: otType,
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
                    reason: 'Auto-generated — employee worked overtime without prior request',
                    status: 'PENDING',
                    ...(otType === 'SHIFT_EXTENSION'
                      ? { estimatedEndTime: fmtHHMM(endTime) }
                      : {
                          requestedStartTime: fmtHHMM(activeSession.startTime),
                          requestedEndTime: fmtHHMM(endTime),
                        }),
                  },
                });
                console.log(`[OT-Auto] Created ${otType} OvertimeRequest for employee ${employee.id}, client ${assignment.clientId}, ${sessionOT} min`);
              } else {
                console.log(`[OT-Auto] Skipped — existing ${otType} OvertimeRequest found for employee ${employee.id}`);
              }
            } catch (e) {
              console.error(`[OT-Auto] Failed to auto-create OvertimeRequest:`, e);
            }
          }
          } // end else (otRequiresApproval)
        })
      );

      // --- Send OT notifications to client(s) if overtime was worked ---
      if (overtimeMinutes > 0 && otRequiresApproval) {
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
                '/client/approvals?type=overtime'
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

    // Update session status back to ACTIVE and accumulate break time
    await prisma.workSession.update({
      where: { id: activeSession.id },
      data: {
        status: 'ACTIVE',
        totalBreakMinutes: { increment: durationMinutes },
      },
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

    // Get today's schedule using client timezone
    const clientAsgn = await prisma.clientEmployee.findFirst({
      where: { employeeId: employee.id, isActive: true },
      include: { client: { select: { timezone: true } } },
    });
    const tz = clientAsgn?.client?.timezone || 'UTC';
    const todayNow = new Date();
    const { dayOfWeek } = getTimeInTimezone(tz, todayNow);

    const schedule = await prisma.schedule.findFirst({
      where: {
        employeeId: employee.id,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { lte: todayNow },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: todayNow } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
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
      // Exclude manual entries — they are shown in the Manual Time Card tab
      isManual: false,
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
            timezone: true,
          },
        },
      },
    });

    // Fetch time records for these sessions to get approval status
    // Use client timezone to derive the correct date (e.g., 1:00 AM IST Mar 13 = Mar 12 in UTC but Mar 13 in client tz)
    const sessionClientTz = clientAssignment?.client?.timezone || 'UTC';
    const toClientDate = (dt: Date): Date => {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: sessionClientTz }).formatToParts(dt);
        const y = parseInt(parts.find(p => p.type === 'year')?.value || '1970');
        const m = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
        const d = parseInt(parts.find(p => p.type === 'day')?.value || '1');
        return new Date(Date.UTC(y, m, d));
      } catch {
        const fallback = new Date(dt);
        fallback.setUTCHours(0, 0, 0, 0);
        return fallback;
      }
    };
    const sessionDates = sessions
      .filter(s => s.startTime)
      .map(s => toClientDate(s.startTime));

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
            totalMinutes: true,
            breakMinutes: true,
            overtimeMinutes: true,
            scheduledStart: true,
            scheduledEnd: true,
            actualStart: true,
            actualEnd: true,
            billingStart: true,
            billingEnd: true,
            billingMinutes: true,
            isLate: true,
            revisionReason: true,
            revisionRequestedBy: true,
            revisionRequestedAt: true,
            shiftExtensionStatus: true,
            shiftExtensionMinutes: true,
            shiftExtensionReason: true,
            extraTimeStatus: true,
            extraTimeMinutes: true,
          },
        })
      : [];

    // Build a lookup: date string -> time record
    const timeRecordMap = new Map<string, typeof timeRecords[0]>();
    for (const tr of timeRecords) {
      const dateKey = tr.date.toISOString().split('T')[0];
      timeRecordMap.set(dateKey, tr);
    }

    // Fetch OvertimeRequests using the same date range as the session query
    // This matches the approach used in admin/client endpoints which work correctly
    const otRangeFilter: any = {};
    if (startDate) {
      // Expand by 1 day before to handle timezone differences
      const otStart = new Date(startDate as string);
      otStart.setUTCDate(otStart.getUTCDate() - 1);
      otRangeFilter.gte = otStart;
    }
    if (endDate) {
      // Expand by 1 day after to handle timezone differences
      const otEnd = new Date(endDate as string);
      otEnd.setUTCDate(otEnd.getUTCDate() + 1);
      otRangeFilter.lte = otEnd;
    }
    const overtimeRequests = sessions.length > 0
      ? await prisma.overtimeRequest.findMany({
          where: {
            employeeId: employee.id,
            ...(Object.keys(otRangeFilter).length > 0 ? { date: otRangeFilter } : {}),
          },
          select: {
            id: true,
            date: true,
            type: true,
            requestedMinutes: true,
            requestedStartTime: true,
            requestedEndTime: true,
            estimatedEndTime: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Helper: get YYYY-MM-DD in the client's timezone for a given Date
    const getClientDateKey = (date: Date): string => {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: sessionClientTz }).formatToParts(date);
        const y = parts.find(p => p.type === 'year')?.value || '1970';
        const m = parts.find(p => p.type === 'month')?.value || '01';
        const d = parts.find(p => p.type === 'day')?.value || '01';
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } catch {
        return date.toISOString().split('T')[0];
      }
    };

    // Calculate work minutes for each session
    const sessionsWithStats = sessions.map(session => {
      // Match time record by date — use client timezone date for matching
      const sessionDateKey = getClientDateKey(session.startTime);
      const timeRecord = timeRecordMap.get(sessionDateKey);

      // Prefer TimeRecord data (authoritative) over session calculation
      const sessionTotalMinutes = session.endTime
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000)
        : 0;

      // Calculate break minutes from actual break records (more reliable than totalBreakMinutes for active sessions)
      const computedBreakMinutes = (session.breaks || []).reduce((total: number, brk: any) => {
        if (brk.endTime) {
          return total + (brk.durationMinutes || Math.round((new Date(brk.endTime).getTime() - new Date(brk.startTime).getTime()) / 60000));
        }
        // Ongoing break — count time so far
        return total + Math.round((Date.now() - new Date(brk.startTime).getTime()) / 60000);
      }, 0);

      const breakMinutes = computedBreakMinutes;
      const totalMinutes = sessionTotalMinutes - breakMinutes;

      // Match all OvertimeRequests for the same date to this session
      const matchedOTEntries = overtimeRequests.filter(ot => ot.date.toISOString().split('T')[0] === sessionDateKey);

      const sessionOvertimeMinutes = matchedOTEntries.length > 0
        ? matchedOTEntries.reduce((sum, ot) => sum + ot.requestedMinutes, 0)
        : 0;
      const workMinutes = totalMinutes - sessionOvertimeMinutes;

      return {
        ...session,
        totalMinutes,
        workMinutes,
        breakMinutes,
        overtimeMinutes: sessionOvertimeMinutes,
        scheduledStart: timeRecord?.scheduledStart || null,
        scheduledEnd: timeRecord?.scheduledEnd || null,
        billingStart: timeRecord?.billingStart || null,
        billingEnd: timeRecord?.billingEnd || null,
        billingMinutes: timeRecord?.billingMinutes || 0,
        isLate: timeRecord?.isLate || false,
        client: clientAssignment?.client || null,
        approvalStatus: timeRecord?.status || null,
        approvedAt: timeRecord?.approvedAt || null,
        timeRecordId: timeRecord?.id || null,
        revisionReason: timeRecord?.revisionReason || null,
        shiftExtensionStatus: timeRecord?.shiftExtensionStatus || 'NONE',
        shiftExtensionMinutes: timeRecord?.shiftExtensionMinutes || 0,
        shiftExtensionReason: timeRecord?.shiftExtensionReason || null,
        extraTimeStatus: timeRecord?.extraTimeStatus || 'NONE',
        extraTimeMinutes: timeRecord?.extraTimeMinutes || 0,
        overtimeEntries: matchedOTEntries.map(ot => ({
          id: ot.id,
          type: ot.type,
          requestedMinutes: ot.requestedMinutes,
          requestedStartTime: ot.requestedStartTime,
          requestedEndTime: ot.requestedEndTime,
          estimatedEndTime: ot.estimatedEndTime,
          status: ot.status,
        })),
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
      orderBy: { effectiveFrom: 'desc' },
    });

    // Calculate scheduled hours
    let scheduledMinutes = 0;
    if (schedule) {
      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      const [endHour, endMin] = schedule.endTime.split(':').map(Number);
      scheduledMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    }

    // Get actual overtime from OvertimeRequest entries today
    const todayOvertimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        requestedMinutes: true,
      },
    });

    const overtimeMinutes = todayOvertimeRequests.reduce(
      (sum, ot) => sum + (ot.requestedMinutes || 0),
      0
    );

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

    // Get actual overtime from OvertimeRequest entries this week
    const weeklyOvertimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
      select: {
        requestedMinutes: true,
      },
    });

    const overtimeMinutes = weeklyOvertimeRequests.reduce(
      (sum, ot) => sum + (ot.requestedMinutes || 0),
      0
    );

    res.json({
      success: true,
      summary: {
        totalWorkMinutes,
        totalBreakMinutes,
        scheduledWeeklyMinutes,
        overtimeMinutes,
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
        isManual: true,
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
        clientAssignments.map((assignment) => {
          // For manual entries, billing = actual (no schedule context)
          const manualBilling = computeBillingTimes(sessionStartTime, sessionEndTime, null, null);
          const manualBillingMins = Math.max(0, Math.floor((manualBilling.billingEnd.getTime() - manualBilling.billingStart.getTime()) / 60000));
          return prisma.timeRecord.upsert({
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
              billingStart: manualBilling.billingStart,
              billingEnd: manualBilling.billingEnd,
              billingMinutes: manualBillingMins,
              isLate: false,
              totalMinutes,
              breakMinutes: 0,
              status: 'PENDING',
            },
            update: {
              actualEnd: sessionEndTime,
              totalMinutes: { increment: totalMinutes },
            },
          });
        })
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

// Get manual time entries
export const getManualEntries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { startDate, endDate, page = '1', limit = '50' } = req.query;

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

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      const endDateObj = new Date(endDate as string);
      endDateObj.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = endDateObj;
    }

    const whereClause: any = {
      employeeId: employee.id,
      isManual: true,
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.startTime = dateFilter;
    }

    const [entries, total] = await Promise.all([
      prisma.workSession.findMany({
        where: whereClause,
        orderBy: { startTime: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.workSession.count({ where: whereClause }),
    ]);

    // Calculate work minutes for each entry
    const entriesWithStats = entries.map(entry => {
      const totalMinutes = entry.endTime
        ? Math.round((entry.endTime.getTime() - entry.startTime.getTime()) / 60000)
        : 0;
      return {
        ...entry,
        totalMinutes,
        workMinutes: totalMinutes,
      };
    });

    res.json({
      success: true,
      entries: entriesWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get manual entries error:', error);
    res.status(500).json({ success: false, message: 'Failed to get manual entries' });
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

/**
 * Handle employee's response to the controlled pause at shift end.
 * POST /api/work-sessions/shift-end-response
 * Body: { action: 'CONTINUE_WORKING' | 'STAY_CLOCKED_OUT', reason?: string }
 */
export const shiftEndResponse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { action, reason } = req.body;

    if (!['CONTINUE_WORKING', 'STAY_CLOCKED_OUT'].includes(action)) {
      res.status(400).json({ success: false, error: 'Invalid action. Must be CONTINUE_WORKING or STAY_CLOCKED_OUT' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Find the active session — either in controlled pause, or with approved OT (no pause)
    let session = await prisma.workSession.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
        shiftEndPausedAt: { not: null },
        shiftEndAction: null, // Not yet responded
      },
      orderBy: { startTime: 'desc' },
    });

    // If no paused session, check for an active session with approved OT (shift end job skips pause for these)
    let isApprovedOTSession = false;
    if (!session) {
      session = await prisma.workSession.findFirst({
        where: {
          employeeId: employee.id,
          status: { in: ['ACTIVE', 'ON_BREAK'] },
          shiftEndAction: null,
          shiftEndNotifiedAt: { not: null }, // Was notified about shift end
        },
        orderBy: { startTime: 'desc' },
      });
      if (session) {
        isApprovedOTSession = true;
      }
    }

    if (!session) {
      res.status(404).json({ success: false, error: 'No active shift-end pause found' });
      return;
    }

    if (action === 'CONTINUE_WORKING') {
      // Reason is required for unapproved OT continuation, but not for approved OT
      if (!isApprovedOTSession && (!reason || !reason.trim())) {
        res.status(400).json({ success: false, error: 'Reason is required when continuing to work' });
        return;
      }

      await prisma.workSession.update({
        where: { id: session.id },
        data: {
          shiftEndResumedAt: new Date(),
          shiftEndAction: 'CONTINUE_WORKING',
          notes: reason?.trim() || (isApprovedOTSession ? 'Using approved overtime' : ''),
        },
      });

      res.json({ success: true, message: 'Session resumed. Shift extension time will be tracked as unapproved overtime.' });
    } else {
      // STAY_CLOCKED_OUT — clock out at scheduled end time
      // Find the schedule to get the exact shift end time
      const now = new Date();
      const clientAssignment = await prisma.clientEmployee.findFirst({
        where: { employeeId: employee.id, isActive: true },
        include: { client: { select: { timezone: true } } },
      });

      let clockOutTime = session.shiftEndPausedAt || now; // Default to pause time

      if (clientAssignment?.client?.timezone) {
        const tz = clientAssignment.client.timezone;
        const dayOfWeek = parseInt(
          new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'narrow' })
            .formatToParts(now)
            .find((p) => p.type === 'weekday')?.value === 'S' ? '0' : '1', // simplified
          10
        );

        const schedule = await prisma.schedule.findFirst({
          where: { employeeId: employee.id, isActive: true, dayOfWeek },
        });

        if (schedule?.endTime) {
          clockOutTime = buildScheduleTimestamp(tz, schedule.endTime, now);
        }
      }

      // End the session at scheduled end time
      const totalMs = clockOutTime.getTime() - session.startTime.getTime();
      const totalBreakMs = session.totalBreakMinutes * 60000;
      const totalWorkMinutes = Math.max(0, Math.round((totalMs - totalBreakMs) / 60000));

      await prisma.workSession.update({
        where: { id: session.id },
        data: {
          endTime: clockOutTime,
          status: 'COMPLETED',
          shiftEndAction: 'STAY_CLOCKED_OUT',
        },
      });

      // Log the clock-out
      await prisma.sessionLog.create({
        data: {
          workSessionId: session.id,
          userId,
          action: 'CLOCK_OUT',
          message: 'Clocked out at shift end (employee chose to stay clocked out)',
        },
      });

      res.json({ success: true, message: 'Clocked out at scheduled shift end time.' });
    }
  } catch (error) {
    console.error('Shift end response error:', error);
    res.status(500).json({ success: false, error: 'Failed to process shift end response' });
  }
};
