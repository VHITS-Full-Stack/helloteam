import { Response } from 'express';
import prisma from '../config/database';
import { LeaveType, LeaveStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { resolveEffectivePtoConfig } from '../utils/ptoResolver';
import { calculateCurrentBlock } from '../utils/ptoHalfYearlyCalculator';
import { uploadToS3 } from '../services/s3.service';

// Helper: Calculate days between two dates
const calculateDays = (startDate: Date, endDate: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay)) + 1;
  return diffDays;
};

// Helper: Check if request is short notice (< 2 weeks)
const isShortNotice = (startDate: Date): boolean => {
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  return startDate < twoWeeksFromNow;
};

// Helper: Get or create leave balance for current year
const getOrCreateLeaveBalance = async (employeeId: string, clientId: string) => {
  const currentYear = new Date().getFullYear();

  let balance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_clientId_year: {
        employeeId,
        clientId,
        year: currentYear,
      },
    },
  });

  if (!balance) {
    // Get client policy and employee assignment to resolve effective PTO config
    const [policy, clientEmployee] = await Promise.all([
      prisma.clientPolicy.findUnique({ where: { clientId } }),
      prisma.clientEmployee.findFirst({ where: { employeeId, clientId, isActive: true } }),
    ]);

    const effectivePto = resolveEffectivePtoConfig(policy, clientEmployee);
    const initialEntitlement = effectivePto.allowPaidLeave ? effectivePto.annualPaidLeaveDays : 0;

    balance = await prisma.leaveBalance.create({
      data: {
        employeeId,
        clientId,
        year: currentYear,
        paidLeaveEntitled: initialEntitlement,
        paidLeaveUsed: 0,
        paidLeaveCarryover: 0,
        paidLeavePending: 0,
        unpaidLeaveTaken: 0,
        unpaidLeavePending: 0,
      },
    });
  }

  return balance;
};

