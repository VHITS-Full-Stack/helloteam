import api from './api';

const chatService = {
  getConversations() {
    return api.get('/chat/conversations');
  },

  createConversation(clientId, employeeId) {
    return api.post('/chat/conversations', { clientId, employeeId });
  },

  getMessages(conversationId, cursor = null, limit = 50) {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    return api.get(`/chat/conversations/${conversationId}/messages`, { params });
  },

  async sendMessage(conversationId, { content, messageType = 'TEXT', file, audioDuration }) {
    if (file) {
      // Use FormData for file uploads
      const url = `${api.baseUrl}/chat/conversations/${conversationId}/messages`;
      const token = api.getToken();
      const formData = new FormData();
      formData.append('file', file);
      if (content) formData.append('content', content);
      formData.append('messageType', messageType);
      if (audioDuration) formData.append('audioDuration', String(audioDuration));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || 'Failed to send message');
        error.status = response.status;
        throw error;
      }
      return data;
    }

    return api.post(`/chat/conversations/${conversationId}/messages`, {
      content,
      messageType,
      audioDuration,
    });
  },

  sendFile(conversationId, file, messageType = 'FILE') {
    return this.sendMessage(conversationId, { messageType, file });
  },

  close(conversationId) {
    return api.post(`/chat/conversations/${conversationId}/close`);
  },

  getUnreadCount() {
    return api.get('/chat/unread-count');
  },

  getContacts() {
    return api.get('/chat/contacts');
  },
};

export default chatService;
