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
  getClientStats,
} from '../controllers/client.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin only routes
const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE'];

// Statistics
router.get('/stats', authorizeRoles(adminRoles), getClientStats);

// CRUD operations
router.get('/', authorizeRoles(adminRoles), getClients);
router.get('/:id', authorizeRoles(adminRoles), getClient);
router.post('/', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), createClient);
router.put('/:id', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']), updateClient);
router.delete('/:id', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), deleteClient);

// Employee management for client
router.get('/:id/employees', authorizeRoles(adminRoles), getClientEmployees);
router.post('/:id/employees', authorizeRoles(adminRoles), assignEmployees);
router.delete('/:id/employees/:employeeId', authorizeRoles(adminRoles), removeEmployee);

export default router;
