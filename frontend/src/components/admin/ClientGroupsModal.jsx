import { useState, useEffect, useCallback } from 'react';
import {
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
} from 'lucide-react';
import {
  Button,
  Avatar,
  Input,
  Modal,
} from '../common';
import groupService from '../../services/group.service';
import employeeService from '../../services/employee.service';

const ClientGroupsModal = ({ isOpen, onClose, clientId, clientName, onGroupsChanged }) => {
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

  // Filter groups that belong to this client only
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

  // Fetch all data when modal opens (with loading spinner)
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

  // Refresh data after actions (no loading spinner)
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
    if (isOpen) {
      fetchData();
      setError('');
      setShowCreateForm(false);
      setManagingGroup(null);
      setSelectedEmployeeIds([]);
    }
  }, [isOpen, fetchData]);

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
        billingRate: newGroupBillingRate || null,
      });
      if (response.success) {
        // Auto-assign the new group to this client
        const groupId = response.data?.id;
        if (groupId) {
          await groupService.assignToClient(groupId, clientId);
        }
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupBillingRate('');
        setShowCreateForm(false);
        setError('');
        await refreshData();
        onGroupsChanged?.();
      } else {
        setError(response.error || 'Failed to create group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit form for a group
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
        billingRate: editGroupBillingRate || null,
      });
      if (response.success) {
        setEditingGroup(null);
        setEditGroupName('');
        setEditGroupDescription('');
        setEditGroupBillingRate('');
        setError('');
        await refreshData();
        onGroupsChanged?.();
      } else {
        setError(response.error || 'Failed to update group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update group');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove group from this client (with confirmation)
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
        onGroupsChanged?.();
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
  };

  // Add employees to the managing group
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
        onGroupsChanged?.();
      } else {
        setError(response.error || 'Failed to add employees');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to add employees');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove employee from the managing group
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
        onGroupsChanged?.();
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
        ? prev.filter((id) => id !== employeeId)
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

  const handleClose = () => {
    setManagingGroup(null);
    setDeleteGroup(null);
    setEditingGroup(null);
    setError('');
    setShowCreateForm(false);
    setSelectedEmployeeIds([]);
    onClose();
  };

  // ---- Manage Employees Sub-View ----
  if (managingGroup) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={`Manage Employees - ${managingGroup.name}`}
        size="lg"
      >
        <div className="space-y-6">
          <button
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => { setManagingGroup(null); setSelectedEmployeeIds([]); setError(''); }}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Groups
          </button>

          {/* Current Employees */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Current Employees ({managingGroup.employees?.length || 0})
            </h4>
            {managingGroup.employees?.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {managingGroup.employees.map((ge) => (
                  <div
                    key={ge.employee?.id || ge.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-xl"
                  >
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
            <Button variant="ghost" onClick={() => { setManagingGroup(null); setSelectedEmployeeIds([]); setError(''); }}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- Main Groups View ----
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Groups - ${clientName || ''}`}
      size="lg"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-gray-500">Loading groups...</p>
          </div>
        ) : (
          <>
            {/* Client's Groups */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Groups ({clientGroups.length})
              </h4>
              {clientGroups.length > 0 ? (
                <div className="space-y-2">
                  {clientGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-100">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{group.name}</p>
                          <p className="text-xs text-gray-500">
                            {group.totalEmployees > 0
                              ? `${group.totalEmployees} employee${group.totalEmployees !== 1 ? 's' : ''}`
                              : 'No employees yet'}
                            {group.billingRate ? ` · $${Number(group.billingRate).toFixed(2)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                          onClick={() => openManageEmployees(group)}
                          title="Manage Employees"
                        >
                          <UserPlus className="w-4 h-4 text-primary" />
                        </button>
                        <button
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                          onClick={() => openEditGroup(group)}
                          title="Edit Group"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500 hover:text-red-700"
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
                <div className="py-4 text-center">
                  <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No groups yet. Create one below.</p>
                </div>
              )}
            </div>

            {/* Create New Group */}
            <div>
              {showCreateForm ? (
                <form onSubmit={handleCreateGroup} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">Create New Group</h4>
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
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowCreateForm(true)}
                  className="w-full"
                >
                  Create New Group
                </Button>
              )}
            </div>
          </>
        )}

        {/* Edit Group Form */}
        {editingGroup && (
          <form onSubmit={handleUpdateGroup} className="border border-primary-200 bg-primary-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Edit Group - {editingGroup.name}</h4>
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
              label="Billing Rate"
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

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ClientGroupsModal;
