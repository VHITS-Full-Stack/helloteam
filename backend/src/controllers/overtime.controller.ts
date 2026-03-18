import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { createNotification, notifyOvertimeRequest } from './notification.controller';
import { sendOvertimeRequestEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';

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
    const { employeeId, clientId, date, requestedMinutes, estimatedEndTime, requestedStartTime, requestedEndTime, reason, type } = req.body;

    // Determine overtime type (default to SHIFT_EXTENSION for backward compat)
    const overtimeType = type === 'OFF_SHIFT' ? 'OFF_SHIFT' : 'SHIFT_EXTENSION';

    // Validate required fields
    if (!date || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Date and reason are required',
      });
    }

    // Validate based on type
    if (overtimeType === 'OFF_SHIFT') {
      if (!requestedStartTime || !requestedEndTime) {
        return res.status(400).json({
          success: false,
          error: 'Start time and end time are required for off-shift overtime',
        });
      }
      // Validate time formats (HH:MM)
      if (!/^\d{1,2}:\d{2}$/.test(requestedStartTime) || !/^\d{1,2}:\d{2}$/.test(requestedEndTime)) {
        return res.status(400).json({
          success: false,
          error: 'Start time and end time must be in HH:MM format',
        });
      }
    } else {
      if (!requestedMinutes) {
        return res.status(400).json({
          success: false,
          error: 'Requested minutes are required for shift extension',
        });
      }
    }

    // Validate estimatedEndTime format if provided (HH:MM)
    if (estimatedEndTime && !/^\d{1,2}:\d{2}$/.test(estimatedEndTime)) {
      return res.status(400).json({
        success: false,
        error: 'Estimated end time must be in HH:MM format',
      });
    }

    // Calculate requestedMinutes for OFF_SHIFT from start/end times
    let finalRequestedMinutes = Number(requestedMinutes) || 0;
    if (overtimeType === 'OFF_SHIFT' && requestedStartTime && requestedEndTime) {
      const [startH, startM] = requestedStartTime.split(':').map(Number);
      const [endH, endM] = requestedEndTime.split(':').map(Number);
      let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMinutes <= 0) diffMinutes += 24 * 60; // Handle overnight (e.g., 10 PM - 1 AM)
      finalRequestedMinutes = diffMinutes;
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

    // For OFF_SHIFT requests, validate that the requested time is outside the employee's schedule
    if (overtimeType === 'OFF_SHIFT' && requestedStartTime && requestedEndTime) {
      const requestDate = new Date(date);
      const dayOfWeek = requestDate.getUTCDay(); // 0-6

      const schedule = await prisma.schedule.findFirst({
        where: {
          employeeId: finalEmployeeId,
          dayOfWeek,
          isActive: true,
          effectiveFrom: { lte: requestDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: requestDate } },
          ],
        },
        select: { startTime: true, endTime: true },
      });

      if (schedule && schedule.startTime && schedule.endTime) {
        const [schedStartH, schedStartM] = schedule.startTime.split(':').map(Number);
        const [schedEndH, schedEndM] = schedule.endTime.split(':').map(Number);
        const schedStartMin = schedStartH * 60 + schedStartM;
        const schedEndMin = schedEndH * 60 + schedEndM;

        const [reqStartH, reqStartM] = requestedStartTime.split(':').map(Number);
        const [reqEndH, reqEndM] = requestedEndTime.split(':').map(Number);
        const reqStartMin = reqStartH * 60 + reqStartM;
        const reqEndMin = reqEndH * 60 + reqEndM;

        // Check if the requested range overlaps with the schedule
        // Overlap exists when: reqStart < schedEnd AND reqEnd > schedStart
        if (reqStartMin < schedEndMin && reqEndMin > schedStartMin) {
          const formatTime12 = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hr = h % 12 || 12;
            return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
          };
          return res.status(400).json({
            success: false,
            error: `The requested time overlaps with your scheduled shift (${formatTime12(schedule.startTime)} – ${formatTime12(schedule.endTime)}). Off-shift overtime must be outside your schedule.`,
          });
        }
      }
    }

    // Create the overtime request
    const request = await prisma.overtimeRequest.create({
      data: {
        employeeId: finalEmployeeId,
        clientId: finalClientId,
        date: new Date(date),
        type: overtimeType,
        requestedMinutes: finalRequestedMinutes,
        estimatedEndTime: estimatedEndTime || null,
        requestedStartTime: overtimeType === 'OFF_SHIFT' ? requestedStartTime : null,
        requestedEndTime: overtimeType === 'OFF_SHIFT' ? requestedEndTime : null,
        reason,
      },
    });

    // Notify the client — 3 simultaneous notifications: in-app, email, SMS
    const client = await prisma.client.findUnique({
      where: { id: finalClientId },
      select: {
        userId: true,
        companyName: true,
        contactPerson: true,
        phone: true,
        user: { select: { email: true } },
      },
    });
    const employee = await prisma.employee.findUnique({
      where: { id: finalEmployeeId },
      select: { firstName: true, lastName: true },
    });

    if (client && employee) {
      const hours = Math.round(finalRequestedMinutes / 60 * 100) / 100;
      const dateStr = new Date(date).toLocaleDateString();
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const timeInfo = overtimeType === 'OFF_SHIFT'
        ? ` (${requestedStartTime}–${requestedEndTime})`
        : estimatedEndTime ? ` until ${estimatedEndTime}` : '';

      // 1. In-app notification
      await notifyOvertimeRequest(
        client.userId,
        employeeName,
        hours,
        dateStr,
        estimatedEndTime || undefined
      );

      // 2. Email notification
      try {
        await sendOvertimeRequestEmail(
          client.user.email,
          client.contactPerson || client.companyName,
          employeeName,
          hours,
          dateStr,
          reason
        );
      } catch (emailErr) {
        console.error('[OT] Failed to send email notification:', emailErr);
      }

      // 3. SMS notification
      if (client.phone) {
        try {
          await sendSMS(
            client.phone,
            `OT request pending for ${employeeName} ${dateStr}${timeInfo} — Approve / Deny. Log in to review.`
          );
        } catch (smsErr) {
          console.error('[OT] Failed to send SMS notification:', smsErr);
        }
      }
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

    // If there's a time record with overtime for this date, cascade the approval
    const existingTimeRecord = await prisma.timeRecord.findFirst({
      where: {
        employeeId: request.employeeId,
        clientId: request.clientId,
        date: request.date,
        status: { in: ['PENDING', 'AUTO_APPROVED', 'APPROVED'] },
        overtimeMinutes: { gt: 0 },
      },
    });

    if (existingTimeRecord) {
      const updateData: any = {};

      // Update the overall status to APPROVED (client is actively approving OT)
      if (existingTimeRecord.status === 'PENDING' || existingTimeRecord.status === 'AUTO_APPROVED') {
        updateData.status = 'APPROVED';
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }

      // Cascade approval to the relevant status field on TimeRecord
      if (request.type === 'SHIFT_EXTENSION') {
        updateData.shiftExtensionStatus = 'APPROVED';
      } else if (request.type === 'OFF_SHIFT') {
        updateData.extraTimeStatus = 'APPROVED';
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.timeRecord.update({
          where: { id: existingTimeRecord.id },
          data: updateData,
        });
      }
    }

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

    // Cascade denial to TimeRecord
    const statusField = request.type === 'SHIFT_EXTENSION' ? 'shiftExtensionStatus' : 'extraTimeStatus';
    const minutesField = request.type === 'SHIFT_EXTENSION' ? 'shiftExtensionMinutes' : 'extraTimeMinutes';
    const existingTimeRecord = await prisma.timeRecord.findFirst({
      where: {
        employeeId: request.employeeId,
        clientId: request.clientId,
        date: request.date,
        [minutesField]: { gt: 0 },
      },
    });

    if (existingTimeRecord) {
      const updateData: any = { [statusField]: 'DENIED' };
      // If the TimeRecord is still PENDING, approve the regular hours (only OT is denied)
      if (existingTimeRecord.status === 'PENDING') {
        updateData.status = 'APPROVED';
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }
      await prisma.timeRecord.update({
        where: { id: existingTimeRecord.id },
        data: updateData,
      });
    }

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
