import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { createNotification } from './notification.controller';

// Get tickets (role-based: employee sees own, admin sees all, client sees their employees')
export const getTickets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) { res.status(404).json({ success: false, error: 'Employee not found' }); return; }
      where.employeeId = employee.id;
    } else if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId } });
      if (!client) { res.status(404).json({ success: false, error: 'Client not found' }); return; }
      const assignments = await prisma.clientEmployee.findMany({
        where: { clientId: client.id, isActive: true },
        select: { employeeId: true },
      });
      where.employeeId = { in: assignments.map(a => a.employeeId) };
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          assignedAdmin: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        tickets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
};

// Get single ticket with messages
export const getTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: id as string },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true, userId: true } },
        assignedAdmin: { select: { id: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    }) as any;

    if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' }); return; }

    // Resolve sender names for messages
    const senderIds: string[] = [...new Set(
      (ticket.messages as Array<{ senderId?: string | null }>)
        .map((m) => m.senderId)
        .filter((id): id is string => Boolean(id)),
    )];
    const [employees, admins, clients] = await Promise.all([
      prisma.employee.findMany({ where: { userId: { in: senderIds } }, select: { userId: true, firstName: true, lastName: true } }),
      prisma.admin.findMany({ where: { userId: { in: senderIds } }, select: { userId: true, firstName: true, lastName: true } }),
      prisma.client.findMany({ where: { userId: { in: senderIds } }, select: { userId: true, companyName: true, contactPerson: true } }),
    ]);

    const nameMap = new Map<string, string>();
    employees.forEach(e => nameMap.set(e.userId, `${e.firstName} ${e.lastName}`));
    admins.forEach(a => nameMap.set(a.userId, `${a.firstName} ${a.lastName}`));
    clients.forEach(c => nameMap.set(c.userId, c.contactPerson || c.companyName));

    const messagesWithNames = ticket.messages.map(m => ({
      ...m,
      senderName: nameMap.get(m.senderId) || (m.senderType === 'employee' ? 'Employee' : m.senderType === 'client' ? 'Client' : 'Admin'),
    }));

    res.json({ success: true, data: { ...ticket, messages: messagesWithNames } });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
  }
};

// Create ticket (employee)
export const createTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { subject, description, priority } = req.body;

    if (!subject || !description) {
      res.status(400).json({ success: false, error: 'Subject and description are required' }); return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) { res.status(404).json({ success: false, error: 'Employee not found' }); return; }

    const ticket = await prisma.supportTicket.create({
      data: {
        employeeId: employee.id,
        subject,
        description,
        priority: priority || 'MEDIUM',
      },
    });

    // Notify admins in background
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    prisma.admin.findMany({ select: { userId: true } }).then(admins => {
      for (const admin of admins) {
        createNotification(
          admin.userId, 'SUPPORT_TICKET', 'New Support Ticket',
          `${employeeName} submitted: ${subject}`,
          { ticketId: ticket.id }, '/admin/support'
        ).catch(() => {});
      }
    }).catch(() => {});

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to create ticket' });
  }
};

// Add message to ticket
export const addMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { message, isInternal } = req.body;

    if (!message) { res.status(400).json({ success: false, error: 'Message is required' }); return; }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { employee: { select: { userId: true, firstName: true, lastName: true } } },
    });
    if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' }); return; }

    const senderType = role === 'EMPLOYEE' ? 'employee' : role === 'CLIENT' ? 'client' : 'admin';

    const newMsg = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: userId!,
        senderType,
        message,
        isInternal: senderType === 'admin' ? (isInternal || false) : false,
      },
    });

    // Auto-update status
    if (senderType === 'admin' && ticket.status === 'OPEN') {
      await prisma.supportTicket.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
    }

    // Notify other party in background
    if (senderType === 'employee') {
      prisma.admin.findMany({ select: { userId: true } }).then(admins => {
        for (const admin of admins) {
          createNotification(
            admin.userId, 'SUPPORT_TICKET', 'Ticket Reply',
            `${ticket.employee.firstName} ${ticket.employee.lastName} replied to: ${ticket.subject}`,
            { ticketId: id }, '/admin/support'
          ).catch(() => {});
        }
      }).catch(() => {});
    } else if (!isInternal) {
      createNotification(
        ticket.employee.userId, 'SUPPORT_TICKET', 'Admin Replied',
        `Admin replied to your ticket: ${ticket.subject}`,
        { ticketId: id }, '/employee/support'
      ).catch(() => {});
    }

    res.json({ success: true, data: newMsg });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ success: false, error: 'Failed to add message' });
  }
};

// Update ticket status (admin)
export const updateTicketStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, assignedAdminId } = req.body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED') updateData.resolvedAt = new Date();
      if (status === 'CLOSED') updateData.closedAt = new Date();
    }
    if (assignedAdminId !== undefined) updateData.assignedAdminId = assignedAdminId || null;

    const ticket = await prisma.supportTicket.update({
      where: { id: id as string },
      data: updateData,
      include: { employee: { select: { userId: true } } },
    }) as any;

    // Notify employee in background
    if (status) {
      createNotification(
        ticket.employee.userId, 'SUPPORT_TICKET',
        `Ticket ${status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}`,
        `Your ticket is now ${status.toLowerCase().replace('_', ' ')}`,
        { ticketId: id }, '/employee/support'
      ).catch(() => {});
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ticket' });
  }
};
