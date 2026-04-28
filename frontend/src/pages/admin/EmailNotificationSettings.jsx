import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, AlertCircle, Check, X, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Modal } from '../../components/common';
import settingsService from '../../services/settings.service';

// Notification type definitions - easy to extend
const NOTIFICATION_TYPES = [
  {
    id: 'lunch_break_10min_past',
    label: 'Employee 10+ minutes past lunch break end',
    description: 'Sent when an employee is still on lunch break 10+ minutes past the scheduled end time',
    defaultValue: true,
  },
];

export default function EmailNotificationSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state for adding email
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await settingsService.getEmailNotificationSettings();
      if (response.success) {
        // Merge with defaults to ensure all notification types exist
        const merged = {};
        NOTIFICATION_TYPES.forEach((type) => {
          const saved = response.data?.notifications?.[type.id];
          merged[type.id] = {
            enabled: saved?.enabled ?? type.defaultValue,
            emails: saved?.emails || [],
          };
        });
        setSettings(merged);
      } else {
        setError(response.error || 'Failed to load email notification settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to load email notification settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = (notificationId) => {
    setSettings((prev) => ({
      ...prev,
      [notificationId]: {
        ...prev[notificationId],
        enabled: !prev[notificationId]?.enabled,
      },
    }));
  };

  const openAddEmailModal = (notificationId) => {
    setSelectedNotificationId(notificationId);
    setNewEmail('');
    setEmailError('');
    setShowAddModal(true);
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddEmail = () => {
    if (!newEmail.trim()) {
      setEmailError('Email address is required');
      return;
    }
    if (!validateEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    const currentEmails = settings[selectedNotificationId]?.emails || [];
    if (currentEmails.includes(newEmail.trim())) {
      setEmailError('This email address is already added');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      [selectedNotificationId]: {
        ...prev[selectedNotificationId],
        emails: [...(prev[selectedNotificationId]?.emails || []), newEmail.trim()],
      },
    }));
    setShowAddModal(false);
    setNewEmail('');
  };

  const handleRemoveEmail = (notificationId, emailToRemove) => {
    setSettings((prev) => ({
      ...prev,
      [notificationId]: {
        ...prev[notificationId],
        emails: prev[notificationId]?.emails?.filter((e) => e !== emailToRemove) || [],
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const payload = { notifications: settings };
      const response = await settingsService.updateEmailNotificationSettings(payload);
      if (response.success) {
        setSuccess('Email notification settings saved successfully');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(response.error || 'Failed to save settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Notification Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure which email notifications are sent and to whom
          </p>
        </div>
        <Button
          variant="primary"
          icon={Save}
          onClick={handleSave}
          loading={saving}
        >
          Save Changes
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <div className="space-y-4">
        {NOTIFICATION_TYPES.map((type) => {
          const notificationSettings = settings[type.id] || { enabled: false, emails: [] };
          return (
            <Card key={type.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => handleToggle(type.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notificationSettings.enabled ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <h3 className="text-lg font-semibold text-gray-900">{type.label}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{type.description}</p>

                    {notificationSettings.enabled && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Recipients</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Plus}
                            onClick={() => openAddEmailModal(type.id)}
                          >
                            Add Email
                          </Button>
                        </div>
                        {notificationSettings.emails.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">
                            No recipients configured. Click "Add Email" to add one.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {notificationSettings.emails.map((email) => (
                              <div
                                key={email}
                                className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5"
                              >
                                <span className="text-sm text-gray-700">{email}</span>
                                <button
                                  onClick={() => handleRemoveEmail(type.id, email)}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Email Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Email Recipient"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError('');
              }}
              placeholder="e.g., admin@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddEmail();
              }}
            />
            {emailError && (
              <p className="text-red-600 text-sm mt-1">{emailError}</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowAddModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddEmail}
              className="flex-1"
            >
              Add Email
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
