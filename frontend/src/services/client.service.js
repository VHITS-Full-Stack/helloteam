import api from './api';

const clientService = {
  // Get all clients with pagination and filters
  getClients: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);

      const response = await api.get(`/clients?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch clients' };
    }
  },

  // Get single client by ID
  getClient: async (id) => {
    try {
      const response = await api.get(`/clients/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch client' };
    }
  },

  // Create new client
  createClient: async (clientData) => {
    try {
      const response = await api.post('/clients', clientData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to create client' };
    }
  },

  // Update client
  updateClient: async (id, clientData) => {
    try {
      const response = await api.put(`/clients/${id}`, clientData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to update client' };
    }
  },

  // Delete client
  deleteClient: async (id) => {
    try {
      const response = await api.delete(`/clients/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to delete client' };
    }
  },

  // Get client's employees
  getClientEmployees: async (clientId) => {
    try {
      const response = await api.get(`/clients/${clientId}/employees`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch client employees' };
    }
  },

  // Assign employees to client
  assignEmployees: async (clientId, employeeIds) => {
    try {
      const response = await api.post(`/clients/${clientId}/employees`, { employeeIds });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to assign employees' };
    }
  },

  // Remove employee from client
  removeEmployee: async (clientId, employeeId) => {
    try {
      const response = await api.delete(`/clients/${clientId}/employees/${employeeId}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to remove employee' };
    }
  },

  // Get client statistics
  getStats: async () => {
    try {
      const response = await api.get('/clients/stats');
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch client statistics' };
    }
  },

  // Get employee rate for a client
  getEmployeeRate: async (clientId, employeeId) => {
    try {
      const response = await api.get(`/clients/${clientId}/employees/${employeeId}/rate`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch employee rate' };
    }
  },

  // Update employee rate for a client
  updateEmployeeRate: async (clientId, employeeId, rateData) => {
    try {
      const response = await api.put(`/clients/${clientId}/employees/${employeeId}/rate`, rateData);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to update employee rate' };
    }
  },

  // Download agreement PDF for a client
  downloadAgreementPdf: async (clientId) => {
    const url = `${api.baseUrl}/clients/${clientId}/agreement/pdf`;
    const token = api.getToken();

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download agreement PDF');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;

    // Extract filename from Content-Disposition header or use default
    const disposition = response.headers.get('Content-Disposition');
    const match = disposition && disposition.match(/filename="?(.+?)"?$/);
    a.download = match ? match[1] : 'Service_Agreement.pdf';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },
};

export default clientService;
