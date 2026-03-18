import prisma from '../config/database';
import { createNotification, createBulkNotifications } from '../controllers/notification.controller';
import type { Server } from 'socket.io';
import { getISOWeekNumber } from '../utils/timezone';

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
    paymentTermsDays: number;
  } | null;
  employees: {
    employeeId: string;
    hourlyRate: any;
    overtimeRate: any;
  }[];
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

  // Before generating: check for unapproved worked Shift Extensions and Extra Time,
  // send approval reminders to the client so they can act before the invoice finalizes.
  try {
    const unapprovedOTRecords = await prisma.timeRecord.findMany({
      where: {
        clientId: client.id,
        date: { gte: periodStart, lte: periodEnd },
        overtimeMinutes: { gt: 0 },
        status: 'PENDING',
      },
      select: { overtimeMinutes: true, employeeId: true },
    });

    if (unapprovedOTRecords.length > 0) {
      const totalUnapprovedMin = unapprovedOTRecords.reduce((s, r) => s + r.overtimeMinutes, 0);
      const hrs = Math.floor(totalUnapprovedMin / 60);
      const mins = totalUnapprovedMin % 60;
      const unapprovedLabel = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;

      console.log(`[Invoice] Warning: ${client.companyName} has ${unapprovedOTRecords.length} unapproved OT records (${unapprovedLabel}) in this period`);

      await createNotification(
        client.user.id,
        'PAYROLL_REMINDER',
        'Unapproved Overtime — Invoice Being Generated',
        `Invoice ${invoiceNumber} is being generated but you have ${unapprovedOTRecords.length} unapproved overtime entr${unapprovedOTRecords.length === 1 ? 'y' : 'ies'} (${unapprovedLabel}) that will NOT be included. Please approve or deny these hours.`,
        { invoiceNumber, unapprovedCount: unapprovedOTRecords.length, unapprovedHours: unapprovedLabel },
        '/client/time-records'
      );

      if (io) {
        io.emit(`notification:${client.user.id}`, {
          type: 'PAYROLL_REMINDER',
          message: `Invoice being generated — ${unapprovedOTRecords.length} unapproved OT entries won't be included.`,
        });
      }
    }
  } catch (reminderErr) {
    console.error(`[Invoice] Pre-generation reminder failed for ${client.companyName}:`, reminderErr);
  }

  // Clean up orphaned invoiceId references (where invoice was deleted but invoiceId wasn't cleared)
  const orphanedRecords = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      date: { gte: periodStart, lte: periodEnd },
      invoiceId: { not: null },
    },
    select: { id: true, invoiceId: true },
  });
  if (orphanedRecords.length > 0) {
    const invoiceIds = [...new Set(orphanedRecords.map(r => r.invoiceId!))];
    const existingInvoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingInvoices.map(i => i.id));
    const orphanedIds = orphanedRecords.filter(r => !existingIds.has(r.invoiceId!)).map(r => r.id);
    if (orphanedIds.length > 0) {
      await prisma.timeRecord.updateMany({
        where: { id: { in: orphanedIds } },
        data: { invoiceId: null },
      });
      console.log(`[Invoice] Cleared ${orphanedIds.length} orphaned invoiceId references for ${client.companyName}`);
    }
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
        select: {
          id: true, firstName: true, lastName: true, billingRate: true,
          groupAssignments: { select: { groupId: true, group: { select: { billingRate: true } } } },
        },
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
        select: {
          id: true, firstName: true, lastName: true, billingRate: true,
          groupAssignments: { select: { groupId: true, group: { select: { billingRate: true } } } },
        },
      },
    },
  });

  // Track which previous periods late OT came from, per employee
  const lateOtByEmployee = new Map<string, string[]>();
  if (lateApprovedOT.length > 0) {
    console.log(`[Invoice] Including ${lateApprovedOT.length} late-approved OT record(s) for ${client.companyName}`);
    for (const record of lateApprovedOT) {
      const periods = lateOtByEmployee.get(record.employeeId) || [];
      const label = new Date(record.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!periods.includes(label)) periods.push(label);
      lateOtByEmployee.set(record.employeeId, periods);
    }
  }

  // Merge both sets
  const allRecords = [...timeRecords, ...lateApprovedOT];

  if (allRecords.length === 0) return false;

  // Aggregate by employee, using TimeRecord's own shiftExtension/extraTime fields
  // to determine approved OT minutes (instead of relying on overtimeRequest records,
  // which may not exist for OT worked without a prior request).
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

    // Calculate approved OT directly from the TimeRecord's own fields
    let approvedOTMinutes = 0;
    if ((record as any).shiftExtensionStatus === 'APPROVED') {
      approvedOTMinutes += (record as any).shiftExtensionMinutes || 0;
    }
    if ((record as any).extraTimeStatus === 'APPROVED') {
      approvedOTMinutes += (record as any).extraTimeMinutes || 0;
    }

    const totalOT = record.overtimeMinutes || 0;
    const deniedOTMinutes = Math.max(0, totalOT - approvedOTMinutes);

    // Regular hours + approved OT only (denied/unapproved OT deducted)
    agg.totalMinutes += Math.max(0, (record.totalMinutes || 0) - deniedOTMinutes);
    agg.overtimeMinutes += approvedOTMinutes;
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

  // Fetch client-group billing rates
  const clientGroupRecords = await prisma.clientGroup.findMany({
    where: { clientId: client.id },
    select: { groupId: true, billingRate: true },
  });
  const clientGroupRateMap = new Map(
    clientGroupRecords.map((cg) => [cg.groupId, cg.billingRate ? Number(cg.billingRate) : null])
  );

  // Build per-employee rate lookup using same priority as payroll:
  // assignment override > employee billing rate > client-group rate > group rate > client default
  const empRateMap = new Map<string, { hourlyRate: number; overtimeRate: number }>();
  const buildRateForEmployee = (empId: string, employee: any) => {
    const ce = client.employees.find((e: any) => e.employeeId === empId);
    const employeeBillingRate = employee?.billingRate ? Number(employee.billingRate) : null;
    const groupAssignment = employee?.groupAssignments?.[0];
    const clientGroupBillingRate = groupAssignment?.groupId
      ? clientGroupRateMap.get(groupAssignment.groupId) ?? null
      : null;
    const groupBillingRate = groupAssignment?.group?.billingRate
      ? Number(groupAssignment.group.billingRate)
      : null;

    const hr = ce?.hourlyRate ? Number(ce.hourlyRate)
      : employeeBillingRate ? employeeBillingRate
      : clientGroupBillingRate ? clientGroupBillingRate
      : groupBillingRate ? groupBillingRate
      : defaultHourlyRate;

    const otr = ce?.overtimeRate ? Number(ce.overtimeRate)
      : hr > 0 ? hr * 1.5
      : defaultOTRate;

    empRateMap.set(empId, { hourlyRate: hr, overtimeRate: otr });
  };

  // Build rates for all employees found in records
  for (const record of allRecords) {
    if (!empRateMap.has(record.employeeId)) {
      buildRateForEmployee(record.employeeId, record.employee);
    }
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
    notes: string | null;
  }[] = [];

  for (const [empId, agg] of employeeAgg) {
    const rates = empRateMap.get(empId) || {
      hourlyRate: defaultHourlyRate,
      overtimeRate: defaultOTRate,
    };
    const totalHours = Math.round((agg.totalMinutes / 60) * 100) / 100;
    const otHours = Math.round((agg.overtimeMinutes / 60) * 100) / 100;
    const regularHours = Math.round((totalHours - otHours) * 100) / 100;
    const regularPay = Math.round(regularHours * rates.hourlyRate * 100) / 100;
    const overtimePay = Math.round(otHours * rates.overtimeRate * 100) / 100;
    const lineAmount = regularPay + overtimePay;

    totalHoursAll += totalHours;
    totalOTHoursAll += otHours;
    subtotal += lineAmount;

    // Annotate if this employee has late-approved OT from previous periods
    const lateOtPeriods = lateOtByEmployee.get(empId);
    const lineNotes = lateOtPeriods?.length
      ? `Includes late-approved OT from: ${lateOtPeriods.join(', ')}`
      : null;

    lineItemsData.push({
      employeeId: empId,
      employeeName: agg.employeeName,
      hours: totalHours,
      overtimeHours: otHours,
      rate: rates.hourlyRate,
      overtimeRate: rates.overtimeRate,
      amount: Math.round(lineAmount * 100) / 100,
      notes: lineNotes,
    });
  }

  // Build invoice-level notes for late OT audit trail
  let invoiceNotes: string | null = null;
  if (lateOtByEmployee.size > 0) {
    const summaries: string[] = [];
    for (const [empId, periods] of lateOtByEmployee) {
      const empName = employeeAgg.get(empId)?.employeeName || 'Unknown';
      summaries.push(`${empName}: ${periods.join(', ')}`);
    }
    invoiceNotes = `Late-approved OT included from previous periods:\n${summaries.join('\n')}`;
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
        notes: invoiceNotes,
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
  io?: Server,
  clientId?: string,
  cronMode: boolean = false
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0)); // Last day of month

    // When a specific client is requested or admin manual trigger, include all active clients.
    // Only filter by agreement type during cron job (automatic generation).
    const clientWhere: any = {
      user: { status: 'ACTIVE' },
    };
    if (clientId) {
      clientWhere.id = clientId;
    } else if (cronMode) {
      // Cron job: only MONTHLY or null/unset agreement clients
      clientWhere.OR = [
        { agreementType: { notIn: ['WEEKLY', 'BI_WEEKLY'] } },
        { agreementType: null },
      ];
    }

    const clients = await prisma.client.findMany({
      where: clientWhere,
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

        // Per-client due date based on payment terms
        const paymentTermsDays = client.clientPolicies?.paymentTermsDays ?? 15;
        const dueDate = new Date(periodEnd);
        dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermsDays);

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
 * Generate weekly invoices. When cronMode is true, only processes WEEKLY/BI_WEEKLY clients.
 * When cronMode is false (admin manual trigger), processes all active clients.
 */
export const generateWeeklyInvoicesForWeek = async (
  year: number,
  week: number, // ISO week number (1-53)
  io?: Server,
  clientId?: string,
  cronMode: boolean = false
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    const monday = getMondayOfISOWeek(year, week);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const clientWhere: any = {
      user: { status: 'ACTIVE' },
    };
    if (clientId) {
      clientWhere.id = clientId;
    } else if (cronMode) {
      // Cron job: only WEEKLY/BI_WEEKLY agreement clients
      clientWhere.agreementType = { in: ['WEEKLY', 'BI_WEEKLY'] };
    }

    const clients = await prisma.client.findMany({
      where: clientWhere,
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

        // Per-client due date based on payment terms
        const paymentTermsDays = client.clientPolicies?.paymentTermsDays ?? 7;
        const dueDate = new Date(sunday);
        dueDate.setUTCDate(sunday.getUTCDate() + paymentTermsDays);

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
  const result = await generateWeeklyInvoicesForWeek(year, week, io, undefined, true);
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
  const result = await generateInvoicesForPeriod(year, month, io, undefined, true);
  console.log(`[Invoice] Monthly completed: ${result.generated} invoices generated, ${result.errors.length} errors`);
};

// ============================================
// PREVIEW / DRY-RUN
// ============================================

export interface InvoicePreviewItem {
  clientName: string;
  invoiceNumber: string;
  employeeCount: number;
  totalHours: number;
  overtimeHours: number;
  estimatedTotal: number;
  rates: number[];
  lineItems: {
    employeeName: string;
    hours: number;
    overtimeHours: number;
    rate: number;
    overtimeRate: number;
    amount: number;
  }[];
  lateOtRecords: number;
  currency: string;
  alreadyExists: boolean;
}

/**
 * Preview helper: aggregates data for a single client without creating anything.
 */
const previewInvoiceForClient = async (
  client: ClientWithRelations,
  periodStart: Date,
  periodEnd: Date,
  invoiceNumber: string,
): Promise<InvoicePreviewItem | null> => {
  // Check if invoice already exists
  const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } });

  // For preview, show all approved records (including already invoiced)
  const timeRecords = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      date: { gte: periodStart, lte: periodEnd },
      ...(existing ? {} : { invoiceId: null }),
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, billingRate: true,
          groupAssignments: { select: { groupId: true, group: { select: { billingRate: true } } } },
        },
      },
    },
  });

  const lateApprovedOT = await prisma.timeRecord.findMany({
    where: {
      clientId: client.id,
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
      overtimeMinutes: { gt: 0 },
      invoiceId: null,
      date: { lt: periodStart },
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, billingRate: true,
          groupAssignments: { select: { groupId: true, group: { select: { billingRate: true } } } },
        },
      },
    },
  });

  const allRecords = [...timeRecords, ...lateApprovedOT];
  if (allRecords.length === 0) return null;

  // Aggregate using TimeRecord's own shiftExtension/extraTime fields
  const employeeIds = new Set<string>();
  let totalMinutes = 0;
  let otMinutes = 0;

  for (const record of allRecords) {
    employeeIds.add(record.employeeId);

    let approvedOT = 0;
    if ((record as any).shiftExtensionStatus === 'APPROVED') {
      approvedOT += (record as any).shiftExtensionMinutes || 0;
    }
    if ((record as any).extraTimeStatus === 'APPROVED') {
      approvedOT += (record as any).extraTimeMinutes || 0;
    }

    const totalOT = record.overtimeMinutes || 0;
    const deniedOT = Math.max(0, totalOT - approvedOT);
    totalMinutes += Math.max(0, (record.totalMinutes || 0) - deniedOT);
    otMinutes += approvedOT;
  }

  // Calculate estimated total using per-employee rates
  // Rate priority: assignment override > employee billing rate > client-group rate > group rate > client default
  const policy = client.clientPolicies;
  const defaultHourlyRate = policy ? Number(policy.defaultHourlyRate) : 0;
  const defaultOTRate = policy
    ? Number(policy.defaultOvertimeRate) > 0
      ? Number(policy.defaultOvertimeRate)
      : defaultHourlyRate * 1.5
    : 0;

  // Fetch client-group billing rates
  const clientGroupRecords = await prisma.clientGroup.findMany({
    where: { clientId: client.id },
    select: { groupId: true, billingRate: true },
  });
  const clientGroupRateMap = new Map(
    clientGroupRecords.map((cg) => [cg.groupId, cg.billingRate ? Number(cg.billingRate) : null])
  );

  // Build employee rate map from time records (has employee billing rate info)
  const empRateMap = new Map<string, { hourlyRate: number; overtimeRate: number }>();
  const employeeMap = new Map<string, any>();
  for (const record of allRecords) {
    if (!employeeMap.has(record.employeeId)) {
      employeeMap.set(record.employeeId, (record as any).employee);
    }
  }
  for (const [empId, employee] of employeeMap) {
    const ce = client.employees.find((e: any) => e.employeeId === empId);
    const employeeBillingRate = employee?.billingRate ? Number(employee.billingRate) : null;
    const groupAssignment = employee?.groupAssignments?.[0];
    const clientGroupBillingRate = groupAssignment?.groupId
      ? clientGroupRateMap.get(groupAssignment.groupId) ?? null
      : null;
    const groupBillingRate = groupAssignment?.group?.billingRate
      ? Number(groupAssignment.group.billingRate)
      : null;

    const hr = ce?.hourlyRate ? Number(ce.hourlyRate)
      : employeeBillingRate ? employeeBillingRate
      : clientGroupBillingRate ? clientGroupBillingRate
      : groupBillingRate ? groupBillingRate
      : defaultHourlyRate;

    const otr = ce?.overtimeRate ? Number(ce.overtimeRate)
      : hr > 0 ? hr * 1.5
      : defaultOTRate;

    empRateMap.set(empId, { hourlyRate: hr, overtimeRate: otr });
  }

  // Per-employee aggregation for accurate rate calculation
  const empAgg = new Map<string, { totalMin: number; otMin: number }>();
  for (const record of allRecords) {
    let approvedOT = 0;
    if ((record as any).shiftExtensionStatus === 'APPROVED') {
      approvedOT += (record as any).shiftExtensionMinutes || 0;
    }
    if ((record as any).extraTimeStatus === 'APPROVED') {
      approvedOT += (record as any).extraTimeMinutes || 0;
    }
    const totalOT = record.overtimeMinutes || 0;
    const deniedOT = Math.max(0, totalOT - approvedOT);
    const agg = empAgg.get(record.employeeId) || { totalMin: 0, otMin: 0 };
    agg.totalMin += Math.max(0, (record.totalMinutes || 0) - deniedOT);
    agg.otMin += approvedOT;
    empAgg.set(record.employeeId, agg);
  }

  // Build employee name map
  const empNameMap = new Map<string, string>();
  for (const record of allRecords) {
    if (!empNameMap.has(record.employeeId) && (record as any).employee) {
      const emp = (record as any).employee;
      empNameMap.set(record.employeeId, `${emp.firstName} ${emp.lastName}`);
    }
  }

  let estimatedTotal = 0;
  const ratesUsed: number[] = [];
  const lineItems: { employeeName: string; hours: number; overtimeHours: number; rate: number; overtimeRate: number; amount: number }[] = [];

  for (const [empId, agg] of empAgg) {
    const rates = empRateMap.get(empId) || { hourlyRate: defaultHourlyRate, overtimeRate: defaultOTRate };
    if (rates.hourlyRate > 0 && !ratesUsed.includes(rates.hourlyRate)) {
      ratesUsed.push(rates.hourlyRate);
    }
    const totalHrs = Math.round((agg.totalMin / 60) * 100) / 100;
    const otHrs = Math.round((agg.otMin / 60) * 100) / 100;
    const regularHrs = Math.round((totalHrs - otHrs) * 100) / 100;
    const regularPay = Math.round(regularHrs * rates.hourlyRate * 100) / 100;
    const overtimePay = Math.round(otHrs * rates.overtimeRate * 100) / 100;
    const lineAmount = regularPay + overtimePay;
    estimatedTotal += lineAmount;

    lineItems.push({
      employeeName: empNameMap.get(empId) || 'Unknown',
      hours: totalHrs,
      overtimeHours: otHrs,
      rate: rates.hourlyRate,
      overtimeRate: rates.overtimeRate,
      amount: Math.round(lineAmount * 100) / 100,
    });
  }

  return {
    clientName: client.companyName,
    invoiceNumber,
    employeeCount: employeeIds.size,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    overtimeHours: Math.round((otMinutes / 60) * 100) / 100,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    rates: ratesUsed.sort((a, b) => a - b),
    lineItems,
    lateOtRecords: lateApprovedOT.length,
    currency: policy?.currency || 'USD',
    alreadyExists: !!existing,
  };
};

