import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  Card,
  Button,
  Input,
} from '../../../components/common';
import { useClientForm } from '../../../hooks/useClientForm';

const AddClient = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    formData,
    setFormData,
    groups,
    isEdit,
    loading,
    error,
    setError,
    submitting,
    handleSubmit,
  } = useClientForm({ id, onSuccess: () => navigate('/admin/clients') });

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
        <button onClick={() => navigate('/admin/clients')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Client' : 'Add New Client'}
          </h2>
          <p className="text-xs text-gray-500">
            {isEdit ? 'Update client account details' : 'Create a new client account'}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <Card padding="md">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Information</h3>
            <div className="space-y-4">
              <Input
                label="Company Name"
                placeholder="Enter company name"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Contact Person"
                  placeholder="Primary contact name"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  required
                />
                <Input
                  label="Phone"
                  placeholder="Contact phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <Input
                label="Address"
                placeholder="Company address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          {/* Account Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="Contact email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {isEdit ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              ) : (
                <Input
                  label="Password"
                  type="password"
                  placeholder="Account password (min 8 characters)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              )}
            </div>
          </div>

          {/* Configuration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Asia/Kolkata">India Standard Time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Group {isEdit ? '' : '(Optional)'}
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  value={formData.groupId}
                  onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                >
                  <option value="">{isEdit ? 'No group' : 'Select a group'}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">All employees in the selected group will be assigned to this client</p>
              </div>
              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agreement Type</label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    value={formData.agreementType}
                    onChange={(e) => setFormData({ ...formData, agreementType: e.target.value })}
                  >
                    <option value="WEEKLY_ACH">Weekly ACH</option>
                    <option value="MONTHLY_ACH">Monthly ACH</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Client must sign this agreement before accessing the portal</p>
                </div>
              )}
            </div>
          </div>

          {/* Policy Configuration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Policy Configuration</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Paid Leave</label>
                <input
                  type="checkbox"
                  checked={formData.allowPaidLeave}
                  onChange={(e) => setFormData({ ...formData, allowPaidLeave: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              {formData.allowPaidLeave && (
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <select
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                      value={formData.paidLeaveType}
                      onChange={(e) => setFormData({ ...formData, paidLeaveType: e.target.value })}
                    >
                      <option value="fixed">Fixed Annual</option>
                      <option value="fixed-half-yearly">Fixed Half-Yearly</option>
                      <option value="accrued">Accrued</option>
                      <option value="milestone">Milestone Based</option>
                    </select>
                  </div>
                  <Input
                    label="Annual Days"
                    type="number"
                    min="0"
                    value={formData.annualPaidLeaveDays}
                    onChange={(e) => setFormData({ ...formData, annualPaidLeaveDays: e.target.value })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Unpaid Leave</label>
                <input
                  type="checkbox"
                  checked={formData.allowUnpaidLeave}
                  onChange={(e) => setFormData({ ...formData, allowUnpaidLeave: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Require 2 Weeks Notice</label>
                <input
                  type="checkbox"
                  checked={formData.requireTwoWeeksNotice}
                  onChange={(e) => setFormData({ ...formData, requireTwoWeeksNotice: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Allow Overtime</label>
                <input
                  type="checkbox"
                  checked={formData.allowOvertime}
                  onChange={(e) => setFormData({ ...formData, allowOvertime: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              {formData.allowOvertime && (
                <div className="flex items-center justify-between pl-4">
                  <label className="text-sm text-gray-700">Overtime Requires Approval</label>
                  <input
                    type="checkbox"
                    checked={formData.overtimeRequiresApproval}
                    onChange={(e) => setFormData({ ...formData, overtimeRequiresApproval: e.target.checked })}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                </div>
              )}
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
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>
          </div> */}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => navigate('/admin/clients')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {isEdit ? 'Save Changes' : 'Add Client'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddClient;
