import { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '../common';

const SessionTimeoutModal = ({
  isOpen,
  timeRemaining,
  onExtendSession,
  onLogout,
  loading
}) => {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown, onLogout]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-fade-in">
        {/* Icon */}
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          Session Expiring Soon
        </h2>
        <p className="text-gray-600 text-center mb-4">
          Your session will expire due to inactivity. Would you like to continue working?
        </p>

        {/* Countdown */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">
          <p className="text-sm text-amber-700 mb-1">Time remaining</p>
          <p className="text-3xl font-bold text-amber-600 font-mono">
            {formatTime(countdown)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            fullWidth
            onClick={onLogout}
            disabled={loading}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onExtendSession}
            loading={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Continue Session
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutModal;
