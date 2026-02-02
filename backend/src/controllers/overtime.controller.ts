import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { createNotification, notifyOvertimeRequest } from './notification.controller';

const prisma = new PrismaClient();

// Get overtime requests for client or employee
export const getOvertimeRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { status, startDate, endDate, employeeId, limit = 50, offset = 0 } = req.query;

    let clientId: string | undefined;
    let filterEmployeeId: string | undefined;

    // For client users, get their client ID
    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }
      clientId = client.id;
    }

    // For employee users, only show their own requests
    if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      filterEmployeeId = employee.id;
    }

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (filterEmployeeId) {
      where.employeeId = filterEmployeeId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const [requests, total] = await Promise.all([
      prisma.overtimeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.overtimeRequest.count({ where }),
    ]);

    // Get employee details for each request
    const employeeIds = [...new Set(requests.map(r => r.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, profilePhoto: true },
    });

    // Get approver/rejecter details
    const approverIds = [...new Set(requests.filter(r => r.approvedBy).map(r => r.approvedBy!))];
    const rejecterIds = [...new Set(requests.filter(r => r.rejectedBy).map(r => r.rejectedBy!))];
    const allUserIds = [...new Set([...approverIds, ...rejecterIds])];

    // Get user info for approvers/rejecters - check all user types
    const [clients, admins, employeeUsers] = await Promise.all([
      prisma.client.findMany({
        where: { userId: { in: allUserIds } },
        select: { userId: true, companyName: true, contactPerson: true },
      }),
      prisma.admin.findMany({
        where: { userId: { in: allUserIds } },
        select: { userId: true, firstName: true, lastName: true },
      }),
      prisma.employee.findMany({
        where: { userId: { in: allUserIds } },
        select: { userId: true, firstName: true, lastName: true, profilePhoto: true },
      }),
    ]);

    // Build a map of userId to user info
    const userMap = new Map<string, { name: string; profilePhoto?: string | null }>();
    clients.forEach(c => userMap.set(c.userId, { name: c.contactPerson || c.companyName }));
    admins.forEach(a => userMap.set(a.userId, { name: `${a.firstName} ${a.lastName}` }));
    employeeUsers.forEach(e => userMap.set(e.userId, { name: `${e.firstName} ${e.lastName}`, profilePhoto: e.profilePhoto }));

    const employeeMap = new Map(employees.map(e => [e.id, e]));
    const requestsWithEmployee = requests.map(r => ({
      ...r,
      employee: employeeMap.get(r.employeeId),
      approver: r.approvedBy ? userMap.get(r.approvedBy) : null,
      rejecter: r.rejectedBy ? userMap.get(r.rejectedBy) : null,
    }));

    res.json({
      success: true,
      data: {
        requests: requestsWithEmployee,
        total,
        pending: requests.filter(r => r.status === 'PENDING').length,
      },
    });
  } catch (error) {
    console.error('Get overtime requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overtime requests' });
  }
};

// Create overtime request (by employee or admin)
export const createOvertimeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { employeeId, clientId, date, requestedMinutes, reason } = req.body;

    // Validate required fields
    if (!date || !requestedMinutes || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Date, requested minutes, and reason are required',
      });
    }

    let finalEmployeeId = employeeId;
    let finalClientId = clientId;

    // If employee is creating, use their ID
    if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        include: {
          clientAssignments: {
            where: { isActive: true },
            include: { client: true },
          },
        },
      });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      finalEmployeeId = employee.id;

      // Use first active client if not specified
      if (!finalClientId && employee.clientAssignments.length > 0) {
        finalClientId = employee.clientAssignments[0].clientId;
      }
    }

    if (!finalEmployeeId || !finalClientId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID and Client ID are required',
      });
    }

    // Create the overtime request
    const request = await prisma.overtimeRequest.create({
      data: {
        employeeId: finalEmployeeId,
        clientId: finalClientId,
        date: new Date(date),
        requestedMinutes: Number(requestedMinutes),
        reason,
      },
    });

    // Notify the client
    const client = await prisma.client.findUnique({
      where: { id: finalClientId },
      select: { userId: true },
    });
    const employee = await prisma.employee.findUnique({
      where: { id: finalEmployeeId },
      select: { firstName: true, lastName: true },
    });

    if (client && employee) {
      await notifyOvertimeRequest(
        client.userId,
        `${employee.firstName} ${employee.lastName}`,
        Math.round(requestedMinutes / 60 * 10) / 10,
        new Date(date).toLocaleDateString()
      );
    }

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('Create overtime request error:', error);
    res.status(500).json({ success: false, error: 'Failed to create overtime request' });
  }
};

// Approve overtime request
export const approveOvertimeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const request = await prisma.overtimeRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Overtime request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Request has already been processed' });
    }

    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Notify the employee
    const employee = await prisma.employee.findUnique({
      where: { id: request.employeeId },
      include: { user: { select: { id: true } } },
    });

    if (employee) {
      await createNotification(
        employee.user.id,
        'OVERTIME_APPROVED',
        'Overtime Request Approved',
        `Your overtime request for ${request.date.toLocaleDateString()} has been approved`,
        { requestId: id },
        '/employee/time-records'
      );
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Approve overtime request error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve overtime request' });
  }
};

// Reject overtime request
export const rejectOvertimeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const request = await prisma.overtimeRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Overtime request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Request has already been processed' });
    }

    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Notify the employee
    const employee = await prisma.employee.findUnique({
      where: { id: request.employeeId },
      include: { user: { select: { id: true } } },
    });

    if (employee) {
      await createNotification(
        employee.user.id,
        'OVERTIME_REJECTED',
        'Overtime Request Rejected',
        `Your overtime request for ${request.date.toLocaleDateString()} was rejected: ${reason}`,
        { requestId: id, reason },
        '/employee/time-records'
      );
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Reject overtime request error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject overtime request' });
  }
};

// Get overtime summary for client
export const getOvertimeSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { startDate, endDate } = req.query;

    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const where: any = { clientId: client.id };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const requests = await prisma.overtimeRequest.findMany({
      where,
    });

    const summary = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'PENDING').length,
      approved: requests.filter(r => r.status === 'APPROVED').length,
      rejected: requests.filter(r => r.status === 'REJECTED').length,
      totalApprovedMinutes: requests
        .filter(r => r.status === 'APPROVED')
        .reduce((sum, r) => sum + r.requestedMinutes, 0),
      totalPendingMinutes: requests
        .filter(r => r.status === 'PENDING')
        .reduce((sum, r) => sum + r.requestedMinutes, 0),
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get overtime summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overtime summary' });
  }
};
