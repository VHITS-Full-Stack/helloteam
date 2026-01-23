import { Router } from 'express';
import {
  getClientDashboardStats,
  getClientWorkforce,
  getActiveEmployees,
  getPendingApprovals,
  approveTimeRecord,
  rejectTimeRecord,
  getWeeklyHoursOverview,
  getClientTimeRecords,
  getClientApprovals,
  bulkApproveTimeRecords,
  bulkRejectTimeRecords,
  getClientAnalytics,
  getClientBilling,
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
// TIME RECORDS ROUTES
// ============================================

// Get time records with filtering (weekly view)
router.get('/time-records', getClientTimeRecords);

// ============================================
// APPROVAL ROUTES
// ============================================

// Get approvals list with filtering
router.get('/approvals', getClientApprovals);

// Approve a time record
router.post('/approvals/time-record/:recordId/approve', approveTimeRecord);

// Reject a time record
router.post('/approvals/time-record/:recordId/reject', rejectTimeRecord);

// Bulk approve time records
router.post('/approvals/bulk-approve', bulkApproveTimeRecords);

// Bulk reject time records
router.post('/approvals/bulk-reject', bulkRejectTimeRecords);

// ============================================
// ANALYTICS ROUTES
// ============================================

// Get analytics data
router.get('/analytics', getClientAnalytics);

// ============================================
// BILLING ROUTES
// ============================================

// Get billing summary
router.get('/billing', getClientBilling);

export default router;
