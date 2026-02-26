-- CreateTable
CREATE TABLE "client_holidays" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "client_holidays_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_holidays" ADD CONSTRAINT "client_holidays_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
