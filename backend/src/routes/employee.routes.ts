import { Router } from 'express';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  assignToClient,
  removeFromClient,
  getEmployeeStats,
  terminateEmployee,
  reactivateEmployee,
  approveEmployeeKyc,
  rejectEmployeeKyc,
  reviewEmployeeDocument,
  finalizeKycReview,
  resendOnboardingEmail,
} from '../controllers/employee.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics - requires employees.view permission
router.get('/stats', requirePermission(PERMISSIONS.EMPLOYEES.VIEW), getEmployeeStats);

// CRUD operations with granular permissions
router.get('/', requirePermission(PERMISSIONS.EMPLOYEES.VIEW), getEmployees);
router.get('/:id', requirePermission(PERMISSIONS.EMPLOYEES.VIEW), getEmployee);
router.post('/', requirePermission(PERMISSIONS.EMPLOYEES.CREATE), createEmployee);
router.put('/:id', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), updateEmployee);
router.delete('/:id', requirePermission(PERMISSIONS.EMPLOYEES.DELETE), deleteEmployee);

// Terminate employee - requires employees.delete permission
router.post('/:id/terminate', requirePermission(PERMISSIONS.EMPLOYEES.DELETE), terminateEmployee);

// Reactivate terminated employee - requires employees.edit permission
router.post('/:id/reactivate', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), reactivateEmployee);

// KYC review - requires employees.edit permission
router.post('/:id/kyc/review', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), reviewEmployeeDocument);
router.post('/:id/kyc/finalize', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), finalizeKycReview);
router.post('/:id/kyc/approve', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), approveEmployeeKyc);
router.post('/:id/kyc/reject', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), rejectEmployeeKyc);

// Resend onboarding email - requires employees.edit permission
router.post('/:id/resend-onboarding', requirePermission(PERMISSIONS.EMPLOYEES.EDIT), resendOnboardingEmail);

// Client assignment - requires employees.assign permission
router.post('/:id/assign', requirePermission(PERMISSIONS.EMPLOYEES.ASSIGN), assignToClient);
router.post('/:id/unassign', requirePermission(PERMISSIONS.EMPLOYEES.ASSIGN), removeFromClient);

export default router;
