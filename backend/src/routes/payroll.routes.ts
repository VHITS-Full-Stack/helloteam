import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { getMyPayslips, getMyPayslipDetail } from '../controllers/payslip.controller';
import {
  getPayrollPeriods,
  createPayrollPeriod,
  finalizePayrollPeriod,
  sendPayrollReminders,
  getCurrentPayrollPeriod,
  getPayrollReadinessDashboard,
  getUnapprovedTimeRecords,
  getDisputedTimeRecords,
  lockPayrollPeriod,
  unlockPayrollPeriod,
  getPayrollExportData,
  getEmployeePayrollSummary,
  updatePayrollCutoff,
  addPayrollAdjustment,
  getPayrollAdjustments,
  deletePayrollAdjustment,
  getEmployeePayrollDetail,
  triggerPayslipGeneration,
  getPayrollDateLogs,
} from '../controllers/payroll.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get payroll periods
router.get('/', getPayrollPeriods);

// Get current payroll period
router.get('/current', getCurrentPayrollPeriod);

// Get payroll readiness dashboard (admin only)
router.get('/dashboard', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getPayrollReadinessDashboard);

// Get unapproved time records
router.get('/unapproved', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getUnapprovedTimeRecords);

// Get disputed time records (adjusted but not re-approved)
router.get('/disputed', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getDisputedTimeRecords);

// Get employee payroll summary for a period
router.get('/employee-summary', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getEmployeePayrollSummary);

// Get single employee payroll detail with daily records
router.get('/employee-detail/:employeeId', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getEmployeePayrollDetail);

// Get payroll export data
router.get('/export', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'FINANCE']), getPayrollExportData);

// Create payroll period (admins only)
router.post('/', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), createPayrollPeriod);

// Finalize payroll period
router.put('/:id/finalize', authorizeRoles(['CLIENT', 'SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), finalizePayrollPeriod);

// Lock payroll period
router.put('/:id/lock', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'FINANCE']), lockPayrollPeriod);

// Unlock payroll period (requires higher authority)
router.put('/:id/unlock', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), unlockPayrollPeriod);

// Update payroll cutoff
router.put('/:id/cutoff', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), updatePayrollCutoff);

// Generate payslips for a period
router.post('/generate-payslips', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), triggerPayslipGeneration);

// Send payroll reminders (admins only - typically called by a cron job)
router.post('/send-reminders', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), sendPayrollReminders);

// Payroll adjustments (bonus/deduction)
router.get('/adjustments', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getPayrollAdjustments);
router.post('/adjustments', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), addPayrollAdjustment);
router.delete('/adjustments/:id', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), deletePayrollAdjustment);

// Payroll date change history
router.get('/date-logs', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE']), getPayrollDateLogs);

// Employee payslips
router.get('/payslips/my', getMyPayslips);
router.get('/payslips/my/:id', getMyPayslipDetail);

export default router;
