/* eslint-disable consistent-return */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button, Badge } from '../common';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import workSessionService from '../../services/workSession.service';
import notificationService from '../../services/notification.service';
import { formatTime12 } from '../../utils/formatDateTime';

/**
 * Global shift-related modals for employee portal.
 * Listens to socket events and shows modals on ANY page.
 */
const ShiftModals = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Shift ending warning modal (30 min before)
  const [showShiftEndModal, setShowShiftEndModal] = useState(false);
  const [shiftEndData, setShiftEndData] = useState(null);
  const [shiftEndReason, setShiftEndReason] = useState('');
  const [shiftEndLoading, setShiftEndLoading] = useState(false);
  const [shiftEndError, setShiftEndError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const shiftEndDismissedRef = useRef(
    sessionStorage.getItem('shiftEndDismissed') === 'true'
  );

  // Controlled pause modal (shift has ended)
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseData, setPauseData] = useState(null);
  const [pauseCountdown, setPauseCountdown] = useState(120);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState('');

  // Listen for socket events
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleNotification = (data) => {
      if (
        data.type === 'SHIFT_ENDING' ||
        data.type === 'SHIFT_ENDING_OT_APPROVED'
      ) {
        if (shiftEndDismissedRef.current) return;
        setShiftEndData(data.data || data);
        setShowShiftEndModal(true);
      } else if (data.type === 'SHIFT_END_PAUSE') {
        setPauseData(data.data || data);
        setPauseCountdown(120);
        setPauseReason('');
        setPauseError('');
        setShowPauseModal(true);
      } else if (data.type === 'AUTO_CLOCK_OUT') {
        setShowPauseModal(false);
        setShowShiftEndModal(false);
        // Dispatch event so Dashboard can refresh session data
        window.dispatchEvent(new CustomEvent('session-updated'));
      }
    };

    socket.on(`notification:${user.id}`, handleNotification);

    return () => {
      socket.off(`notification:${user.id}`, handleNotification);
    };
  }, [socket, user?.id]);

  // Poll for unread SHIFT_ENDING notifications (fallback)
  useEffect(() => {
    if (!user?.id) return;

    const checkShiftEndNotifications = async () => {
      if (showShiftEndModal || shiftEndDismissedRef.current) return;

      try {
        // Check if there's an active session first
        const sessionRes = await workSessionService.getCurrentSession();
        if (!sessionRes.success || !sessionRes.session || sessionRes.session.status === 'COMPLETED') return;

        const currentSessionId = sessionRes.session.id;

        const response = await notificationService.getNotifications({
          unreadOnly: 'true',
          limit: '5',
        });
        if (response.success && response.data?.notifications) {
          const shiftNotif = response.data.notifications.find(
            (n) =>
              (n.type === 'SHIFT_ENDING' || n.type === 'SHIFT_ENDING_OT_APPROVED') &&
              !n.isRead
          );
          if (shiftNotif) {
            // Only show modal if notification belongs to the current active session
            const notifSessionId = shiftNotif.data?.sessionId;
            if (notifSessionId && notifSessionId !== currentSessionId) {
              // Old notification from a previous session — mark as read and skip
              notificationService.markAsRead(shiftNotif.id).catch(() => {});
              return;
            }
            setShiftEndData(shiftNotif.data || {});
            setShowShiftEndModal(true);
            notificationService.markAsRead(shiftNotif.id).catch(() => {});
          }
        }
      } catch {
        // Silent fail
      }
    };

    checkShiftEndNotifications();
    const interval = setInterval(checkShiftEndNotifications, 60000);
    return () => clearInterval(interval);
  }, [user?.id, showShiftEndModal]);

  // Pause countdown timer
  useEffect(() => {
    if (!showPauseModal) return;
    if (pauseCountdown <= 0) return;
    const timer = setTimeout(() => setPauseCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showPauseModal, pauseCountdown]);

  // Listen for show-shift-end-modal event (from Dashboard)
  useEffect(() => {
    const handleShowShiftEnd = (e) => {
      if (e.detail) {
        setShiftEndData(e.detail);
        setShowShiftEndModal(true);
      }
    };
    window.addEventListener('show-shift-end-modal', handleShowShiftEnd);
    return () => window.removeEventListener('show-shift-end-modal', handleShowShiftEnd);
  }, []);

  const dismissShiftEndPopup = useCallback(() => {
    shiftEndDismissedRef.current = true;
    sessionStorage.setItem('shiftEndDismissed', 'true');
  }, []);

  const markShiftEndNotificationsRead = useCallback(async () => {
    dismissShiftEndPopup();
    try {
      const response = await notificationService.getNotifications({
        unreadOnly: 'true',
        limit: '10',
      });
      if (response.success && response.data?.notifications) {
        response.data.notifications
          .filter(
            (n) =>
              (n.type === 'SHIFT_ENDING' || n.type === 'SHIFT_ENDING_OT_APPROVED') &&
              !n.isRead
          )
          .forEach((n) => notificationService.markAsRead(n.id).catch(() => {}));
      }
    } catch {
      // Silent fail
    }
  }, [dismissShiftEndPopup]);

  const handleContinueWorking = async () => {
    setShiftEndError('');
    if (!shiftEndReason.trim()) {
      setShiftEndError('Please provide a reason for continuing to work');
      return;
    }
    try {
      setShiftEndLoading(true);
      await workSessionService.shiftEndResponse('CONTINUE_WORKING', shiftEndReason.trim());
      dismissShiftEndPopup();
      markShiftEndNotificationsRead();
      setShowShiftEndModal(false);
      setShiftEndReason('');
      setShiftEndError('');
      window.dispatchEvent(new CustomEvent('session-updated'));
    } catch (err) {
      setShiftEndError(err.error || err.message || 'Failed to continue working');
    } finally {
      setShiftEndLoading(false);
    }
  };

  const handlePauseResponse = async (action) => {
    if (action === 'CONTINUE_WORKING' && !pauseReason.trim()) {
      setPauseError('Please provide a reason for continuing to work');
      return;
    }
    try {
      setPauseLoading(true);
      setPauseError('');
      await workSessionService.shiftEndResponse(action, pauseReason || null);
      setShowPauseModal(false);
      window.dispatchEvent(new CustomEvent('session-updated'));
    } catch (err) {
      setPauseError(err.error || err.message || 'Failed to process response');
    } finally {
      setPauseLoading(false);
    }
  };

  // Don't render anything for non-employee users
  if (!user?.id) return null;

  return (
    <>
      {/* Shift Ending Warning Modal */}
      {showShiftEndModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${shiftEndData?.hasApprovedOT ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {shiftEndData?.hasApprovedOT ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {shiftEndData?.hasApprovedOT ? 'Approved Overtime' : 'Shift Ending'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {shiftEndData?.hasApprovedOT ? 'Do you want to use it?' : 'Stay clocked in?'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  dismissShiftEndPopup();
                  setShowShiftEndModal(false);
                  setShiftEndError('');
                  setShiftEndReason('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftEndData?.hasApprovedOT ? (
              <div className="p-6 space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 text-sm font-medium">
                    You have approved overtime. Your shift ends at{' '}
                    {formatTime12(shiftEndData?.shiftEnd)}. Would you like to stay clocked in
                    and use your approved overtime?
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    loading={actionLoading}
                    onClick={async () => {
                      try {
                        setActionLoading(true);
                        await workSessionService.shiftEndResponse('STAY_CLOCKED_OUT', null);
                        markShiftEndNotificationsRead();
                        setShowShiftEndModal(false);
                        window.dispatchEvent(new CustomEvent('session-updated'));
                      } catch (err) {
                        setShiftEndError(err.error || err.message || 'Failed to clock out');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    className="flex-1"
                  >
                    No, Clock Me Out
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={actionLoading}
                    onClick={async () => {
                      try {
                        setActionLoading(true);
                        await workSessionService.shiftEndResponse('CONTINUE_WORKING', 'Using approved overtime');
                        markShiftEndNotificationsRead();
                        setShowShiftEndModal(false);
                        window.dispatchEvent(new CustomEvent('session-updated'));
                      } catch (err) {
                        setShiftEndError(err.error || err.message || 'Failed to continue session');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    className="flex-1"
                  >
                    Yes, Stay Clocked In
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 text-sm font-medium">
                    Your shift ends at {formatTime12(shiftEndData?.shiftEnd)}.
                    If you continue working past your shift, the extra time will
                    be tracked as overtime without prior approval.
                    You may not be compensated for unapproved overtime.
                  </p>
                </div>

                {shiftEndError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{shiftEndError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Why do you need to continue working?"
                    value={shiftEndReason}
                    onChange={(e) => setShiftEndReason(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      dismissShiftEndPopup();
                      setShowShiftEndModal(false);
                      setShiftEndError('');
                      setShiftEndReason('');
                    }}
                    className="flex-1"
                  >
                    No, I'm Good
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={shiftEndLoading}
                    onClick={handleContinueWorking}
                    className="flex-1 !bg-orange-600 hover:!bg-orange-700"
                  >
                    Continue Working
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controlled Pause Modal — Shift has ended */}
      {showPauseModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-100">
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Shift Has Ended</h2>
                  <p className="text-sm text-gray-500">
                    Scheduled end: {formatTime12(pauseData?.shiftEnd)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm font-medium">
                  Your scheduled shift has ended. You will be automatically clocked out.
                    If you continue working, the extra time will be tracked as overtime
                    without prior approval. You may not be compensated for unapproved overtime.
                </p>
              </div>

              {pauseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{pauseError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for continuing <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Why do you need to continue working past your shift?"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Required if you choose to continue working</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handlePauseResponse('STAY_CLOCKED_OUT')}
                  loading={pauseLoading}
                  className="flex-1"
                >
                  Stay Clocked Out
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handlePauseResponse('CONTINUE_WORKING')}
                  loading={pauseLoading}
                  className="flex-1 !bg-orange-600 hover:!bg-orange-700"
                >
                  Continue Working
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShiftModals;
