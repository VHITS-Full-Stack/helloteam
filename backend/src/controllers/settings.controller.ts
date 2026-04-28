import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import { uploadCmsDocument, deleteFromS3, getKeyFromUrl, getPresignedUrl, streamFromS3, isS3Configured } from '../services/s3.service';
import { AuthenticatedRequest } from '../types';

// Default settings values
const DEFAULT_SETTINGS = {
  notifications: {
    newEmployeeRegistrations: true,
    newClientSignups: true,
    overtimeAlerts: true,
    missedClockOuts: true,
    payrollProcessingReminders: true,
    systemHealthAlerts: true,
    dailySummaryReports: false,
    weeklyAnalyticsDigest: true,
  },
  security: {
    minPasswordLength: 8,
    requireSpecialChars: true,
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 30,
    enforce2FAForAdmins: true,
  },
  general: {
    companyName: 'The Hello Team LLC',
    companyAddress: '422 Butterfly road Jackson NJ 08527',
    defaultTimezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    workWeekStart: 'Sunday',
    overtimeThreshold: 40,
    payrollPeriod: 'Bi-weekly',
  },
  cms: {
    legalTerms: '<p>This agreement outlines the professional staffing services provided by Hello Team...</p>',
    newHireGuide: '<p>Welcome to your new team! This guide will help you get started...</p>',
    privacyPolicy: '<p>Hello Team is committed to protecting your privacy...</p>',
    welcomeTips: '<p>Here are some best practices to help you get the most out of your Hello Team engagement...</p>',
    newHireGuidePdfKey: null,
    newHireGuidePdfUrl: null,
    welcomeTipsPdfKey: null,
    welcomeTipsPdfUrl: null,
  },
  'email-notifications': {
    notifications: {
      lunch_break_10min_past: {
        enabled: true,
        emails: [],
      },
    },
  },
};

// Build CMS settings object from DB rows, refreshing presigned PDF URL if needed
async function buildCmsSettings(rows: { key: string; value: string }[]) {
  const obj: Record<string, any> = {};
  rows.forEach((row) => {
    try { obj[row.key] = JSON.parse(row.value); } catch { obj[row.key] = row.value; }
  });

  const merged = { ...DEFAULT_SETTINGS.cms, ...obj };

  // Refresh presigned URL for the PDF if stored by key (S3 URLs expire)
  if (merged.newHireGuidePdfKey) {
    if (isS3Configured) {
      merged.newHireGuidePdfUrl = await getPresignedUrl(merged.newHireGuidePdfKey) || merged.newHireGuidePdfUrl;
    }
  }

  if (merged.welcomeTipsPdfKey) {
    if (isS3Configured) {
      merged.welcomeTipsPdfUrl = await getPresignedUrl(merged.welcomeTipsPdfKey) || merged.welcomeTipsPdfUrl;
    }
  }

  return merged;
}

// Get CMS settings (accessible to clients for onboarding)
export const getCmsSettings = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.systemSettings.findMany({ where: { category: 'cms' } });
    const data = await buildCmsSettings(rows);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching CMS settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

// Upload new hire guide PDF (admin only)
export const uploadNewHireGuidePdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Delete old PDF from S3/local if one exists
    const existing = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'cms', key: 'newHireGuidePdfKey' } },
    });
    if (existing) {
      const oldKey = JSON.parse(existing.value);
      if (oldKey) await deleteFromS3(oldKey);
    }

    const result = await uploadCmsDocument(req.file);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Store key and metadata
    const upserts = [
      prisma.systemSettings.upsert({
        where: { category_key: { category: 'cms', key: 'newHireGuidePdfKey' } },
        update: { value: JSON.stringify(result.key) },
        create: { category: 'cms', key: 'newHireGuidePdfKey', value: JSON.stringify(result.key) },
      }),
      prisma.systemSettings.upsert({
        where: { category_key: { category: 'cms', key: 'newHireGuidePdfUrl' } },
        update: { value: JSON.stringify(result.url) },
        create: { category: 'cms', key: 'newHireGuidePdfUrl', value: JSON.stringify(result.url) },
      }),
      prisma.systemSettings.upsert({
        where: { category_key: { category: 'cms', key: 'newHireGuidePdfName' } },
        update: { value: JSON.stringify(req.file.originalname) },
        create: { category: 'cms', key: 'newHireGuidePdfName', value: JSON.stringify(req.file.originalname) },
      }),
    ];
    await Promise.all(upserts);

    const rows = await prisma.systemSettings.findMany({ where: { category: 'cms' } });
    const data = await buildCmsSettings(rows);

    return res.json({ success: true, data, message: 'PDF uploaded successfully' });
  } catch (error) {
    console.error('Error uploading new hire guide PDF:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload PDF' });
  }
};

