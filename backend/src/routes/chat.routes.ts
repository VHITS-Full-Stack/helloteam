import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  getUnreadCount,
  getContacts,
} from '../controllers/chat.controller';

const router = Router();

// Multer config for file uploads (in-memory, max 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// All routes require authentication and CLIENT, EMPLOYEE, or ADMIN role
router.use(authenticate, authorize('CLIENT', 'EMPLOYEE', 'ADMIN'));

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', upload.single('file'), sendMessage);
router.get('/unread-count', getUnreadCount);
router.get('/contacts', getContacts);

export default router;
