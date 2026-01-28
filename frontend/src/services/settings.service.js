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
};

export default settingsService;
