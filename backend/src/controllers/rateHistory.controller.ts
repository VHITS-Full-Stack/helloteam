import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

// Get all rate change history (paginated, filterable)
export const getRateChangeHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      employeeId,
      clientId,
      rateType,
      dateFrom,
      dateTo,
      search,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (rateType) {
      where.rateType = rateType;
    }

    if (dateFrom || dateTo) {
      where.changeDate = {};
      if (dateFrom) where.changeDate.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.changeDate.lte = end;
      }
    }

    if (search) {
      where.employee = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [history, total] = await Promise.all([
      prisma.rateChangeHistory.findMany({
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
        },
        orderBy: { changeDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.rateChangeHistory.count({ where }),
    ]);

    // Get client names for entries that have clientId
    const clientIds = [...new Set(history.filter(h => h.clientId).map(h => h.clientId!))];
    const clients = clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, companyName: true },
        })
      : [];
    const clientMap = new Map(clients.map(c => [c.id, c.companyName]));

    // For records without clientId, look up the employee's active client assignment
    const employeeIdsWithoutClient = [...new Set(
      history.filter(h => !h.clientId).map(h => h.employeeId)
    )];
    const employeeClientMap = new Map<string, string>();
    if (employeeIdsWithoutClient.length > 0) {
      const assignments = await prisma.clientEmployee.findMany({
        where: { employeeId: { in: employeeIdsWithoutClient }, isActive: true },
        select: { employeeId: true, client: { select: { id: true, companyName: true } } },
      });
      for (const a of assignments) {
        // Use the first active assignment's client name
        if (!employeeClientMap.has(a.employeeId)) {
          employeeClientMap.set(a.employeeId, a.client.companyName);
        }
      }
    }

    // Stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalChanges, recentChanges, employeesAffected] = await Promise.all([
      prisma.rateChangeHistory.count(),
      prisma.rateChangeHistory.count({
        where: { changeDate: { gte: thirtyDaysAgo } },
      }),
      prisma.rateChangeHistory.groupBy({
        by: ['employeeId'],
        _count: true,
      }),
    ]);

    // Resolve changedBy userIds to names
    const changedByIds = [...new Set(history.filter(h => h.changedBy).map(h => h.changedBy))];
    const changedByUsers = changedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: changedByIds } },
          select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } }, client: { select: { companyName: true, contactPerson: true } }, admin: { select: { firstName: true, lastName: true } } },
        })
      : [];
    const changedByMap = new Map(changedByUsers.map(u => {
      const name = u.admin ? `${u.admin.firstName} ${u.admin.lastName}` : u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.client ? (u.client.contactPerson || u.client.companyName) : u.email;
      return [u.id, name];
    }));

    const enrichedHistory = history.map(h => ({
      ...h,
      clientName: h.clientId
        ? clientMap.get(h.clientId) || null
        : employeeClientMap.get(h.employeeId) || null,
      changedByName: h.changedBy ? changedByMap.get(h.changedBy) || 'System' : 'System',
    }));

    res.json({
      success: true,
      data: {
        history: enrichedHistory,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
        stats: {
          totalChanges,
          recentChanges,
          employeesAffected: employeesAffected.length,
        },
      },
    });
  } catch (error) {
    console.error('Get rate change history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate change history',
    });
  }
};

// Get rate change history for a specific employee
export const getEmployeeRateHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const {
      page = '1',
      limit = '20',
      rateType,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { employeeId };

    if (rateType) {
      where.rateType = rateType;
    }

    if (dateFrom || dateTo) {
      where.changeDate = {};
      if (dateFrom) where.changeDate.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.changeDate.lte = end;
      }
    }

    const [history, total] = await Promise.all([
      prisma.rateChangeHistory.findMany({
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
        },
        orderBy: { changeDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.rateChangeHistory.count({ where }),
    ]);

    // Get client names
    const clientIds = [...new Set(history.filter(h => h.clientId).map(h => h.clientId!))];
    const clients = clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, companyName: true },
        })
      : [];
    const clientMap = new Map(clients.map(c => [c.id, c.companyName]));

    // For records without clientId, look up the employee's active client assignment
    const employeeClientMap = new Map<string, string>();
    const hasRecordsWithoutClient = history.some(h => !h.clientId);
    if (hasRecordsWithoutClient) {
      const empId = employeeId as string;
      const assignments = await prisma.clientEmployee.findMany({
        where: { employeeId: empId, isActive: true },
        include: { client: { select: { companyName: true } } },
      });
      if (assignments.length > 0) {
        employeeClientMap.set(empId, assignments[0].client.companyName);
      }
    }

    // Resolve changedBy userIds to names
    const changedByIds2 = [...new Set(history.filter(h => h.changedBy).map(h => h.changedBy))];
    const changedByUsers2 = changedByIds2.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: changedByIds2 } },
          select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } }, client: { select: { companyName: true, contactPerson: true } }, admin: { select: { firstName: true, lastName: true } } },
        })
      : [];
    const changedByMap2 = new Map(changedByUsers2.map(u => {
      const name = u.admin ? `${u.admin.firstName} ${u.admin.lastName}` : u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.client ? (u.client.contactPerson || u.client.companyName) : u.email;
      return [u.id, name];
    }));

    const enrichedHistory = history.map(h => ({
      ...h,
      clientName: h.clientId
        ? clientMap.get(h.clientId) || null
        : employeeClientMap.get(h.employeeId) || null,
      changedByName: h.changedBy ? changedByMap2.get(h.changedBy) || 'System' : 'System',
    }));

    res.json({
      success: true,
      data: {
        history: enrichedHistory,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get employee rate history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee rate history',
    });
  }
};
