import { Response } from "express";
import prisma from "../config/database";
import { PayrollStatus, AdjustmentType } from "@prisma/client";
import { AuthenticatedRequest } from "../types";
import { notifyPayrollDeadline, createBulkNotifications } from "./notification.controller";
import { sendPayrollReminderEmail } from "../services/email.service";
import { generatePayslips } from "./payslip.controller";

// Helper function to determine readiness status
const getReadinessStatus = (
  approvedPercentage: number,
  daysUntilCutoff: number,
): "ready" | "warning" | "critical" => {
  if (approvedPercentage >= 95 && daysUntilCutoff >= 0) {
    return "ready";
  } else if (approvedPercentage >= 70 || daysUntilCutoff > 3) {
    return "warning";
  }
  return "critical";
};

// Get payroll periods for a client
export const getPayrollPeriods = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { status, limit = 10, offset = 0 } = req.query;

    let clientId: string | undefined;

    if (role === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!client) {
        return res
          .status(404)
          .json({ success: false, error: "Client not found" });
      }
      clientId = client.id;
    }

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    const [periods, total] = await Promise.all([
      prisma.payrollPeriod.findMany({
        where,
        orderBy: { periodStart: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.payrollPeriod.count({ where }),
    ]);

    // Group periods by date range
    const periodGroupMap = new Map<string, any>();
    for (const period of periods) {
      const key = `${period.periodStart.toISOString()}_${period.periodEnd.toISOString()}`;
      if (!periodGroupMap.has(key)) {
        periodGroupMap.set(key, {
          ...period,
        });
      } else {
        const existing = periodGroupMap.get(key);
        // Use the most relevant status (OPEN > LOCKED > FINALIZED)
        const statusPriority: Record<string, number> = { OPEN: 0, LOCKED: 1, FINALIZED: 2 };
        if ((statusPriority[period.status] ?? 99) < (statusPriority[existing.status] ?? 99)) {
          existing.status = period.status;
          existing.id = period.id;
        }
      }
    }

    // Calculate total hours and gross pay
    const groupedPeriods = await Promise.all(
      Array.from(periodGroupMap.values()).map(async (group) => {
        const timeRecords = await prisma.timeRecord.findMany({
          where: {
            date: { gte: group.periodStart, lte: group.periodEnd },
            status: { in: ['APPROVED', 'AUTO_APPROVED'] },
          },
          include: {
            employee: {
              select: {
                billingRate: true,
                deduction: true,
                clientAssignments: {
                  where: { isActive: true },
                  select: { hourlyRate: true, overtimeRate: true, clientId: true },
                },
                groupAssignments: {
                  select: {
                    groupId: true,
                    group: { select: { billingRate: true } },
                  },
                },
              },
            },
          },
        });

        // Fetch client policies and client-group rates for rate resolution
        const periodClientIds = [...new Set(timeRecords.map(r => r.clientId))];
        const [periodPolicies, periodClientGroups] = await Promise.all([
          prisma.clientPolicy.findMany({ where: { clientId: { in: periodClientIds } } }),
          prisma.clientGroup.findMany({
            where: { clientId: { in: periodClientIds } },
            select: { clientId: true, groupId: true, billingRate: true },
          }),
        ]);
        const periodPolicyMap = new Map(periodPolicies.map(p => [p.clientId, p]));
        const periodCGRateMap = new Map(periodClientGroups.map(cg => [`${cg.clientId}-${cg.groupId}`, cg.billingRate ? Number(cg.billingRate) : null]));

        let totalMinutes = 0;
        let totalGrossPay = 0;

        // Group by employee to calculate from totals (matches detail endpoint)
        const empTotals: Record<string, { regularMinutes: number; otMinutes: number; hourlyRate: number; overtimeRate: number; deduction: number }> = {};
        for (const r of timeRecords) {
          const empId = r.employeeId;
          if (!empTotals[empId]) {
            // Resolve rate same way as detail endpoint
            const asn = r.employee?.clientAssignments?.[0];
            const pol = periodPolicyMap.get(r.clientId);
            const empBR = r.employee?.billingRate ? Number(r.employee.billingRate) : null;
            const grpAsn = r.employee?.groupAssignments?.[0];
            const cgRate = grpAsn?.groupId ? (periodCGRateMap.get(`${r.clientId}-${grpAsn.groupId}`) ?? null) : null;
            const grpRate = grpAsn?.group?.billingRate ? Number(grpAsn.group.billingRate) : null;

            const hr = asn?.hourlyRate ? Number(asn.hourlyRate) : empBR ? empBR : cgRate ? cgRate : grpRate ? grpRate : pol?.defaultHourlyRate ? Number(pol.defaultHourlyRate) : 0;
            let otr = asn?.overtimeRate ? Number(asn.overtimeRate) : pol?.defaultOvertimeRate ? Number(pol.defaultOvertimeRate) : 0;
            if (otr === 0 && hr > 0) otr = hr * 1.5;

            empTotals[empId] = { regularMinutes: 0, otMinutes: 0, hourlyRate: hr, overtimeRate: otr, deduction: r.employee?.deduction ? Number(r.employee.deduction) : 0 };
          }

          let approvedOT = 0;
          if ((r as any).shiftExtensionStatus === 'APPROVED') approvedOT += (r as any).shiftExtensionMinutes || 0;
          if ((r as any).extraTimeStatus === 'APPROVED') approvedOT += (r as any).extraTimeMinutes || 0;
          const deniedOT = Math.max(0, (r.overtimeMinutes || 0) - approvedOT);
          const payableMinutes = Math.max(0, (r.totalMinutes || 0) - deniedOT);

          empTotals[empId].regularMinutes += payableMinutes - approvedOT;
          empTotals[empId].otMinutes += approvedOT;
          totalMinutes += payableMinutes;
        }

        // Calculate pay from total hours per employee
        const employeeIds: string[] = [];
        for (const [empId, emp] of Object.entries(empTotals)) {
          employeeIds.push(empId);
          const regularHours = Math.round((emp.regularMinutes / 60) * 100) / 100;
          const overtimeHours = Math.round((emp.otMinutes / 60) * 100) / 100;
          totalGrossPay += Math.round(regularHours * emp.hourlyRate * 100) / 100;
          totalGrossPay += Math.round(overtimeHours * emp.overtimeRate * 100) / 100;
          totalGrossPay -= emp.deduction;
        }

        // Add bonuses, subtract adjustment deductions
        const adjustments = await prisma.payrollAdjustment.findMany({
          where: {
            employeeId: { in: employeeIds },
            periodStart: { gte: new Date(group.periodStart.getTime() - 86400000), lte: new Date(group.periodStart.getTime() + 86400000) },
            periodEnd: { gte: new Date(group.periodEnd.getTime() - 86400000), lte: new Date(group.periodEnd.getTime() + 86400000) },
          },
        });
        for (const adj of adjustments) {
          if (adj.type === 'BONUS') totalGrossPay += Number(adj.amount);
          else totalGrossPay -= Number(adj.amount);
        }

        return {
          ...group,
          totalHours: Math.round((totalMinutes / 60) * 100) / 100,
          grossPay: Math.max(0, Math.round(totalGrossPay * 100) / 100),
        };
      }),
    );

    res.json({
      success: true,
      data: {
        periods: groupedPeriods,
        total: groupedPeriods.length,
      },
    });
  } catch (error) {
    console.error("Get payroll periods error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch payroll periods" });
  }
};

// Create a payroll period
export const createPayrollPeriod = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { clientId, periodStart, periodEnd, cutoffDate, notes } = req.body;

    if (!clientId || !periodStart || !periodEnd || !cutoffDate) {
      return res.status(400).json({
        success: false,
        error:
          "Client ID, period start, period end, and cutoff date are required",
      });
    }

    // Check for overlapping periods
    const overlapping = await prisma.payrollPeriod.findFirst({
      where: {
        clientId,
        OR: [
          {
            periodStart: { lte: new Date(periodEnd) },
            periodEnd: { gte: new Date(periodStart) },
          },
        ],
      },
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: "A payroll period already exists for this date range",
      });
    }

    const period = await prisma.payrollPeriod.create({
      data: {
        clientId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        cutoffDate: new Date(cutoffDate),
        notes,
      },
    });

    res.status(201).json({
      success: true,
      data: period,
    });
  } catch (error) {
    console.error("Create payroll period error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create payroll period" });
  }
};