// Delete new hire guide PDF (admin only)
export const deleteNewHireGuidePdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keyRow = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'cms', key: 'newHireGuidePdfKey' } },
    });

    if (keyRow) {
      const s3Key = JSON.parse(keyRow.value);
      if (s3Key) await deleteFromS3(s3Key);
    }

    await prisma.systemSettings.deleteMany({
      where: {
        category: 'cms',
        key: { in: ['newHireGuidePdfKey', 'newHireGuidePdfUrl', 'newHireGuidePdfName'] },
      },
    });

    return res.json({ success: true, message: 'PDF removed successfully' });
  } catch (error) {
    console.error('Error deleting new hire guide PDF:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete PDF' });
  }
};

// Stream new hire guide PDF to client (works for both S3 and local storage)
export const streamNewHireGuidePdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keyRow = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'cms', key: 'newHireGuidePdfKey' } },
    });

    if (!keyRow) {
      return res.status(404).json({ success: false, error: 'No PDF uploaded' });
    }

    const key = JSON.parse(keyRow.value) as string;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="new-hire-guide.pdf"');

    if (isS3Configured) {
      // Proxy through backend to avoid browser CORS issues with S3 cross-origin requests
      const stream = await streamFromS3(key);
      if (!stream) return res.status(404).json({ success: false, error: 'Failed to load PDF from storage' });
      stream.pipe(res);
      return;
    }

    // Local storage fallback — stream directly
    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
    const filePath = path.join(UPLOADS_DIR, key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'PDF file not found' });
    }

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error streaming new hire guide PDF:', error);
    return res.status(500).json({ success: false, error: 'Failed to load PDF' });
  }
};

// Upload welcome tips PDF (admin only)
export const uploadWelcomeTipsPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const existing = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'cms', key: 'welcomeTipsPdfKey' } },
    });
    if (existing) {
      const oldKey = JSON.parse(existing.value);
      if (oldKey) await deleteFromS3(oldKey);
    }

    const result = await uploadCmsDocument(req.file);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const upserts = [
      prisma.systemSettings.upsert({
        where: { category_key: { category: 'cms', key: 'welcomeTipsPdfKey' } },
        update: { value: JSON.stringify(result.key) },
        create: { category: 'cms', key: 'welcomeTipsPdfKey', value: JSON.stringify(result.key) },
      }),
      prisma.systemSettings.upsert({
        where: { category_key: { category: 'cms', key: 'welcomeTipsPdfUrl' } },
        update: { value: JSON.stringify(result.url) },
        create: { category: 'cms', key: 'welcomeTipsPdfUrl', value: JSON.stringify(result.url) },
      }),
      prisma.systemSettings.upsert({
        where: { category_key: { category: 'cms', key: 'welcomeTipsPdfName' } },
        update: { value: JSON.stringify(req.file.originalname) },
        create: { category: 'cms', key: 'welcomeTipsPdfName', value: JSON.stringify(req.file.originalname) },
      }),
    ];
    await Promise.all(upserts);

    const rows = await prisma.systemSettings.findMany({ where: { category: 'cms' } });
    const data = await buildCmsSettings(rows);

    return res.json({ success: true, data, message: 'PDF uploaded successfully' });
  } catch (error) {
    console.error('Error uploading welcome tips PDF:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload PDF' });
  }
};

