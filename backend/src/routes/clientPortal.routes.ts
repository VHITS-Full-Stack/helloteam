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
  requestRevisionTimeRecord,
  bulkRequestRevision,
  getClientAnalytics,
  getClientBilling,
  getClientSettings,
  updateClientSettings,
  approveLeaveRequest,
  rejectLeaveRequest,
  getClientGroups,
  createClientGroup,
  updateClientGroup,
  deleteClientGroup,
  addEmployeesToClientGroup,
  removeEmployeeFromClientGroup,
  getClientEmployeesList,
  getPendingOvertimeSummary,
} from '../controllers/clientPortal.controller';
import {
  getClientInvoices,
  getClientInvoiceById,
  downloadClientInvoicePdf,
  clientMarkInvoicePaid,
} from '../controllers/invoice.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { requireOnboardingComplete } from '../middleware/onboarding.middleware';

const router = Router();

// All routes require authentication, CLIENT role, and completed onboarding
router.use(authenticate);
router.use(authorizeRoles(['CLIENT']));
router.use(requireOnboardingComplete);

// ============================================
// DASHBOARD ROUTES
// ============================================

// Get dashboard statistics
router.get('/dashboard/stats', getClientDashboardStats);

// Get weekly hours overview for chart
router.get('/dashboard/weekly-hours', getWeeklyHoursOverview);

// Get pending approvals
router.get('/dashboard/pending-approvals', getPendingApprovals);

// Get pending unapproved overtime summary (for dashboard alert / login blocker)
router.get('/dashboard/pending-overtime', getPendingOvertimeSummary);

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

// Bulk reject time records (overtime only)
router.post('/approvals/bulk-reject', bulkRejectTimeRecords);

// Request revision for a regular time record
router.post('/approvals/time-record/:recordId/request-revision', requestRevisionTimeRecord);

// Bulk request revision for regular time records
router.post('/approvals/bulk-request-revision', bulkRequestRevision);

// Approve a leave request
router.post('/approvals/leave/:requestId/approve', approveLeaveRequest);

// Reject a leave request
router.post('/approvals/leave/:requestId/reject', rejectLeaveRequest);

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

// ============================================
// INVOICE ROUTES
// ============================================

// Get invoices for this client
router.get('/invoices', getClientInvoices);

// Download invoice PDF
router.get('/invoices/:invoiceId/pdf', downloadClientInvoicePdf);

// Get single invoice detail
router.get('/invoices/:invoiceId', getClientInvoiceById);

// Client marks invoice as paid
router.post('/invoices/:invoiceId/mark-paid', clientMarkInvoicePaid);

// ============================================
// SETTINGS ROUTES
// ============================================

// Get client settings
router.get('/settings', getClientSettings);

// Update client settings (policies)
router.put('/settings', updateClientSettings);

// ============================================
// GROUPS ROUTES
// ============================================

// Get groups assigned to this client
router.get('/groups', getClientGroups);

// Create a new group
router.post('/groups', createClientGroup);

// Update a group
router.put('/groups/:groupId', updateClientGroup);

// Delete a group
router.delete('/groups/:groupId', deleteClientGroup);

// Add employees to a group
router.post('/groups/:groupId/employees', addEmployeesToClientGroup);

// Remove employee from a group
router.delete('/groups/:groupId/employees/:employeeId', removeEmployeeFromClientGroup);

// Get employees assigned to this client (for group management)
router.get('/employees', getClientEmployeesList);

export default router;
