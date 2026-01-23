const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://office.thehelloteam.com/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  setToken(token) {
    localStorage.setItem('token', token);
  }

  removeToken() {
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // GET request
  get(endpoint, options = {}) {
    let url = endpoint;
    if (options.params) {
      // Filter out undefined and null values
      const filteredParams = Object.fromEntries(
        Object.entries(options.params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      );
      const queryParams = new URLSearchParams(filteredParams).toString();
      url = queryParams ? `${endpoint}?${queryParams}` : endpoint;
    }
    return this.request(url, { method: 'GET' });
  }

  // POST request
  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // PUT request
  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // PATCH request
  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
export default api;
