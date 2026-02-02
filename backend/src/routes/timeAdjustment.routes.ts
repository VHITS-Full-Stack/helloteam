import { Router } from 'express';
import {
  getTimeRecordsForAdjustment,
  getTimeRecordDetails,
  createTimeAdjustment,
  getAdjustmentHistory,
  getAuditLogs,
  getAuditLogStats,
  getPendingReapprovals,
} from '../controllers/timeAdjustment.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin roles
router.use(authenticate);
router.use(authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR']));

// ============================================
// TIME RECORD MANAGEMENT
// ============================================

// Get time records with filtering for adjustment
router.get('/time-records', getTimeRecordsForAdjustment);

// Get single time record details with adjustment history
router.get('/time-records/:recordId', getTimeRecordDetails);

// Create a time adjustment
router.post('/time-records/:recordId/adjust', createTimeAdjustment);

// Get adjustment history for a specific time record
router.get('/time-records/:recordId/adjustments', getAdjustmentHistory);

// ============================================
// AUDIT LOGS
// ============================================

// Get audit logs with filtering
router.get('/audit-logs', getAuditLogs);

// Get audit log summary stats
router.get('/audit-logs/stats', getAuditLogStats);

// ============================================
// RE-APPROVAL WORKFLOW
// ============================================

// Get time records pending client re-approval
router.get('/pending-reapprovals', getPendingReapprovals);

export default router;
