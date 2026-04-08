import { useState, useRef, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  Shield,
  Camera,
  Save,
  Bell,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Avatar,
  PhoneInput,
} from "../../components/common";
import { getPhoneError } from "../../utils/clientValidation";
import { useAuth } from "../../context/AuthContext";
import authService from "../../services/auth.service";

const Profile = () => {
  const { user: authUser, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState("personal");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const fileInputRef = useRef(null);

  // Profile data - initialized from auth context (no extra API call needed)
  const [profile, setProfile] = useState(authUser);

  // Form data for editing - initialized from auth context
  const [formData, setFormData] = useState(() => {
    const emp = authUser?.employee;
    return {
      firstName: emp?.firstName || "",
      lastName: emp?.lastName || "",
      countryCode: emp?.countryCode || "+1",
      phone: emp?.phone || "",
      address: emp?.address || "",
    };
  });

  // Password change form
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification preferences - initialized from auth context
  const [notifications, setNotifications] = useState(() => {
    const emp = authUser?.employee;
    return {
      scheduleChanges: emp?.notifyScheduleChanges ?? true,
      shiftReminders: emp?.notifyShiftReminders ?? true,
      leaveApprovals: emp?.notifyLeaveApprovals ?? true,
      pushMessages: emp?.notifyPushMessages ?? false,
      weeklySummary: emp?.notifyWeeklySummary ?? true,
    };
  });
  const [, setSavingNotification] = useState(null);

  const fetchingRef = useRef(false);

  const fetchProfile = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setLoading(true);
      const response = await authService.getProfile();
      if (response.success && response.data) {
        setProfile(response.data);
        if (response.data.employee) {
          const emp = response.data.employee;
          setFormData({
            firstName: emp.firstName || "",
            lastName: emp.lastName || "",
            countryCode: emp.countryCode || "+1",
            phone: emp.phone || "",
            address: emp.address || "",
          });
          setNotifications({
            scheduleChanges: emp.notifyScheduleChanges ?? true,
            shiftReminders: emp.notifyShiftReminders ?? true,
            leaveApprovals: emp.notifyLeaveApprovals ?? true,
            pushMessages: emp.notifyPushMessages ?? false,
            weeklySummary: emp.notifyWeeklySummary ?? true,
          });
        }
      }
    } catch (err) {
      setError("Failed to load profile");
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    const phoneError = getPhoneError(formData.phone, formData.countryCode);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await authService.updateProfile(formData);

      if (response.success) {
        setSuccess("Profile updated successfully");
        setProfile(response.data);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.error || "Failed to update profile");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    try {
      setChangingPassword(true);
      const response = await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
      );

      if (response.success) {
        setPasswordSuccess("Password changed successfully");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setTimeout(() => setPasswordSuccess(""), 3000);
      } else {
        setPasswordError(response.error || "Failed to change password");
      }
    } catch (err) {
      setPasswordError(err.error || err.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleNotificationToggle = async (key) => {
    const newValue = !notifications[key];
    setNotifications((prev) => ({ ...prev, [key]: newValue }));
    setSavingNotification(key);

    try {
      const response = await authService.updateProfile({
        notifications: { [key]: newValue },
      });
      if (!response.success) {
        // Revert on failure
        setNotifications((prev) => ({ ...prev, [key]: !newValue }));
        setError(response.error || "Failed to update notification setting");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      // Revert on error
      setNotifications((prev) => ({ ...prev, [key]: !newValue }));
      setError(
        err.error || err.message || "Failed to update notification setting",
      );
      setTimeout(() => setError(""), 3000);
    } finally {
      setSavingNotification(null);
    }
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, WebP, or GIF.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum size is 5MB.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    try {
      setUploadingPhoto(true);
      setError("");
      const response = await authService.uploadProfilePhoto(file);

      if (response.success) {
        setSuccess("Profile photo updated successfully");
        setProfile((prev) => ({
          ...prev,
          employee: {
            ...prev.employee,
            profilePhoto: response.data.profilePhoto,
          },
        }));
        refreshUser();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.error || "Failed to upload photo");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError(err.message || "Failed to upload photo");
      setTimeout(() => setError(""), 3000);
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePhotoDelete = async () => {
    setShowDeletePhotoModal(false);
    try {
      setUploadingPhoto(true);
      const response = await authService.deleteProfilePhoto();

      if (response.success) {
        setSuccess("Profile photo deleted successfully");
        setProfile((prev) => ({
          ...prev,
          employee: {
            ...prev.employee,
            profilePhoto: null,
          },
        }));
        refreshUser();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.error || "Failed to delete photo");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError(err.message || "Failed to delete photo");
      setTimeout(() => setError(""), 3000);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const tabs = [
    { id: "personal", label: "Personal Info" },
    { id: "employment", label: "Employment" },
    { id: "notifications", label: "Notifications" },
    { id: "security", label: "Security" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const employee = profile?.employee;
  const user = profile;
  const fullName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : "Unknown";
  const activeClient = employee?.clientAssignments?.find(
    (a) => a.isActive,
  )?.client;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-gray-500">
          Manage your personal information and preferences
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <Card>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
            />

            {/* Profile Photo or Avatar */}
            {employee?.profilePhoto ? (
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
                <img
                  src={employee.profilePhoto}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <Avatar name={fullName} size="xl" />
            )}

            {/* Camera when no photo, Delete when photo exists */}
            {employee?.profilePhoto ? (
              <button
                onClick={() => setShowDeletePhotoModal(true)}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                title="Delete photo"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button
                onClick={handlePhotoSelect}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                title="Upload photo"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{fullName}</h3>
            <p className="text-gray-500">{user?.email}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
              {activeClient && (
                <Badge variant="primary">{activeClient.companyName}</Badge>
              )}
              <Badge
                variant={user?.status === "ACTIVE" ? "success" : "warning"}
              >
                {user?.status || "Unknown"}
              </Badge>
            </div>
          </div>
          {activeTab === "personal" && (
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "personal" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contact Information
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      name="firstName"
                      className="input"
                      style={{ paddingLeft: "2.5rem" }}
                      value={formData.firstName}
                      onChange={handleInputChange}
                      maxLength={50}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    className="input"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    maxLength={50}
                  />
                </div>
              </div>
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="email"
                    className="input bg-gray-50"
                    style={{ paddingLeft: "2.5rem" }}
                    value={user?.email || ""}
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Contact admin to change email
                </p>
              </div>
              <PhoneInput
                phone={formData.phone}
                countryCode={formData.countryCode}
                onPhoneChange={(val) =>
                  setFormData((prev) => ({ ...prev, phone: val }))
                }
                onCountryCodeChange={(code) =>
                  setFormData((prev) => ({ ...prev, countryCode: code }))
                }
                label="Phone Number"
              />
              <div>
                <label className="label">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                  <textarea
                    name="address"
                    className="input min-h-[80px] resize-none"
                    style={{ paddingLeft: "2.5rem" }}
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your address"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Emergency Contacts
            </h3>
            {(() => {
              const contacts = profile?.employee?.emergencyContacts || [];
              if (contacts.length === 0) {
                return (
                  <p className="text-sm text-gray-500">
                    No emergency contacts on file. Please complete onboarding to add emergency contacts.
                  </p>
                );
              }
              return (
                <div className="space-y-3">
                  {contacts.map((contact, i) => (
                    <div key={contact.id || i} className="p-4 bg-gray-50 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{contact.name}</span>
                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                          {contact.relationship}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{contact.countryCode} {contact.phone}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {activeTab === "employment" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Employment Details
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Email</span>
                </div>
                <span className="font-medium text-gray-900">
                  {user?.email || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Role</span>
                </div>
                <span className="font-medium text-gray-900">
                  {user?.role || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Hire Date</span>
                </div>
                <span className="font-medium text-gray-900">
                  {employee?.hireDate
                    ? new Date(employee.hireDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Employee ID</span>
                </div>
                <span className="font-medium text-gray-900 text-sm">
                  {employee?.id || "N/A"}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assignment
            </h3>
            <div className="space-y-4">
              {activeClient ? (
                <div className="p-4 bg-primary-50 rounded-xl">
                  <p className="text-sm text-primary-600 font-medium">
                    Current Client
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {activeClient.companyName}
                  </p>
                  {activeClient.contactPerson && (
                    <p className="text-sm text-gray-500 mt-1">
                      Contact: {activeClient.contactPerson}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">
                    No active client assignment
                  </p>
                </div>
              )}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Account Created</p>
                <p className="font-medium text-gray-900 mt-1">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Last Login</p>
                <p className="font-medium text-gray-900 mt-1">
                  {user?.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "notifications" && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Notification Preferences
          </h3>
          <div className="space-y-4">
            {[
              {
                key: "scheduleChanges",
                label: "Email notifications for schedule changes",
                enabled: notifications.scheduleChanges,
              },
              {
                key: "shiftReminders",
                label: "SMS alerts for shift reminders",
                enabled: notifications.shiftReminders,
              },
              {
                key: "leaveApprovals",
                label: "Email notifications for leave approvals",
                enabled: notifications.leaveApprovals,
              },
              {
                key: "pushMessages",
                label: "Push notifications for messages",
                enabled: notifications.pushMessages,
              },
              {
                key: "weeklySummary",
                label: "Weekly summary email",
                enabled: notifications.weeklySummary,
              },
            ].map((pref) => (
              <div
                key={pref.key}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-700">{pref.label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={pref.enabled}
                    onChange={() => handleNotificationToggle(pref.key)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Change Password
            </h3>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700">
                  {passwordSuccess}
                </span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="password"
                    className="input"
                    style={{ paddingLeft: "2.5rem" }}
                    placeholder="Enter new password (min 8 characters)"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <input
                    type="password"
                    className="input"
                    style={{ paddingLeft: "2.5rem" }}
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={changingPassword}
              >
                {changingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Two-Factor Authentication
            </h3>
            <div className="p-4 bg-yellow-50 rounded-xl mb-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Not Enabled</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Add an extra layer of security to your account by enabling
                    two-factor authentication.
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full" disabled>
              Enable 2FA (Coming Soon)
            </Button>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">
                Account Activity
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last login</span>
                  <span className="text-gray-900">
                    {user?.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account status</span>
                  <Badge
                    variant={user?.status === "ACTIVE" ? "success" : "warning"}
                    size="sm"
                  >
                    {user?.status || "Unknown"}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Delete Photo Confirmation Modal */}
      {showDeletePhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowDeletePhotoModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Profile Photo
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to delete your profile photo? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeletePhotoModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePhotoDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
