import cron from 'node-cron';
import { runAutoApproval } from './autoApproval.job';
import { runMonthlyInvoiceGeneration, runWeeklyInvoiceGeneration, runBiWeeklyInvoiceGeneration } from './invoiceGeneration.job';
import { runShiftEndJob } from './shiftEnd.job';
import { runOTBillingReminder } from './otBillingReminder.job';
import { runAggressiveOTReminder } from './aggressiveOTReminder.job';
import { runPayrollDeadlineReminder } from './payrollDeadlineReminder.job';
import { runPayrollGeneration } from './payrollGeneration.job';
import { runExpiredOTRequestJob } from './expiredOTRequest.job';
import { runAttendanceAlertJob } from './attendanceAlert.job';
import { runLunchAutoCloseJob } from './lunchAutoClose.job';
import { runLunchBreakAlertJob } from './lunchBreakAlert.job';
import type { Server } from 'socket.io';

export const initializeJobs = (io: Server): void => {
  console.log('[Jobs] Initializing cron jobs...');

  // Guard flags to prevent overlapping runs
  let shiftEndRunning = false;
  let autoApprovalRunning = false;
  let attendanceAlertRunning = false;
  let lunchBreakAlertRunning = false;

  // Shift end: runs every minute to check for ending shifts and auto-clock-out
  cron.schedule('* * * * *', async () => {
    if (shiftEndRunning) return;
    shiftEndRunning = true;
    try { await runShiftEndJob(io); } finally { shiftEndRunning = false; }
  });
  console.log('[Jobs] Shift-end job scheduled (every minute)');

  // Attendance alert: runs every minute to check for missing clock-ins
  cron.schedule('* * * * *', async () => {
    if (attendanceAlertRunning) return;
    attendanceAlertRunning = true;
    try { await runAttendanceAlertJob(); } finally { attendanceAlertRunning = false; }
  });
  console.log('[Jobs] Attendance-alert job scheduled (every minute)');

  // Lunch break alert: runs every 5 minutes to check for employees past lunch break end by 10+ min
  cron.schedule('*/5 * * * *', async () => {
    if (lunchBreakAlertRunning) return;
    lunchBreakAlertRunning = true;
    try { await runLunchBreakAlertJob(); } finally { lunchBreakAlertRunning = false; }
  });
  console.log('[Jobs] Lunch-break alert job scheduled (every 5 minutes)');

  // Auto-approval: runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (autoApprovalRunning) return;
    autoApprovalRunning = true;
    try { await runAutoApproval(io); } finally { autoApprovalRunning = false; }
  });
  console.log('[Jobs] Auto-approval job scheduled (every 5 minutes)');

  // Monthly invoice generation: runs on the 3rd of every month at 12:05 AM EST (05:05 UTC)
  // Generates invoices for previous month (1st-end) for MONTHLY clients
  cron.schedule('5 5 3 * *', async () => {
    await runMonthlyInvoiceGeneration(io);
  });
  console.log('[Jobs] Monthly invoice generation scheduled (3rd of month, 12:05 AM EST)');

  // Weekly invoice generation: runs every Wednesday at 12:10 AM EST (05:10 UTC)
  // Generates invoices for previous week (Mon-Sun) for WEEKLY clients
  cron.schedule('10 5 * * 3', async () => {
    await runWeeklyInvoiceGeneration(io);
  });
  console.log('[Jobs] Weekly invoice generation scheduled (Wednesday, 12:10 AM EST)');

  // Bi-weekly invoice generation: runs on 3rd and 17th at 12:15 AM EST (05:15 UTC)
  // 17th: generates for 1st-15th period; 3rd: generates for 16th-end of prev month
  cron.schedule('15 5 3,17 * *', async () => {
    await runBiWeeklyInvoiceGeneration(io);
  });
  console.log('[Jobs] Bi-weekly invoice generation scheduled (3rd & 17th, 12:15 AM EST)');

  // OT billing cycle reminder: runs daily at 9:00 AM EST (14:00 UTC)
  // Notifies clients 3 days before billing cycle ends about unapproved OT
  cron.schedule('0 14 * * *', async () => {
    await runOTBillingReminder(io);
  });
  console.log('[Jobs] OT billing reminder scheduled (daily, 9:00 AM EST)');

  // Aggressive OT approval reminder: runs daily at 10:00 AM EST (15:00 UTC)
  // Sends urgent notifications to clients with any pending unapproved overtime
  cron.schedule('0 15 * * *', async () => {
    await runAggressiveOTReminder(io);
  });
  console.log('[Jobs] Aggressive OT reminder scheduled (daily, 10:00 AM EST)');

  // Payroll deadline reminder: runs daily at 9:30 AM EST (14:30 UTC)
  // Notifies clients 3 days and 1 day before PayrollPeriod.cutoffDate
  cron.schedule('30 14 * * *', async () => {
    await runPayrollDeadlineReminder(io);
  });
  console.log('[Jobs] Payroll deadline reminder scheduled (daily, 9:30 AM EST)');

  // Payroll auto-generation: runs on 7th and 21st at midnight EST (05:00 UTC)
  // 7th: creates period for 22nd(prev)-7th, 21st: creates period for 8th-21st
  cron.schedule('0 5 7,21 * *', async () => {
    await runPayrollGeneration(io);
  });
  console.log('[Jobs] Payroll auto-generation scheduled (7th & 21st, midnight EST)');

  // Expired OT request auto-rejection: runs daily at 01:00 UTC (9 PM EST previous day)
  // Rejects pre-requested OT that the client never approved and the date has passed
  cron.schedule('0 1 * * *', async () => {
    await runExpiredOTRequestJob(io);
  });
  console.log('[Jobs] Expired OT request auto-rejection scheduled (daily, 01:00 UTC)');

  // Lunch auto-close: runs daily at 02:00 UTC
  // Closes any lunch breaks still open from a previous day (employee never returned and never clocked out)
  cron.schedule('0 2 * * *', async () => {
    await runLunchAutoCloseJob();
  });
  console.log('[Jobs] Lunch auto-close job scheduled (daily, 02:00 UTC)');

  console.log('[Jobs] All cron jobs initialized');
};

export { generateInvoicesForPeriod, generateWeeklyInvoicesForWeek, generateBiWeeklyInvoicesForPeriod, previewBiWeeklyInvoicesForPeriod } from './invoiceGeneration.job';
export { runAutoApproval } from './autoApproval.job';
export { runShiftEndJob } from './shiftEnd.job';
export { runOTBillingReminder } from './otBillingReminder.job';
export { runAggressiveOTReminder } from './aggressiveOTReminder.job';
export { runPayrollDeadlineReminder } from './payrollDeadlineReminder.job';
export { runPayrollGeneration } from './payrollGeneration.job';
export { runExpiredOTRequestJob } from './expiredOTRequest.job';
