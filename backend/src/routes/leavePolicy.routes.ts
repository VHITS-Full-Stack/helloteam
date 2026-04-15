import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import {
  // Policy Configuration
  getClientsWithPolicies,
  getClientPolicy,
  updateClientPolicy,
  // Balance Management
  getEmployeeBalances,
  getEmployeeBalanceDetails,
  adjustEmployeeBalance,
  getAdjustmentHistory,
  // Accrual
  runAccrualCalculation,
  // Leave Approval Queue
  getAllPendingLeaveRequests,
  adminApproveLeave,
  adminRejectLeave,
  bulkApproveLeave,
  adminCreateLeave,
} from '../controllers/leavePolicy.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Policy Configuration - Admin only
router.get('/clients', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), getClientsWithPolicies);
router.get('/clients/:clientId', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), getClientPolicy);
router.put('/clients/:clientId', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), updateClientPolicy);

// Balance Management - Admin only
router.get('/balances', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), getEmployeeBalances);
router.get('/balances/:employeeId', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), getEmployeeBalanceDetails);
router.post('/balances/:employeeId/adjust', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), adjustEmployeeBalance);
router.get('/adjustments', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), getAdjustmentHistory);

// Accrual Calculation - Admin only
router.post('/accrual/run', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), runAccrualCalculation);

// Leave Approval Queue - Admin only
router.get('/requests', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), getAllPendingLeaveRequests);
router.post('/requests/:requestId/approve', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), adminApproveLeave);
router.post('/requests/:requestId/reject', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), adminRejectLeave);
router.post('/requests/bulk-approve', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), bulkApproveLeave);
router.post('/requests/admin-create', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'HR']), adminCreateLeave);

export default router;