// Get leave options available to employee (based on client policy)
export const getLeaveOptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    // Get employee and their client assignment
    const employee = await prisma.employee.findFirst({
      where: { userId },
      include: {
        clientAssignments: {
          where: { isActive: true },
          include: {
            client: {
              include: {
                clientPolicies: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    if (employee.clientAssignments.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No client assignment found. Please contact admin.',
      });
      return;
    }

    // Get policy from first active client assignment and resolve effective PTO config
    const assignment = employee.clientAssignments[0];
    const policy = assignment.client.clientPolicies;
    const effectivePto = resolveEffectivePtoConfig(policy, assignment);

    const leaveOptions = {
      clientId: assignment.clientId,
      clientName: assignment.client.companyName,
      options: [] as Array<{
        type: LeaveType;
        label: string;
        available: boolean;
        description: string;
      }>,
      requiresTwoWeeksNoticePaidLeave: policy?.requireTwoWeeksNoticePaidLeave ?? true,
      requiresTwoWeeksNoticeUnpaidLeave: policy?.requireTwoWeeksNoticeUnpaidLeave ?? true,
      paidLeaveEntitlementType: effectivePto.paidLeaveEntitlementType,
    };

    // Add VTO option if unpaid leave is allowed (default to true if no policy)
    leaveOptions.options.push({
      type: 'VTO',
      label: 'VTO',
      available: true,
      description: 'Voluntary time off (unpaid)',
    });

    // Add PTO option if paid leave is allowed
    if (effectivePto.allowPaidLeave) {
      leaveOptions.options.push({
        type: 'PTO',
        label: 'PTO',
        available: true,
        description: `Paid time off (${effectivePto.paidLeaveEntitlementType} entitlement)`,
      });
    } else {
      // Always show PTO option as available but show info about balance
      leaveOptions.options.push({
        type: 'PTO',
        label: 'PTO',
        available: false,
        description: 'No paid leave available',
      });
    }

    res.json({
      success: true,
      data: leaveOptions,
    });
  } catch (error) {
    console.error('Error getting leave options:', error);
    res.status(500).json({ success: false, error: 'Failed to get leave options' });
  }
};

// Get leave balance for employee
export const getLeaveBalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    // Get employee and their client assignment
    const employee = await prisma.employee.findFirst({
      where: { userId },
      include: {
        clientAssignments: {
          where: { isActive: true },
          include: {
            client: {
              include: {
                clientPolicies: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    if (employee.clientAssignments.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No client assignment found',
      });
      return;
    }

    const assignment = employee.clientAssignments[0];
    const policy = assignment.client.clientPolicies;
    const effectivePto = resolveEffectivePtoConfig(policy, assignment);

    // Get or create balance
    const balance = await getOrCreateLeaveBalance(employee.id, assignment.clientId);

    let paidLeaveEntitled = Number(balance.paidLeaveEntitled);
    let paidLeaveUsed = Number(balance.paidLeaveUsed);
    let paidLeavePending = Number(balance.paidLeavePending);
    let paidLeaveCarryover = Number(balance.paidLeaveCarryover);
    let blockInfo: { blockStart?: Date; blockEnd?: Date } = {};

    // For FIXED_HALF_YEARLY: dynamically compute entitlement and scoped usage
    if (effectivePto.paidLeaveEntitlementType === 'FIXED_HALF_YEARLY' && employee.hireDate) {
      const now = new Date();
      const block = calculateCurrentBlock(employee.hireDate, now, effectivePto.annualPaidLeaveDays);
      paidLeaveEntitled = block.entitledDays;
      paidLeaveCarryover = 0; // No rollover for half-yearly

      // Count only leave used/pending within the current block
      const [usedInBlock, pendingInBlock] = await Promise.all([
        prisma.leaveRequest.aggregate({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            leaveType: 'PAID',
            status: 'APPROVED',
            startDate: { gte: block.blockStart },
            endDate: { lt: block.blockEnd },
          },
          _count: true,
        }).then(async (result) => {
          // Sum actual days from approved requests in this block
          const requests = await prisma.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              clientId: assignment.clientId,
              leaveType: 'PAID',
              status: 'APPROVED',
              startDate: { gte: block.blockStart },
              endDate: { lt: block.blockEnd },
            },
            select: { startDate: true, endDate: true },
          });
          return requests.reduce((sum, r) => sum + calculateDays(new Date(r.startDate), new Date(r.endDate)), 0);
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            leaveType: 'PAID',
            status: { in: ['PENDING', 'APPROVED_BY_CLIENT'] },
            startDate: { gte: block.blockStart },
            endDate: { lt: block.blockEnd },
          },
          select: { startDate: true, endDate: true },
        }).then(requests =>
          requests.reduce((sum, r) => sum + calculateDays(new Date(r.startDate), new Date(r.endDate)), 0)
        ),
      ]);

      paidLeaveUsed = usedInBlock;
      paidLeavePending = pendingInBlock;
      blockInfo = { blockStart: block.blockStart, blockEnd: block.blockEnd };
    }

    const paidLeaveAvailable = Math.max(0, paidLeaveEntitled + paidLeaveCarryover - paidLeaveUsed);

    // Count rejected leaves for the current year
    const rejectedCount = await prisma.leaveRequest.count({
      where: {
        employeeId: employee.id,
        clientId: assignment.clientId,
        status: 'REJECTED',
        startDate: { gte: new Date(`${balance.year}-01-01`) },
        endDate: { lte: new Date(`${balance.year}-12-31T23:59:59`) },
      },
    });

    res.json({
      success: true,
      data: {
        year: balance.year,
        paidLeave: {
          entitled: paidLeaveEntitled,
          carryover: paidLeaveCarryover,
          used: paidLeaveUsed,
          pending: paidLeavePending,
          rejected: rejectedCount,
          available: paidLeaveAvailable,
          entitlementType: effectivePto.paidLeaveEntitlementType,
          ...(blockInfo.blockStart ? {
            blockStart: blockInfo.blockStart,
            blockEnd: blockInfo.blockEnd,
          } : {}),
        },
        unpaidLeave: {
          taken: Number(balance.unpaidLeaveTaken),
          pending: Number(balance.unpaidLeavePending),
        },
        policy: {
          allowPaidLeave: effectivePto.allowPaidLeave,
          allowUnpaidLeave: effectivePto.allowUnpaidLeave,
          requiresTwoWeeksNoticePaidLeave: policy?.requireTwoWeeksNoticePaidLeave ?? true,
          requiresTwoWeeksNoticeUnpaidLeave: policy?.requireTwoWeeksNoticeUnpaidLeave ?? true,
        },
      },
    });
  } catch (error) {
    console.error('Error getting leave balance:', error);
    res.status(500).json({ success: false, error: 'Failed to get leave balance' });
  }
};

// Submit leave request
export const submitLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { leaveType, startDate, endDate, reason, notes, days } = req.body;

    // Validate input — support both per-day (days array) and legacy date-range requests
    if (!leaveType) {
      res.status(400).json({ success: false, error: 'Leave type is required' });
      return;
    }

    let start: Date;
    let end: Date;
    let totalMinutes: number | null = null;

    if (days && Array.isArray(days) && days.length > 0) {
      // New per-day format: [{ date, hours, mins }]
      const sorted = [...days].sort((a: any, b: any) => a.date.localeCompare(b.date));
      start = new Date(sorted[0].date);
      end = new Date(sorted[sorted.length - 1].date);
      totalMinutes = days.reduce((sum: number, d: any) => sum + (Number(d.hours) * 60 + Number(d.mins)), 0);
    } else if (startDate && endDate) {
      // Legacy date-range format
      start = new Date(startDate);
      end = new Date(endDate);
      if (end < start) {
        res.status(400).json({ success: false, error: 'End date must be after start date' });
        return;
      }
    } else {
      res.status(400).json({ success: false, error: 'Either days array or startDate/endDate are required' });
      return;
    }

    // Get employee and their client assignment
    const employee = await prisma.employee.findFirst({
      where: { userId },
      include: {
        clientAssignments: {
          where: { isActive: true },
          include: {
            client: {
              include: {
                clientPolicies: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    if (employee.clientAssignments.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No client assignment found',
      });
      return;
    }

    const assignment = employee.clientAssignments[0];
    const policy = assignment.client.clientPolicies;
    const effectivePto = resolveEffectivePtoConfig(policy, assignment);

    // Allow all leave types - check balance only for paid
    const isPaid = leaveType === 'PAID' || leaveType === 'PTO';
    
    const requestedDays = calculateDays(start, end);
    const noticeRequired = isPaid
      ? (policy?.requireTwoWeeksNoticePaidLeave ?? true)
      : (policy?.requireTwoWeeksNoticeUnpaidLeave ?? true);
    const shortNotice = noticeRequired && isShortNotice(start);

    // Check balance for paid leave - if insufficient, allow but flag
    let isPaidWithNoBalance = false;
    let available = 0;
    
    if (leaveType === 'PAID' || leaveType === 'PTO') {
      if (effectivePto.paidLeaveEntitlementType === 'FIXED_HALF_YEARLY' && employee.hireDate) {
        const now = new Date();
        const block = calculateCurrentBlock(employee.hireDate, now, effectivePto.annualPaidLeaveDays);

        const blockRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            leaveType: 'PAID',
            status: { in: ['APPROVED', 'PENDING', 'APPROVED_BY_CLIENT'] },
            startDate: { gte: block.blockStart },
            endDate: { lt: block.blockEnd },
          },
          select: { startDate: true, endDate: true },
        });
        const usedAndPending = blockRequests.reduce(
          (sum, r) => sum + calculateDays(new Date(r.startDate), new Date(r.endDate)), 0
        );
        available = block.entitledDays - usedAndPending;
      } else {
        const balance = await getOrCreateLeaveBalance(employee.id, assignment.clientId);
        available = Number(balance.paidLeaveEntitled ?? 0) +
          Number(balance.paidLeaveCarryover ?? 0) -
          Number(balance.paidLeaveUsed ?? 0) -
          Number(balance.paidLeavePending ?? 0);
      }

      if (available <= 0) {
        available = 0;
        isPaidWithNoBalance = true;
      }
    }

    // Check for overlapping requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED_BY_CLIENT', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (overlapping) {
      res.status(400).json({
        success: false,
        error: 'You already have a leave request for overlapping dates',
      });
      return;
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        clientId: assignment.clientId,
        leaveType: leaveType as LeaveType,
        startDate: start,
        endDate: end,
        reason: reason || null,
        notes: notes || null,
        days: days || null,
        totalMinutes: totalMinutes,
        status: 'PENDING',
        isShortNotice: shortNotice,
      },
    });

    let responseMessage = 'Leave request submitted successfully';
    let warning = null;
    if (isPaidWithNoBalance) {
      warning = 'Warning: No paid leave balance available. This request may be rejected unless additional balance is granted.';
    }

    // Upload documents if any
    let documentUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToS3(file, 'leave-documents');
          if (uploadResult.success && uploadResult.url) {
            documentUrls.push(uploadResult.url);
          }
        } catch (uploadErr) {
          console.error('Document upload error:', uploadErr);
        }
      }

      // Save document URLs to database
      if (documentUrls.length > 0) {
        await prisma.leaveRequest.update({
          where: { id: leaveRequest.id },
          data: { documentUrls: documentUrls as any },
        });
      }
    }

    // Update pending balance
    if (leaveType === 'PAID' || leaveType === 'PTO') {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            year: new Date().getFullYear(),
          },
        },
        data: {
          paidLeavePending: { increment: requestedDays },
        },
      });
    } else {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: employee.id,
            clientId: assignment.clientId,
            year: new Date().getFullYear(),
          },
        },
        data: {
          unpaidLeavePending: { increment: requestedDays },
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        ...leaveRequest,
        requestedDays,
        shortNoticeWarning: shortNotice
          ? 'This request is submitted with less than 2 weeks notice'
          : null,
        balanceWarning: warning,
      },
      message: warning || (shortNotice
        ? 'Leave request submitted. Note: This is a short-notice request (< 2 weeks)'
        : 'Leave request submitted successfully'),
    });
  } catch (error) {
    console.error('Error submitting leave request:', error);
    res.status(500).json({ success: false, error: 'Failed to submit leave request' });
  }
};

