import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const nikita = await prisma.employee.findFirst({ where: { firstName: 'Nikita', lastName: 'Karanpuria' } });
  const client = await prisma.client.findFirst();
  if (!nikita || !client) return;
  
  const record = await prisma.timeRecord.create({
    data: {
      employeeId: nikita.id,
      clientId: client.id,
      date: new Date('2026-04-25T00:00:00Z'),
      actualStart: new Date('2026-04-25T13:00:00Z'),
      actualEnd: new Date('2026-04-25T21:00:00Z'),
      totalMinutes: 480,
      status: 'PENDING',
      isManual: true
    }
  });
  console.log('Created record:', record.id);
}
main().finally(() => prisma.$disconnect());
