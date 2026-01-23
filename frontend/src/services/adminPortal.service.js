import api from './api';

const adminPortalService = {
  // Dashboard APIs
  getDashboardStats: async () => {
    const response = await api.get('/admin-portal/dashboard/stats');
    return response;
  },

  getRecentActivity: async (limit = 10) => {
    const response = await api.get('/admin-portal/dashboard/activity', {
      params: { limit },
    });
    return response;
  },

  getPendingActions: async () => {
    const response = await api.get('/admin-portal/dashboard/pending-actions');
    return response;
  },

  getClientOverview: async () => {
    const response = await api.get('/admin-portal/dashboard/client-overview');
    return response;
  },

  getPayrollReadiness: async () => {
    const response = await api.get('/admin-portal/dashboard/payroll-readiness');
    return response;
  },

  // Time Records APIs
  getTimeRecords: async (params = {}) => {
    const response = await api.get('/admin-portal/time-records', { params });
    return response;
  },

  adjustTimeRecord: async (recordId, data) => {
    const response = await api.put(`/admin-portal/time-records/${recordId}/adjust`, data);
    return response;
  },

  // Approvals APIs
  getApprovals: async (params = {}) => {
    const response = await api.get('/admin-portal/approvals', { params });
    return response;
  },

  approveTimeRecord: async (recordId) => {
    const response = await api.post(`/admin-portal/approvals/time-record/${recordId}/approve`);
    return response;
  },

  rejectTimeRecord: async (recordId, reason) => {
    const response = await api.post(`/admin-portal/approvals/time-record/${recordId}/reject`, {
      reason,
    });
    return response;
  },

  bulkApproveTimeRecords: async (recordIds) => {
    const response = await api.post('/admin-portal/approvals/bulk-approve', { recordIds });
    return response;
  },

  approveLeaveRequest: async (requestId) => {
    const response = await api.post(`/admin-portal/approvals/leave/${requestId}/approve`);
    return response;
  },

  rejectLeaveRequest: async (requestId, reason) => {
    const response = await api.post(`/admin-portal/approvals/leave/${requestId}/reject`, {
      reason,
    });
    return response;
  },
};

export default adminPortalService;
