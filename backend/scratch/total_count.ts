import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const total = await prisma.timeRecord.count();
  const all = await prisma.$queryRaw`SELECT "isManual", count(*) FROM time_records GROUP BY "isManual"`;
  console.log({ total, all });
}
main().finally(() => prisma.$disconnect());
