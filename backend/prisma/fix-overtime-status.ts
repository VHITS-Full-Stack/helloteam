/**
 * One-time script to fix old entries:
 *
 * 1. TimeRecords where OvertimeRequest was approved but shiftExtensionStatus /
 *    extraTimeStatus was never updated (causes dashboard unapproved OT popup).
 *
 * 2. TimeRecords that were client-approved but status stayed AUTO_APPROVED
 *    instead of changing to APPROVED (causes wrong badge on admin side).
 *
 * Usage: npx ts-node prisma/fix-overtime-status.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOvertimeStatus() {
  // Find all approved OvertimeRequests
  const approvedOTRequests = await prisma.overtimeRequest.findMany({
    where: { status: 'APPROVED' },
    select: {
      id: true,
      employeeId: true,
      clientId: true,
      date: true,
      type: true,
      requestedMinutes: true,
    },
  });

  console.log(`Found ${approvedOTRequests.length} approved overtime requests`);

  let fixed = 0;

  for (const ot of approvedOTRequests) {
    // Find matching TimeRecord that still has unapproved OT status
    const whereClause: any = {
      employeeId: ot.employeeId,
      clientId: ot.clientId,
      date: ot.date,
    };

    if (ot.type === 'SHIFT_EXTENSION') {
      whereClause.shiftExtensionMinutes = { gt: 0 };
      whereClause.shiftExtensionStatus = { in: ['PENDING', 'UNAPPROVED', 'NONE'] };
    } else if (ot.type === 'OFF_SHIFT') {
      whereClause.extraTimeMinutes = { gt: 0 };
      whereClause.extraTimeStatus = { in: ['PENDING', 'UNAPPROVED', 'NONE'] };
    }

    const timeRecord = await prisma.timeRecord.findFirst({ where: whereClause });

    if (timeRecord) {
      const updateData: any = {};
      if (ot.type === 'SHIFT_EXTENSION') {
        updateData.shiftExtensionStatus = 'APPROVED';
      } else if (ot.type === 'OFF_SHIFT') {
        updateData.extraTimeStatus = 'APPROVED';
      }

      await prisma.timeRecord.update({
        where: { id: timeRecord.id },
        data: updateData,
      });

      fixed++;
      console.log(`[OT Status] Fixed TimeRecord ${timeRecord.id} (date: ${ot.date.toISOString().split('T')[0]}, type: ${ot.type})`);
    }
  }

  console.log(`\n[OT Status] Fixed ${fixed} time records out of ${approvedOTRequests.length} approved overtime requests.`);
  return fixed;
}

async function fixAutoApprovedBadge() {
  // Find TimeRecords that have approvedBy set (client manually approved)
  // but status is still AUTO_APPROVED
  const stuckRecords = await prisma.timeRecord.findMany({
    where: {
      status: 'AUTO_APPROVED',
      approvedBy: { not: null },
    },
    select: { id: true, date: true, employeeId: true },
  });

  if (stuckRecords.length > 0) {
    const result = await prisma.timeRecord.updateMany({
      where: {
        status: 'AUTO_APPROVED',
        approvedBy: { not: null },
      },
      data: { status: 'APPROVED' },
    });

    console.log(`\n[Badge Fix] Fixed ${result.count} time records from AUTO_APPROVED to APPROVED (client had already approved)`);
    return result.count;
  }

  // Also check via session logs — if a client approved a time record, there will be a CLIENT_APPROVED log
  const clientApprovedLogs = await prisma.sessionLog.findMany({
    where: { action: 'CLIENT_APPROVED' },
    select: { metadata: true },
  });

  let fixedViaLogs = 0;
  for (const log of clientApprovedLogs) {
    const meta = log.metadata as any;
    if (meta?.timeRecordId) {
      const record = await prisma.timeRecord.findFirst({
        where: { id: meta.timeRecordId, status: 'AUTO_APPROVED' },
      });
      if (record) {
        await prisma.timeRecord.update({
          where: { id: record.id },
          data: { status: 'APPROVED' },
        });
        fixedViaLogs++;
        console.log(`[Badge Fix] Fixed TimeRecord ${record.id} via session log`);
      }
    }
  }

  console.log(`\n[Badge Fix] Fixed ${stuckRecords.length + fixedViaLogs} total records`);
  return stuckRecords.length + fixedViaLogs;
}

async function main() {
  console.log('=== Fixing old overtime status entries ===\n');

  const otFixed = await fixOvertimeStatus();
  const badgeFixed = await fixAutoApprovedBadge();

  console.log(`\n=== Summary ===`);
  console.log(`OT status fixes: ${otFixed}`);
  console.log(`Badge fixes: ${badgeFixed}`);
  console.log(`Total: ${otFixed + badgeFixed}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
