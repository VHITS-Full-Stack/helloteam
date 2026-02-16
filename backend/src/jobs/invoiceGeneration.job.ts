import prisma from '../config/database';
import { createNotification, createBulkNotifications } from '../controllers/notification.controller';
import type { Server } from 'socket.io';

interface EmployeeTimeAggregation {
  employeeId: string;
  employeeName: string;
  totalMinutes: number;
  overtimeMinutes: number;
}

const generateInvoiceNumber = (clientId: string, year: number, month: number): string => {
  const monthStr = String(month).padStart(2, '0');
  const clientPrefix = clientId.substring(0, 6).toUpperCase();
  return `INV-${year}-${monthStr}-${clientPrefix}`;
};

/**
 * Generate invoices for a specific month/year across all clients.
 * Called by the monthly cron job or manually via the admin endpoint.
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

    // Get all active clients with policies and employee assignments
    const clients = await prisma.client.findMany({
      where: { user: { status: 'ACTIVE' } },
      include: {
        clientPolicies: true,
        user: { select: { id: true, email: true } },
        employees: {
          where: { isActive: true },
          select: {
            employeeId: true,
            hourlyRate: true,
            overtimeRate: true,
          },
        },
      },
    });

    for (const client of clients) {
      try {
        // Check if invoice already exists for this client/period
        const invoiceNumber = generateInvoiceNumber(client.id, year, month);
        const existing = await prisma.invoice.findUnique({
          where: { invoiceNumber },
        });
        if (existing) {
          console.log(`[Invoice] Skipping ${invoiceNumber} - already exists`);
          continue;
        }

        // Get approved time records for the period
        const timeRecords = await prisma.timeRecord.findMany({
          where: {
            clientId: client.id,
            status: { in: ['APPROVED', 'AUTO_APPROVED'] },
            date: { gte: periodStart, lte: periodEnd },
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        if (timeRecords.length === 0) continue;

        // Aggregate by employee
        const employeeAgg = new Map<string, EmployeeTimeAggregation>();
        for (const record of timeRecords) {
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

        // Create invoice with line items in a transaction
        const invoice = await prisma.$transaction(async (tx) => {
          return tx.invoice.create({
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
        });

        generated++;

        // Notify the client
        if (policy?.notifyInvoice !== false) {
          const totalFormatted = (Math.round(subtotal * 100) / 100).toFixed(2);
          const monthName = periodStart.toLocaleString('default', { month: 'long' });

          await createNotification(
            client.user.id,
            'INVOICE_GENERATED',
            'Invoice Generated',
            `Invoice ${invoiceNumber} has been generated for ${monthName} ${year}. Total: $${totalFormatted}`,
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
        }

        // Notify all admins and finance users
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

        console.log(
          `[Invoice] Generated ${invoiceNumber} for ${client.companyName}: $${(Math.round(subtotal * 100) / 100).toFixed(2)}`
        );
      } catch (clientError: any) {
        const errMsg = `Failed to generate invoice for client ${client.companyName}: ${clientError.message}`;
        console.error(`[Invoice] ${errMsg}`);
        errors.push(errMsg);
      }
    }
  } catch (error) {
    console.error('[Invoice] Job failed:', error);
    errors.push(`Job failed: ${(error as Error).message}`);
  }

  return { generated, errors };
};

/**
 * Monthly cron handler: generates invoices for the previous month.
 */
export const runMonthlyInvoiceGeneration = async (io?: Server): Promise<void> => {
  const now = new Date();
  const prevMonth = now.getMonth(); // 0-indexed current month = 1-indexed previous month
  const year = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = prevMonth === 0 ? 12 : prevMonth;

  console.log(`[Invoice] Starting monthly invoice generation for ${year}-${String(month).padStart(2, '0')}`);
  const result = await generateInvoicesForPeriod(year, month, io);
  console.log(`[Invoice] Completed: ${result.generated} invoices generated, ${result.errors.length} errors`);
};
