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
    invoiceByGroup?: boolean;
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
  employeeFilter?: Set<string>,
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
      ...(employeeFilter ? { employeeId: { in: [...employeeFilter] } } : {}),
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, billingRate: true, overtimeRate: true,
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
      ...(employeeFilter ? { employeeId: { in: [...employeeFilter] } } : {}),
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, billingRate: true, overtimeRate: true,
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

  // Fetch approved OvertimeRequests for the period to complement TimeRecord fields
  const allEmployeeIds = [...new Set(allRecords.map(r => r.employeeId))];
  const allDates = [...new Set(allRecords.map(r => r.date))];
  const approvedOTRequests = await prisma.overtimeRequest.findMany({
    where: {
      clientId: client.id,
      employeeId: { in: allEmployeeIds },
      date: { in: allDates },
      status: 'APPROVED',
      isAutoGenerated: true,
    },
    select: {
      employeeId: true,
      date: true,
      requestedMinutes: true,
    },
  });

  // Build lookup: employeeId_dateISO -> total approved OT minutes from OvertimeRequests
  const otRequestMinutesMap = new Map<string, number>();
  for (const ot of approvedOTRequests) {
    const dateKey = new Date(ot.date).toISOString().split('T')[0];
    const key = `${ot.employeeId}_${dateKey}`;
    otRequestMinutesMap.set(key, (otRequestMinutesMap.get(key) || 0) + (ot.requestedMinutes || 0));
  }

  // Aggregate by employee, using TimeRecord fields + OvertimeRequest as fallback
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

    // Check TimeRecord fields first
    let approvedOTMinutes = 0;
    if ((record as any).shiftExtensionStatus === 'APPROVED') {
      approvedOTMinutes += (record as any).shiftExtensionMinutes || 0;
    }
    if ((record as any).extraTimeStatus === 'APPROVED') {
      approvedOTMinutes += (record as any).extraTimeMinutes || 0;
    }

    // Fallback: if TimeRecord fields show 0 approved OT, check OvertimeRequest records
    if (approvedOTMinutes === 0) {
      const dateKey = new Date(record.date).toISOString().split('T')[0];
      const otKey = `${record.employeeId}_${dateKey}`;
      approvedOTMinutes = otRequestMinutesMap.get(otKey) || 0;
    }

    const totalOT = record.overtimeMinutes || 0;
    const deniedOTMinutes = Math.max(0, totalOT - approvedOTMinutes);

    agg.totalMinutes += Math.max(0, (record.totalMinutes || 0) - deniedOTMinutes);
    agg.overtimeMinutes += approvedOTMinutes;
  }

  // Determine rates
  const policy = client.clientPolicies;
  const defaultHourlyRate = policy ? Number(policy.defaultHourlyRate) : 0;
  // defaultOvertimeRate schema default is 1, which means "use 1x hourly rate" (not $1/hr).
  // Only use as an absolute OT rate if explicitly configured above 1.
  const rawDefaultOT = policy ? Number(policy.defaultOvertimeRate) : 0;
  const defaultOTRate = rawDefaultOT > 1 ? rawDefaultOT : 0;
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

    let otr = ce?.overtimeRate ? Number(ce.overtimeRate) : 0;
    if (otr === 0 && hr > 0) {
      const empOTMultiplier = employee?.overtimeRate ? Number(employee.overtimeRate) : 1;
      otr = defaultOTRate > 0 ? defaultOTRate : hr * empOTMultiplier;
    } else if (otr === 0) {
      otr = defaultOTRate;
    }

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
    const regularMinutes = agg.totalMinutes - agg.overtimeMinutes;
    const regularHours = Math.round((regularMinutes / 60) * 100) / 100;
    const otHours = Math.round((agg.overtimeMinutes / 60) * 100) / 100;
    const regularPay = Math.round((regularMinutes * rates.hourlyRate / 60) * 100) / 100;
    const overtimePay = Math.round((agg.overtimeMinutes * rates.overtimeRate / 60) * 100) / 100;
    const lineAmount = regularPay + overtimePay;

    totalHoursAll += regularHours + otHours;
    totalOTHoursAll += otHours;
    subtotal += lineAmount;

    const lateOtPeriods = lateOtByEmployee.get(empId);
    const lineNotes = lateOtPeriods?.length
      ? `Includes late-approved OT from: ${lateOtPeriods.join(', ')}`
      : null;

    lineItemsData.push({
      employeeId: empId,
      employeeName: agg.employeeName,
      hours: regularHours,
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
/**
 * Generate separate invoices per group for a client with invoiceByGroup enabled.
 * Employees not in any group get a separate "Ungrouped" invoice.
 */
const generateGroupWiseInvoices = async (
  client: ClientWithRelations,
  periodStart: Date,
  periodEnd: Date,
  paymentTermsDays: number,
  invoicePrefix: string,
  io?: Server,
): Promise<number> => {
  // Get all groups assigned to this client with their employees
  const clientGroups = await prisma.clientGroup.findMany({
    where: { clientId: client.id },
    include: {
      group: {
        include: {
          employees: { select: { employeeId: true } },
        },
      },
    },
  });

  // Get all employee IDs that have actual time records for this period (includes inactive-at-client employees)
  const recordEmployeeIds = new Set<string>(
    (await prisma.timeRecord.findMany({
      where: {
        clientId: client.id,
        status: { in: ['APPROVED', 'AUTO_APPROVED'] },
        date: { gte: periodStart, lte: periodEnd },
        invoiceId: null,
      },
      select: { employeeId: true },
    })).map(r => r.employeeId)
  );

  // Build group -> employeeIds map
  const groupEmployeeMap = new Map<string, { groupName: string; employeeIds: Set<string> }>();
  const allGroupedEmployeeIds = new Set<string>();

  for (const cg of clientGroups) {
    const empIds = new Set(cg.group.employees.map(e => e.employeeId));
    // Include employees that have records for this period (covers inactive-at-client employees too)
    const validEmpIds = new Set([...empIds].filter(id => recordEmployeeIds.has(id)));

    if (validEmpIds.size > 0) {
      groupEmployeeMap.set(cg.groupId, { groupName: cg.group.name, employeeIds: validEmpIds });
      validEmpIds.forEach(id => allGroupedEmployeeIds.add(id));
    }
  }

  // Find ungrouped employees (employees with records not in any of this client's groups)
  const ungroupedEmpIds = [...recordEmployeeIds].filter(id => !allGroupedEmployeeIds.has(id));

  let generated = 0;
  const clientPrefix = client.id.substring(0, 6).toUpperCase();

  // Generate invoice per group
  for (const [groupId, { groupName, employeeIds }] of groupEmployeeMap) {
    const groupPrefix = groupId.substring(0, 4).toUpperCase();
    const invoiceNumber = `${invoicePrefix}-G${groupPrefix}-${clientPrefix}`;
    const dueDate = new Date(periodEnd);
    dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermsDays);

    try {
      const success = await generateInvoiceForClient(
        client, periodStart, periodEnd, dueDate, invoiceNumber, io, employeeIds
      );
      if (success) {
        console.log(`[Invoice] Generated group invoice ${invoiceNumber} for ${client.companyName} / ${groupName}`);
        generated++;
      }
    } catch (err: any) {
      console.error(`[Invoice] Failed group invoice for ${client.companyName}/${groupName}:`, err.message);
    }
  }

  // Generate invoice for ungrouped employees
  if (ungroupedEmpIds.length > 0) {
    const invoiceNumber = `${invoicePrefix}-UNG-${clientPrefix}`;
    const dueDate = new Date(periodEnd);
    dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermsDays);

    try {
      const success = await generateInvoiceForClient(
        client, periodStart, periodEnd, dueDate, invoiceNumber, io, new Set(ungroupedEmpIds)
      );
      if (success) {
        console.log(`[Invoice] Generated ungrouped invoice ${invoiceNumber} for ${client.companyName}`);
        generated++;
      }
    } catch (err: any) {
      console.error(`[Invoice] Failed ungrouped invoice for ${client.companyName}:`, err.message);
    }
  }

  return generated;
};

