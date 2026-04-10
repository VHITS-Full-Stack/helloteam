import { Response } from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { generateInvoicesForPeriod, generateWeeklyInvoicesForWeek, generateBiWeeklyInvoicesForPeriod, previewInvoicesForPeriod, previewWeeklyInvoicesForWeek, previewBiWeeklyInvoicesForPeriod } from '../jobs/invoiceGeneration.job';
import { getISOWeekNumber } from '../utils/timezone';
import { sendInvoiceEmail } from '../services/email.service';
import { createNotification } from './notification.controller';

// ============================================
// PDF GENERATION HELPER
// ============================================


const buildInvoicePdf = async (
  invoice: any,
  companyInfo: { companyName: string; companyAddress: string } = {
    companyName: 'The Hello Team LLC',
    companyAddress: '422 Butterfly road Jackson NJ 08527',
  },
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.15, 0.15, 0.15);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Date formatter: MM/DD/YYYY
  const fmtDate = (d: Date | string): string => {
    const dt = new Date(d);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const yyyy = dt.getUTCFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  // Helper: draw bordered rectangle (outline only)
  const drawRect = (x: number, yBottom: number, w: number, h: number) => {
    page.drawRectangle({
      x, y: yBottom, width: w, height: h,
      borderColor: black, borderWidth: 0.5, color: rgb(1, 1, 1),
    });
  };

  // Helper: draw a horizontal line
  const hLine = (x: number, yPos: number, w: number) => {
    page.drawLine({ start: { x, y: yPos }, end: { x: x + w, y: yPos }, thickness: 0.5, color: black });
  };

  // Helper to add a new page
  const addNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  // ===== TOP SECTION =====
  // Company name + address (top-left)
  page.drawText(companyInfo.companyName, { x: margin, y, size: 11, font: fontBold, color: darkGray });
  y -= 14;
  page.drawText(companyInfo.companyAddress, { x: margin, y, size: 10, font, color: darkGray });

  // "I N V O I C E" (top-right, large spaced text)
  const invoiceTitle = 'I N V O I C E';
  const titleWidth = fontBold.widthOfTextAtSize(invoiceTitle, 22);
  page.drawText(invoiceTitle, {
    x: pageWidth - margin - titleWidth,
    y: pageHeight - margin,
    size: 22, font: fontBold, color: darkGray,
  });

  y -= 50;

  // ===== CLIENT INFO (left) + INVOICE META (right) =====
  const metaLabelX = pageWidth - margin - 190;
  const metaValueX = pageWidth - margin - 70;

  // Client name + address
  if (invoice.client?.companyName) {
    page.drawText(invoice.client.companyName, { x: margin, y, size: 10, font: fontBold, color: darkGray });
    y -= 14;
  }
  if (invoice.client?.address) {
    const addressLines = String(invoice.client.address).split('\n');
    for (const line of addressLines) {
      page.drawText(line.trim(), { x: margin, y, size: 10, font, color: darkGray });
      y -= 14;
    }
  }

  // Invoice meta (right-aligned) — draw at same Y level as client info start
  let metaY = (invoice.client?.companyName ? pageHeight - margin - 64 : y);

  // Invoice #
  page.drawText('Invoice #', { x: metaLabelX, y: metaY, size: 10, font: fontBold, color: darkGray });
  const invNumStr = invoice.invoiceNumber || '';
  const invNumWidth = font.widthOfTextAtSize(invNumStr, 10);
  page.drawText(invNumStr, { x: pageWidth - margin - invNumWidth, y: metaY, size: 10, font, color: darkGray });
  metaY -= 18;

  // Invoice Date
  page.drawText('Invoice Date', { x: metaLabelX, y: metaY, size: 10, font: fontBold, color: darkGray });
  const invDateStr = fmtDate(invoice.createdAt);
  const invDateWidth = font.widthOfTextAtSize(invDateStr, 10);
  page.drawText(invDateStr, { x: pageWidth - margin - invDateWidth, y: metaY, size: 10, font, color: darkGray });
  metaY -= 18;

  // Due Date
  page.drawText('Due Date', { x: metaLabelX, y: metaY, size: 10, font: fontBold, color: darkGray });
  const dueDateStr = fmtDate(invoice.dueDate);
  const dueDateWidth = font.widthOfTextAtSize(dueDateStr, 10);
  page.drawText(dueDateStr, { x: pageWidth - margin - dueDateWidth, y: metaY, size: 10, font, color: darkGray });

  // Move y below both sections
  y = Math.min(y, metaY) - 30;

  // ===== LINE ITEMS TABLE =====
  // Column positions: Item | Description | Unit Price | Quantity | Amount
  const col = {
    item: margin,
    desc: margin + 70,
    unitPrice: margin + 290,
    qty: margin + 380,
    amount: margin + 440,
  };
  const tableRight = margin + contentWidth;
  const rowHeight = 28;
  const headerHeight = 28;

  // Build line item rows from invoice data, grouped by groupName when present
  const lineItems = invoice.lineItems || [];
  const hasGroups = lineItems.some((li: any) => li.groupName);

  type TableEntry =
    | { type: 'group-header'; name: string }
    | { type: 'row'; item: string; desc: string; unitPrice: string; qty: string; amount: string }
    | { type: 'group-subtotal'; name: string; amount: string };

  const tableEntries: TableEntry[] = [];

  if (hasGroups) {
    // Group line items: grouped employees first (sorted by group name), ungrouped at bottom
    const grouped = new Map<string, typeof lineItems>();
    const ungrouped: typeof lineItems = [];

    for (const li of lineItems) {
      const gName = (li as any).groupName;
      if (gName) {
        if (!grouped.has(gName)) grouped.set(gName, []);
        grouped.get(gName)!.push(li);
      } else {
        ungrouped.push(li);
      }
    }

    const renderGroup = (groupName: string | null, items: typeof lineItems) => {
      if (groupName) tableEntries.push({ type: 'group-header', name: groupName });
      let groupTotal = 0;
      for (const li of items) {
        const hours = parseFloat(String(li.hours)) || 0;
        const rate = parseFloat(String(li.rate)) || 0;
        const otHours = parseFloat(String((li as any).overtimeHours)) || 0;
        const otRate = parseFloat(String((li as any).overtimeRate)) || 0;
        const empName = (li as any).employeeName || 'Unknown';
        if (hours > 0) {
          const amt = Math.round(hours * rate * 100) / 100;
          groupTotal += amt;
          tableEntries.push({ type: 'row', item: 'Hours', desc: empName, unitPrice: rate.toFixed(2), qty: hours.toFixed(2), amount: amt.toFixed(2) });
        }
        if (otHours > 0) {
          const amt = Math.round(otHours * otRate * 100) / 100;
          groupTotal += amt;
          tableEntries.push({ type: 'row', item: 'OT Hours', desc: empName, unitPrice: otRate.toFixed(2), qty: otHours.toFixed(2), amount: amt.toFixed(2) });
        }
      }
      if (groupName) tableEntries.push({ type: 'group-subtotal', name: groupName, amount: groupTotal.toFixed(2) });
    };

    for (const [gName, items] of grouped) renderGroup(gName, items);
    if (ungrouped.length > 0) renderGroup(null, ungrouped);
  } else {
    // Flat list — no group headers
    for (const li of lineItems) {
      const hours = parseFloat(String(li.hours)) || 0;
      const rate = parseFloat(String(li.rate)) || 0;
      const otHours = parseFloat(String((li as any).overtimeHours)) || 0;
      const otRate = parseFloat(String((li as any).overtimeRate)) || 0;
      const empName = (li as any).employeeName || 'Unknown';
      if (hours > 0) {
        const amt = Math.round(hours * rate * 100) / 100;
        tableEntries.push({ type: 'row', item: 'Hours', desc: empName, unitPrice: rate.toFixed(2), qty: hours.toFixed(2), amount: amt.toFixed(2) });
      }
      if (otHours > 0) {
        const amt = Math.round(otHours * otRate * 100) / 100;
        tableEntries.push({ type: 'row', item: 'OT Hours', desc: empName, unitPrice: otRate.toFixed(2), qty: otHours.toFixed(2), amount: amt.toFixed(2) });
      }
    }
  }

  // Helper: draw table column header row
  const drawTableHeader = (topY: number) => {
    drawRect(col.item, topY - headerHeight, contentWidth, headerHeight);
    const midY = topY - headerHeight / 2 + 4;
    page.drawText('Item', { x: col.item + 8, y: midY, size: 10, font: fontBold, color: darkGray });
    page.drawText('Description', { x: col.desc + 8, y: midY, size: 10, font: fontBold, color: darkGray });
    page.drawText('Unit Price', { x: col.unitPrice + 8, y: midY, size: 10, font: fontBold, color: darkGray });
    page.drawText('Quantity', { x: col.qty + 8, y: midY, size: 10, font: fontBold, color: darkGray });
    page.drawText('Amount', { x: col.amount + 8, y: midY, size: 10, font: fontBold, color: darkGray });
    for (const cx of [col.desc, col.unitPrice, col.qty, col.amount]) {
      page.drawLine({ start: { x: cx, y: topY }, end: { x: cx, y: topY - headerHeight }, thickness: 0.5, color: black });
    }
  };

  // Draw table header
  drawTableHeader(y);
  y -= headerHeight;

  // Draw entries
  for (let idx = 0; idx < tableEntries.length; idx++) {
    const entry = tableEntries[idx];

    // Check if we need a new page
    if (y - rowHeight < 180) {
      hLine(margin, y, contentWidth);
      addNewPage();
      drawTableHeader(y);
      y -= headerHeight;
    }

    if (entry.type === 'group-header') {
      // Gray full-width header for the group
      const rowTop = y;
      const rowBottom = rowTop - rowHeight;
      page.drawRectangle({ x: margin, y: rowBottom, width: contentWidth, height: rowHeight, color: rgb(0.92, 0.92, 0.92) });
      hLine(margin, rowTop, contentWidth);
      hLine(margin, rowBottom, contentWidth);
      page.drawLine({ start: { x: margin, y: rowTop }, end: { x: margin, y: rowBottom }, thickness: 0.5, color: black });
      page.drawLine({ start: { x: tableRight, y: rowTop }, end: { x: tableRight, y: rowBottom }, thickness: 0.5, color: black });
      page.drawText(entry.name, { x: col.item + 8, y: rowTop - rowHeight / 2 - 3, size: 10, font: fontBold, color: darkGray });
      y = rowBottom;
      continue;
    }

    if (entry.type === 'group-subtotal') {
      // Subtotal row — right-aligned bold amount
      const rowTop = y;
      const rowBottom = rowTop - rowHeight;
      hLine(margin, rowTop, contentWidth);
      hLine(margin, rowBottom, contentWidth);
      page.drawLine({ start: { x: margin, y: rowTop }, end: { x: margin, y: rowBottom }, thickness: 0.5, color: black });
      page.drawLine({ start: { x: tableRight, y: rowTop }, end: { x: tableRight, y: rowBottom }, thickness: 0.5, color: black });
      const subtotalLabel = `${entry.name} Subtotal`;
      const subtotalLabelW = fontBold.widthOfTextAtSize(subtotalLabel, 9);
      const amtW = fontBold.widthOfTextAtSize(entry.amount, 9);
      const midY2 = rowTop - rowHeight / 2 - 3;
      page.drawText(subtotalLabel, { x: col.amount - 8 - subtotalLabelW - 10, y: midY2, size: 9, font: fontBold, color: darkGray });
      page.drawText(entry.amount, { x: tableRight - 8 - amtW, y: midY2, size: 9, font: fontBold, color: darkGray });
      y = rowBottom;
      continue;
    }

    // Normal row
    const row = entry;
    const rowTop = y;
    const rowBottom = rowTop - rowHeight;
    page.drawLine({ start: { x: margin, y: rowTop }, end: { x: margin, y: rowBottom }, thickness: 0.5, color: black });
    page.drawLine({ start: { x: tableRight, y: rowTop }, end: { x: tableRight, y: rowBottom }, thickness: 0.5, color: black });
    hLine(margin, rowBottom, contentWidth);
    for (const cx of [col.desc, col.unitPrice, col.qty, col.amount]) {
      page.drawLine({ start: { x: cx, y: rowTop }, end: { x: cx, y: rowBottom }, thickness: 0.5, color: black });
    }

    const textY = rowTop - rowHeight / 2 - 3;
    page.drawText(row.item, { x: col.item + 8, y: textY, size: 10, font, color: darkGray });

    // Truncate description if needed
    let desc = row.desc;
    const maxDescWidth = col.unitPrice - col.desc - 16;
    if (font.widthOfTextAtSize(desc, 10) > maxDescWidth) {
      while (font.widthOfTextAtSize(desc + '...', 10) > maxDescWidth && desc.length > 3) {
        desc = desc.slice(0, -1);
      }
      desc += '...';
    }
    page.drawText(desc, { x: col.desc + 8, y: textY, size: 10, font, color: darkGray });

    // Right-align numbers in their cells
    const upWidth = font.widthOfTextAtSize(row.unitPrice, 10);
    page.drawText(row.unitPrice, { x: col.qty - 8 - upWidth, y: textY, size: 10, font, color: darkGray });

    const qtyWidth = font.widthOfTextAtSize(row.qty, 10);
    page.drawText(row.qty, { x: col.amount - 8 - qtyWidth, y: textY, size: 10, font, color: darkGray });

    const amtWidth = font.widthOfTextAtSize(row.amount, 10);
    page.drawText(row.amount, { x: tableRight - 8 - amtWidth, y: textY, size: 10, font, color: darkGray });

    y = rowBottom;
  }

  y -= 25;

  // ===== NOTES SECTION =====
  const periodStartStr = fmtDate(invoice.periodStart);
  const periodEndStr = fmtDate(invoice.periodEnd);

  // Build notes text
  const notesLines: string[] = [];
  notesLines.push(`The invoice covers the billing cycle from ${periodStartStr} to ${periodEndStr}.`);

  // Draw underlined "NOTES:"
  page.drawText('NOTES:', { x: margin, y, size: 10, font: fontBold, color: darkGray });
  const notesLabelWidth = fontBold.widthOfTextAtSize('NOTES:', 10);
  page.drawLine({
    start: { x: margin, y: y - 2 },
    end: { x: margin + notesLabelWidth, y: y - 2 },
    thickness: 0.5, color: darkGray,
  });
  y -= 4;

  // Notes content
  for (const line of notesLines) {
    y -= 14;
    page.drawText(line, { x: margin, y, size: 9, font, color: darkGray });
  }

  // Include any invoice-level notes (late OT etc.)
  if (invoice.notes) {
    const extraLines = String(invoice.notes).split('\n');
    for (const line of extraLines) {
      y -= 14;
      page.drawText(line.trim(), { x: margin, y, size: 9, font, color: darkGray });
    }
  }

  y -= 30;

  // ===== TOTALS SECTION (right-aligned, with borders) =====
  const subtotal = parseFloat(String(invoice.subtotal)) || 0;
  const total = parseFloat(String(invoice.total)) || 0;
  const amountPaid = invoice.status === 'PAID' ? total : 0;
  const balanceDue = total - amountPaid;

  const totalsLabelX = pageWidth - margin - 200;
  const totalsValueX = pageWidth - margin - 80;
  const totalsRight = pageWidth - margin;
  const totalsRowH = 22;

  const totalRows = [
    { label: 'Subtotal', value: subtotal.toFixed(2), bold: false },
    { label: 'Total', value: total.toFixed(2), bold: false },
    { label: 'Amount Paid', value: amountPaid.toFixed(2), bold: false },
    { label: 'Balance Due', value: `$${balanceDue.toFixed(2)}`, bold: true },
  ];

  // Draw totals table with borders
  const totalsTop = y;
  for (let i = 0; i < totalRows.length; i++) {
    const tr = totalRows[i];
    const rowTop = totalsTop - i * totalsRowH;
    const rowBot = rowTop - totalsRowH;

    // Borders
    drawRect(totalsLabelX, rowBot, totalsRight - totalsLabelX, totalsRowH);
    // Vertical divider between label and value
    page.drawLine({
      start: { x: totalsValueX, y: rowTop },
      end: { x: totalsValueX, y: rowBot },
      thickness: 0.5, color: black,
    });

    const textY = rowTop - totalsRowH / 2 - 3;
    const useFont = tr.bold ? fontBold : font;
    page.drawText(tr.label, { x: totalsLabelX + 10, y: textY, size: 10, font: fontBold, color: darkGray });

    const valWidth = useFont.widthOfTextAtSize(tr.value, 10);
    page.drawText(tr.value, { x: totalsRight - 10 - valWidth, y: textY, size: 10, font: useFont, color: darkGray });
  }

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
    const month = req.query.month as string | undefined; // "YYYY-MM" format
    const year = req.query.year as string | undefined; // "YYYY" format
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status && status !== 'all') where.status = status.toUpperCase();
    if (startDate && endDate) {
      // Find invoices whose billing period falls within the selected date range
      // Use UTC to avoid timezone shifts with @db.Date fields
      const [sy, sm, sday] = startDate.split('-').map(Number);
      const [ey, em, eday] = endDate.split('-').map(Number);
      const sd = new Date(Date.UTC(sy, sm - 1, sday));
      const ed = new Date(Date.UTC(ey, em - 1, eday + 1)); // +1 to make end inclusive
      where.periodStart = { gte: sd };
      where.periodEnd = { lt: ed };
    } else if (month && month !== 'all') {
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        where.periodStart = {
          gte: new Date(Date.UTC(y, m - 1, 1)),
          lt: new Date(Date.UTC(y, m, 1)),
        };
      }
    } else if (year && year !== 'all') {
      const y = parseInt(year, 10);
      if (y) {
        where.periodStart = {
          gte: new Date(Date.UTC(y, 0, 1)),
          lt: new Date(Date.UTC(y + 1, 0, 1)),
        };
      }
    }

    // Build a base where clause without status for aggregate stats
    const baseWhere: any = {};
    if (clientId) baseWhere.clientId = clientId;
    if (where.periodStart) baseWhere.periodStart = where.periodStart;
    if (where.periodEnd) baseWhere.periodEnd = where.periodEnd;

    const [invoices, total, aggregateStats] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          client: { select: { companyName: true, contactPerson: true } },
          lineItems: { select: { rate: true } },
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
        _sum: { total: true, totalHours: true, overtimeHours: true },
        _count: true,
      }),
    ]);

    // Compute stats from aggregate data
    const statsFromDb = {
      total: aggregateStats.reduce((sum, g) => sum + g._count, 0),
      draft: aggregateStats.find(g => g.status === 'DRAFT')?._count || 0,
      totalAmount: aggregateStats.reduce((sum, g) => sum + (Number(g._sum.total) || 0), 0),
      paidAmount: Number(aggregateStats.find(g => g.status === 'PAID')?._sum.total || 0),
      totalHours: aggregateStats.reduce((sum, g) => sum + (Number(g._sum.totalHours) || 0), 0),
      totalOvertimeHours: aggregateStats.reduce((sum, g) => sum + (Number(g._sum.overtimeHours) || 0), 0),
    };

    // Convert Prisma Decimal fields to plain numbers
    const formattedInvoices = invoices.map((inv) => ({
      ...inv,
      totalHours: Number(inv.totalHours),
      overtimeHours: Number(inv.overtimeHours),
      subtotal: Number(inv.subtotal),
      total: Number(inv.total),
      lineItems: inv.lineItems.map((li) => ({
        ...li,
        rate: Number(li.rate),
      })),
    }));

    res.json({
      success: true,
      data: {
        invoices: formattedInvoices,
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

    const rawInvoice = await prisma.invoice.findUnique({
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
        lineItems: { orderBy: [{ groupName: 'asc' }, { employeeName: 'asc' }] },
      },
    });

    if (!rawInvoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Convert Prisma Decimal fields to plain numbers
    const invoice = {
      ...rawInvoice,
      totalHours: Number(rawInvoice.totalHours),
      overtimeHours: Number(rawInvoice.overtimeHours),
      subtotal: Number(rawInvoice.subtotal),
      total: Number(rawInvoice.total),
      lineItems: rawInvoice.lineItems.map((li) => ({
        ...li,
        hours: Number(li.hours),
        overtimeHours: Number(li.overtimeHours),
        rate: Number(li.rate),
        overtimeRate: Number(li.overtimeRate),
        amount: Number(li.amount),
      })),
    };

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

    // When marking as SENT: email PDF to client, send notification, emit socket event
    if (status.toUpperCase() === 'SENT') {
      try {
        // Fetch full invoice with client and line items for PDF generation
        const fullInvoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            client: {
              select: {
                companyName: true,
                contactPerson: true,
                address: true,
                phone: true,
                userId: true,
                user: { select: { id: true, email: true } },
              },
            },
            lineItems: true,
          },
        });

        if (fullInvoice?.client?.user?.email) {
          // Fetch company settings for PDF
          const companySettings = await prisma.systemSettings.findMany({
            where: { category: 'general', key: { in: ['companyName', 'companyAddress'] } },
          });
          const companyInfo = {
            companyName: 'The Hello Team LLC',
            companyAddress: '422 Butterfly road Jackson NJ 08527',
          };
          for (const s of companySettings) {
            try {
              const val = JSON.parse(s.value);
              if (s.key === 'companyName') companyInfo.companyName = val;
              if (s.key === 'companyAddress') companyInfo.companyAddress = val;
            } catch {
              if (s.key === 'companyName') companyInfo.companyName = s.value;
              if (s.key === 'companyAddress') companyInfo.companyAddress = s.value;
            }
          }

          // Generate PDF
          const pdfBytes = await buildInvoicePdf(fullInvoice, companyInfo);
          const pdfBuffer = Buffer.from(pdfBytes);

          // Format period and due date for email
          const fmtDate = (d: Date | string) => {
            const dt = new Date(d);
            const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(dt.getUTCDate()).padStart(2, '0');
            const yyyy = dt.getUTCFullYear();
            return `${mm}/${dd}/${yyyy}`;
          };
          const periodLabel = `${fmtDate(fullInvoice.periodStart)} - ${fmtDate(fullInvoice.periodEnd)}`;
          const totalFormatted = `$${parseFloat(String(fullInvoice.total)).toFixed(2)}`;
          const dueDate = fmtDate(fullInvoice.dueDate);

          // Send email with PDF attachment
          await sendInvoiceEmail(
            fullInvoice.client.user.email,
            fullInvoice.client.contactPerson || fullInvoice.client.companyName,
            fullInvoice.invoiceNumber,
            periodLabel,
            totalFormatted,
            dueDate,
            pdfBuffer
          );

          // Create in-app notification
          const clientUserId = fullInvoice.client.user.id;
          await createNotification(
            clientUserId,
            'INVOICE_GENERATED',
            'Invoice Sent',
            `Invoice ${fullInvoice.invoiceNumber} for ${periodLabel} (${totalFormatted}) is ready. Due: ${dueDate}.`,
            { invoiceId: fullInvoice.id },
            '/client/billing'
          );

          // Emit real-time socket event
          const io = req.app.get('io');
          if (io) {
            io.emit(`notification:${clientUserId}`, {
              type: 'INVOICE_GENERATED',
              message: `Invoice ${fullInvoice.invoiceNumber} has been sent to you.`,
            });
          }
        }
      } catch (sendErr) {
        // Log but don't fail the status update — invoice is already marked as SENT
        console.error('Failed to send invoice email/notification:', sendErr);
      }
    }

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
    const { year, month, week, half, frequency = 'monthly', clientId, invoiceByGroup } = req.body;
    const invoiceByGroupOverride = invoiceByGroup === true ? true : invoiceByGroup === false ? false : undefined;

    let preview;
    if (frequency === 'weekly') {
      if (!year || !week || week < 1 || week > 53) {
        res.status(400).json({ success: false, error: 'Valid year and week (1-53) are required' });
        return;
      }
      preview = await previewWeeklyInvoicesForWeek(year, week, clientId, invoiceByGroupOverride);
    } else if (frequency === 'bi-weekly') {
      if (!year || !month || month < 1 || month > 12 || !half || (half !== 1 && half !== 2)) {
        res.status(400).json({ success: false, error: 'Valid year, month (1-12), and half (1 or 2) are required' });
        return;
      }
      preview = await previewBiWeeklyInvoicesForPeriod(year, month, half as 1 | 2, clientId, invoiceByGroupOverride);
    } else {
      if (!year || !month || month < 1 || month > 12) {
        res.status(400).json({ success: false, error: 'Valid year and month (1-12) are required' });
        return;
      }
      preview = await previewInvoicesForPeriod(year, month, clientId, invoiceByGroupOverride);
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
    const { year, month, week, half, frequency = 'monthly', clientId, invoiceByGroup } = req.body;
    const io = req.app.get('io');
    const invoiceByGroupOverride = invoiceByGroup === true ? true : invoiceByGroup === false ? false : undefined;

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

      const result = await generateWeeklyInvoicesForWeek(year, week, io, clientId, false, invoiceByGroupOverride);

      res.json({
        success: true,
        message: `Weekly invoice generation completed: ${result.generated} invoices generated`,
        data: result,
      });
    } else if (frequency === 'bi-weekly') {
      // Bi-weekly invoice generation (half-month periods)
      if (!year || !month || month < 1 || month > 12 || !half || (half !== 1 && half !== 2)) {
        res.status(400).json({ success: false, error: 'Valid year, month (1-12), and half (1 or 2) are required for bi-weekly generation' });
        return;
      }

      const now = new Date();
      const requestedDate = new Date(year, month - 1, half === 1 ? 1 : 16);
      if (requestedDate > now) {
        res.status(400).json({ success: false, error: 'Cannot generate invoices for future periods' });
        return;
      }

      const result = await generateBiWeeklyInvoicesForPeriod(year, month, half as 1 | 2, io, clientId, false, invoiceByGroupOverride);

      res.json({
        success: true,
        message: `Bi-weekly invoice generation completed: ${result.generated} invoices generated`,
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

      const result = await generateInvoicesForPeriod(year, month, io, clientId, false, invoiceByGroupOverride);

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
      const released = await tx.timeRecord.updateMany({
        where: { invoiceId: invoiceId },
        data: { invoiceId: null },
      });
      console.log(`[Invoice Delete] Released ${released.count} time records for invoice ${invoiceId} (${invoice.invoiceNumber})`);

      // Delete line items (cascade should handle this, but be explicit)
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: invoiceId } });

      await tx.invoice.delete({ where: { id: invoiceId } });
    });

    // Double-check: clear any remaining references (safety net)
    await prisma.timeRecord.updateMany({
      where: { invoiceId: invoiceId },
      data: { invoiceId: null },
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
      include: {
        lineItems: { orderBy: [{ groupName: 'asc' }, { employeeName: 'asc' }] },
      },
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

// Client marks invoice as paid
export const clientMarkInvoicePaid = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'PAID' || invoice.status === 'CLIENT_PAID') {
      res.status(400).json({ success: false, error: 'Invoice is already marked as paid' });
      return;
    }

    if (invoice.status !== 'SENT' && invoice.status !== 'OVERDUE') {
      res.status(400).json({ success: false, error: 'Invoice cannot be paid in its current status' });
      return;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CLIENT_PAID',
        clientPaidAt: new Date(),
        clientPaidBy: userId,
      },
    });

    res.json({
      success: true,
      message: 'Invoice marked as paid. Awaiting admin confirmation.',
      data: updated,
    });
  } catch (error) {
    console.error('Client mark invoice paid error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark invoice as paid' });
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
        lineItems: { orderBy: [{ groupName: 'asc' }, { employeeName: 'asc' }] },
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Fetch company settings
    const companySettings = await prisma.systemSettings.findMany({
      where: { category: 'general', key: { in: ['companyName', 'companyAddress'] } },
    });
    const companyInfo = {
      companyName: 'The Hello Team LLC',
      companyAddress: '422 Butterfly road Jackson NJ 08527',
    };
    for (const s of companySettings) {
      try {
        const val = JSON.parse(s.value);
        if (s.key === 'companyName') companyInfo.companyName = val;
        if (s.key === 'companyAddress') companyInfo.companyAddress = val;
      } catch {
        if (s.key === 'companyName') companyInfo.companyName = s.value;
        if (s.key === 'companyAddress') companyInfo.companyAddress = s.value;
      }
    }

    const pdfBytes = await buildInvoicePdf(invoice, companyInfo);

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
            clientPolicies: { select: { invoiceByGroup: true } },
          },
        },
        lineItems: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Fetch company settings
    const companySettings = await prisma.systemSettings.findMany({
      where: { category: 'general', key: { in: ['companyName', 'companyAddress'] } },
    });
    const companyInfo = {
      companyName: 'The Hello Team LLC',
      companyAddress: '422 Butterfly road Jackson NJ 08527',
    };
    for (const s of companySettings) {
      try {
        const val = JSON.parse(s.value);
        if (s.key === 'companyName') companyInfo.companyName = val;
        if (s.key === 'companyAddress') companyInfo.companyAddress = val;
      } catch {
        if (s.key === 'companyName') companyInfo.companyName = s.value;
        if (s.key === 'companyAddress') companyInfo.companyAddress = s.value;
      }
    }

    const pdfBytes = await buildInvoicePdf(invoice, companyInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download client invoice PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
  }
};