// Finalize a payroll period
export const finalizePayrollPeriod = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res
        .status(404)
        .json({ success: false, error: "Payroll period not found" });
    }

    if (period.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        error: "Only open payroll periods can be finalized",
      });
    }

    // Calculate totals from approved time records
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId: period.clientId,
        date: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
      },
    });

    // Only count payable time: regular hours + approved OT (denied OT deducted)
    const approvedMinutes = timeRecords
      .filter((r) => r.status === "APPROVED" || r.status === "AUTO_APPROVED")
      .reduce((sum, r) => {
        let approvedOT = 0;
        if (r.shiftExtensionStatus === "APPROVED")
          approvedOT += r.shiftExtensionMinutes || 0;
        if (r.extraTimeStatus === "APPROVED")
          approvedOT += r.extraTimeMinutes || 0;
        const deniedOT = Math.max(0, (r.overtimeMinutes || 0) - approvedOT);
        return sum + Math.max(0, (r.totalMinutes || 0) - deniedOT);
      }, 0);

    const pendingMinutes = timeRecords
      .filter((r) => r.status === "PENDING")
      .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

    const totalMinutes = approvedMinutes + pendingMinutes;

    // Check for pending OT
    const pendingOTCount = timeRecords.filter(
      (r) => r.status === "PENDING" && (r.overtimeMinutes || 0) > 0,
    ).length;

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedBy: userId,
        approvedHours: approvedMinutes / 60,
        pendingHours: pendingMinutes / 60,
        totalHours: totalMinutes / 60,
      },
    });

    // Generate payslips for all employees in this period
    const payslipResult = await generatePayslips(
      period.periodStart,
      period.periodEnd,
    );

    const warnings: string[] = [];
    if (pendingOTCount > 0) {
      warnings.push(
        `${pendingOTCount} pending OT record(s) were excluded. If approved later, they will be adjusted in the next payroll period.`,
      );
    }
    if (payslipResult.errors.length > 0) {
      warnings.push(...payslipResult.errors);
    }

    res.json({
      success: true,
      data: updated,
      payslips: { generated: payslipResult.generated },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error("Finalize payroll period error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to finalize payroll period" });
  }
};

// Send unapproved OT reminders to clients and employees
export const sendPayrollReminders = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    // Find all pending OT requests
    const pendingOT = await prisma.overtimeRequest.findMany({
      where: {
        status: 'PENDING',
      },
      select: {
        id: true,
        clientId: true,
        employeeId: true,
        requestedMinutes: true,
        date: true,
      },
    });

    if (pendingOT.length === 0) {
      return res.json({
        success: true,
        data: { clientsNotified: 0, employeesNotified: 0 },
        message: 'No pending OT to send reminders for.',
      });
    }

    // Group by client
    const byClient: Record<string, { clientId: string; employeeIds: Set<string>; count: number; totalMinutes: number }> = {};
    for (const ot of pendingOT) {
      if (!byClient[ot.clientId]) {
        byClient[ot.clientId] = { clientId: ot.clientId, employeeIds: new Set(), count: 0, totalMinutes: 0 };
      }
      byClient[ot.clientId].employeeIds.add(ot.employeeId);
      byClient[ot.clientId].count++;
      byClient[ot.clientId].totalMinutes += ot.requestedMinutes || 0;
    }

    let clientsNotified = 0;
    let employeesNotified = 0;

    for (const group of Object.values(byClient)) {
      // Notify the client
      const client = await prisma.client.findUnique({
        where: { id: group.clientId },
        include: { user: { select: { id: true, email: true } } },
      });

      if (client) {
        const totalHours = Math.round((group.totalMinutes / 60) * 100) / 100;
        await createBulkNotifications(
          [client.user.id],
          'PAYROLL_REMINDER',
          'Unapproved Overtime — Action Required',
          `You have ${group.count} unapproved overtime ${group.count === 1 ? 'entry' : 'entries'} (${totalHours}h total) pending approval. Please review and approve before payroll processing.`,
          { count: group.count, totalMinutes: group.totalMinutes },
          '/client/approvals?type=auto-overtime'
        );

        const clientName = client.contactPerson || client.companyName;
        await sendPayrollReminderEmail(
          client.user.email,
          clientName,
          0,
          group.count,
          'as soon as possible',
        ).catch((err: any) => console.error('Failed to send client OT reminder email:', err));

        clientsNotified++;
      }

      // Notify each employee with pending OT
      const employees = await prisma.employee.findMany({
        where: { id: { in: Array.from(group.employeeIds) } },
        select: { id: true, userId: true, firstName: true },
      });

      const employeeUserIds = employees.map(e => e.userId);
      if (employeeUserIds.length > 0) {
        await createBulkNotifications(
          employeeUserIds,
          'PAYROLL_REMINDER',
          'Overtime Pending Approval',
          'You have overtime entries pending client approval. Please ensure your time entries are accurate. Contact your manager if you have questions.',
          {},
          '/employee/payslips'
        );
        employeesNotified += employeeUserIds.length;
      }
    }

    res.json({
      success: true,
      data: { clientsNotified, employeesNotified },
      message: `Reminders sent to ${clientsNotified} client(s) and ${employeesNotified} employee(s).`,
    });
  } catch (error) {
    console.error("Send payroll reminders error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to send payroll reminders" });
  }
};

// Get current payroll period for a client
export const getCurrentPayrollPeriod = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    let clientId: string | undefined;

    if (role === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!client) {
        return res
          .status(404)
          .json({ success: false, error: "Client not found" });
      }
      clientId = client.id;
    } else if (role === "EMPLOYEE") {
      // Find the employee's active client assignment
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!employee) {
        return res
          .status(404)
          .json({ success: false, error: "Employee not found" });
      }
      const assignment = await prisma.clientEmployee.findFirst({
        where: { employeeId: employee.id, isActive: true },
        select: { clientId: true },
        orderBy: { assignedAt: 'desc' },
      });
      if (assignment) {
        clientId = assignment.clientId;
      }
    } else {
      clientId = req.query.clientId as string;
    }

    if (!clientId) {
      return res
        .status(400)
        .json({ success: false, error: "Client ID is required" });
    }

    const today = new Date();
    const currentPeriod = await prisma.payrollPeriod.findFirst({
      where: {
        clientId,
        periodStart: { lte: today },
        periodEnd: { gte: today },
        status: "OPEN",
      },
    });

    if (!currentPeriod) {
      return res.json({
        success: true,
        data: null,
        message: "No active payroll period found",
      });
    }

    // Calculate statistics
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        clientId,
        date: {
          gte: currentPeriod.periodStart,
          lte: currentPeriod.periodEnd,
        },
      },
    });

    const totalMinutes = timeRecords.reduce(
      (sum, r) => sum + (r.totalMinutes || 0),
      0,
    );
    const approvedMinutes = timeRecords
      .filter((r) => r.status === "APPROVED" || r.status === "AUTO_APPROVED")
      .reduce((sum, r) => sum + (r.totalMinutes || 0), 0);

    const stats = {
      totalRecords: timeRecords.length,
      pending: timeRecords.filter((r) => r.status === "PENDING").length,
      approved: timeRecords.filter(
        (r) => r.status === "APPROVED" || r.status === "AUTO_APPROVED",
      ).length,
      rejected: timeRecords.filter((r) => r.status === "REJECTED").length,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      approvedHours: Math.round((approvedMinutes / 60) * 100) / 100,
    };

    // Days until cutoff
    const cutoff = new Date(currentPeriod.cutoffDate);
    const daysUntilCutoff = Math.ceil(
      (cutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    res.json({
      success: true,
      data: {
        ...currentPeriod,
        stats,
        daysUntilCutoff,
      },
    });
  } catch (error) {
    console.error("Get current payroll period error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch current payroll period",
      });
  }
};

