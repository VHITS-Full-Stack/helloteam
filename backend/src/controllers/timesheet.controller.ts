import { Response } from 'express';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { getTimezoneAbbr, formatTimeInTz, getDateKeyInTz, getDateKeyFromDateField, formatLongDate } from '../utils/timezone';

/** Format date as MM/DD/YYYY */
const fmtDate = (d: Date | string): string => {
  const dt = new Date(d);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

// ============================================
// TYPES
// ============================================

interface TimesheetSessionEntry {
  clockIn: string;   // e.g. "9:00am (EST)"
  clockOut: string;   // e.g. "5:00pm (EST)"
  duration: number;   // hours, e.g. 8.00
  customer: string;   // client company name
}

interface TimesheetDay {
  dateKey: string;             // "YYYY-MM-DD"
  displayDate: string;         // "January 12, 2026"
  dailyTotal: number;           // hours (regular + OT)
  dailyOT: number;              // overtime hours for the day
  sessions: TimesheetSessionEntry[];
}

interface TimesheetEmployeeData {
  fullName: string;
  regularHours: number;
  overtimeHours: number;
  ptoHours: number;
  totalHours: number;
  days: TimesheetDay[];
}

// ============================================
// PDF BUILDER
// ============================================

const buildTimesheetPdf = async (
  employees: TimesheetEmployeeData[],
  periodStart: Date,
  periodEnd: Date,
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const darkGray = rgb(0.15, 0.15, 0.15);
  const lightGray = rgb(0.92, 0.92, 0.92);
  const black = rgb(0, 0, 0);

  // Column positions for the timesheet table
  const col = {
    timeIn: margin,
    timeOut: margin + 130,
    duration: margin + 275,
    customer: margin + 355,
    dailyTotal: pageWidth - margin,
  };

  const headerRowHeight = 18;
  const dataRowHeight = 16;
  const footerReserve = 50; // space reserved at bottom for footer

  // Track all pages for footer rendering
  const allPages: PDFPage[] = [];

  const addNewPage = (): PDFPage => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    allPages.push(page);
    return page;
  };

  const drawColumnHeaders = (page: PDFPage, y: number): number => {
    // Column header text
    page.drawText('Time in', { x: col.timeIn, y, size: 9, font: fontBold, color: darkGray });
    page.drawText('Time out', { x: col.timeOut, y, size: 9, font: fontBold, color: darkGray });
    page.drawText('Duration', { x: col.duration, y, size: 9, font: fontBold, color: darkGray });
    page.drawText('Customer', { x: col.customer, y, size: 9, font: fontBold, color: darkGray });
    y -= 4;
    // Separator line
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.75,
      color: darkGray,
    });
    return y - 14;
  };

  // ===== DRAW EACH EMPLOYEE =====
  for (const emp of employees) {
    let page = addNewPage();
    let y = pageHeight - margin;

    // 1. Employee name (large, bold)
    page.drawText(emp.fullName, { x: margin, y, size: 16, font: fontBold, color: darkGray });
    y -= 18;

    // 2. Date range
    const periodStr = `${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`;
    page.drawText(periodStr, { x: margin, y, size: 10, font, color: darkGray });
    y -= 28;

    // 3. Summary: Regular | Overtime | PTO | Total Hours (right-aligned)
    const summaryLabels = emp.overtimeHours > 0
      ? ['Regular', 'Overtime', 'PTO', 'Total Hours']
      : ['Regular', 'PTO', 'Total Hours'];
    const summaryValues = emp.overtimeHours > 0
      ? [emp.regularHours.toFixed(2), emp.overtimeHours.toFixed(2), emp.ptoHours.toFixed(2), emp.totalHours.toFixed(2)]
      : [emp.regularHours.toFixed(2), emp.ptoHours.toFixed(2), emp.totalHours.toFixed(2)];
    const summaryColors = emp.overtimeHours > 0
      ? [darkGray, rgb(0.8, 0.4, 0), darkGray, darkGray]
      : [darkGray, darkGray, darkGray];

    // Calculate positions for right-aligned summary
    const colWidths = emp.overtimeHours > 0
      ? [65, 65, 50, 80]
      : [70, 60, 80];
    const summaryRight = pageWidth - margin;
    let sx = summaryRight;

    // Draw labels row
    for (let i = summaryLabels.length - 1; i >= 0; i--) {
      const labelWidth = fontBold.widthOfTextAtSize(summaryLabels[i], 9);
      const colCenter = sx - colWidths[i] / 2;
      page.drawText(summaryLabels[i], {
        x: colCenter - labelWidth / 2,
        y,
        size: 9,
        font: fontBold,
        color: summaryColors[i],
      });
      sx -= colWidths[i];
    }
    y -= 16;

    // Draw values row (bold, larger)
    sx = summaryRight;
    for (let i = summaryValues.length - 1; i >= 0; i--) {
      const valWidth = fontBold.widthOfTextAtSize(summaryValues[i], 14);
      const colCenter = sx - colWidths[i] / 2;
      page.drawText(summaryValues[i], {
        x: colCenter - valWidth / 2,
        y,
        size: 14,
        font: fontBold,
        color: summaryColors[i],
      });
      sx -= colWidths[i];
    }
    y -= 30;

    // 4. Column headers
    y = drawColumnHeaders(page, y);

    // 5. Daily entries
    for (const day of emp.days) {
      // Check if we need a new page (need space for date header + at least 1 row + footer)
      const neededSpace = headerRowHeight + dataRowHeight + footerReserve + 10;
      if (y < margin + neededSpace) {
        page = addNewPage();
        y = pageHeight - margin;
        y = drawColumnHeaders(page, y);
      }

      // Date header row (bold) with daily total right-aligned
      page.drawText(day.displayDate, {
        x: col.timeIn,
        y,
        size: 10,
        font: fontBold,
        color: darkGray,
      });

      // Daily total right-aligned
      const dailyTotalStr = day.dailyTotal.toFixed(2);
      const dailyTotalWidth = fontBold.widthOfTextAtSize(dailyTotalStr, 10);
      page.drawText(dailyTotalStr, {
        x: col.dailyTotal - dailyTotalWidth,
        y,
        size: 10,
        font: fontBold,
        color: darkGray,
      });
      y -= headerRowHeight;

      // Session rows
      for (const session of day.sessions) {
        // Check for page overflow
        if (y < margin + footerReserve + 10) {
          page = addNewPage();
          y = pageHeight - margin;
          y = drawColumnHeaders(page, y);
        }

        page.drawText(session.clockIn, { x: col.timeIn, y, size: 9, font, color: darkGray });
        page.drawText(session.clockOut, { x: col.timeOut, y, size: 9, font, color: darkGray });
        page.drawText(session.duration.toFixed(2), { x: col.duration, y, size: 9, font, color: darkGray });
        page.drawText(session.customer, { x: col.customer, y, size: 9, font, color: darkGray });

        y -= dataRowHeight;
      }

      // Show overtime row if this day has OT
      if (day.dailyOT > 0) {
        if (y < margin + footerReserve + 10) {
          page = addNewPage();
          y = pageHeight - margin;
          y = drawColumnHeaders(page, y);
        }
        const otColor = rgb(0.8, 0.4, 0); // orange for OT
        page.drawText('Overtime:', { x: col.timeIn + 10, y, size: 9, font: fontBold, color: otColor });
        page.drawText(day.dailyOT.toFixed(2), { x: col.duration, y, size: 9, font: fontBold, color: otColor });
        y -= dataRowHeight;
      }

      // Spacing between days
      y -= 4;
    }
  }

  // ===== FOOTER: Draw on every page =====
  const totalPages = allPages.length;
  const generatedDate = fmtDate(new Date());
  const generatedText = `Generated for The Hello Team`;

  for (let i = 0; i < totalPages; i++) {
    const p = allPages[i];
    const footerY = 30;

    p.drawText(generatedText, {
      x: margin,
      y: footerY,
      size: 8,
      font,
      color: darkGray,
    });

    // Date in the middle
    const dateWidth = font.widthOfTextAtSize(generatedDate, 8);
    p.drawText(generatedDate, {
      x: (pageWidth - dateWidth) / 2,
      y: footerY,
      size: 8,
      font,
      color: darkGray,
    });

    // Page number right-aligned
    const pageNumText = `${i + 1}/${totalPages}`;
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, 8);
    p.drawText(pageNumText, {
      x: pageWidth - margin - pageNumWidth,
      y: footerY,
      size: 8,
      font,
      color: darkGray,
    });
  }

  return await pdfDoc.save();
};

