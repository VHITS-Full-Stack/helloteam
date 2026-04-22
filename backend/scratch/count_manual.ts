import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const countTrue = await prisma.timeRecord.count({ where: { isManual: true } });
  const countFalse = await prisma.timeRecord.count({ where: { isManual: false } });
  const countNull = await prisma.$queryRaw`SELECT count(*) FROM time_records WHERE "isManual" IS NULL`;
  console.log({ countTrue, countFalse, countNull });
}
main().finally(() => prisma.$disconnect());
