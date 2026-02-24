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
  updateSessionNotes,
  addManualEntry,
  getSessionLogs,
  shiftEndResponse,
} from '../controllers/workSession.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and EMPLOYEE role
router.use(authenticate);
router.use(authorizeRoles(['EMPLOYEE']));

// Clock in/out
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

// Shift end controlled pause response
router.post('/shift-end-response', shiftEndResponse);

// Break management
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);

// Current session
router.get('/current', getCurrentSession);

// Update session notes
router.patch('/notes', updateSessionNotes);

// Manual time entry
router.post('/manual-entry', addManualEntry);

// History and summaries
router.get('/history', getSessionHistory);
router.get('/today-summary', getTodaySummary);
router.get('/weekly-summary', getWeeklySummary);

// Session logs
router.get('/:sessionId/logs', getSessionLogs);

export default router;
