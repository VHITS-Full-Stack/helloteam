-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing contactPerson data into client_contacts
INSERT INTO "client_contacts" ("id", "clientId", "name", "isPrimary")
SELECT gen_random_uuid(), "id", "contactPerson", true
FROM "clients"
WHERE "contactPerson" IS NOT NULL AND "contactPerson" != '';
