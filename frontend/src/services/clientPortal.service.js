import api from './api';

const clientPortalService = {
  // Dashboard APIs
  getDashboardStats: async () => {
    const response = await api.get('/client-portal/dashboard/stats');
    return response;
  },

  getWeeklyHoursOverview: async () => {
    const response = await api.get('/client-portal/dashboard/weekly-hours');
    return response;
  },

  getPendingApprovals: async (limit = 10) => {
    const response = await api.get('/client-portal/dashboard/pending-approvals', {
      params: { limit },
    });
    return response;
  },

  // Workforce APIs
  getWorkforce: async (params = {}) => {
    const response = await api.get('/client-portal/workforce', { params });
    return response;
  },

  getActiveEmployees: async () => {
    const response = await api.get('/client-portal/workforce/active');
    return response;
  },

  // Time Records APIs
  getTimeRecords: async (params = {}) => {
    const response = await api.get('/client-portal/time-records', { params });
    return response;
  },

  // Approvals APIs
  getApprovals: async (params = {}) => {
    const response = await api.get('/client-portal/approvals', { params });
    return response;
  },

  approveTimeRecord: async (recordId) => {
    const response = await api.post(`/client-portal/approvals/time-record/${recordId}/approve`);
    return response;
  },

  rejectTimeRecord: async (recordId, reason) => {
    const response = await api.post(`/client-portal/approvals/time-record/${recordId}/reject`, {
      reason,
    });
    return response;
  },

  bulkApproveTimeRecords: async (recordIds) => {
    const response = await api.post('/client-portal/approvals/bulk-approve', { recordIds });
    return response;
  },

  bulkRejectTimeRecords: async (recordIds, reason) => {
    const response = await api.post('/client-portal/approvals/bulk-reject', { recordIds, reason });
    return response;
  },

  approveLeaveRequest: async (requestId) => {
    const response = await api.post(`/client-portal/approvals/leave/${requestId}/approve`);
    return response;
  },

  rejectLeaveRequest: async (requestId, reason) => {
    const response = await api.post(`/client-portal/approvals/leave/${requestId}/reject`, {
      reason,
    });
    return response;
  },

  // Analytics APIs
  getAnalytics: async (params = {}) => {
    const response = await api.get('/client-portal/analytics', { params });
    return response;
  },

  // Billing APIs
  getBilling: async () => {
    const response = await api.get('/client-portal/billing');
    return response;
  },

  // Settings APIs
  getSettings: async () => {
    const response = await api.get('/client-portal/settings');
    return response;
  },

  updateSettings: async (settingsData) => {
    const response = await api.put('/client-portal/settings', settingsData);
    return response;
  },
};

export default clientPortalService;
