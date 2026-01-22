import { Router } from 'express';
import {
  getClientDashboardStats,
  getClientWorkforce,
  getActiveEmployees,
  getPendingApprovals,
  approveTimeRecord,
  rejectTimeRecord,
  getWeeklyHoursOverview,
} from '../controllers/clientPortal.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and CLIENT role
router.use(authenticate);
router.use(authorizeRoles(['CLIENT']));

// ============================================
// DASHBOARD ROUTES
// ============================================

// Get dashboard statistics
router.get('/dashboard/stats', getClientDashboardStats);

// Get weekly hours overview for chart
router.get('/dashboard/weekly-hours', getWeeklyHoursOverview);

// Get pending approvals
router.get('/dashboard/pending-approvals', getPendingApprovals);

// ============================================
// WORKFORCE ROUTES
// ============================================

// Get all assigned employees with live status
router.get('/workforce', getClientWorkforce);

// Get currently active employees (working or on break)
router.get('/workforce/active', getActiveEmployees);

// ============================================
// APPROVAL ROUTES
// ============================================

// Approve a time record
router.post('/approvals/time-record/:recordId/approve', approveTimeRecord);

// Reject a time record
router.post('/approvals/time-record/:recordId/reject', rejectTimeRecord);

export default router;
