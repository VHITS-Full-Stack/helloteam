import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

// Get employee's time records
export const getMyTimeRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { startDate, endDate, status, page = '1', limit = '20' } = req.query;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filters
    const where: any = {
      employeeId: employee.id,
    };

    if (startDate) {
      where.date = { ...where.date, gte: new Date(startDate as string) };
    }
    if (endDate) {
      where.date = { ...where.date, lte: new Date(endDate as string) };
    }
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status as string)) {
      where.status = status;
    }

    const [records, total] = await Promise.all([
      prisma.timeRecord.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.timeRecord.count({ where }),
    ]);

    // Format records with calculated fields
    const formattedRecords = records.map(record => ({
      id: record.id,
      date: record.date,
      client: record.client,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      actualStart: record.actualStart,
      actualEnd: record.actualEnd,
      totalMinutes: record.totalMinutes,
      breakMinutes: record.breakMinutes,
      overtimeMinutes: record.overtimeMinutes,
      netWorkMinutes: record.totalMinutes - record.breakMinutes,
      status: record.status,
      approvedAt: record.approvedAt,
      adjustedAt: record.adjustedAt,
      adjustmentNotes: record.adjustmentNotes,
      originalMinutes: record.originalMinutes,
      wasAdjusted: record.originalMinutes !== null,
    }));

    res.json({
      success: true,
      records: formattedRecords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get time records error:', error);
    res.status(500).json({ success: false, message: 'Failed to get time records' });
  }
};

// Get time record summary for a period
export const getMyTimeRecordSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { period = 'month' } = req.query; // 'week', 'month', 'year'

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get all records in period
    const records = await prisma.timeRecord.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate summary
    const summary = {
      totalMinutes: 0,
      totalBreakMinutes: 0,
      totalOvertimeMinutes: 0,
      approvedMinutes: 0,
      pendingMinutes: 0,
      rejectedMinutes: 0,
      daysWorked: records.length,
      adjustedRecords: 0,
    };

    for (const record of records) {
      summary.totalMinutes += record.totalMinutes;
      summary.totalBreakMinutes += record.breakMinutes;
      summary.totalOvertimeMinutes += record.overtimeMinutes;

      if (record.status === 'APPROVED') {
        summary.approvedMinutes += record.totalMinutes - record.breakMinutes;
      } else if (record.status === 'PENDING') {
        summary.pendingMinutes += record.totalMinutes - record.breakMinutes;
      } else if (record.status === 'REJECTED') {
        summary.rejectedMinutes += record.totalMinutes - record.breakMinutes;
      }

      if (record.originalMinutes !== null) {
        summary.adjustedRecords += 1;
      }
    }

    res.json({
      success: true,
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      summary: {
        ...summary,
        totalHours: Math.round(summary.totalMinutes / 60 * 10) / 10,
        netWorkMinutes: summary.totalMinutes - summary.totalBreakMinutes,
        netWorkHours: Math.round((summary.totalMinutes - summary.totalBreakMinutes) / 60 * 10) / 10,
        approvedHours: Math.round(summary.approvedMinutes / 60 * 10) / 10,
        pendingHours: Math.round(summary.pendingMinutes / 60 * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Get time record summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get summary' });
  }
};

// Get payroll summary for employee
export const getMyPayrollSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { month, year } = req.query;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Default to current month
    const now = new Date();
    const targetMonth = month ? parseInt(month as string, 10) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Get all approved records for the pay period
    const records = await prisma.timeRecord.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'APPROVED',
      },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by client
    const byClient: { [clientId: string]: any } = {};
    let totalApprovedMinutes = 0;
    let totalOvertimeMinutes = 0;

    for (const record of records) {
      const clientId = record.clientId;
      if (!byClient[clientId]) {
        byClient[clientId] = {
          client: record.client,
          totalMinutes: 0,
          overtimeMinutes: 0,
          daysWorked: 0,
        };
      }
      byClient[clientId].totalMinutes += record.totalMinutes - record.breakMinutes;
      byClient[clientId].overtimeMinutes += record.overtimeMinutes;
      byClient[clientId].daysWorked += 1;

      totalApprovedMinutes += record.totalMinutes - record.breakMinutes;
      totalOvertimeMinutes += record.overtimeMinutes;
    }

    // Get pending records count
    const pendingCount = await prisma.timeRecord.count({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      payPeriod: {
        month: targetMonth + 1,
        year: targetYear,
        monthName: startDate.toLocaleString('default', { month: 'long' }),
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      summary: {
        totalApprovedMinutes,
        totalApprovedHours: Math.round(totalApprovedMinutes / 60 * 10) / 10,
        totalOvertimeMinutes,
        totalOvertimeHours: Math.round(totalOvertimeMinutes / 60 * 10) / 10,
        regularMinutes: totalApprovedMinutes - totalOvertimeMinutes,
        regularHours: Math.round((totalApprovedMinutes - totalOvertimeMinutes) / 60 * 10) / 10,
        pendingRecordsCount: pendingCount,
        daysWorked: records.length,
      },
      byClient: Object.values(byClient),
    });
  } catch (error) {
    console.error('Get payroll summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payroll summary' });
  }
};

// Get single time record detail
export const getTimeRecordDetail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const recordId = req.params.recordId as string;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    const record = await prisma.timeRecord.findFirst({
      where: {
        id: recordId,
        employeeId: employee.id,
      },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!record) {
      res.status(404).json({ success: false, message: 'Time record not found' });
      return;
    }

    // Get work sessions for this date
    const dateStart = new Date(record.date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(record.date);
    dateEnd.setHours(23, 59, 59, 999);

    const workSessions = await prisma.workSession.findMany({
      where: {
        employeeId: employee.id,
        startTime: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      include: {
        breaks: true,
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({
      success: true,
      record: {
        ...record,
        netWorkMinutes: record.totalMinutes - record.breakMinutes,
        wasAdjusted: record.originalMinutes !== null,
      },
      workSessions: workSessions.map(session => ({
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        totalBreakMinutes: session.totalBreakMinutes,
        breaks: session.breaks,
      })),
    });
  } catch (error) {
    console.error('Get time record detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to get time record detail' });
  }
};
