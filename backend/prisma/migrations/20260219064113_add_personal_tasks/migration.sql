-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "isPersonal" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "tasks_isPersonal_employeeId_idx" ON "tasks"("isPersonal", "employeeId");
