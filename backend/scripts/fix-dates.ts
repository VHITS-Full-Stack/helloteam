import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDates() {
  try {
    // First, check all records
    const allRecords = await prisma.timeRecord.findMany({
      where: { actualStart: { not: null } },
      select: { id: true, date: true, actualStart: true, employeeId: true, clientId: true },
    });

    console.log(`Total records with actualStart: ${allRecords.length}`);

    let fixedCount = 0;
    let skippedConflicts = 0;
    let alreadyCorrect = 0;

    for (const record of allRecords) {
      if (!record.actualStart) continue;

      // Get the correct local date from actualStart
      const correctDate = new Date(Date.UTC(
        record.actualStart.getFullYear(),
        record.actualStart.getMonth(),
        record.actualStart.getDate()
      ));

      const currentDate = new Date(Date.UTC(
        record.date.getFullYear(),
        record.date.getMonth(),
        record.date.getDate()
      ));

      // Check if date already correct
      if (correctDate.getTime() === currentDate.getTime()) {
        alreadyCorrect++;
        continue;
      }

      console.log(`Record ${record.id}: date ${record.date.toISOString().split('T')[0]} -> ${correctDate.toISOString().split('T')[0]} (actualStart: ${record.actualStart.toISOString()})`);

      // Check for conflict
      const existing = await prisma.timeRecord.findUnique({
        where: {
          employeeId_clientId_date: {
            employeeId: record.employeeId,
            clientId: record.clientId,
            date: correctDate,
          },
        },
      });

      if (existing && existing.id !== record.id) {
        console.log(`  -> CONFLICT: Record ${existing.id} already exists for this date. Deleting wrong-date record.`);
        await prisma.timeRecord.delete({ where: { id: record.id } });
        skippedConflicts++;
        continue;
      }

      // Update the date
      await prisma.timeRecord.update({
        where: { id: record.id },
        data: { date: correctDate },
      });
      fixedCount++;
    }

    console.log(`\nDone!`);
    console.log(`  Already correct: ${alreadyCorrect}`);
    console.log(`  Fixed: ${fixedCount}`);
    console.log(`  Conflicts (deleted wrong-date duplicate): ${skippedConflicts}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDates();
