import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const nikita = await prisma.employee.findFirst({ where: { firstName: 'Nikita', lastName: 'Karanpuria' } });
  if (!nikita) return;
  const schedules = await prisma.schedule.findMany({
    where: { employeeId: nikita.id }
  });
  console.log(JSON.stringify(schedules, null, 2));
}
main().finally(() => prisma.$disconnect());
