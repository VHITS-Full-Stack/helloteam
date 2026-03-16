import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import type { Server } from 'socket.io';

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
      const delayMinutes = policy.autoApproveMinutes ?? 1440; // Default 24 hours per spec
      if (delayMinutes <= 0) continue;
      const cutoffTime = new Date(now.getTime() - delayMinutes * 60 * 1000);

      // Find PENDING time records that:
      // 1. Employee has clocked in (actualStart exists)
      // 2. Were created before the cutoff time (delay has passed)
      // 3. Have no overtime (when OT requires approval) — OT is never auto-approved
      const pendingRecords = await prisma.timeRecord.findMany({
        where: {
          clientId: policy.clientId,
          status: 'PENDING',
          actualStart: { not: null },
          createdAt: { lte: cutoffTime },
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

      if (pendingRecords.length === 0) continue;

      // Batch update to AUTO_APPROVED
      const recordIds = pendingRecords.map((r) => r.id);
      const approvedAt = new Date();

      await prisma.timeRecord.updateMany({
        where: { id: { in: recordIds } },
        data: {
          status: 'AUTO_APPROVED',
          approvedAt,
        },
      });

      // Create auto-approval logs and notifications for each record
      for (const record of pendingRecords) {
        // Log the auto-approval
        try {
          await prisma.autoApprovalLog.create({
            data: {
              timeRecordId: record.id,
              employeeId: record.employeeId,
              clientId: policy.clientId,
              recordDate: record.date,
              scheduledEnd: '',
              approvalDelay: delayMinutes,
              approvedAt,
              actualStart: record.actualStart,
              actualEnd: record.actualEnd,
              totalMinutes: record.totalMinutes || 0,
              clientTimezone: policy.client.timezone || 'UTC',
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
        `[Auto-Approval] Auto-approved ${pendingRecords.length} records for client ${policy.client.companyName}`
      );
    }
  } catch (error) {
    console.error('[Auto-Approval] Job failed:', error);
  }
};