/**
 * Preview monthly invoice generation (dry run).
 */
export const previewInvoicesForPeriod = async (
  year: number,
  month: number,
  clientId?: string,
): Promise<InvoicePreviewItem[]> => {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));

  // Preview always includes all active clients (admin manual action)
  const clientWhere: any = {
    user: { status: 'ACTIVE' },
  };
  if (clientId) {
    clientWhere.id = clientId;
  }

  const clients = await prisma.client.findMany({
    where: clientWhere,
    include: {
      clientPolicies: true,
      user: { select: { id: true, email: true } },
      employees: {
        where: { isActive: true },
        select: { employeeId: true, hourlyRate: true, overtimeRate: true },
      },
    },
  });

  const previews: InvoicePreviewItem[] = [];
  for (const client of clients) {
    const monthStr = String(month).padStart(2, '0');
    const clientPrefix = client.id.substring(0, 6).toUpperCase();
    const invoiceNumber = `INV-${year}-${monthStr}-${clientPrefix}`;

    const preview = await previewInvoiceForClient(client as any, periodStart, periodEnd, invoiceNumber);
    if (preview) previews.push(preview);
  }
  return previews;
};

/**
 * Preview weekly invoice generation (dry run).
 */
export const previewWeeklyInvoicesForWeek = async (
  year: number,
  week: number,
  clientId?: string,
): Promise<InvoicePreviewItem[]> => {
  const monday = getMondayOfISOWeek(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // Include all active clients for weekly preview (admin manual trigger).
  const clientWhere: any = {
    user: { status: 'ACTIVE' },
  };
  if (clientId) {
    clientWhere.id = clientId;
  }

  const clients = await prisma.client.findMany({
    where: clientWhere,
    include: {
      clientPolicies: true,
      user: { select: { id: true, email: true } },
      employees: {
        where: { isActive: true },
        select: { employeeId: true, hourlyRate: true, overtimeRate: true },
      },
    },
  });

  const previews: InvoicePreviewItem[] = [];
  for (const client of clients) {
    if (client.agreementType === 'BI_WEEKLY' && week % 2 !== 0) continue;

    const weekStr = String(week).padStart(2, '0');
    const clientPrefix = client.id.substring(0, 6).toUpperCase();
    const invoiceNumber = `INV-${year}-W${weekStr}-${clientPrefix}`;

    const preview = await previewInvoiceForClient(client as any, monday, sunday, invoiceNumber);
    if (preview) previews.push(preview);
  }
  return previews;
};
