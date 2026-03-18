/**
 * Debug + fix script for overtime status and auto-approved badges.
 * Usage: npx ts-node prisma/fix-overtime-status.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Debugging auto-approval data ===\n');

  // 1. Show all auto-approval logs
  const logs = await prisma.autoApprovalLog.findMany({
    select: { id: true, employeeId: true, clientId: true, recordDate: true },
  });
  console.log(`Auto-approval logs: ${logs.length}`);
  for (const log of logs) {
    console.log(`  Log: emp=${log.employeeId.substring(0,8)}... date=${log.recordDate.toISOString().split('T')[0]}`);

    // Find matching time record
    const tr = await prisma.timeRecord.findFirst({
      where: {
        employeeId: log.employeeId,
        clientId: log.clientId,
        date: log.recordDate,
      },
      select: {
        id: true, status: true, overtimeMinutes: true,
        shiftExtensionStatus: true, shiftExtensionMinutes: true,
        extraTimeStatus: true, extraTimeMinutes: true,
      },
    });
    if (tr) {
      console.log(`    TimeRecord: status=${tr.status}, OT=${tr.overtimeMinutes}min, extStatus=${tr.shiftExtensionStatus}(${tr.shiftExtensionMinutes}), extraStatus=${tr.extraTimeStatus}(${tr.extraTimeMinutes})`);
    } else {
      console.log(`    TimeRecord: NOT FOUND`);
    }
  }

  // 2. Show all time records with status APPROVED that might need fixing
  const approvedRecords = await prisma.timeRecord.findMany({
    where: { status: 'APPROVED' },
    select: {
      id: true, employeeId: true, clientId: true, date: true, status: true,
      overtimeMinutes: true, shiftExtensionStatus: true, shiftExtensionMinutes: true,
      extraTimeStatus: true, extraTimeMinutes: true,
    },
  });
  console.log(`\nAll APPROVED time records: ${approvedRecords.length}`);
  for (const r of approvedRecords) {
    const hasAutoLog = logs.some(l => l.employeeId === r.employeeId && l.clientId === r.clientId && l.recordDate.getTime() === r.date.getTime());
    const hasOT = (r.overtimeMinutes || 0) > 0;
    console.log(`  TR ${r.id.substring(0,8)}... date=${r.date.toISOString().split('T')[0]} OT=${r.overtimeMinutes}min hasAutoLog=${hasAutoLog} hasOT=${hasOT} ext=${r.shiftExtensionStatus} extra=${r.extraTimeStatus}`);
  }

  // 3. Show all AUTO_APPROVED records
  const autoApprovedRecords = await prisma.timeRecord.findMany({
    where: { status: 'AUTO_APPROVED' },
    select: { id: true, date: true, overtimeMinutes: true },
  });
  console.log(`\nAll AUTO_APPROVED time records: ${autoApprovedRecords.length}`);

  // 4. Now do the actual fix
  console.log('\n=== Applying fixes ===\n');

  let fixed = 0;

  // Fix: Any APPROVED record that has an auto-approval log AND no approved OT by client
  // should be reverted to AUTO_APPROVED
  for (const log of logs) {
    const tr = await prisma.timeRecord.findFirst({
      where: {
        employeeId: log.employeeId,
        clientId: log.clientId,
        date: log.recordDate,
        status: 'APPROVED',
      },
      select: {
        id: true, overtimeMinutes: true,
        shiftExtensionStatus: true, shiftExtensionMinutes: true,
        extraTimeStatus: true, extraTimeMinutes: true,
      },
    });

    if (!tr) continue;

    // Check if OT was approved by client
    const otApprovedByClient =
      (tr.shiftExtensionStatus === 'APPROVED' && (tr.shiftExtensionMinutes || 0) > 0) ||
      (tr.extraTimeStatus === 'APPROVED' && (tr.extraTimeMinutes || 0) > 0);

    if (!otApprovedByClient) {
      // No OT approved by client — revert to AUTO_APPROVED
      await prisma.timeRecord.update({
        where: { id: tr.id },
        data: { status: 'AUTO_APPROVED' },
      });
      fixed++;
      console.log(`Fixed: ${tr.id.substring(0,8)}... -> AUTO_APPROVED (no client OT approval)`);
    } else {
      console.log(`Skipped: ${tr.id.substring(0,8)}... (OT was client-approved, APPROVED is correct)`);
    }
  }

  console.log(`\nTotal fixed: ${fixed}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
