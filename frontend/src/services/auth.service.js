import api from './api';

export const authService = {
  // Login user
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response.success && response.data?.token) {
      api.setToken(response.data.token);
    }
    return response;
  },

  // Register user (admin only in production)
  async register(userData) {
    return api.post('/auth/register', userData);
  },

  // Logout user
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      api.removeToken();
    }
  },

  // Get current user profile
  async getProfile() {
    return api.get('/auth/profile');
  },

  // Request password reset
  async forgotPassword(email) {
    return api.post('/auth/forgot-password', { email });
  },

  // Reset password with token
  async resetPassword(token, newPassword) {
    return api.post('/auth/reset-password', { token, newPassword });
  },

  // Change password (authenticated)
  async changePassword(currentPassword, newPassword) {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },

  // Validate current session
  async validateSession() {
    return api.get('/auth/validate-session');
  },

  // Check if user is logged in
  isAuthenticated() {
    return !!api.getToken();
  },

  // Get stored token
  getToken() {
    return api.getToken();
  },
};

export default authService;