// Get leave request history
export const getLeaveHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const status = req.query.status as string;
    const year = req.query.year as string;

    // Get employee by userId
    const employee = await prisma.employee.findFirst({
      where: { userId },
    });

    // If no employee found with userId, return empty
    if (!employee) {
      res.json({ success: true, data: [] });
      return;
    }

    // Build where clause with employeeId
    const where: any = { employeeId: employee.id };

    if (status && status !== 'all') {
      where.status = status as LeaveStatus;
    }

    if (year) {
      const yearNum = parseInt(year);
      where.startDate = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1),
      };
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Add calculated days to each request
    const requestsWithDays = requests.map(request => ({
      ...request,
      requestedDays: request.requestedDays ?? calculateDays(new Date(request.startDate), new Date(request.endDate)),
    }));

    res.json({
      success: true,
      data: requestsWithDays,
    });
  } catch (error) {
    console.error('Error getting leave history:', error);
    res.status(500).json({ success: false, error: 'Failed to get leave history' });
  }
};

// Cancel leave request
export const cancelLeaveRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const requestId = req.params.requestId as string;
    const { reason } = req.body;

    // Get employee
    const employee = await prisma.employee.findFirst({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Get the leave request
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        employeeId: employee.id,
      },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    // Can only cancel pending requests
    if (leaveRequest.status !== 'PENDING' && leaveRequest.status !== 'APPROVED_BY_CLIENT') {
      res.status(400).json({
        success: false,
        error: 'Can only cancel pending or client-approved requests',
      });
      return;
    }

    const requestedDays = calculateDays(
      new Date(leaveRequest.startDate),
      new Date(leaveRequest.endDate)
    );

    // Update leave request to cancelled
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        rejectedAt: new Date(),
        rejectedBy: employee.id,
        rejectionReason: reason || 'Cancelled by employee',
      },
    });

    // Update balance
    const currentYear = new Date().getFullYear();
    
    if (leaveRequest.leaveType === 'PAID') {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: employee.id,
            clientId: leaveRequest.clientId,
            year: currentYear,
          },
        },
        data: {
          paidLeavePending: { decrement: requestedDays },
        },
      });
    } else {
      await prisma.leaveBalance.update({
        where: {
          employeeId_clientId_year: {
            employeeId: employee.id,
            clientId: leaveRequest.clientId,
            year: currentYear,
          },
        },
        data: {
          unpaidLeavePending: { decrement: requestedDays },
        },
      });
    }

    res.json({
      success: true,
      message: 'Leave request cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel leave request' });
  }
};

