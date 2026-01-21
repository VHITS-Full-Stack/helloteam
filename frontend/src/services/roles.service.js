import api from './api';

const rolesService = {
  // Get all roles
  async getRoles() {
    const response = await api.get('/roles');
    return response.data;
  },

  // Get a single role by ID
  async getRole(id) {
    const response = await api.get(`/roles/${id}`);
    return response.data;
  },

  // Create a new role
  async createRole(roleData) {
    const response = await api.post('/roles', roleData);
    return response.data;
  },

  // Update a role
  async updateRole(id, roleData) {
    const response = await api.put(`/roles/${id}`, roleData);
    return response.data;
  },

  // Delete a role
  async deleteRole(id) {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  },

  // Get all available permissions
  async getAvailablePermissions() {
    const response = await api.get('/roles/available-permissions');
    return response.data;
  },

  // Get current user's permissions
  async getMyPermissions() {
    const response = await api.get('/roles/my-permissions');
    return response.data;
  },

  // Assign role to user
  async assignRoleToUser(userId, roleId) {
    const response = await api.post('/roles/assign', { userId, roleId });
    return response.data;
  },
};

export default rolesService;
