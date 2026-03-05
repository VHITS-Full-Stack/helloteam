import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { uploadGovernmentIdFile } from '../services/s3.service';
import { sendNotificationEmail } from '../services/email.service';

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
      include: { emergencyContacts: true, user: { select: { email: true } } },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        onboardingStatus: employee.onboardingStatus,
        kycStatus: employee.kycStatus,
        kycRejectionNote: employee.kycRejectionNote,
        email: employee.user?.email,
        personalEmail: employee.personalEmail,
        phone: employee.phone,
        address: employee.address,
        governmentIdType: employee.governmentIdType,
        governmentIdUrl: employee.governmentIdUrl,
        governmentIdStatus: employee.governmentIdStatus,
        governmentIdRejectNote: employee.governmentIdRejectNote,
        governmentId2Type: employee.governmentId2Type,
        governmentId2Url: employee.governmentId2Url,
        governmentId2Status: employee.governmentId2Status,
        governmentId2RejectNote: employee.governmentId2RejectNote,
        proofOfAddressType: employee.proofOfAddressType,
        proofOfAddressUrl: employee.proofOfAddressUrl,
        proofOfAddressStatus: employee.proofOfAddressStatus,
        proofOfAddressRejectNote: employee.proofOfAddressRejectNote,
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

    const { countryCode, phone, address, personalEmail } = req.body;

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
      data: { countryCode: countryCode || '+1', phone, address, personalEmail },
    });

    res.json({ success: true, message: 'Personal info saved' });
  } catch (error) {
    console.error('Save personal info error:', error);
    res.status(500).json({ success: false, error: 'Failed to save personal info' });
  }
};

/**
 * POST /employee-onboarding/emergency-contacts
 * Save Step 2: array of 2-3 emergency contacts. Uses replace strategy.
 */
export const saveEmergencyContacts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length < 2 || contacts.length > 3) {
      res.status(400).json({ success: false, error: 'At least 2 emergency contacts are required' });
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
 * POST /employee-onboarding/government-id-type
 * Save Step 3: government ID type (when file already uploaded).
 */
export const saveGovernmentIdType = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { governmentIdType } = req.body;
    if (!governmentIdType) {
      res.status(400).json({ success: false, error: 'Government ID type is required' });
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
      data: { governmentIdType },
    });

    res.json({ success: true, message: 'Government ID type saved' });
  } catch (error) {
    console.error('Save government ID type error:', error);
    res.status(500).json({ success: false, error: 'Failed to save government ID type' });
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

    // Upload to S3 using centralized service
    const uploadResult = await uploadGovernmentIdFile(file);
    if (!uploadResult.success) {
      res.status(400).json({ success: false, error: uploadResult.error });
      return;
    }

    const governmentIdType = req.body?.governmentIdType || null;

    await prisma.employee.update({
      where: { id: employee.id },
      data: { governmentIdUrl: uploadResult.url, governmentIdType },
    });

    res.json({ success: true, message: 'Government ID uploaded', data: { governmentIdUrl: uploadResult.url, governmentIdType } });
  } catch (error) {
    console.error('Upload government ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload government ID' });
  }
};

/**
 * POST /employee-onboarding/government-id-2
 * Upload Step 3b: second government ID file.
 */
export const uploadGovernmentId2 = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.userId } });
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const uploadResult = await uploadGovernmentIdFile(file);
    if (!uploadResult.success) {
      res.status(400).json({ success: false, error: uploadResult.error });
      return;
    }

    const governmentId2Type = req.body?.governmentId2Type || null;

    await prisma.employee.update({
      where: { id: employee.id },
      data: { governmentId2Url: uploadResult.url, governmentId2Type },
    });

    res.json({ success: true, message: 'Second government ID uploaded', data: { governmentId2Url: uploadResult.url, governmentId2Type } });
  } catch (error) {
    console.error('Upload government ID 2 error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload second government ID' });
  }
};

/**
 * POST /employee-onboarding/proof-of-address
 * Upload Step 3c: proof of address document.
 */
export const uploadProofOfAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.userId } });
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const uploadResult = await uploadGovernmentIdFile(file);
    if (!uploadResult.success) {
      res.status(400).json({ success: false, error: uploadResult.error });
      return;
    }

    const proofOfAddressType = req.body?.proofOfAddressType || null;

    await prisma.employee.update({
      where: { id: employee.id },
      data: { proofOfAddressUrl: uploadResult.url, proofOfAddressType },
    });

    res.json({ success: true, message: 'Proof of address uploaded', data: { proofOfAddressUrl: uploadResult.url, proofOfAddressType } });
  } catch (error) {
    console.error('Upload proof of address error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload proof of address' });
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
      include: { emergencyContacts: true, user: { select: { email: true } } },
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
    if (employee.emergencyContacts.length < 2) errors.push('At least 2 emergency contacts are required');
    const docCount = [employee.governmentIdUrl, employee.governmentId2Url, employee.proofOfAddressUrl].filter(Boolean).length;
    if (docCount < 2) errors.push('At least 2 of 3 identity documents are required (Government ID #1, Government ID #2, Proof of Address)');

    if (errors.length > 0) {
      res.status(400).json({ success: false, error: errors.join('. ') });
      return;
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { onboardingStatus: 'COMPLETED' },
    });

    // Send KYC pending review email to employee
    const email = employee.personalEmail || employee.user?.email;
    if (email) {
      await sendNotificationEmail(
        email,
        'Onboarding Complete - KYC Review Pending',
        `Thank you for completing your onboarding, ${employee.firstName}! Your identity documents are now under review by our team. You will receive an email once your KYC verification is approved and you can access the portal.`,
      ).catch((err) => console.error('Failed to send KYC pending email:', err));
    }

    res.json({ success: true, message: 'Onboarding completed successfully' });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete onboarding' });
  }
};

/**
 * POST /employee-onboarding/resubmit-kyc
 * Reset KYC status to PENDING after employee re-uploads documents following a rejection.
 */
export const resubmitKyc = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.userId },
      include: { user: { select: { email: true } } },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    if (employee.kycStatus !== 'REJECTED') {
      res.status(400).json({ success: false, error: 'KYC resubmission is only allowed after rejection' });
      return;
    }

    // Only reset rejected documents to PENDING — keep approved ones unchanged
    const updateData: Record<string, string | null> = {
      kycStatus: 'PENDING',
      kycRejectionNote: null,
    };

    if (employee.governmentIdStatus === 'REJECTED') {
      updateData.governmentIdStatus = 'PENDING';
      updateData.governmentIdRejectNote = null;
    }
    if (employee.governmentId2Status === 'REJECTED') {
      updateData.governmentId2Status = 'PENDING';
      updateData.governmentId2RejectNote = null;
    }
    if (employee.proofOfAddressStatus === 'REJECTED') {
      updateData.proofOfAddressStatus = 'PENDING';
      updateData.proofOfAddressRejectNote = null;
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: updateData,
    });

    // Send email notification
    const email = employee.personalEmail || employee.user?.email;
    if (email) {
      await sendNotificationEmail(
        email,
        'KYC Documents Resubmitted',
        `Thank you, ${employee.firstName}! Your updated documents have been resubmitted for review. You will receive an email once your KYC verification is approved.`,
      ).catch((err) => console.error('Failed to send KYC resubmit email:', err));
    }

    res.json({ success: true, message: 'KYC resubmitted for review' });
  } catch (error) {
    console.error('Resubmit KYC error:', error);
    res.status(500).json({ success: false, error: 'Failed to resubmit KYC' });
  }
};
