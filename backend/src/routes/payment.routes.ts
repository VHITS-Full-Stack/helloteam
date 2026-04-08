import { Router } from 'express';
import { getAllPayments, refundPayment, voidPayment } from '../controllers/payment.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All routes require ADMIN role
router.use(authenticate);
router.use(authorizeRoles(['ADMIN']));

// Get all payments with filters
router.get('/', getAllPayments);

// Refund a payment
router.post('/:paymentId/refund', refundPayment);

// Void a payment
router.post('/:paymentId/void', voidPayment);

export default router;
