import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import {
  getPayrollPeriods,
  createPayrollPeriod,
  finalizePayrollPeriod,
  sendPayrollReminders,
  getCurrentPayrollPeriod,
} from '../controllers/payroll.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get payroll periods
router.get('/', getPayrollPeriods);

// Get current payroll period
router.get('/current', getCurrentPayrollPeriod);

// Create payroll period (admins only)
router.post('/', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), createPayrollPeriod);

// Finalize payroll period
router.put('/:id/finalize', authorizeRoles(['CLIENT', 'SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), finalizePayrollPeriod);

// Send payroll reminders (admins only - typically called by a cron job)
router.post('/send-reminders', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), sendPayrollReminders);

export default router;