// Get payroll readiness dashboard (all clients overview)
export const getPayrollReadinessDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { periodStart, periodEnd } = req.query;

    // Default to current biweekly period if not specified
    const today = new Date();
    const defaultStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() <= 15 ? 1 : 16,
    );
    const defaultEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() <= 15
        ? 15
        : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    );

    const startDate = periodStart
      ? new Date(periodStart as string)
      : defaultStart;
    const endDate = periodEnd ? new Date(periodEnd as string) : defaultEnd;

    // Get all active clients
    const clients = await prisma.client.findMany({
      where: {
        user: { status: "ACTIVE" },
      },
      include: {
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Get payroll periods for the date range
    const periods = await prisma.payrollPeriod.findMany({
      where: {
        periodStart: { lte: endDate },
        periodEnd: { gte: startDate },
      },
    });

    // Calculate stats per client
    const clientStats = await Promise.all(
      clients.map(async (client) => {
        const period = periods.find((p) => p.clientId === client.id);

        // Get time records for this client in the period
        const timeRecords = await prisma.timeRecord.findMany({
          where: {
            clientId: client.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            adjustments: {
              where: {
                requiresReapproval: true,
                clientReapprovedAt: null,
              },
            },
          },
        });

        const totalMinutes = timeRecords.reduce(
          (sum, r) => sum + (r.totalMinutes || 0),
          0,
        );
        const overtimeMinutes = timeRecords.reduce(
          (sum, r) => sum + (r.overtimeMinutes || 0),
          0,
        );
        const approvedRecords = timeRecords.filter(
          (r) => r.status === "APPROVED" || r.status === "AUTO_APPROVED",
        );
        const pendingRecords = timeRecords.filter(
          (r) => r.status === "PENDING",
        );
        const rejectedRecords = timeRecords.filter(
          (r) => r.status === "REJECTED",
        );
        const disputedRecords = timeRecords.filter(
          (r) => r.adjustments.length > 0,
        );

        const approvedMinutes = approvedRecords.reduce(
          (sum, r) => sum + (r.totalMinutes || 0),
          0,
        );
        const pendingMinutes = pendingRecords.reduce(
          (sum, r) => sum + (r.totalMinutes || 0),
          0,
        );

        // Calculate readiness
        const totalRecords = timeRecords.length;
        const approvedPercentage =
          totalRecords > 0
            ? (approvedRecords.length / totalRecords) * 100
            : 100;

        // Days until cutoff
        const cutoffDate =
          period?.cutoffDate ||
          new Date(endDate.getTime() + 2 * 24 * 60 * 60 * 1000);
        const daysUntilCutoff = Math.ceil(
          (cutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const readiness = getReadinessStatus(
          approvedPercentage,
          daysUntilCutoff,
        );

        return {
          clientId: client.id,
          companyName: client.companyName,
          employeeCount: client.employees.length,
          periodStatus: period?.status || "OPEN",
          totalHours: Math.round((totalMinutes / 60) * 100) / 100,
          approvedHours: Math.round((approvedMinutes / 60) * 100) / 100,
          pendingHours: Math.round((pendingMinutes / 60) * 100) / 100,
          overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
          totalRecords,
          approvedRecords: approvedRecords.length,
          pendingRecords: pendingRecords.length,
          rejectedRecords: rejectedRecords.length,
          disputedRecords: disputedRecords.length,
          approvedPercentage: Math.round(approvedPercentage),
          daysUntilCutoff,
          cutoffDate,
          readiness,
          isLocked:
            period?.status === "LOCKED" || period?.status === "FINALIZED",
        };
      }),
    );

    // Calculate overall summary
    const summary = {
      totalClients: clientStats.length,
      totalEmployees: clientStats.reduce((sum, c) => sum + c.employeeCount, 0),
      totalHours:
        Math.round(
          clientStats.reduce((sum, c) => sum + c.totalHours, 0) * 100,
        ) / 100,
      approvedHours:
        Math.round(
          clientStats.reduce((sum, c) => sum + c.approvedHours, 0) * 100,
        ) / 100,
      pendingHours:
        Math.round(
          clientStats.reduce((sum, c) => sum + c.pendingHours, 0) * 100,
        ) / 100,
      overtimeHours:
        Math.round(
          clientStats.reduce((sum, c) => sum + c.overtimeHours, 0) * 100,
        ) / 100,
      readyClients: clientStats.filter((c) => c.readiness === "ready").length,
      warningClients: clientStats.filter((c) => c.readiness === "warning")
        .length,
      criticalClients: clientStats.filter((c) => c.readiness === "critical")
        .length,
      totalUnapproved: clientStats.reduce(
        (sum, c) => sum + c.pendingRecords,
        0,
      ),
      totalDisputed: clientStats.reduce((sum, c) => sum + c.disputedRecords, 0),
    };

    res.json({
      success: true,
      data: {
        periodStart: startDate,
        periodEnd: endDate,
        summary,
        clients: clientStats,
      },
    });
  } catch (error) {
    console.error("Get payroll readiness dashboard error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch payroll readiness dashboard",
      });
  }
};

// Get unapproved time records
export const getUnapprovedTimeRecords = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const {
      clientId,
      periodStart,
      periodEnd,
      limit = 100,
      offset = 0,
    } = req.query;

    // Default to current biweekly period
    const today = new Date();
    const defaultStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() <= 15 ? 1 : 16,
    );
    const defaultEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() <= 15
        ? 15
        : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    );

    const where: any = {
      status: "PENDING",
      date: {
        gte: periodStart ? new Date(periodStart as string) : defaultStart,
        lte: periodEnd ? new Date(periodEnd as string) : defaultEnd,
      },
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    const [records, total] = await Promise.all([
      prisma.timeRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: true,
            },
          },
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.timeRecord.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        records,
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error("Get unapproved time records error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch unapproved time records",
      });
  }
};

