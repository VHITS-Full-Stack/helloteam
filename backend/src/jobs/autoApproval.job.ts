import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import type { Server } from 'socket.io';
import { buildTimestampFromDate } from '../utils/timezone';

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
        overtimeRequiresApproval: true,
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
      // When OT requires approval, exclude overtime records (they follow OT approval flow)
      // When OT does NOT require approval, include all records (all hours are regular)
      const pendingRecords = await prisma.timeRecord.findMany({
        where: {
          clientId: policy.clientId,
          status: 'PENDING',
          actualStart: { not: null },
          ...(policy.overtimeRequiresApproval !== false ? { overtimeMinutes: 0 } : {}),
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

      // Debug: also fetch ALL pending records without OT filter to see what's being excluded
      const allPendingRecords = await prisma.timeRecord.findMany({
        where: {
          clientId: policy.clientId,
          status: 'PENDING',
          actualStart: { not: null },
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      console.log(`[Auto-Approval] Found ${pendingRecords.length} pending records (with OT filter) and ${allPendingRecords.length} total pending records for client ${policy.client.companyName}`);
      for (const r of allPendingRecords) {
        console.log(`[Auto-Approval]   - ${r.employee.firstName} ${r.employee.lastName}, date=${r.date.toISOString()}, status=${r.status}, overtimeMinutes=${r.overtimeMinutes}, actualStart=${r.actualStart?.toISOString()}, actualEnd=${r.actualEnd?.toISOString()}`);
      }

      if (pendingRecords.length === 0 && allPendingRecords.length === 0) continue;
      if (pendingRecords.length === 0) {
        console.log(`[Auto-Approval] All pending records have overtimeMinutes > 0, skipping`);
        continue;
      }

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
        // Use end-of-day for effectiveFrom comparison to handle schedules created today
        // (effectiveFrom stores full timestamp, recordDate is midnight UTC)
        const endOfRecordDate = new Date(recordDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        const employeeSchedules = scheduleMap.get(record.employeeId) || [];
        const matchingSchedule = employeeSchedules.find(
          (s) =>
            s.dayOfWeek === dayOfWeek &&
            s.effectiveFrom <= endOfRecordDate &&
            (s.effectiveTo === null || s.effectiveTo >= recordDate)
        );

        console.log(`[Auto-Approval] Processing ${record.employee.firstName} ${record.employee.lastName}: recordDate=${recordDate.toISOString()}, dayOfWeek=${dayOfWeek}, employeeSchedules=${employeeSchedules.length}, matchingSchedule=${!!matchingSchedule}, scheduledEnd=${record.scheduledEnd?.toISOString()}`);

        // Must have a schedule (from Schedule model or on the time record itself)
        if (!matchingSchedule && !record.scheduledEnd) {
          console.log(`[Auto-Approval] SKIPPED ${record.employee.firstName} ${record.employee.lastName}: no matching schedule and no scheduledEnd`);
          continue;
        }

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
          scheduledEndDateTime = buildTimestampFromDate(recordDate, matchingSchedule.endTime, clientTimezone);
        } else if (record.scheduledEnd) {
          scheduledEndDateTime = record.scheduledEnd;
          scheduledEndTimeStr = `${String(record.scheduledEnd.getUTCHours()).padStart(2, '0')}:${String(record.scheduledEnd.getUTCMinutes()).padStart(2, '0')}`;
        }

        if (!scheduledEndDateTime) {
          console.log(`[Auto-Approval] SKIPPED ${record.employee.firstName} ${record.employee.lastName}: scheduledEndDateTime is null`);
          continue;
        }

        // Auto-approve after scheduledEnd + autoApproveMinutes
        const approvalTime = new Date(scheduledEndDateTime.getTime() + delayMs);
        console.log(`[Auto-Approval] ${record.employee.firstName} ${record.employee.lastName}: scheduledEnd=${scheduledEndDateTime.toISOString()}, approvalTime=${approvalTime.toISOString()}, now=${now.toISOString()}, ready=${now >= approvalTime}`);
        if (now < approvalTime) {
          console.log(`[Auto-Approval] SKIPPED ${record.employee.firstName} ${record.employee.lastName}: not yet time (${Math.round((approvalTime.getTime() - now.getTime()) / 60000)} min remaining)`);
          continue;
        }

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
          const hours = Math.round(((record.totalMinutes || 0) / 60) * 100) / 100;

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
