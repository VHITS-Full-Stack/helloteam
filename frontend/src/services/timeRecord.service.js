import api from './api';

const timeRecordService = {
  // Get my time records (paginated with filters)
  async getMyRecords(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/time-records/my-records?${queryString}` : '/time-records/my-records';
    return await api.get(url);
  },

  // Get time record summary for a period (week, month, year)
  async getMySummary(period = 'month') {
    return await api.get(`/time-records/my-summary?period=${period}`);
  },

  // Get payroll summary for a specific month
  async getMyPayroll(month = null, year = null) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);

    const queryString = params.toString();
    const url = queryString ? `/time-records/my-payroll?${queryString}` : '/time-records/my-payroll';
    return await api.get(url);
  },

  // Get single time record detail
  async getRecordDetail(recordId) {
    return await api.get(`/time-records/${recordId}`);
  },

  // Resubmit a time record after revision was requested
  async resubmitTimeRecord(recordId) {
    return await api.post(`/time-records/${recordId}/resubmit`);
  },
};

export default timeRecordService;
