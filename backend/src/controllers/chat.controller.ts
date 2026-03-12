import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { uploadChatFile } from '../services/s3.service';
import { getPresignedUrl } from '../services/s3.service';
import { createNotification } from './notification.controller';

// Helper to refresh presigned URLs on messages
const refreshMessageUrls = async (messages: any[]) => {
  return Promise.all(
    messages.map(async (msg) => {
      if (msg.fileKey) {
        try {
          const freshUrl = await getPresignedUrl(msg.fileKey);
          return { ...msg, fileUrl: freshUrl };
        } catch {
          return { ...msg, fileUrl: msg.fileUrl || null };
        }
      }
      return msg;
    })
  );
};

// Get all conversations for the current user
export const getConversations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    let conversations;

    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId } });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }

      conversations = await prisma.conversation.findMany({
        where: { clientId: client.id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: true,
              userId: true,
              phone: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      // Add unread count for each conversation
      conversations = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderUserId: { not: userId },
              isRead: false,
            },
          });
          const messages = conv.messages[0]?.fileKey
            ? await refreshMessageUrls(conv.messages)
            : conv.messages;
          return {
            ...conv,
            messages,
            unreadCount,
            participant: {
              id: conv.employee.id,
              name: `${conv.employee.firstName} ${conv.employee.lastName}`,
              profilePhoto: conv.employee.profilePhoto,
              userId: conv.employee.userId,
              phone: conv.employee.phone,
            },
          };
        })
      );
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }

      conversations = await prisma.conversation.findMany({
        where: { employeeId: employee.id },
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              contactPerson: true,
              logoUrl: true,
              userId: true,
              phone: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      conversations = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderUserId: { not: userId },
              isRead: false,
            },
          });
          const messages = conv.messages[0]?.fileKey
            ? await refreshMessageUrls(conv.messages)
            : conv.messages;
          return {
            ...conv,
            messages,
            unreadCount,
            participant: {
              id: conv.client.id,
              name: conv.client.companyName,
              profilePhoto: conv.client.logoUrl,
              userId: conv.client.userId,
              phone: conv.client.phone,
            },
          };
        })
      );
    } else {
      return res.status(403).json({ success: false, error: 'Chat not available for this role' });
    }

    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
};

// Create or get existing conversation
export const createConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { clientId, employeeId } = req.body;

    // Verify the requesting user is part of this conversation
    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId } });
      if (!client || client.id !== clientId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee || employee.id !== employeeId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ success: false, error: 'Chat not available for this role' });
    }

    // Verify client-employee assignment exists
    const assignment = await prisma.clientEmployee.findUnique({
      where: {
        clientId_employeeId: { clientId, employeeId },
      },
    });

    if (!assignment || !assignment.isActive) {
      return res.status(400).json({ success: false, error: 'No active assignment between this client and employee' });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        clientId_employeeId: { clientId, employeeId },
      },
      include: {
        client: {
          select: { id: true, companyName: true, contactPerson: true, logoUrl: true, userId: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true, userId: true },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { clientId, employeeId },
        include: {
          client: {
            select: { id: true, companyName: true, contactPerson: true, logoUrl: true, userId: true },
          },
          employee: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true, userId: true },
          },
        },
      });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
};

// Get messages for a conversation with pagination
export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.conversationId as string;
    const { cursor, limit = '50' } = req.query;

    // Verify user belongs to this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        client: { select: { userId: true } },
        employee: { select: { userId: true } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    if (conversation.client.userId !== userId && conversation.employee.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const take = Math.min(parseInt(limit as string, 10), 100);

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor as string) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Refresh presigned URLs for file messages
    const refreshedMessages = await refreshMessageUrls(messages);

    const hasMore = messages.length === take;
    const nextCursor = messages.length > 0 ? messages[messages.length - 1].createdAt.toISOString() : null;

    res.json({
      success: true,
      data: {
        messages: refreshedMessages.reverse(),
        hasMore,
        nextCursor,
      },
    });
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: `Failed to fetch messages: ${error.message || error}` });
  }
};

// Send a message with optional file upload (REST path for files)
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.conversationId as string;
    const { content, messageType = 'TEXT', audioDuration } = req.body;
    const file = (req as any).file as Express.Multer.File | undefined;

    // Verify user belongs to this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        client: { select: { userId: true, companyName: true } },
        employee: { select: { userId: true, firstName: true, lastName: true } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const isClient = conversation.client.userId === userId;
    const isEmployee = conversation.employee.userId === userId;

    if (!isClient && !isEmployee) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    let fileData: any = {};

    if (file) {
      const uploadResult = await uploadChatFile(file);
      if (!uploadResult.success) {
        return res.status(400).json({ success: false, error: uploadResult.error });
      }
      fileData = {
        fileUrl: uploadResult.url,
        fileKey: uploadResult.key,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        fileMimeType: uploadResult.fileMimeType,
      };
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderUserId: userId,
        content: content || null,
        messageType: messageType as any,
        audioDuration: audioDuration ? parseInt(audioDuration, 10) : null,
        ...fileData,
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Emit socket event to recipient
    const recipientUserId = isClient
      ? conversation.employee.userId
      : conversation.client.userId;

    const io = req.app.get('io');
    if (io) {
      const { getOnlineUsers } = await import('../socket');
      const onlineUsers = getOnlineUsers();
      const recipientSocketId = onlineUsers.get(recipientUserId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat:new_message', message);
      } else {
        // Recipient is offline, create a notification
        const senderName = isClient
          ? conversation.client.companyName
          : `${conversation.employee.firstName} ${conversation.employee.lastName}`;

        const notifMessage = messageType === 'TEXT'
          ? (content?.substring(0, 100) || 'Sent a message')
          : messageType === 'AUDIO'
            ? 'Sent a voice note'
            : 'Sent an attachment';

        await createNotification(
          recipientUserId,
          'CHAT_MESSAGE',
          `New message from ${senderName}`,
          notifMessage,
          { conversationId },
          isClient ? '/client/chat' : '/employee/chat'
        );
      }
    }

    res.json({ success: true, data: message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
};

// Get total unread message count
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const count = await prisma.message.count({
      where: {
        conversation: {
          OR: [
            { client: { userId } },
            { employee: { userId } },
          ],
        },
        senderUserId: { not: userId },
        isRead: false,
      },
    });

    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
};

// Get chat-eligible contacts (assigned employees or clients)
export const getContacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId } });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }

      const assignments = await prisma.clientEmployee.findMany({
        where: { clientId: client.id, isActive: true },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: true,
              userId: true,
              phone: true,
            },
          },
        },
      });

      const contacts = assignments.map((a) => ({
        id: a.employee.id,
        name: `${a.employee.firstName} ${a.employee.lastName}`,
        profilePhoto: a.employee.profilePhoto,
        userId: a.employee.userId,
        phone: a.employee.phone,
        type: 'employee',
      }));

      res.json({ success: true, data: contacts });
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }

      const assignments = await prisma.clientEmployee.findMany({
        where: { employeeId: employee.id, isActive: true },
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              contactPerson: true,
              logoUrl: true,
              userId: true,
              phone: true,
            },
          },
        },
      });

      const contacts = assignments.map((a) => ({
        id: a.client.id,
        name: a.client.companyName,
        profilePhoto: a.client.logoUrl,
        userId: a.client.userId,
        phone: a.client.phone,
        type: 'client',
      }));

      res.json({ success: true, data: contacts });
    } else {
      return res.status(403).json({ success: false, error: 'Chat not available for this role' });
    }
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
};
