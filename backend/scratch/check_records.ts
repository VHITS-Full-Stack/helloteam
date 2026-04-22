import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const nikita = await prisma.employee.findFirst({ where: { firstName: 'Nikita', lastName: 'Karanpuria' } });
  if (!nikita) { console.log('Nikita not found'); return; }
  const records = await prisma.timeRecord.findMany({
    where: { employeeId: nikita.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(records, null, 2));
}
main().finally(() => prisma.$disconnect());
