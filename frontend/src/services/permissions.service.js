import api from './api';

const permissionsService = {
  // Get current user's permissions
  getMyPermissions: async () => {
    try {
      const response = await api.get('/permissions/me');
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch permissions' };
    }
  },

  // Get all permission constants
  getPermissionConstants: async () => {
    try {
      const response = await api.get('/permissions/constants');
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch permission constants' };
    }
  },

  // Get permissions grouped by category
  getPermissionCategories: async () => {
    try {
      const response = await api.get('/permissions/categories');
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch permission categories' };
    }
  },

  // Get role-permission matrix (admin only)
  getPermissionMatrix: async () => {
    try {
      const response = await api.get('/permissions/matrix');
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch permission matrix' };
    }
  },

  // Check if user has a specific permission
  checkPermission: async (permission) => {
    try {
      const response = await api.get(`/permissions/check/${permission}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to check permission' };
    }
  },
};

export default permissionsService;
