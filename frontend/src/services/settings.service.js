import api from './api';

const settingsService = {
  // Get all settings
  getAllSettings: async () => {
    const response = await api.get('/settings');
    return response;
  },

  // Get settings by category
  getSettingsByCategory: async (category) => {
    const response = await api.get(`/settings/${category}`);
    return response;
  },

  // Update settings by category
  updateSettingsByCategory: async (category, settings) => {
    const response = await api.put(`/settings/${category}`, settings);
    return response;
  },

  // Get notification settings
  getNotificationSettings: async () => {
    return settingsService.getSettingsByCategory('notifications');
  },

  // Update notification settings
  updateNotificationSettings: async (settings) => {
    return settingsService.updateSettingsByCategory('notifications', settings);
  },

  // Get security settings
  getSecuritySettings: async () => {
    return settingsService.getSettingsByCategory('security');
  },

  // Update security settings
  updateSecuritySettings: async (settings) => {
    return settingsService.updateSettingsByCategory('security', settings);
  },

  // Get general settings
  getGeneralSettings: async () => {
    return settingsService.getSettingsByCategory('general');
  },

  // Update general settings
  updateGeneralSettings: async (settings) => {
    return settingsService.updateSettingsByCategory('general', settings);
  },

  // Get CMS settings
  getCmsSettings: async () => {
    return settingsService.getSettingsByCategory('cms');
  },

  // Update CMS settings
  updateCmsSettings: async (settings) => {
    return settingsService.updateSettingsByCategory('cms', settings);
  },

  // Download new hire guide PDF as blob (for iframe display, avoids CORS/localhost URL issues)
  downloadNewHireGuidePdf: async () => {
    const token = api.getToken();
    const response = await fetch(`${api.baseUrl}/settings/cms/new-hire-guide-pdf`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error('Failed to fetch PDF');
    return response.blob();
  },

  // Upload new hire guide PDF
  uploadNewHireGuidePdf: async (file) => {
    return api.uploadFile('/settings/cms/new-hire-guide-pdf', file, 'pdf');
  },

  // Delete new hire guide PDF
  deleteNewHireGuidePdf: async () => {
    return api.delete('/settings/cms/new-hire-guide-pdf');
  },

  // Download welcome tips PDF as blob
  downloadWelcomeTipsPdf: async () => {
    const token = api.getToken();
    const response = await fetch(`${api.baseUrl}/settings/cms/welcome-tips-pdf`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error('Failed to fetch PDF');
    return response.blob();
  },

  // Upload welcome tips PDF
  uploadWelcomeTipsPdf: async (file) => {
    return api.uploadFile('/settings/cms/welcome-tips-pdf', file, 'pdf');
  },

  // Delete welcome tips PDF
  deleteWelcomeTipsPdf: async () => {
    return api.delete('/settings/cms/welcome-tips-pdf');
  },
};

export default settingsService;
