/**
 * Fix incorrectly AUTO_APPROVED TimeRecords that have significant OT.
 *
 * Problem: The auto-approval job only checked `overtimeMinutes` but not
 * `extraTimeMinutes` or `shiftExtensionMinutes`. Records with early clock-in
 * or off-shift OT could slip through with status AUTO_APPROVED even though
 * they required manual client approval.
 *
 * This script finds those records and either:
 *   - Reverts to PENDING   → if OT is still pending client approval
 *   - Upgrades to APPROVED → if OT has since been manually approved
 *
 * Run: npx tsx src/scripts/fix-auto-approved-ot-records.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OT_GRACE_MINUTES = 7;

async function main() {
  console.log('[Fix] Finding incorrectly AUTO_APPROVED records with significant OT...');

  const records = await prisma.timeRecord.findMany({
    where: {
      status: 'AUTO_APPROVED',
      OR: [
        { extraTimeMinutes: { gt: OT_GRACE_MINUTES } },
        { shiftExtensionMinutes: { gt: OT_GRACE_MINUTES } },
      ],
    },
    select: {
      id: true,
      employeeId: true,
      clientId: true,
      date: true,
      overtimeMinutes: true,
      shiftExtensionMinutes: true,
      shiftExtensionStatus: true,
      extraTimeMinutes: true,
      extraTimeStatus: true,
      approvedAt: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  console.log(`[Fix] Found ${records.length} candidate records.\n`);

  let revertedToPending = 0;
  let upgradedToApproved = 0;

  for (const tr of records) {
    const dateStr = tr.date.toISOString().split('T')[0];
    const name = `${tr.employee.firstName} ${tr.employee.lastName}`;

    const [pendingOT, approvedOT] = await Promise.all([
      prisma.overtimeRequest.count({
        where: {
          employeeId: tr.employeeId,
          clientId: tr.clientId,
          date: tr.date,
          status: 'PENDING',
        },
      }),
      prisma.overtimeRequest.count({
        where: {
          employeeId: tr.employeeId,
          clientId: tr.clientId,
          date: tr.date,
          status: 'APPROVED',
        },
      }),
    ]);

    if (pendingOT > 0) {
      // OT still awaiting approval — revert to PENDING
      await prisma.timeRecord.update({
        where: { id: tr.id },
        data: {
          status: 'PENDING',
          approvedAt: null,
        },
      });
      revertedToPending++;
      console.log(`[Reverted → PENDING]  ${name} on ${dateStr} — ${pendingOT} pending OT request(s) (extra: ${tr.extraTimeMinutes}m, ext: ${tr.shiftExtensionMinutes}m)`);
    } else if (approvedOT > 0) {
      // All OT manually approved — upgrade to APPROVED and fix sub-statuses
      const updateData: any = {
        status: 'APPROVED',
        approvedAt: tr.approvedAt || new Date(),
      };
      if ((tr.shiftExtensionMinutes || 0) > OT_GRACE_MINUTES && tr.shiftExtensionStatus !== 'APPROVED') {
        updateData.shiftExtensionStatus = 'APPROVED';
      }
      if ((tr.extraTimeMinutes || 0) > OT_GRACE_MINUTES && tr.extraTimeStatus !== 'APPROVED') {
        updateData.extraTimeStatus = 'APPROVED';
      }
      await prisma.timeRecord.update({ where: { id: tr.id }, data: updateData });
      upgradedToApproved++;
      console.log(`[Upgraded → APPROVED] ${name} on ${dateStr} — OT was manually approved (extra: ${tr.extraTimeMinutes}m, ext: ${tr.shiftExtensionMinutes}m)`);
    } else {
      // No OT requests at all (synthetic OT) — revert to PENDING for manual review
      await prisma.timeRecord.update({
        where: { id: tr.id },
        data: {
          status: 'PENDING',
          approvedAt: null,
        },
      });
      revertedToPending++;
      console.log(`[Reverted → PENDING]  ${name} on ${dateStr} — no OT requests found, synthetic OT needs review (extra: ${tr.extraTimeMinutes}m, ext: ${tr.shiftExtensionMinutes}m)`);
    }
  }

  console.log(`\n[Fix] Done.`);
  console.log(`  Reverted to PENDING:   ${revertedToPending}`);
  console.log(`  Upgraded to APPROVED:  ${upgradedToApproved}`);
  console.log(`  Total processed:       ${records.length}`);
}

main()
  .catch((err) => {
    console.error('[Fix] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
