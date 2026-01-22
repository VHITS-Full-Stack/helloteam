import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

// Get employee's schedule for a specific week
export const getMySchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { weekStart } = req.query;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    // Calculate week range
    let startDate: Date;
    if (weekStart) {
      startDate = new Date(weekStart as string);
    } else {
      // Default to current week (starting Sunday)
      const now = new Date();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    // Get active schedules for this employee
    const schedules = await prisma.schedule.findMany({
      where: {
        employeeId: employee.id,
        isActive: true,
        effectiveFrom: { lte: endDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: startDate } },
        ],
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Build weekly schedule with dates
    const weekSchedule = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);
      const dayOfWeek = dayDate.getDay();

      const daySchedule = schedules.find(s => s.dayOfWeek === dayOfWeek);

      weekSchedule.push({
        date: dayDate.toISOString().split('T')[0],
        dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        isScheduled: !!daySchedule,
        startTime: daySchedule?.startTime || null,
        endTime: daySchedule?.endTime || null,
        scheduledMinutes: daySchedule
          ? calculateMinutes(daySchedule.startTime, daySchedule.endTime)
          : 0,
      });
    }

    // Calculate total scheduled hours for the week
    const totalScheduledMinutes = weekSchedule.reduce((sum, day) => sum + day.scheduledMinutes, 0);

    res.json({
      success: true,
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: new Date(endDate.getTime() - 1).toISOString().split('T')[0],
      schedule: weekSchedule,
      totalScheduledMinutes,
      totalScheduledHours: Math.round(totalScheduledMinutes / 60 * 10) / 10,
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to get schedule' });
  }
};

// Get today's schedule
export const getTodaySchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee record not found' });
      return;
    }

    const today = new Date();
    const dayOfWeek = today.getDay();

    const schedule = await prisma.schedule.findFirst({
      where: {
        employeeId: employee.id,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { lte: today },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: today } },
        ],
      },
    });

    if (!schedule) {
      res.json({
        success: true,
        isScheduled: false,
        message: 'No schedule for today',
        date: today.toISOString().split('T')[0],
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      });
      return;
    }

    res.json({
      success: true,
      isScheduled: true,
      date: today.toISOString().split('T')[0],
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      scheduledMinutes: calculateMinutes(schedule.startTime, schedule.endTime),
    });
  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to get today schedule' });
  }
};

// Helper function to calculate minutes between two times
function calculateMinutes(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

// ============================================
// ADMIN: Schedule Management
// ============================================

// Get all schedules for an employee (Admin view)
export const getEmployeeSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: { email: true, status: true },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        employeeId,
        isActive: true,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({
      success: true,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.user.email,
      },
      schedules,
    });
  } catch (error) {
    console.error('Get employee schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to get employee schedule' });
  }
};

// Create or update schedule for an employee
export const upsertSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const { dayOfWeek, startTime, endTime, effectiveFrom } = req.body;

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    // Validate day of week
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      res.status(400).json({ success: false, message: 'Invalid day of week (must be 0-6)' });
      return;
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      res.status(400).json({ success: false, message: 'Invalid time format (use HH:MM)' });
      return;
    }

    // Check for existing active schedule on this day
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        employeeId,
        dayOfWeek,
        isActive: true,
      },
    });

    let schedule;
    if (existingSchedule) {
      // Update existing schedule
      schedule = await prisma.schedule.update({
        where: { id: existingSchedule.id },
        data: {
          startTime,
          endTime,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : existingSchedule.effectiveFrom,
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          dayOfWeek,
          startTime,
          endTime,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
          isActive: true,
        },
      });
    }

    res.status(existingSchedule ? 200 : 201).json({
      success: true,
      message: existingSchedule ? 'Schedule updated' : 'Schedule created',
      schedule,
    });
  } catch (error) {
    console.error('Upsert schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to save schedule' });
  }
};

// Bulk update schedule for an employee (set full week)
export const bulkUpdateSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const { schedules, effectiveFrom } = req.body;

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    // Validate schedules array
    if (!Array.isArray(schedules)) {
      res.status(400).json({ success: false, message: 'Schedules must be an array' });
      return;
    }

    const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    // Deactivate all current schedules
    await prisma.schedule.updateMany({
      where: {
        employeeId,
        isActive: true,
      },
      data: {
        isActive: false,
        effectiveTo: effectiveDate,
      },
    });

    // Create new schedules
    const createdSchedules = [];
    for (const sched of schedules) {
      if (sched.startTime && sched.endTime) {
        const newSchedule = await prisma.schedule.create({
          data: {
            employeeId,
            dayOfWeek: sched.dayOfWeek,
            startTime: sched.startTime,
            endTime: sched.endTime,
            effectiveFrom: effectiveDate,
            isActive: true,
          },
        });
        createdSchedules.push(newSchedule);
      }
    }

    res.json({
      success: true,
      message: `Created ${createdSchedules.length} schedule entries`,
      schedules: createdSchedules,
    });
  } catch (error) {
    console.error('Bulk update schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update schedules' });
  }
};

// Delete (deactivate) a schedule
export const deleteSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { scheduleId } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found' });
      return;
    }

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        isActive: false,
        effectiveTo: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Schedule deleted',
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete schedule' });
  }
};
