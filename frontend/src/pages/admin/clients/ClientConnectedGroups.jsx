import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Users,
  UserPlus,
  UserMinus,
  FolderOpen,
  AlertCircle,
  X,
  ChevronLeft,
  Trash2,
  Edit,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Card,
  Button,
  Avatar,
  Input,
} from '../../../components/common';
import groupService from '../../../services/group.service';
import employeeService from '../../../services/employee.service';
import clientService from '../../../services/client.service';

const ClientConnectedGroups = () => {
  const { id: clientId } = useParams();
  const navigate = useNavigate();

  // Client info
  const [clientName, setClientName] = useState('');
  const [clientLoading, setClientLoading] = useState(true);

  // Main state
  const [clientGroups, setClientGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create group form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupBillingRate, setNewGroupBillingRate] = useState('');

  // Edit group
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupBillingRate, setEditGroupBillingRate] = useState('');

  // Delete confirmation
  const [deleteGroup, setDeleteGroup] = useState(null);

  // Manage employees sub-view
  const [managingGroup, setManagingGroup] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Filter groups that belong to this client
  const filterClientGroups = useCallback((groups) => {
    const myGroups = [];

    groups.forEach((group) => {
      if (!group.isActive) return;

      const isLinked = group.clients?.some((cg) => {
        const cid = cg.client?.id || cg.clientId;
        return cid === clientId;
      });

      if (isLinked) {
        const totalEmployees = group.employees?.length || 0;
        let assignedCount = 0;
        if (group.employees && group.employees.length > 0) {
          group.employees.forEach((ge) => {
            const emp = ge.employee;
            if (emp?.clientAssignments) {
              const isAssigned = emp.clientAssignments.some((ca) => {
                const cid = ca.client?.id || ca.clientId;
                return cid === clientId;
              });
              if (isAssigned) assignedCount++;
            }
          });
        }
        myGroups.push({ ...group, assignedCount, totalEmployees });
      }
    });

    setClientGroups(myGroups);
  }, [clientId]);

  // Fetch client info
  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await clientService.getClient(clientId);
        if (response.success) {
          setClientName(response.data.companyName);
        }
      } catch (err) {
        console.error('Failed to fetch client:', err);
      } finally {
        setClientLoading(false);
      }
    };
    fetchClient();
  }, [clientId]);

  // Fetch groups and employees
  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [groupsRes, employeesRes] = await Promise.all([
        groupService.getGroups({ limit: 100 }),
        employeeService.getEmployees({ limit: 200 }),
      ]);

      if (groupsRes.success) {
        setAllEmployees(employeesRes.success ? employeesRes.data.employees : []);
        filterClientGroups(groupsRes.data.groups);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId, filterClientGroups]);

  const refreshData = async () => {
    if (!clientId) return;
    try {
      const groupsRes = await groupService.getGroups({ limit: 100 });
      if (groupsRes.success) {
        filterClientGroups(groupsRes.data.groups);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create a new group and auto-assign to this client
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await groupService.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
      });
      if (response.success) {
        const groupId = response.data?.id;
        if (groupId) {
          await groupService.assignToClient(groupId, clientId, newGroupBillingRate || null);
        }
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupBillingRate('');
        setShowCreateForm(false);
        setError('');
        await refreshData();
      } else {
        setError(response.error || 'Failed to create group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit form
  const openEditGroup = (group) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || '');
    setEditGroupBillingRate(group.billingRate ? String(group.billingRate) : '');
    setError('');
  };

  // Update group
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await groupService.updateGroup(editingGroup.id, {
        name: editGroupName.trim(),
        description: editGroupDescription.trim(),
      });
      // Update client-specific billing rate
      if (response.success) {
        await groupService.assignToClient(editingGroup.id, clientId, editGroupBillingRate || null);
      }
      if (response.success) {
        setEditingGroup(null);
        setEditGroupName('');
        setEditGroupDescription('');
        setEditGroupBillingRate('');
        setError('');
        await refreshData();
      } else {
        setError(response.error || 'Failed to update group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update group');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove group from this client
  const handleConfirmRemoveGroup = async () => {
    if (!deleteGroup) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await groupService.unassignFromClient(deleteGroup.id, clientId);
      if (response.success) {
        setError('');
        setDeleteGroup(null);
        await refreshData();
      } else {
        setError(response.error || 'Failed to remove group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open manage employees sub-view
  const openManageEmployees = async (group) => {
    setError('');
    try {
      const response = await groupService.getGroup(group.id);
      if (response.success) {
        setManagingGroup(response.data);
      } else {
        setManagingGroup(group);
      }
    } catch {
      setManagingGroup(group);
    }
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
  };

  // Add employees to group
  const handleAddEmployees = async () => {
    if (!managingGroup || selectedEmployeeIds.length === 0) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await groupService.addEmployees(managingGroup.id, selectedEmployeeIds);
      if (response.success) {
        setSelectedEmployeeIds([]);
        setError('');
        const groupResponse = await groupService.getGroup(managingGroup.id);
        if (groupResponse.success) {
          setManagingGroup(groupResponse.data);
        }
        await refreshData();
      } else {
        setError(response.error || 'Failed to add employees');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to add employees');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove employee from group
  const handleRemoveEmployee = async (employeeId) => {
    if (!managingGroup) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await groupService.removeEmployee(managingGroup.id, employeeId);
      if (response.success) {
        setError('');
        const groupResponse = await groupService.getGroup(managingGroup.id);
        if (groupResponse.success) {
          setManagingGroup(groupResponse.data);
        }
        await refreshData();
      } else {
        setError(response.error || 'Failed to remove employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove employee');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((eid) => eid !== employeeId)
        : [...prev, employeeId]
    );
  };

  const getAvailableEmployees = () => {
    if (!managingGroup || !managingGroup.employees) return allEmployees;
    const assignedIds = new Set(
      managingGroup.employees.map((ge) => ge.employee?.id || ge.employeeId)
    );
    return allEmployees.filter((emp) => !assignedIds.has(emp.id));
  };

  const filteredAvailableEmployees = getAvailableEmployees().filter((emp) => {
    if (!employeeSearch) return true;
    const query = employeeSearch.toLowerCase();
    return (
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||
      emp.user?.email?.toLowerCase().includes(query)
    );
  });

  if (loading || clientLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-500">Loading groups...</p>
        </div>
      </div>
    );
  }

  // ---- Manage Employees Sub-View ----
  if (managingGroup) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              icon={ChevronLeft}
              onClick={() => { setManagingGroup(null); setSelectedEmployeeIds([]); setError(''); setEmployeeSearch(''); }}
            >
              Back to Groups
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Employees</h2>
              <p className="text-gray-500">{managingGroup.name}</p>
            </div>
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

        {/* Current Employees */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Current Employees ({managingGroup.employees?.length || 0})
          </h3>
          {managingGroup.employees?.length > 0 ? (
            <div className="space-y-3">
              {managingGroup.employees.map((ge) => (
                <div
                  key={ge.employee?.id || ge.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={`${ge.employee?.firstName || ''} ${ge.employee?.lastName || ''}`}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {ge.employee?.firstName} {ge.employee?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{ge.employee?.user?.email}</p>
                    </div>
                  </div>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    onClick={() => handleRemoveEmployee(ge.employee?.id || ge.employeeId)}
                    disabled={submitting}
                    title="Remove from group"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No employees assigned to this group yet.</p>
            </div>
          )}
        </Card>

        {/* Add Employees */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Employees</h3>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employees..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {filteredAvailableEmployees.length > 0 ? (
            <>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredAvailableEmployees.map((employee) => (
                  <label
                    key={employee.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedEmployeeIds.includes(employee.id)
                        ? 'bg-primary-50 border border-primary'
                        : 'border border-gray-200 hover:bg-gray-50'
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
                      <p className="font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{employee.user?.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedEmployeeIds.length > 0 && (
                <div className="mt-4">
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
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {employeeSearch ? 'No employees match your search' : 'All employees are already assigned to this group.'}
              </p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ---- Main Groups View ----
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(`/admin/clients/${clientId}`)}>
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Connected Groups</h2>
            <p className="text-gray-500">{clientName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={fetchData}>
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowCreateForm(true)}
          >
            Create Group
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

      {/* Create Group Form */}
      {showCreateForm && (
        <Card>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Group</h3>
            <Input
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              required
            />
            <textarea
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm"
              rows={2}
              placeholder="Description (optional)"
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Billing Rate (optional)"
              value={newGroupBillingRate}
              onChange={(e) => setNewGroupBillingRate(e.target.value)}
              min="0"
              step="0.01"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => { setShowCreateForm(false); setNewGroupName(''); setNewGroupDescription(''); setNewGroupBillingRate(''); setError(''); }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={submitting}>
                Create Group
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Edit Group Form */}
      {editingGroup && (
        <Card>
          <form onSubmit={handleUpdateGroup} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Group - {editingGroup.name}</h3>
            <Input
              label="Group Name"
              placeholder="Group name"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              required
            />
            <textarea
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm"
              rows={2}
              placeholder="Description (optional)"
              value={editGroupDescription}
              onChange={(e) => setEditGroupDescription(e.target.value)}
            />
            <Input
              label="Billing Rate ($/hr)"
              type="number"
              placeholder="e.g. 45.00 (optional)"
              value={editGroupBillingRate}
              onChange={(e) => setEditGroupBillingRate(e.target.value)}
              min="0"
              step="0.01"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => { setEditingGroup(null); setError(''); }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Delete Confirmation */}
      {deleteGroup && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to remove <strong>{deleteGroup.name}</strong>? This will unassign all its employees from this client.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteGroup(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmRemoveGroup}
              loading={submitting}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Groups List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Groups ({clientGroups.length})
          </h3>
        </div>

        {clientGroups.length > 0 ? (
          <div className="space-y-3">
            {clientGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-100">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-500">
                      {group.totalEmployees > 0
                        ? `${group.totalEmployees} employee${group.totalEmployees !== 1 ? 's' : ''}`
                        : 'No employees yet'}
                      {group.billingRate ? ` · $${Number(group.billingRate).toFixed(2)}/hr` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded transition-colors"
                    onClick={() => openManageEmployees(group)}
                    title="Manage Employees"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                    onClick={() => openEditGroup(group)}
                    title="Edit Group"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    onClick={() => setDeleteGroup(group)}
                    disabled={submitting}
                    title="Remove Group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No groups connected</p>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="mt-4"
              onClick={() => setShowCreateForm(true)}
            >
              Create Group
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientConnectedGroups;
