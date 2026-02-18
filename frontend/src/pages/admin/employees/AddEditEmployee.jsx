import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import {
  Card,
  Button,
  Input,
} from '../../../components/common';
import { useEmployeeForm } from '../../../hooks/useEmployeeForm';

const AddEmployee = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    formData,
    setFormData,
    clients,
    clientGroups,
    isEdit,
    loading,
    error,
    setError,
    submitting,
    handleSubmit,
    handleClientChange,
  } = useEmployeeForm({ id, onSuccess: () => navigate('/admin/employees') });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/employees')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <p className="text-xs text-gray-500">
            {isEdit ? `${formData.firstName} ${formData.lastName}` : 'Create a new employee account'}
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
          {/* Personal Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="Enter first name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              <Input
                label="Last Name"
                placeholder="Enter last name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
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
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input
                label="Address"
                placeholder="Enter address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          {/* Assignment & Date */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {isEdit ? 'Employment' : 'Assignment'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Client (Optional)
                  </label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    value={formData.clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isEdit && formData.clientId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Group (Optional)
                  </label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  >
                    <option value="">No group</option>
                    {clientGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.employees?.length || 0} employees)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Add this employee to a group under the selected client</p>
                </div>
              )}
              <Input
                label="Hire Date"
                type="date"
                value={formData.hireDate}
                onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
              />
            </div>
          </div>

          {/* Rates */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Rates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Payable Rate ($/hr)"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 25.00"
                value={formData.payableRate}
                onChange={(e) => setFormData({ ...formData, payableRate: e.target.value })}
              />
              <Input
                label="Billing Rate ($/hr)"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 45.00"
                value={formData.billingRate}
                onChange={(e) => setFormData({ ...formData, billingRate: e.target.value })}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => navigate('/admin/employees')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {isEdit ? 'Save Changes' : 'Add Employee'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddEmployee;
