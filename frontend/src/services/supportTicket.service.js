import api from './api';

const supportTicketService = {
  getTickets: async (params = {}) => {
    return await api.get('/support-tickets', { params });
  },

  getTicket: async (id) => {
    return await api.get(`/support-tickets/${id}`);
  },

  createTicket: async (data) => {
    return await api.post('/support-tickets', data);
  },

  addMessage: async (ticketId, data) => {
    return await api.post(`/support-tickets/${ticketId}/messages`, data);
  },

  updateTicket: async (id, data) => {
    return await api.put(`/support-tickets/${id}`, data);
  },

  getPendingCount: async () => {
    return await api.get('/support-tickets', { params: { status: 'PENDING', limit: 1 } });
  },
};

export default supportTicketService;
