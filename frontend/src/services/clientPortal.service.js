import api from './api';

const clientPortalService = {
  // Dashboard APIs
  getDashboardStats: async () => {
    const response = await api.get('/client-portal/dashboard/stats');
    return response.data;
  },

  getWeeklyHoursOverview: async () => {
    const response = await api.get('/client-portal/dashboard/weekly-hours');
    return response.data;
  },

  getPendingApprovals: async (limit = 10) => {
    const response = await api.get('/client-portal/dashboard/pending-approvals', {
      params: { limit },
    });
    return response.data;
  },

  // Workforce APIs
  getWorkforce: async (params = {}) => {
    const response = await api.get('/client-portal/workforce', { params });
    return response.data;
  },

  getActiveEmployees: async () => {
    const response = await api.get('/client-portal/workforce/active');
    return response.data;
  },

  // Approval APIs
  approveTimeRecord: async (recordId) => {
    const response = await api.post(`/client-portal/approvals/time-record/${recordId}/approve`);
    return response.data;
  },

  rejectTimeRecord: async (recordId, reason) => {
    const response = await api.post(`/client-portal/approvals/time-record/${recordId}/reject`, {
      reason,
    });
    return response.data;
  },
};

export default clientPortalService;
