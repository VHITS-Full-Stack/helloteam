import api from './api';

const workSessionService = {
  // Clock in - Start a new work session
  async clockIn() {
    const response = await api.post('/work-sessions/clock-in');
    return response.data;
  },

  // Clock out - End current work session
  async clockOut(notes = null) {
    const response = await api.post('/work-sessions/clock-out', { notes });
    return response.data;
  },

  // Start break
  async startBreak() {
    const response = await api.post('/work-sessions/break/start');
    return response.data;
  },

  // End break
  async endBreak() {
    const response = await api.post('/work-sessions/break/end');
    return response.data;
  },

  // Get current session status
  async getCurrentSession() {
    const response = await api.get('/work-sessions/current');
    return response.data;
  },

  // Get session history
  async getSessionHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = queryString ? `/work-sessions/history?${queryString}` : '/work-sessions/history';
    const response = await api.get(url);
    return response.data;
  },

  // Get today's summary
  async getTodaySummary() {
    const response = await api.get('/work-sessions/today-summary');
    return response.data;
  },

  // Get weekly summary
  async getWeeklySummary() {
    const response = await api.get('/work-sessions/weekly-summary');
    return response.data;
  },
};

export default workSessionService;
