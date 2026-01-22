import api from './api';

const scheduleService = {
  // Get my weekly schedule
  async getMySchedule(weekStart = null) {
    const params = weekStart ? `?weekStart=${weekStart}` : '';
    return await api.get(`/schedules/my-schedule${params}`);
  },

  // Get today's schedule
  async getTodaySchedule() {
    return await api.get('/schedules/today');
  },

  // Admin: Get employee schedule
  async getEmployeeSchedule(employeeId) {
    return await api.get(`/schedules/employee/${employeeId}`);
  },

  // Admin: Create or update single schedule entry
  async upsertSchedule(employeeId, scheduleData) {
    return await api.post(`/schedules/employee/${employeeId}`, scheduleData);
  },

  // Admin: Bulk update schedule (full week)
  async bulkUpdateSchedule(employeeId, schedules, effectiveFrom = null) {
    return await api.put(`/schedules/employee/${employeeId}/bulk`, {
      schedules,
      effectiveFrom,
    });
  },

  // Admin: Delete a schedule
  async deleteSchedule(scheduleId) {
    return await api.delete(`/schedules/${scheduleId}`);
  },
};

export default scheduleService;
