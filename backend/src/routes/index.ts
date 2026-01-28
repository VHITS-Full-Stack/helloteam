import { Router } from 'express';
import authRoutes from './auth.routes';
import employeeRoutes from './employee.routes';
import clientRoutes from './client.routes';
import clientPortalRoutes from './clientPortal.routes';
import adminPortalRoutes from './adminPortal.routes';
import permissionsRoutes from './permissions.routes';
import rolesRoutes from './roles.routes';
import usersRoutes from './users.routes';
import workSessionRoutes from './workSession.routes';
import scheduleRoutes from './schedule.routes';
import timeRecordRoutes from './timeRecord.routes';
import uploadRoutes from './upload.routes';

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
router.use('/client-portal', clientPortalRoutes);
router.use('/admin-portal', adminPortalRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/roles', rolesRoutes);
router.use('/users', usersRoutes);
router.use('/work-sessions', workSessionRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/time-records', timeRecordRoutes);
router.use('/upload', uploadRoutes);
// router.use('/leave-requests', leaveRequestRoutes);
// router.use('/support-tickets', supportTicketRoutes);

export default router;
