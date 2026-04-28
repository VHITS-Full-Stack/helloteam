import { Router } from 'express';
import multer from 'multer';
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
  giveRaise,
  giveBonus,
  confirmAdminRaise,
  confirmAdminBonus,
  getRaiseCandidates,
  editPayRate,
  editBillingRate,
  confirmDirectEdit,
  getPunctualityAnalytics,
  getEmployeePunctualityDetails,
  getRealTimeAttendanceMonitoring,
  getAdminAnalytics,
  getActiveEmployees,
  getLunchBreakReview,
  adjustLunchBreak,
} from '../controllers/adminPortal.controller';
import { downloadAdminTimesheetPdf } from '../controllers/timesheet.controller';
import { adminClockOutEmployee } from '../controllers/workSession.controller';

const router = Router();

// Multer for bonus approval proof uploads (images + PDFs, max 10MB)
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, WebP) and PDFs are allowed'));
  },
});

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

// Timesheet PDF download (admin)
router.get('/timesheets/pdf', authenticate, authorize(...adminRoles), downloadAdminTimesheetPdf);

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
router.get('/raise-candidates', authenticate, authorize(...approvalRoles), getRaiseCandidates);
router.post('/give-raise', authenticate, authorize(...approvalRoles), giveRaise);
router.post('/give-bonus', authenticate, authorize(...approvalRoles), giveBonus);
router.post('/raise-requests/:raiseId/approve', authenticate, authorize(...approvalRoles), proofUpload.single('proofFile'), approveRaiseRequest);
router.post('/raise-requests/:raiseId/reject', authenticate, authorize(...approvalRoles), rejectRaiseRequest);
router.post('/raise-requests/:raiseId/confirm', authenticate, authorize(...approvalRoles), confirmAdminRaise);
router.post('/bonus-requests/:bonusId/confirm', authenticate, authorize(...approvalRoles), confirmAdminBonus);

// Direct rate edit endpoints
router.post('/employees/:id/edit-pay-rate', authenticate, authorize(...adjustmentRoles), editPayRate);
router.post('/employees/:id/edit-billing-rate', authenticate, authorize(...adjustmentRoles), editBillingRate);
router.post('/raise-requests/:raiseId/confirm-edit', authenticate, authorize(...adjustmentRoles), confirmDirectEdit);

// Work session endpoints
router.post('/employees/:employeeId/clock-out', authenticate, authorize(...adminRoles), adminClockOutEmployee);
router.get('/employees/active', authenticate, authorize(...adminRoles), getActiveEmployees);

// Lunch break review queue
router.get('/lunch-breaks/review', authenticate, authorize(...adminRoles), getLunchBreakReview);
router.patch('/lunch-breaks/:breakId/adjust', authenticate, authorize(...adminRoles), adjustLunchBreak);

// Analytics endpoints
router.get('/analytics/punctuality', authenticate, authorize(...adminRoles), getPunctualityAnalytics);
router.get('/analytics/punctuality/employee/:employeeId', authenticate, authorize(...adminRoles), getEmployeePunctualityDetails);
router.get('/attendance/monitoring', authenticate, authorize(...adminRoles), getRealTimeAttendanceMonitoring);
router.get('/analytics', authenticate, authorize(...adminRoles), getAdminAnalytics);

export default router;
