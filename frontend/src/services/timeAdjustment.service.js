import api from './api';

const timeAdjustmentService = {
  // Get time records for adjustment with filters
  async getTimeRecords(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.clientId) queryParams.append('clientId', params.clientId);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params.status) queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.hasAdjustments !== undefined) queryParams.append('hasAdjustments', params.hasAdjustments);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/time-adjustments/time-records?${queryString}` : '/time-adjustments/time-records';
    return await api.get(url);
  },

  // Get single time record details
  async getTimeRecordDetails(recordId) {
    return await api.get(`/time-adjustments/time-records/${recordId}`);
  },

  // Create time adjustment
  async createAdjustment(recordId, data) {
    return await api.post(`/time-adjustments/time-records/${recordId}/adjust`, data);
  },

  // Get adjustment history for a time record
  async getAdjustmentHistory(recordId) {
    return await api.get(`/time-adjustments/time-records/${recordId}/adjustments`);
  },

  // Get audit logs with filters
  async getAuditLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.action) queryParams.append('action', params.action);
    if (params.entityType) queryParams.append('entityType', params.entityType);
    if (params.entityId) queryParams.append('entityId', params.entityId);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/time-adjustments/audit-logs?${queryString}` : '/time-adjustments/audit-logs';
    return await api.get(url);
  },

  // Get audit log stats
  async getAuditLogStats() {
    return await api.get('/time-adjustments/audit-logs/stats');
  },

  // Get pending re-approvals
  async getPendingReapprovals(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.clientId) queryParams.append('clientId', params.clientId);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/time-adjustments/pending-reapprovals?${queryString}` : '/time-adjustments/pending-reapprovals';
    return await api.get(url);
  },
};

export default timeAdjustmentService;
