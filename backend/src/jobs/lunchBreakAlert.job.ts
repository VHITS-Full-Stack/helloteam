import prisma from '../config/database';
import emailService from '../services/email.service';

/**
 * Lunch Break Alert Job — runs every 5 minutes.
 * 
 * Detects employees currently on lunch break past their scheduled end by 10+ minutes,
 * and sends email alerts to configured admin recipients from the Email Notification Settings.
 * 
 * Uses a LastNotified tracking table to prevent duplicate alerts within the same hour.
 */
export const runLunchBreakAlertJob = async (): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Get email notification settings for lunch_break_10min_past
    const settings = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'email-notifications', key: 'notifications' } },
    });

    if (!settings) {
      console.log('[LunchBreakAlert] No email notification settings found');
      return;
    }

    let notificationConfig: any;
    try {
      const parsed = JSON.parse(settings.value);
      notificationConfig = parsed?.lunch_break_10min_past;
    } catch (e) {
      console.error('[LunchBreakAlert] Failed to parse notification settings:', e);
      return;
    }

    if (!notificationConfig?.enabled || !notificationConfig?.emails || notificationConfig.emails.length === 0) {
      console.log('[LunchBreakAlert] Lunch break alert notifications not enabled or no recipients configured');
      return;
    }

    // Get all work sessions currently ON_BREAK with active lunch breaks
    const onBreakSessions = await prisma.workSession.findMany({
      where: {
        status: 'ON_BREAK',
        startTime: { gte: todayStart },
      },
      include: {
        breaks: {
          where: { endTime: null, isLunch: true },
          orderBy: { startTime: 'desc' },
          take: 1,
        },
        employee: {
          include: {
            user: { select: { email: true } },
            clientAssignments: {
              where: { isActive: true },
              include: { client: { select: { id: true, companyName: true } } },
              take: 1,
            },
          },
        },
      },
    });

    if (onBreakSessions.length === 0) {
      return;
    }

    const alertsToSend: Array<{
      employeeId: string;
      employeeName: string;
      employeeEmail: string;
      clientName: string;
      minutesPast: number;
      scheduledEndTime: Date;
    }> = [];

    // Find employees 10+ minutes past their scheduled lunch end
    for (const session of onBreakSessions) {
      if (session.breaks.length === 0) continue;

      const activeBreak = session.breaks[0];
      const scheduledDuration = (activeBreak as any).scheduledDurationMinutes ?? 30;
      const scheduledLunchEnd = new Date(activeBreak.startTime.getTime() + scheduledDuration * 60000);
      const minutesPast = Math.floor((now.getTime() - scheduledLunchEnd.getTime()) / 60000);

      // Only alert if 10+ minutes past
      if (minutesPast < 10) continue;

      const emp = session.employee;
      if (!emp || !emp.user?.email || emp.clientAssignments.length === 0) continue;

      // Check if we've already sent an alert for this employee in the last 30 minutes
      const lastAlert = await prisma.lunchBreakAlert.findFirst({
        where: {
          employeeId: emp.id,
          createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
        },
      });

      if (lastAlert) {
        continue; // Already sent recently, skip
      }

      alertsToSend.push({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeEmail: emp.user.email,
        clientName: emp.clientAssignments[0].client.companyName,
        minutesPast,
        scheduledEndTime: scheduledLunchEnd,
      });
    }

    if (alertsToSend.length === 0) {
      return;
    }

    console.log(`[LunchBreakAlert] Found ${alertsToSend.length} employee(s) past lunch break end. Sending alerts to ${notificationConfig.emails.length} recipient(s)...`);

    // Send emails to all configured recipients
    const recipientEmails = notificationConfig.emails as string[];
    for (const alert of alertsToSend) {
      for (const recipientEmail of recipientEmails) {
        try {
          await emailService.sendLunchBreakAlertEmail(
            recipientEmail,
            alert.employeeName,
            alert.employeeEmail,
            alert.clientName,
            alert.minutesPast,
            alert.scheduledEndTime,
          );
        } catch (err) {
          console.error(`[LunchBreakAlert] Failed to send email to ${recipientEmail}:`, err);
        }
      }

      // Record that we sent an alert for this employee
      try {
        await prisma.lunchBreakAlert.create({
          data: {
            employeeId: alert.employeeId,
            minutesPast: alert.minutesPast,
          },
        });
      } catch (err) {
        console.error('[LunchBreakAlert] Failed to record alert:', err);
      }
    }
  } catch (error) {
    console.error('[LunchBreakAlert] Job failed:', error);
  }
};
