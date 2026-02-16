import cron from 'node-cron';
import { runAutoApproval } from './autoApproval.job';
import { runMonthlyInvoiceGeneration } from './invoiceGeneration.job';
import type { Server } from 'socket.io';

export const initializeJobs = (io: Server): void => {
  console.log('[Jobs] Initializing cron jobs...');

  // Auto-approval: runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await runAutoApproval(io);
  });
  console.log('[Jobs] Auto-approval job scheduled (every 5 minutes)');

  // Invoice generation: runs on the 1st of every month at 00:05 UTC
  cron.schedule('5 0 1 * *', async () => {
    await runMonthlyInvoiceGeneration(io);
  });
  console.log('[Jobs] Invoice generation job scheduled (1st of month, 00:05 UTC)');

  console.log('[Jobs] All cron jobs initialized');
};

export { generateInvoicesForPeriod } from './invoiceGeneration.job';
export { runAutoApproval } from './autoApproval.job';