// Get single leave request details
export const getLeaveRequestDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const requestId = req.params.requestId as string;

    // Get employee
    const employee = await prisma.employee.findFirst({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        employeeId: employee.id,
      },
      include: {
        client: {
          select: {
            companyName: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    const requestedDays = calculateDays(
      new Date(leaveRequest.startDate),
      new Date(leaveRequest.endDate)
    );

    // Build approval flow status
    const approvalFlow = [
      {
        step: 1,
        label: 'Created At',
        status: 'completed',
        date: leaveRequest.createdAt,
        actor: 'You',
      },
      {
        step: 2,
        label: 'Client Review',
        status: leaveRequest.clientApprovedAt
          ? 'completed'
          : leaveRequest.status === 'REJECTED'
            ? 'rejected'
            : 'pending',
        date: leaveRequest.clientApprovedAt || null,
        actor: leaveRequest.clientApprovedBy ? 'Client' : null,
      },
      {
        step: 3,
        label: 'Hello Team Review',
        status: leaveRequest.adminApprovedAt
          ? 'completed'
          : leaveRequest.status === 'REJECTED' && !leaveRequest.clientApprovedAt
            ? 'skipped'
            : leaveRequest.status === 'REJECTED'
              ? 'rejected'
              : 'pending',
        date: leaveRequest.adminApprovedAt || null,
        actor: leaveRequest.adminApprovedBy ? 'Admin' : null,
      },
    ];

    res.json({
      success: true,
      data: {
        ...leaveRequest,
        requestedDays,
        approvalFlow,
      },
    });
  } catch (error) {
    console.error('Error getting leave request details:', error);
    res.status(500).json({ success: false, error: 'Failed to get leave request details' });
  }
};
