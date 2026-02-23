import prisma from '../config/database';
import { createNotification, createBulkNotifications } from '../controllers/notification.controller';
import type { Server } from 'socket.io';

interface EmployeeTimeAggregation {
  employeeId: string;
  employeeName: string;
  totalMinutes: number;
  overtimeMinutes: number;
}

// Client type from Prisma query with includes
type ClientWithRelations = {
  id: string;
  companyName: string;
  agreementType: string | null;
  user: { id: string; email: string };
  clientPolicies: {
    defaultHourlyRate: any;
    defaultOvertimeRate: any;
    currency: string;
    notifyInvoice: boolean;
  } | null;
  employees: {
    employeeId: string;
    hourlyRate: any;
    overtimeRate: any;
  }[];
};

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Get ISO week number for a date.
 */
const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

/**
 * Get Monday of the week containing the given date.
 */
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday goes back 6
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
};

/**
 * Get Monday of a specific ISO week number in a given year.
 */
const getMondayOfISOWeek = (year: number, week: number): Date => {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  // Monday of week 1
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  // Add (week - 1) * 7 days
  const target = new Date(mondayWeek1);
  target.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return target;
};

/**
 * Generate invoice for a single client over a given period.
 * Shared logic used by both monthly and weekly generation.
 */
const generateInvoiceForClient = async (
  client: ClientWithRelations,
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
  invoiceNumber: string,
  io?: Server,
): Promise<boolean> => {
  // Check if invoice already exists
  const existing = await prisma.invoice.findUnique({
    where: { invoiceNumber },
  });
  if (existing) {
    console.log(`[Invoice] Skipping ${invoiceNumber} - already exists`);
    return false;
  }

  // Get approved time records for the period
  const timeRecords = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      date: { gte: periodStart, lte: periodEnd },
      invoiceId: null, // Not already invoiced
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Also pick up late-approved OT from previous periods that haven't been invoiced yet.
  // These are OT records approved after their billing cycle's invoice was already generated.
  const lateApprovedOT = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      overtimeMinutes: { gt: 0 },
      invoiceId: null,
      date: { lt: periodStart }, // From a previous period
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (lateApprovedOT.length > 0) {
    console.log(`[Invoice] Including ${lateApprovedOT.length} late-approved OT record(s) for ${client.companyName}`);
  }

  // Merge both sets
  const allRecords = [...timeRecords, ...lateApprovedOT];

  if (allRecords.length === 0) return false;

  // Aggregate by employee
  const employeeAgg = new Map<string, EmployeeTimeAggregation>();
  for (const record of allRecords) {
    const key = record.employeeId;
    if (!employeeAgg.has(key)) {
      employeeAgg.set(key, {
        employeeId: record.employeeId,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
        totalMinutes: 0,
        overtimeMinutes: 0,
      });
    }
    const agg = employeeAgg.get(key)!;
    agg.totalMinutes += record.totalMinutes || 0;
    agg.overtimeMinutes += record.overtimeMinutes || 0;
  }

  // Determine rates
  const policy = client.clientPolicies;
  const defaultHourlyRate = policy ? Number(policy.defaultHourlyRate) : 0;
  const defaultOTRate = policy
    ? Number(policy.defaultOvertimeRate) > 0
      ? Number(policy.defaultOvertimeRate)
      : defaultHourlyRate * 1.5
    : 0;
  const currency = policy?.currency || 'USD';

  // Build per-employee rate lookup from ClientEmployee overrides
  const empRateMap = new Map<string, { hourlyRate: number; overtimeRate: number }>();
  for (const ce of client.employees) {
    const hr = ce.hourlyRate ? Number(ce.hourlyRate) : defaultHourlyRate;
    const otr = ce.overtimeRate ? Number(ce.overtimeRate) : hr > 0 ? hr * 1.5 : defaultOTRate;
    empRateMap.set(ce.employeeId, { hourlyRate: hr, overtimeRate: otr });
  }

  let subtotal = 0;
  let totalHoursAll = 0;
  let totalOTHoursAll = 0;
  const lineItemsData: {
    employeeId: string;
    employeeName: string;
    hours: number;
    overtimeHours: number;
    rate: number;
    overtimeRate: number;
    amount: number;
  }[] = [];

  for (const [empId, agg] of employeeAgg) {
    const rates = empRateMap.get(empId) || {
      hourlyRate: defaultHourlyRate,
      overtimeRate: defaultOTRate,
    };
    const regularHours = Math.round((agg.totalMinutes / 60) * 100) / 100;
    const otHours = Math.round((agg.overtimeMinutes / 60) * 100) / 100;
    const lineAmount = regularHours * rates.hourlyRate + otHours * rates.overtimeRate;

    totalHoursAll += regularHours;
    totalOTHoursAll += otHours;
    subtotal += lineAmount;

    lineItemsData.push({
      employeeId: empId,
      employeeName: agg.employeeName,
      hours: regularHours,
      overtimeHours: otHours,
      rate: rates.hourlyRate,
      overtimeRate: rates.overtimeRate,
      amount: Math.round(lineAmount * 100) / 100,
    });
  }

  // Create invoice with line items and mark time records as invoiced — all in one transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        periodStart,
        periodEnd,
        totalHours: Math.round(totalHoursAll * 100) / 100,
        overtimeHours: Math.round(totalOTHoursAll * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        total: Math.round(subtotal * 100) / 100,
        currency,
        status: 'DRAFT',
        dueDate,
        lineItems: {
          create: lineItemsData,
        },
      },
      include: { lineItems: true },
    });

    // Mark all included time records with this invoice ID
    const recordIds = allRecords.map((r) => r.id);
    if (recordIds.length > 0) {
      await tx.timeRecord.updateMany({
        where: { id: { in: recordIds } },
        data: { invoiceId: inv.id },
      });
    }

    return inv;
  });

  // Notify the client
  if (policy?.notifyInvoice !== false) {
    const totalFormatted = (Math.round(subtotal * 100) / 100).toFixed(2);
    const periodLabel = `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    try {
      await createNotification(
        client.user.id,
        'INVOICE_GENERATED',
        'Invoice Generated',
        `Invoice ${invoiceNumber} has been generated for ${periodLabel}. Total: $${totalFormatted}`,
        {
          invoiceId: invoice.id,
          invoiceNumber,
          total: totalFormatted,
          currency,
        },
        '/client/billing'
      );

      if (io) {
        io.emit(`notification:${client.user.id}`, {
          type: 'INVOICE_GENERATED',
          message: `Invoice ${invoiceNumber} generated`,
        });
      }
    } catch (notifError) {
      console.error(`[Invoice] Notification failed for ${client.companyName}:`, notifError);
    }
  }

  // Notify all admins and finance users
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (admins.length > 0) {
      await createBulkNotifications(
        admins.map((a) => a.id),
        'INVOICE_GENERATED',
        'Invoice Generated',
        `Invoice ${invoiceNumber} generated for ${client.companyName}. Total: $${(Math.round(subtotal * 100) / 100).toFixed(2)}`,
        { invoiceId: invoice.id, invoiceNumber, clientId: client.id },
        '/admin/invoices'
      );
    }
  } catch (notifError) {
    console.error(`[Invoice] Admin notification failed for ${client.companyName}:`, notifError);
  }

  console.log(
    `[Invoice] Generated ${invoiceNumber} for ${client.companyName}: $${(Math.round(subtotal * 100) / 100).toFixed(2)}`
  );

  return true;
};

// ============================================
// MONTHLY INVOICE GENERATION
// ============================================

/**
 * Generate monthly invoices for a specific month/year.
 * Only processes clients with MONTHLY agreement type (or null for backward compatibility).
 */
export const generateInvoicesForPeriod = async (
  year: number,
  month: number, // 1-indexed (1 = January)
  io?: Server
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0)); // Last day of month
    const dueDate = new Date(Date.UTC(year, month, 15)); // Due 15th of next month

    // Only monthly clients (MONTHLY or null/unset — backward compatible)
    const clients = await prisma.client.findMany({
      where: {
        user: { status: 'ACTIVE' },
        agreementType: { notIn: ['WEEKLY', 'BI_WEEKLY'] },
      },
      include: {
        clientPolicies: true,
        user: { select: { id: true, email: true } },
        employees: {
          where: { isActive: true },
          select: { employeeId: true, hourlyRate: true, overtimeRate: true },
        },
      },
    });

    for (const client of clients) {
      try {
        const monthStr = String(month).padStart(2, '0');
        const clientPrefix = client.id.substring(0, 6).toUpperCase();
        const invoiceNumber = `INV-${year}-${monthStr}-${clientPrefix}`;

        const success = await generateInvoiceForClient(
          client as any,
          periodStart,
          periodEnd,
          dueDate,
          invoiceNumber,
          io,
        );
        if (success) generated++;
      } catch (clientError: any) {
        const errMsg = `Failed to generate invoice for client ${client.companyName}: ${clientError.message}`;
        console.error(`[Invoice] ${errMsg}`);
        errors.push(errMsg);
      }
    }
  } catch (error) {
    console.error('[Invoice] Monthly job failed:', error);
    errors.push(`Job failed: ${(error as Error).message}`);
  }

  return { generated, errors };
};

// ============================================
// WEEKLY INVOICE GENERATION
// ============================================

/**
 * Generate weekly invoices for a specific week.
 * Only processes clients with WEEKLY or BI_WEEKLY agreement type.
 */
export const generateWeeklyInvoicesForWeek = async (
  year: number,
  week: number, // ISO week number (1-53)
  io?: Server
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    const monday = getMondayOfISOWeek(year, week);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const dueDate = new Date(sunday);
    dueDate.setUTCDate(sunday.getUTCDate() + 7); // Due 7 days after period end

    // Only weekly and bi-weekly clients
    const clients = await prisma.client.findMany({
      where: {
        user: { status: 'ACTIVE' },
        agreementType: { in: ['WEEKLY', 'BI_WEEKLY'] },
      },
      include: {
        clientPolicies: true,
        user: { select: { id: true, email: true } },
        employees: {
          where: { isActive: true },
          select: { employeeId: true, hourlyRate: true, overtimeRate: true },
        },
      },
    });

    for (const client of clients) {
      try {
        // BI_WEEKLY clients only generate on even ISO week numbers
        if (client.agreementType === 'BI_WEEKLY' && week % 2 !== 0) {
          console.log(`[Invoice] Skipping bi-weekly client ${client.companyName} on odd week ${week}`);
          continue;
        }

        const weekStr = String(week).padStart(2, '0');
        const clientPrefix = client.id.substring(0, 6).toUpperCase();
        const invoiceNumber = `INV-${year}-W${weekStr}-${clientPrefix}`;

        const success = await generateInvoiceForClient(
          client as any,
          monday,
          sunday,
          dueDate,
          invoiceNumber,
          io,
        );
        if (success) generated++;
      } catch (clientError: any) {
        const errMsg = `Failed to generate weekly invoice for client ${client.companyName}: ${clientError.message}`;
        console.error(`[Invoice] ${errMsg}`);
        errors.push(errMsg);
      }
    }
  } catch (error) {
    console.error('[Invoice] Weekly job failed:', error);
    errors.push(`Job failed: ${(error as Error).message}`);
  }

  return { generated, errors };
};

/**
 * Weekly cron handler: generates invoices for the previous week (Mon–Sun) for WEEKLY and BI_WEEKLY clients.
 */
export const runWeeklyInvoiceGeneration = async (io?: Server): Promise<void> => {
  const now = new Date();
  // Get previous week's Monday
  const prevWeekDate = new Date(now);
  prevWeekDate.setUTCDate(now.getUTCDate() - 7);
  const monday = getMondayOfWeek(prevWeekDate);
  const year = monday.getUTCFullYear();
  const week = getISOWeekNumber(monday);

  console.log(`[Invoice] Starting weekly invoice generation for ${year}-W${String(week).padStart(2, '0')}`);
  const result = await generateWeeklyInvoicesForWeek(year, week, io);
  console.log(`[Invoice] Weekly completed: ${result.generated} invoices generated, ${result.errors.length} errors`);
};

/**
 * Monthly cron handler: generates invoices for the previous month for MONTHLY clients.
 */
export const runMonthlyInvoiceGeneration = async (io?: Server): Promise<void> => {
  const now = new Date();
  const prevMonth = now.getMonth(); // 0-indexed current month = 1-indexed previous month
  const year = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = prevMonth === 0 ? 12 : prevMonth;

  console.log(`[Invoice] Starting monthly invoice generation for ${year}-${String(month).padStart(2, '0')}`);
  const result = await generateInvoicesForPeriod(year, month, io);
  console.log(`[Invoice] Monthly completed: ${result.generated} invoices generated, ${result.errors.length} errors`);
};
