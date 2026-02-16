import api from './api';

const invoiceService = {
  // Get all invoices with pagination and filters
  getInvoices: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.clientId) queryParams.append('clientId', params.clientId);
      if (params.status) queryParams.append('status', params.status);

      const response = await api.get(`/invoices?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch invoices' };
    }
  },

  // Get single invoice by ID
  getInvoice: async (invoiceId) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch invoice' };
    }
  },

  // Update invoice status
  updateInvoiceStatus: async (invoiceId, status, notes = '') => {
    try {
      const response = await api.put(`/invoices/${invoiceId}/status`, { status, notes });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to update invoice status' };
    }
  },

  // Trigger invoice generation for a specific period
  generateInvoices: async (year, month) => {
    try {
      const response = await api.post('/invoices/generate', { year, month });
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to generate invoices' };
    }
  },

  // Delete a DRAFT invoice
  deleteInvoice: async (invoiceId) => {
    try {
      const response = await api.delete(`/invoices/${invoiceId}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to delete invoice' };
    }
  },
};

export default invoiceService;
