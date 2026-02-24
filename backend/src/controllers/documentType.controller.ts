import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default document types to seed if table is empty
const DEFAULT_DOCUMENT_TYPES = [
  { name: 'Passport', category: 'GOVERNMENT_ID' },
  { name: 'Driving License', category: 'GOVERNMENT_ID' },
  { name: 'Identity Card', category: 'GOVERNMENT_ID' },
  { name: 'Utility Bill', category: 'PROOF_OF_ADDRESS' },
  { name: 'Bank Statement', category: 'PROOF_OF_ADDRESS' },
  { name: 'Phone Bill', category: 'PROOF_OF_ADDRESS' },
  { name: 'Internet Bill', category: 'PROOF_OF_ADDRESS' },
  { name: 'Tax Document', category: 'PROOF_OF_ADDRESS' },
  { name: 'Other Official Document', category: 'PROOF_OF_ADDRESS' },
];

// Auto-seed defaults if table is empty (runs once on first request)
let seeded = false;
const ensureSeeded = async () => {
  if (seeded) return;
  const count = await prisma.documentType.count();
  if (count === 0) {
    console.log('Seeding default document types...');
    await prisma.documentType.createMany({
      data: DEFAULT_DOCUMENT_TYPES,
      skipDuplicates: true,
    });
    console.log(`Seeded ${DEFAULT_DOCUMENT_TYPES.length} document types.`);
  }
  seeded = true;
};

// Get all document types (optionally filter by category and active status)
export const getDocumentTypes = async (req: Request, res: Response) => {
  try {
    await ensureSeeded();

    const { category, active } = req.query;

    const where: any = {};
    if (category) {
      where.category = category as string;
    }
    if (active === 'true') {
      where.isActive = true;
    } else if (active === 'false') {
      where.isActive = false;
    }

    const documentTypes = await prisma.documentType.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return res.json({
      success: true,
      data: documentTypes,
    });
  } catch (error) {
    console.error('Error fetching document types:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch document types',
    });
  }
};

// Create a new document type
export const createDocumentType = async (req: Request, res: Response) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Name and category are required',
      });
    }

    if (!['GOVERNMENT_ID', 'PROOF_OF_ADDRESS'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Category must be GOVERNMENT_ID or PROOF_OF_ADDRESS',
      });
    }

    // Check for duplicate
    const existing = await prisma.documentType.findUnique({
      where: { name_category: { name: name.trim(), category } },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A document type with this name already exists in this category',
      });
    }

    const documentType = await prisma.documentType.create({
      data: {
        name: name.trim(),
        category,
      },
    });

    return res.status(201).json({
      success: true,
      data: documentType,
      message: 'Document type created successfully',
    });
  } catch (error) {
    console.error('Error creating document type:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create document type',
    });
  }
};

// Update a document type
export const updateDocumentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const existing = await prisma.documentType.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Document type not found',
      });
    }

    // If renaming, check for duplicate
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.documentType.findUnique({
        where: { name_category: { name: name.trim(), category: existing.category } },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'A document type with this name already exists in this category',
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const documentType = await prisma.documentType.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      success: true,
      data: documentType,
      message: 'Document type updated successfully',
    });
  } catch (error) {
    console.error('Error updating document type:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update document type',
    });
  }
};

// Delete a document type (hard delete)
export const deleteDocumentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.documentType.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Document type not found',
      });
    }

    await prisma.documentType.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Document type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document type:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete document type',
    });
  }
};
