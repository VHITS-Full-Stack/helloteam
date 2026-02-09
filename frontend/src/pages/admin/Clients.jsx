import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building,
  Users,
  Settings,
  Eye,
  Edit,
  Trash2,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
  Avatar
} from '../../components/common';
import clientService from '../../services/client.service';

const Clients = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const isInitialMount = useRef(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalAssignedEmployees: 0,
    activeAssignedEmployees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    address: '',
    timezone: 'UTC',
    allowPaidLeave: false,
    paidLeaveType: 'fixed',
    annualPaidLeaveDays: 0,
    allowUnpaidLeave: true,
    requireTwoWeeksNotice: true,
    allowOvertime: true,
    overtimeRequiresApproval: true,
  });

  // Fetch clients
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await clientService.getClients({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });

      console.log('Clients API Response:', response);

      if (response.success) {
        console.log('Setting clients:', response.data.clients);
        setClients(response.data.clients);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination,
        }));
      } else {
        console.log('Response not successful:', response);
      }
    } catch (err) {
      console.error('Fetch clients error:', err);
      setError(err.error || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await clientService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, [fetchClients]);

  // Debounce search - skip initial mount since fetchClients is already called
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchClients();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      address: '',
      timezone: 'UTC',
      allowPaidLeave: false,
      paidLeaveType: 'fixed',
      annualPaidLeaveDays: 0,
      allowUnpaidLeave: true,
      requireTwoWeeksNotice: true,
      allowOvertime: true,
      overtimeRequiresApproval: true,
    });
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.createClient(formData);
      if (response.success) {
        // Close modal and reset form first
        setShowAddModal(false);
        resetForm();
        setError('');
        // Then refresh data in the background
        fetchClients();
        fetchStats();
      } else {
        setError(response.error || 'Failed to create client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.updateClient(selectedClient.id, {
        email: formData.email,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        address: formData.address,
        timezone: formData.timezone,
        status: formData.status,
        allowPaidLeave: formData.allowPaidLeave,
        paidLeaveType: formData.paidLeaveType,
        annualPaidLeaveDays: parseInt(formData.annualPaidLeaveDays),
        allowUnpaidLeave: formData.allowUnpaidLeave,
        requireTwoWeeksNotice: formData.requireTwoWeeksNotice,
        allowOvertime: formData.allowOvertime,
        overtimeRequiresApproval: formData.overtimeRequiresApproval,
      });

      if (response.success) {
        // Close modal and reset form first
        setShowEditModal(false);
        setSelectedClient(null);
        resetForm();
        setError('');
        // Then refresh data in the background
        fetchClients();
        fetchStats();
      } else {
        setError(response.error || 'Failed to update client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.deleteClient(selectedClient.id);
      if (response.success) {
        // Close modal first
        setShowDeleteModal(false);
        setSelectedClient(null);
        setError('');
        // Then refresh data in the background
        fetchClients();
        fetchStats();
      } else {
        setError(response.error || 'Failed to delete client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete client');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setFormData({
      email: client.user?.email || '',
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      phone: client.phone || '',
      address: client.address || '',
      timezone: client.timezone || 'UTC',
      status: client.user?.status || 'ACTIVE',
      allowPaidLeave: client.clientPolicies?.allowPaidLeave || false,
      paidLeaveType: client.clientPolicies?.paidLeaveType || 'fixed',
      annualPaidLeaveDays: client.clientPolicies?.annualPaidLeaveDays || 0,
      allowUnpaidLeave: client.clientPolicies?.allowUnpaidLeave ?? true,
      requireTwoWeeksNotice: client.clientPolicies?.requireTwoWeeksNotice ?? true,
      allowOvertime: client.clientPolicies?.allowOvertime ?? true,
      overtimeRequiresApproval: client.clientPolicies?.overtimeRequiresApproval ?? true,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (client) => {
    setSelectedClient(client);
    setShowDeleteModal(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="default">Inactive</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
          <p className="text-gray-500">Manage client accounts and configurations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={() => { fetchClients(); fetchStats(); }}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => { resetForm(); setShowAddModal(true); }}>
            Add Client
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
              <p className="text-sm text-gray-500">Total Clients</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.activeClients}</p>
              <p className="text-sm text-gray-500">Active Clients</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAssignedEmployees}</p>
              <p className="text-sm text-gray-500">Assigned Employees</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Users className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.activeAssignedEmployees}</p>
              <p className="text-sm text-gray-500">Active Assigned</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card padding="sm">
        <Input
          icon={Search}
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Card>

      {/* Client Cards */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-gray-500">Loading clients...</p>
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No clients found</p>
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowAddModal(true)}>
              Add First Client
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clients.map((client) => (
            <Card key={client.id} className="hover:border-primary-200 border border-transparent">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {client.logoUrl ? (
                    <Avatar src={client.logoUrl} name={client.companyName} size="lg" />
                  ) : (
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <Building className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.companyName}</h3>
                    <p className="text-sm text-gray-500">{client.contactPerson}</p>
                  </div>
                </div>
                {getStatusBadge(client.user?.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Employees</span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {client.activeEmployeeCount || 0}/{client.employeeCount || 0} active
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Leave Policy</span>
                  </div>
                  <Badge variant={client.clientPolicies?.allowPaidLeave ? 'success' : 'warning'} size="sm">
                    {client.clientPolicies?.allowPaidLeave ? 'Paid Leave' : 'Unpaid Only'}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  icon={Eye}
                  onClick={() => navigate(`/admin/clients/${client.id}`)}
                >
                  View
                </Button>
                <Button variant="ghost" size="sm" fullWidth icon={Edit} onClick={() => openEditModal(client)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => openDeleteModal(client)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); setError(''); }}
        title="Add New Client"
        size="lg"
      >
        <form onSubmit={handleAddClient} className="space-y-4">
          <Input
            label="Company Name"
            placeholder="Enter company name"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              placeholder="Primary contact name"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="Contact email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <Input
            label="Password"
            type="password"
            placeholder="Account password (min 8 characters)"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              placeholder="Contact phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
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
          </div>
          <Input
            label="Address"
            placeholder="Company address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-4">Policy Configuration</h4>
            <div className="space-y-4">
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

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowAddModal(false); resetForm(); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Add Client
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedClient(null); resetForm(); setError(''); }}
        title="Edit Client"
        size="lg"
      >
        <form onSubmit={handleEditClient} className="space-y-4">
          <Input
            label="Company Name"
            placeholder="Enter company name"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              placeholder="Primary contact name"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="Contact email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              placeholder="Contact phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
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
          </div>
          <Input
            label="Address"
            placeholder="Company address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-4">Policy Configuration</h4>
            <div className="space-y-4">
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
                <label className="text-sm text-gray-700">Allow Overtime</label>
                <input
                  type="checkbox"
                  checked={formData.allowOvertime}
                  onChange={(e) => setFormData({ ...formData, allowOvertime: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowEditModal(false); setSelectedClient(null); resetForm(); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedClient(null); setError(''); }}
        title="Delete Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedClient?.companyName}</strong>?
            This will deactivate the client account.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setSelectedClient(null); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDeleteClient} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;
