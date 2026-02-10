import { Router } from 'express';
import {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupEmployees,
  addEmployees,
  removeEmployee,
  assignGroupToClient,
  unassignGroupFromClient,
  getGroupClients,
} from '../controllers/group.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// CRUD operations with granular permissions
router.get('/', requirePermission(PERMISSIONS.GROUPS.VIEW), getGroups);
router.get('/:id', requirePermission(PERMISSIONS.GROUPS.VIEW), getGroup);
router.post('/', requirePermission(PERMISSIONS.GROUPS.CREATE), createGroup);
router.put('/:id', requirePermission(PERMISSIONS.GROUPS.EDIT), updateGroup);
router.delete('/:id', requirePermission(PERMISSIONS.GROUPS.DELETE), deleteGroup);

// Employee management for group
router.get('/:id/employees', requirePermission(PERMISSIONS.GROUPS.MANAGE_EMPLOYEES), getGroupEmployees);
router.post('/:id/employees', requirePermission(PERMISSIONS.GROUPS.MANAGE_EMPLOYEES), addEmployees);
router.delete('/:id/employees/:employeeId', requirePermission(PERMISSIONS.GROUPS.MANAGE_EMPLOYEES), removeEmployee);

// Client assignment for group
router.get('/:id/clients', requirePermission(PERMISSIONS.GROUPS.VIEW), getGroupClients);
router.post('/:id/clients', requirePermission(PERMISSIONS.GROUPS.MANAGE_EMPLOYEES), assignGroupToClient);
router.delete('/:id/clients/:clientId', requirePermission(PERMISSIONS.GROUPS.MANAGE_EMPLOYEES), unassignGroupFromClient);

export default router;
