import api from './api';

const employeeService = {
  // Get all employees with pagination and filters
  getEmployees: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);
      if (params.clientId) queryParams.append('clientId', params.clientId);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);

      const response = await api.get(`/employees?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch employees' };
    }
  },

  // Get single employee by ID
  getEmployee: async (id) => {
    try {
      const response = await api.get(`/employees/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch employee' };
    }
  },

  // Create new employee
  createEmployee: async (employeeData) => {
    try {
      const response = await api.post('/employees', employeeData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to create employee' };
    }
  },

  // Update employee
  updateEmployee: async (id, employeeData) => {
    try {
      const response = await api.put(`/employees/${id}`, employeeData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to update employee' };
    }
  },

  // Terminate employee
  terminateEmployee: async (id, terminationDate) => {
    try {
      const response = await api.post(`/employees/${id}/terminate`, { terminationDate });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to terminate employee' };
    }
  },

  // Reactivate terminated employee
  reactivateEmployee: async (id) => {
    try {
      const response = await api.post(`/employees/${id}/reactivate`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to reactivate employee' };
    }
  },

  // Approve employee KYC
  approveKyc: async (id) => {
    try {
      const response = await api.post(`/employees/${id}/kyc/approve`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to approve KYC' };
    }
  },

  // Reject employee KYC
  rejectKyc: async (id, reason) => {
    try {
      const response = await api.post(`/employees/${id}/kyc/reject`, { reason });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to reject KYC' };
    }
  },

  // Review a single KYC document (approve or reject)
  reviewDocument: async (employeeId, document, action, reason, sendEmail = true) => {
    try {
      const response = await api.post(`/employees/${employeeId}/kyc/review`, { document, action, reason, sendEmail });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to review document' };
    }
  },

  // Finalize KYC review - sends email based on overall status
  finalizeKycReview: async (id) => {
    try {
      const response = await api.post(`/employees/${id}/kyc/finalize`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to finalize KYC review' };
    }
  },

  // Resend onboarding email
  resendOnboardingEmail: async (id) => {
    try {
      const response = await api.post(`/employees/${id}/resend-onboarding`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to send onboarding email' };
    }
  },

  // Delete employee
  deleteEmployee: async (id) => {
    try {
      const response = await api.delete(`/employees/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to delete employee' };
    }
  },

  // Assign employee to client
  assignToClient: async (employeeId, clientId) => {
    try {
      const response = await api.post(`/employees/${employeeId}/assign`, { clientId });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to assign employee to client' };
    }
  },

  // Remove employee from client
  removeFromClient: async (employeeId, clientId) => {
    try {
      const response = await api.post(`/employees/${employeeId}/unassign`, { clientId });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to remove employee from client' };
    }
  },

  // Get employee statistics
  getStats: async () => {
    try {
      const response = await api.get('/employees/stats');
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch employee statistics' };
    }
  },
};

export default employeeService;
