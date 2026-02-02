import api from './api';

const notificationService = {
  // Get all notifications
  async getNotifications(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.unreadOnly) queryParams.append('unreadOnly', params.unreadOnly);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const queryString = queryParams.toString();
    const url = queryString ? `/notifications?${queryString}` : '/notifications';
    return await api.get(url);
  },

  // Get unread count
  async getUnreadCount() {
    return await api.get('/notifications/unread-count');
  },

  // Mark notification as read
  async markAsRead(id) {
    return await api.put(`/notifications/${id}/read`);
  },

  // Mark all notifications as read
  async markAllAsRead() {
    return await api.put('/notifications/mark-all-read');
  },

  // Delete a notification
  async deleteNotification(id) {
    return await api.delete(`/notifications/${id}`);
  },

  // Delete all read notifications
  async clearReadNotifications() {
    return await api.delete('/notifications/clear-read');
  },
};

export default notificationService;
