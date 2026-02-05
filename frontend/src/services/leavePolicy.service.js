import api from './api';

const leavePolicyService = {
  // ============================================
  // POLICY CONFIGURATION
  // ============================================

  // Get all clients with their leave policies
  async getClientsWithPolicies(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/leave-policy/clients?${queryString}` : '/leave-policy/clients';
    return await api.get(url);
  },

  // Get single client policy
  async getClientPolicy(clientId) {
    return await api.get(`/leave-policy/clients/${clientId}`);
  },

  // Update client policy
  async updateClientPolicy(clientId, data) {
    return await api.put(`/leave-policy/clients/${clientId}`, data);
  },

  // ============================================
  // BALANCE MANAGEMENT
  // ============================================

  // Get employees with leave balances
  async getEmployeeBalances(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.clientId) queryParams.append('clientId', params.clientId);
    if (params.search) queryParams.append('search', params.search);
    if (params.year) queryParams.append('year', params.year);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/leave-policy/balances?${queryString}` : '/leave-policy/balances';
    return await api.get(url);
  },

  // Get single employee balance details
  async getEmployeeBalanceDetails(employeeId, clientId, year) {
    return await api.get(`/leave-policy/balances/${employeeId}?clientId=${clientId}&year=${year}`);
  },

  // Adjust employee balance
  async adjustEmployeeBalance(employeeId, data) {
    return await api.post(`/leave-policy/balances/${employeeId}/adjust`, data);
  },

  // Get adjustment history
  async getAdjustmentHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.clientId) queryParams.append('clientId', params.clientId);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params.year) queryParams.append('year', params.year);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/leave-policy/adjustments?${queryString}` : '/leave-policy/adjustments';
    return await api.get(url);
  },

  // ============================================
  // ACCRUAL
  // ============================================

  // Run accrual calculation
  async runAccrualCalculation() {
    return await api.post('/leave-policy/accrual/run');
  },

  // ============================================
  // LEAVE APPROVAL QUEUE
  // ============================================

  // Get all pending leave requests
  async getAllLeaveRequests(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.clientId) queryParams.append('clientId', params.clientId);
    if (params.search) queryParams.append('search', params.search);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/leave-policy/requests?${queryString}` : '/leave-policy/requests';
    return await api.get(url);
  },

  // Approve leave request
  async approveLeaveRequest(requestId) {
    return await api.post(`/leave-policy/requests/${requestId}/approve`);
  },

  // Reject leave request
  async rejectLeaveRequest(requestId, reason) {
    return await api.post(`/leave-policy/requests/${requestId}/reject`, { reason });
  },

  // Bulk approve leave requests
  async bulkApproveLeaveRequests(requestIds) {
    return await api.post('/leave-policy/requests/bulk-approve', { requestIds });
  },
};

export default leavePolicyService;
