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

  getPendingOvertimeSummary: async () => {
    const response = await api.get('/client-portal/dashboard/pending-overtime');
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

  requestRevisionTimeRecord: async (recordId, reason) => {
    const response = await api.post(`/client-portal/approvals/time-record/${recordId}/request-revision`, { reason });
    return response;
  },

  bulkRequestRevision: async (recordIds, reason) => {
    const response = await api.post('/client-portal/approvals/bulk-request-revision', { recordIds, reason });
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

  // Add/update payment method
  addPaymentMethod: async (data) => {
    const response = await api.post('/client-portal/payment-method', data);
    return response;
  },

  // Download invoice PDF
  downloadInvoicePdf: async (invoiceId, invoiceNumber) => {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || 'https://office.thehelloteam.com/api';
    const response = await fetch(`${baseUrl}/client-portal/invoices/${invoiceId}/pdf`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to download PDF');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber || 'invoice'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Mark invoice as paid (client side)
  markInvoicePaid: async (invoiceId) => {
    const response = await api.post(`/client-portal/invoices/${invoiceId}/mark-paid`);
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

  // Groups APIs
  getMyGroups: async () => {
    const response = await api.get('/client-portal/groups');
    return response;
  },

  createGroup: async (groupData) => {
    const response = await api.post('/client-portal/groups', groupData);
    return response;
  },

  updateGroup: async (groupId, groupData) => {
    const response = await api.put(`/client-portal/groups/${groupId}`, groupData);
    return response;
  },

  deleteGroup: async (groupId) => {
    const response = await api.delete(`/client-portal/groups/${groupId}`);
    return response;
  },

  addEmployeesToGroup: async (groupId, employeeIds) => {
    const response = await api.post(`/client-portal/groups/${groupId}/employees`, { employeeIds });
    return response;
  },

  removeEmployeeFromGroup: async (groupId, employeeId) => {
    const response = await api.delete(`/client-portal/groups/${groupId}/employees/${employeeId}`);
    return response;
  },

  getMyEmployees: async () => {
    const response = await api.get('/client-portal/employees');
    return response;
  },

  // Overtime creation API
  createOvertime: async (data) => {
    const payload = {
      employeeId: data.employeeId,
      date: data.date,
      reason: data.notes || 'Pre-approved overtime scheduled by client',
      type: data.type || 'SHIFT_EXTENSION',
    };
    if (data.type === 'OFF_SHIFT') {
      payload.requestedStartTime = data.startTime;
      payload.requestedEndTime = data.endTime;
    } else {
      const [startH, startM] = (data.startTime || '').split(':').map(Number);
      const [endH, endM] = (data.endTime || '').split(':').map(Number);
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff <= 0) diff += 24 * 60;
      payload.requestedMinutes = Math.round(diff);
      payload.estimatedEndTime = data.endTime;
    }
    const response = await api.post('/overtime-requests', payload);
    return response;
  },

  // Overtime approval APIs
  approveOvertime: async (overtimeId) => {
    const response = await api.put(`/overtime-requests/${overtimeId}/approve`);
    return response;
  },

  rejectOvertime: async (overtimeId, reason) => {
    const response = await api.put(`/overtime-requests/${overtimeId}/reject`, { reason });
    return response;
  },

  // Bonuses & Raises APIs
  getEmployeesWithRates: async () => {
    const response = await api.get('/client-portal/employees/with-rates');
    return response;
  },

  sendBonus: async (data) => {
    const response = await api.post('/client-portal/bonuses', data);
    return response;
  },

  submitRaiseRequest: async (data) => {
    const response = await api.post('/client-portal/raises', data);
    return response;
  },

  getRateHistory: async () => {
    const response = await api.get('/client-portal/rate-history');
    return response;
  },
};

export default clientPortalService;
