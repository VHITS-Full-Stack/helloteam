import { Router } from 'express';
import {
  login,
  register,
  getProfile,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  validateSession,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);
router.get('/validate-session', authenticate, validateSession);

export default router;
