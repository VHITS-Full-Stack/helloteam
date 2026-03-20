import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getAdminDashboardStats,
  getRecentActivity,
  getPendingActions,
  getClientOverview,
  getPayrollReadiness,
  getClientWiseUnapprovedOT,
  getAdminTimeRecords,
  adjustTimeRecord,
  getAdminApprovals,
  finalApproveTimeRecord,
  finalRejectTimeRecord,
  adminRequestRevisionTimeRecord,
  bulkFinalApprove,
  approveLeaveRequest,
  rejectLeaveRequest,
  getRaiseRequests,
  approveRaiseRequest,
  rejectRaiseRequest,
} from '../controllers/adminPortal.controller';

const router = Router();

// All routes require authentication and admin roles
const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE'];
const approvalRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR'];
const adjustmentRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];

// Dashboard endpoints
router.get('/dashboard/stats', authenticate, authorize(...adminRoles), getAdminDashboardStats);
router.get('/dashboard/activity', authenticate, authorize(...adminRoles), getRecentActivity);
router.get('/dashboard/pending-actions', authenticate, authorize(...adminRoles), getPendingActions);
router.get('/dashboard/client-overview', authenticate, authorize(...adminRoles), getClientOverview);
router.get('/dashboard/payroll-readiness', authenticate, authorize(...adminRoles), getPayrollReadiness);
router.get('/dashboard/unapproved-ot', authenticate, authorize(...adminRoles), getClientWiseUnapprovedOT);

// Time Records endpoints
router.get('/time-records', authenticate, authorize(...adminRoles), getAdminTimeRecords);
router.put('/time-records/:recordId/adjust', authenticate, authorize(...adjustmentRoles), adjustTimeRecord);

// Approvals endpoints
router.get('/approvals', authenticate, authorize(...adminRoles), getAdminApprovals);
router.post('/approvals/time-record/:recordId/approve', authenticate, authorize(...approvalRoles), finalApproveTimeRecord);
router.post('/approvals/time-record/:recordId/reject', authenticate, authorize(...approvalRoles), finalRejectTimeRecord);
router.post('/approvals/time-record/:recordId/request-revision', authenticate, authorize(...approvalRoles), adminRequestRevisionTimeRecord);
router.post('/approvals/bulk-approve', authenticate, authorize(...approvalRoles), bulkFinalApprove);
router.post('/approvals/leave/:requestId/approve', authenticate, authorize(...approvalRoles), approveLeaveRequest);
router.post('/approvals/leave/:requestId/reject', authenticate, authorize(...approvalRoles), rejectLeaveRequest);

// Raise request endpoints
router.get('/raise-requests', authenticate, authorize(...adminRoles), getRaiseRequests);
router.post('/raise-requests/:raiseId/approve', authenticate, authorize(...approvalRoles), approveRaiseRequest);
router.post('/raise-requests/:raiseId/reject', authenticate, authorize(...approvalRoles), rejectRaiseRequest);

export default router;
