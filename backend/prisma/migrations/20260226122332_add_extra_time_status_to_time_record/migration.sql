-- AlterTable
ALTER TABLE "time_records" ADD COLUMN     "extraTimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extraTimeStatus" "ShiftExtensionStatus" NOT NULL DEFAULT 'NONE';
