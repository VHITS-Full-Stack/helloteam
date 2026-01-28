import api from './api';

const usersService = {
  // Get all admin users with pagination and filters
  async getAdminUsers(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.role) queryParams.append('role', params.role);

    const queryString = queryParams.toString();
    const url = queryString ? `/users/admins?${queryString}` : '/users/admins';
    const response = await api.get(url);
    return response;
  },

  // Get a single admin user by ID
  async getAdminUser(id) {
    const response = await api.get(`/users/admins/${id}`);
    return response;
  },

  // Create a new admin user
  async createAdminUser(userData) {
    const response = await api.post('/users/admins', userData);
    return response;
  },

  // Update an admin user
  async updateAdminUser(id, userData) {
    const response = await api.put(`/users/admins/${id}`, userData);
    return response;
  },

  // Delete an admin user (soft delete)
  async deleteAdminUser(id) {
    const response = await api.delete(`/users/admins/${id}`);
    return response;
  },

  // Get admin user statistics
  async getAdminUserStats() {
    const response = await api.get('/users/admins/stats');
    return response;
  },

  // Get available admin roles for dropdown
  async getAdminRoles() {
    const response = await api.get('/users/admin-roles');
    return response;
  },
};

export default usersService;