// ============================================
// DATA FETCHING + ENDPOINT
// ============================================

/**
 * Download timesheet PDF for a given invoice.
 * Uses TimeRecords (primary, guaranteed to exist for invoiced periods) and
 * WorkSessions (for actual clock-in/out times).
 */
export const downloadTimesheetForInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;

    // 1. Fetch invoice with client and line items
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          select: { id: true, companyName: true, timezone: true },
        },
        lineItems: {
          select: { employeeId: true, employeeName: true, hours: true, overtimeHours: true },
        },
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const clientTz = invoice.client.timezone || 'UTC';
    const clientName = invoice.client.companyName;
    const periodStart = invoice.periodStart;
    const periodEnd = invoice.periodEnd;

    // Get unique employee IDs from line items
    const employeeIds = [...new Set(invoice.lineItems.map((li) => li.employeeId))];
    const empNameMap = new Map<string, string>();
    for (const li of invoice.lineItems) {
      if (!empNameMap.has(li.employeeId)) {
        empNameMap.set(li.employeeId, li.employeeName);
      }
    }

    if (employeeIds.length === 0) {
      res.status(400).json({ success: false, error: 'No employees found for this invoice' });
      return;
    }

    // 2. Fetch TimeRecords: linked to this invoice + by date range (covers all employees)
    const [linkedRecords, dateRangeRecords] = await Promise.all([
      prisma.timeRecord.findMany({
        where: {
          invoiceId: invoice.id,
          employeeId: { in: employeeIds },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.timeRecord.findMany({
        where: {
          clientId: invoice.client.id,
          employeeId: { in: employeeIds },
          date: { gte: periodStart, lte: periodEnd },
          status: { in: ['APPROVED', 'AUTO_APPROVED'] },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Merge both sets, deduplicate by ID
    const recordMap = new Map<string, typeof linkedRecords[0]>();
    for (const r of [...linkedRecords, ...dateRangeRecords]) {
      recordMap.set(r.id, r);
    }
    const records = [...recordMap.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

    // 3. Fetch WorkSessions for clock-in/out details in the period
    // Expand date range slightly to capture timezone edge cases
    const sessionSearchStart = new Date(periodStart);
    sessionSearchStart.setUTCDate(sessionSearchStart.getUTCDate() - 1);
    const sessionSearchEnd = new Date(periodEnd);
    sessionSearchEnd.setUTCDate(sessionSearchEnd.getUTCDate() + 2);

    const workSessions = await prisma.workSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        startTime: { gte: sessionSearchStart, lt: sessionSearchEnd },
        status: 'COMPLETED',
      },
      orderBy: { startTime: 'asc' },
    });

    // 4. Fetch approved paid leave requests overlapping the period
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        clientId: invoice.client.id,
        leaveType: 'PAID',
        status: { in: ['APPROVED', 'APPROVED_BY_CLIENT'] },
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
    });

    // 5. Build all dates in the period
    const allDateKeys: string[] = [];
    const cursor = new Date(periodStart);
    while (cursor <= periodEnd) {
      const dk = getDateKeyFromDateField(cursor);
      if (!allDateKeys.includes(dk)) {
        allDateKeys.push(dk);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    // Also include dates from actual records (covers late-approved OT from previous periods)
    for (const rec of records) {
      const dk = getDateKeyFromDateField(rec.date);
      if (!allDateKeys.includes(dk)) {
        allDateKeys.push(dk);
      }
    }
    allDateKeys.sort();

    // 6. Group WorkSessions by employee → day (for clock-in/out display)
    const sessionsByEmp = new Map<string, Map<string, typeof workSessions>>();
    for (const session of workSessions) {
      const empId = session.employeeId;
      if (!sessionsByEmp.has(empId)) {
        sessionsByEmp.set(empId, new Map());
      }
      const dayKey = getDateKeyInTz(session.startTime, clientTz);
      const dayMap = sessionsByEmp.get(empId)!;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, []);
      }
      dayMap.get(dayKey)!.push(session);
    }

    // 7. Group TimeRecords by employee → day (for daily hours)
    const recordsByEmp = new Map<string, Map<string, typeof records[0]>>();
    for (const rec of records) {
      const empId = rec.employeeId;
      if (!recordsByEmp.has(empId)) {
        recordsByEmp.set(empId, new Map());
      }
      const dk = getDateKeyFromDateField(rec.date);
      recordsByEmp.get(empId)!.set(dk, rec);
    }

    // 8. PTO days per employee
    const ptoDaysByEmp = new Map<string, Set<string>>();
    for (const leave of leaveRequests) {
      if (!ptoDaysByEmp.has(leave.employeeId)) {
        ptoDaysByEmp.set(leave.employeeId, new Set());
      }
      const ptoSet = ptoDaysByEmp.get(leave.employeeId)!;
      const leaveCursor = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      while (leaveCursor <= leaveEnd) {
        const dk = getDateKeyFromDateField(leaveCursor);
        if (allDateKeys.includes(dk)) {
          ptoSet.add(dk);
        }
        leaveCursor.setUTCDate(leaveCursor.getUTCDate() + 1);
      }
    }

    // 9. Build employee hours from invoice lineItems (source of truth matching invoice totals)
    const empInvoiceHours = new Map<string, { regular: number; overtime: number }>();
    for (const li of invoice.lineItems) {
      const existing = empInvoiceHours.get(li.employeeId) || { regular: 0, overtime: 0 };
      existing.regular += parseFloat(String(li.hours)) || 0;
      existing.overtime += parseFloat(String(li.overtimeHours)) || 0;
      empInvoiceHours.set(li.employeeId, existing);
    }

    // 10. Build per-employee timesheet data
    const employeeData: TimesheetEmployeeData[] = [];

    for (const empId of employeeIds) {
      const fullName = empNameMap.get(empId) || 'Unknown';
      const empSessions = sessionsByEmp.get(empId) || new Map();
      const empRecords = recordsByEmp.get(empId) || new Map();
      const ptoDays = ptoDaysByEmp.get(empId) || new Set();

      const ptoHours = ptoDays.size * 8;
      const days: TimesheetDay[] = [];

      for (const dateKey of allDateKeys) {
        const sessionsForDay = empSessions.get(dateKey) || [];
        const timeRecord = empRecords.get(dateKey);
        const hasPto = ptoDays.has(dateKey);

        // Skip days with nothing to show
        if (sessionsForDay.length === 0 && !timeRecord && !hasPto) {
          continue;
        }

        const displayDate = formatLongDate(dateKey, clientTz);
        const sessionEntries: TimesheetSessionEntry[] = [];

        // Daily total and OT from TimeRecord (source of truth, matches invoice)
        let dailyTotal = 0;
        let dailyOT = 0;
        if (timeRecord) {
          dailyTotal = Math.round((timeRecord.totalMinutes / 60) * 100) / 100;
          dailyOT = Math.round(((timeRecord.overtimeMinutes || 0) / 60) * 100) / 100;
        }

        if (sessionsForDay.length > 0) {
          // Use WorkSession clock-in/out times for display
          for (const sess of sessionsForDay) {
            if (!sess.endTime) continue;
            const durationMinutes =
              (sess.endTime.getTime() - sess.startTime.getTime()) / 60000 -
              (sess.totalBreakMinutes || 0);
            const durationHours = Math.round((durationMinutes / 60) * 100) / 100;

            sessionEntries.push({
              clockIn: formatTimeInTz(sess.startTime, clientTz),
              clockOut: formatTimeInTz(sess.endTime, clientTz),
              duration: durationHours,
              customer: clientName,
            });
          }
          // If no TimeRecord, sum session durations as fallback
          if (!timeRecord) {
            dailyTotal = sessionEntries.reduce((sum, s) => sum + s.duration, 0);
          }
        } else if (timeRecord) {
          // No WorkSessions — use TimeRecord timestamps for display
          if (timeRecord.actualStart && timeRecord.actualEnd) {
            sessionEntries.push({
              clockIn: formatTimeInTz(timeRecord.actualStart, clientTz),
              clockOut: formatTimeInTz(timeRecord.actualEnd, clientTz),
              duration: dailyTotal,
              customer: clientName,
            });
          } else if (timeRecord.scheduledStart && timeRecord.scheduledEnd) {
            sessionEntries.push({
              clockIn: formatTimeInTz(timeRecord.scheduledStart, clientTz),
              clockOut: formatTimeInTz(timeRecord.scheduledEnd, clientTz),
              duration: dailyTotal,
              customer: clientName,
            });
          } else {
            sessionEntries.push({
              clockIn: '—',
              clockOut: '—',
              duration: dailyTotal,
              customer: clientName,
            });
          }
        }

        days.push({
          dateKey,
          displayDate,
          dailyTotal: dailyTotal > 0 ? dailyTotal : (hasPto ? 8 : 0),
          dailyOT,
          sessions: sessionEntries,
        });
      }

      // Skip employees with no time entries at all
      if (days.length === 0) continue;

      // Use invoice lineItem hours as the summary totals (exact match with invoice)
      const invoiceHours = empInvoiceHours.get(empId) || { regular: 0, overtime: 0 };
      const regularHours = Math.round(invoiceHours.regular * 100) / 100;
      const overtimeHrs = Math.round(invoiceHours.overtime * 100) / 100;
      const totalHours = Math.round((regularHours + overtimeHrs + ptoHours) * 100) / 100;

      employeeData.push({
        fullName,
        regularHours,
        overtimeHours: overtimeHrs,
        ptoHours,
        totalHours,
        days,
      });
    }

    // 10. Check if there is any data to show
    const hasData = employeeData.some((emp) => emp.days.length > 0);
    if (!hasData) {
      res.status(400).json({
        success: false,
        error: 'No timesheet data found for this invoice period. Employees may not have any work sessions or time records.',
      });
      return;
    }

    // 11. Generate PDF
    const pdfBytes = await buildTimesheetPdf(employeeData, periodStart, periodEnd);

    // 12. Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timesheet-${invoice.invoiceNumber}.pdf"`,
    );
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download timesheet PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate timesheet PDF' });
  }
};
