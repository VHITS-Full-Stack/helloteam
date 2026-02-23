import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  triggerInvoiceGeneration,
  previewInvoiceGeneration,
  deleteInvoice,
  downloadInvoicePdf,
} from '../controllers/invoice.controller';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

// List all invoices
router.get('/', authenticate, authorize(...adminRoles), getInvoices);

// Download invoice PDF (must be before /:invoiceId to avoid conflict)
router.get('/:invoiceId/pdf', authenticate, authorize(...adminRoles), downloadInvoicePdf);

// Get single invoice
router.get('/:invoiceId', authenticate, authorize(...adminRoles), getInvoiceById);

// Update invoice status
router.put('/:invoiceId/status', authenticate, authorize(...adminRoles), updateInvoiceStatus);

// Preview: dry-run invoice generation (must be before /generate to avoid conflict)
router.post('/generate/preview', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), previewInvoiceGeneration);

// Manual trigger: generate invoices for a period
router.post('/generate', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), triggerInvoiceGeneration);

// Delete a DRAFT invoice
router.delete('/:invoiceId', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), deleteInvoice);

export default router;
