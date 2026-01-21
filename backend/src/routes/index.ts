import { Router } from 'express';
import authRoutes from './auth.routes';
import employeeRoutes from './employee.routes';
import clientRoutes from './client.routes';
import permissionsRoutes from './permissions.routes';
import rolesRoutes from './roles.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Hello Team API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/clients', clientRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/roles', rolesRoutes);

// Future routes will be added here:
// router.use('/admin', adminRoutes);
// router.use('/work-sessions', workSessionRoutes);
// router.use('/time-records', timeRecordRoutes);
// router.use('/schedules', scheduleRoutes);
// router.use('/leave-requests', leaveRequestRoutes);
// router.use('/support-tickets', supportTicketRoutes);

export default router;
