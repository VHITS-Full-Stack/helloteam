import prisma from '../config/database';
import emailService from '../services/email.service';
import { getDayOfWeekInTimezone, buildScheduleTimestamp } from '../utils/timezone';

/**
 * Attendance Alert Job — runs every minute.
 * 
 * If an employee is late by more than 15 minutes and hasn't clocked in,
 * sends an email to the internal attendance team (Super Admins).
 */
export const runAttendanceAlertJob = async (): Promise<void> => {
  try {
    const now = new Date();
    const alertThresholdMinutes = 15;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Get all active employees with their schedules and today's sessions
    const employees = await prisma.employee.findMany({
      include: {
        clientAssignments: {
          where: { isActive: true },
          include: { client: { select: { id: true, companyName: true, timezone: true } } }
        },
        schedules: { 
          where: { 
            isActive: true,
            effectiveFrom: { lte: now },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: now } }
            ]
          } 
        },
        workSessions: {
          where: {
            startTime: { gte: todayStart },
          }
        }
      }
    });

    // Find internal team email (Super Admins)
    const adminUsers = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
      select: { email: true }
    });
    const adminEmails = Array.from(new Set(adminUsers.map(u => u.email).filter(e => !!e)));

    if (adminEmails.length === 0) return;

    for (const emp of employees) {
      if (emp.clientAssignments.length === 0) continue;
      const assignment = emp.clientAssignments[0];
      const timezone = assignment.client.timezone || 'UTC';
      
      const dayOfWeek = getDayOfWeekInTimezone(timezone, now);
      const schedule = emp.schedules.find(s => s.dayOfWeek === dayOfWeek);
      if (!schedule) continue;

      const shiftStartUTC = buildScheduleTimestamp(timezone, schedule.startTime, now);
      const shiftEndUTC = buildScheduleTimestamp(timezone, schedule.endTime, now);

      // Check if current time is within the shift and past the alert threshold
      if (now > shiftStartUTC && now < shiftEndUTC) {
        const overdueMinutes = Math.floor((now.getTime() - shiftStartUTC.getTime()) / 60000);
        
        if (overdueMinutes >= alertThresholdMinutes) {
          // Check if they clocked in for this shift
          const hasClockedIn = emp.workSessions.some(s => {
            const sessionStart = new Date(s.startTime);
            const fourHoursBefore = new Date(shiftStartUTC.getTime() - 4 * 60 * 60 * 1000);
            return sessionStart >= fourHoursBefore && sessionStart < shiftEndUTC;
          });

          if (!hasClockedIn) {
            // Check if alert already sent today for this employee's shift
            const existingAlert = await prisma.notification.findFirst({
              where: {
                userId: emp.userId,
                type: 'ATTENDANCE_ALERT' as any,
                createdAt: { gte: todayStart }
              }
            });

            if (!existingAlert) {
              const shiftTime = `${schedule.startTime} - ${schedule.endTime}`;
              const employeeName = `${emp.firstName} ${emp.lastName}`;
              const clientName = assignment.client.companyName;

              console.log(`[Attendance-Alert] Employee ${employeeName} is ${overdueMinutes}m overdue. Sending alerts...`);
              
              // Send emails
              for (const email of adminEmails) {
                try {
                  await emailService.sendAttendanceAlertEmail(
                    email,
                    employeeName,
                    clientName,
                    shiftTime,
                    overdueMinutes
                  );
                } catch (err) {
                  console.error(`[Attendance-Alert] Failed to send email to ${email}:`, err);
                }
              }

              // Record that the alert was sent to prevent duplicate emails for this shift
              await prisma.notification.create({
                data: {
                  userId: emp.userId,
                  type: 'ATTENDANCE_ALERT' as any,
                  title: 'Attendance Alert Sent',
                  message: `Attendance alert sent to admin for missing shift ${shiftTime} (${overdueMinutes}m late)`,
                  isRead: true
                }
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Attendance-Alert] Job failed:', error);
  }
};