// Get disputed time records (adjusted but not re-approved)
export const getDisputedTimeRecords = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { clientId, limit = 100, offset = 0 } = req.query;

    // Find time records with pending re-approval adjustments
    const adjustmentsWhere: any = {
      requiresReapproval: true,
      clientReapprovedAt: null,
    };

    const timeRecordWhere: any = {};
    if (clientId) {
      timeRecordWhere.clientId = clientId as string;
    }

    const records = await prisma.timeRecord.findMany({
      where: {
        ...timeRecordWhere,
        adjustments: {
          some: adjustmentsWhere,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
        adjustments: {
          where: adjustmentsWhere,
          orderBy: { adjustedAt: "desc" },
          include: {
            adjuster: {
              select: {
                id: true,
                email: true,
                admin: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.timeRecord.count({
      where: {
        ...timeRecordWhere,
        adjustments: {
          some: adjustmentsWhere,
        },
      },
    });

    res.json({
      success: true,
      data: {
        records,
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error("Get disputed time records error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch disputed time records" });
  }
};

// Lock payroll period
export const lockPayrollPeriod = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res
        .status(404)
        .json({ success: false, error: "Payroll period not found" });
    }

    if (period.status === "FINALIZED") {
      return res.status(400).json({
        success: false,
        error: "Cannot lock a finalized payroll period",
      });
    }

    if (period.status === "LOCKED") {
      return res.status(400).json({
        success: false,
        error: "Payroll period is already locked",
      });
    }

    // Check for pending items
    const pendingCount = await prisma.timeRecord.count({
      where: {
        clientId: period.clientId,
        date: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
        status: "PENDING",
      },
    });

    // Allow locking even with pending items, but warn
    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: "LOCKED",
        notes:
          pendingCount > 0
            ? `Locked with ${pendingCount} pending time records`
            : period.notes,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: userId!,
        action: "UPDATE",
        entityType: "PayrollPeriod",
        entityId: id,
        description: `Locked payroll period for ${period.periodStart.toISOString().split("T")[0]} to ${period.periodEnd.toISOString().split("T")[0]}`,
        oldValues: { status: period.status },
        newValues: { status: "LOCKED" },
      },
    });

    res.json({
      success: true,
      data: updatedPeriod,
      warning:
        pendingCount > 0
          ? `Period locked with ${pendingCount} pending time records`
          : undefined,
    });
  } catch (error) {
    console.error("Lock payroll period error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to lock payroll period" });
  }
};

// Unlock payroll period
export const unlockPayrollPeriod = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: "Reason is required to unlock a payroll period",
      });
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res
        .status(404)
        .json({ success: false, error: "Payroll period not found" });
    }

    if (period.status === "FINALIZED") {
      return res.status(400).json({
        success: false,
        error: "Cannot unlock a finalized payroll period",
      });
    }

    if (period.status !== "LOCKED") {
      return res.status(400).json({
        success: false,
        error: "Payroll period is not locked",
      });
    }

    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: "OPEN",
        notes: `Unlocked: ${reason}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: userId!,
        action: "UPDATE",
        entityType: "PayrollPeriod",
        entityId: id,
        description: `Unlocked payroll period - Reason: ${reason}`,
        oldValues: { status: "LOCKED" },
        newValues: { status: "OPEN" },
      },
    });

    res.json({
      success: true,
      data: updatedPeriod,
    });
  } catch (error) {
    console.error("Unlock payroll period error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to unlock payroll period" });
  }
};

// Get payroll export data
export const getPayrollExportData = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { periodStart, periodEnd, clientId, format = "json" } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: "Period start and end dates are required",
      });
    }

    const where: any = {
      date: {
        gte: new Date(periodStart as string),
        lte: new Date(periodEnd as string),
      },
      status: { in: ["APPROVED", "AUTO_APPROVED"] }, // Export all approved records
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    const records = await prisma.timeRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            billingRate: true,
            user: {
              select: { email: true },
            },
            groupAssignments: {
              select: {
                groupId: true,
                group: {
                  select: { billingRate: true },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { employee: { lastName: "asc" } }],
    });

    // Fetch client policies and assignments for rate calculation
    const clientIds = [...new Set(records.map((r) => r.clientId))];
    const employeeIds = [...new Set(records.map((r) => r.employeeId))];

    const [clientPolicies, assignments, clientGroupRecords] = await Promise.all(
      [
        prisma.clientPolicy.findMany({
          where: { clientId: { in: clientIds } },
        }),
        prisma.clientEmployee.findMany({
          where: {
            clientId: { in: clientIds },
            employeeId: { in: employeeIds },
            isActive: true,
          },
        }),
        prisma.clientGroup.findMany({
          where: { clientId: { in: clientIds } },
          select: { clientId: true, groupId: true, billingRate: true },
        }),
      ],
    );

    const policyMap = new Map(clientPolicies.map((p) => [p.clientId, p]));
    const assignmentMap = new Map(
      assignments.map((a) => [`${a.clientId}-${a.employeeId}`, a]),
    );
    const clientGroupRateMap = new Map(
      clientGroupRecords.map((cg) => [
        `${cg.clientId}-${cg.groupId}`,
        cg.billingRate ? Number(cg.billingRate) : null,
      ]),
    );

    // Fetch payroll adjustments for this period
    const pStart = new Date((periodStart as string) + "T12:00:00Z");
    const pEnd = new Date((periodEnd as string) + "T12:00:00Z");
    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: { in: employeeIds },
        periodStart: {
          gte: new Date(pStart.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(pStart.getTime() + 24 * 60 * 60 * 1000),
        },
        periodEnd: {
          gte: new Date(pEnd.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(pEnd.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    const adjustmentsByEmployee: Record<string, any[]> = {};
    adjustments.forEach((adj) => {
      if (!adjustmentsByEmployee[adj.employeeId]) {
        adjustmentsByEmployee[adj.employeeId] = [];
      }
      adjustmentsByEmployee[adj.employeeId].push(adj);
    });

    // Fetch billing rate change history for date-effective rate lookup
    const rateChangeHistory = employeeIds.length > 0
      ? await prisma.rateChangeHistory.findMany({
          where: {
            employeeId: { in: employeeIds },
            rateType: 'BILLING_RATE',
          },
          orderBy: { changeDate: 'asc' },
        })
      : [];

    // Build rate timeline per employee: sorted list of { date, rate }
    const empRateTimeline = new Map<string, { date: Date; rate: number }[]>();
    for (const change of rateChangeHistory) {
      const timeline = empRateTimeline.get(change.employeeId) || [];
      timeline.push({
        date: new Date(change.changeDate),
        rate: change.newValue ? Number(change.newValue) : 0,
      });
      empRateTimeline.set(change.employeeId, timeline);
    }

    // Get the current/fallback rate for an employee
    const getFallbackRate = (record: any): { hourlyRate: number; overtimeRate: number } => {
      const assignment = assignmentMap.get(`${record.clientId}-${record.employeeId}`);
      const policy = policyMap.get(record.clientId);
      const employeeBillingRate = record.employee.billingRate ? Number(record.employee.billingRate) : null;
      const groupAssignment = record.employee.groupAssignments?.[0];
      const clientGroupBillingRate = groupAssignment?.groupId
        ? (clientGroupRateMap.get(`${record.clientId}-${groupAssignment.groupId}`) ?? null) : null;
      const groupBillingRate = groupAssignment?.group?.billingRate ? Number(groupAssignment.group.billingRate) : null;

      const hr = assignment?.hourlyRate ? Number(assignment.hourlyRate)
        : employeeBillingRate ? employeeBillingRate
        : clientGroupBillingRate ? clientGroupBillingRate
        : groupBillingRate ? groupBillingRate
        : policy?.defaultHourlyRate ? Number(policy.defaultHourlyRate) : 0;

      let otr = assignment?.overtimeRate ? Number(assignment.overtimeRate)
        : policy?.defaultOvertimeRate ? Number(policy.defaultOvertimeRate) : 0;
      if (otr === 0 && hr > 0) otr = hr * 1.5;

      return { hourlyRate: hr, overtimeRate: otr };
    };

    // Get effective billing rate for an employee on a specific date
    const getRateForDate = (empId: string, recordDate: Date, record: any): { hourlyRate: number; overtimeRate: number } => {
      const timeline = empRateTimeline.get(empId);
      if (!timeline || timeline.length === 0) {
        return getFallbackRate(record);
      }

      // Find the most recent rate change on or before this date
      let effectiveRate: number | null = null;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].date <= recordDate) {
          effectiveRate = timeline[i].rate;
          break;
        }
      }

      // If no change before this date, use old value from earliest change
      if (effectiveRate === null) {
        const firstChange = rateChangeHistory.find(c => c.employeeId === empId && c.rateType === 'BILLING_RATE');
        if (firstChange?.oldValue) {
          effectiveRate = Number(firstChange.oldValue);
        } else {
          return getFallbackRate(record);
        }
      }

      const hr = effectiveRate || 0;
      const assignment = assignmentMap.get(`${record.clientId}-${record.employeeId}`);
      const policy = policyMap.get(record.clientId);
      let otr = assignment?.overtimeRate ? Number(assignment.overtimeRate)
        : policy?.defaultOvertimeRate ? Number(policy.defaultOvertimeRate) : 0;
      if (otr === 0 && hr > 0) otr = hr * 1.5;

      return { hourlyRate: hr, overtimeRate: otr };
    };

    // Group by employee and calculate per-record pay with date-effective rates
    const employeeData: Record<string, any> = {};

    records.forEach((record) => {
      const empId = record.employeeId;
      const rates = getRateForDate(empId, new Date(record.date), record);

      if (!employeeData[empId]) {
        employeeData[empId] = {
          employeeId: empId,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
          email: record.employee.user?.email || "",
          client: record.client.companyName,
          clientId: record.client.id,
          records: [],
          totalMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          breakMinutes: 0,
          workDays: 0,
          hourlyRate: rates.hourlyRate,
          overtimeRate: rates.overtimeRate,
          _regularPay: 0,
          _overtimePay: 0,
          // Track per-rate-period breakdown for CSV split rows
          _ratePeriods: {} as Record<string, { rate: number; otRate: number; regularMinutes: number; otMinutes: number; workDays: number; regularPay: number; otPay: number; minDate: string; maxDate: string }>,
        };
      }

      // Only include approved OT in export (denied OT excluded from payable time)
      let approvedOT = 0;
      if (record.shiftExtensionStatus === "APPROVED")
        approvedOT += record.shiftExtensionMinutes || 0;
      if (record.extraTimeStatus === "APPROVED")
        approvedOT += record.extraTimeMinutes || 0;
      const deniedOT = Math.max(0, (record.overtimeMinutes || 0) - approvedOT);
      const payableMinutes = Math.max(0, (record.totalMinutes || 0) - deniedOT);
      const payableRegular = payableMinutes - approvedOT;

      // Calculate pay for this record using its date-effective rate
      // Regular hours × hourly rate, OT hours × overtime rate (round only final total)
      const recRegularPay = (payableRegular / 60) * rates.hourlyRate;
      const recOTPay = (approvedOT / 60) * rates.overtimeRate;
      employeeData[empId]._regularPay += recRegularPay;
      employeeData[empId]._overtimePay += recOTPay;

      // Track per-rate breakdown
      const rateKey = `${rates.hourlyRate}`;
      if (!employeeData[empId]._ratePeriods[rateKey]) {
        employeeData[empId]._ratePeriods[rateKey] = {
          rate: rates.hourlyRate, otRate: rates.overtimeRate,
          regularMinutes: 0, otMinutes: 0, workDays: 0,
          regularPay: 0, otPay: 0,
          minDate: '', maxDate: '',
        };
      }
      const rp = employeeData[empId]._ratePeriods[rateKey];
      rp.regularMinutes += payableRegular;
      rp.otMinutes += approvedOT;
      rp.workDays += 1;
      rp.regularPay += recRegularPay;
      rp.otPay += recOTPay;
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      if (!rp.minDate || dateStr < rp.minDate) rp.minDate = dateStr;
      if (!rp.maxDate || dateStr > rp.maxDate) rp.maxDate = dateStr;

      employeeData[empId].records.push({
        date: record.date,
        totalMinutes: payableMinutes,
        regularMinutes: payableRegular,
        overtimeMinutes: approvedOT,
        breakMinutes: record.breakMinutes || 0,
      });

      employeeData[empId].totalMinutes += payableMinutes;
      employeeData[empId].regularMinutes += payableRegular;
      employeeData[empId].overtimeMinutes += approvedOT;
      employeeData[empId].breakMinutes += record.breakMinutes || 0;
      employeeData[empId].workDays += 1;
    });

    // Convert to array and calculate hours, pay, and adjustments
    const exportData = Object.values(employeeData).map((emp: any) => {
      const totalHours = Math.round((emp.totalMinutes / 60) * 100) / 100;
      const regularHours = Math.round((emp.regularMinutes / 60) * 100) / 100;
      const overtimeHours = Math.round((emp.overtimeMinutes / 60) * 100) / 100;
      const breakHours = Math.round((emp.breakMinutes / 60) * 100) / 100;

      // Calculate pay from total hours × rate (matches detail endpoint)
      const regularPay = Math.round(regularHours * emp.hourlyRate * 100) / 100;
      const overtimePay = Math.round(overtimeHours * emp.overtimeRate * 100) / 100;

      const empAdjustments = adjustmentsByEmployee[emp.employeeId] || [];
      const totalBonuses =
        Math.round(
          empAdjustments
            .filter((a: any) => a.type === "BONUS")
            .reduce((sum: number, a: any) => sum + Number(a.amount), 0) * 100,
        ) / 100;
      const totalDeductions =
        Math.round(
          empAdjustments
            .filter((a: any) => a.type === "DEDUCTION")
            .reduce((sum: number, a: any) => sum + Number(a.amount), 0) * 100,
        ) / 100;

      const grossPay = Math.max(0,
        Math.round(
          (regularPay + overtimePay + totalBonuses - totalDeductions) * 100,
        ) / 100);

      return {
        ...emp,
        totalHours,
        regularHours,
        overtimeHours,
        breakHours,
        regularPay,
        overtimePay,
        totalBonuses,
        totalDeductions,
        grossPay,
      };
    });

    // Calculate totals
    const totals = {
      totalEmployees: exportData.length,
      totalHours:
        Math.round(exportData.reduce((sum, e) => sum + e.totalHours, 0) * 100) /
        100,
      regularHours:
        Math.round(
          exportData.reduce((sum, e) => sum + e.regularHours, 0) * 100,
        ) / 100,
      overtimeHours:
        Math.round(
          exportData.reduce((sum, e) => sum + e.overtimeHours, 0) * 100,
        ) / 100,
      breakHours:
        Math.round(exportData.reduce((sum, e) => sum + e.breakHours, 0) * 100) /
        100,
      totalRecords: records.length,
      totalGrossPay:
        Math.round(exportData.reduce((sum, e) => sum + e.grossPay, 0) * 100) /
        100,
      totalBonuses:
        Math.round(
          exportData.reduce((sum, e) => sum + e.totalBonuses, 0) * 100,
        ) / 100,
      totalDeductions:
        Math.round(
          exportData.reduce((sum, e) => sum + e.totalDeductions, 0) * 100,
        ) / 100,
    };

    if (format === "csv") {
      const escapeCsv = (val: any) => {
        const str = String(val ?? "");
        return str.includes(",") || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };
      const fmtMoney = (val: number) => `$${val.toFixed(2)}`;

      const lines: string[] = [];

      // Employee table
      const csvHeaders = [
        "Employee Name",
        "Period",
        "Client",
        "Work Days",
        "Total Hours",
        "OT Hours",
        "Rate",
        "Gross Pay",
      ];
      lines.push(csvHeaders.join(","));

      const fmtShortDate = (d: string) => {
        const dt = new Date(d + 'T00:00:00Z');
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      };

      for (const emp of exportData) {
        const ratePeriods = Object.values(emp._ratePeriods || {}) as any[];
        const hasMultipleRates = ratePeriods.length > 1;

        if (hasMultipleRates) {
          for (const rp of ratePeriods) {
            const totalHrs = Math.round((rp.regularMinutes / 60) * 100) / 100;
            const otHrs = Math.round((rp.otMinutes / 60) * 100) / 100;
            const periodLabel = `${fmtShortDate(rp.minDate)} - ${fmtShortDate(rp.maxDate)}`;

            lines.push([
              escapeCsv(`${emp.firstName} ${emp.lastName}`),
              escapeCsv(periodLabel),
              escapeCsv(emp.client),
              rp.workDays,
              totalHrs,
              otHrs > 0 ? otHrs : '-',
              fmtMoney(rp.rate),
              fmtMoney(Math.round((rp.regularPay + rp.otPay) * 100) / 100),
            ].join(","));
          }
          lines.push([
            escapeCsv(`${emp.firstName} ${emp.lastName} - TOTAL`),
            "",
            escapeCsv(emp.client),
            emp.workDays,
            emp.totalHours,
            emp.overtimeHours > 0 ? emp.overtimeHours : '-',
            "",
            fmtMoney(emp.grossPay),
          ].join(","));
        } else {
          lines.push([
            escapeCsv(`${emp.firstName} ${emp.lastName}`),
            "",
            escapeCsv(emp.client),
            emp.workDays,
            emp.totalHours,
            emp.overtimeHours > 0 ? emp.overtimeHours : '-',
            fmtMoney(emp.hourlyRate),
            fmtMoney(emp.grossPay),
          ].join(","));
        }
      }

      lines.push([
        "TOTAL",
        "",
        "",
        "",
        totals.totalHours,
        totals.overtimeHours > 0 ? totals.overtimeHours : '-',
        "",
        fmtMoney(totals.totalGrossPay),
      ].join(","));

      const csv = lines.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=payroll-report-${periodStart}-to-${periodEnd}.csv`,
      );
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        periodStart,
        periodEnd,
        totals,
        employees: exportData,
      },
    });
  } catch (error) {
    console.error("Get payroll export data error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate payroll export" });
  }
};

