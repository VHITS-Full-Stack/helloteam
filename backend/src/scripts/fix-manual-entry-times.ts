/**
 * Fix manual TimeRecord actualStart/actualEnd that were stored using server-local
 * timezone (IST/UTC+5:30) instead of the client's timezone.
 *
 * Root cause: addManualEntry used setHours() which applies the Node.js server's
 * local timezone (IST). So "09:00" was stored as 9 AM IST = 3:30 AM UTC instead of
 * 9 AM in the client's timezone (e.g. America/New_York = 1 PM UTC).
 *
 * Fix: Re-interpret each stored UTC time as IST to recover the originally-entered
 * HH:MM, then rebuild the timestamp using the client's timezone.
 *
 * Dry-run (default):
 *   npx tsx src/scripts/fix-manual-entry-times.ts
 *
 * Apply:
 *   DRY_RUN=false npx tsx src/scripts/fix-manual-entry-times.ts
 */

import { PrismaClient } from '@prisma/client';
import { buildTimestampFromDate } from '../utils/timezone';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== 'false';
const SERVER_TZ = 'Asia/Kolkata'; // IST — the timezone setHours() was using

/** Extract "HH:MM" from a UTC Date viewed in a given timezone */
const toHHMM = (d: Date, tz: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
};

const displayInTz = (d: Date, tz: string): string =>
  d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  });

async function main() {
  console.log(`[fix-manual-entry-times] DRY_RUN=${DRY_RUN}. Set DRY_RUN=false to apply.\n`);

  const records = await prisma.timeRecord.findMany({
    where: {
      isManual: true,
      actualStart: { not: null },
      actualEnd: { not: null },
    },
    select: {
      id: true,
      date: true,
      actualStart: true,
      actualEnd: true,
      employeeId: true,
      clientId: true,
      client: { select: { timezone: true, companyName: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  console.log(`Found ${records.length} manual time records.\n`);

  let fixCount = 0;
  let skipCount = 0;

  for (const rec of records) {
    const clientTz = rec.client?.timezone || 'America/New_York';
    const name = `${rec.employee.firstName} ${rec.employee.lastName}`;
    const dateStr = rec.date.toISOString().split('T')[0];

    // Recover the originally-entered HH:MM by reading stored UTC time in IST
    const startHHMM = toHHMM(rec.actualStart!, SERVER_TZ);
    const endHHMM = toHHMM(rec.actualEnd!, SERVER_TZ);

    // Rebuild timestamps treating those HH:MM values as client timezone
    const newStart = buildTimestampFromDate(rec.date, startHHMM, clientTz);
    let newEnd = buildTimestampFromDate(rec.date, endHHMM, clientTz);

    // Preserve overnight shift: if end <= start, push end to next day
    if (newEnd <= newStart) {
      newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const startDiff = Math.abs(newStart.getTime() - rec.actualStart!.getTime());
    const endDiff = Math.abs(newEnd.getTime() - rec.actualEnd!.getTime());

    if (startDiff < 60_000 && endDiff < 60_000) {
      skipCount++;
      continue;
    }

    console.log(`[${name}] ${dateStr} (${rec.client?.companyName}, ${clientTz})`);
    console.log(`  start: ${displayInTz(rec.actualStart!, clientTz)} (was IST ${startHHMM}) → ${displayInTz(newStart, clientTz)}`);
    console.log(`  end:   ${displayInTz(rec.actualEnd!, clientTz)} (was IST ${endHHMM}) → ${displayInTz(newEnd, clientTz)}`);

    if (!DRY_RUN) {
      await prisma.timeRecord.update({
        where: { id: rec.id },
        data: { actualStart: newStart, actualEnd: newEnd },
      });

      // Update the linked manual WorkSession
      const session = await prisma.workSession.findFirst({
        where: {
          employeeId: rec.employeeId,
          isManual: true,
          startTime: {
            gte: new Date(rec.actualStart!.getTime() - 5 * 60 * 1000),
            lte: new Date(rec.actualStart!.getTime() + 5 * 60 * 1000),
          },
        },
        select: { id: true },
      });

      if (session) {
        await prisma.workSession.update({
          where: { id: session.id },
          data: { startTime: newStart, endTime: newEnd },
        });
        console.log(`  ✓ Updated TimeRecord + WorkSession`);
      } else {
        console.log(`  ✓ Updated TimeRecord (no matching WorkSession found)`);
      }
    }

    fixCount++;
  }

  console.log(`\n[fix-manual-entry-times] Done. To fix: ${fixCount}, Skipped (already correct): ${skipCount}`);
  if (DRY_RUN && fixCount > 0) {
    console.log(`Re-run with DRY_RUN=false to apply ${fixCount} fix(es).`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
