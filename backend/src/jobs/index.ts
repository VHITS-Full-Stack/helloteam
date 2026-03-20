import cron from 'node-cron';
import { runAutoApproval } from './autoApproval.job';
import { runMonthlyInvoiceGeneration, runWeeklyInvoiceGeneration } from './invoiceGeneration.job';
import { runShiftEndJob } from './shiftEnd.job';
import { runOTBillingReminder } from './otBillingReminder.job';
import { runAggressiveOTReminder } from './aggressiveOTReminder.job';
import { runPayrollDeadlineReminder } from './payrollDeadlineReminder.job';
import { runPayrollGeneration } from './payrollGeneration.job';
import type { Server } from 'socket.io';

export const initializeJobs = (io: Server): void => {
  console.log('[Jobs] Initializing cron jobs...');

  // Shift end: runs every minute to check for ending shifts and auto-clock-out
  cron.schedule('* * * * *', async () => {
    await runShiftEndJob(io);
  });
  console.log('[Jobs] Shift-end job scheduled (every minute)');

  // Auto-approval: runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await runAutoApproval(io);
  });
  console.log('[Jobs] Auto-approval job scheduled (every 5 minutes)');

  // Monthly invoice generation: runs on the 1st of every month at 12:05 AM EST (05:05 UTC)
  cron.schedule('5 5 1 * *', async () => {
    await runMonthlyInvoiceGeneration(io);
  });
  console.log('[Jobs] Monthly invoice generation scheduled (1st of month, 12:05 AM EST)');

  // Weekly invoice generation: runs every Monday at 12:10 AM EST (05:10 UTC)
  cron.schedule('10 5 * * 1', async () => {
    await runWeeklyInvoiceGeneration(io);
  });
  console.log('[Jobs] Weekly invoice generation scheduled (Monday, 12:10 AM EST)');

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

  console.log('[Jobs] All cron jobs initialized');
};

export { generateInvoicesForPeriod, generateWeeklyInvoicesForWeek } from './invoiceGeneration.job';
export { runAutoApproval } from './autoApproval.job';
export { runShiftEndJob } from './shiftEnd.job';
export { runOTBillingReminder } from './otBillingReminder.job';
export { runAggressiveOTReminder } from './aggressiveOTReminder.job';
export { runPayrollDeadlineReminder } from './payrollDeadlineReminder.job';
export { runPayrollGeneration } from './payrollGeneration.job';