// Get employee payroll summary for a period
export const getEmployeePayrollSummary = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { periodStart, periodEnd, clientId } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: "Period start and end dates are required",
      });
    }

    const where: any = {
      date: {
        gte: new Date(periodStart as string),
        lte: new Date(periodEnd as string),
      },
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    // Fetch time records
    const records = await prisma.timeRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            billingRate: true,
            overtimeRate: true,
            deduction: true,
            groupAssignments: {
              select: {
                groupId: true,
                group: {
                  select: {
                    billingRate: true,
                  },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    // Fetch client policies for rates
    const clientIds = [...new Set(records.map((r) => r.clientId))];
    const clientPolicies = await prisma.clientPolicy.findMany({
      where: { clientId: { in: clientIds } },
    });
    const policyMap = new Map(clientPolicies.map((p) => [p.clientId, p]));

    // Fetch employee assignments for rate overrides
    const employeeIds = [...new Set(records.map((r) => r.employeeId))];
    const assignments = await prisma.clientEmployee.findMany({
      where: {
        clientId: { in: clientIds },
        employeeId: { in: employeeIds },
        isActive: true,
      },
    });
    const assignmentMap = new Map(
      assignments.map((a) => [`${a.clientId}-${a.employeeId}`, a]),
    );

    // Fetch client-group billing rates
    const clientGroupRecords = await prisma.clientGroup.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, groupId: true, billingRate: true },
    });
    const clientGroupRateMap = new Map(
      clientGroupRecords.map((cg) => [
        `${cg.clientId}-${cg.groupId}`,
        cg.billingRate ? Number(cg.billingRate) : null,
      ]),
    );

    // Fetch billing rate change history for date-effective rate lookup
    const rateChangeHistory2 = employeeIds.length > 0
      ? await prisma.rateChangeHistory.findMany({
          where: { employeeId: { in: employeeIds }, rateType: 'BILLING_RATE' },
          orderBy: { changeDate: 'asc' },
        })
      : [];

    const empRateTimeline2 = new Map<string, { date: Date; rate: number }[]>();
    for (const change of rateChangeHistory2) {
      const timeline = empRateTimeline2.get(change.employeeId) || [];
      timeline.push({ date: new Date(change.changeDate), rate: change.newValue ? Number(change.newValue) : 0 });
      empRateTimeline2.set(change.employeeId, timeline);
    }

    const getFallbackRate2 = (record: any): { hourlyRate: number; overtimeRate: number } => {
      const assignment = assignmentMap.get(`${record.clientId}-${record.employeeId}`);
      const policy = policyMap.get(record.clientId);
      const employeeBillingRate = record.employee.billingRate ? Number(record.employee.billingRate) : null;
      const groupAssignment = record.employee.groupAssignments?.[0];
      const clientGroupBillingRate = groupAssignment?.groupId
        ? (clientGroupRateMap.get(`${record.clientId}-${groupAssignment.groupId}`) ?? null) : null;
      const groupBillingRate = groupAssignment?.group?.billingRate ? Number(groupAssignment.group.billingRate) : null;

      const hr = assignment?.hourlyRate ? Number(assignment.hourlyRate)
        : employeeBillingRate ? employeeBillingRate
        : clientGroupBillingRate ? clientGroupBillingRate
        : groupBillingRate ? groupBillingRate
        : policy?.defaultHourlyRate ? Number(policy.defaultHourlyRate) : 0;

      let otr = assignment?.overtimeRate ? Number(assignment.overtimeRate)
        : policy?.defaultOvertimeRate ? Number(policy.defaultOvertimeRate) : 0;
      if (otr === 0 && hr > 0) otr = hr * 1.5;
      return { hourlyRate: hr, overtimeRate: otr };
    };

    const getRateForDate2 = (empId: string, recordDate: Date, record: any): { hourlyRate: number; overtimeRate: number } => {
      const timeline = empRateTimeline2.get(empId);
      if (!timeline || timeline.length === 0) return getFallbackRate2(record);

      let effectiveRate: number | null = null;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].date <= recordDate) { effectiveRate = timeline[i].rate; break; }
      }
      if (effectiveRate === null) {
        const firstChange = rateChangeHistory2.find(c => c.employeeId === empId);
        if (firstChange?.oldValue) effectiveRate = Number(firstChange.oldValue);
        else return getFallbackRate2(record);
      }

      const hr = effectiveRate || 0;
      const assignment = assignmentMap.get(`${record.clientId}-${record.employeeId}`);
      const policy = policyMap.get(record.clientId);
      let otr = assignment?.overtimeRate ? Number(assignment.overtimeRate)
        : policy?.defaultOvertimeRate ? Number(policy.defaultOvertimeRate) : 0;
      if (otr === 0 && hr > 0) otr = hr * 1.5;
      return { hourlyRate: hr, overtimeRate: otr };
    };

    // Group by employee with date-effective rates
    const employeeSummary: Record<string, any> = {};

    records.forEach((record) => {
      const empId = record.employeeId;
      const rates = getRateForDate2(empId, new Date(record.date), record);

      if (!employeeSummary[empId]) {
        employeeSummary[empId] = {
          employee: record.employee,
          client: record.client,
          records: [],
          totalMinutes: 0,
          overtimeMinutes: 0,
          approvedMinutes: 0,
          pendingMinutes: 0,
          workDays: 0,
          approvedDays: 0,
          pendingDays: 0,
          rejectedDays: 0,
          hourlyRate: rates.hourlyRate,
          overtimeRate: rates.overtimeRate,
          _regularPay: 0,
          _overtimePay: 0,
        };
      }

      employeeSummary[empId].workDays += 1;
      employeeSummary[empId].records.push({
        id: record.id,
        date: record.date,
        totalMinutes: record.totalMinutes,
        breakMinutes: record.breakMinutes,
        overtimeMinutes: record.overtimeMinutes,
        status: record.status,
        clockIn: record.actualStart,
        clockOut: record.actualEnd,
      });

      if (record.status === "APPROVED" || record.status === "AUTO_APPROVED") {
        let approvedOTMinutes = 0;
        if (record.shiftExtensionStatus === "APPROVED") {
          approvedOTMinutes += record.shiftExtensionMinutes || 0;
        }
        if (record.extraTimeStatus === "APPROVED") {
          approvedOTMinutes += record.extraTimeMinutes || 0;
        }
        const deniedOTMinutes = Math.max(0, (record.overtimeMinutes || 0) - approvedOTMinutes);
        const payableMinutes = Math.max(0, (record.totalMinutes || 0) - deniedOTMinutes);
        const payableRegular = payableMinutes - approvedOTMinutes;

        // Calculate per-record pay with date-effective rate
        // Regular hours × hourly rate, OT hours × overtime rate (round only final total)
        employeeSummary[empId]._regularPay += (payableRegular / 60) * rates.hourlyRate;
        employeeSummary[empId]._overtimePay += (approvedOTMinutes / 60) * rates.overtimeRate;

        employeeSummary[empId].totalMinutes += payableMinutes;
        employeeSummary[empId].overtimeMinutes += approvedOTMinutes;
        employeeSummary[empId].approvedMinutes += payableMinutes;
        employeeSummary[empId].approvedDays += 1;
      } else if (record.status === "PENDING") {
        employeeSummary[empId].pendingMinutes += record.totalMinutes || 0;
        employeeSummary[empId].pendingDays += 1;
      } else if (record.status === "REJECTED") {
        employeeSummary[empId].rejectedDays += 1;
      }
    });

    // Fetch approved leave requests in this period for PTO/VTO hours
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: new Date((periodEnd as string) + 'T23:59:59Z') },
        endDate: { gte: new Date((periodStart as string) + 'T00:00:00Z') },
      },
      select: {
        employeeId: true,
        leaveType: true,
        startDate: true,
        endDate: true,
      },
    });

    // Calculate PTO/VTO days per employee (8 hours per day)
    const leaveDaysByEmployee: Record<string, { ptoDays: number; vtoDays: number }> = {};
    for (const leave of leaveRequests) {
      if (!leaveDaysByEmployee[leave.employeeId]) {
        leaveDaysByEmployee[leave.employeeId] = { ptoDays: 0, vtoDays: 0 };
      }
      // Calculate overlapping days within this period
      const pStartDate = new Date(periodStart as string);
      const pEndDate = new Date(periodEnd as string);
      const leaveStart = leave.startDate > pStartDate ? leave.startDate : pStartDate;
      const leaveEnd = leave.endDate < pEndDate ? leave.endDate : pEndDate;
      const days = Math.max(0, Math.floor((leaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      // Count only weekdays
      let weekdays = 0;
      const d = new Date(leaveStart);
      for (let i = 0; i < days; i++) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) weekdays++;
        d.setDate(d.getDate() + 1);
      }
      if (leave.leaveType === 'PAID') {
        leaveDaysByEmployee[leave.employeeId].ptoDays += weekdays;
      } else {
        leaveDaysByEmployee[leave.employeeId].vtoDays += weekdays;
      }
    }

    // Fetch payroll adjustments for this period
    // Use T12:00:00Z to avoid timezone date shifts with @db.Date fields
    // Also use ±1 day range to catch old entries saved without the timezone fix
    const pStart = new Date((periodStart as string) + "T12:00:00Z");
    const pEnd = new Date((periodEnd as string) + "T12:00:00Z");
    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: { in: employeeIds },
        periodStart: {
          gte: new Date(pStart.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(pStart.getTime() + 24 * 60 * 60 * 1000),
        },
        periodEnd: {
          gte: new Date(pEnd.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(pEnd.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // Group adjustments by employee
    const adjustmentsByEmployee: Record<string, any[]> = {};
    adjustments.forEach((adj) => {
      if (!adjustmentsByEmployee[adj.employeeId]) {
        adjustmentsByEmployee[adj.employeeId] = [];
      }
      adjustmentsByEmployee[adj.employeeId].push({
        id: adj.id,
        type: adj.type,
        amount: Number(adj.amount),
        reason: adj.reason,
        createdAt: adj.createdAt,
      });
    });

    // Check which employees already have payslips for this period
    const existingPayslips = await prisma.payslip.findMany({
      where: {
        periodStart: new Date(periodStart as string),
        periodEnd: new Date(periodEnd as string),
      },
      select: { employeeId: true },
    });
    const payslipEmployeeIds = new Set(existingPayslips.map((p) => p.employeeId));

    // Convert to array with calculated fields including gross pay
    const employees = Object.values(employeeSummary).map((emp: any) => {
      const hasPayslip = payslipEmployeeIds.has(emp.employee.id);
      const status = hasPayslip
        ? "completed"
        : emp.pendingDays > 0
          ? "pending"
          : emp.rejectedDays > 0
            ? "flagged"
            : "ready";
      // Calculate hours and pay from total minutes (same as detail endpoint)
      const regularMinutes = emp.totalMinutes - emp.overtimeMinutes;
      const regularHours = Math.round((regularMinutes / 60) * 100) / 100;
      const overtimeHours = Math.round((emp.overtimeMinutes / 60) * 100) / 100;
      const totalHours = Math.round((regularHours + overtimeHours) * 100) / 100;

      // Resolve rate same way as detail endpoint (from assignment → employee → group → policy)
      const empClientId = emp.client?.id;
      const empAssignment = empClientId ? assignmentMap.get(`${empClientId}-${emp.employee.id}`) : null;
      const empPolicy = empClientId ? policyMap.get(empClientId) : null;
      const empBillingRate = emp.employee.billingRate ? Number(emp.employee.billingRate) : null;
      const empGroupAssignment = emp.employee.groupAssignments?.[0];
      const empClientGroupRate = empGroupAssignment?.groupId && empClientId
        ? (clientGroupRateMap.get(`${empClientId}-${empGroupAssignment.groupId}`) ?? null) : null;
      const empGroupRate = empGroupAssignment?.group?.billingRate ? Number(empGroupAssignment.group.billingRate) : null;

      const resolvedHourlyRate = empAssignment?.hourlyRate ? Number(empAssignment.hourlyRate)
        : empBillingRate ? empBillingRate
        : empClientGroupRate ? empClientGroupRate
        : empGroupRate ? empGroupRate
        : empPolicy?.defaultHourlyRate ? Number(empPolicy.defaultHourlyRate) : 0;

      let resolvedOvertimeRate = empAssignment?.overtimeRate ? Number(empAssignment.overtimeRate)
        : empPolicy?.defaultOvertimeRate ? Number(empPolicy.defaultOvertimeRate) : 0;
      if (resolvedOvertimeRate === 0 && resolvedHourlyRate > 0) resolvedOvertimeRate = resolvedHourlyRate * 1.5;

      const regularPay = Math.round(regularHours * resolvedHourlyRate * 100) / 100;
      const overtimePay = Math.round(overtimeHours * resolvedOvertimeRate * 100) / 100;

      // Apply adjustments (bonuses add, deductions subtract)
      const empAdjustments = adjustmentsByEmployee[emp.employee.id] || [];
      const totalBonuses = empAdjustments
        .filter((a: any) => a.type === "BONUS")
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      const adjustmentDeductions = empAdjustments
        .filter((a: any) => a.type === "DEDUCTION")
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      const employeeDeduction = emp.employee.deduction ? Number(emp.employee.deduction) : 0;
      const totalDeductions = adjustmentDeductions + employeeDeduction;

      // PTO/VTO hours (8 hours per day)
      const empLeave = leaveDaysByEmployee[emp.employee.id] || { ptoDays: 0, vtoDays: 0 };
      const ptoHours = Math.round(empLeave.ptoDays * 8 * 100) / 100;
      const vtoHours = Math.round(empLeave.vtoDays * 8 * 100) / 100;

      // Total hours = approved work hours + PTO hours
      const totalHoursWithPTO = Math.round((totalHours + ptoHours) * 100) / 100;

      const grossPay = Math.max(0,
        Math.round(
          (regularPay + overtimePay + totalBonuses - totalDeductions) * 100,
        ) / 100);

      return {
        ...emp,
        hourlyRate: resolvedHourlyRate,
        overtimeRate: resolvedOvertimeRate,
        totalHours,
        overtimeHours,
        approvedHours: Math.round((emp.approvedMinutes / 60) * 100) / 100,
        pendingHours: Math.round((emp.pendingMinutes / 60) * 100) / 100,
        regularHours,
        ptoHours,
        vtoHours,
        totalHoursWithPTO,
        regularPay,
        overtimePay,
        grossPay,
        adjustments: empAdjustments,
        employeeDeduction,
        totalBonuses: Math.round(totalBonuses * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        status,
        note:
          emp.pendingDays > 0
            ? `${emp.pendingDays} day(s) pending approval`
            : emp.rejectedDays > 0
              ? `${emp.rejectedDays} day(s) rejected`
              : undefined,
      };
    });

    res.json({
      success: true,
      data: {
        employees: employees.sort((a, b) => b.totalHours - a.totalHours),
        totals: {
          totalEmployees: employees.length,
          totalHours:
            Math.round(
              employees.reduce((sum, e) => sum + e.totalHours, 0) * 100,
            ) / 100,
          overtimeHours:
            Math.round(
              employees.reduce((sum, e) => sum + e.overtimeHours, 0) * 100,
            ) / 100,
          approvedHours:
            Math.round(
              employees.reduce((sum, e) => sum + e.approvedHours, 0) * 100,
            ) / 100,
          pendingHours:
            Math.round(
              employees.reduce((sum, e) => sum + e.pendingHours, 0) * 100,
            ) / 100,
          totalGrossPay:
            Math.round(
              employees.reduce((sum, e) => sum + e.grossPay, 0) * 100,
            ) / 100,
          readyCount: employees.filter((e) => e.status === "ready").length,
          pendingCount: employees.filter((e) => e.status === "pending").length,
          flaggedCount: employees.filter((e) => e.status === "flagged").length,
          completedCount: employees.filter((e) => e.status === "completed").length,
          payrollProcessed: payslipEmployeeIds.size > 0,
        },
      },
    });
  } catch (error) {
    console.error("Get employee payroll summary error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch employee payroll summary",
      });
  }
};

// Get single employee payroll detail with daily time records
export const getEmployeePayrollDetail = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeId = req.params.employeeId as string;
    const periodStart = req.query.periodStart as string;
    const periodEnd = req.query.periodEnd as string;

    if (!periodStart || !periodEnd || !employeeId) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Employee ID, period start and end dates are required",
        });
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Fetch time records for this employee in the period
    const records = await prisma.timeRecord.findMany({
      where: {
        employeeId: employeeId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            billingRate: true,
            deduction: true,
            groupAssignments: {
              select: {
                groupId: true,
                group: { select: { billingRate: true } },
              },
            },
          },
        },
        client: { select: { id: true, companyName: true, timezone: true } },
      },
      orderBy: { date: "asc" },
    });

    if (records.length === 0) {
      return res.json({ success: true, data: null });
    }

    const employee = records[0].employee;
    const client = records[0].client;

    // Get rate
    const assignment = await prisma.clientEmployee.findFirst({
      where: { employeeId: employeeId, clientId: client.id, isActive: true },
    });
    const policy = await prisma.clientPolicy.findFirst({
      where: { clientId: client.id },
    });
    const clientGroupRecords = await prisma.clientGroup.findMany({
      where: { clientId: client.id },
      select: { groupId: true, billingRate: true },
    });
    const clientGroupRateMap = new Map(
      clientGroupRecords.map((cg) => [
        cg.groupId,
        cg.billingRate ? Number(cg.billingRate) : null,
      ]),
    );

    const employeeBillingRate = employee.billingRate
      ? Number(employee.billingRate)
      : null;
    const groupAssignment = employee.groupAssignments?.[0];
    const clientGroupBillingRate = groupAssignment?.groupId
      ? (clientGroupRateMap.get(groupAssignment.groupId) ?? null)
      : null;
    const groupBillingRate = groupAssignment?.group?.billingRate
      ? Number(groupAssignment.group.billingRate)
      : null;
    const defaultHourlyRate = policy?.defaultHourlyRate
      ? Number(policy.defaultHourlyRate)
      : 0;

    const hourlyRate = assignment?.hourlyRate
      ? Number(assignment.hourlyRate)
      : employeeBillingRate
        ? employeeBillingRate
        : clientGroupBillingRate
          ? clientGroupBillingRate
          : groupBillingRate
            ? groupBillingRate
            : defaultHourlyRate;

    const assignmentOvertimeRate =
      assignment?.overtimeRate != null ? Number(assignment.overtimeRate) : 0;
    const policyOvertimeRate =
      policy?.defaultOvertimeRate != null
        ? Number(policy.defaultOvertimeRate)
        : 0;
    let overtimeRate = assignmentOvertimeRate > 0 ? assignmentOvertimeRate : policyOvertimeRate;

    const employeeOvertimeMultiplier = employee.overtimeRate
      ? Number(employee.overtimeRate)
      : 0;
    if (assignmentOvertimeRate <= 0 && employeeOvertimeMultiplier > 0 && hourlyRate > 0) {
      // Employee-level override applies when assignment OT is missing/0.
      overtimeRate = hourlyRate * employeeOvertimeMultiplier;
    } else if (overtimeRate === 0 && hourlyRate > 0) {
      // Legacy fallback when neither assignment nor policy provides OT.
      overtimeRate = hourlyRate * 1.5;
    }

    // Fetch work sessions for per-session breakdown
    const sessions = await prisma.workSession.findMany({
      where: {
        employeeId,
        status: { in: ['COMPLETED', 'ACTIVE', 'ON_BREAK'] },
        startTime: { gte: startDate, lte: new Date(endDate.getTime() + 86400000) },
      },
      orderBy: { startTime: 'asc' },
    });

    // Build TimeRecord lookup by date
    const trByDate = new Map<string, typeof records[0]>();
    for (const r of records) {
      trByDate.set(r.date.toISOString().split('T')[0], r);
    }

    // Build daily records — per session
    let totalRegularMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalApprovedMinutes = 0;
    let totalPendingMinutes = 0;
    let approvedDays = 0;
    let pendingDays = 0;
    let rejectedDays = 0;
    const countedDates = new Set<string>();

    const dailyRecords: any[] = [];

    // If there are sessions, build per-session records
    if (sessions.length > 0) {
      for (const session of sessions) {
        const dateKey = session.startTime.toISOString().split('T')[0];
        const record = trByDate.get(dateKey);
        if (!record) continue;

        const isApproved = record.status === 'APPROVED' || record.status === 'AUTO_APPROVED';

        // Calculate per-session minutes from clock times
        const breakMins = session.totalBreakMinutes || 0;
        const sessionMins = (() => {
          if (!session.endTime) return 0;
          const rawMs = session.endTime.getTime() - session.startTime.getTime();
          const fullMin = Math.floor(rawMs / 60000);
          const remSec = Math.floor((rawMs % 60000) / 1000);
          return Math.max(0, (remSec >= 30 ? fullMin + 1 : fullMin) - breakMins);
        })();

        // Detect off-shift OT by matching session duration with TimeRecord extraTimeMinutes
        let sessionOTMinutes = 0;
        const trExtraOT = record.extraTimeMinutes || 0;
        const trExtOT = record.shiftExtensionMinutes || 0;
        if (trExtraOT > 0 && Math.abs(sessionMins - trExtraOT) <= 2) {
          sessionOTMinutes = sessionMins;
        } else if (trExtOT > 0 && Math.abs(sessionMins - trExtOT) <= 2) {
          sessionOTMinutes = sessionMins;
        }
        const sessionRegularMins = Math.max(0, sessionMins - sessionOTMinutes);

        // Per-session status
        const sessionStatus = (() => {
          if (isApproved && sessionOTMinutes === 0) {
            const trHasApprovedOT =
              (record.extraTimeStatus === 'APPROVED' && trExtraOT > 0) ||
              (record.shiftExtensionStatus === 'APPROVED' && trExtOT > 0);
            if (trHasApprovedOT) return 'AUTO_APPROVED';
          }
          return record.status;
        })();

        // Count totals (only once per date)
        if (!countedDates.has(dateKey)) {
          countedDates.add(dateKey);
          let approvedOTMins = 0;
          if (record.shiftExtensionStatus === 'APPROVED') approvedOTMins += record.shiftExtensionMinutes || 0;
          if (record.extraTimeStatus === 'APPROVED') approvedOTMins += record.extraTimeMinutes || 0;
          const deniedOT = Math.max(0, (record.overtimeMinutes || 0) - approvedOTMins);
          const payable = isApproved ? Math.max(0, (record.totalMinutes || 0) - deniedOT) : 0;
          const regular = payable - approvedOTMins;

          if (isApproved) {
            totalRegularMinutes += regular;
            totalOvertimeMinutes += approvedOTMins;
            totalApprovedMinutes += payable;
            approvedDays++;
          } else if (record.status === 'PENDING') {
            totalPendingMinutes += record.totalMinutes || 0;
            pendingDays++;
          } else if (record.status === 'REJECTED') {
            rejectedDays++;
          }
        }

        dailyRecords.push({
          date: record.date,
          status: sessionStatus,
          billingStart: session.startTime,
          billingEnd: session.endTime || null,
          totalMinutes: sessionMins,
          billingMinutes: sessionRegularMins,
          breakMinutes: breakMins,
          overtimeMinutes: sessionOTMinutes,
          approvedOTMinutes: sessionOTMinutes,
          regularMinutes: sessionRegularMins,
          payableMinutes: isApproved ? sessionMins : 0,
          isLate: sessionOTMinutes > 0 ? false : record.isLate,
          shiftExtensionStatus: record.shiftExtensionStatus,
          shiftExtensionMinutes: record.shiftExtensionMinutes || 0,
          extraTimeStatus: record.extraTimeStatus,
          extraTimeMinutes: record.extraTimeMinutes || 0,
        });
      }
    }

    // Fallback: if no sessions found, use TimeRecord directly
    if (dailyRecords.length === 0) {
      for (const record of records) {
        let approvedOTMinutes = 0;
        if (record.shiftExtensionStatus === 'APPROVED') approvedOTMinutes += record.shiftExtensionMinutes || 0;
        if (record.extraTimeStatus === 'APPROVED') approvedOTMinutes += record.extraTimeMinutes || 0;
        const deniedOT = Math.max(0, (record.overtimeMinutes || 0) - approvedOTMinutes);
        const isApproved = record.status === 'APPROVED' || record.status === 'AUTO_APPROVED';
        const payableMinutes = isApproved ? Math.max(0, (record.totalMinutes || 0) - deniedOT) : 0;
        const regularMinutes = payableMinutes - approvedOTMinutes;

        if (isApproved) {
          totalRegularMinutes += regularMinutes;
          totalOvertimeMinutes += approvedOTMinutes;
          totalApprovedMinutes += payableMinutes;
          approvedDays++;
        } else if (record.status === 'PENDING') {
          totalPendingMinutes += record.totalMinutes || 0;
          pendingDays++;
        } else if (record.status === 'REJECTED') {
          rejectedDays++;
        }

        dailyRecords.push({
          date: record.date,
          status: record.status,
          billingStart: record.billingStart,
          billingEnd: record.billingEnd,
          totalMinutes: record.totalMinutes || 0,
          billingMinutes: record.billingMinutes || 0,
          breakMinutes: record.breakMinutes || 0,
          overtimeMinutes: record.overtimeMinutes || 0,
          approvedOTMinutes,
          regularMinutes: isApproved ? regularMinutes : 0,
          payableMinutes,
          isLate: record.isLate,
          shiftExtensionStatus: record.shiftExtensionStatus,
          shiftExtensionMinutes: record.shiftExtensionMinutes || 0,
          extraTimeStatus: record.extraTimeStatus,
          extraTimeMinutes: record.extraTimeMinutes || 0,
        });
      }
    }

    // Calculate pay
    const regularHours = Math.round((totalRegularMinutes / 60) * 100) / 100;
    const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 100) / 100;
    const totalHours = Math.round((regularHours + overtimeHours) * 100) / 100;
    const regularPay = Math.round(regularHours * hourlyRate * 100) / 100;
    const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;

    // Get adjustments
    const pStart = new Date(periodStart + "T12:00:00Z");
    const pEnd = new Date(periodEnd + "T12:00:00Z");
    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: employeeId,
        periodStart: {
          gte: new Date(pStart.getTime() - 86400000),
          lte: new Date(pStart.getTime() + 86400000),
        },
        periodEnd: {
          gte: new Date(pEnd.getTime() - 86400000),
          lte: new Date(pEnd.getTime() + 86400000),
        },
      },
    });

    const totalBonuses =
      Math.round(
        adjustments
          .filter((a) => a.type === "BONUS")
          .reduce((sum, a) => sum + Number(a.amount), 0) * 100,
      ) / 100;
    const adjustmentDeductions =
      Math.round(
        adjustments
          .filter((a) => a.type === "DEDUCTION")
          .reduce((sum, a) => sum + Number(a.amount), 0) * 100,
      ) / 100;
    // Include employee's fixed deduction from their profile
    const employeeDeduction = employee.deduction ? Number(employee.deduction) : 0;
    const totalDeductions = Math.round((adjustmentDeductions + employeeDeduction) * 100) / 100;
    const grossPay = Math.max(0,
      Math.round(
        (regularPay + overtimePay + totalBonuses - totalDeductions) * 100,
      ) / 100);

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          profilePhoto: employee.profilePhoto,
        },
        client: { id: client.id, companyName: client.companyName, timezone: client.timezone || null },
        period: { start: periodStart, end: periodEnd },
        rates: { hourlyRate, overtimeRate },
        summary: {
          totalHours,
          regularHours,
          overtimeHours,
          approvedHours: Math.round((totalApprovedMinutes / 60) * 100) / 100,
          pendingHours: Math.round((totalPendingMinutes / 60) * 100) / 100,
          workDays: records.length,
          approvedDays,
          pendingDays,
          rejectedDays,
          regularPay,
          overtimePay,
          totalBonuses,
          totalDeductions,
          employeeDeduction,
          grossPay,
        },
        adjustments: adjustments.map((a) => ({
          id: a.id,
          type: a.type,
          amount: Number(a.amount),
          reason: a.reason,
        })),
        dailyRecords,
      },
    });
  } catch (error) {
    console.error("Get employee payroll detail error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch employee payroll detail",
      });
  }
};

