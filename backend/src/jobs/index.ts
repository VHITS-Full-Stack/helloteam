import cron from 'node-cron';
import { runAutoApproval } from './autoApproval.job';
import { runMonthlyInvoiceGeneration, runWeeklyInvoiceGeneration } from './invoiceGeneration.job';
import { runShiftEndJob } from './shiftEnd.job';
import { runOTBillingReminder } from './otBillingReminder.job';
import { runAggressiveOTReminder } from './aggressiveOTReminder.job';
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

  // Monthly invoice generation: runs on the 1st of every month at 00:05 UTC
  cron.schedule('5 0 1 * *', async () => {
    await runMonthlyInvoiceGeneration(io);
  });
  console.log('[Jobs] Monthly invoice generation scheduled (1st of month, 00:05 UTC)');

  // Weekly invoice generation: runs every Monday at 00:10 UTC
  cron.schedule('10 0 * * 1', async () => {
    await runWeeklyInvoiceGeneration(io);
  });
  console.log('[Jobs] Weekly invoice generation scheduled (Monday, 00:10 UTC)');

  // OT billing cycle reminder: runs daily at 09:00 UTC
  // Notifies clients 3 days before billing cycle ends about unapproved OT
  cron.schedule('0 9 * * *', async () => {
    await runOTBillingReminder(io);
  });
  console.log('[Jobs] OT billing reminder scheduled (daily, 09:00 UTC)');

  // Aggressive OT approval reminder: runs daily at 14:00 UTC (10 AM ET)
  // Sends urgent notifications to clients with any pending unapproved overtime
  cron.schedule('0 14 * * *', async () => {
    await runAggressiveOTReminder(io);
  });
  console.log('[Jobs] Aggressive OT reminder scheduled (daily, 14:00 UTC)');

  console.log('[Jobs] All cron jobs initialized');
};

export { generateInvoicesForPeriod, generateWeeklyInvoicesForWeek } from './invoiceGeneration.job';
export { runAutoApproval } from './autoApproval.job';
export { runShiftEndJob } from './shiftEnd.job';
export { runOTBillingReminder } from './otBillingReminder.job';
export { runAggressiveOTReminder } from './aggressiveOTReminder.job';
