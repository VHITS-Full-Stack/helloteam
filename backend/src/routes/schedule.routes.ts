import { Router } from 'express';
import {
  getMySchedule,
  getTodaySchedule,
  getEmployeeSchedule,
  upsertSchedule,
  bulkUpdateSchedule,
  deleteSchedule,
} from '../controllers/schedule.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// EMPLOYEE ROUTES - View own schedule
// ============================================

// Get my weekly schedule
router.get('/my-schedule', authorizeRoles(['EMPLOYEE']), getMySchedule);

// Get today's schedule
router.get('/today', authorizeRoles(['EMPLOYEE']), getTodaySchedule);

// ============================================
// ADMIN ROUTES - Manage employee schedules
// ============================================

// Get employee's schedule (Admin)
router.get(
  '/employee/:employeeId',
  authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR']),
  getEmployeeSchedule
);

// Create or update single schedule entry
router.post(
  '/employee/:employeeId',
  authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR']),
  upsertSchedule
);

// Bulk update schedule (full week)
router.put(
  '/employee/:employeeId/bulk',
  authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR']),
  bulkUpdateSchedule
);

// Delete a schedule
router.delete(
  '/:scheduleId',
  authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']),
  deleteSchedule
);

export default router;
