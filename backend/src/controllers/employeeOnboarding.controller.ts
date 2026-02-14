import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

/**
 * GET /employee-onboarding/status
 * Get onboarding status + existing data so employee can resume mid-flow.
 */
export const getOnboardingStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
      include: { emergencyContacts: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        onboardingStatus: employee.onboardingStatus,
        personalEmail: employee.personalEmail,
        phone: employee.phone,
        address: employee.address,
        governmentIdUrl: employee.governmentIdUrl,
        emergencyContacts: employee.emergencyContacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
        })),
      },
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch onboarding status' });
  }
};

/**
 * POST /employee-onboarding/personal-info
 * Save Step 1: phone, address, personalEmail.
 */
export const savePersonalInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { phone, address, personalEmail } = req.body;

    if (!phone || !address || !personalEmail) {
      res.status(400).json({ success: false, error: 'Phone, address, and personal email are required' });
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(personalEmail)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { phone, address, personalEmail },
    });

    res.json({ success: true, message: 'Personal info saved' });
  } catch (error) {
    console.error('Save personal info error:', error);
    res.status(500).json({ success: false, error: 'Failed to save personal info' });
  }
};

/**
 * POST /employee-onboarding/emergency-contacts
 * Save Step 2: array of 3 emergency contacts. Uses replace strategy.
 */
export const saveEmergencyContacts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length !== 3) {
      res.status(400).json({ success: false, error: 'Exactly 3 emergency contacts are required' });
      return;
    }

    // Validate each contact
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (!c.name || !c.phone || !c.relationship) {
        res.status(400).json({
          success: false,
          error: `Contact ${i + 1}: name, phone, and relationship are required`,
        });
        return;
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Replace strategy: delete existing, create new
    await prisma.$transaction([
      prisma.emergencyContact.deleteMany({ where: { employeeId: employee.id } }),
      ...contacts.map((c: { name: string; phone: string; relationship: string }) =>
        prisma.emergencyContact.create({
          data: {
            employeeId: employee.id,
            name: c.name,
            phone: c.phone,
            relationship: c.relationship,
          },
        })
      ),
    ]);

    res.json({ success: true, message: 'Emergency contacts saved' });
  } catch (error) {
    console.error('Save emergency contacts error:', error);
    res.status(500).json({ success: false, error: 'Failed to save emergency contacts' });
  }
};

/**
 * POST /employee-onboarding/government-id
 * Upload Step 3: government ID file (images + PDF, 10MB limit).
 */
export const uploadGovernmentId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    // Validate file type (images + PDF)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF',
      });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Upload to S3 - use custom upload since s3.service validates image-only
    const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { v4: uuidv4 } = await import('uuid');

    const s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const bucketName = process.env.AWS_S3_BUCKET || 'hello-team-s3-live';
    const fileExtension = file.originalname.split('.').pop();
    const key = `government-ids/${uuidv4()}.${fileExtension}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucketName, Key: key }),
      { expiresIn: 604800 }
    );

    await prisma.employee.update({
      where: { id: employee.id },
      data: { governmentIdUrl: url },
    });

    res.json({ success: true, message: 'Government ID uploaded', data: { governmentIdUrl: url } });
  } catch (error) {
    console.error('Upload government ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload government ID' });
  }
};

/**
 * POST /employee-onboarding/complete
 * Mark onboarding as complete after verifying all steps.
 */
export const completeOnboarding = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
      include: { emergencyContacts: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Verify all required data
    const errors: string[] = [];

    if (!employee.phone) errors.push('Phone number is required');
    if (!employee.address) errors.push('Address is required');
    if (!employee.personalEmail) errors.push('Personal email is required');
    if (employee.emergencyContacts.length < 3) errors.push('3 emergency contacts are required');
    if (!employee.governmentIdUrl) errors.push('Government ID upload is required');

    if (errors.length > 0) {
      res.status(400).json({ success: false, error: errors.join('. ') });
      return;
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { onboardingStatus: 'COMPLETED' },
    });

    res.json({ success: true, message: 'Onboarding completed successfully' });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete onboarding' });
  }
};
