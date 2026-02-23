import { Response } from 'express';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { generateInvoicesForPeriod, generateWeeklyInvoicesForWeek, previewInvoicesForPeriod, previewWeeklyInvoicesForWeek } from '../jobs/invoiceGeneration.job';

// ============================================
// PDF GENERATION HELPER
// ============================================

const formatCurrency = (amount: number | any): string => {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  return `$${num.toFixed(2)}`;
};

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatPeriod = (start: Date | string, end: Date | string): string => {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const drawLine = (page: PDFPage, x: number, y: number, width: number, color = rgb(0.85, 0.85, 0.85)) => {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 1, color });
};

const buildInvoicePdf = async (invoice: any): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Helper to add a new page and reset y position
  const addNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    // Add a subtle header on continuation pages
    page.drawText('HelloTeam', { x: margin, y, size: 14, font: fontBold, color: rgb(0.2, 0.4, 0.8) });
    page.drawText(`Invoice ${invoice.invoiceNumber} (continued)`, {
      x: margin + 80, y, size: 10, font, color: rgb(0.5, 0.5, 0.5),
    });
    y -= 15;
    drawLine(page, margin, y, contentWidth, rgb(0.2, 0.4, 0.8));
    y -= 25;
  };

  // --- Header ---
  page.drawText('HelloTeam', { x: margin, y, size: 24, font: fontBold, color: rgb(0.2, 0.4, 0.8) });
  page.drawText('INVOICE', { x: pageWidth - margin - fontBold.widthOfTextAtSize('INVOICE', 28), y, size: 28, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 15;
  drawLine(page, margin, y, contentWidth, rgb(0.2, 0.4, 0.8));
  y -= 25;

  // --- Invoice Info (left) + Status (right) ---
  const infoX = margin;
  const rightX = pageWidth - margin - 180;

  const drawInfoRow = (label: string, value: string, xPos: number, yPos: number) => {
    page.drawText(label, { x: xPos, y: yPos, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: xPos + 90, y: yPos, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
  };

  drawInfoRow('Invoice #:', invoice.invoiceNumber, infoX, y);
  drawInfoRow('Status:', invoice.status, rightX, y);
  y -= 16;
  drawInfoRow('Issue Date:', formatDate(invoice.createdAt), infoX, y);
  drawInfoRow('Due Date:', formatDate(invoice.dueDate), rightX, y);
  y -= 16;
  drawInfoRow('Period:', formatPeriod(invoice.periodStart, invoice.periodEnd), infoX, y);
  drawInfoRow('Currency:', invoice.currency || 'USD', rightX, y);
  y -= 30;

  // --- Bill To ---
  page.drawText('Bill To:', { x: margin, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 16;
  if (invoice.client?.companyName) {
    page.drawText(invoice.client.companyName, { x: margin, y, size: 11, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    y -= 14;
  }
  if (invoice.client?.contactPerson) {
    page.drawText(invoice.client.contactPerson, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
  }
  if (invoice.client?.address) {
    const addressLines = String(invoice.client.address).split('\n');
    for (const line of addressLines) {
      page.drawText(line.trim(), { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }
  }
  if (invoice.client?.user?.email) {
    page.drawText(invoice.client.user.email, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
  }
  y -= 15;

  // --- Line Items Table ---
  // Table columns: Employee | Hours | Rate | OT Hours | OT Rate | Amount
  const colX = [margin, margin + 160, margin + 225, margin + 295, margin + 370, margin + 440];
  const colLabels = ['Employee', 'Hours', 'Rate', 'OT Hours', 'OT Rate', 'Amount'];

  // Table header background
  page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.93, 0.93, 0.95) });

  // Table header text
  for (let i = 0; i < colLabels.length; i++) {
    const align = i === 0 ? colX[i] + 5 : colX[i];
    page.drawText(colLabels[i], { x: align, y: y, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  }
  y -= 22;

  // Table rows
  const lineItems = invoice.lineItems || [];
  for (let idx = 0; idx < lineItems.length; idx++) {
    const item = lineItems[idx];
    const hours = parseFloat(String(item.hours)) || 0;
    const rate = parseFloat(String(item.rate)) || 0;
    const otHours = parseFloat(String(item.overtimeHours)) || 0;
    const otRate = parseFloat(String(item.overtimeRate)) || 0;
    const amount = parseFloat(String(item.amount)) || 0;

    // Alternate row background
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 18, color: rgb(0.97, 0.97, 0.98) });
    }

    // Truncate employee name if too long
    let empName = item.employeeName || 'Unknown';
    if (fontBold.widthOfTextAtSize(empName, 9) > 150) {
      while (fontBold.widthOfTextAtSize(empName + '...', 9) > 150 && empName.length > 3) {
        empName = empName.slice(0, -1);
      }
      empName += '...';
    }

    page.drawText(empName, { x: colX[0] + 5, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(hours.toFixed(2), { x: colX[1], y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatCurrency(rate), { x: colX[2], y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(otHours.toFixed(2), { x: colX[3], y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatCurrency(otRate), { x: colX[4], y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatCurrency(amount), { x: colX[5], y, size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) });

    y -= 18;

    // Add new page if running out of space (reserve space for totals + footer)
    if (y < 120 && idx < lineItems.length - 1) {
      addNewPage();

      // Re-draw table header on new page
      page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.93, 0.93, 0.95) });
      for (let i = 0; i < colLabels.length; i++) {
        const align = i === 0 ? colX[i] + 5 : colX[i];
        page.drawText(colLabels[i], { x: align, y: y, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      }
      y -= 22;
    }
  }

  // Line below table
  drawLine(page, margin, y, contentWidth);
  y -= 25;

  // --- Totals ---
  const totalsX = pageWidth - margin - 180;
  const valuesX = pageWidth - margin - 60;

  const totalHours = parseFloat(String(invoice.totalHours)) || 0;
  const overtimeHours = parseFloat(String(invoice.overtimeHours)) || 0;
  const subtotal = parseFloat(String(invoice.subtotal)) || 0;
  const total = parseFloat(String(invoice.total)) || 0;

  page.drawText('Total Hours:', { x: totalsX, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(totalHours.toFixed(2), { x: valuesX, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
  y -= 16;

  if (overtimeHours > 0) {
    page.drawText('Overtime Hours:', { x: totalsX, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(overtimeHours.toFixed(2), { x: valuesX, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 16;
  }

  page.drawText('Subtotal:', { x: totalsX, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(formatCurrency(subtotal), { x: valuesX, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
  y -= 16;

  drawLine(page, totalsX, y + 6, 180);
  y -= 4;

  page.drawText('TOTAL:', { x: totalsX, y, size: 12, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(formatCurrency(total), { x: valuesX, y, size: 12, font: fontBold, color: rgb(0.2, 0.4, 0.8) });
  y -= 30;

  // --- Notes ---
  if (invoice.notes) {
    page.drawText('Notes:', { x: margin, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
    const noteLines = String(invoice.notes).split('\n');
    for (const line of noteLines) {
      page.drawText(line.trim(), { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }
    y -= 10;
  }

  // --- Footer ---
  const footerY = 40;
  drawLine(page, margin, footerY + 15, contentWidth, rgb(0.85, 0.85, 0.85));
  const thankYou = 'Thank you for your business!';
  const thankYouWidth = font.widthOfTextAtSize(thankYou, 9);
  page.drawText(thankYou, { x: (pageWidth - thankYouWidth) / 2, y: footerY, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  return await pdfDoc.save();
};

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

    // Build a base where clause without status for aggregate stats
    const baseWhere: any = {};
    if (clientId) baseWhere.clientId = clientId;

    const [invoices, total, aggregateStats] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          client: { select: { companyName: true, contactPerson: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      // Aggregate stats across ALL invoices (respecting client filter but not status/pagination)
      prisma.invoice.groupBy({
        by: ['status'],
        where: baseWhere,
        _sum: { total: true },
        _count: true,
      }),
    ]);

    // Compute stats from aggregate data
    const statsFromDb = {
      total: aggregateStats.reduce((sum, g) => sum + g._count, 0),
      draft: aggregateStats.find(g => g.status === 'DRAFT')?._count || 0,
      totalAmount: aggregateStats.reduce((sum, g) => sum + (Number(g._sum.total) || 0), 0),
      paidAmount: Number(aggregateStats.find(g => g.status === 'PAID')?._sum.total || 0),
    };

    res.json({
      success: true,
      data: {
        invoices,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: statsFromDb,
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

    // Enforce valid status transitions
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['PAID', 'OVERDUE', 'CANCELLED'],
      OVERDUE: ['PAID', 'CANCELLED'],
      PAID: [],       // Final state - no transitions allowed
      CANCELLED: [],  // Final state - no transitions allowed
    };

    const allowed = allowedTransitions[invoice.status] || [];
    if (!allowed.includes(status.toUpperCase())) {
      res.status(400).json({
        success: false,
        error: `Cannot change status from ${invoice.status} to ${status.toUpperCase()}. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (final state)'}`,
      });
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

// Preview: dry-run invoice generation to show what would be created
export const previewInvoiceGeneration = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { year, month, week, frequency = 'monthly' } = req.body;

    let preview;
    if (frequency === 'weekly') {
      if (!year || !week || week < 1 || week > 53) {
        res.status(400).json({ success: false, error: 'Valid year and week (1-53) are required' });
        return;
      }
      preview = await previewWeeklyInvoicesForWeek(year, week);
    } else {
      if (!year || !month || month < 1 || month > 12) {
        res.status(400).json({ success: false, error: 'Valid year and month (1-12) are required' });
        return;
      }
      preview = await previewInvoicesForPeriod(year, month);
    }

    res.json({
      success: true,
      data: {
        preview,
        summary: {
          clientCount: preview.length,
          totalEstimatedAmount: Math.round(preview.reduce((sum, p) => sum + p.estimatedTotal, 0) * 100) / 100,
          totalHours: Math.round(preview.reduce((sum, p) => sum + p.totalHours, 0) * 100) / 100,
          totalOvertimeHours: Math.round(preview.reduce((sum, p) => sum + p.overtimeHours, 0) * 100) / 100,
          totalLateOtRecords: preview.reduce((sum, p) => sum + p.lateOtRecords, 0),
        },
      },
    });
  } catch (error) {
    console.error('Preview invoice generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to preview invoice generation' });
  }
};

// Manual trigger: generate invoices for a specific period
// Supports both monthly (year + month) and weekly (year + week) frequency
export const triggerInvoiceGeneration = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { year, month, week, frequency = 'monthly' } = req.body;
    const io = req.app.get('io');

    if (frequency === 'weekly') {
      // Weekly invoice generation
      if (!year || !week || week < 1 || week > 53) {
        res.status(400).json({ success: false, error: 'Valid year and week (1-53) are required for weekly generation' });
        return;
      }

      // Prevent generating invoices for future weeks
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentWeek = getISOWeekNumber(now);
      if (year > currentYear || (year === currentYear && week > currentWeek)) {
        res.status(400).json({ success: false, error: 'Cannot generate invoices for future weeks' });
        return;
      }

      const result = await generateWeeklyInvoicesForWeek(year, week, io);

      res.json({
        success: true,
        message: `Weekly invoice generation completed: ${result.generated} invoices generated`,
        data: result,
      });
    } else {
      // Monthly invoice generation (default)
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

      const result = await generateInvoicesForPeriod(year, month, io);

      res.json({
        success: true,
        message: `Monthly invoice generation completed: ${result.generated} invoices generated`,
        data: result,
      });
    }
  } catch (error) {
    console.error('Trigger invoice generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger invoice generation' });
  }
};

// Helper: get ISO week number (duplicated here for controller use)
const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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

    // Release time records and delete invoice in a transaction
    await prisma.$transaction(async (tx) => {
      // Reset invoiceId on time records so they can be re-invoiced
      await tx.timeRecord.updateMany({
        where: { invoiceId },
        data: { invoiceId: null },
      });
      await tx.invoice.delete({ where: { id: invoiceId } });
    });

    res.json({ success: true, message: 'Invoice deleted. Time records released for re-invoicing.' });
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

// ============================================
// PDF DOWNLOAD ENDPOINTS
// ============================================

// Download invoice PDF (admin)
export const downloadInvoicePdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const pdfBytes = await buildInvoicePdf(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download invoice PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
  }
};

// Download invoice PDF (client - validates ownership)
export const downloadClientInvoicePdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const pdfBytes = await buildInvoicePdf(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download client invoice PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
  }
};
