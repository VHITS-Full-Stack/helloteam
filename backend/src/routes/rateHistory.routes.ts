import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getRateChangeHistory,
  getEmployeeRateHistory,
} from '../controllers/rateHistory.controller';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

// Get all rate change history
router.get('/', authenticate, authorize(...adminRoles), getRateChangeHistory);

// Get rate change history for a specific employee
router.get('/:employeeId', authenticate, authorize(...adminRoles), getEmployeeRateHistory);

export default router;
