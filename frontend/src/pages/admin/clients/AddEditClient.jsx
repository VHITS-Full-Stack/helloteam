import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Search,
  Settings,
  Sun,
  ChevronDown,
} from "lucide-react";
import { Card, Button, Input, PhoneInput, Modal } from "../../../components/common";
import { useClientForm } from "../../../hooks/useClientForm";
import { getFederalHolidaysForYear } from "../../../utils/holidayCalculator";
import groupService from "../../../services/group.service";

const DEFAULT_PTO = {
  allowPaidLeave: false,
  paidLeaveType: 'fixed',
  annualPaidLeaveDays: 0,
  requireTwoWeeksNoticePaidLeave: true,
  allowUnpaidLeave: false,
  requireTwoWeeksNoticeUnpaidLeave: true,
  allowPaidHolidays: false,
  paidHolidayType: 'federal',
  numberOfPaidHolidays: 0,
  selectedFederalHolidays: [],
  customHolidays: [],
  allowUnpaidHolidays: false,
};

const AddClient = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    formData,
    setFormData,
    groups,
    setGroups,
    employees,
    isEdit,
    loading,
    error,
    setError,
    fieldErrors,
    submitting,
    handleSubmit,
    addContact,
    removeContact,
    updateContact,
  } = useClientForm({ id, onSuccess: () => navigate("/admin/clients") });

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [ptoModalEmployee, setPtoModalEmployee] = useState(null);

  // Add Group modal state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', billingRate: '' });
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupError, setGroupError] = useState('');

  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
      setGroupError('Group name is required');
      return;
    }
    setGroupSubmitting(true);
    setGroupError('');
    try {
      const response = await groupService.createGroup(groupForm);
      if (response.success) {
        const newGroup = response.data;
        setGroups(prev => [...prev, newGroup]);
        setFormData(prev => ({ ...prev, groupId: newGroup.id }));
        setShowGroupModal(false);
        setGroupForm({ name: '', description: '', billingRate: '' });
      } else {
        setGroupError(response.error || 'Failed to create group');
      }
    } catch (err) {
      setGroupError(err.error || err.message || 'Failed to create group');
    } finally {
      setGroupSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const federalHolidaysList = getFederalHolidaysForYear(currentYear);

  // Get current holiday config from form to apply to employees
  const getHolidayDefaults = (fd) => ({
    allowPaidHolidays: fd.allowPaidHolidays,
    paidHolidayType: fd.paidHolidayType,
    numberOfPaidHolidays: fd.numberOfPaidHolidays,
    selectedFederalHolidays: fd.selectedFederalHolidays || [],
    customHolidays: fd.customHolidays.map((h) => ({ ...h })),
    allowUnpaidHolidays: fd.allowUnpaidHolidays,
  });

  // Sync holiday config changes to all employee assignments
  const syncHolidayToEmployees = (updates) => {
    setFormData((prev) => {
      const merged = { ...prev, ...updates };
      const holidayFields = getHolidayDefaults(merged);
      return {
        ...merged,
        employeeAssignments: prev.employeeAssignments.map((a) => ({
          ...a,
          ...holidayFields,
          customHolidays: holidayFields.customHolidays.map((h) => ({ ...h })),
        })),
      };
    });
  };

  const toggleEmployee = (emp) => {
    setFormData((prev) => {
      const exists = prev.employeeAssignments.some(
        (a) => a.employeeId === emp.id,
      );
      return {
        ...prev,
        employeeAssignments: exists
          ? prev.employeeAssignments.filter((a) => a.employeeId !== emp.id)
          : [
              ...prev.employeeAssignments,
              { employeeId: emp.id, ...DEFAULT_PTO, ...getHolidayDefaults(prev) },
            ],
      };
    });
  };

  const removeEmployee = (empId) => {
    setFormData((prev) => ({
      ...prev,
      employeeAssignments: prev.employeeAssignments.filter(
        (a) => a.employeeId !== empId,
      ),
    }));
  };

  const updateEmployeeField = (empId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      employeeAssignments: prev.employeeAssignments.map((a) =>
        a.employeeId === empId ? { ...a, [field]: value } : a,
      ),
    }));
  };

  // Only show unassigned employees (no active client assignment)
  const availableEmployees = employees.filter(
    (emp) => !emp.clientAssignments?.[0]?.client,
  );

  // Show filtered results when searching, or all available employees (max 10) when focused
  const searchResults = (() => {
    if (employeeSearch.trim()) {
      const q = employeeSearch.toLowerCase();
      return availableEmployees
        .filter(
          (emp) =>
            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
            (emp.user?.email || "").toLowerCase().includes(q),
        )
        .slice(0, 10);
    }
    return availableEmployees.slice(0, 10);
  })();

  // Get full employee objects for selected IDs (for displaying cards)
  const selectedEmployeeIds = formData.employeeAssignments.map(
    (a) => a.employeeId,
  );
  const selectedEmployees = employees.filter((emp) =>
    selectedEmployeeIds.includes(emp.id),
  );

  // PTO modal helpers
  const ptoModalEmp = ptoModalEmployee
    ? employees.find((e) => e.id === ptoModalEmployee)
    : null;
  const ptoModalAssignment = ptoModalEmployee
    ? formData.employeeAssignments.find((a) => a.employeeId === ptoModalEmployee)
    : null;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-gray-500">Loading client...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/admin/clients")}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? "Edit Client" : "Add New Client"}
          </h2>
          <p className="text-xs text-gray-500">
            {isEdit
              ? "Update client account details"
              : "Create a new client account"}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <Card padding="md">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Company Information
            </h3>
            <div className="space-y-4">
              <div>
                <Input
                  label="Company Name"
                  placeholder="Enter company name"
                  value={formData.companyName}
                  onChange={(e) => {
                    if (e.target.value.length <= 50)
                      setFormData({ ...formData, companyName: e.target.value });
                  }}
                  required
                  maxLength={50}
                />
                {fieldErrors.companyName && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.companyName}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PhoneInput
                  phone={formData.phone}
                  countryCode={formData.countryCode}
                  onPhoneChange={(val) => setFormData({ ...formData, phone: val })}
                  onCountryCodeChange={(code) => setFormData({ ...formData, countryCode: code })}
                />
                {/* <div>
                  <Input
                    label="Address"
                    placeholder="Company address"
                    value={formData.address}
                    onChange={(e) => {
                      if (e.target.value.length <= 100)
                        setFormData({ ...formData, address: e.target.value });
                    }}
                    maxLength={100}
                  />
                  {fieldErrors.address && (
                    <p className="text-xs text-red-500 mt-1">
                      {fieldErrors.address}
                    </p>
                  )}
                </div> */}
              </div>
            </div>
          </div>

          {/* Contact Persons */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Contact Persons{" "}
              </h3>
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Contact
              </button>
            </div>
            <div className="space-y-3">
              {formData.contacts.map((contact, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      {index === 0 ? "Primary Contact" : `Contact ${index + 1}`}{" "}
                      <span className="text-red-500">*</span>
                    </span>
                    {formData.contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Full name *"
                      value={contact.name}
                      onChange={(e) =>
                        updateContact(index, "name", e.target.value)
                      }
                      required={index === 0}
                    />
                    <Input
                      placeholder="Position / Title"
                      value={contact.position}
                      onChange={(e) =>
                        updateContact(index, "position", e.target.value)
                      }
                    />
                    <PhoneInput
                      phone={contact.phone}
                      countryCode={contact.countryCode || '+1'}
                      onPhoneChange={(val) => updateContact(index, "phone", val)}
                      onCountryCodeChange={(code) => updateContact(index, "countryCode", code)}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={contact.email}
                      onChange={(e) =>
                        updateContact(index, "email", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Account Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Email"
                  type="email"
                  placeholder="Contact email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              {isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <div className="relative">
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 cursor-not-allowed opacity-60 appearance-none pr-9"
                    value={formData.timezone}
                    disabled
                  >
                    <option value="America/New_York">Eastern Time</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Assign Group {isEdit ? "" : "(Optional)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(true)}
                    className="p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                    title="Add new group"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative">
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                    value={formData.groupId}
                    onChange={(e) =>
                      setFormData({ ...formData, groupId: e.target.value })
                    }
                  >
                    <option value="">
                      {isEdit ? "No group" : "Select a group"}
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  All employees in the selected group will be assigned to this
                  client
                </p>
              </div>
              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agreement Type
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                      value={formData.agreementType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          agreementType: e.target.value,
                        })
                      }
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="BI_WEEKLY">Bi-Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Client must sign this agreement before accessing the portal
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Assign Employees (create mode only) */}
          {!isEdit && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Assign Employees <span className="text-red-500">*</span>
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Search and select employees to assign to this client
              </p>
              {fieldErrors.employees && (
                <p className="text-xs text-red-500 mb-2">
                  {fieldErrors.employees}
                </p>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type to search employees..."
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setShowEmployeeDropdown(true);
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowEmployeeDropdown(false), 200)
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                />

                {/* Dropdown results */}
                {showEmployeeDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[240px] overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No employees found
                      </p>
                    ) : (
                      <>
                        {searchResults.map((emp) => {
                          const isSelected = formData.employeeAssignments.some(
                            (a) => a.employeeId === emp.id,
                          );
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                toggleEmployee(emp);
                                setEmployeeSearch("");
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${isSelected ? "bg-primary-50/50" : ""}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {emp.firstName} {emp.lastName}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {emp.user?.email}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="text-xs text-primary-600 font-medium">
                                  Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {!employeeSearch.trim() &&
                          availableEmployees.length > 10 && (
                            <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-100">
                              Showing 10 of {availableEmployees.length}{" "}
                              available — type to search more
                            </p>
                          )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Selected employees */}
              {selectedEmployees.length > 0 && (
                <div className="space-y-2 mt-3">
                  {selectedEmployees.map((emp) => {
                    const assignment = formData.employeeAssignments.find(
                      (a) => a.employeeId === emp.id,
                    );
                    if (!assignment) return null;
                    const enabledPolicies = [
                      assignment.allowPaidLeave && 'Paid Leave',
                      assignment.allowUnpaidLeave && 'Unpaid Leave',
                      assignment.allowPaidHolidays && 'Paid Holidays',
                      assignment.allowUnpaidHolidays && 'Unpaid Holidays',
                    ].filter(Boolean);
                    return (
                      <div key={emp.id} className="p-3 border border-gray-200 rounded-xl bg-white">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-xs text-gray-400">{emp.user?.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-3">
                            <button
                              type="button"
                              onClick={() => setPtoModalEmployee(emp.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              PTO Config
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEmployee(emp.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1.5"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {enabledPolicies.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {enabledPolicies.map((label) => (
                              <span key={label} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        {enabledPolicies.length === 0 && (
                          <p className="text-[11px] text-gray-400 mt-1.5">No PTO configured</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Policy Configuration — only overtime & auto-approve (client-level) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Policy Configuration
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Overtime</label>
                <input type="checkbox" checked={formData.allowOvertime} onChange={(e) => setFormData({ ...formData, allowOvertime: e.target.checked })} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              </div>
              {formData.allowOvertime && (
                <div className="flex items-center justify-between pl-4">
                  <label className="text-sm text-gray-700">Overtime Requires Approval</label>
                  <input type="checkbox" checked={formData.overtimeRequiresApproval} onChange={(e) => setFormData({ ...formData, overtimeRequiresApproval: e.target.checked })} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-700">
                    Auto-Approve Timesheets
                  </label>
                  <p className="text-xs text-gray-400">
                    Auto-approve scheduled timesheets after 24 hours (overtime
                    timesheets are never auto-approved)
                  </p>
                </div>
                <input type="checkbox" checked={formData.autoApproveTimesheets} onChange={(e) => setFormData({ ...formData, autoApproveTimesheets: e.target.checked })} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              </div>
              {formData.autoApproveTimesheets && (
                <div className="pl-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto-Approve After (hours)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={Math.round(formData.autoApproveMinutes / 60) || 24}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          autoApproveMinutes:
                            (parseInt(e.target.value) || 24) * 60,
                        })
                      }
                      className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <span className="text-sm text-gray-500">hours</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Default: 24 hours
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Holiday Configuration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              Holiday Configuration
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Applies to all assigned employees. Use per-employee PTO Config to override individually.
            </p>
            <div className="space-y-3">
              {/* Paid Holidays */}
              <div className={`p-3.5 rounded-xl border ${formData.allowPaidHolidays ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-gray-900">Paid Holidays</span>
                  <input
                    type="checkbox"
                    checked={formData.allowPaidHolidays}
                    onChange={(e) => syncHolidayToEmployees({ allowPaidHolidays: e.target.checked })}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                </label>
                {formData.allowPaidHolidays && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Holiday Type</label>
                      <div className="relative">
                        <select
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                          value={formData.paidHolidayType}
                          onChange={(e) => {
                            const val = e.target.value;
                            const extras = val === 'custom' && formData.customHolidays.length === 0
                              ? { customHolidays: [{ date: '', name: '' }], numberOfPaidHolidays: 1 }
                              : val === 'custom'
                                ? { numberOfPaidHolidays: formData.customHolidays.length }
                                : val === 'federal'
                                  ? { numberOfPaidHolidays: formData.selectedFederalHolidays?.length || 0 }
                                  : {};
                            syncHolidayToEmployees({ paidHolidayType: val, ...extras });
                          }}
                        >
                          <option value="federal">Federal Holidays</option>
                          <option value="custom">Custom</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Federal Holiday Checklist */}
                    {formData.paidHolidayType === 'federal' && (
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500">{currentYear} Federal Holidays — select which apply</p>
                          <button
                            type="button"
                            onClick={() => {
                              const allKeys = federalHolidaysList.map(h => h.key);
                              const allSelected = allKeys.length === (formData.selectedFederalHolidays?.length || 0);
                              syncHolidayToEmployees({
                                selectedFederalHolidays: allSelected ? [] : allKeys,
                                numberOfPaidHolidays: allSelected ? 0 : allKeys.length,
                              });
                            }}
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                          >
                            {federalHolidaysList.length === (formData.selectedFederalHolidays?.length || 0) ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        {federalHolidaysList.map((holiday) => (
                          <label key={holiday.key} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(formData.selectedFederalHolidays || []).includes(holiday.key)}
                              onChange={(e) => {
                                const current = formData.selectedFederalHolidays || [];
                                const updated = e.target.checked
                                  ? [...current, holiday.key]
                                  : current.filter(k => k !== holiday.key);
                                syncHolidayToEmployees({ selectedFederalHolidays: updated, numberOfPaidHolidays: updated.length });
                              }}
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <span className="text-sm text-gray-900">{holiday.name}</span>
                              <span className="text-xs text-gray-400">{holiday.displayDate}{holiday.isObserved ? ' (Observed)' : ''}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Custom Holidays */}
                    {formData.paidHolidayType === 'custom' && (
                      <div className="space-y-2">
                        {formData.customHolidays.map((holiday, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="date"
                              value={holiday.date}
                              onChange={(e) => {
                                const updated = formData.customHolidays.map((h, i) => i === index ? { ...h, date: e.target.value } : h);
                                syncHolidayToEmployees({ customHolidays: updated });
                              }}
                              className="w-36 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <input
                              type="text"
                              placeholder="Holiday name"
                              value={holiday.name}
                              onChange={(e) => {
                                const updated = formData.customHolidays.map((h, i) => i === index ? { ...h, name: e.target.value } : h);
                                syncHolidayToEmployees({ customHolidays: updated });
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            {formData.customHolidays.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formData.customHolidays.filter((_, i) => i !== index);
                                  syncHolidayToEmployees({ customHolidays: updated, numberOfPaidHolidays: updated.length });
                                }}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...formData.customHolidays, { date: '', name: '' }];
                            syncHolidayToEmployees({ customHolidays: updated, numberOfPaidHolidays: updated.length });
                          }}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Holiday
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Unpaid Holidays */}
              <div className={`p-3.5 rounded-xl border ${formData.allowUnpaidHolidays ? 'bg-purple-50/50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-gray-900">Unpaid Holidays</span>
                  <input
                    type="checkbox"
                    checked={formData.allowUnpaidHolidays}
                    onChange={(e) => syncHolidayToEmployees({ allowUnpaidHolidays: e.target.checked })}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Billing Rates */}
          {/* <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing Rates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.defaultHourlyRate}
                  onChange={(e) => setFormData({ ...formData, defaultHourlyRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.defaultOvertimeRate}
                  onChange={(e) => setFormData({ ...formData, defaultOvertimeRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-gray-500 mt-1">Leave as 0 to use 1.5x hourly rate</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <div className="relative">
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div> */}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="ghost"
              type="button"
              onClick={() => navigate("/admin/clients")}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {isEdit ? "Save Changes" : "Add Client"}
            </Button>
          </div>
        </form>
      </Card>

      {/* PTO Config Modal */}
      <Modal
        isOpen={!!ptoModalEmployee}
        onClose={() => setPtoModalEmployee(null)}
        title={ptoModalEmp ? `PTO Config — ${ptoModalEmp.firstName} ${ptoModalEmp.lastName}` : 'PTO Config'}
        size="md"
        footer={
          <Button variant="primary" onClick={() => setPtoModalEmployee(null)}>
            Done
          </Button>
        }
      >
        {ptoModalAssignment && (
          <div className="space-y-4">
            {/* Paid Leave */}
            <div className={`p-3.5 rounded-xl border ${ptoModalAssignment.allowPaidLeave ? 'bg-green-50/50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-900">Paid Leave</span>
                <input type="checkbox" checked={ptoModalAssignment.allowPaidLeave} onChange={(e) => updateEmployeeField(ptoModalEmployee, 'allowPaidLeave', e.target.checked)} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              </label>
              {ptoModalAssignment.allowPaidLeave && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                      <div className="relative">
                        <select
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                          value={ptoModalAssignment.paidLeaveType}
                          onChange={(e) => updateEmployeeField(ptoModalEmployee, 'paidLeaveType', e.target.value)}
                        >
                          <option value="fixed">Fixed Annual</option>
                          <option value="fixed-half-yearly">Fixed Half-Yearly</option>
                          <option value="accrued">Accrued</option>
                          <option value="milestone">Milestone Based</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {ptoModalAssignment.paidLeaveType === 'fixed-half-yearly' ? 'Half-Yearly Days' : 'Annual Days'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ptoModalAssignment.annualPaidLeaveDays}
                        onChange={(e) => updateEmployeeField(ptoModalEmployee, 'annualPaidLeaveDays', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                  <label className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Require 2 Weeks Notice</span>
                    <input type="checkbox" checked={ptoModalAssignment.requireTwoWeeksNoticePaidLeave} onChange={(e) => updateEmployeeField(ptoModalEmployee, 'requireTwoWeeksNoticePaidLeave', e.target.checked)} className="w-3.5 h-3.5 text-primary border-gray-300 rounded focus:ring-primary" />
                  </label>
                </div>
              )}
            </div>

            {/* Unpaid Leave */}
            <div className={`p-3.5 rounded-xl border ${ptoModalAssignment.allowUnpaidLeave ? 'bg-amber-50/50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-900">Unpaid Leave</span>
                <input type="checkbox" checked={ptoModalAssignment.allowUnpaidLeave} onChange={(e) => updateEmployeeField(ptoModalEmployee, 'allowUnpaidLeave', e.target.checked)} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              </label>
              {ptoModalAssignment.allowUnpaidLeave && (
                <div className="mt-3">
                  <label className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Require 2 Weeks Notice</span>
                    <input type="checkbox" checked={ptoModalAssignment.requireTwoWeeksNoticeUnpaidLeave} onChange={(e) => updateEmployeeField(ptoModalEmployee, 'requireTwoWeeksNoticeUnpaidLeave', e.target.checked)} className="w-3.5 h-3.5 text-primary border-gray-300 rounded focus:ring-primary" />
                  </label>
                </div>
              )}
            </div>

            {/* Paid Holidays */}
            <div className={`p-3.5 rounded-xl border ${ptoModalAssignment.allowPaidHolidays ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-900">Paid Holidays</span>
                <input type="checkbox" checked={ptoModalAssignment.allowPaidHolidays} onChange={(e) => updateEmployeeField(ptoModalEmployee, 'allowPaidHolidays', e.target.checked)} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              </label>
              {ptoModalAssignment.allowPaidHolidays && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500">Inherits holiday selection from client configuration.</p>
                </div>
              )}
            </div>

            {/* Unpaid Holidays */}
            <div className={`p-3.5 rounded-xl border ${ptoModalAssignment.allowUnpaidHolidays ? 'bg-purple-50/50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-900">Unpaid Holidays</span>
                <input type="checkbox" checked={ptoModalAssignment.allowUnpaidHolidays} onChange={(e) => updateEmployeeField(ptoModalEmployee, 'allowUnpaidHolidays', e.target.checked)} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Group Modal */}
      <Modal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false);
          setGroupForm({ name: '', description: '', billingRate: '' });
          setGroupError('');
        }}
        title="Add New Group"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowGroupModal(false);
                setGroupForm({ name: '', description: '', billingRate: '' });
                setGroupError('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateGroup}
              disabled={groupSubmitting}
            >
              {groupSubmitting ? 'Creating...' : 'Create Group'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {groupError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {groupError}
            </div>
          )}
          <Input
            label="Group Name"
            placeholder="Enter group name"
            value={groupForm.name}
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            required
          />
          <Input
            label="Description (Optional)"
            placeholder="Enter description"
            value={groupForm.description}
            onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
          />
          <Input
            label="Billing Rate (Optional)"
            type="number"
            placeholder="0.00"
            value={groupForm.billingRate}
            onChange={(e) => setGroupForm({ ...groupForm, billingRate: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AddClient;