// Generate payslips for a period (without requiring a PayrollPeriod)
export const triggerPayslipGeneration = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: "Period start and end dates are required",
      });
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Check for pending OT
    const pendingOT = await prisma.timeRecord.count({
      where: {
        date: { gte: startDate, lte: endDate },
        status: "PENDING",
        overtimeMinutes: { gt: 0 },
      },
    });

    const result = await generatePayslips(startDate, endDate);

    const warnings: string[] = [];
    if (pendingOT > 0) {
      warnings.push(
        `${pendingOT} pending OT record(s) excluded. If approved later, they will be adjusted in the next payroll period.`,
      );
    }
    if (result.errors.length > 0) {
      warnings.push(...result.errors);
    }

    res.json({
      success: true,
      data: {
        generated: result.generated,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });
  } catch (error) {
    console.error("Generate payslips error:", error);
    res.status(500).json({ success: false, error: "Failed to generate payslips" });
  }
};

// Create or update payroll cutoff settings
export const updatePayrollCutoff = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params.id as string;
    const { cutoffDate, notes } = req.body;

    if (!cutoffDate) {
      return res.status(400).json({
        success: false,
        error: "Cutoff date is required",
      });
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return res
        .status(404)
        .json({ success: false, error: "Payroll period not found" });
    }

    if (period.status === "LOCKED" || period.status === "FINALIZED") {
      return res.status(400).json({
        success: false,
        error: "Cannot update cutoff for locked or finalized periods",
      });
    }

    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id },
      data: {
        cutoffDate: new Date(cutoffDate),
        notes: notes || period.notes,
      },
    });

    // Log the payroll date change
    await prisma.payrollDateLog.create({
      data: {
        periodId: id,
        previousDate: period.cutoffDate,
        newDate: new Date(cutoffDate),
        updatedBy: req.user?.userId || 'system',
        notes: notes || null,
      },
    });

    // Notify all active employees and the client about the payroll date change
    try {
      const newDateStr = new Date(cutoffDate).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });

      // Notify employees
      const activeEmployees = await prisma.employee.findMany({
        where: { user: { status: 'ACTIVE' } },
        select: { userId: true },
      });
      const employeeUserIds = activeEmployees.map(e => e.userId);

      // Notify all active clients
      const activeClients = await prisma.client.findMany({
        where: { user: { status: 'ACTIVE' } },
        select: { userId: true },
      });
      const clientUserIds = activeClients.map(c => c.userId);

      const allUserIds = [...employeeUserIds, ...clientUserIds];

      if (employeeUserIds.length > 0) {
        await createBulkNotifications(
          employeeUserIds,
          'PAYROLL_REMINDER',
          'Payroll Date Updated',
          `The next payroll date has been updated to ${newDateStr}. Please ensure all your time entries are submitted and approved before this date.`,
          { periodId: id, cutoffDate },
          '/employee/payslips'
        );
      }
      if (clientUserIds.length > 0) {
        await createBulkNotifications(
          clientUserIds,
          'PAYROLL_REMINDER',
          'Payroll Date Updated',
          `The next payroll date has been updated to ${newDateStr}. Please ensure all time entries are approved before this date.`,
          { periodId: id, cutoffDate },
          '/client/approvals'
        );
      }
    } catch (notifErr) {
      console.error('[Payroll] Failed to send date update notifications:', notifErr);
    }

    res.json({
      success: true,
      data: updatedPeriod,
    });
  } catch (error) {
    console.error("Update payroll cutoff error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update payroll cutoff" });
  }
};

