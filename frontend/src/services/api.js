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
        'Cache-Control': 'no-cache',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Handle non-JSON responses (e.g. Nginx 413, 502 HTML error pages)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (response.status === 413) {
          const error = new Error('Request entity too large. Please reduce the file size and try again.');
          error.status = 413;
          throw error;
        }
        const error = new Error(`Server error (${response.status}). Please try again later.`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();

      if (!response.ok) {
        // Handle onboarding incomplete - redirect to onboarding page
        if (response.status === 403 && data.code === 'ONBOARDING_INCOMPLETE') {
          // Check current path to determine which onboarding to redirect to
          if (window.location.pathname.startsWith('/employee')) {
            window.location.href = '/employee/onboarding';
          } else {
            window.location.href = '/client/onboarding';
          }
          return data;
        }

        // Handle session expired / unauthorized - redirect to login
        if (response.status === 401) {
          this.removeToken();
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('adminToken');
          window.location.href = '/login';
          return data;
        }

        // Create an error with the message from the API
        const error = new Error(data.error || data.message || 'An error occurred');
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      // Handle network errors or JSON parse errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('Unable to connect to server. Please check your connection.');
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  }

  // GET request
  get(endpoint, options = {}) {
    let url = endpoint;
    if (options.params) {
      // Filter out undefined and null values
      const filteredParams = Object.fromEntries(
        Object.entries(options.params).filter(([, v]) => v !== undefined && v !== null && v !== '')
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

  // POST FormData (for mixed file + fields requests)
  async uploadFormData(endpoint, formData) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (response.status === 413) {
          const error = new Error('File too large. Please reduce the file size and try again.');
          error.status = 413;
          throw error;
        }
        const error = new Error(`Server error (${response.status}). Please try again later.`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          this.removeToken();
          window.location.href = '/login';
          return data;
        }
        const error = new Error(data.error || data.message || 'An error occurred');
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('Unable to connect to server. Please check your connection.');
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  }

  // Upload file (FormData)
  async uploadFile(endpoint, file, fieldName = 'photo') {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      // Handle non-JSON responses (e.g. Nginx 413, 502 HTML error pages)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (response.status === 413) {
          const error = new Error('File too large. Please reduce the file size and try again.');
          error.status = 413;
          throw error;
        }
        const error = new Error(`Server error (${response.status}). Please try again later.`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.removeToken();
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('adminToken');
          window.location.href = '/login';
          return data;
        }
        const error = new Error(data.error || data.message || 'Upload failed');
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('Unable to connect to server. Please check your connection.');
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  }
}

export const api = new ApiService();
export default api;
