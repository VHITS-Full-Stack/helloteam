import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Building,
  Edit,
  Trash2,
  Eye,
  X,
  AlertCircle,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../components/common';
import employeeService from '../../services/employee.service';
import clientService from '../../services/client.service';

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const isInitialMount = useRef(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, onLeave: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    hireDate: '',
    clientId: '',
  });

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await employeeService.getEmployees({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });

      console.log('Employees API Response:', response);

      if (response.success) {
        console.log('Setting employees:', response.data.employees);
        setEmployees(response.data.employees);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination,
        }));
      } else {
        console.log('Response not successful:', response);
      }
    } catch (err) {
      console.error('Fetch employees error:', err);
      setError(err.error || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await employeeService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch clients for dropdown
  const fetchClients = async () => {
    try {
      const response = await clientService.getClients({ limit: 100 });
      if (response.success) {
        setClients(response.data.clients);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchStats();
    fetchClients();
  }, [fetchEmployees]);

  // Debounce search - skip initial mount since fetchEmployees is already called
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchEmployees();
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
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      hireDate: '',
      clientId: '',
    });
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.createEmployee(formData);
      if (response.success) {
        // Close modal and reset form first
        setShowAddModal(false);
        resetForm();
        setError('');
        // Then refresh data in the background
        fetchEmployees();
        fetchStats();
      } else {
        setError(response.error || 'Failed to create employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.updateEmployee(selectedEmployee.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        hireDate: formData.hireDate,
        status: formData.status,
      });

      if (response.success) {
        // Close modal and reset form first
        setShowEditModal(false);
        setSelectedEmployee(null);
        resetForm();
        setError('');
        // Then refresh data in the background
        fetchEmployees();
        fetchStats();
      } else {
        setError(response.error || 'Failed to update employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.deleteEmployee(selectedEmployee.id);
      if (response.success) {
        // Close modal first
        setShowDeleteModal(false);
        setSelectedEmployee(null);
        setError('');
        // Then refresh data in the background
        fetchEmployees();
        fetchStats();
      } else {
        setError(response.error || 'Failed to delete employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToClient = async (clientId) => {
    if (!selectedEmployee || !clientId) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.assignToClient(selectedEmployee.id, clientId);
      if (response.success) {
        // Close modal first
        setShowAssignModal(false);
        setSelectedEmployee(null);
        setError('');
        // Then refresh data in the background
        fetchEmployees();
      } else {
        setError(response.error || 'Failed to assign employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to assign employee');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      email: employee.user?.email || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone || '',
      address: employee.address || '',
      hireDate: employee.hireDate ? employee.hireDate.split('T')[0] : '',
      status: employee.user?.status || 'ACTIVE',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const openAssignModal = (employee) => {
    setSelectedEmployee(employee);
    setShowAssignModal(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="default">Inactive</Badge>;
      case 'SUSPENDED':
        return <Badge variant="error">Suspended</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getEmployeeClients = (employee) => {
    if (!employee.clientAssignments || employee.clientAssignments.length === 0) {
      return <span className="text-gray-400">Unassigned</span>;
    }
    return employee.clientAssignments.map(ca => ca.client?.companyName).join(', ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
          <p className="text-gray-500">Manage employee profiles and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={() => { fetchEmployees(); fetchStats(); }}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => { resetForm(); setShowAddModal(true); }}>
            Add Employee
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
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">On Leave</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.onLeave}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
        </div>
      </Card>

      {/* Employees Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-gray-500">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No employees found</p>
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowAddModal(true)}>
              Add First Employee
            </Button>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Contact</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Joined</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={employee.profilePhoto} name={`${employee.firstName} ${employee.lastName}`} size="md" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{employee.user?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {employee.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4" />
                          {employee.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{getEmployeeClients(employee)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.user?.status)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {employee.hireDate
                        ? new Date(employee.hireDate).toLocaleDateString()
                        : 'N/A'
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/employees/${employee.id}`}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Link>
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={() => openAssignModal(employee)}
                        title="Assign to Client"
                      >
                        <UserPlus className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={() => openEditModal(employee)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => openDeleteModal(employee)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
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
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); setError(''); }}
        title="Add New Employee"
        size="lg"
      >
        <form onSubmit={handleAddEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          <Input
            label="Email"
            type="email"
            placeholder="Enter email address"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password (min 8 characters)"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign to Client (Optional)
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Hire Date"
              type="date"
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
            />
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
              Add Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedEmployee(null); resetForm(); setError(''); }}
        title="Edit Employee"
        size="lg"
      >
        <form onSubmit={handleEditEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          <Input
            label="Email"
            type="email"
            placeholder="Enter email address"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
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
          <div className="grid grid-cols-2 gap-4">
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
            <Input
              label="Hire Date"
              type="date"
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowEditModal(false); setSelectedEmployee(null); resetForm(); setError(''); }}>
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
        onClose={() => { setShowDeleteModal(false); setSelectedEmployee(null); setError(''); }}
        title="Delete Employee"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedEmployee?.firstName} {selectedEmployee?.lastName}</strong>?
            This action will deactivate their account.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setSelectedEmployee(null); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDeleteEmployee} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign to Client Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setSelectedEmployee(null); setError(''); }}
        title="Assign to Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Select a client to assign <strong>{selectedEmployee?.firstName} {selectedEmployee?.lastName}</strong> to:
          </p>

          <div className="space-y-2">
            {clients.map((client) => (
              <button
                key={client.id}
                className="w-full p-4 text-left border border-gray-200 rounded-xl hover:bg-primary-50 hover:border-primary transition-colors"
                onClick={() => handleAssignToClient(client.id)}
                disabled={submitting}
              >
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{client.companyName}</p>
                    <p className="text-sm text-gray-500">{client.contactPerson}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => { setShowAssignModal(false); setSelectedEmployee(null); setError(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Employees;