// Get payroll date change history
export const getPayrollDateLogs = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const logs = await prisma.payrollDateLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get user names for updatedBy
    const userIds = [...new Set(logs.map(l => l.updatedBy).filter(id => id !== 'system'))];
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
      }) : [];
    const adminUsers = userIds.length > 0 ? await prisma.admin.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, firstName: true, lastName: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u.email]));
    const adminMap = new Map(adminUsers.map(a => [a.userId, `${a.firstName} ${a.lastName}`]));

    const enrichedLogs = logs.map(log => ({
      id: log.id,
      previousDate: log.previousDate,
      newDate: log.newDate,
      updatedBy: adminMap.get(log.updatedBy) || userMap.get(log.updatedBy) || 'System',
      notes: log.notes,
      createdAt: log.createdAt,
    }));

    res.json({ success: true, data: enrichedLogs });
  } catch (error) {
    console.error("Get payroll date logs error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payroll date logs" });
  }
};

// Add payroll adjustment (bonus or deduction)
export const addPayrollAdjustment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { employeeId, type, amount, reason, periodStart, periodEnd } =
      req.body;

    if (
      !employeeId ||
      !type ||
      !amount ||
      !reason ||
      !periodStart ||
      !periodEnd
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Employee ID, type, amount, reason, period start and end are required",
      });
    }

    if (!["BONUS", "DEDUCTION"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Type must be BONUS or DEDUCTION",
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be greater than 0",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return res
        .status(404)
        .json({ success: false, error: "Employee not found" });
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId,
        type: type as AdjustmentType,
        amount: Number(amount),
        reason,
        periodStart: new Date(periodStart + "T12:00:00Z"),
        periodEnd: new Date(periodEnd + "T12:00:00Z"),
        createdBy: req.user!.userId,
      },
    });

    res.json({
      success: true,
      data: adjustment,
      message: `${type === "BONUS" ? "Bonus" : "Deduction"} added successfully`,
    });
  } catch (error) {
    console.error("Add payroll adjustment error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to add payroll adjustment" });
  }
};

// Get payroll adjustments for an employee in a period
export const getPayrollAdjustments = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { employeeId, periodStart, periodEnd } = req.query;

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;
    if (periodStart && periodEnd) {
      where.periodStart = new Date(periodStart as string);
      where.periodEnd = new Date(periodEnd as string);
    }

    const adjustments = await prisma.payrollAdjustment.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: adjustments.map((a) => ({
        ...a,
        amount: Number(a.amount),
      })),
    });
  } catch (error) {
    console.error("Get payroll adjustments error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch payroll adjustments" });
  }
};

// Delete payroll adjustment
export const deletePayrollAdjustment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params.id as string;

    const adjustment = await prisma.payrollAdjustment.findUnique({
      where: { id },
    });
    if (!adjustment) {
      return res
        .status(404)
        .json({ success: false, error: "Adjustment not found" });
    }

    await prisma.payrollAdjustment.delete({ where: { id } });

    res.json({
      success: true,
      message: "Adjustment deleted successfully",
    });
  } catch (error) {
    console.error("Delete payroll adjustment error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete payroll adjustment" });
  }
};
