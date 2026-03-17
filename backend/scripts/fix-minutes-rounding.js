/**
 * Fix totalMinutes and billingMinutes for all TimeRecords
 * using seconds-based rounding: < 30s → down, >= 30s → up
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function roundMinutes(ms) {
  const fullMin = Math.floor(ms / 60000);
  const remSec = Math.floor((ms % 60000) / 1000);
  return remSec >= 30 ? fullMin + 1 : fullMin;
}

async function main() {
  const records = await prisma.timeRecord.findMany({
    where: {
      actualStart: { not: null },
      actualEnd: { not: null },
    },
    select: {
      id: true,
      actualStart: true,
      actualEnd: true,
      billingStart: true,
      billingEnd: true,
      breakMinutes: true,
      totalMinutes: true,
      billingMinutes: true,
    },
  });

  console.log(`Found ${records.length} time records to check`);

  let updated = 0;
  for (const rec of records) {
    const breakMins = rec.breakMinutes || 0;

    // Recalculate totalMinutes from actual times
    const totalMs = rec.actualEnd.getTime() - rec.actualStart.getTime();
    const newTotal = Math.max(0, roundMinutes(totalMs) - breakMins);

    // Recalculate billingMinutes from billing times
    let newBilling = rec.billingMinutes;
    if (rec.billingStart && rec.billingEnd) {
      const billingMs = rec.billingEnd.getTime() - rec.billingStart.getTime();
      newBilling = Math.max(0, roundMinutes(billingMs) - breakMins);
    }

    if (newTotal !== rec.totalMinutes || newBilling !== rec.billingMinutes) {
      console.log(`  ${rec.id}: totalMinutes ${rec.totalMinutes} → ${newTotal}, billingMinutes ${rec.billingMinutes} → ${newBilling}`);
      await prisma.timeRecord.update({
        where: { id: rec.id },
        data: {
          totalMinutes: newTotal,
          billingMinutes: newBilling,
        },
      });
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} of ${records.length} records.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
