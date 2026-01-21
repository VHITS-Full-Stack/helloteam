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
} from '../controllers/employee.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin only routes
const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR'];

// Statistics
router.get('/stats', authorizeRoles(adminRoles), getEmployeeStats);

// CRUD operations
router.get('/', authorizeRoles(adminRoles), getEmployees);
router.get('/:id', authorizeRoles(adminRoles), getEmployee);
router.post('/', authorizeRoles(adminRoles), createEmployee);
router.put('/:id', authorizeRoles(adminRoles), updateEmployee);
router.delete('/:id', authorizeRoles(['SUPER_ADMIN', 'ADMIN']), deleteEmployee);

// Client assignment
router.post('/:id/assign', authorizeRoles(adminRoles), assignToClient);
router.post('/:id/unassign', authorizeRoles(adminRoles), removeFromClient);

export default router;
