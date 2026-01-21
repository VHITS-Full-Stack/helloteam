import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '../../components/common';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, loading: authLoading, error: authError, clearError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === 'EMPLOYEE') {
        navigate('/employee/dashboard');
      } else if (role === 'CLIENT') {
        navigate('/client/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Clear errors when typing
  useEffect(() => {
    setError('');
    setValidationErrors({});
    clearError();
  }, [formData.email, formData.password, clearError]);

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password, rememberMe);

      if (!result.success) {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-100 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block p-2 bg-white rounded-2xl shadow-lg mb-4">
            <img
              src="/logo.png"
              alt="Hello Team"
              className="h-14 w-auto"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">
            Welcome Back
          </h1>
          <p className="text-gray-500 mt-1">Sign in to Hello Team Workforce Hub</p>
        </div>

        <Card className="animate-fade-in backdrop-blur-sm bg-white/95">
          {/* Error Alert */}
          {(error || authError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Login Failed</p>
                <p className="text-sm text-red-600 mt-0.5">{error || authError}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                label="Email Address"
                type="email"
                placeholder="Enter your email"
                icon={Mail}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={validationErrors.email}
                required
              />
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={Lock}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={validationErrors.password}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-offset-0"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                  Remember me
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              disabled={loading}
              className="shadow-button hover:shadow-button-hover"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Powered by <span className="font-semibold text-primary">Hello Team</span> &copy; 2025
        </p>
      </div>
    </div>
  );
};

export default Login;
