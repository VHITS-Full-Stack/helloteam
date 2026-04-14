/**
 * Fix old TimeRecord totalMinutes and billingMinutes.
 *
 * Problem: When employees checked in early (before scheduled start), the
 * display showed 0 regular hours for active sessions. Some completed records
 * may also have incorrect totalMinutes or billingMinutes stored.
 *
 * This script recalculates totalMinutes and billingMinutes from the stored
 * actualStart/actualEnd timestamps and updates any mismatched records.
 *
 * Run:  npx ts-node src/scripts/fix-time-record-minutes.ts
 * Dry:  npx ts-node src/scripts/fix-time-record-minutes.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GRACE_MS = 7 * 60 * 1000;

function computeBillingTimes(
  actualStart: Date,
  actualEnd: Date,
  scheduledStart: Date | null,
  scheduledEnd: Date | null,
): { billingStart: Date; billingEnd: Date } {
  if (!scheduledStart || !scheduledEnd) {
    return { billingStart: actualStart, billingEnd: actualEnd };
  }

  let billingStart: Date;
  const lateMs = actualStart.getTime() - scheduledStart.getTime();
  if (lateMs <= GRACE_MS) {
    billingStart = scheduledStart;
  } else {
    billingStart = actualStart;
  }

  let billingEnd: Date;
  const earlyMs = scheduledEnd.getTime() - actualEnd.getTime();
  if (earlyMs <= GRACE_MS) {
    billingEnd = scheduledEnd;
  } else {
    billingEnd = actualEnd;
  }

  if (billingEnd.getTime() <= billingStart.getTime()) {
    return { billingStart: actualStart, billingEnd: actualEnd };
  }

  return { billingStart, billingEnd };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`[Fix] ${dryRun ? 'DRY RUN - ' : ''}Scanning time records...`);

  const records = await prisma.timeRecord.findMany({
    where: {
      actualStart: { not: null },
      actualEnd: { not: null },
    },
    select: {
      id: true,
      date: true,
      actualStart: true,
      actualEnd: true,
      scheduledStart: true,
      scheduledEnd: true,
      breakMinutes: true,
      totalMinutes: true,
      billingMinutes: true,
      billingStart: true,
      billingEnd: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  console.log(`[Fix] Found ${records.length} records with actual start/end times`);

  let fixed = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.actualStart || !record.actualEnd) {
      skipped++;
      continue;
    }

    const actualStart = new Date(record.actualStart);
    const actualEnd = new Date(record.actualEnd);
    const breakMins = record.breakMinutes || 0;

    // Recalculate totalMinutes
    const correctTotalMinutes = Math.max(0,
      Math.round((actualEnd.getTime() - actualStart.getTime()) / 60000) - breakMins
    );

    // Recalculate billing
    const billing = computeBillingTimes(
      actualStart,
      actualEnd,
      record.scheduledStart ? new Date(record.scheduledStart) : null,
      record.scheduledEnd ? new Date(record.scheduledEnd) : null,
    );
    const correctBillingMinutes = Math.max(0,
      Math.floor((billing.billingEnd.getTime() - billing.billingStart.getTime()) / 60000) - breakMins
    );

    const needsFix =
      record.totalMinutes !== correctTotalMinutes ||
      record.billingMinutes !== correctBillingMinutes;

    if (needsFix) {
      const name = `${record.employee.firstName} ${record.employee.lastName}`;
      const dateStr = record.date.toISOString().split('T')[0];
      console.log(
        `[Fix] ${name} on ${dateStr}: ` +
        `totalMinutes ${record.totalMinutes} → ${correctTotalMinutes}, ` +
        `billingMinutes ${record.billingMinutes} → ${correctBillingMinutes}`
      );

      if (!dryRun) {
        await prisma.timeRecord.update({
          where: { id: record.id },
          data: {
            totalMinutes: correctTotalMinutes,
            billingMinutes: correctBillingMinutes,
            billingStart: billing.billingStart,
            billingEnd: billing.billingEnd,
          },
        });
      }
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`\n[Fix] Done. ${fixed} records ${dryRun ? 'would be' : ''} fixed, ${skipped} already correct.`);
}

main()
  .catch((err) => {
    console.error('[Fix] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
