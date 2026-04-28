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

  // End Lunch Break
  async endBreak() {
    return await api.post('/work-sessions/break/end');
  },

  // Resolve unauthorized lunch break (EXTENDED path — JSON body)
  async resolveUnauthorizedLunch(data) {
    return await api.post('/work-sessions/break/resolve-unauthorized', data);
  },

  // Resolve unauthorized lunch with "I was working" screenshot (WAS_WORKING path — multipart)
  // resumeTime is HH:MM string, only present on the upgraded path (>30 min past scheduled end)
  async submitWasWorkingBreak(screenshotFile, explanation, resumeTime) {
    const formData = new FormData();
    formData.append('resolution', 'WAS_WORKING');
    formData.append('screenshot', screenshotFile);
    formData.append('explanation', explanation);
    if (resumeTime) formData.append('resumeTime', resumeTime);
    return await api.post('/work-sessions/break/resolve-unauthorized', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Send lunch break reminder email to the employee (fired by frontend at 28-min warning)
  async sendLunchBreakReminder() {
    return await api.post('/work-sessions/break/lunch-reminder');
  },

  // Get remaining "I was working" auto-approvals (rolling 90-day window)
  async getLunchBypassCount() {
    return await api.get('/work-sessions/break/lunch-bypass-count');
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

  // Get manual time entries
  async getManualEntries(params = {}) {
    return await api.get('/work-sessions/manual-entries', { params });
  },

  // Get session logs
  async getSessionLogs(sessionId) {
    return await api.get(`/work-sessions/${sessionId}/logs`);
  },

  // Respond to shift-end controlled pause
  async shiftEndResponse(action, reason = null) {
    return await api.post('/work-sessions/shift-end-response', { action, reason });
  },

  // Approve manual time entry (admin)
  async approveManualEntry(id) {
    return await api.patch(`/work-sessions/manual-entry/${id}/approve`);
  },

  // Reject manual time entry (admin)
  async rejectManualEntry(id, reason) {
    return await api.patch(`/work-sessions/manual-entry/${id}/reject`, { reason });
  },
};

export default workSessionService;
