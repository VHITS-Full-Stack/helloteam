import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import type { Server } from 'socket.io';

/**
 * Convert a date + HH:MM time string in a given timezone to a UTC Date object.
 * e.g., date=2026-02-16, time="17:00", timezone="America/New_York" → UTC Date for 5 PM ET
 */
const toUTCDate = (date: Date, timeStr: string, timezone: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

  // Parse as UTC (Z suffix) so the offset calculation works regardless of server timezone
  const naiveUTC = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);

  try {
    // Get the timezone offset by comparing formatted times
    const utcStr = naiveUTC.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = naiveUTC.toLocaleString('en-US', { timeZone: timezone });
    const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
    return new Date(naiveUTC.getTime() + offsetMs);
  } catch {
    // If timezone is invalid, treat as UTC
    return naiveUTC;
  }
};

interface ApprovalCandidate {
  record: any;
  scheduledEndTime: string; // HH:MM that was matched
}

export const runAutoApproval = async (io?: Server): Promise<void> => {
  try {
    // Get all clients with auto-approve enabled
    const policies = await prisma.clientPolicy.findMany({
      where: { autoApproveTimesheets: true },
      select: {
        clientId: true,
        autoApproveMinutes: true,
        client: {
          select: {
            id: true,
            companyName: true,
            userId: true,
            timezone: true,
          },
        },
      },
    });

    if (policies.length === 0) return;

    const now = new Date();

    for (const policy of policies) {
      const delayMinutes = policy.autoApproveMinutes ?? 15;
      if (delayMinutes <= 0) continue;
      const delayMs = delayMinutes * 60 * 1000;
      const clientTimezone = policy.client.timezone || 'UTC';

      // Find PENDING time records where employee has clocked in
      // Exclude overtime records — they are never auto-approved (follow OT approval flow)
      const pendingRecords = await prisma.timeRecord.findMany({
        where: {
          clientId: policy.clientId,
          status: 'PENDING',
          actualStart: { not: null },
          overtimeMinutes: 0,
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (pendingRecords.length === 0) continue;

      // Collect unique employee IDs to batch-fetch schedules
      const employeeIds = [...new Set(pendingRecords.map((r) => r.employeeId))];

      // Fetch all active schedules for these employees
      const schedules = await prisma.schedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          isActive: true,
        },
        select: {
          employeeId: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });

      // Build a lookup: employeeId -> schedules
      const scheduleMap = new Map<string, typeof schedules>();
      for (const schedule of schedules) {
        const existing = scheduleMap.get(schedule.employeeId) || [];
        existing.push(schedule);
        scheduleMap.set(schedule.employeeId, existing);
      }

      const toApprove: ApprovalCandidate[] = [];

      for (const record of pendingRecords) {
        if (!record.actualStart) continue;

        // Use UTC day to avoid timezone-induced off-by-one errors
        const recordDate = record.date;
        const dayOfWeek = recordDate.getUTCDay(); // 0-6

        // Find matching schedule for this employee on this day
        const employeeSchedules = scheduleMap.get(record.employeeId) || [];
        const matchingSchedule = employeeSchedules.find(
          (s) =>
            s.dayOfWeek === dayOfWeek &&
            s.effectiveFrom <= recordDate &&
            (s.effectiveTo === null || s.effectiveTo >= recordDate)
        );

        // Must have a schedule (from Schedule model or on the time record itself)
        if (!matchingSchedule && !record.scheduledEnd) continue;

        // Determine the scheduled end time for this day
        let scheduledEndDateTime: Date | null = null;
        let scheduledEndTimeStr = '';

        if (matchingSchedule) {
          // Validate endTime format (HH:MM)
          if (!matchingSchedule.endTime || !/^\d{1,2}:\d{2}$/.test(matchingSchedule.endTime)) {
            console.warn(`[Auto-Approval] Invalid endTime format for employee ${record.employeeId}: "${matchingSchedule.endTime}"`);
            continue;
          }
          scheduledEndTimeStr = matchingSchedule.endTime;
          scheduledEndDateTime = toUTCDate(recordDate, matchingSchedule.endTime, clientTimezone);
        } else if (record.scheduledEnd) {
          scheduledEndDateTime = record.scheduledEnd;
          scheduledEndTimeStr = `${String(record.scheduledEnd.getUTCHours()).padStart(2, '0')}:${String(record.scheduledEnd.getUTCMinutes()).padStart(2, '0')}`;
        }

        if (!scheduledEndDateTime) continue;

        // Auto-approve after scheduledEnd + autoApproveMinutes
        const approvalTime = new Date(scheduledEndDateTime.getTime() + delayMs);
        if (now < approvalTime) continue;

        toApprove.push({ record, scheduledEndTime: scheduledEndTimeStr });
      }

      if (toApprove.length === 0) continue;

      // Batch update to AUTO_APPROVED
      const recordIds = toApprove.map((c) => c.record.id);
      const approvedAt = new Date();

      await prisma.timeRecord.updateMany({
        where: { id: { in: recordIds } },
        data: {
          status: 'AUTO_APPROVED',
          approvedAt,
        },
      });

      // Create auto-approval logs and notifications for each record
      for (const { record, scheduledEndTime } of toApprove) {
        // Log the auto-approval in the database
        try {
          await prisma.autoApprovalLog.create({
            data: {
              timeRecordId: record.id,
              employeeId: record.employeeId,
              clientId: policy.clientId,
              recordDate: record.date,
              scheduledEnd: scheduledEndTime,
              approvalDelay: delayMinutes,
              approvedAt,
              actualStart: record.actualStart,
              actualEnd: record.actualEnd,
              totalMinutes: record.totalMinutes || 0,
              clientTimezone,
            },
          });
        } catch (logError) {
          console.error(`[Auto-Approval] Failed to create log for record ${record.id}:`, logError);
        }

        // Send notification
        try {
          const dateStr = record.date.toISOString().split('T')[0];
          const hours = Math.round(((record.totalMinutes || 0) / 60) * 10) / 10;

          await createNotification(
            record.employee.userId,
            'TIMESHEET_AUTO_APPROVED',
            'Timesheet Auto-Approved',
            `Your time entry for ${dateStr} (${hours}h) for ${policy.client.companyName} was automatically approved.`,
            {
              timeRecordId: record.id,
              clientId: policy.clientId,
              date: dateStr,
              hours,
            },
            '/employee/time-records'
          );

          // Emit socket event for real-time UI update
          if (io) {
            io.emit(`notification:${record.employee.userId}`, {
              type: 'TIMESHEET_AUTO_APPROVED',
              message: `Time entry for ${dateStr} auto-approved`,
            });
          }
        } catch (notifError) {
          console.error(`[Auto-Approval] Failed to send notification for record ${record.id}:`, notifError);
        }
      }

      console.log(
        `[Auto-Approval] Auto-approved ${toApprove.length} records for client ${policy.client.companyName}`
      );
    }
  } catch (error) {
    console.error('[Auto-Approval] Job failed:', error);
  }
};
