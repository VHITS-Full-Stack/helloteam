import prisma from '../config/database';
import { notifyPayrollDeadline } from '../controllers/notification.controller';
import { sendPayrollReminderEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import type { Server } from 'socket.io';

/**
 * Payroll Deadline Reminder Job — runs once daily.
 *
 * Checks all OPEN PayrollPeriod records and sends reminders:
 *  - 3 days before cutoffDate → warning reminder
 *  - 1 day before cutoffDate → FINAL reminder about payment processing
 */
export const runPayrollDeadlineReminder = async (io?: Server): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find all OPEN payroll periods with cutoff in the next 4 days (covers both 3-day and 1-day windows)
    const cutoffThreshold = new Date(todayStart);
    cutoffThreshold.setDate(cutoffThreshold.getDate() + 4);

    const upcomingPeriods = await prisma.payrollPeriod.findMany({
      where: {
        status: 'OPEN',
        cutoffDate: {
          gte: todayStart,
          lt: cutoffThreshold,
        },
      },
    });

    if (upcomingPeriods.length === 0) return;

    for (const period of upcomingPeriods) {
      const cutoff = new Date(period.cutoffDate);
      const daysUntilCutoff = Math.ceil(
        (cutoff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only notify at 3 days and 1 day before cutoff
      if (daysUntilCutoff !== 3 && daysUntilCutoff !== 1) continue;

      // Get client info
      const client = await prisma.client.findUnique({
        where: { id: period.clientId },
        select: {
          id: true,
          userId: true,
          companyName: true,
          contactPerson: true,
          phone: true,
          user: { select: { id: true, email: true } },
        },
      });

      if (!client) continue;

      // Count pending OT time records in this payroll period
      const pendingOT = await prisma.timeRecord.findMany({
        where: {
          clientId: client.id,
          date: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
          status: 'PENDING',
          overtimeMinutes: { gt: 0 },
        },
        select: { overtimeMinutes: true },
      });

      // Also count all pending time records (not just OT)
      const pendingCount = await prisma.timeRecord.count({
        where: {
          clientId: client.id,
          date: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
          status: 'PENDING',
        },
      });

      if (pendingCount === 0 && pendingOT.length === 0) continue;

      const isFinal = daysUntilCutoff === 1;
      const cutoffDateStr = cutoff.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const clientName = client.contactPerson || client.companyName;

      console.log(
        `[Payroll-Deadline] ${isFinal ? 'FINAL: ' : ''}Client "${client.companyName}" — cutoff ${cutoffDateStr}, ${pendingCount} pending entries, ${pendingOT.length} pending OT`
      );

      // 1. In-app notification (reuse existing helper)
      try {
        await notifyPayrollDeadline(client.userId, daysUntilCutoff, pendingCount);
      } catch (e) {
        console.error('[Payroll-Deadline] In-app notification failed:', e);
      }

      // 2. Email (reuse existing helper)
      try {
        await sendPayrollReminderEmail(
          client.user.email,
          clientName,
          daysUntilCutoff,
          pendingCount,
          cutoffDateStr
        );
      } catch (e) {
        console.error('[Payroll-Deadline] Email failed:', e);
      }

      // 3. SMS
      if (client.phone) {
        try {
          const urgencyPrefix = isFinal ? 'FINAL REMINDER: ' : '';
          const otInfo = pendingOT.length > 0
            ? ` (${pendingOT.length} unapproved OT)`
            : '';
          await sendSMS(
            client.phone,
            `${urgencyPrefix}Payroll cutoff is ${isFinal ? 'tomorrow' : `in ${daysUntilCutoff} days`} (${cutoffDateStr}). ${pendingCount} pending time entries${otInfo}. Employees cannot be paid until approved. Log in to review.`
          );
        } catch (e) {
          console.error('[Payroll-Deadline] SMS failed:', e);
        }
      }

      // 4. Real-time socket
      if (io) {
        io.emit(`notification:${client.userId}`, {
          type: 'PAYROLL_REMINDER',
          message: `${isFinal ? 'FINAL: ' : ''}Payroll cutoff ${isFinal ? 'tomorrow' : `in ${daysUntilCutoff} days`}. ${pendingCount} entries pending.`,
        });
      }
    }
  } catch (error) {
    console.error('[Payroll-Deadline] Reminder job failed:', error);
  }
};
