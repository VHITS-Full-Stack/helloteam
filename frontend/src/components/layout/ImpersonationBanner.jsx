import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ImpersonationBanner = () => {
  const { user, isImpersonating, exitImpersonation } = useAuth();

  if (!isImpersonating) return null;

  const displayName =
    user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : user?.client
        ? user.client.companyName
        : user?.email;

  return (
    <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-800">
          Impersonating: <strong>{displayName}</strong> ({user?.role})
        </span>
      </div>
      <button
        onClick={exitImpersonation}
        className="px-3 py-1 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
      >
        Exit
      </button>
    </div>
  );
};

export default ImpersonationBanner;
