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
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
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

    const enrichedHistory = history.map(h => ({
      ...h,
      clientName: h.clientId ? clientMap.get(h.clientId) || null : null,
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

    const enrichedHistory = history.map(h => ({
      ...h,
      clientName: h.clientId ? clientMap.get(h.clientId) || null : null,
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
