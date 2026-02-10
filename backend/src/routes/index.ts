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
import settingsRoutes from './settings.routes';
import notificationRoutes from './notification.routes';
import overtimeRoutes from './overtime.routes';
import payrollRoutes from './payroll.routes';
import leaveRoutes from './leave.routes';
import timeAdjustmentRoutes from './timeAdjustment.routes';
import leavePolicyRoutes from './leavePolicy.routes';
import groupRoutes from './group.routes';

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
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/overtime-requests', overtimeRoutes);
router.use('/payroll', payrollRoutes);
router.use('/leave', leaveRoutes);
router.use('/time-adjustments', timeAdjustmentRoutes);
router.use('/leave-policy', leavePolicyRoutes);
router.use('/groups', groupRoutes);
// router.use('/support-tickets', supportTicketRoutes);

export default router;
