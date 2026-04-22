import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const nikita = await prisma.employee.findFirst({ where: { firstName: 'Nikita', lastName: 'Karanpuria' } });
  if (!nikita) return;
  
  // Clean up old test schedules for these days to avoid duplicates
  const days = [2, 3, 6]; 
  await prisma.schedule.deleteMany({
    where: {
      employeeId: nikita.id,
      dayOfWeek: { in: days },
      startTime: '09:00',
      endTime: '17:00'
    }
  });

  for (const day of days) {
    await prisma.schedule.create({
      data: {
        employeeId: nikita.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
        effectiveFrom: new Date('2026-04-01T00:00:00Z')
      }
    });
  }
  console.log('Schedules created');
}
main().finally(() => prisma.$disconnect());
