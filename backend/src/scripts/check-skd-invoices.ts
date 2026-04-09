/**
 * Diagnostic script — check all invoices and time record state for a given company.
 *
 * Run: npx tsx src/scripts/check-skd-invoices.ts [companyName]
 * Example: npx tsx src/scripts/check-skd-invoices.ts SKD
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const companyName = process.argv[2] || 'SKD';

async function main() {
  // Find the client
  const client = await prisma.client.findFirst({
    where: { companyName: { contains: companyName, mode: 'insensitive' } },
    include: {
      user: { select: { id: true, email: true, status: true } },
      clientPolicies: { select: { invoiceByGroup: true } },
    },
  });

  if (!client) {
    console.log(`[Check] No client found matching "${companyName}"`);
    return;
  }

  console.log(`\n=== CLIENT INFO ===`);
  console.log(`  ID:           ${client.id}`);
  console.log(`  Name:         ${client.companyName}`);
  console.log(`  Agreement:    ${client.agreementType}`);
  console.log(`  User status:  ${client.user?.status}`);
  console.log(`  User email:   ${client.user?.email}`);
  console.log(`  InvoiceByGroup: ${client.clientPolicies?.invoiceByGroup}`);

  // Find all invoices for this client
  const invoices = await prisma.invoice.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      total: true,
      createdAt: true,
      _count: { select: { timeRecords: true } },
    },
  });

  console.log(`\n=== INVOICES (${invoices.length} total) ===`);
  if (invoices.length === 0) {
    console.log('  None found.');
  }
  for (const inv of invoices) {
    const start = inv.periodStart.toISOString().split('T')[0];
    const end = inv.periodEnd.toISOString().split('T')[0];
    console.log(`  ${inv.invoiceNumber}  [${inv.status}]  ${start} → ${end}  records: ${inv._count.timeRecords}  total: ${inv.total}  created: ${inv.createdAt.toISOString().split('T')[0]}`);
  }

  // Find time records that have invoiceId set
  const invoicedRecords = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      invoiceId: { not: null },
    },
    select: {
      id: true,
      date: true,
      status: true,
      invoiceId: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`\n=== TIME RECORDS WITH invoiceId SET (${invoicedRecords.length}) ===`);
  if (invoicedRecords.length === 0) {
    console.log('  None — records are free to be invoiced.');
  }
  for (const tr of invoicedRecords) {
    const date = tr.date.toISOString().split('T')[0];
    const name = `${tr.employee.firstName} ${tr.employee.lastName}`;
    console.log(`  ${date}  ${name}  [${tr.status}]  invoiceId: ${tr.invoiceId}`);
  }

  // Find time records that are APPROVED/AUTO_APPROVED and have no invoiceId (available for invoicing)
  const availableRecords = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      invoiceId: null,
    },
    select: {
      id: true,
      date: true,
      status: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`\n=== AVAILABLE RECORDS (APPROVED + no invoiceId): ${availableRecords.length} ===`);
  if (availableRecords.length === 0) {
    console.log('  None — nothing to invoice.');
  }
  for (const tr of availableRecords) {
    const date = tr.date.toISOString().split('T')[0];
    const name = `${tr.employee.firstName} ${tr.employee.lastName}`;
    console.log(`  ${date}  ${name}  [${tr.status}]`);
  }

  // Check if there are stale invoiceId references (invoiceId points to deleted invoice)
  if (invoicedRecords.length > 0) {
    const invoiceIds = [...new Set(invoicedRecords.map(r => r.invoiceId!))];
    const existingInvoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true, invoiceNumber: true },
    });
    const existingIds = new Set(existingInvoices.map(i => i.id));
    const staleIds = invoiceIds.filter(id => !existingIds.has(id));

    if (staleIds.length > 0) {
      console.log(`\n=== STALE invoiceId REFERENCES (invoice deleted but records still linked) ===`);
      console.log(`  Stale invoice IDs: ${staleIds.join(', ')}`);
      const staleRecords = invoicedRecords.filter(r => staleIds.includes(r.invoiceId!));
      console.log(`  Affected records: ${staleRecords.length}`);
      for (const tr of staleRecords) {
        const date = tr.date.toISOString().split('T')[0];
        const name = `${tr.employee.firstName} ${tr.employee.lastName}`;
        console.log(`  ${date}  ${name}  invoiceId: ${tr.invoiceId}`);
      }
      console.log(`\n  To fix, run:`);
      console.log(`  UPDATE "TimeRecord" SET "invoiceId" = NULL WHERE "invoiceId" IN (${staleIds.map(id => `'${id}'`).join(', ')});`);
    } else {
      console.log(`\n  All invoiceId references point to existing invoices. ✓`);
    }
  }
}

main()
  .catch((err) => {
    console.error('[Check] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
