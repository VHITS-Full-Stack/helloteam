/* eslint-disable consistent-return */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth.service';
import api from '../services/api';
import SessionTimeoutModal from '../components/auth/SessionTimeoutModal';

const AuthContext = createContext(null);

// Session timeout configuration (in milliseconds)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000; // Show warning 5 minutes before timeout
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check activity every minute

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [extendingSession, setExtendingSession] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(!!localStorage.getItem('adminToken'));
  const navigate = useNavigate();

  const lastActivityRef = useRef(Date.now());
  const timeoutCheckRef = useRef(null);
  const checkingAuthRef = useRef(false);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setShowTimeoutWarning(false);
      setIsImpersonating(false);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('rememberMe');
      navigate('/login');
    }
  }, [navigate]);

  // Update last activity on user interaction
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showTimeoutWarning) {
      setShowTimeoutWarning(false);
    }
  }, [showTimeoutWarning]);

  // Listen for user activity — employees are exempt from inactivity timeout
  useEffect(() => {
    if (!user || user.role === 'EMPLOYEE') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [user, updateActivity]);

  // Check for session timeout — employees are exempt from inactivity timeout
  useEffect(() => {
    if (!user || user.role === 'EMPLOYEE') return;

    const checkTimeout = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      const timeUntilTimeout = SESSION_TIMEOUT - timeSinceActivity;

      if (timeUntilTimeout <= 0) {
        // Session expired
        logout();
      } else if (timeUntilTimeout <= WARNING_BEFORE_TIMEOUT && !showTimeoutWarning) {
        // Show warning
        setTimeRemaining(Math.floor(timeUntilTimeout / 1000));
        setShowTimeoutWarning(true);
      } else if (showTimeoutWarning) {
        // Update countdown
        setTimeRemaining(Math.floor(timeUntilTimeout / 1000));
      }
    };

    timeoutCheckRef.current = setInterval(checkTimeout, ACTIVITY_CHECK_INTERVAL);

    return () => {
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
      }
    };
  }, [user, showTimeoutWarning, logout]);

  // Check authentication status on mount
  useEffect(() => {
    if (checkingAuthRef.current) return;
    checkingAuthRef.current = true;
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for remember me token first
      const rememberMe = localStorage.getItem('rememberMe') === 'true';

      if (!authService.isAuthenticated()) {
        // If remember me was set, try to restore from session storage
        if (rememberMe) {
          const savedToken = localStorage.getItem('token');
          if (savedToken) {
            // Token exists, try to validate
            try {
              const response = await authService.getProfile();
              if (response.success) {
                setUser(response.data);
                lastActivityRef.current = Date.now();
                setLoading(false);
                return;
              }
            } catch {
              // Token invalid, clear it
              localStorage.removeItem('token');
              localStorage.removeItem('rememberMe');
            }
          }
        }
        setLoading(false);
        return;
      }

      const response = await authService.getProfile();
      if (response.success) {
        setUser(response.data);
        lastActivityRef.current = Date.now();
      } else {
        authService.logout();
        localStorage.removeItem('rememberMe');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      authService.logout();
      localStorage.removeItem('rememberMe');
    } finally {
      setLoading(false);
    }
  };

  const extendSession = async () => {
    try {
      setExtendingSession(true);
      const response = await authService.validateSession();
      if (response.success) {
        lastActivityRef.current = Date.now();
        setShowTimeoutWarning(false);
      } else {
        logout();
      }
    } catch (err) {
      console.error('Failed to extend session:', err);
      logout();
    } finally {
      setExtendingSession(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      setError(null);
      // Don't set loading here - let the Login component handle its own loading state
      // This prevents the loading screen from showing during login attempts

      const response = await authService.login(email, password);

      if (response.success) {
        setUser(response.data.user);
        lastActivityRef.current = Date.now();

        // Handle remember me
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberMe');
        }

        // Navigate based on role
        const role = response.data.user.role;
        if (role === 'EMPLOYEE') {
          const emp = response.data.user.employee;
          // Check if employee needs to complete onboarding or KYC
          if (emp?.onboardingStatus === 'PENDING_AGREEMENT' || (emp?.kycStatus && emp.kycStatus !== 'APPROVED')) {
            navigate('/employee/onboarding');
          } else {
            navigate('/employee/dashboard');
          }
        } else if (role === 'CLIENT') {
          // Check if client needs to complete onboarding
          if (response.data.user.client?.onboardingStatus === 'PENDING_AGREEMENT') {
            navigate('/client/onboarding');
          } else {
            navigate('/client/dashboard');
          }
        } else {
          navigate('/admin/dashboard');
        }

        return { success: true };
      } else {
        const errorMsg = response.error || 'Login failed. Please try again.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const impersonate = async (userId) => {
    const currentToken = api.getToken();
    try {
      // Save admin token before switching
      localStorage.setItem('adminToken', currentToken);

      const response = await authService.impersonateUser(userId);
      if (response.success) {
        api.setToken(response.data.token);
        setUser(response.data.user);
        setIsImpersonating(true);

        // Navigate based on impersonated user's role
        const role = response.data.user.role;
        if (role === 'EMPLOYEE') {
          navigate('/employee/dashboard');
        } else if (role === 'CLIENT') {
          navigate('/client/dashboard');
        } else if (['ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'].includes(role)) {
          navigate('/admin/dashboard');
        }
        return { success: true };
      } else {
        // Restore admin token on failure
        localStorage.removeItem('adminToken');
        return { success: false, error: response.error || 'Failed to impersonate user' };
      }
    } catch (err) {
      // Restore admin token on error
      api.setToken(currentToken);
      localStorage.removeItem('adminToken');
      return { success: false, error: err.message || 'Failed to impersonate user' };
    }
  };

  const exitImpersonation = async () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return;

    try {
      // Try to logout the impersonated session (non-critical)
      await authService.logout().catch(() => {});

      // Restore admin token
      api.setToken(adminToken);
      localStorage.removeItem('adminToken');
      setIsImpersonating(false);

      // Fetch admin profile
      const response = await authService.getProfile();
      if (response.success) {
        setUser(response.data);
        navigate('/admin/dashboard');
      } else {
        // Admin token expired — full logout
        api.removeToken();
        setUser(null);
        localStorage.removeItem('rememberMe');
        navigate('/login');
      }
    } catch (err) {
      console.error('Exit impersonation error:', err);
      // Fallback: full logout
      api.removeToken();
      localStorage.removeItem('adminToken');
      setUser(null);
      setIsImpersonating(false);
      localStorage.removeItem('rememberMe');
      navigate('/login');
    }
  };

  const forgotPassword = async (email) => {
    try {
      setError(null);
      const response = await authService.forgotPassword(email);
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Failed to send reset email';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      setError(null);
      const response = await authService.resetPassword(token, newPassword);
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Failed to reset password';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      const response = await authService.changePassword(currentPassword, newPassword);
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Failed to change password';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Check if user has specific role(s)
  const hasRole = (roles) => {
    if (!user) return false;
    if (typeof roles === 'string') {
      return user.role === roles;
    }
    return roles.includes(user.role);
  };

  // Check if user is admin (any admin role)
  const isAdmin = () => {
    return hasRole(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT']);
  };

  const refreshUser = async () => {
    try {
      const response = await authService.getProfile();
      if (response.success) {
        setUser(response.data);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    hasRole,
    isAdmin,
    clearError: () => setError(null),
    extendSession,
    impersonate,
    exitImpersonation,
    isImpersonating,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionTimeoutModal
        isOpen={showTimeoutWarning}
        timeRemaining={timeRemaining}
        onExtendSession={extendSession}
        onLogout={logout}
        loading={extendingSession}
      />
    </AuthContext.Provider>
  );
};
