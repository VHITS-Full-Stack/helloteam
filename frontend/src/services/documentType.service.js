import api from './api';

const documentTypeService = {
  // Get all document types (optionally filter by category and active status)
  getAll: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.category) queryParams.append('category', params.category);
      if (params.active !== undefined) queryParams.append('active', params.active);

      const response = await api.get(`/document-types?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch document types' };
    }
  },

  // Create a new document type
  create: async (data) => {
    try {
      const response = await api.post('/document-types', data);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to create document type' };
    }
  },

  // Update a document type
  update: async (id, data) => {
    try {
      const response = await api.put(`/document-types/${id}`, data);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to update document type' };
    }
  },

  // Delete a document type
  delete: async (id) => {
    try {
      const response = await api.delete(`/document-types/${id}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to delete document type' };
    }
  },
};

export default documentTypeService;
