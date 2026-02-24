import api from './api';

const workSessionService = {
  // Clock in - Start a new work session
  async clockIn(data = {}) {
    return await api.post('/work-sessions/clock-in', data);
  },

  // Clock out - End current work session
  async clockOut(notes = null) {
    return await api.post('/work-sessions/clock-out', { notes });
  },

  // Start break
  async startBreak() {
    const response = await api.post('/work-sessions/break/start');
    return response;
  },

  // End break
  async endBreak() {
    return await api.post('/work-sessions/break/end');
  },

  // Get current session status
  async getCurrentSession() {
    return await api.get('/work-sessions/current');
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
    return await api.get(url);
  },

  // Get today's summary
  async getTodaySummary() {
    return await api.get('/work-sessions/today-summary');
  },

  // Get weekly summary
  async getWeeklySummary() {
    return await api.get('/work-sessions/weekly-summary');
  },

  // Update session notes (auto-save)
  async updateNotes(notes) {
    return await api.patch('/work-sessions/notes', { notes });
  },

  // Add manual time entry
  async addManualEntry(data) {
    return await api.post('/work-sessions/manual-entry', data);
  },

  // Get session logs
  async getSessionLogs(sessionId) {
    return await api.get(`/work-sessions/${sessionId}/logs`);
  },

  // Respond to shift-end controlled pause
  async shiftEndResponse(action, reason = null) {
    return await api.post('/work-sessions/shift-end-response', { action, reason });
  },
};

export default workSessionService;
