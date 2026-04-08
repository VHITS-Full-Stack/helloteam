/**
 * Fix stale TimeRecord statuses on production.
 *
 * Problem: When OT requests were approved, the cascade to update the TimeRecord
 * status only checked `overtimeMinutes > 0`, missing records where OT was tracked
 * as `extraTimeMinutes` or `shiftExtensionMinutes`. This left TimeRecords stuck
 * at PENDING even though all their OT requests were approved.
 *
 * This script finds those stale records and fixes them.
 *
 * Run: npx ts-node src/scripts/fix-stale-timerecord-status.ts
 * (or: npx tsx src/scripts/fix-stale-timerecord-status.ts)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Fix] Finding stale PENDING/AUTO_APPROVED time records with OT...');

  // Find time records that are PENDING or AUTO_APPROVED but have OT fields
  const staleRecords = await prisma.timeRecord.findMany({
    where: {
      status: { in: ['PENDING', 'AUTO_APPROVED'] },
      OR: [
        { overtimeMinutes: { gt: 0 } },
        { shiftExtensionMinutes: { gt: 0 } },
        { extraTimeMinutes: { gt: 0 } },
      ],
    },
    select: {
      id: true,
      employeeId: true,
      clientId: true,
      date: true,
      status: true,
      overtimeMinutes: true,
      shiftExtensionMinutes: true,
      shiftExtensionStatus: true,
      extraTimeMinutes: true,
      extraTimeStatus: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  console.log(`[Fix] Found ${staleRecords.length} candidate records.`);

  let fixed = 0;

  for (const tr of staleRecords) {
    // Check if ALL overtime requests for this employee+client+date are approved
    const pendingOT = await prisma.overtimeRequest.count({
      where: {
        employeeId: tr.employeeId,
        clientId: tr.clientId,
        date: tr.date,
        status: 'PENDING',
      },
    });

    if (pendingOT > 0) {
      console.log(`[Fix] Skipping ${tr.employee.firstName} ${tr.employee.lastName} on ${tr.date.toISOString().split('T')[0]} — still has ${pendingOT} pending OT request(s)`);
      continue;
    }

    // Check if there are any approved OT requests (meaning approval happened)
    const approvedOT = await prisma.overtimeRequest.count({
      where: {
        employeeId: tr.employeeId,
        clientId: tr.clientId,
        date: tr.date,
        status: 'APPROVED',
      },
    });

    if (approvedOT === 0) {
      console.log(`[Fix] Skipping ${tr.employee.firstName} ${tr.employee.lastName} on ${tr.date.toISOString().split('T')[0]} — no approved OT requests found`);
      continue;
    }

    // All OT approved, no pending — fix the TimeRecord
    const updateData: any = {
      status: 'APPROVED',
      approvedAt: new Date(),
    };

    // Also fix sub-statuses
    if ((tr.shiftExtensionMinutes || 0) > 0 && tr.shiftExtensionStatus !== 'APPROVED') {
      updateData.shiftExtensionStatus = 'APPROVED';
    }
    if ((tr.extraTimeMinutes || 0) > 0 && tr.extraTimeStatus !== 'APPROVED') {
      updateData.extraTimeStatus = 'APPROVED';
    }

    await prisma.timeRecord.update({
      where: { id: tr.id },
      data: updateData,
    });

    fixed++;
    console.log(`[Fix] Fixed: ${tr.employee.firstName} ${tr.employee.lastName} on ${tr.date.toISOString().split('T')[0]} — ${tr.status} → APPROVED (OT: ${tr.overtimeMinutes}m, ext: ${tr.shiftExtensionMinutes}m, extra: ${tr.extraTimeMinutes}m)`);
  }

  console.log(`\n[Fix] Done. Fixed ${fixed} out of ${staleRecords.length} records.`);
}

main()
  .catch((err) => {
    console.error('[Fix] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
