import prisma from '../config/database';
import type { Server } from 'socket.io';
import { createNotification } from '../controllers/notification.controller';

/**
 * Auto-generate payroll periods on the 7th and 21st of each month at midnight EST.
 *
 * - 7th: Creates payroll period for 1st–15th of the current month
 * - 21st: Creates payroll period for 16th–last day of the current month
 *
 * Only creates periods for active clients that don't already have one for that date range.
 */
export const runPayrollGeneration = async (io?: Server): Promise<void> => {
  try {
    const now = new Date();

    // Get current date in EST
    const estFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = estFormatter.formatToParts(now);
    const estYear = parseInt(parts.find(p => p.type === 'year')?.value || '2026');
    const estMonth = parseInt(parts.find(p => p.type === 'month')?.value || '1');
    const estDay = parseInt(parts.find(p => p.type === 'day')?.value || '1');

    // Only run on the 7th or 21st
    if (estDay !== 7 && estDay !== 21) return;

    let periodStart: Date;
    let periodEnd: Date;
    let cutoffDate: Date;

    if (estDay === 7) {
      // Generate payroll for 22nd (previous month) to 7th (current month)
      const prevMonth = estMonth === 1 ? 12 : estMonth - 1;
      const prevYear = estMonth === 1 ? estYear - 1 : estYear;
      periodStart = new Date(Date.UTC(prevYear, prevMonth - 1, 22));
      periodEnd = new Date(Date.UTC(estYear, estMonth - 1, 7));
      cutoffDate = new Date(Date.UTC(estYear, estMonth - 1, 7));
    } else {
      // Generate payroll for 8th to 21st (current month)
      periodStart = new Date(Date.UTC(estYear, estMonth - 1, 8));
      periodEnd = new Date(Date.UTC(estYear, estMonth - 1, 21));
      cutoffDate = new Date(Date.UTC(estYear, estMonth - 1, 21));
    }

    console.log(`[Payroll-Gen] Running for EST date ${estYear}-${estMonth}-${estDay}. Period: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);

    // Get all active clients (those with at least one active employee assignment)
    const activeClients = await prisma.client.findMany({
      where: {
        clientEmployees: {
          some: { isActive: true },
        },
      },
      select: {
        id: true,
        companyName: true,
        userId: true,
      },
    });

    if (activeClients.length === 0) {
      console.log('[Payroll-Gen] No active clients found');
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const client of activeClients) {
      // Check if period already exists for this client
      const existing = await prisma.payrollPeriod.findFirst({
        where: {
          clientId: client.id,
          periodStart,
          periodEnd,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the payroll period
      await prisma.payrollPeriod.create({
        data: {
          clientId: client.id,
          periodStart,
          periodEnd,
          cutoffDate,
          status: 'OPEN',
          notes: `Auto-generated payroll period for ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
        },
      });

      created++;

      // Notify client
      try {
        const periodLabel = `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`;
        await createNotification(
          client.userId,
          'PAYROLL_REMINDER',
          'New Payroll Period Created',
          `A new payroll period (${periodLabel}) has been automatically created. Please review and finalize before the cutoff date.`,
          { clientId: client.id, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
          '/client/payroll'
        );

        if (io) {
          io.emit(`notification:${client.userId}`, {
            type: 'PAYROLL_REMINDER',
            message: `New payroll period created: ${periodLabel}`,
          });
        }
      } catch (notifErr) {
        console.error(`[Payroll-Gen] Failed to notify client ${client.companyName}:`, notifErr);
      }
    }

    console.log(`[Payroll-Gen] Done. Created: ${created}, Skipped (already exists): ${skipped}`);
  } catch (error) {
    console.error('[Payroll-Gen] Job failed:', error);
  }
};