// Delete welcome tips PDF (admin only)
export const deleteWelcomeTipsPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keyRow = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'cms', key: 'welcomeTipsPdfKey' } },
    });

    if (keyRow) {
      const s3Key = JSON.parse(keyRow.value);
      if (s3Key) await deleteFromS3(s3Key);
    }

    await prisma.systemSettings.deleteMany({
      where: {
        category: 'cms',
        key: { in: ['welcomeTipsPdfKey', 'welcomeTipsPdfUrl', 'welcomeTipsPdfName'] },
      },
    });

    return res.json({ success: true, message: 'PDF removed successfully' });
  } catch (error) {
    console.error('Error deleting welcome tips PDF:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete PDF' });
  }
};

// Stream welcome tips PDF to client
export const streamWelcomeTipsPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keyRow = await prisma.systemSettings.findUnique({
      where: { category_key: { category: 'cms', key: 'welcomeTipsPdfKey' } },
    });

    if (!keyRow) {
      return res.status(404).json({ success: false, error: 'No PDF uploaded' });
    }

    const key = JSON.parse(keyRow.value) as string;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="welcome-tips.pdf"');

    if (isS3Configured) {
      // Proxy through backend to avoid browser CORS issues with S3 cross-origin requests
      const stream = await streamFromS3(key);
      if (!stream) return res.status(404).json({ success: false, error: 'Failed to load PDF from storage' });
      stream.pipe(res);
      return;
    }

    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
    const filePath = path.join(UPLOADS_DIR, key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'PDF file not found' });
    }

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error streaming welcome tips PDF:', error);
    return res.status(500).json({ success: false, error: 'Failed to load PDF' });
  }
};

// Get settings by category
export const getSettingsByCategory = async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;

    if (!['notifications', 'security', 'general', 'billing', 'cms', 'email-notifications'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings category',
      });
    }

    const settings = await prisma.systemSettings.findMany({ where: { category } });

    const settingsObj: Record<string, any> = {};
    settings.forEach((setting) => {
      try { settingsObj[setting.key] = JSON.parse(setting.value); } catch { settingsObj[setting.key] = setting.value; }
    });

    const defaults = DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS] || {};
    const mergedSettings = { ...defaults, ...settingsObj };

    return res.json({ success: true, data: mergedSettings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

// Update settings by category
export const updateSettingsByCategory = async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    const settings = req.body;

    if (!['notifications', 'security', 'general', 'billing', 'cms', 'email-notifications'].includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid settings category' });
    }

    const upsertPromises = Object.entries(settings).map(([key, value]) =>
      prisma.systemSettings.upsert({
        where: { category_key: { category, key } },
        update: { value: JSON.stringify(value) },
        create: { category, key, value: JSON.stringify(value) },
      })
    );
    await Promise.all(upsertPromises);

    const updatedSettings = await prisma.systemSettings.findMany({ where: { category } });
    const settingsObj: Record<string, any> = {};
    updatedSettings.forEach((setting) => {
      try { settingsObj[setting.key] = JSON.parse(setting.value); } catch { settingsObj[setting.key] = setting.value; }
    });

    const defaults = DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS] || {};
    const mergedSettings = { ...defaults, ...settingsObj };

    return res.json({ success: true, data: mergedSettings, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

// Get all settings
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findMany();

    const groupedSettings: Record<string, Record<string, any>> = {
      notifications: { ...DEFAULT_SETTINGS.notifications },
      security: { ...DEFAULT_SETTINGS.security },
      general: { ...DEFAULT_SETTINGS.general },
      cms: { ...DEFAULT_SETTINGS.cms },
    };

    settings.forEach((setting) => {
      if (!groupedSettings[setting.category]) {
        groupedSettings[setting.category] = {};
      }
      try { groupedSettings[setting.category][setting.key] = JSON.parse(setting.value); }
      catch { groupedSettings[setting.category][setting.key] = setting.value; }
    });

    return res.json({ success: true, data: groupedSettings });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};
