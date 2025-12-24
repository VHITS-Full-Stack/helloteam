import { Bell, Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '../common';

const Header = ({
  title,
  subtitle,
  user,
  portalType = 'employee',
  onMenuClick,
  showSearch = true,
  actions
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const notifications = [
    { id: 1, title: 'New approval request', message: 'John Doe requested leave', time: '5 min ago', unread: true, type: 'approval' },
    { id: 2, title: 'Time entry approved', message: 'Your time for Monday was approved', time: '1 hour ago', unread: true, type: 'success' },
    { id: 3, title: 'Schedule updated', message: 'Your schedule for next week has been updated', time: '2 hours ago', unread: false, type: 'info' },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  const getNotificationColor = (type) => {
    switch (type) {
      case 'approval': return 'bg-accent';
      case 'success': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'error': return 'bg-danger';
      default: return 'bg-info';
    }
  };

  const getPortalAccent = () => {
    switch (portalType) {
      case 'client': return 'ring-secondary';
      case 'admin': return 'ring-accent';
      default: return 'ring-primary';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-heading">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        {showSearch && (
          <div className="hidden md:flex items-center">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                searchFocused ? 'text-primary' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Search..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={`
                  pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-sm
                  transition-all duration-200 w-64
                  focus:outline-none focus:bg-white focus:w-80
                  ${searchFocused ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'}
                `}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`
              relative p-2.5 rounded-xl transition-all duration-200
              ${showNotifications
                ? 'text-primary bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-danger text-white text-xs font-semibold rounded-full flex items-center justify-center animate-pulse-soft">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-primary-50 to-white">
                  <div>
                    <h3 className="font-bold text-gray-900">Notifications</h3>
                    <p className="text-xs text-gray-500">{unreadCount} unread messages</p>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        px-5 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50
                        transition-colors duration-200
                        ${notification.unread ? 'bg-primary-50/20' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0
                          ${notification.unread ? getNotificationColor(notification.type) : 'bg-gray-200'}
                        `} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                  <button className="text-sm text-primary font-semibold hover:text-primary-dark transition-colors w-full text-center py-1">
                    View all notifications
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className={`ring-2 ring-offset-2 ${getPortalAccent()} rounded-full`}>
            <Avatar
              name={user?.name}
              src={user?.avatar}
              size="sm"
              status="online"
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500">{user?.role || 'Employee'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
