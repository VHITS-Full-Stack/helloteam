import { Router } from 'express';
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getCurrentSession,
  getSessionHistory,
  getTodaySummary,
  getWeeklySummary,
} from '../controllers/workSession.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and EMPLOYEE role
router.use(authenticate);
router.use(authorizeRoles('EMPLOYEE'));

// Clock in/out
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

// Break management
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);

// Current session
router.get('/current', getCurrentSession);

// History and summaries
router.get('/history', getSessionHistory);
router.get('/today-summary', getTodaySummary);
router.get('/weekly-summary', getWeeklySummary);

export default router;