export const generateInvoicesForPeriod = async (
  year: number,
  month: number, // 1-indexed (1 = January)
  io?: Server,
  clientId?: string,
  cronMode: boolean = false,
  invoiceByGroupOverride?: boolean
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0)); // Last day of month

    // When a specific client is requested or admin manual trigger, include all active clients.
    // Only filter by agreement type during cron job (automatic generation).
    const clientWhere: any = clientId ? { id: clientId } : { user: { status: 'ACTIVE' } };
    if (!clientId && cronMode) {
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
        const paymentTermsDays = client.clientPolicies?.paymentTermsDays ?? 15;

        const useGroupWise = invoiceByGroupOverride !== undefined
          ? invoiceByGroupOverride
          : !!client.clientPolicies?.invoiceByGroup;

        if (useGroupWise) {
          // Group-wise invoicing: generate separate invoice per group
          const groupResults = await generateGroupWiseInvoices(
            client as any, periodStart, periodEnd, paymentTermsDays, `INV-${year}-${monthStr}`, io
          );
          generated += groupResults;
        } else {
          const invoiceNumber = `INV-${year}-${monthStr}-${clientPrefix}`;
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
        }
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
  cronMode: boolean = false,
  invoiceByGroupOverride?: boolean
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    const monday = getMondayOfISOWeek(year, week);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const clientWhere: any = clientId ? { id: clientId } : { user: { status: 'ACTIVE' } };
    if (!clientId && cronMode) {
      // Cron job: only WEEKLY agreement clients (BI_WEEKLY handled by separate bi-weekly job)
      clientWhere.agreementType = 'WEEKLY';
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
        const weekStr = String(week).padStart(2, '0');
        const clientPrefix = client.id.substring(0, 6).toUpperCase();
        const paymentTermsDays = client.clientPolicies?.paymentTermsDays ?? 7;

        const useGroupWise = invoiceByGroupOverride !== undefined
          ? invoiceByGroupOverride
          : !!client.clientPolicies?.invoiceByGroup;

        if (useGroupWise) {
          const groupResults = await generateGroupWiseInvoices(
            client as any, monday, sunday, paymentTermsDays, `INV-${year}-W${weekStr}`, io
          );
          generated += groupResults;
        } else {
          const invoiceNumber = `INV-${year}-W${weekStr}-${clientPrefix}`;
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
        }
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
 * Weekly cron handler: runs every Wednesday, generates invoices for the previous week (Mon–Sun)
 * for WEEKLY agreement clients only.
 */
export const runWeeklyInvoiceGeneration = async (io?: Server): Promise<void> => {
  const now = new Date();
  // Get previous week's Monday (Wednesday - 9 days = previous Monday)
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
 * Monthly cron handler: runs on the 3rd of every month, generates invoices for the
 * previous full month (1st–end) for MONTHLY agreement clients.
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

/**
 * Bi-weekly invoice generation for a specific half-month period.
 * half=1: period is 1st–15th; half=2: period is 16th–end of month.
 */
export const generateBiWeeklyInvoicesForPeriod = async (
  year: number,
  month: number, // 1-indexed
  half: 1 | 2,
  io?: Server,
  clientId?: string,
  cronMode: boolean = false,
  invoiceByGroupOverride?: boolean
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  try {
    let periodStart: Date;
    let periodEnd: Date;

    if (half === 1) {
      // 1st – 15th
      periodStart = new Date(Date.UTC(year, month - 1, 1));
      periodEnd = new Date(Date.UTC(year, month - 1, 15));
    } else {
      // 16th – last day of month
      periodStart = new Date(Date.UTC(year, month - 1, 16));
      periodEnd = new Date(Date.UTC(year, month, 0)); // last day of month
    }

    const clientWhere: any = clientId ? { id: clientId } : {
      user: { status: 'ACTIVE' },
      // Always filter to BI_WEEKLY clients — generating half-month invoices for other types is wrong
      agreementType: 'BI_WEEKLY',
    };

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
        const paymentTermsDays = client.clientPolicies?.paymentTermsDays ?? 15;

        const useGroupWise = invoiceByGroupOverride !== undefined
          ? invoiceByGroupOverride
          : !!client.clientPolicies?.invoiceByGroup;

        if (useGroupWise) {
          const groupResults = await generateGroupWiseInvoices(
            client as any, periodStart, periodEnd, paymentTermsDays, `INV-${year}-${monthStr}-H${half}`, io
          );
          generated += groupResults;
        } else {
          const invoiceNumber = `INV-${year}-${monthStr}-H${half}-${clientPrefix}`;
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
        }
      } catch (clientError: any) {
        const errMsg = `Failed to generate bi-weekly invoice for client ${client.companyName}: ${clientError.message}`;
        console.error(`[Invoice] ${errMsg}`);
        errors.push(errMsg);
      }
    }
  } catch (error) {
    console.error('[Invoice] Bi-weekly job failed:', error);
    errors.push(`Job failed: ${(error as Error).message}`);
  }

  return { generated, errors };
};

/**
 * Bi-weekly cron handler: runs on the 3rd and 17th of every month.
 * - 17th: generates invoices for 1st–15th of current month
 * - 3rd: generates invoices for 16th–end of previous month
 */
export const runBiWeeklyInvoiceGeneration = async (io?: Server): Promise<void> => {
  const now = new Date();
  const dayOfMonth = now.getUTCDate();

  let year: number;
  let month: number; // 1-indexed
  let half: 1 | 2;

  if (dayOfMonth >= 15 && dayOfMonth <= 19) {
    // Running on 17th: generate for 1st–15th of current month
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1; // 1-indexed
    half = 1;
  } else {
    // Running on 3rd: generate for 16th–end of previous month
    const prevMonth = new Date(now);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    year = prevMonth.getUTCFullYear();
    month = prevMonth.getUTCMonth() + 1; // 1-indexed
    half = 2;
  }

  console.log(`[Invoice] Starting bi-weekly invoice generation for ${year}-${String(month).padStart(2, '0')} half ${half}`);
  const result = await generateBiWeeklyInvoicesForPeriod(year, month, half, io, undefined, true);
  console.log(`[Invoice] Bi-weekly completed: ${result.generated} invoices generated, ${result.errors.length} errors`);
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
          id: true, firstName: true, lastName: true, billingRate: true, overtimeRate: true,
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
          id: true, firstName: true, lastName: true, billingRate: true, overtimeRate: true,
          groupAssignments: { select: { groupId: true, group: { select: { billingRate: true } } } },
        },
      },
    },
  });

  const allRecords = [...timeRecords, ...lateApprovedOT];
  if (allRecords.length === 0) return null;

  // Fetch approved OvertimeRequests as fallback for TimeRecord fields
  const previewEmpIds = [...new Set(allRecords.map(r => r.employeeId))];
  const previewDates = [...new Set(allRecords.map(r => r.date))];
  const previewApprovedOTRequests = await prisma.overtimeRequest.findMany({
    where: {
      clientId: client.id,
      employeeId: { in: previewEmpIds },
      date: { in: previewDates },
      status: 'APPROVED',
      isAutoGenerated: true,
    },
    select: { employeeId: true, date: true, requestedMinutes: true },
  });
  const previewOTMap = new Map<string, number>();
  for (const ot of previewApprovedOTRequests) {
    const dateKey = new Date(ot.date).toISOString().split('T')[0];
    const key = `${ot.employeeId}_${dateKey}`;
    previewOTMap.set(key, (previewOTMap.get(key) || 0) + (ot.requestedMinutes || 0));
  }

  // Aggregate using TimeRecord fields + OvertimeRequest as fallback
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
    // Fallback: check OvertimeRequest records
    if (approvedOT === 0) {
      const dateKey = new Date(record.date).toISOString().split('T')[0];
      const otKey = `${record.employeeId}_${dateKey}`;
      approvedOT = previewOTMap.get(otKey) || 0;
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
  const rawDefaultOT2 = policy ? Number(policy.defaultOvertimeRate) : 0;
  const defaultOTRate = rawDefaultOT2 > 1 ? rawDefaultOT2 : 0;

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

    let otr = ce?.overtimeRate ? Number(ce.overtimeRate) : 0;
    if (otr === 0 && hr > 0) {
      const empOTMultiplier = employee?.overtimeRate ? Number(employee.overtimeRate) : 1;
      otr = defaultOTRate > 0 ? defaultOTRate : hr * empOTMultiplier;
    } else if (otr === 0) {
      otr = defaultOTRate;
    }

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
    // Fallback: check OvertimeRequest records
    if (approvedOT === 0) {
      const dateKey = new Date(record.date).toISOString().split('T')[0];
      const otKey = `${record.employeeId}_${dateKey}`;
      approvedOT = previewOTMap.get(otKey) || 0;
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
    const regularMin = agg.totalMin - agg.otMin;
    const regularHrs = Math.round((regularMin / 60) * 100) / 100;
    const otHrs = Math.round((agg.otMin / 60) * 100) / 100;
    const regularPay = Math.round((regularMin * rates.hourlyRate / 60) * 100) / 100;
    const overtimePay = Math.round((agg.otMin * rates.overtimeRate / 60) * 100) / 100;
    const lineAmount = regularPay + overtimePay;
    estimatedTotal += lineAmount;

    lineItems.push({
      employeeName: empNameMap.get(empId) || 'Unknown',
      hours: regularHrs,
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
  invoiceByGroupOverride?: boolean,
): Promise<InvoicePreviewItem[]> => {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));

  // Preview always includes all active clients (admin manual action)
  const clientWhere: any = clientId ? { id: clientId } : { user: { status: 'ACTIVE' } };

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
  invoiceByGroupOverride?: boolean,
): Promise<InvoicePreviewItem[]> => {
  const monday = getMondayOfISOWeek(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // Include all active clients for weekly preview (admin manual trigger).
  const clientWhere: any = clientId ? { id: clientId } : { user: { status: 'ACTIVE' } };

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

/**
 * Preview bi-weekly invoice generation (dry run).
 */
export const previewBiWeeklyInvoicesForPeriod = async (
  year: number,
  month: number,
  half: 1 | 2,
  clientId?: string,
  invoiceByGroupOverride?: boolean,
): Promise<InvoicePreviewItem[]> => {
  let periodStart: Date;
  let periodEnd: Date;

  if (half === 1) {
    periodStart = new Date(Date.UTC(year, month - 1, 1));
    periodEnd = new Date(Date.UTC(year, month - 1, 15));
  } else {
    periodStart = new Date(Date.UTC(year, month - 1, 16));
    periodEnd = new Date(Date.UTC(year, month, 0));
  }

  const clientWhere: any = clientId ? { id: clientId } : {
    user: { status: 'ACTIVE' },
    // Only preview BI_WEEKLY clients for half-month periods
    agreementType: 'BI_WEEKLY',
  };

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
    const invoiceNumber = `INV-${year}-${monthStr}-H${half}-${clientPrefix}`;

    const preview = await previewInvoiceForClient(client as any, periodStart, periodEnd, invoiceNumber);
    if (preview) previews.push(preview);
  }
  return previews;
};
