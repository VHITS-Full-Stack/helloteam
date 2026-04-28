import { Router } from 'express';
import multer from 'multer';
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
  getManualEntries,
  getSessionLogs,
  shiftEndResponse,
  approveManualEntry,
  rejectManualEntry,
  resolveUnauthorizedLunch,
  sendLunchBreakReminder,
  getLunchBypassCount,
} from '../controllers/workSession.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const lunchScreenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
}).single('screenshot');

const router = Router();

// All routes require authentication
router.use(authenticate);

// Employee: Clock in/out (EMPLOYEE role required)
router.post('/clock-in', authorizeRoles(['EMPLOYEE']), clockIn);
router.post('/clock-out', authorizeRoles(['EMPLOYEE']), clockOut);

// Employee: Shift end controlled pause response
router.post('/shift-end-response', authorizeRoles(['EMPLOYEE']), shiftEndResponse);

// Employee: Break management
router.post('/break/start', authorizeRoles(['EMPLOYEE']), startBreak);
router.post('/break/end', authorizeRoles(['EMPLOYEE']), endBreak);
router.post('/break/resolve-unauthorized', authorizeRoles(['EMPLOYEE']), lunchScreenshotUpload, resolveUnauthorizedLunch);
router.post('/break/lunch-reminder', authorizeRoles(['EMPLOYEE']), sendLunchBreakReminder);
router.get('/break/lunch-bypass-count', authorizeRoles(['EMPLOYEE']), getLunchBypassCount);

// Employee: Current session
router.get('/current', authorizeRoles(['EMPLOYEE']), getCurrentSession);

// Employee: Update session notes
router.patch('/notes', authorizeRoles(['EMPLOYEE']), updateSessionNotes);

// Employee: Manual time entry
router.post('/manual-entry', authorizeRoles(['EMPLOYEE']), addManualEntry);
router.get('/manual-entries', authorizeRoles(['EMPLOYEE']), getManualEntries);

// Employee: History and summaries
router.get('/history', authorizeRoles(['EMPLOYEE']), getSessionHistory);
router.get('/today-summary', authorizeRoles(['EMPLOYEE']), getTodaySummary);
router.get('/weekly-summary', authorizeRoles(['EMPLOYEE']), getWeeklySummary);

// Employee: Session logs
router.get('/:sessionId/logs', authorizeRoles(['EMPLOYEE']), getSessionLogs);

// Admin: approve/reject manual entries (no default role - uses specific roles)
router.patch('/manual-entry/:id/approve', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR']), approveManualEntry);
router.patch('/manual-entry/:id/reject', authorizeRoles(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR']), rejectManualEntry);

export default router;