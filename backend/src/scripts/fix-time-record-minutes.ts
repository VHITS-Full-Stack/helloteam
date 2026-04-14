/**
 * Fix old TimeRecord fields:
 * 1. scheduledStart/scheduledEnd — resolves the correct schedule from the Schedule table
 *    (latest effectiveFrom for the employee + day of week)
 * 2. totalMinutes — recalculated from actualStart/actualEnd
 * 3. billingMinutes/billingStart/billingEnd — recalculated using computeBillingTimes
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

/**
 * Build a full DateTime from a date + "HH:MM" time string.
 * The date is a UTC date (e.g. 2026-04-14T00:00:00Z) and the time is in client timezone,
 * but we combine them as UTC for consistency with how shiftEnd.job does it.
 */
function buildScheduleTimestamp(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const ts = new Date(date);
  ts.setUTCHours(h, m, 0, 0);
  return ts;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`[Fix] ${dryRun ? 'DRY RUN - ' : ''}Scanning time records...`);

  // 1. Fetch all schedules (latest effectiveFrom per employee+dayOfWeek)
  const allSchedules = await prisma.schedule.findMany({
    where: { isActive: true },
    select: {
      employeeId: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      effectiveFrom: true,
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  // Build lookup: employeeId_dayOfWeek -> { startTime, endTime } (latest effectiveFrom wins)
  const scheduleMap = new Map<string, { startTime: string; endTime: string }>();
  for (const sched of allSchedules) {
    const key = `${sched.employeeId}_${sched.dayOfWeek}`;
    if (!scheduleMap.has(key)) {
      scheduleMap.set(key, { startTime: sched.startTime, endTime: sched.endTime });
    }
  }

  // 2. Fetch all time records with actual timestamps
  const records = await prisma.timeRecord.findMany({
    where: {
      actualStart: { not: null },
      actualEnd: { not: null },
    },
    select: {
      id: true,
      employeeId: true,
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

  console.log(`[Fix] Found ${records.length} records, ${scheduleMap.size} schedule entries`);

  let fixedSchedule = 0;
  let fixedMinutes = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.actualStart || !record.actualEnd) {
      skipped++;
      continue;
    }

    const actualStart = new Date(record.actualStart);
    const actualEnd = new Date(record.actualEnd);
    const breakMins = record.breakMinutes || 0;
    const name = `${record.employee.firstName} ${record.employee.lastName}`;
    const dateStr = record.date.toISOString().split('T')[0];

    let changed = false;
    const updateData: any = {};

    // --- Fix scheduledStart/scheduledEnd from Schedule table ---
    const dayOfWeek = record.date.getUTCDay();
    const schedKey = `${record.employeeId}_${dayOfWeek}`;
    const schedule = scheduleMap.get(schedKey);

    if (schedule) {
      const correctSchedStart = buildScheduleTimestamp(record.date, schedule.startTime);
      const correctSchedEnd = buildScheduleTimestamp(record.date, schedule.endTime);
      // Handle overnight shifts (end time < start time)
      if (correctSchedEnd <= correctSchedStart) {
        correctSchedEnd.setUTCDate(correctSchedEnd.getUTCDate() + 1);
      }

      const currentSchedStart = record.scheduledStart ? new Date(record.scheduledStart).getTime() : null;
      const currentSchedEnd = record.scheduledEnd ? new Date(record.scheduledEnd).getTime() : null;

      if (currentSchedStart !== correctSchedStart.getTime() || currentSchedEnd !== correctSchedEnd.getTime()) {
        updateData.scheduledStart = correctSchedStart;
        updateData.scheduledEnd = correctSchedEnd;
        console.log(
          `[Fix-Sched] ${name} on ${dateStr}: ` +
          `schedule ${record.scheduledStart ? new Date(record.scheduledStart).toISOString() : 'null'} → ${correctSchedStart.toISOString()}, ` +
          `${record.scheduledEnd ? new Date(record.scheduledEnd).toISOString() : 'null'} → ${correctSchedEnd.toISOString()}`
        );
        fixedSchedule++;
        changed = true;
      }
    }

    // --- Fix totalMinutes ---
    const correctTotalMinutes = Math.max(0,
      Math.round((actualEnd.getTime() - actualStart.getTime()) / 60000) - breakMins
    );

    // Use the corrected schedule for billing calculation
    const schedStart = updateData.scheduledStart || (record.scheduledStart ? new Date(record.scheduledStart) : null);
    const schedEnd = updateData.scheduledEnd || (record.scheduledEnd ? new Date(record.scheduledEnd) : null);

    const billing = computeBillingTimes(actualStart, actualEnd, schedStart, schedEnd);
    const correctBillingMinutes = Math.max(0,
      Math.floor((billing.billingEnd.getTime() - billing.billingStart.getTime()) / 60000) - breakMins
    );

    if (record.totalMinutes !== correctTotalMinutes || record.billingMinutes !== correctBillingMinutes) {
      updateData.totalMinutes = correctTotalMinutes;
      updateData.billingMinutes = correctBillingMinutes;
      updateData.billingStart = billing.billingStart;
      updateData.billingEnd = billing.billingEnd;
      console.log(
        `[Fix-Mins] ${name} on ${dateStr}: ` +
        `totalMinutes ${record.totalMinutes} → ${correctTotalMinutes}, ` +
        `billingMinutes ${record.billingMinutes} → ${correctBillingMinutes}`
      );
      fixedMinutes++;
      changed = true;
    }

    if (changed && !dryRun) {
      await prisma.timeRecord.update({
        where: { id: record.id },
        data: updateData,
      });
    }

    if (!changed) skipped++;
  }

  console.log(`\n[Fix] Done.`);
  console.log(`  Schedule fixed: ${fixedSchedule}`);
  console.log(`  Minutes fixed: ${fixedMinutes}`);
  console.log(`  Already correct: ${skipped}`);
  if (dryRun) console.log(`  (DRY RUN — no changes written)`);
}

main()
  .catch((err) => {
    console.error('[Fix] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
