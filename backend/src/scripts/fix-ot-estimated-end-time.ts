/**
 * Fix incorrectly stored estimatedEndTime on OvertimeRequests.
 *
 * Problem: estimatedEndTime was computed using browser local time (getHours())
 * instead of the client's timezone. Records submitted from non-client-timezone
 * browsers have the wrong end time stored.
 *
 * Fix: Recalculate from createdAt (UTC) + requestedMinutes, formatted in the
 * client's timezone. This is reliable because both values are timezone-safe.
 *
 * Run: npx tsx src/scripts/fix-ot-estimated-end-time.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const formatHHMM = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hh = (parts.find(p => p.type === 'hour')?.value || '00').replace(/^24/, '00');
  const mm = parts.find(p => p.type === 'minute')?.value || '00';
  return `${hh}:${mm}`;
};

async function main() {
  // Only SHIFT_EXTENSION records have estimatedEndTime
  const requests = await prisma.overtimeRequest.findMany({
    where: {
      type: 'SHIFT_EXTENSION',
      estimatedEndTime: { not: null },
      status: 'PENDING',
    },
    select: {
      id: true,
      estimatedEndTime: true,
      requestedMinutes: true,
      createdAt: true,
      clientId: true,
    },
  });

  console.log(`Found ${requests.length} SHIFT_EXTENSION records with estimatedEndTime`);

  // Fetch all relevant client timezones
  const clientIds = [...new Set(requests.map(r => r.clientId))];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, timezone: true },
  });
  const tzMap = new Map(clients.map(c => [c.id, c.timezone || 'UTC']));

  let updated = 0;
  let skipped = 0;

  for (const req of requests) {
    const tz = tzMap.get(req.clientId) || 'UTC';
    const correctEndTime = new Date(req.createdAt.getTime() + req.requestedMinutes * 60000);
    const correctHHMM = formatHHMM(correctEndTime, tz);

    if (correctHHMM === req.estimatedEndTime) {
      skipped++;
      continue;
    }

    await prisma.overtimeRequest.update({
      where: { id: req.id },
      data: { estimatedEndTime: correctHHMM },
    });

    console.log(`  [${req.id}] ${req.estimatedEndTime} → ${correctHHMM} (tz: ${tz})`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
