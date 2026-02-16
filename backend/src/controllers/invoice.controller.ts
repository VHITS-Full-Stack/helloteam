import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { generateInvoicesForPeriod } from '../jobs/invoiceGeneration.job';

// ============================================
// ADMIN ENDPOINTS
// ============================================

// List all invoices with filtering and pagination
export const getInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status && status !== 'all') where.status = status.toUpperCase();

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          client: { select: { companyName: true, contactPerson: true } },
          lineItems: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
};

// Get single invoice by ID
export const getInvoiceById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          select: {
            companyName: true,
            contactPerson: true,
            address: true,
            phone: true,
            user: { select: { email: true } },
          },
        },
        lineItems: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Get invoice by ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
};

// Update invoice status (DRAFT -> SENT -> PAID / OVERDUE / CANCELLED)
export const updateInvoiceStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const { status, notes } = req.body;

    const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const updateData: any = { status: status.toUpperCase() };
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    res.json({
      success: true,
      message: `Invoice status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    console.error('Update invoice status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update invoice status' });
  }
};

// Manual trigger: generate invoices for a specific period
export const triggerInvoiceGeneration = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { year, month } = req.body;

    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'Valid year and month (1-12) are required' });
      return;
    }

    // Prevent generating invoices for future months (allow current month)
    const now = new Date();
    const requestedDate = new Date(year, month - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    if (requestedDate >= nextMonth) {
      res.status(400).json({ success: false, error: 'Cannot generate invoices for future months' });
      return;
    }

    const io = req.app.get('io');
    const result = await generateInvoicesForPeriod(year, month, io);

    res.json({
      success: true,
      message: `Invoice generation completed: ${result.generated} invoices generated`,
      data: result,
    });
  } catch (error) {
    console.error('Trigger invoice generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger invoice generation' });
  }
};

// Delete invoice (only DRAFT invoices)
export const deleteInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (invoice.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'Only DRAFT invoices can be deleted' });
      return;
    }

    await prisma.invoice.delete({ where: { id: invoiceId } });

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
};

// ============================================
// CLIENT ENDPOINTS
// ============================================

// Get invoices for the authenticated client
export const getClientInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const where: any = { clientId: client.id };
    if (status && status !== 'all') where.status = status.toUpperCase();

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get client invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
};

// Get single invoice for the authenticated client
export const getClientInvoiceById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const invoiceId = req.params.invoiceId as string;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, clientId: client.id },
      include: { lineItems: true },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Get client invoice by ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
};
