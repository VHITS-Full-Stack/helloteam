-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holidays_clientId_year_idx" ON "holidays"("clientId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_clientId_date_key" ON "holidays"("clientId", "date");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
