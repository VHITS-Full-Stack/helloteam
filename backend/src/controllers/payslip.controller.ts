import { Response } from "express";
import prisma from "../config/database";
import { AuthenticatedRequest } from "../types";

/**
 * Generate payslips for all employees in a payroll period.
 * Called after payroll finalization.
 */
export const generatePayslips = async (
  periodStart: Date,
  periodEnd: Date,
): Promise<{ generated: number; errors: string[] }> => {
  const errors: string[] = [];
  let generated = 0;

  // Get all approved time records in the period
  const records = await prisma.timeRecord.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      status: { in: ["APPROVED", "AUTO_APPROVED"] },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          billingRate: true,
          overtimeRate: true,
          groupAssignments: {
            select: {
              groupId: true,
              group: { select: { billingRate: true } },
            },
          },
        },
      },
      client: { select: { id: true, companyName: true } },
    },
  });

  if (records.length === 0) return { generated, errors };

  // Get rate lookup data
  const clientIds = [...new Set(records.map((r) => r.clientId))];
  const employeeIds = [...new Set(records.map((r) => r.employeeId))];

  const [clientPolicies, assignments, clientGroupRecords] = await Promise.all([
    prisma.clientPolicy.findMany({ where: { clientId: { in: clientIds } } }),
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
  ]);

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

  // Get adjustments
  const pStart = new Date(periodStart.toISOString().split("T")[0] + "T12:00:00Z");
  const pEnd = new Date(periodEnd.toISOString().split("T")[0] + "T12:00:00Z");
  const allAdjustments = await prisma.payrollAdjustment.findMany({
    where: {
      employeeId: { in: employeeIds },
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

  const adjustmentsByEmployee: Record<string, typeof allAdjustments> = {};
  for (const adj of allAdjustments) {
    if (!adjustmentsByEmployee[adj.employeeId]) {
      adjustmentsByEmployee[adj.employeeId] = [];
    }
    adjustmentsByEmployee[adj.employeeId].push(adj);
  }

  // Group records by employee+client
  const empClientMap: Record<string, { records: typeof records; employee: any; client: any }> = {};

  for (const record of records) {
    const key = `${record.employeeId}-${record.clientId}`;
    if (!empClientMap[key]) {
      empClientMap[key] = {
        records: [],
        employee: record.employee,
        client: record.client,
      };
    }
    empClientMap[key].records.push(record);
  }

  // Generate payslip for each employee-client combo
  for (const [key, data] of Object.entries(empClientMap)) {
    try {
      const { employee, client } = data;
      const empRecords = data.records;

      // Calculate rate
      const assignment = assignmentMap.get(`${client.id}-${employee.id}`);
      const policy = policyMap.get(client.id);
      const employeeBillingRate = employee.billingRate ? Number(employee.billingRate) : null;
      const groupAssignment = employee.groupAssignments?.[0];
      const clientGroupBillingRate = groupAssignment?.groupId
        ? clientGroupRateMap.get(`${client.id}-${groupAssignment.groupId}`) ?? null
        : null;
      const groupBillingRate = groupAssignment?.group?.billingRate
        ? Number(groupAssignment.group.billingRate)
        : null;
      const defaultHourlyRate = policy?.defaultHourlyRate ? Number(policy.defaultHourlyRate) : 0;

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
        policy?.defaultOvertimeRate != null ? Number(policy.defaultOvertimeRate) : 0;

      let overtimeRate = assignmentOvertimeRate > 0 ? assignmentOvertimeRate : policyOvertimeRate;

      if (overtimeRate === 0 && hourlyRate > 0) {
        const employeeOvertimeMultiplier = employee.overtimeRate ? Number(employee.overtimeRate) : 1;
        overtimeRate = hourlyRate * employeeOvertimeMultiplier;
      }

      // Calculate hours
      let totalRegularMinutes = 0;
      let totalOvertimeMinutes = 0;
      let workDays = 0;

      for (const record of empRecords) {
        let approvedOT = 0;
        if (record.shiftExtensionStatus === "APPROVED")
          approvedOT += record.shiftExtensionMinutes || 0;
        if (record.extraTimeStatus === "APPROVED")
          approvedOT += record.extraTimeMinutes || 0;
        const deniedOT = Math.max(0, (record.overtimeMinutes || 0) - approvedOT);
        const payableMinutes = Math.max(0, (record.totalMinutes || 0) - deniedOT);

        totalRegularMinutes += payableMinutes - approvedOT;
        totalOvertimeMinutes += approvedOT;
        workDays++;
      }

      const regularHours = Math.round((totalRegularMinutes / 60) * 100) / 100;
      const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 100) / 100;
      const totalHours = Math.round((regularHours + overtimeHours) * 100) / 100;
      const regularPay = Math.round(regularHours * hourlyRate * 100) / 100;
      const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;

      const empAdjustments = adjustmentsByEmployee[employee.id] || [];
      const totalBonuses = Math.round(
        empAdjustments.filter((a) => a.type === "BONUS").reduce((sum, a) => sum + Number(a.amount), 0) * 100,
      ) / 100;
      const totalDeductions = Math.round(
        empAdjustments.filter((a) => a.type === "DEDUCTION").reduce((sum, a) => sum + Number(a.amount), 0) * 100,
      ) / 100;
      const grossPay = Math.max(0, Math.round((regularPay + overtimePay + totalBonuses - totalDeductions) * 100) / 100);

      // Upsert payslip
      await prisma.payslip.upsert({
        where: {
          employeeId_clientId_periodStart_periodEnd: {
            employeeId: employee.id,
            clientId: client.id,
            periodStart,
            periodEnd,
          },
        },
        update: {
          regularHours,
          overtimeHours,
          totalHours,
          hourlyRate,
          overtimeRate,
          regularPay,
          overtimePay,
          totalBonuses,
          totalDeductions,
          grossPay,
          workDays,
          status: "GENERATED",
        },
        create: {
          employeeId: employee.id,
          clientId: client.id,
          periodStart,
          periodEnd,
          regularHours,
          overtimeHours,
          totalHours,
          hourlyRate,
          overtimeRate,
          regularPay,
          overtimePay,
          totalBonuses,
          totalDeductions,
          grossPay,
          workDays,
          status: "GENERATED",
        },
      });

      generated++;
    } catch (err: any) {
      errors.push(`Failed for ${key}: ${err.message}`);
    }
  }

  return { generated, errors };
};

/**
 * Get payslips for the authenticated employee.
 */
export const getMyPayslips = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    const payslips = await prisma.payslip.findMany({
      where: { employeeId: employee.id },
      include: {
        client: { select: { companyName: true } },
      },
      orderBy: { periodStart: "desc" },
    });

    res.json({
      success: true,
      data: payslips.map((p) => ({
        id: p.id,
        clientName: p.client.companyName,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        regularHours: Number(p.regularHours),
        overtimeHours: Number(p.overtimeHours),
        totalHours: Number(p.totalHours),
        hourlyRate: Number(p.hourlyRate),
        overtimeRate: Number(p.overtimeRate),
        regularPay: Number(p.regularPay),
        overtimePay: Number(p.overtimePay),
        totalBonuses: Number(p.totalBonuses),
        totalDeductions: Number(p.totalDeductions),
        grossPay: Number(p.grossPay),
        workDays: p.workDays,
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get my payslips error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payslips" });
  }
};

/**
 * Get single payslip detail for the authenticated employee.
 */
export const getMyPayslipDetail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const payslipId = req.params.id as string;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    const payslip = await prisma.payslip.findFirst({
      where: { id: payslipId, employeeId: employee.id },
      include: {
        client: { select: { companyName: true } },
        employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
      },
    });

    if (!payslip) {
      res.status(404).json({ success: false, error: "Payslip not found" });
      return;
    }

    // Get daily time records for this period
    const dailyRecords = await prisma.timeRecord.findMany({
      where: {
        employeeId: employee.id,
        clientId: payslip.clientId,
        date: { gte: payslip.periodStart, lte: payslip.periodEnd },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
      orderBy: { date: "asc" },
    });

    // Get adjustments
    const pStart = new Date(payslip.periodStart.toISOString().split("T")[0] + "T12:00:00Z");
    const pEnd = new Date(payslip.periodEnd.toISOString().split("T")[0] + "T12:00:00Z");
    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId: employee.id,
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

    const daily = dailyRecords.map((r) => {
      let approvedOT = 0;
      if (r.shiftExtensionStatus === "APPROVED") approvedOT += r.shiftExtensionMinutes || 0;
      if (r.extraTimeStatus === "APPROVED") approvedOT += r.extraTimeMinutes || 0;
      const deniedOT = Math.max(0, (r.overtimeMinutes || 0) - approvedOT);
      const payableMinutes = Math.max(0, (r.totalMinutes || 0) - deniedOT);

      return {
        date: r.date,
        billingStart: r.billingStart,
        billingEnd: r.billingEnd,
        totalMinutes: r.totalMinutes || 0,
        breakMinutes: r.breakMinutes || 0,
        regularMinutes: payableMinutes - approvedOT,
        approvedOTMinutes: approvedOT,
        payableMinutes,
        status: r.status,
      };
    });

    res.json({
      success: true,
      data: {
        id: payslip.id,
        employee: payslip.employee,
        clientName: payslip.client.companyName,
        periodStart: payslip.periodStart,
        periodEnd: payslip.periodEnd,
        regularHours: Number(payslip.regularHours),
        overtimeHours: Number(payslip.overtimeHours),
        totalHours: Number(payslip.totalHours),
        hourlyRate: Number(payslip.hourlyRate),
        overtimeRate: Number(payslip.overtimeRate),
        regularPay: Number(payslip.regularPay),
        overtimePay: Number(payslip.overtimePay),
        totalBonuses: Number(payslip.totalBonuses),
        totalDeductions: Number(payslip.totalDeductions),
        grossPay: Number(payslip.grossPay),
        workDays: payslip.workDays,
        adjustments: adjustments.map((a) => ({
          id: a.id,
          type: a.type,
          amount: Number(a.amount),
          reason: a.reason,
        })),
        dailyRecords: daily,
      },
    });
  } catch (error) {
    console.error("Get my payslip detail error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payslip detail" });
  }
};
