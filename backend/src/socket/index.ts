import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../types';

// Track online users: userId -> socketId
const onlineUsers = new Map<string, string>();

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export const initializeSocket = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
  });

  // JWT authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.user?.userId;
    if (!userId) return;

    // Track this user as online
    onlineUsers.set(userId, socket.id);

    // Broadcast online status
    io.emit('chat:user_online', { userId });

    // Handle request for online users
    socket.on('chat:get_online_users', () => {
      socket.emit('chat:online_users', Array.from(onlineUsers.keys()));
    });

    // Handle text messages via socket (low latency path)
    socket.on('chat:send_message', async (data: {
      conversationId: string;
      content: string;
      recipientUserId: string;
      tempId?: string;
    }) => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderUserId: userId,
            content: data.content,
            messageType: 'TEXT',
          },
        });

        // Update conversation lastMessageAt
        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { lastMessageAt: new Date() },
        });

        const messagePayload = {
          ...message,
          tempId: data.tempId,
        };

        // Send to sender (confirmation)
        socket.emit('chat:message_sent', messagePayload);

        // Send to recipient if online
        const recipientSocketId = onlineUsers.get(data.recipientUserId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('chat:new_message', messagePayload);
        }
      } catch (error) {
        console.error('Socket send_message error:', error);
        socket.emit('chat:message_error', {
          tempId: data.tempId,
          error: 'Failed to send message',
        });
      } finally {
        await prisma.$disconnect();
      }
    });

    // Handle mark messages as read
    socket.on('chat:mark_read', async (data: {
      conversationId: string;
      senderUserId: string;
    }) => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        await prisma.message.updateMany({
          where: {
            conversationId: data.conversationId,
            senderUserId: data.senderUserId,
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        // Notify the sender that their messages were read
        const senderSocketId = onlineUsers.get(data.senderUserId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('chat:messages_read', {
            conversationId: data.conversationId,
            readBy: userId,
          });
        }
      } catch (error) {
        console.error('Socket mark_read error:', error);
      } finally {
        await prisma.$disconnect();
      }
    });

    // Handle typing indicators
    socket.on('chat:typing', (data: {
      conversationId: string;
      recipientUserId: string;
    }) => {
      const recipientSocketId = onlineUsers.get(data.recipientUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat:typing', {
          conversationId: data.conversationId,
          userId,
        });
      }
    });

    socket.on('chat:stop_typing', (data: {
      conversationId: string;
      recipientUserId: string;
    }) => {
      const recipientSocketId = onlineUsers.get(data.recipientUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat:stop_typing', {
          conversationId: data.conversationId,
          userId,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('chat:user_offline', { userId });
    });
  });

  return io;
};

export const getOnlineUsers = (): Map<string, string> => onlineUsers;
