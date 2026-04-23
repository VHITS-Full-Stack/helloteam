import { useState, useEffect, useRef } from "react";
import {
  Building2,
  Users,
  Bell,
  Shield,
  CreditCard,
  Save,
  Lock,
  Edit,
  Trash2,
  AlertTriangle,
  Eye,
  ChevronDown,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Modal,
  RefreshButton,
  AddButton,
} from "../../components/common";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../context/AuthContext";
import { PermissionGate } from "../../components/auth";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_CATEGORIES,
} from "../../config/permissions";
import rolesService from "../../services/roles.service";
import usersService from "../../services/users.service";
import settingsService from "../../services/settings.service";
import { formatDateTime } from "../../utils/formatDateTime";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("general");
  const { isSuperAdmin } = usePermissions();
  const { impersonate, user: currentUser } = useAuth();
  const [impersonatingUserId, setImpersonatingUserId] = useState(null);

  // Role management state
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState(null);
  const [, setAvailablePermissions] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    permissions: [],
  });

  // Admin user management state
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState(null);
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);
  const [isAdminUserModalOpen, setIsAdminUserModalOpen] = useState(false);
  const [isDeleteAdminUserModalOpen, setIsDeleteAdminUserModalOpen] =
    useState(false);
  const [adminUserToDelete, setAdminUserToDelete] = useState(null);
  const [savingAdminUser, setSavingAdminUser] = useState(false);
  const [adminUserFormData, setAdminUserFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    department: "",
    role: "ADMIN",
    roleId: "",
  });

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "users", label: "Admin Users", icon: Users },
    {
      id: "roles",
      label: "Roles & Permissions",
      icon: Lock,
      permission: PERMISSIONS.SETTINGS.ROLES_MANAGE,
    },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "cms", label: "Content (CMS)", icon: Edit },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter((tab) => {
    if (!tab.permission) return true;
    if (isSuperAdmin) return true;
    return false;
  });

  const fetchingRolesRef = useRef(false);
  const fetchingPermissionsRef = useRef(false);
  const fetchingAdminUsersRef = useRef(false);
  const fetchingGeneralRef = useRef(false);
  const fetchingNotificationsRef = useRef(false);
  const fetchingSecurityRef = useRef(false);

  // Fetch roles from database
  const fetchRoles = async () => {
    if (fetchingRolesRef.current) return;
    fetchingRolesRef.current = true;
    try {
      setLoadingRoles(true);
      setRolesError(null);
      const response = await rolesService.getRoles();
      if (response.length) {
        setRoles(response);
      } else {
        console.log(response);
        setRolesError(response.error || "Failed to load roles");
      }
    } catch (err) {
      setRolesError(err.error || "Failed to load roles");
    } finally {
      setLoadingRoles(false);
      fetchingRolesRef.current = false;
    }
  };

  // Fetch available permissions
  const fetchAvailablePermissions = async () => {
    if (fetchingPermissionsRef.current) return;
    fetchingPermissionsRef.current = true;
    try {
      const response = await rolesService.getAvailablePermissions();
      if (response.success) {
        setAvailablePermissions(response.data);
      }
    } catch (err) {
      console.error("Failed to load available permissions:", err);
    } finally {
      fetchingPermissionsRef.current = false;
    }
  };

  // Fetch roles when roles tab is active
  useEffect(() => {
    if (activeTab === "roles" && roles.length === 0) {
      fetchRoles();
      fetchAvailablePermissions();
    }
  }, [activeTab]);

  // Open modal to create new role
  const handleCreateRole = () => {
    setSelectedRole(null);
    setRoleFormData({
      name: "",
      displayName: "",
      description: "",
      permissions: [],
    });
    setIsRoleModalOpen(true);
  };

  // Open modal to edit role
  const handleEditRole = (role) => {
    setSelectedRole(role);
    setRoleFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || "",
      permissions: role.permissions || [],
    });
    setIsRoleModalOpen(true);
  };

  // Handle permission toggle
  const handlePermissionToggle = (permission) => {
    setRoleFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  // Toggle all permissions in a category
  const handleCategoryToggle = (categoryPermissions) => {
    const allSelected = categoryPermissions.every((p) =>
      roleFormData.permissions.includes(p),
    );
    if (allSelected) {
      setRoleFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter(
          (p) => !categoryPermissions.includes(p),
        ),
      }));
    } else {
      setRoleFormData((prev) => ({
        ...prev,
        permissions: [
          ...new Set([...prev.permissions, ...categoryPermissions]),
        ],
      }));
    }
  };

  // Save role
  const handleSaveRole = async () => {
    try {
      setSavingRole(true);
      let response;
      if (selectedRole) {
        response = await rolesService.updateRole(selectedRole.id, {
          displayName: roleFormData.displayName,
          description: roleFormData.description,
          permissions: roleFormData.permissions,
        });
      } else {
        response = await rolesService.createRole({
          name: roleFormData.name,
          displayName: roleFormData.displayName,
          description: roleFormData.description,
          permissions: roleFormData.permissions,
        });
      }

      if (response) {
        setIsRoleModalOpen(false);
        fetchRoles();
      } else {
        alert(response.error || "Failed to save role");
      }
    } catch (err) {
      alert(err.error || "Failed to save role");
    } finally {
      setSavingRole(false);
    }
  };

  // Delete role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      const response = await rolesService.deleteRole(roleToDelete.id);
      if (response.success) {
        setIsDeleteModalOpen(false);
        setRoleToDelete(null);
        fetchRoles();
      } else {
        alert(response.error || "Failed to delete role");
      }
    } catch (err) {
      alert(err.error || "Failed to delete role");
    }
  };

  // Fetch admin users from database
  const fetchAdminUsers = async () => {
    if (fetchingAdminUsersRef.current) return;
    fetchingAdminUsersRef.current = true;
    try {
      setLoadingAdminUsers(true);
      setAdminUsersError(null);
      const response = await usersService.getAdminUsers();
      if (response.success) {
        setAdminUsers(response.data.users);
      } else {
        setAdminUsersError(response.error || "Failed to load admin users");
      }
    } catch (err) {
      setAdminUsersError(err.message || "Failed to load admin users");
    } finally {
      setLoadingAdminUsers(false);
      fetchingAdminUsersRef.current = false;
    }
  };

  // Fetch admin users when users tab is active
  useEffect(() => {
    if (activeTab === "users" && adminUsers.length === 0) {
      fetchAdminUsers();
    }
  }, [activeTab]);

  // Open modal to create new admin user
  const handleCreateAdminUser = () => {
    setSelectedAdminUser(null);
    setAdminUserFormData({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      department: "",
      role: "ADMIN",
      roleId: "",
    });
    setIsAdminUserModalOpen(true);
  };

  // Open modal to edit admin user
  const handleEditAdminUser = (user) => {
    setSelectedAdminUser(user);
    setAdminUserFormData({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department || "",
      role: user.role,
      roleId: user.roleId || "",
    });
    setIsAdminUserModalOpen(true);
  };

  // Save admin user
  const handleSaveAdminUser = async () => {
    try {
      setSavingAdminUser(true);
      let response;
      if (selectedAdminUser) {
        const updateData = {
          firstName: adminUserFormData.firstName,
          lastName: adminUserFormData.lastName,
          department: adminUserFormData.department,
          role: adminUserFormData.role,
          roleId: adminUserFormData.roleId || null,
        };
        if (adminUserFormData.email !== selectedAdminUser.email) {
          updateData.email = adminUserFormData.email;
        }
        if (adminUserFormData.password) {
          updateData.password = adminUserFormData.password;
        }
        response = await usersService.updateAdminUser(
          selectedAdminUser.id,
          updateData,
        );
      } else {
        response = await usersService.createAdminUser({
          email: adminUserFormData.email,
          password: adminUserFormData.password,
          firstName: adminUserFormData.firstName,
          lastName: adminUserFormData.lastName,
          department: adminUserFormData.department,
          role: adminUserFormData.role,
          roleId: adminUserFormData.roleId || null,
        });
      }

      if (response.success) {
        setIsAdminUserModalOpen(false);
        fetchAdminUsers();
      } else {
        alert(response.error || "Failed to save admin user");
      }
    } catch (err) {
      alert(err.message || "Failed to save admin user");
    } finally {
      setSavingAdminUser(false);
    }
  };

  // Delete admin user
  const handleDeleteAdminUser = async () => {
    if (!adminUserToDelete) return;
    try {
      const response = await usersService.deleteAdminUser(adminUserToDelete.id);
      if (response.success) {
        setIsDeleteAdminUserModalOpen(false);
        setAdminUserToDelete(null);
        fetchAdminUsers();
      } else {
        alert(response.error || "Failed to delete admin user");
      }
    } catch (err) {
      alert(err.message || "Failed to delete admin user");
    }
  };

  // Impersonate admin user
  const handleImpersonateAdmin = async (adminUser) => {
    setImpersonatingUserId(adminUser.id);
    const result = await impersonate(adminUser.id);
    if (!result.success) {
      setAdminUsersError(result.error || "Failed to impersonate");
    }
    setImpersonatingUserId(null);
  };

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    companyName: "Hello Team",
    defaultTimezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    workWeekStart: "Sunday",
    overtimeThreshold: 40,
    payrollPeriod: "Bi-weekly",
  });
  const [loadingGeneralSettings, setLoadingGeneralSettings] = useState(false);
  const [savingGeneralSettings, setSavingGeneralSettings] = useState(false);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    newEmployeeRegistrations: true,
    newClientSignups: true,
    overtimeAlerts: true,
    missedClockOuts: true,
    payrollProcessingReminders: true,
    systemHealthAlerts: true,
    dailySummaryReports: false,
    weeklyAnalyticsDigest: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState({
    minPasswordLength: 8,
    requireSpecialChars: true,
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 30,
    enforce2FAForAdmins: true,
  });
  const [loadingSecuritySettings, setLoadingSecuritySettings] = useState(false);
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);

  // Fetch general settings
  const fetchGeneralSettings = async () => {
    if (fetchingGeneralRef.current) return;
    fetchingGeneralRef.current = true;
    try {
      setLoadingGeneralSettings(true);
      const response = await settingsService.getGeneralSettings();
      if (response.success) {
        setGeneralSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to load general settings:", err);
    } finally {
      setLoadingGeneralSettings(false);
      fetchingGeneralRef.current = false;
    }
  };

  // Save general settings
  const saveGeneralSettings = async () => {
    try {
      setSavingGeneralSettings(true);
      const response =
        await settingsService.updateGeneralSettings(generalSettings);
      if (response.success) {
        setGeneralSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to save general settings:", err);
    } finally {
      setSavingGeneralSettings(false);
    }
  };

  // Fetch notification settings
  const fetchNotificationSettings = async () => {
    if (fetchingNotificationsRef.current) return;
    fetchingNotificationsRef.current = true;
    try {
      setLoadingNotifications(true);
      const response = await settingsService.getNotificationSettings();
      if (response.success) {
        setNotificationSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to load notification settings:", err);
    } finally {
      setLoadingNotifications(false);
      fetchingNotificationsRef.current = false;
    }
  };

  // Save notification settings
  const saveNotificationSettings = async () => {
    try {
      setSavingNotifications(true);
      const response =
        await settingsService.updateNotificationSettings(notificationSettings);
      if (response.success) {
        setNotificationSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to save notification settings:", err);
    } finally {
      setSavingNotifications(false);
    }
  };

  // Fetch security settings
  const fetchSecuritySettings = async () => {
    if (fetchingSecurityRef.current) return;
    fetchingSecurityRef.current = true;
    try {
      setLoadingSecuritySettings(true);
      const response = await settingsService.getSecuritySettings();
      if (response.success) {
        setSecuritySettings(response.data);
      }
    } catch (err) {
      console.error("Failed to load security settings:", err);
    } finally {
      setLoadingSecuritySettings(false);
      fetchingSecurityRef.current = false;
    }
  };

  // Save security settings
  const saveSecuritySettings = async () => {
    try {
      setSavingSecuritySettings(true);
      const response =
        await settingsService.updateSecuritySettings(securitySettings);
      if (response.success) {
        setSecuritySettings(response.data);
      }
    } catch (err) {
      console.error("Failed to save security settings:", err);
    } finally {
      setSavingSecuritySettings(false);
    }
  };

  // CMS settings state
  const [cmsSettings, setCmsSettings] = useState({
    legalTerms: "",
    newHireGuide: "",
    privacyPolicy: "",
  });
  const [openCmsSection, setOpenCmsSection] = useState(null);
  const [loadingCmsSettings, setLoadingCmsSettings] = useState(false);
  const [savingCmsSettings, setSavingCmsSettings] = useState(false);
  const fetchingCmsRef = useRef(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [deletingPdf, setDeletingPdf] = useState(false);
  const pdfInputRef = useRef(null);

  const [welcomeTipsPdfFile, setWelcomeTipsPdfFile] = useState(null);
  const [uploadingWelcomeTipsPdf, setUploadingWelcomeTipsPdf] = useState(false);
  const [deletingWelcomeTipsPdf, setDeletingWelcomeTipsPdf] = useState(false);
  const welcomeTipsPdfInputRef = useRef(null);

  // Fetch CMS settings
  const fetchCmsSettings = async () => {
    if (fetchingCmsRef.current) return;
    fetchingCmsRef.current = true;
    try {
      setLoadingCmsSettings(true);
      const response = await settingsService.getCmsSettings();
      if (response.success) {
        setCmsSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to load CMS settings:", err);
    } finally {
      setLoadingCmsSettings(false);
      fetchingCmsRef.current = false;
    }
  };

  // Save CMS settings
  const saveCmsSettings = async () => {
    try {
      setSavingCmsSettings(true);
      const response = await settingsService.updateCmsSettings(cmsSettings);
      if (response.success) {
        setCmsSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to save CMS settings:", err);
    } finally {
      setSavingCmsSettings(false);
    }
  };

  // Upload new hire guide PDF
  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    try {
      setUploadingPdf(true);
      const response = await settingsService.uploadNewHireGuidePdf(pdfFile);
      if (response.success) {
        setCmsSettings(response.data);
        setPdfFile(null);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
      } else {
        alert(response.error || "Failed to upload PDF");
      }
    } catch (err) {
      alert(err.message || "Failed to upload PDF");
    } finally {
      setUploadingPdf(false);
    }
  };

  // Delete new hire guide PDF
  const handlePdfDelete = async () => {
    if (
      !window.confirm(
        "Remove the uploaded PDF? The HTML content will be shown instead.",
      )
    )
      return;
    try {
      setDeletingPdf(true);
      const response = await settingsService.deleteNewHireGuidePdf();
      if (response.success) {
        setCmsSettings((prev) => ({
          ...prev,
          newHireGuidePdfUrl: null,
          newHireGuidePdfKey: null,
          newHireGuidePdfName: null,
        }));
      } else {
        alert(response.error || "Failed to delete PDF");
      }
    } catch (err) {
      alert(err.message || "Failed to delete PDF");
    } finally {
      setDeletingPdf(false);
    }
  };

  // Upload welcome tips PDF
  const handleWelcomeTipsPdfUpload = async () => {
    if (!welcomeTipsPdfFile) return;
    try {
      setUploadingWelcomeTipsPdf(true);
      const response = await settingsService.uploadWelcomeTipsPdf(welcomeTipsPdfFile);
      if (response.success) {
        setCmsSettings(response.data);
        setWelcomeTipsPdfFile(null);
        if (welcomeTipsPdfInputRef.current) welcomeTipsPdfInputRef.current.value = "";
      } else {
        alert(response.error || "Failed to upload PDF");
      }
    } catch (err) {
      alert(err.message || "Failed to upload PDF");
    } finally {
      setUploadingWelcomeTipsPdf(false);
    }
  };

  // Delete welcome tips PDF
  const handleWelcomeTipsPdfDelete = async () => {
    if (!window.confirm("Remove the Welcome Tips PDF?")) return;
    try {
      setDeletingWelcomeTipsPdf(true);
      const response = await settingsService.deleteWelcomeTipsPdf();
      if (response.success) {
        setCmsSettings((prev) => ({
          ...prev,
          welcomeTipsPdfUrl: null,
          welcomeTipsPdfKey: null,
          welcomeTipsPdfName: null,
        }));
      } else {
        alert(response.error || "Failed to delete PDF");
      }
    } catch (err) {
      alert(err.message || "Failed to delete PDF");
    } finally {
      setDeletingWelcomeTipsPdf(false);
    }
  };

  // Fetch settings when tab is active
  useEffect(() => {
    if (activeTab === "general") {
      fetchGeneralSettings();
    } else if (activeTab === "notifications") {
      fetchNotificationSettings();
    } else if (activeTab === "security") {
      fetchSecuritySettings();
    } else if (activeTab === "cms") {
      fetchCmsSettings();
    }
  }, [activeTab]);

  // Notification setting labels
  const notificationLabels = {
    newEmployeeRegistrations: "New employee registrations",
    newClientSignups: "New client signups",
    overtimeAlerts: "Overtime alerts",
    missedClockOuts: "Missed clock-outs",
    payrollProcessingReminders: "Payroll processing reminders",
    systemHealthAlerts: "System health alerts",
    dailySummaryReports: "Daily summary reports",
    weeklyAnalyticsDigest: "Weekly analytics digest",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <style>{`
        .ck-editor-container .ck-editor__editable_inline {
          min-height: 250px;
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500">
            Manage system configuration and preferences
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <Card padding="sm">
            <nav className="space-y-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors
                    ${
                      activeTab === tab.id
                        ? "bg-primary-50 text-primary font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "general" && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    General Settings
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure system-wide settings
                  </p>
                </div>
                {isSuperAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Save}
                    onClick={saveGeneralSettings}
                    disabled={savingGeneralSettings}
                  >
                    {savingGeneralSettings ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
              {loadingGeneralSettings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="ml-3 text-gray-500">
                    Loading settings...
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label">Company Name</label>
                    <input
                      type="text"
                      className={`input ${!isSuperAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                      value={generalSettings.companyName}
                      disabled={!isSuperAdmin}
                      onChange={(e) =>
                        setGeneralSettings((prev) => ({
                          ...prev,
                          companyName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <div className="input flex items-center text-gray-700">
                      Eastern Time (EST)
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      All time tracking and reporting uses Eastern Standard Time
                      (EST)
                    </p>
                  </div>
                  <div>
                    <label className="label">Payroll Periods</label>
                    <div className="relative">
                      <select
                        className={`input appearance-none pr-9 ${!isSuperAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                        value={generalSettings.payrollPeriod}
                        disabled={!isSuperAdmin}
                        onChange={(e) =>
                          setGeneralSettings((prev) => ({
                            ...prev,
                            payrollPeriod: e.target.value,
                          }))
                        }
                      >
                        <option value="Bi-weekly">
                          Bi-weekly (1st-15th, 16th-End)
                        </option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {activeTab === "users" && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Admin Users
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage system administrators and their access
                  </p>
                </div>
                <div className="flex gap-2">
                  <RefreshButton onClick={fetchAdminUsers} />
                  {isSuperAdmin && (
                    <AddButton onClick={handleCreateAdminUser}>
                      Add Admin
                    </AddButton>
                  )}
                </div>
              </div>

              {loadingAdminUsers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="ml-3 text-gray-500">
                    Loading admin users...
                  </span>
                </div>
              ) : adminUsersError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                  {adminUsersError}
                </div>
              ) : adminUsers.length > 0 ? (
                <div className="space-y-3">
                  {adminUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="font-semibold text-primary">
                            {user.firstName?.charAt(0) ||
                              user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          {user.department && (
                            <p className="text-xs text-gray-400">
                              {user.department}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Badge
                              variant={
                                user.role === "SUPER_ADMIN"
                                  ? "primary"
                                  : "default"
                              }
                            >
                              {user.role.replace("_", " ")}
                            </Badge>
                            <Badge
                              variant={
                                user.status === "ACTIVE" ? "success" : "warning"
                              }
                              size="sm"
                            >
                              {user.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Last login:{" "}
                            {formatDateTime(user.lastLoginAt, {
                              emptyValue: "Never",
                              includeYear: true,
                            })}
                          </p>
                        </div>
                        {isSuperAdmin && (
                          <div className="flex items-center gap-1">
                            {user.role !== "SUPER_ADMIN" &&
                              user.status === "ACTIVE" &&
                              user.id !== currentUser?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={Eye}
                                  className="text-blue-600 hover:bg-blue-50"
                                  onClick={() => handleImpersonateAdmin(user)}
                                  loading={impersonatingUserId === user.id}
                                >
                                  Impersonate
                                </Button>
                              )}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit}
                              onClick={() => handleEditAdminUser(user)}
                            >
                              Edit
                            </Button>
                            {user.role !== "SUPER_ADMIN" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Trash2}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setAdminUserToDelete(user);
                                  setIsDeleteAdminUserModalOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No admin users found.
                </div>
              )}
            </Card>
          )}

          {activeTab === "roles" && (
            <div className="space-y-6">
              {/* Role Management */}
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Role Management
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Create and manage roles with custom permissions
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <RefreshButton onClick={fetchRoles} />
                    <AddButton onClick={handleCreateRole}>
                      Create Role
                    </AddButton>
                  </div>
                </div>

                {loadingRoles ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <span className="ml-3 text-gray-500">Loading roles...</span>
                  </div>
                ) : rolesError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                    {rolesError}
                  </div>
                ) : roles.length > 0 ? (
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">
                                {role.displayName}
                              </p>
                              {role.isSystem && (
                                <Badge variant="default" size="sm">
                                  System
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {role.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {role.permissions?.length || 0} permissions •{" "}
                              {role.userCount || 0} users
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            onClick={() => handleEditRole(role)}
                          >
                            Edit
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setRoleToDelete(role);
                                setIsDeleteModalOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No roles found. Create your first role to get started.
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Role Edit/Create Modal */}
          {isRoleModalOpen && (
            <Modal
              isOpen={isRoleModalOpen}
              onClose={() => setIsRoleModalOpen(false)}
              title={
                selectedRole
                  ? `Edit Role: ${selectedRole.displayName}`
                  : "Create New Role"
              }
              size="xl"
            >
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!selectedRole && (
                    <div>
                      <label className="label">Role Name (identifier)</label>
                      <input
                        type="text"
                        className="input"
                        value={roleFormData.name}
                        onChange={(e) =>
                          setRoleFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., MANAGER"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        This will be converted to uppercase
                      </p>
                    </div>
                  )}
                  <div className={selectedRole ? "md:col-span-2" : ""}>
                    <label className="label">Display Name</label>
                    <input
                      type="text"
                      className="input"
                      value={roleFormData.displayName}
                      onChange={(e) =>
                        setRoleFormData((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      placeholder="e.g., Manager"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={roleFormData.description}
                    onChange={(e) =>
                      setRoleFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of this role's responsibilities"
                  />
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="label mb-0">Permissions</label>
                    <span className="text-sm text-gray-500">
                      {roleFormData.permissions.length} selected
                    </span>
                  </div>
                  <div className="border rounded-xl max-h-96 overflow-y-auto">
                    {Object.entries(PERMISSION_CATEGORIES).map(
                      ([category, permissions]) => {
                        const allSelected = permissions.every((p) =>
                          roleFormData.permissions.includes(p),
                        );
                        const someSelected = permissions.some((p) =>
                          roleFormData.permissions.includes(p),
                        );
                        return (
                          <div
                            key={category}
                            className="border-b last:border-b-0"
                          >
                            <div
                              className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                              onClick={() => handleCategoryToggle(permissions)}
                            >
                              <span className="font-medium text-gray-700">
                                {category}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {
                                    permissions.filter((p) =>
                                      roleFormData.permissions.includes(p),
                                    ).length
                                  }
                                  /{permissions.length}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) =>
                                    el &&
                                    (el.indeterminate =
                                      someSelected && !allSelected)
                                  }
                                  onChange={() =>
                                    handleCategoryToggle(permissions)
                                  }
                                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                />
                              </div>
                            </div>
                            <div className="p-3 space-y-2">
                              {permissions.map((permission) => (
                                <label
                                  key={permission}
                                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                                >
                                  <input
                                    type="checkbox"
                                    checked={roleFormData.permissions.includes(
                                      permission,
                                    )}
                                    onChange={() =>
                                      handlePermissionToggle(permission)
                                    }
                                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {PERMISSION_LABELS[permission] ||
                                      permission}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsRoleModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveRole}
                    disabled={
                      savingRole ||
                      (!selectedRole && !roleFormData.name) ||
                      !roleFormData.displayName
                    }
                  >
                    {savingRole
                      ? "Saving..."
                      : selectedRole
                        ? "Update Role"
                        : "Create Role"}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Delete Confirmation Modal */}
          {isDeleteModalOpen && roleToDelete && (
            <Modal
              isOpen={isDeleteModalOpen}
              onClose={() => {
                setIsDeleteModalOpen(false);
                setRoleToDelete(null);
              }}
              title="Delete Role"
              size="sm"
            >
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete "{roleToDelete.displayName}"?
                </h3>
                <p className="text-gray-500 mb-6">
                  This action cannot be undone. Users assigned to this role will
                  need to be reassigned.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setRoleToDelete(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteRole}
                  >
                    Delete Role
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Admin User Create/Edit Modal */}
          {isAdminUserModalOpen && (
            <Modal
              isOpen={isAdminUserModalOpen}
              onClose={() => setIsAdminUserModalOpen(false)}
              title={
                selectedAdminUser
                  ? `Edit Admin: ${selectedAdminUser.firstName} ${selectedAdminUser.lastName}`
                  : "Add New Admin"
              }
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={adminUserFormData.firstName}
                      onChange={(e) =>
                        setAdminUserFormData((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="label">Last Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={adminUserFormData.lastName}
                      onChange={(e) =>
                        setAdminUserFormData((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    className="input"
                    value={adminUserFormData.email}
                    onChange={(e) =>
                      setAdminUserFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="john.doe@helloteam.com"
                  />
                </div>

                <div>
                  <label className="label">
                    {selectedAdminUser
                      ? "New Password (leave blank to keep current)"
                      : "Password *"}
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={adminUserFormData.password}
                    onChange={(e) =>
                      setAdminUserFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder={
                      selectedAdminUser ? "••••••••" : "Enter password"
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Role *</label>
                    <div className="relative">
                      <select
                        className="input appearance-none pr-9"
                        value={adminUserFormData.role}
                        onChange={(e) =>
                          setAdminUserFormData((prev) => ({
                            ...prev,
                            role: e.target.value,
                          }))
                        }
                      >
                        <option value="SUPER_ADMIN">Super Admin</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OPERATIONS">Operations</option>
                        <option value="HR">HR</option>
                        <option value="FINANCE">Finance</option>
                        <option value="SUPPORT">Support</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Department</label>
                    <input
                      type="text"
                      className="input"
                      value={adminUserFormData.department}
                      onChange={(e) =>
                        setAdminUserFormData((prev) => ({
                          ...prev,
                          department: e.target.value,
                        }))
                      }
                      placeholder="e.g., IT, Human Resources"
                    />
                  </div>
                </div>

                {roles.length > 0 && (
                  <div>
                    <label className="label">Dynamic Role (Optional)</label>
                    <div className="relative">
                      <select
                        className="input appearance-none pr-9"
                        value={adminUserFormData.roleId}
                        onChange={(e) =>
                          setAdminUserFormData((prev) => ({
                            ...prev,
                            roleId: e.target.value,
                          }))
                        }
                      >
                        <option value="">-- Select Dynamic Role --</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.displayName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Dynamic roles provide granular permissions beyond the base
                      role
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsAdminUserModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveAdminUser}
                    disabled={
                      savingAdminUser ||
                      !adminUserFormData.firstName ||
                      !adminUserFormData.lastName ||
                      !adminUserFormData.email ||
                      (!selectedAdminUser && !adminUserFormData.password)
                    }
                  >
                    {savingAdminUser
                      ? "Saving..."
                      : selectedAdminUser
                        ? "Update Admin"
                        : "Create Admin"}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Delete Admin User Confirmation Modal */}
          {isDeleteAdminUserModalOpen && adminUserToDelete && (
            <Modal
              isOpen={isDeleteAdminUserModalOpen}
              onClose={() => {
                setIsDeleteAdminUserModalOpen(false);
                setAdminUserToDelete(null);
              }}
              title="Delete Admin User"
              size="sm"
            >
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete "{adminUserToDelete.firstName}{" "}
                  {adminUserToDelete.lastName}"?
                </h3>
                <p className="text-gray-500 mb-6">
                  This will deactivate the admin user account. They will no
                  longer be able to access the system.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteAdminUserModalOpen(false);
                      setAdminUserToDelete(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteAdminUser}
                  >
                    Delete Admin
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {activeTab === "notifications" && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    System Notifications
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure which notifications to receive
                  </p>
                </div>
                {isSuperAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Save}
                    onClick={saveNotificationSettings}
                    disabled={savingNotifications}
                  >
                    {savingNotifications ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
              {loadingNotifications ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="ml-3 text-gray-500">
                    Loading settings...
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(notificationSettings).map(
                    ([key, enabled]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-700">
                            {notificationLabels[key] || key}
                          </span>
                        </div>
                        <label
                          className={`relative inline-flex items-center ${isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enabled}
                            disabled={!isSuperAdmin}
                            onChange={(e) =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                        </label>
                      </div>
                    ),
                  )}
                </div>
              )}
            </Card>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              {loadingSecuritySettings ? (
                <Card>
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <span className="ml-3 text-gray-500">
                      Loading security settings...
                    </span>
                  </div>
                </Card>
              ) : (
                <>
                  <Card>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Password Policy
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Configure password requirements
                        </p>
                      </div>
                      {isSuperAdmin && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Save}
                          onClick={saveSecuritySettings}
                          disabled={savingSecuritySettings}
                        >
                          {savingSecuritySettings
                            ? "Saving..."
                            : "Save Changes"}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-700">
                          Minimum password length
                        </span>
                        <div className="relative">
                          <select
                            className={`input w-32 appearance-none pr-9 text-center ${!isSuperAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                            value={securitySettings.minPasswordLength}
                            disabled={!isSuperAdmin}
                            onChange={(e) =>
                              setSecuritySettings((prev) => ({
                                ...prev,
                                minPasswordLength: parseInt(e.target.value),
                              }))
                            }
                          >
                            <option value={8}>8</option>
                            <option value={10}>10</option>
                            <option value={12}>12</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-700">
                          Require special characters
                        </span>
                        <label
                          className={`relative inline-flex items-center ${isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={securitySettings.requireSpecialChars}
                            disabled={!isSuperAdmin}
                            onChange={(e) =>
                              setSecuritySettings((prev) => ({
                                ...prev,
                                requireSpecialChars: e.target.checked,
                              }))
                            }
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                        </label>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-700">
                          Password expiry (days)
                        </span>
                        <div className="relative">
                          <select
                            className={`input w-32 appearance-none pr-9 text-center ${!isSuperAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                            value={securitySettings.passwordExpiryDays}
                            disabled={!isSuperAdmin}
                            onChange={(e) =>
                              setSecuritySettings((prev) => ({
                                ...prev,
                                passwordExpiryDays: parseInt(e.target.value),
                              }))
                            }
                          >
                            <option value={30}>30</option>
                            <option value={60}>60</option>
                            <option value={90}>90</option>
                            <option value={0}>Never</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">
                      Session Settings
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-700">
                          Session timeout (minutes)
                        </span>
                        <div className="relative">
                          <select
                            className={`input w-32 appearance-none pr-9 text-center ${!isSuperAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                            value={securitySettings.sessionTimeoutMinutes}
                            disabled={!isSuperAdmin}
                            onChange={(e) =>
                              setSecuritySettings((prev) => ({
                                ...prev,
                                sessionTimeoutMinutes: parseInt(e.target.value),
                              }))
                            }
                          >
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={60}>60</option>
                            <option value={120}>120</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-700">
                          Enforce 2FA for admins
                        </span>
                        <label
                          className={`relative inline-flex items-center ${isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={securitySettings.enforce2FAForAdmins}
                            disabled={!isSuperAdmin}
                            onChange={(e) =>
                              setSecuritySettings((prev) => ({
                                ...prev,
                                enforce2FAForAdmins: e.target.checked,
                              }))
                            }
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                        </label>
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {activeTab === "cms" && (
            <div className="space-y-6">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Content Management
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Manage onboarding content shown to clients
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Save}
                      onClick={saveCmsSettings}
                      disabled={savingCmsSettings}
                    >
                      {savingCmsSettings ? "Saving..." : "Save Changes"}
                    </Button>
                  )}
                </div>
                {loadingCmsSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <span className="ml-3 text-gray-500">Loading content...</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {/* Legal Terms & Conditions */}
                    <div>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setOpenCmsSection(openCmsSection === 'legalTerms' ? null : 'legalTerms')}
                      >
                        <span className="font-medium text-gray-900">Legal Terms &amp; Conditions</span>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openCmsSection === 'legalTerms' ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openCmsSection === 'legalTerms' && (
                        <div className="px-5 pb-5">
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white ck-editor-container">
                            <CKEditor
                              editor={ClassicEditor}
                              data={cmsSettings.legalTerms || ""}
                              onChange={(event, editor) => {
                                const data = editor.getData();
                                setCmsSettings((prev) => ({ ...prev, legalTerms: data }));
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* New Hire Guide */}
                    <div>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setOpenCmsSection(openCmsSection === 'newHireGuide' ? null : 'newHireGuide')}
                      >
                        <span className="font-medium text-gray-900">New Hire Guide</span>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openCmsSection === 'newHireGuide' ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openCmsSection === 'newHireGuide' && (
                        <div className="px-5 pb-5 space-y-4">
                          <p className="text-sm text-gray-500">
                            Upload a PDF to display on the New Hire Guide step. If a PDF is uploaded it takes priority; otherwise the HTML content is shown.
                          </p>

                          {cmsSettings.newHireGuidePdfName ? (
                            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{cmsSettings.newHireGuidePdfName}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Currently active PDF</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {cmsSettings.newHireGuidePdfUrl && (
                                  <a href={cmsSettings.newHireGuidePdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline font-medium">
                                    Preview
                                  </a>
                                )}
                                {isSuperAdmin && (
                                  <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handlePdfDelete} loading={deletingPdf}>
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-sm text-gray-400">
                              No PDF uploaded — HTML content will be shown to clients
                            </div>
                          )}

                          {isSuperAdmin && (
                            <div className="flex items-center gap-3">
                              <input
                                ref={pdfInputRef}
                                type="file"
                                accept="application/pdf"
                                className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary hover:file:bg-primary-100 cursor-pointer"
                                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                              />
                              <Button variant="primary" size="sm" onClick={handlePdfUpload} disabled={!pdfFile || uploadingPdf} loading={uploadingPdf}>
                                {uploadingPdf ? "Uploading..." : "Upload PDF"}
                              </Button>
                            </div>
                          )}

                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white ck-editor-container">
                            <CKEditor
                              editor={ClassicEditor}
                              data={cmsSettings.newHireGuide || ""}
                              onChange={(event, editor) => {
                                const data = editor.getData();
                                setCmsSettings((prev) => ({ ...prev, newHireGuide: data }));
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Employee Access and Offboarding Policy */}
                    <div>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setOpenCmsSection(openCmsSection === 'privacyPolicy' ? null : 'privacyPolicy')}
                      >
                        <span className="font-medium text-gray-900">Employee Access and Offboarding Policy</span>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openCmsSection === 'privacyPolicy' ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openCmsSection === 'privacyPolicy' && (
                        <div className="px-5 pb-5">
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white ck-editor-container">
                            <CKEditor
                              editor={ClassicEditor}
                              data={cmsSettings.privacyPolicy || ""}
                              onChange={(event, editor) => {
                                const data = editor.getData();
                                setCmsSettings((prev) => ({ ...prev, privacyPolicy: data }));
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Welcome Tips */}
                    <div>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setOpenCmsSection(openCmsSection === 'welcomeTips' ? null : 'welcomeTips')}
                      >
                        <span className="font-medium text-gray-900">Welcome Tips</span>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openCmsSection === 'welcomeTips' ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openCmsSection === 'welcomeTips' && (
                        <div className="px-5 pb-5 space-y-4">
                          <p className="text-sm text-gray-500">
                            Upload a PDF to display on the Best Practices step of client onboarding.
                          </p>

                          {cmsSettings.welcomeTipsPdfName ? (
                            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{cmsSettings.welcomeTipsPdfName}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Currently active PDF</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {cmsSettings.welcomeTipsPdfUrl && (
                                  <a href={cmsSettings.welcomeTipsPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline font-medium">
                                    Preview
                                  </a>
                                )}
                                {isSuperAdmin && (
                                  <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleWelcomeTipsPdfDelete} loading={deletingWelcomeTipsPdf}>
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-sm text-gray-400">
                              No PDF uploaded — hardcoded Best Practices content will be shown
                            </div>
                          )}

                          {isSuperAdmin && (
                            <div className="flex items-center gap-3">
                              <input
                                ref={welcomeTipsPdfInputRef}
                                type="file"
                                accept="application/pdf"
                                className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary hover:file:bg-primary-100 cursor-pointer"
                                onChange={(e) => setWelcomeTipsPdfFile(e.target.files?.[0] || null)}
                              />
                              <Button variant="primary" size="sm" onClick={handleWelcomeTipsPdfUpload} disabled={!welcomeTipsPdfFile || uploadingWelcomeTipsPdf} loading={uploadingWelcomeTipsPdf}>
                                {uploadingWelcomeTipsPdf ? "Uploading..." : "Upload PDF"}
                              </Button>
                            </div>
                          )}

                          {/* CKEditor for Welcome Tips text */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-500 mb-2">
                              Add text content to display with the Welcome Tips PDF (optional)
                            </p>
                            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white ck-editor-container">
                              <CKEditor
                                editor={ClassicEditor}
                                data={cmsSettings.welcomeTips || ""}
                                onChange={(event, editor) => {
                                  const data = editor.getData();
                                  setCmsSettings((prev) => ({ ...prev, welcomeTips: data }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
