import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import {
  getOvertimeRequests,
  createOvertimeRequest,
  approveOvertimeRequest,
  rejectOvertimeRequest,
  getOvertimeSummary,
} from '../controllers/overtime.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get overtime requests (clients and admins)
router.get('/', getOvertimeRequests);

// Get overtime summary (clients)
router.get('/summary', authorizeRoles(['CLIENT']), getOvertimeSummary);

// Create overtime request (employees, admins, and clients)
router.post('/', authorizeRoles(['EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'CLIENT']), createOvertimeRequest);

// Approve overtime request (clients and admins)
router.put('/:id/approve', authorizeRoles(['CLIENT', 'SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), approveOvertimeRequest);

// Reject overtime request (clients and admins)
router.put('/:id/reject', authorizeRoles(['CLIENT', 'SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), rejectOvertimeRequest);

export default router;
