import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const columns: any[] = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'time_records'`;
  console.log(columns.map(c => c.column_name));
}
main().finally(() => prisma.$disconnect());
