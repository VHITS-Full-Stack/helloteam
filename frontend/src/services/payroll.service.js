import api from './api';

const payrollService = {
  // Get payroll readiness dashboard
  getDashboard: async (periodStart, periodEnd) => {
    const params = new URLSearchParams();
    if (periodStart) params.append('periodStart', periodStart);
    if (periodEnd) params.append('periodEnd', periodEnd);
    const response = await api.get(`/payroll/dashboard?${params.toString()}`);
    return response;
  },

  // Get payroll periods
  getPeriods: async (options = {}) => {
    const { status, limit = 10, offset = 0 } = options;
    const params = new URLSearchParams({ limit, offset });
    if (status) params.append('status', status);
    const response = await api.get(`/payroll?${params.toString()}`);
    return response;
  },

  // Get current payroll period
  getCurrentPeriod: async (clientId) => {
    const params = clientId ? `?clientId=${clientId}` : '';
    const response = await api.get(`/payroll/current${params}`);
    return response;
  },

  // Create payroll period
  createPeriod: async (data) => {
    const response = await api.post('/payroll', data);
    return response;
  },

  // Get employee payroll summary
  getEmployeeSummary: async (periodStart, periodEnd, clientId) => {
    const params = new URLSearchParams({ periodStart, periodEnd });
    if (clientId) params.append('clientId', clientId);
    const response = await api.get(`/payroll/employee-summary?${params.toString()}`);
    return response;
  },

  // Get unapproved time records
  getUnapprovedRecords: async (options = {}) => {
    const { clientId, periodStart, periodEnd, limit = 100, offset = 0 } = options;
    const params = new URLSearchParams({ limit, offset });
    if (clientId) params.append('clientId', clientId);
    if (periodStart) params.append('periodStart', periodStart);
    if (periodEnd) params.append('periodEnd', periodEnd);
    const response = await api.get(`/payroll/unapproved?${params.toString()}`);
    return response;
  },

  // Get disputed time records
  getDisputedRecords: async (options = {}) => {
    const { clientId, limit = 100, offset = 0 } = options;
    const params = new URLSearchParams({ limit, offset });
    if (clientId) params.append('clientId', clientId);
    const response = await api.get(`/payroll/disputed?${params.toString()}`);
    return response;
  },

  // Lock payroll period
  lockPeriod: async (id) => {
    const response = await api.put(`/payroll/${id}/lock`);
    return response;
  },

  // Unlock payroll period
  unlockPeriod: async (id, reason) => {
    const response = await api.put(`/payroll/${id}/unlock`, { reason });
    return response;
  },

  // Finalize payroll period
  finalizePeriod: async (id) => {
    const response = await api.put(`/payroll/${id}/finalize`);
    return response;
  },

  // Update payroll cutoff
  updateCutoff: async (id, cutoffDate, notes) => {
    const response = await api.put(`/payroll/${id}/cutoff`, { cutoffDate, notes });
    return response;
  },

  // Export payroll data
  exportData: async (periodStart, periodEnd, clientId, format = 'json') => {
    const params = new URLSearchParams({ periodStart, periodEnd, format });
    if (clientId) params.append('clientId', clientId);
    const response = await api.get(`/payroll/export?${params.toString()}`);
    return response;
  },

  // Download CSV export
  downloadCsv: async (periodStart, periodEnd, clientId) => {
    const params = new URLSearchParams({ periodStart, periodEnd, format: 'csv' });
    if (clientId) params.append('clientId', clientId);

    const token = localStorage.getItem('token');
    const response = await fetch(`${api.defaults.baseURL}/payroll/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download CSV');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${periodStart}-${periodEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Send payroll reminders
  sendReminders: async (daysBeforeCutoff = 3) => {
    const response = await api.post('/payroll/send-reminders', { daysBeforeCutoff });
    return response;
  },
};

export default payrollService;
