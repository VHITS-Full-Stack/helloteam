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
      if (params.month) queryParams.append('month', params.month);
      if (params.year) queryParams.append('year', params.year);

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
  // params: { year, month, frequency, week }
  generateInvoices: async (params = {}) => {
    try {
      const response = await api.post('/invoices/generate', params);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to generate invoices' };
    }
  },

  // Preview invoice generation (dry-run)
  previewInvoices: async (params = {}) => {
    try {
      const response = await api.post('/invoices/generate/preview', params);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to preview invoices' };
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

  // Download invoice as PDF
  downloadInvoicePdf: async (invoiceId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'https://office.thehelloteam.com/api';
      const response = await fetch(`${baseUrl}/invoices/${invoiceId}/pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw { error: error.message || 'Failed to download invoice PDF' };
    }
  },

  // Download timesheet PDF for an invoice
  downloadTimesheetPdf: async (invoiceId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'https://office.thehelloteam.com/api';
      const response = await fetch(`${baseUrl}/invoices/${invoiceId}/timesheet-pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download timesheet PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timesheet-${invoiceNumber || 'report'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw { error: error.message || 'Failed to download timesheet PDF' };
    }
  },
};

export default invoiceService;
