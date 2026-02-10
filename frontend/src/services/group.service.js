import api from './api';

const groupService = {
  // Get all groups with pagination and filters
  getGroups: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);

      const response = await api.get(`/groups?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch groups' };
    }
  },

  // Get single group by ID
  getGroup: async (id) => {
    try {
      const response = await api.get(`/groups/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch group' };
    }
  },

  // Create new group
  createGroup: async (groupData) => {
    try {
      const response = await api.post('/groups', groupData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to create group' };
    }
  },

  // Update group
  updateGroup: async (id, groupData) => {
    try {
      const response = await api.put(`/groups/${id}`, groupData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to update group' };
    }
  },

  // Delete group
  deleteGroup: async (id) => {
    try {
      const response = await api.delete(`/groups/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to delete group' };
    }
  },

  // Add employees to group
  addEmployees: async (groupId, employeeIds) => {
    try {
      const response = await api.post(`/groups/${groupId}/employees`, { employeeIds });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to add employees to group' };
    }
  },

  // Remove employee from group
  removeEmployee: async (groupId, employeeId) => {
    try {
      const response = await api.delete(`/groups/${groupId}/employees/${employeeId}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to remove employee from group' };
    }
  },

  // Assign group to client
  assignToClient: async (groupId, clientId) => {
    try {
      const response = await api.post(`/groups/${groupId}/clients`, { clientId });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to assign group to client' };
    }
  },

  // Unassign group from client
  unassignFromClient: async (groupId, clientId) => {
    try {
      const response = await api.delete(`/groups/${groupId}/clients/${clientId}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to unassign group from client' };
    }
  },

  // Get clients assigned to a group
  getGroupClients: async (groupId) => {
    try {
      const response = await api.get(`/groups/${groupId}/clients`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch group clients' };
    }
  },
};

export default groupService;
