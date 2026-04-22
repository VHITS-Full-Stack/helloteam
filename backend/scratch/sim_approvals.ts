import { PrismaClient } from '@prisma/client';
import { buildScheduleTimestamp } from '../src/utils/timezone';

const prisma = new PrismaClient();
async function main() {
  const nikita = await prisma.employee.findFirst({ where: { firstName: 'Nikita', lastName: 'Karanpuria' } });
  if (!nikita) return;
  
  const trs = await prisma.timeRecord.findMany({
    where: { employeeId: nikita.id, isManual: true },
    include: { client: true },
    orderBy: { date: 'desc' }
  });

  for (const tr of trs) {
    let sStart = tr.scheduledStart;
    let sEnd = tr.scheduledEnd;
    if (!sStart) {
       const clientTz = tr.client?.timezone || 'UTC';
       const dayOfWeek = tr.date.getUTCDay();
       const schedule = await prisma.schedule.findFirst({
         where: { employeeId: tr.employeeId, dayOfWeek, isActive: true }
       });
       if (schedule) {
         sStart = buildScheduleTimestamp(clientTz, schedule.startTime, tr.date);
         sEnd = buildScheduleTimestamp(clientTz, schedule.endTime, tr.date);
       }
    }
    console.log(`Date: ${tr.date.toISOString().split('T')[0]}, Manual: ${tr.isManual}, Schedule: ${sStart ? sStart.toISOString() : '—'}`);
  }
}
main().finally(() => prisma.$disconnect());
