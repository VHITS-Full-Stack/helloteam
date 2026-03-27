import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getTickets,
  getTicket,
  createTicket,
  addMessage,
  updateTicketStatus,
} from '../controllers/supportTicket.controller';

const router = Router();

router.use(authenticate);

// All roles can list and view tickets (filtered by role in controller)
router.get('/', getTickets);
router.get('/:id', getTicket);

// Employee creates tickets
router.post('/', createTicket);

// All authenticated users can add messages
router.post('/:id/messages', addMessage);

// Admin updates status/assignment
router.put('/:id', updateTicketStatus);

export default router;
