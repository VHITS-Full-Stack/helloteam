import { Router } from 'express';
import {
  getMyTimeRecords,
  getMyTimeRecordSummary,
  getMyPayrollSummary,
  getTimeRecordDetail,
  getMyHolidays,
} from '../controllers/timeRecord.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// EMPLOYEE ROUTES - View own time records
// ============================================

// Get my time records (paginated with filters)
router.get('/my-records', authorizeRoles(['EMPLOYEE']), getMyTimeRecords);

// Get time record summary for a period
router.get('/my-summary', authorizeRoles(['EMPLOYEE']), getMyTimeRecordSummary);

// Get payroll summary
router.get('/my-payroll', authorizeRoles(['EMPLOYEE']), getMyPayrollSummary);

// Get holidays for my assigned client
router.get('/my-holidays', authorizeRoles(['EMPLOYEE']), getMyHolidays);

// Get single time record detail
router.get('/:recordId', authorizeRoles(['EMPLOYEE']), getTimeRecordDetail);

export default router;
