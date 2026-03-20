import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ImpersonationBanner from './ImpersonationBanner';
import clientPortalService from '../../services/clientPortal.service';
import ShiftModals from './ShiftModals';

const OvertimeLoginBlocker = ({ onDismiss }) => {
  const navigate = useNavigate();
  const [pendingOT, setPendingOT] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPendingOT = async () => {
      try {
        const response = await clientPortalService.getPendingOvertimeSummary();
        if (response.success && response.data.count > 0) {
          setPendingOT(response.data);
        } else {
          onDismiss();
        }
      } catch {
        onDismiss();
      } finally {
        setLoading(false);
      }
    };
    fetchPendingOT();
  }, [onDismiss]);

  if (loading || !pendingOT) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Red header bar */}
        <div className="bg-red-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Action Required: Unapproved Overtime
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-800 text-base">
            Your employees have worked unapproved overtime. <strong>Employees will NOT get paid</strong> until you approve or deny these hours.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-red-700 font-medium">Unapproved Entries</span>
              <span className="text-red-800 font-bold">{pendingOT.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-700 font-medium">Total Hours</span>
              <span className="text-red-800 font-bold">{pendingOT.totalHours}</span>
            </div>
            {pendingOT.employees && pendingOT.employees.length > 0 && (
              <div className="pt-2 border-t border-red-200">
                <span className="text-red-700 font-medium text-sm">Employees:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {pendingOT.employees.map((emp, i) => (
                    <span key={i} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
                      {emp.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500">
            We cannot pay your employees for these hours until you approve or deny them. You will continue to receive daily reminders until all overtime is resolved.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => { onDismiss(); navigate('/client/approvals?type=overtime'); }}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Review & Approve Now
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardLayout = ({
  portalType = 'employee',
  title = 'Dashboard',
  subtitle,
  user,
  onLogout,
  headerActions,
  showSearch = true,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOTBlocker, setShowOTBlocker] = useState(false);

  // Show login blocker for client portal users on initial load
  useEffect(() => {
    if (portalType === 'client') {
      // Check if blocker was already dismissed this session
      const dismissed = sessionStorage.getItem('ot_blocker_dismissed');
      if (!dismissed) {
        setShowOTBlocker(true);
      }
    }
  }, [portalType]);

  const handleDismissBlocker = useCallback(() => {
    setShowOTBlocker(false);
    sessionStorage.setItem('ot_blocker_dismissed', 'true');
  }, []);

  return (
    <div className="min-h-screen bg-primary-900 overflow-auto fixed inset-0">
      {/* Login Blocker for pending OT */}
      {showOTBlocker && portalType === 'client' && (
        <OvertimeLoginBlocker onDismiss={handleDismissBlocker} />
      )}

      {/* Global shift modals for employee portal */}
      {portalType === 'employee' && <ShiftModals />}

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40
        transform lg:transform-none lg:opacity-100
        transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          portalType={portalType}
          user={user}
          onLogout={onLogout}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />
      </div>

      {/* Main Content */}
      <div className={`
        transition-all duration-300
        ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} lg:p-2
      `}>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden min-h-[calc(100vh-1rem)]">
          <ImpersonationBanner />
          <Header
            title={title}
            subtitle={subtitle}
            user={user}
            onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            showSearch={showSearch}
            actions={headerActions}
          />

          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
