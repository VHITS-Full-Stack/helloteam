import { Router } from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientEmployees,
  assignEmployees,
  removeEmployee,
  updateEmployeeRate,
  getEmployeeRate,
  getEmployeePtoConfig,
  updateEmployeePtoConfig,
  getClientStats,
  downloadAgreementPdf,
} from '../controllers/client.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics - requires clients.view permission
router.get('/stats', requirePermission(PERMISSIONS.CLIENTS.VIEW), getClientStats);

// CRUD operations with granular permissions
router.get('/', requirePermission(PERMISSIONS.CLIENTS.VIEW), getClients);
router.get('/:id', requirePermission(PERMISSIONS.CLIENTS.VIEW), getClient);
router.post('/', requirePermission(PERMISSIONS.CLIENTS.CREATE), createClient);
router.put('/:id', requirePermission(PERMISSIONS.CLIENTS.EDIT), updateClient);
router.delete('/:id', requirePermission(PERMISSIONS.CLIENTS.DELETE), deleteClient);

// Agreement PDF download
router.get('/:id/agreement/pdf', requirePermission(PERMISSIONS.CLIENTS.VIEW), downloadAgreementPdf);

// Employee management for client - requires clients.manage_employees permission
router.get('/:id/employees', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), getClientEmployees);
router.post('/:id/employees', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), assignEmployees);
router.delete('/:id/employees/:employeeId', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), removeEmployee);

// Employee rate management
router.get('/:id/employees/:employeeId/rate', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), getEmployeeRate);
router.put('/:id/employees/:employeeId/rate', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), updateEmployeeRate);

// Employee PTO configuration management
router.get('/:id/employees/:employeeId/pto', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), getEmployeePtoConfig);
router.put('/:id/employees/:employeeId/pto', requirePermission(PERMISSIONS.CLIENTS.MANAGE_EMPLOYEES), updateEmployeePtoConfig);

export default router;
