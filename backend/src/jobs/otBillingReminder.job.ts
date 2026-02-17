import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import { sendOTBillingReminderEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import type { Server } from 'socket.io';

/**
 * Calculate the number of days until the current billing cycle ends
 * based on the client's agreement type.
 *
 *  - WEEKLY:    cycle ends every Sunday
 *  - BI_WEEKLY: cycle ends every other Sunday (uses first Sunday of year as anchor)
 *  - MONTHLY:   cycle ends on last day of month
 */
function daysUntilBillingCycleEnd(agreementType: string, now: Date): number {
  const dayOfWeek = now.getDay(); // 0 = Sunday

  switch (agreementType) {
    case 'WEEKLY': {
      // Cycle ends on Sunday; if today is Sunday, cycle ends today (0 days)
      return dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    }

    case 'BI_WEEKLY': {
      // Anchor: first Sunday of the year → 2-week cycles
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const firstSunday = new Date(startOfYear);
      firstSunday.setDate(startOfYear.getDate() + ((7 - startOfYear.getDay()) % 7));

      const diffDays = Math.floor(
        (now.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dayInCycle = ((diffDays % 14) + 14) % 14; // always 0..13
      return 13 - dayInCycle;
    }

    case 'MONTHLY': {
      // Cycle ends on last day of current month
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return lastDay - now.getDate();
    }

    default:
      return -1; // unknown type — skip
  }
}

/**
 * Send OT billing reminder notifications to a client (in-app, email, SMS).
 */
async function sendReminderNotifications(
  client: {
    userId: string;
    companyName: string;
    contactPerson: string | null;
    phone: string | null;
    user: { email: string };
  },
  daysLeft: number,
  unapprovedCount: number,
  unapprovedHours: string,
  isFinal: boolean,
  io?: Server
): Promise<void> {
  const clientName = client.contactPerson || client.companyName;
  const urgencyPrefix = isFinal ? 'FINAL REMINDER: ' : '';
  const dayLabel = daysLeft === 1 ? '1 day' : `${daysLeft} days`;

  // 1. In-app notification
  try {
    await createNotification(
      client.userId,
      'PAYROLL_REMINDER',
      isFinal ? 'Final OT Approval Reminder' : 'Unapproved Overtime Hours',
      `${urgencyPrefix}You have ${unapprovedCount} unapproved overtime entr${unapprovedCount === 1 ? 'y' : 'ies'} (${unapprovedHours}). Unapproved hours won't appear on this cycle's invoice. Billing cycle ends in ${dayLabel}.`,
      { unapprovedCount, unapprovedHours, daysLeft, isFinal },
      '/client/approvals?tab=overtime'
    );
  } catch (e) {
    console.error('[OT-Billing] In-app notification failed:', e);
  }

  // 2. Email
  try {
    await sendOTBillingReminderEmail(
      client.user.email,
      clientName,
      daysLeft,
      unapprovedCount,
      unapprovedHours
    );
  } catch (e) {
    console.error('[OT-Billing] Email failed:', e);
  }

  // 3. SMS
  if (client.phone) {
    try {
      await sendSMS(
        client.phone,
        `${urgencyPrefix}Hello Team: ${unapprovedCount} unapproved OT entries (${unapprovedHours}). Unapproved hours won't appear on invoice. Billing cycle ends in ${dayLabel}. Log in to review.`
      );
    } catch (e) {
      console.error('[OT-Billing] SMS failed:', e);
    }
  }

  // Real-time socket
  if (io) {
    io.emit(`notification:${client.userId}`, {
      type: 'PAYROLL_REMINDER',
      message: `${urgencyPrefix}Unapproved OT won't appear on invoice. Billing cycle ends in ${dayLabel}.`,
    });
  }
}

/**
 * OT Billing Reminder Job — runs once daily.
 *
 * - 3 days before billing cycle ends → reminder: "Unapproved hours won't appear on invoice."
 * - 1 day before billing cycle ends → FINAL reminder with payment deadline
 */
export const runOTBillingReminder = async (io?: Server): Promise<void> => {
  try {
    const now = new Date();

    // Find all clients with an agreement type
    const clients = await prisma.client.findMany({
      where: {
        agreementType: { not: null },
        onboardingStatus: 'COMPLETED',
      },
      select: {
        id: true,
        userId: true,
        companyName: true,
        contactPerson: true,
        phone: true,
        agreementType: true,
        user: { select: { email: true } },
      },
    });

    for (const client of clients) {
      if (!client.agreementType) continue;

      const daysLeft = daysUntilBillingCycleEnd(client.agreementType, now);

      // Notify at 3 days (warning) and 1 day (final) before cycle end
      if (daysLeft !== 3 && daysLeft !== 1) continue;

      // Count unapproved overtime entries for this client
      const unapprovedOT = await prisma.timeRecord.findMany({
        where: {
          clientId: client.id,
          overtimeMinutes: { gt: 0 },
          status: 'PENDING',
        },
        select: {
          overtimeMinutes: true,
        },
      });

      if (unapprovedOT.length === 0) continue;

      const totalOTMinutes = unapprovedOT.reduce((sum, r) => sum + r.overtimeMinutes, 0);
      const otHrs = Math.floor(totalOTMinutes / 60);
      const otMins = totalOTMinutes % 60;
      const unapprovedHours = otMins > 0 ? `${otHrs}h ${otMins}m` : `${otHrs}h`;
      const isFinal = daysLeft === 1;

      console.log(
        `[OT-Billing] ${isFinal ? 'FINAL: ' : ''}Client "${client.companyName}" has ${unapprovedOT.length} unapproved OT entries (${unapprovedHours}), billing cycle ends in ${daysLeft} day(s)`
      );

      await sendReminderNotifications(client, daysLeft, unapprovedOT.length, unapprovedHours, isFinal, io);
    }
  } catch (error) {
    console.error('[OT-Billing] Reminder job failed:', error);
  }
};
