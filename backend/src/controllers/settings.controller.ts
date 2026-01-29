import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    companyName: 'Hello Team',
    defaultTimezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    workWeekStart: 'Sunday',
    overtimeThreshold: 40,
    payrollPeriod: 'Bi-weekly',
  },
};

// Get settings by category
export const getSettingsByCategory = async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;

    if (!['notifications', 'security', 'general', 'billing'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings category',
      });
    }

    // Get all settings for this category
    const settings = await prisma.systemSettings.findMany({
      where: { category },
    });

    // Convert to key-value object
    const settingsObj: Record<string, any> = {};
    settings.forEach((setting) => {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch {
        settingsObj[setting.key] = setting.value;
      }
    });

    // Merge with defaults (so we always have all keys)
    const defaults = DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS] || {};
    const mergedSettings = { ...defaults, ...settingsObj };

    return res.json({
      success: true,
      data: mergedSettings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
    });
  }
};

// Update settings by category
export const updateSettingsByCategory = async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    const settings = req.body;

    if (!['notifications', 'security', 'general', 'billing'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings category',
      });
    }

    // Upsert each setting
    const upsertPromises = Object.entries(settings).map(([key, value]) =>
      prisma.systemSettings.upsert({
        where: {
          category_key: { category, key },
        },
        update: {
          value: JSON.stringify(value),
        },
        create: {
          category,
          key,
          value: JSON.stringify(value),
        },
      })
    );

    await Promise.all(upsertPromises);

    // Fetch updated settings
    const updatedSettings = await prisma.systemSettings.findMany({
      where: { category },
    });

    const settingsObj: Record<string, any> = {};
    updatedSettings.forEach((setting) => {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch {
        settingsObj[setting.key] = setting.value;
      }
    });

    const defaults = DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS] || {};
    const mergedSettings = { ...defaults, ...settingsObj };

    return res.json({
      success: true,
      data: mergedSettings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
};

// Get all settings
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findMany();

    // Group by category
    const groupedSettings: Record<string, Record<string, any>> = {
      notifications: { ...DEFAULT_SETTINGS.notifications },
      security: { ...DEFAULT_SETTINGS.security },
      general: { ...DEFAULT_SETTINGS.general },
    };

    settings.forEach((setting) => {
      if (!groupedSettings[setting.category]) {
        groupedSettings[setting.category] = {};
      }
      try {
        groupedSettings[setting.category][setting.key] = JSON.parse(setting.value);
      } catch {
        groupedSettings[setting.category][setting.key] = setting.value;
      }
    });

    return res.json({
      success: true,
      data: groupedSettings,
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
    });
  }
};
