/**
 * Fix TimeRecords where invoiceId was incorrectly saved as the string "[null]"
 * instead of actual SQL NULL.
 *
 * Run: npx tsx src/scripts/fix-null-invoice-id.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all affected records
  const affected = await prisma.timeRecord.findMany({
    where: { invoiceId: '[null]' },
    select: {
      id: true,
      date: true,
      status: true,
      employee: { select: { firstName: true, lastName: true } },
      client: { select: { companyName: true } },
    },
  });

  console.log(`Found ${affected.length} records with invoiceId = '[null]'`);
  for (const tr of affected) {
    const date = tr.date.toISOString().split('T')[0];
    console.log(`  ${date}  ${tr.employee.firstName} ${tr.employee.lastName}  [${tr.status}]  client: ${tr.client.companyName}`);
  }

  if (affected.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  const result = await prisma.timeRecord.updateMany({
    where: { invoiceId: '[null]' },
    data: { invoiceId: null },
  });

  console.log(`\nFixed ${result.count} records — invoiceId set to NULL.`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
