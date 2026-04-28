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

  getClientWiseUnapprovedOT: async () => {
    const response = await api.get('/admin-portal/dashboard/unapproved-ot');
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

  requestRevisionTimeRecord: async (recordId, reason) => {
    const response = await api.post(`/admin-portal/approvals/time-record/${recordId}/request-revision`, { reason });
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

  // Raise Request APIs
  getRaiseRequests: async (params = {}) => {
    const response = await api.get('/admin-portal/raise-requests', { params });
    return response;
  },

  approveRaiseRequest: async (raiseId, data = {}) => {
    // Use FormData so we can attach an optional proof file
    const formData = new FormData();
    if (data.approvalNote) formData.append('approvalNote', data.approvalNote);
    if (data.adminNotes) formData.append('adminNotes', data.adminNotes);
    if (data.newPayRate != null) formData.append('newPayRate', String(data.newPayRate));
    if (data.proofFile) formData.append('proofFile', data.proofFile);
    const response = await api.uploadFormData(`/admin-portal/raise-requests/${raiseId}/approve`, formData);
    return response;
  },

  rejectRaiseRequest: async (raiseId, adminNotes) => {
    const response = await api.post(`/admin-portal/raise-requests/${raiseId}/reject`, { adminNotes });
    return response;
  },

  getRaiseCandidates: async () => {
    const response = await api.get('/admin-portal/raise-candidates');
    return response;
  },

  giveRaise: async (data) => {
    const response = await api.post('/admin-portal/give-raise', data);
    return response;
  },

  giveBonus: async (data) => {
    const response = await api.post('/admin-portal/give-bonus', data);
    return response;
  },

  confirmAdminRaise: async (raiseId) => {
    const response = await api.post(`/admin-portal/raise-requests/${raiseId}/confirm`, {});
    return response;
  },

  confirmAdminBonus: async (bonusId) => {
    const response = await api.post(`/admin-portal/bonus-requests/${bonusId}/confirm`, {});
    return response;
  },

  editPayRate: async (employeeId, data) => {
    const response = await api.post(`/admin-portal/employees/${employeeId}/edit-pay-rate`, data);
    return response;
  },

  editBillingRate: async (employeeId, data) => {
    const response = await api.post(`/admin-portal/employees/${employeeId}/edit-billing-rate`, data);
    return response;
  },

  confirmDirectEdit: async (raiseId) => {
    const response = await api.post(`/admin-portal/raise-requests/${raiseId}/confirm-edit`, {});
    return response;
  },

  // Download timesheet PDF report (admin)
  downloadTimesheetPdf: async ({
    clientId,
    startDate,
    endDate,
    groupId,
    employeeIds,
    filename,
  }) => {
    try {
      const token = localStorage.getItem("token");
      const baseUrl =
        import.meta.env.VITE_API_URL || "https://office.thehelloteam.com/api";

      const params = new URLSearchParams();
      if (clientId) params.append("clientId", clientId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (groupId && groupId !== "all") params.append("groupId", groupId);
      if (employeeIds && employeeIds.length > 0)
        params.append("employeeIds", employeeIds.join(","));

      const response = await fetch(
        `${baseUrl}/admin-portal/timesheets/pdf?${params.toString()}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to download timesheet PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "timesheet-report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      throw { error: error.message || "Failed to download timesheet PDF" };
    }
  },

  // Analytics APIs
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

  getClientWiseUnapprovedOT: async () => {
    const response = await api.get('/admin-portal/dashboard/unapproved-ot');
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

  requestRevisionTimeRecord: async (recordId, reason) => {
    const response = await api.post(`/admin-portal/approvals/time-record/${recordId}/request-revision`, { reason });
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

  // Raise Request APIs
  getRaiseRequests: async (params = {}) => {
    const response = await api.get('/admin-portal/raise-requests', { params });
    return response;
  },

  approveRaiseRequest: async (raiseId, data = {}) => {
    // Use FormData so we can attach an optional proof file
    const formData = new FormData();
    if (data.approvalNote) formData.append('approvalNote', data.approvalNote);
    if (data.adminNotes) formData.append('adminNotes', data.adminNotes);
    if (data.newPayRate != null) formData.append('newPayRate', String(data.newPayRate));
    if (data.proofFile) formData.append('proofFile', data.proofFile);
    const response = await api.uploadFormData(`/admin-portal/raise-requests/${raiseId}/approve`, formData);
    return response;
  },

  rejectRaiseRequest: async (raiseId, adminNotes) => {
    const response = await api.post(`/admin-portal/raise-requests/${raiseId}/reject`, { adminNotes });
    return response;
  },

  getRaiseCandidates: async () => {
    const response = await api.get('/admin-portal/raise-candidates');
    return response;
  },

  giveRaise: async (data) => {
    const response = await api.post('/admin-portal/give-raise', data);
    return response;
  },

  giveBonus: async (data) => {
    const response = await api.post('/admin-portal/give-bonus', data);
    return response;
  },

  confirmAdminRaise: async (raiseId) => {
    const response = await api.post(`/admin-portal/raise-requests/${raiseId}/confirm`, {});
    return response;
  },

  confirmAdminBonus: async (bonusId) => {
    const response = await api.post(`/admin-portal/bonus-requests/${bonusId}/confirm`, {});
    return response;
  },

  editPayRate: async (employeeId, data) => {
    const response = await api.post(`/admin-portal/employees/${employeeId}/edit-pay-rate`, data);
    return response;
  },

  editBillingRate: async (employeeId, data) => {
    const response = await api.post(`/admin-portal/employees/${employeeId}/edit-billing-rate`, data);
    return response;
  },

  confirmDirectEdit: async (raiseId) => {
    const response = await api.post(`/admin-portal/raise-requests/${raiseId}/confirm-edit`, {});
    return response;
  },

  // Download timesheet PDF report (admin)
  downloadTimesheetPdf: async ({
    clientId,
    startDate,
    endDate,
    groupId,
    employeeIds,
    filename,
  }) => {
    try {
      const token = localStorage.getItem("token");
      const baseUrl =
        import.meta.env.VITE_API_URL || "https://office.thehelloteam.com/api";

      const params = new URLSearchParams();
      if (clientId) params.append("clientId", clientId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (groupId && groupId !== "all") params.append("groupId", groupId);
      if (employeeIds && employeeIds.length > 0)
        params.append("employeeIds", employeeIds.join(","));

      const response = await fetch(
        `${baseUrl}/admin-portal/timesheets/pdf?${params.toString()}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to download timesheet PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "timesheet-report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      throw { error: error.message || "Failed to download timesheet PDF" };
    }
  },

  // Analytics APIs
  getPunctualityAnalytics: async (params = {}) => {
    const response = await api.get('/admin-portal/analytics/punctuality', { params });
    return response;
  },

  getEmployeePunctualityDetails: async (employeeId, params = {}) => {
    const response = await api.get(`/admin-portal/analytics/punctuality/employee/${employeeId}`, { params });
    return response;
  },

  getRealTimeAttendanceMonitoring: async (params) => {
    return await api.get('/admin-portal/attendance/monitoring', { params });
  },

getAdminAnalytics: async () => {
    return await api.get('/admin-portal/analytics');
  },

  clockOutEmployee: async (employeeId, notes, reason) => {
    return await api.post(`/admin-portal/employees/${employeeId}/clock-out`, { notes, reason });
  },
};

export default adminPortalService;
