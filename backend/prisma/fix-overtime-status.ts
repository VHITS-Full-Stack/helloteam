/**
 * One-time script to fix old entries:
 *
 * 1. TimeRecords where OvertimeRequest was approved but shiftExtensionStatus /
 *    extraTimeStatus was never updated (causes dashboard unapproved OT popup).
 *
 * 2. When client approves OT, the overall status should change to APPROVED.
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
      console.log(`[OT Status] Fixed TimeRecord ${timeRecord.id} (date: ${ot.date.toISOString().split('T')[0]}, type: ${ot.type})`);
    }
  }

  console.log(`\nFixed ${fixed} time records out of ${approvedOTRequests.length} approved overtime requests.`);
  return fixed;
}

async function main() {
  console.log('=== Fixing overtime status entries ===\n');
  const fixed = await fixOvertimeStatus();
  console.log(`\nTotal fixed: ${fixed}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
