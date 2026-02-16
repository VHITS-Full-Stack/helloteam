import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  triggerInvoiceGeneration,
  deleteInvoice,
} from '../controllers/invoice.controller';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

// List all invoices
router.get('/', authenticate, authorize(...adminRoles), getInvoices);

// Get single invoice
router.get('/:invoiceId', authenticate, authorize(...adminRoles), getInvoiceById);

// Update invoice status
router.put('/:invoiceId/status', authenticate, authorize(...adminRoles), updateInvoiceStatus);

// Manual trigger: generate invoices for a period
router.post('/generate', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), triggerInvoiceGeneration);

// Delete a DRAFT invoice
router.delete('/:invoiceId', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), deleteInvoice);

export default router;
