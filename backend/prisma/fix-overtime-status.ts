/**
 * One-time script to fix old entries:
 *
 * 1. TimeRecords where OvertimeRequest was approved but shiftExtensionStatus /
 *    extraTimeStatus was never updated (causes dashboard unapproved OT popup).
 *
 * 2. When client approves OT, the overall status should change to APPROVED.
 *
 * 3. TimeRecords with NO OT that were auto-approved but got changed to APPROVED
 *    by bulk approve — revert these back to AUTO_APPROVED.
 *
 * Usage: npx ts-node prisma/fix-overtime-status.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOvertimeStatus() {
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
    const whereClause: any = {
      employeeId: ot.employeeId,
      clientId: ot.clientId,
      date: ot.date,
      OR: [] as any[],
    };

    if (ot.type === 'SHIFT_EXTENSION') {
      whereClause.OR.push(
        { shiftExtensionMinutes: { gt: 0 }, shiftExtensionStatus: { in: ['PENDING', 'UNAPPROVED', 'NONE'] } },
        { shiftExtensionMinutes: { gt: 0 }, status: 'AUTO_APPROVED' },
      );
    } else if (ot.type === 'OFF_SHIFT') {
      whereClause.OR.push(
        { extraTimeMinutes: { gt: 0 }, extraTimeStatus: { in: ['PENDING', 'UNAPPROVED', 'NONE'] } },
        { extraTimeMinutes: { gt: 0 }, status: 'AUTO_APPROVED' },
      );
    }

    const timeRecord = await prisma.timeRecord.findFirst({ where: whereClause });

    if (timeRecord) {
      const updateData: any = {};
      if (ot.type === 'SHIFT_EXTENSION') {
        updateData.shiftExtensionStatus = 'APPROVED';
      } else if (ot.type === 'OFF_SHIFT') {
        updateData.extraTimeStatus = 'APPROVED';
      }

      // Client approved OT, so overall status should be APPROVED
      if (timeRecord.status === 'AUTO_APPROVED' || timeRecord.status === 'PENDING') {
        updateData.status = 'APPROVED';
      }

      await prisma.timeRecord.update({
        where: { id: timeRecord.id },
        data: updateData,
      });

      fixed++;
      console.log(`[OT Fix] Fixed TimeRecord ${timeRecord.id} (date: ${ot.date.toISOString().split('T')[0]}, type: ${ot.type})`);
    }
  }

  console.log(`\n[OT Fix] Fixed ${fixed} time records`);
  return fixed;
}

async function fixAutoApprovedNoOT() {
  // Find records that were originally auto-approved (have AutoApprovalLog)
  // but got changed to APPROVED, and have NO overtime.
  // These should be reverted to AUTO_APPROVED.
  const autoApprovalLogs = await prisma.autoApprovalLog.findMany({
    select: { employeeId: true, clientId: true, recordDate: true },
  });

  console.log(`\nFound ${autoApprovalLogs.length} auto-approval logs`);

  let fixed = 0;

  for (const log of autoApprovalLogs) {
    const timeRecord = await prisma.timeRecord.findFirst({
      where: {
        employeeId: log.employeeId,
        clientId: log.clientId,
        date: log.recordDate,
        status: 'APPROVED',
        // No approved OT — meaning the client didn't approve any OT for this record
        overtimeMinutes: { equals: 0 },
      },
    });

    if (timeRecord) {
      await prisma.timeRecord.update({
        where: { id: timeRecord.id },
        data: { status: 'AUTO_APPROVED' },
      });

      fixed++;
      console.log(`[No-OT Fix] Reverted TimeRecord ${timeRecord.id} to AUTO_APPROVED (date: ${log.recordDate.toISOString().split('T')[0]})`);
    }
  }

  // Also handle records with OT but where OT was NOT approved by client
  // (OT is still pending/unapproved, so the bulk approve shouldn't have changed the status)
  for (const log of autoApprovalLogs) {
    const timeRecord = await prisma.timeRecord.findFirst({
      where: {
        employeeId: log.employeeId,
        clientId: log.clientId,
        date: log.recordDate,
        status: 'APPROVED',
        overtimeMinutes: { gt: 0 },
        // OT is still not approved — meaning client didn't approve OT, only bulk approved the record
        shiftExtensionStatus: { in: ['PENDING', 'UNAPPROVED', 'NONE'] },
        extraTimeStatus: { in: ['PENDING', 'UNAPPROVED', 'NONE'] },
      },
    });

    if (timeRecord) {
      await prisma.timeRecord.update({
        where: { id: timeRecord.id },
        data: { status: 'AUTO_APPROVED' },
      });

      fixed++;
      console.log(`[Unapproved-OT Fix] Reverted TimeRecord ${timeRecord.id} to AUTO_APPROVED (date: ${log.recordDate.toISOString().split('T')[0]})`);
    }
  }

  console.log(`\n[No-OT Fix] Reverted ${fixed} records back to AUTO_APPROVED`);
  return fixed;
}

async function main() {
  console.log('=== Fixing overtime status and auto-approved badges ===\n');

  const otFixed = await fixOvertimeStatus();
  const badgeFixed = await fixAutoApprovedNoOT();

  console.log(`\n=== Summary ===`);
  console.log(`OT status fixes: ${otFixed}`);
  console.log(`Auto-approved badge fixes: ${badgeFixed}`);
  console.log(`Total: ${otFixed + badgeFixed}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
