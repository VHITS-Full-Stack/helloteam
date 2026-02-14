import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated, isImpersonating } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.includes(user?.role);

    if (!hasAccess) {
      // Redirect to appropriate dashboard based on role
      const role = user?.role;
      let redirectPath = '/login';

      if (role === 'EMPLOYEE') {
        redirectPath = '/employee/dashboard';
      } else if (role === 'CLIENT') {
        redirectPath = '/client/dashboard';
      } else if (['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'].includes(role)) {
        redirectPath = '/admin/dashboard';
      }

      return <Navigate to={redirectPath} replace />;
    }
  }

  // Gate CLIENT users with pending agreement (redirect to onboarding)
  // Skip when admin is impersonating
  if (
    !isImpersonating &&
    user?.role === 'CLIENT' &&
    user?.client?.onboardingStatus === 'PENDING_AGREEMENT' &&
    location.pathname !== '/client/onboarding'
  ) {
    return <Navigate to="/client/onboarding" replace />;
  }

  // Gate EMPLOYEE users with pending onboarding (redirect to onboarding)
  // Skip when admin is impersonating
  if (
    !isImpersonating &&
    user?.role === 'EMPLOYEE' &&
    user?.employee?.onboardingStatus === 'PENDING_AGREEMENT' &&
    location.pathname !== '/employee/onboarding'
  ) {
    return <Navigate to="/employee/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;
