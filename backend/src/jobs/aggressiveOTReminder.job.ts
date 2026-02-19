import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import { sendAggressiveOTReminderEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import type { Server } from 'socket.io';

/**
 * Aggressive OT Approval Reminder Job — runs daily.
 *
 * For every client with pending unapproved overtime entries:
 *   1. In-app notification (urgent)
 *   2. Email with urgent tone
 *   3. SMS with urgent tone
 *   4. Real-time socket push
 *
 * Continues daily until all overtime is resolved.
 */
export const runAggressiveOTReminder = async (io?: Server): Promise<void> => {
  try {
    // Find all clients with completed onboarding
    const clients = await prisma.client.findMany({
      where: {
        onboardingStatus: 'COMPLETED',
      },
      select: {
        id: true,
        userId: true,
        companyName: true,
        contactPerson: true,
        phone: true,
        user: { select: { email: true } },
      },
    });

    for (const client of clients) {
      // Get all unapproved overtime entries for this client
      const unapprovedOT = await prisma.timeRecord.findMany({
        where: {
          clientId: client.id,
          overtimeMinutes: { gt: 0 },
          status: 'PENDING',
        },
        select: {
          overtimeMinutes: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      if (unapprovedOT.length === 0) continue;

      const totalOTMinutes = unapprovedOT.reduce((sum, r) => sum + r.overtimeMinutes, 0);
      const otHrs = Math.floor(totalOTMinutes / 60);
      const otMins = totalOTMinutes % 60;
      const unapprovedHours = otMins > 0 ? `${otHrs}h ${otMins}m` : `${otHrs}h`;

      // Collect unique employee names
      const employeeNames = [...new Set(
        unapprovedOT.map(r => `${r.employee.firstName} ${r.employee.lastName}`)
      )];

      const clientName = client.contactPerson || client.companyName;
      const count = unapprovedOT.length;

      console.log(
        `[Aggressive-OT] Client "${client.companyName}" has ${count} unapproved OT entries (${unapprovedHours}) — sending reminders`
      );

      // 1. In-app notification
      try {
        await createNotification(
          client.userId,
          'APPROVAL_REQUIRED',
          'URGENT: Unapproved Overtime',
          `You have ${count} unapproved overtime entr${count === 1 ? 'y' : 'ies'} (${unapprovedHours}). We cannot pay your employee${count === 1 ? '' : 's'} for these hours until you approve or deny. Please take action now.`,
          { unapprovedCount: count, unapprovedHours, employeeNames, urgency: 'HIGH' },
          '/client/time-records'
        );
      } catch (e) {
        console.error('[Aggressive-OT] In-app notification failed:', e);
      }

      // 2. Email
      try {
        await sendAggressiveOTReminderEmail(
          client.user.email,
          clientName,
          count,
          unapprovedHours,
          employeeNames
        );
      } catch (e) {
        console.error('[Aggressive-OT] Email failed:', e);
      }

      // 3. SMS
      if (client.phone) {
        try {
          await sendSMS(
            client.phone,
            `URGENT: You have ${count} unapproved overtime entries (${unapprovedHours}). We cannot pay your employees until you approve or deny. Log in now to take action.`,
            'aggressive-ot-reminder'
          );
        } catch (e) {
          console.error('[Aggressive-OT] SMS failed:', e);
        }
      }

      // 4. Real-time socket
      if (io) {
        io.emit(`notification:${client.userId}`, {
          type: 'APPROVAL_REQUIRED',
          message: `URGENT: ${count} unapproved overtime entries (${unapprovedHours}). Employees cannot be paid until resolved.`,
          urgency: 'HIGH',
        });
      }
    }
  } catch (error) {
    console.error('[Aggressive-OT] Reminder job failed:', error);
  }
};
