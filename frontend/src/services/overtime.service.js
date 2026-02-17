import api from './api';

const overtimeService = {
  // Get overtime requests
  async getOvertimeRequests(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const queryString = queryParams.toString();
    const url = queryString ? `/overtime-requests?${queryString}` : '/overtime-requests';
    return await api.get(url);
  },

  // Get overtime summary (for clients)
  async getOvertimeSummary(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);

    const queryString = queryParams.toString();
    const url = queryString ? `/overtime-requests/summary?${queryString}` : '/overtime-requests/summary';
    return await api.get(url);
  },

  // Create overtime request
  async createOvertimeRequest(data) {
    // Convert requestedHours to requestedMinutes for the API
    const payload = {
      date: data.date,
      reason: data.reason,
      requestedMinutes: Math.round((data.requestedHours || 0) * 60),
    };
    if (data.employeeId) payload.employeeId = data.employeeId;
    if (data.clientId) payload.clientId = data.clientId;
    if (data.estimatedEndTime) payload.estimatedEndTime = data.estimatedEndTime;

    return await api.post('/overtime-requests', payload);
  },

  // Approve overtime request
  async approveOvertimeRequest(id) {
    return await api.put(`/overtime-requests/${id}/approve`);
  },

  // Reject overtime request
  async rejectOvertimeRequest(id, reason) {
    return await api.put(`/overtime-requests/${id}/reject`, { reason });
  },
};

export default overtimeService;
