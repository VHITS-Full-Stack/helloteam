/**
 * Seed script to test date-effective payroll rates.
 *
 * Scenario:
 *   - Employee: Jigar Patel (jigar@demo.com) → assigned to Virtual Height (Nikita's client)
 *   - Payroll period: Feb 22 – Mar 7, 2026
 *   - Billing rate Feb 22–28: $10/hr
 *   - Billing rate Mar 1–7:  $15/hr (rate changed on Mar 1)
 *   - Each day: 8 hours work (480 min), no OT, APPROVED status
 *
 * Run: npx ts-node prisma/seed-payroll-test.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Jigar Patel
  const jigarUser = await prisma.user.findUnique({
    where: { email: 'jigar@demo.com' },
    include: { employee: true },
  });

  if (!jigarUser?.employee) {
    console.error('Employee jigar@demo.com not found. Run main seed first.');
    process.exit(1);
  }

  const employee = jigarUser.employee;
  const employeeId = employee.id;

  // Find Virtual Height client (Nikita's client)
  const client = await prisma.client.findFirst({
    where: { companyName: { contains: 'Virtual' } },
  });

  if (!client) {
    console.error('Virtual Height client not found. Run main seed first.');
    process.exit(1);
  }

  const clientId = client.id;

  // Find admin user for changedBy/approvedBy
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!admin) {
    console.error('Admin user not found. Run main seed first.');
    process.exit(1);
  }

  console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employeeId})`);
  console.log(`Client: ${client.companyName} (${clientId})`);

  // Step 1: Set billing rate to $10 (the "old" rate)
  await prisma.employee.update({
    where: { id: employeeId },
    data: { billingRate: 10.00 },
  });
  console.log('Set initial billing rate to $10/hr');

  // Step 2: Create RateChangeHistory — rate changed from $10 to $15 on Mar 1
  // First delete any existing test rate change entries for this employee
  await prisma.rateChangeHistory.deleteMany({
    where: {
      employeeId,
      notes: { contains: 'Payroll test seed' },
    },
  });

  await prisma.rateChangeHistory.create({
    data: {
      employeeId,
      clientId,
      changedBy: admin.id,
      changedByName: 'Admin',
      changeDate: new Date('2026-03-01T00:00:00.000Z'),
      rateType: 'BILLING_RATE',
      oldValue: 10.00,
      newValue: 15.00,
      source: 'EMPLOYEE_PROFILE',
      notes: 'Payroll test seed — rate change from $10 to $15 effective Mar 1',
    },
  });
  console.log('Created rate change history: $10 → $15 on Mar 1');

  // Now set the current rate to $15 (post-change)
  await prisma.employee.update({
    where: { id: employeeId },
    data: { billingRate: 15.00 },
  });
  console.log('Updated current billing rate to $15/hr');

  // Step 3: Create time records for Feb 22 – Mar 7 (weekdays only)
  const dates: string[] = [];
  const start = new Date('2026-02-22');
  const end = new Date('2026-03-07');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) { // Mon-Fri only
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  console.log(`Creating ${dates.length} time records: ${dates[0]} to ${dates[dates.length - 1]}`);

  for (const dateStr of dates) {
    const scheduledStart = new Date(`${dateStr}T14:00:00.000Z`); // 9 AM EST
    const scheduledEnd = new Date(`${dateStr}T22:00:00.000Z`);   // 5 PM EST
    const actualStart = new Date(`${dateStr}T14:00:00.000Z`);
    const actualEnd = new Date(`${dateStr}T22:00:00.000Z`);

    await prisma.timeRecord.upsert({
      where: {
        employeeId_clientId_date: {
          employeeId,
          clientId,
          date: new Date(`${dateStr}T00:00:00.000Z`),
        },
      },
      update: {
        totalMinutes: 480,
        breakMinutes: 0,
        overtimeMinutes: 0,
        billingMinutes: 480,
        status: 'APPROVED',
        approvedBy: admin.id,
        approvedAt: new Date(),
      },
      create: {
        employeeId,
        clientId,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        scheduledStart,
        scheduledEnd,
        actualStart,
        actualEnd,
        billingStart: actualStart,
        billingEnd: actualEnd,
        billingMinutes: 480,
        isLate: false,
        totalMinutes: 480,
        breakMinutes: 0,
        overtimeMinutes: 0,
        shiftExtensionStatus: 'NONE',
        shiftExtensionMinutes: 0,
        extraTimeStatus: 'NONE',
        extraTimeMinutes: 0,
        status: 'APPROVED',
        approvedBy: admin.id,
        approvedAt: new Date(),
      },
    });
  }

  // Count days per rate period
  const febDates = dates.filter(d => d.startsWith('2026-02'));
  const marDates = dates.filter(d => d.startsWith('2026-03'));

  console.log('\n=== EXPECTED PAYROLL RESULTS ===');
  console.log(`Feb 22-28 (${febDates.length} days): ${febDates.length * 8}h × $10/hr = $${febDates.length * 8 * 10}`);
  console.log(`Mar 1-7  (${marDates.length} days): ${marDates.length * 8}h × $15/hr = $${marDates.length * 8 * 15}`);
  console.log(`Total: ${dates.length * 8}h, $${febDates.length * 8 * 10 + marDates.length * 8 * 15}`);
  console.log('================================\n');

  console.log('Seed complete! Now check payroll for period 2026-02-22 to 2026-03-07');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
