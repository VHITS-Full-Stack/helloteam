import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DOCUMENT_TYPES = [
  // Government ID types
  { name: 'Passport', category: 'GOVERNMENT_ID' },
  { name: 'Driving License', category: 'GOVERNMENT_ID' },
  { name: 'Identity Card', category: 'GOVERNMENT_ID' },

  // Proof of Address types
  { name: 'Utility Bill', category: 'PROOF_OF_ADDRESS' },
  { name: 'Bank Statement', category: 'PROOF_OF_ADDRESS' },
  { name: 'Phone Bill', category: 'PROOF_OF_ADDRESS' },
  { name: 'Internet Bill', category: 'PROOF_OF_ADDRESS' },
  { name: 'Tax Document', category: 'PROOF_OF_ADDRESS' },
  { name: 'Other Official Document', category: 'PROOF_OF_ADDRESS' },
];

async function seedDocumentTypes() {
  console.log('Seeding document types...');

  for (const docType of DEFAULT_DOCUMENT_TYPES) {
    await prisma.documentType.upsert({
      where: {
        name_category: { name: docType.name, category: docType.category },
      },
      update: {},
      create: docType,
    });
  }

  console.log(`Seeded ${DEFAULT_DOCUMENT_TYPES.length} document types.`);
}

seedDocumentTypes()
  .catch((e) => {
    console.error('Error seeding document types:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
