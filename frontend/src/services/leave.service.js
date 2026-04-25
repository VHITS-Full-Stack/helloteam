import api from './api';

const leaveService = {
  // Get leave options available to employee (based on client policy)
  async getLeaveOptions() {
    return await api.get('/leave/options');
  },

  // Get leave balance
  async getLeaveBalance() {
    return await api.get('/leave/balance');
  },

  // Submit a leave request
  async submitLeaveRequest(data) {
    const { documents, ...rest } = data;
    
    if (documents && documents.length > 0) {
      const url = `${api.baseUrl}/leave/request`;
      const token = api.getToken();
      const formData = new FormData();
      
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value);
          }
        }
      });
      
      documents.forEach(file => {
        formData.append('documents', file);
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      return await response.json();
    }
    
    return await api.post('/leave/request', data);
  },

  // Get leave request history
  async getLeaveHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.year) queryParams.append('year', params.year);

    const queryString = queryParams.toString();
    const url = queryString ? `/leave/history?${queryString}` : '/leave/history';
    return await api.get(url);
  },

  // Get single leave request details
  async getLeaveRequestDetails(requestId) {
    return await api.get(`/leave/request/${requestId}`);
  },

  // Cancel a leave request
  async cancelLeaveRequest(requestId, reason = '') {
    const result = await api.delete(`/leave/request/${requestId}`, { body: { reason } });
    return result;
  },
};

export default leaveService;
