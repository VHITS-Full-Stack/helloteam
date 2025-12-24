import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Users, Building2, Shield } from 'lucide-react';
import { Button, Input, Card } from '../../components/common';

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [portalType, setPortalType] = useState('employee');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate login
    setTimeout(() => {
      setLoading(false);
      switch (portalType) {
        case 'employee':
          navigate('/employee/dashboard');
          break;
        case 'client':
          navigate('/client/dashboard');
          break;
        case 'admin':
          navigate('/admin/dashboard');
          break;
        default:
          navigate('/employee/dashboard');
      }
    }, 1000);
  };

  const portals = [
    {
      id: 'employee',
      label: 'Employee',
      description: 'Access your workspace',
      icon: Users,
      color: 'primary'
    },
    {
      id: 'client',
      label: 'Client',
      description: 'Manage workforce',
      icon: Building2,
      color: 'secondary'
    },
    {
      id: 'admin',
      label: 'Admin',
      description: 'System control',
      icon: Shield,
      color: 'accent'
    },
  ];

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
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">
            Welcome Back
          </h1>
          <p className="text-gray-500 mt-1">Sign in to Hello Team Workforce Hub</p>
        </div>

        <Card className="animate-fade-in backdrop-blur-sm bg-white/95">
          {/* Portal Selection */}
          <div className="mb-6">
            <label className="label mb-3">Select Portal</label>
            <div className="grid grid-cols-3 gap-3">
              {portals.map((portal) => {
                const Icon = portal.icon;
                const isSelected = portalType === portal.id;
                return (
                  <button
                    key={portal.id}
                    type="button"
                    onClick={() => setPortalType(portal.id)}
                    className={`
                      p-4 rounded-xl border-2 text-center transition-all duration-200
                      ${isSelected
                        ? portal.color === 'primary'
                          ? 'border-primary bg-primary-50 shadow-md'
                          : portal.color === 'secondary'
                          ? 'border-secondary bg-secondary-50 shadow-md'
                          : 'border-accent bg-accent-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center
                      ${isSelected
                        ? portal.color === 'primary'
                          ? 'bg-primary text-white'
                          : portal.color === 'secondary'
                          ? 'bg-secondary text-gray-900'
                          : 'bg-accent text-gray-900'
                        : 'bg-gray-100 text-gray-500'
                      }
                    `}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className={`font-semibold text-sm ${
                      isSelected
                        ? portal.color === 'primary'
                          ? 'text-primary-700'
                          : portal.color === 'secondary'
                          ? 'text-secondary-700'
                          : 'text-accent-700'
                        : 'text-gray-900'
                    }`}>
                      {portal.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{portal.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              icon={Mail}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={Lock}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-offset-0"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                  Remember me
                </span>
              </label>
              <a
                href="#"
                className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              className="shadow-button hover:shadow-button-hover"
            >
              Sign In
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-center text-sm text-gray-500 mb-3">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-primary-50 rounded-lg border border-primary-100">
                <p className="font-semibold text-primary-700">Employee</p>
                <p className="text-gray-500 mt-0.5">employee@demo.com</p>
              </div>
              <div className="p-2 bg-secondary-50 rounded-lg border border-secondary-100">
                <p className="font-semibold text-secondary-700">Client</p>
                <p className="text-gray-500 mt-0.5">client@demo.com</p>
              </div>
              <div className="p-2 bg-accent-50 rounded-lg border border-accent-100">
                <p className="font-semibold text-accent-700">Admin</p>
                <p className="text-gray-500 mt-0.5">admin@demo.com</p>
              </div>
            </div>
          </div>
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
