import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

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

  return (
    <div className="min-h-screen bg-primary-900 overflow-auto fixed inset-0">
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
        />
      </div>

      {/* Main Content */}
      <div className={`
        transition-all duration-300
        lg:ml-64 lg:p-2
      `}>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden min-h-[calc(100vh-1rem)]">
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
