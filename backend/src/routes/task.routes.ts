import { Router } from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  addTaskComment,
  getTaskComments,
} from '../controllers/task.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// CRUD operations
router.get('/', requirePermission(PERMISSIONS.TASKS.VIEW), getTasks);
router.get('/:id', requirePermission(PERMISSIONS.TASKS.VIEW), getTask);
router.post('/', requirePermission(PERMISSIONS.TASKS.CREATE), createTask);
router.put('/:id', requirePermission(PERMISSIONS.TASKS.EDIT), updateTask);
router.delete('/:id', requirePermission(PERMISSIONS.TASKS.DELETE), deleteTask);

// Status update (employee + client can use this)
router.patch('/:id/status', requirePermission(PERMISSIONS.TASKS.VIEW), updateTaskStatus);

// Comments (anyone with task view access can comment)
router.get('/:id/comments', requirePermission(PERMISSIONS.TASKS.VIEW), getTaskComments);
router.post('/:id/comments', requirePermission(PERMISSIONS.TASKS.VIEW), addTaskComment);

export default router;
