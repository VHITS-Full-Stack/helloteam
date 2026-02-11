import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  Users,
  UserPlus,
  UserMinus,
  Building,
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
  TableCell,
} from '../../../components/common';
import groupService from '../../../services/group.service';
import employeeService from '../../../services/employee.service';
import clientService from '../../../services/client.service';

const Groups = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const isInitialMount = useRef(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showAssignClientModal, setShowAssignClientModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    billingRate: '',
  });

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await groupService.getGroups({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });

      if (response.success) {
        setGroups(response.data.groups);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery]);

  // Fetch all employees for assignment dropdown
  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 200 });
      if (response.success) {
        setAllEmployees(response.data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  // Fetch clients for assignment
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
    fetchGroups();
    fetchEmployees();
    fetchClients();
  }, [fetchGroups]);

  // Debounce search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchGroups();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      billingRate: '',
    });
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await groupService.createGroup({
        name: formData.name,
        description: formData.description,
        billingRate: formData.billingRate || null,
      });
      if (response.success) {
        setShowAddModal(false);
        resetForm();
        setError('');
        fetchGroups();
      } else {
        setError(response.error || 'Failed to create group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGroup = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await groupService.updateGroup(selectedGroup.id, {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        billingRate: formData.billingRate || null,
      });

      if (response.success) {
        setShowEditModal(false);
        setSelectedGroup(null);
        resetForm();
        setError('');
        fetchGroups();
      } else {
        setError(response.error || 'Failed to update group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await groupService.deleteGroup(selectedGroup.id);
      if (response.success) {
        setShowDeleteModal(false);
        setSelectedGroup(null);
        setError('');
        fetchGroups();
      } else {
        setError(response.error || 'Failed to delete group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEmployees = async () => {
    if (!selectedGroup || selectedEmployeeIds.length === 0) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await groupService.addEmployees(selectedGroup.id, selectedEmployeeIds);
      if (response.success) {
        setSelectedEmployeeIds([]);
        setError('');
        // Refresh group detail to show updated employees
        const groupResponse = await groupService.getGroup(selectedGroup.id);
        if (groupResponse.success) {
          setSelectedGroup(groupResponse.data);
        }
        fetchGroups();
      } else {
        setError(response.error || 'Failed to add employees');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to add employees');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveEmployee = async (employeeId) => {
    if (!selectedGroup) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await groupService.removeEmployee(selectedGroup.id, employeeId);
      if (response.success) {
        setError('');
        // Refresh group detail
        const groupResponse = await groupService.getGroup(selectedGroup.id);
        if (groupResponse.success) {
          setSelectedGroup(groupResponse.data);
        }
        fetchGroups();
      } else {
        setError(response.error || 'Failed to remove employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignGroupToClient = async (clientId) => {
    if (!selectedGroup || !clientId) return;

    setSubmitting(true);
    setError('');

    try {
      // Get the full group with employees
      const groupResponse = await groupService.getGroup(selectedGroup.id);
      if (!groupResponse.success) {
        setError('Failed to fetch group details');
        return;
      }

      const employeeIds = groupResponse.data.employees?.map(
        (ge) => ge.employee?.id || ge.employeeId
      ).filter(Boolean);

      if (!employeeIds || employeeIds.length === 0) {
        setError('No employees in this group to assign');
        return;
      }

      const response = await clientService.assignEmployees(clientId, employeeIds);
      if (response.success) {
        setShowAssignClientModal(false);
        setSelectedGroup(null);
        setError('');
      } else {
        setError(response.error || 'Failed to assign group to client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to assign group to client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignGroupFromClient = async (clientId) => {
    if (!selectedGroup || !clientId) return;

    setSubmitting(true);
    setError('');

    try {
      const groupResponse = await groupService.getGroup(selectedGroup.id);
      if (!groupResponse.success) {
        setError('Failed to fetch group details');
        return;
      }

      const employeeIds = groupResponse.data.employees?.map(
        (ge) => ge.employee?.id || ge.employeeId
      ).filter(Boolean);

      if (!employeeIds || employeeIds.length === 0) {
        setError('No employees in this group to unassign');
        return;
      }

      // Remove each employee from the client
      for (const employeeId of employeeIds) {
        await clientService.removeEmployee(clientId, employeeId);
      }

      // Refresh group data
      const updatedGroup = await groupService.getGroup(selectedGroup.id);
      if (updatedGroup.success) {
        setSelectedGroup(updatedGroup.data);
      }
      setError('');
      fetchGroups();
    } catch (err) {
      setError(err.error || err.message || 'Failed to unassign group from client');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignClientModal = (group) => {
    setError('');
    setSelectedGroup(group);
    setShowAssignClientModal(true);
    // Fetch full group details with clientAssignments in background
    groupService.getGroup(group.id).then((response) => {
      if (response.success) {
        setSelectedGroup(response.data);
      }
    }).catch(() => {});
  };

  const openEditModal = (group) => {
    setError('');
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      isActive: group.isActive,
      billingRate: group.billingRate ? String(group.billingRate) : '',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (group) => {
    setError('');
    setSelectedGroup(group);
    setShowDeleteModal(true);
  };

  const openManageModal = async (group) => {
    setError('');
    try {
      const response = await groupService.getGroup(group.id);
      if (response.success) {
        setSelectedGroup(response.data);
      } else {
        setSelectedGroup(group);
      }
    } catch {
      setSelectedGroup(group);
    }
    setSelectedEmployeeIds([]);
    setShowManageModal(true);
  };

  const getStatusBadge = (isActive) => {
    return isActive
      ? <Badge variant="success">Active</Badge>
      : <Badge variant="default">Inactive</Badge>;
  };

  // Get clients that a group's employees are assigned to (reads directly from group data)
  const getGroupClients = (group) => {
    if (!group.employees || group.employees.length === 0) return [];
    const total = group.employees.length;
    const clientMap = {};

    group.employees.forEach((ge) => {
      const emp = ge.employee;
      if (emp?.clientAssignments) {
        emp.clientAssignments.forEach((ca) => {
          if (ca.client) {
            const cid = ca.client.id || ca.clientId;
            if (!clientMap[cid]) {
              clientMap[cid] = { name: ca.client.companyName, count: 0, total };
            }
            clientMap[cid].count++;
          }
        });
      }
    });

    return Object.entries(clientMap).map(([id, info]) => ({ id, ...info }));
  };

  // For the assign modal: get assignment status per client (reads directly from group data)
  const getClientAssignmentStatus = (clientId) => {
    if (!selectedGroup?.employees || selectedGroup.employees.length === 0) return { assigned: 0, total: 0 };
    const total = selectedGroup.employees.length;
    let assigned = 0;

    selectedGroup.employees.forEach((ge) => {
      const emp = ge.employee;
      if (emp?.clientAssignments) {
        const isAssigned = emp.clientAssignments.some((ca) => {
          const cid = ca.client?.id || ca.clientId;
          return cid === clientId;
        });
        if (isAssigned) assigned++;
      }
    });

    return { assigned, total };
  };

  // Get employees not already in the selected group
  const getAvailableEmployees = () => {
    if (!selectedGroup || !selectedGroup.employees) return allEmployees;
    const assignedIds = new Set(selectedGroup.employees.map(ge => ge.employee?.id || ge.employeeId));
    return allEmployees.filter(emp => !assignedIds.has(emp.id));
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  // Compute stats from loaded groups
  const stats = {
    total: pagination.total,
    active: groups.filter(g => g.isActive).length,
    inactive: groups.filter(g => !g.isActive).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Group Management</h2>
          <p className="text-gray-500">Organize employees into teams and departments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={() => fetchGroups()}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => { resetForm(); setShowAddModal(true); }}>
            Add Group
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && !showAddModal && !showEditModal && !showDeleteModal && !showManageModal && !showAssignClientModal && (
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Groups</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
        </Card>
      </div>

      {/* Search */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
        </div>
      </Card>

      {/* Groups Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-gray-500">Loading groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No groups found</p>
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowAddModal(true)}>
              Create First Group
            </Button>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Group</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Billing Rate ($/hr)</TableHeader>
                <TableHeader>Employees</TableHeader>
                <TableHeader>Assigned Clients</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Created</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-50">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <p className="font-medium text-gray-900">{group.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {group.description || <span className="text-gray-400">No description</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-700">
                      {group.billingRate ? `$${Number(group.billingRate).toFixed(2)}` : <span className="text-gray-400">N/A</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">{group.employeeCount || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const assignedClients = getGroupClients(group);
                      if (assignedClients.length === 0) {
                        return <span className="text-gray-400 text-sm">None</span>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedClients.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200"
                            >
                              <Building className="w-3 h-3" />
                              {c.name}
                              <span className="text-green-500">({c.count}/{c.total})</span>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{getStatusBadge(group.isActive)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {new Date(group.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={() => openManageModal(group)}
                        title="Manage Employees"
                      >
                        <UserPlus className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                        onClick={() => openAssignClientModal(group)}
                      >
                        <Building className="w-3.5 h-3.5" />
                        Assign to Client
                      </button>
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={() => openEditModal(group)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => openDeleteModal(group)}
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

      {/* Add Group Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); setError(''); }}
        title="Add New Group"
        size="md"
      >
        <form onSubmit={handleAddGroup} className="space-y-4">
          <Input
            label="Group Name"
            placeholder="Enter group name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              rows={3}
              placeholder="Enter group description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <Input
            label="Billing Rate ($/hr)"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 45.00"
            value={formData.billingRate}
            onChange={(e) => setFormData({ ...formData, billingRate: e.target.value })}
          />
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
              Create Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedGroup(null); resetForm(); setError(''); }}
        title="Edit Group"
        size="md"
      >
        <form onSubmit={handleEditGroup} className="space-y-4">
          <Input
            label="Group Name"
            placeholder="Enter group name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              rows={3}
              placeholder="Enter group description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <Input
            label="Billing Rate ($/hr)"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 45.00"
            value={formData.billingRate}
            onChange={(e) => setFormData({ ...formData, billingRate: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              value={formData.isActive ? 'active' : 'inactive'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowEditModal(false); setSelectedGroup(null); resetForm(); setError(''); }}>
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
        onClose={() => { setShowDeleteModal(false); setSelectedGroup(null); setError(''); }}
        title="Delete Group"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedGroup?.name}</strong>?
            This will deactivate the group and remove all employee assignments.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setSelectedGroup(null); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDeleteGroup} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Group to Client Modal */}
      <Modal
        isOpen={showAssignClientModal}
        onClose={() => { setShowAssignClientModal(false); setSelectedGroup(null); setError(''); }}
        title={`Assign Group to Client - ${selectedGroup?.name || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Assign all <strong>{selectedGroup?.employees?.length || 0} employees</strong> in
            <strong> {selectedGroup?.name}</strong> to a client:
          </p>

          {selectedGroup?.employees?.length > 0 ? (
            <div className="space-y-2">
              {clients.map((client) => {
                const status = getClientAssignmentStatus(client.id);
                const isAssigned = status.assigned > 0;

                return (
                  <div
                    key={client.id}
                    className={`w-full p-4 border rounded-xl transition-colors ${
                      isAssigned ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{client.companyName}</p>
                          <p className="text-sm text-gray-500">{client.contactPerson}</p>
                        </div>
                      </div>
                      {isAssigned ? (
                        <button
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                          onClick={() => handleUnassignGroupFromClient(client.id)}
                          disabled={submitting}
                        >
                          Unassign
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
                          onClick={() => handleAssignGroupToClient(client.id)}
                          disabled={submitting}
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-3">This group has no employees to assign. Add employees first.</p>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => { setShowAssignClientModal(false); setSelectedGroup(null); setError(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Employees Modal */}
      <Modal
        isOpen={showManageModal}
        onClose={() => { setShowManageModal(false); setSelectedGroup(null); setSelectedEmployeeIds([]); setError(''); }}
        title={`Manage Employees - ${selectedGroup?.name || ''}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Current Employees */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Current Employees ({selectedGroup?.employees?.length || 0})
            </h4>
            {selectedGroup?.employees?.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedGroup.employees.map((ge) => (
                  <div key={ge.employee?.id || ge.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${ge.employee?.firstName || ''} ${ge.employee?.lastName || ''}`}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {ge.employee?.firstName} {ge.employee?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{ge.employee?.user?.email}</p>
                      </div>
                    </div>
                    <button
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      onClick={() => handleRemoveEmployee(ge.employee?.id || ge.employeeId)}
                      disabled={submitting}
                      title="Remove from group"
                    >
                      <UserMinus className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-3">No employees assigned to this group yet.</p>
            )}
          </div>

          {/* Add Employees */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Add Employees</h4>
            {getAvailableEmployees().length > 0 ? (
              <>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {getAvailableEmployees().map((employee) => (
                    <label
                      key={employee.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEmployeeIds.includes(employee.id)
                          ? 'bg-primary-50 border border-primary'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onChange={() => toggleEmployeeSelection(employee.id)}
                      />
                      <Avatar
                        src={employee.profilePhoto}
                        name={`${employee.firstName} ${employee.lastName}`}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{employee.user?.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedEmployeeIds.length > 0 && (
                  <div className="mt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={UserPlus}
                      onClick={handleAddEmployees}
                      loading={submitting}
                    >
                      Add {selectedEmployeeIds.length} Employee{selectedEmployeeIds.length > 1 ? 's' : ''}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 py-3">All employees are already assigned to this group.</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => { setShowManageModal(false); setSelectedGroup(null); setSelectedEmployeeIds([]); setError(''); }}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Groups;
