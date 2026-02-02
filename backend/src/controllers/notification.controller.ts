import { Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

// Get all notifications for the current user
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { unreadOnly, limit = 50, offset = 0 } = req.query;

    const where: any = { userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
};

// Get unread notification count
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    });
  }
};

// Delete a notification
export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    });
  }
};

// Delete all read notifications
export const deleteAllRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });

    res.json({
      success: true,
      message: 'All read notifications deleted',
    });
  } catch (error) {
    console.error('Delete all read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete read notifications',
    });
  }
};

// ============================================
// NOTIFICATION SERVICE FUNCTIONS
// (Used by other controllers to create notifications)
// ============================================

export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: any,
  actionUrl?: string
) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data,
        actionUrl,
      },
    });
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Create notifications for multiple users
export const createBulkNotifications = async (
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: any,
  actionUrl?: string
) => {
  try {
    const notifications = userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      data,
      actionUrl,
    }));

    return await prisma.notification.createMany({
      data: notifications,
    });
  } catch (error) {
    console.error('Create bulk notifications error:', error);
    return null;
  }
};

// Notify client about pending time approvals
export const notifyPendingApprovals = async (
  clientUserId: string,
  pendingCount: number,
  employeeName?: string
) => {
  const title = 'Time Entries Pending Approval';
  const message = employeeName
    ? `${employeeName} has submitted time entries for approval`
    : `You have ${pendingCount} time entries pending approval`;

  return createNotification(
    clientUserId,
    'APPROVAL_REQUIRED',
    title,
    message,
    { pendingCount },
    '/client/approvals'
  );
};

// Notify employee about time approval/rejection
export const notifyTimeApproval = async (
  employeeUserId: string,
  approved: boolean,
  date: string,
  reason?: string
) => {
  const type = approved ? 'TIME_APPROVED' : 'TIME_REJECTED';
  const title = approved ? 'Time Entry Approved' : 'Time Entry Rejected';
  const message = approved
    ? `Your time entry for ${date} has been approved`
    : `Your time entry for ${date} was rejected${reason ? `: ${reason}` : ''}`;

  return createNotification(
    employeeUserId,
    type,
    title,
    message,
    { date, reason },
    '/employee/time-records'
  );
};

// Notify about overtime request
export const notifyOvertimeRequest = async (
  clientUserId: string,
  employeeName: string,
  hours: number,
  date: string
) => {
  return createNotification(
    clientUserId,
    'OVERTIME_REQUEST',
    'Overtime Request',
    `${employeeName} has requested ${hours} hours of overtime for ${date}`,
    { employeeName, hours, date },
    '/client/approvals?tab=overtime'
  );
};

// Notify about payroll deadline
export const notifyPayrollDeadline = async (
  clientUserId: string,
  daysRemaining: number,
  pendingCount: number
) => {
  return createNotification(
    clientUserId,
    'PAYROLL_REMINDER',
    'Payroll Deadline Approaching',
    `Payroll cutoff is in ${daysRemaining} days. You have ${pendingCount} time entries pending approval.`,
    { daysRemaining, pendingCount },
    '/client/approvals'
  );
};
