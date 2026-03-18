/**
 * Debug script: check session grouping and status for Mayank Acharya on Mar 17
 * Usage: npx ts-node prisma/debug-sessions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Mayank Acharya
  const emp = await prisma.employee.findFirst({
    where: { firstName: { contains: 'Mayank', mode: 'insensitive' } },
    select: { id: true, firstName: true, lastName: true, userId: true },
  });
  if (!emp) { console.log('Employee not found'); return; }
  console.log(`Employee: ${emp.firstName} ${emp.lastName} (${emp.id})`);

  // Get client assignment
  const assignment = await prisma.clientEmployee.findFirst({
    where: { employeeId: emp.id, isActive: true },
    include: { client: { select: { id: true, companyName: true, timezone: true } } },
  });
  const clientTz = assignment?.client?.timezone || 'UTC';
  console.log(`Client: ${assignment?.client?.companyName} (tz: ${clientTz})`);

  // Get sessions on Mar 17
  const startDate = new Date('2026-03-17T00:00:00Z');
  const endDate = new Date('2026-03-17T23:59:59Z');

  const sessions = await prisma.workSession.findMany({
    where: {
      employeeId: emp.id,
      startTime: { gte: new Date('2026-03-16T00:00:00Z'), lte: new Date('2026-03-18T00:00:00Z') },
      status: { in: ['COMPLETED', 'ACTIVE', 'ON_BREAK'] },
    },
    orderBy: { startTime: 'asc' },
    select: { id: true, startTime: true, endTime: true, status: true },
  });

  console.log(`\nSessions found: ${sessions.length}`);
  const toTzDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: clientTz });
  const toUTCDate = (d: Date) => d.toISOString().split('T')[0];

  for (const s of sessions) {
    console.log(`  Session ${s.id.substring(0, 8)}...`);
    console.log(`    startTime: ${s.startTime.toISOString()} (UTC date: ${toUTCDate(s.startTime)}, TZ date: ${toTzDate(s.startTime)})`);
    console.log(`    endTime: ${s.endTime?.toISOString() || 'null'} (UTC date: ${s.endTime ? toUTCDate(s.endTime) : 'n/a'}, TZ date: ${s.endTime ? toTzDate(s.endTime) : 'n/a'})`);
    console.log(`    status: ${s.status}`);
  }

  // Group by TZ date
  const byTzDate: Record<string, typeof sessions> = {};
  const byUtcDate: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    const tzd = toTzDate(s.startTime);
    const utcd = toUTCDate(s.startTime);
    if (!byTzDate[tzd]) byTzDate[tzd] = [];
    if (!byUtcDate[utcd]) byUtcDate[utcd] = [];
    byTzDate[tzd].push(s);
    byUtcDate[utcd].push(s);
  }

  console.log(`\nGrouped by TZ date (${clientTz}):`);
  for (const [date, ss] of Object.entries(byTzDate)) {
    console.log(`  ${date}: ${ss.length} session(s)`);
  }

  console.log(`\nGrouped by UTC date:`);
  for (const [date, ss] of Object.entries(byUtcDate)) {
    console.log(`  ${date}: ${ss.length} session(s)`);
  }

  // Get TimeRecord for Mar 17
  const tr = await prisma.timeRecord.findFirst({
    where: {
      employeeId: emp.id,
      date: new Date('2026-03-17T00:00:00Z'),
    },
    select: {
      id: true, status: true, date: true, totalMinutes: true, overtimeMinutes: true,
      shiftExtensionStatus: true, shiftExtensionMinutes: true,
      extraTimeStatus: true, extraTimeMinutes: true,
      billingMinutes: true,
    },
  });
  console.log(`\nTimeRecord for 2026-03-17:`);
  console.log(`  status: ${tr?.status}, OT: ${tr?.overtimeMinutes}min, billing: ${tr?.billingMinutes}min`);
  console.log(`  extStatus: ${tr?.shiftExtensionStatus}(${tr?.shiftExtensionMinutes}), extraStatus: ${tr?.extraTimeStatus}(${tr?.extraTimeMinutes})`);
  console.log(`  TR date UTC: ${tr?.date.toISOString()}, TZ: ${tr ? toTzDate(tr.date) : 'n/a'}`);

  // Get OT requests for Mar 17
  const ots = await prisma.overtimeRequest.findMany({
    where: {
      employeeId: emp.id,
      date: new Date('2026-03-17T00:00:00Z'),
    },
    select: { id: true, type: true, status: true, requestedMinutes: true, createdAt: true, date: true },
  });
  console.log(`\nOvertimeRequests for 2026-03-17: ${ots.length}`);
  for (const ot of ots) {
    console.log(`  OT ${ot.id.substring(0, 8)}... type=${ot.type} status=${ot.status} mins=${ot.requestedMinutes} createdAt=${ot.createdAt.toISOString()}`);
    console.log(`    OT date UTC: ${ot.date.toISOString()}, TZ: ${toTzDate(ot.date)}`);
  }
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
