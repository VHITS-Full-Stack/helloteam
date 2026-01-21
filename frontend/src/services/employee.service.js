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
