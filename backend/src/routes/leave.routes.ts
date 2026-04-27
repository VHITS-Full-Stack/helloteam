import { Router } from 'express';
import multer from 'multer';
import {
  getLeaveOptions,
  getLeaveBalance,
  submitLeaveRequest,
  getLeaveHistory,
  cancelLeaveRequest,
  getLeaveRequestDetails,
} from '../controllers/leave.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// All routes require authentication and EMPLOYEE role
router.use(authenticate);
router.use(authorizeRoles(['EMPLOYEE']));

// Get leave options available to employee (based on client policy)
router.get('/options', getLeaveOptions);

// Get leave balance
router.get('/balance', getLeaveBalance);

// Submit a leave request (with optional document upload)
router.post('/request', upload.array('documents', 5), submitLeaveRequest);

// Get leave request history
router.get('/history', getLeaveHistory);

// Get single leave request details
router.get('/request/:requestId', getLeaveRequestDetails);

// Cancel a leave request
router.delete('/request/:requestId', cancelLeaveRequest);

export default router;
