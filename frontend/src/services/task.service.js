import api from './api';

const taskService = {
  getTasks: async (params = {}) => {
    const response = await api.get('/tasks', { params });
    return response;
  },

  getTask: async (id) => {
    const response = await api.get(`/tasks/${id}`);
    return response;
  },

  createTask: async (data) => {
    const response = await api.post('/tasks', data);
    return response;
  },

  updateTask: async (id, data) => {
    const response = await api.put(`/tasks/${id}`, data);
    return response;
  },

  deleteTask: async (id) => {
    const response = await api.delete(`/tasks/${id}`);
    return response;
  },

  updateTaskStatus: async (id, status) => {
    const response = await api.patch(`/tasks/${id}/status`, { status });
    return response;
  },

  getTaskComments: async (id) => {
    const response = await api.get(`/tasks/${id}/comments`);
    return response;
  },

  addTaskComment: async (id, message) => {
    const response = await api.post(`/tasks/${id}/comments`, { message });
    return response;
  },

  getTaskActivities: async (id) => {
    const response = await api.get(`/tasks/${id}/activities`);
    return response;
  },

  getPendingTaskCount: async () => {
    const response = await api.get('/tasks', { params: { status: 'TODO', limit: 1 } });
    return response;
  },
};

export default taskService;
