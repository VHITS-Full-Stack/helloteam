import api from './api';

const rateHistoryService = {
  // Get all rate change history
  getRateHistory: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.employeeId) queryParams.append('employeeId', params.employeeId);
      if (params.clientId) queryParams.append('clientId', params.clientId);
      if (params.rateType) queryParams.append('rateType', params.rateType);
      if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
      if (params.dateTo) queryParams.append('dateTo', params.dateTo);
      if (params.search) queryParams.append('search', params.search);

      const response = await api.get(`/rate-history?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch rate history' };
    }
  },

  // Get rate change history for a specific employee
  getEmployeeRateHistory: async (employeeId, params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.rateType) queryParams.append('rateType', params.rateType);
      if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
      if (params.dateTo) queryParams.append('dateTo', params.dateTo);

      const response = await api.get(`/rate-history/${employeeId}?${queryParams.toString()}`);
      return response;
    } catch (error) {
      throw { error: error.message || 'Failed to fetch employee rate history' };
    }
  },
};

export default rateHistoryService;
