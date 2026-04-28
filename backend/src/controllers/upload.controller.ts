import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { uploadToS3, deleteFromS3, getKeyFromUrl } from '../services/s3.service';

/**
 * Upload profile photo for employee
 */
export const uploadProfilePhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    // Get user with employee data
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Delete old photo from S3 if exists
    if (user.employee.profilePhoto) {
      const oldKey = getKeyFromUrl(user.employee.profilePhoto);
      if (oldKey) {
        await deleteFromS3(oldKey);
      }
    }

    // Upload new photo to S3
    const uploadResult = await uploadToS3(req.file, 'profile-photos');

    if (!uploadResult.success) {
      res.status(400).json({ success: false, error: uploadResult.error });
      return;
    }

    // Update employee profile photo URL in database
    const updatedEmployee = await prisma.employee.update({
      where: { id: user.employee.id },
      data: { profilePhoto: uploadResult.url },
    });

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePhoto: updatedEmployee.profilePhoto,
      },
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload profile photo' });
  }
};

/**
 * Delete profile photo for employee
 */
export const deleteProfilePhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    // Get user with employee data
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    if (!user.employee.profilePhoto) {
      res.status(400).json({ success: false, error: 'No profile photo to delete' });
      return;
    }

    // Delete from S3
    const key = getKeyFromUrl(user.employee.profilePhoto);
    if (key) {
      await deleteFromS3(key);
    }

    // Update database
    await prisma.employee.update({
      where: { id: user.employee.id },
      data: { profilePhoto: null },
    });

    res.json({
      success: true,
      message: 'Profile photo deleted successfully',
    });
  } catch (error) {
    console.error('Delete profile photo error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete profile photo' });
  }
};

/**
 * Upload company logo for client
 */
export const uploadClientLogo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    // Get user with client data
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { client: true },
    });

    if (!user || !user.client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Delete old logo from S3 if exists
    if (user.client.logoUrl) {
      const oldKey = getKeyFromUrl(user.client.logoUrl);
      if (oldKey) {
        await deleteFromS3(oldKey);
      }
    }

    // Upload new logo to S3
    const uploadResult = await uploadToS3(req.file, 'client-logos');

    if (!uploadResult.success) {
      res.status(400).json({ success: false, error: uploadResult.error });
      return;
    }

    // Update client logo URL in database
    const updatedClient = await prisma.client.update({
      where: { id: user.client.id },
      data: { logoUrl: uploadResult.url },
    });

    res.json({
      success: true,
      message: 'Company logo uploaded successfully',
      data: {
        logoUrl: updatedClient.logoUrl,
      },
    });
  } catch (error) {
    console.error('Upload client logo error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload company logo' });
  }
};

/**
 * Delete company logo for client
 */
export const deleteClientLogo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    // Get user with client data
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { client: true },
    });

    if (!user || !user.client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    if (!user.client.logoUrl) {
      res.status(400).json({ success: false, error: 'No logo to delete' });
      return;
    }

    // Delete from S3
    const key = getKeyFromUrl(user.client.logoUrl);
    if (key) {
      await deleteFromS3(key);
    }

    // Update database
    await prisma.client.update({
      where: { id: user.client.id },
      data: { logoUrl: null },
    });

    res.json({
      success: true,
      message: 'Company logo deleted successfully',
    });
  } catch (error) {
    console.error('Delete client logo error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete company logo' });
  }
};

/**
 * Upload break screenshot for unauthorized lunch resolution
 */
export const uploadBreakScreenshot = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const { breakId, explanation } = req.body;

    if (!breakId) {
      res.status(400).json({ success: false, error: 'Break ID is required' });
      return;
    }

    if (!explanation || explanation.length < 20 || explanation.length > 500) {
      res.status(400).json({ success: false, error: 'Explanation must be between 20 and 500 characters' });
      return;
    }

    // Verify break belongs to employee's current session
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const activeSession = await prisma.workSession.findFirst({
      where: { employeeId: user.employee.id, status: { in: ['ACTIVE', 'ON_BREAK'] } },
      include: { breaks: { where: { endTime: null }, orderBy: { startTime: 'desc' }, take: 1 } },
    });

    if (!activeSession || !activeSession.breaks[0]) {
      res.status(400).json({ success: false, error: 'No active break found' });
      return;
    }

    if (activeSession.breaks[0].id !== breakId) {
      res.status(400).json({ success: false, error: 'Break ID mismatch' });
      return;
    }

    // Upload screenshot to S3
    const uploadResult = await uploadToS3(req.file, 'break-screenshots');

    if (!uploadResult.success) {
      res.status(400).json({ success: false, error: uploadResult.error });
      return;
    }

    // Get current break to calculate duration
    const currentBreak = await prisma.break.findUnique({ where: { id: breakId } });
    if (!currentBreak) {
      res.status(400).json({ success: false, error: 'Break not found' });
      return;
    }

    const endTime = new Date();
    const elapsedMinutes = Math.round((endTime.getTime() - new Date(currentBreak.startTime).getTime()) / 60000);
    const scheduledDuration = currentBreak.scheduledDurationMinutes ?? 30;

    // Update break with screenshot, explanation, and resolution - treat all time as paid pending review
    await prisma.break.update({
      where: { id: breakId },
      data: {
        endTime,
        durationMinutes: elapsedMinutes,
        wasWorkingScreenshotUrl: uploadResult.url,
        wasWorkingExplanation: explanation,
        bypassApprovalStatus: 'PENDING_REVIEW',
        lunchStatus: 'WAS_WORKING',
        paidMinutes: elapsedMinutes,
        unpaidMinutes: 0,
      },
    });

    // Update work session status back to ACTIVE
    await prisma.workSession.update({
      where: { id: currentBreak.workSessionId },
      data: { status: 'ACTIVE' },
    });

    res.json({
      success: true,
      message: 'Screenshot submitted. You are now back to working status pending review.',
      screenshotUrl: uploadResult.url,
    });
  } catch (error) {
    console.error('Upload break screenshot error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload screenshot' });
  }
};
