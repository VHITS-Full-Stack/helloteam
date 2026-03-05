import { Router } from 'express';
import {
  login,
  register,
  getProfile,
  updateProfile,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  validateSession,
  impersonateUser,
  verifyUrlToken,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-token', verifyUrlToken);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);
router.get('/validate-session', authenticate, validateSession);
router.post('/impersonate/:userId', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), impersonateUser);

export default router;
