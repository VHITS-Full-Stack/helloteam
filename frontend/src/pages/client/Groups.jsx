import { useState, useEffect } from 'react';
import {
  Users,
  FolderOpen,
  RefreshCw,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Edit,
  ChevronLeft,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Modal,
} from '../../components/common';
import clientPortalService from '../../services/clientPortal.service';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';

const Groups = () => {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.GROUPS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.GROUPS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.GROUPS.DELETE);
  const canManageEmployees = hasPermission(PERMISSIONS.GROUPS.MANAGE_EMPLOYEES);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create group
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  // Edit group
  const [editGroup, setEditGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');

  // Delete confirmation
  const [deleteGroup, setDeleteGroup] = useState(null);

  // Manage employees
  const [managingGroup, setManagingGroup] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await clientPortalService.getMyGroups();
      if (response.success) {
        setGroups(response.data.groups);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshGroups = async () => {
    try {
      const response = await clientPortalService.getMyGroups();
      if (response.success) {
        setGroups(response.data.groups);
      }
    } catch (err) {
      console.error('Failed to refresh groups:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await clientPortalService.getMyEmployees();
      if (response.success) {
        setAllEmployees(response.data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchEmployees();
  }, []);

  // Create group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await clientPortalService.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
      });
      if (response.success) {
        setNewGroupName('');
        setNewGroupDescription('');
        setShowCreateModal(false);
        setError('');
        await refreshGroups();
      } else {
        setError(response.error || 'Failed to create group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit modal
  const openEditModal = (group) => {
    setEditGroup(group);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || '');
    setError('');
  };

  // Update group
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editGroup || !editGroupName.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await clientPortalService.updateGroup(editGroup.id, {
        name: editGroupName.trim(),
        description: editGroupDescription.trim(),
      });
      if (response.success) {
        setEditGroup(null);
        setEditGroupName('');
        setEditGroupDescription('');
        setError('');
        await refreshGroups();
      } else {
        setError(response.error || 'Failed to update group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update group');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete group
  const handleConfirmDelete = async () => {
    if (!deleteGroup) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await clientPortalService.deleteGroup(deleteGroup.id);
      if (response.success) {
        setDeleteGroup(null);
        setError('');
        await refreshGroups();
      } else {
        setError(response.error || 'Failed to remove group');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open manage employees view
  const openManageEmployees = (group) => {
    setManagingGroup(group);
    setSelectedEmployeeIds([]);
    setError('');
  };

  // Add employees to group
  const handleAddEmployees = async () => {
    if (!managingGroup || selectedEmployeeIds.length === 0) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await clientPortalService.addEmployeesToGroup(managingGroup.id, selectedEmployeeIds);
      if (response.success) {
        setSelectedEmployeeIds([]);
        setError('');
        await refreshGroups();
        // Refresh the managing group data
        const groupsRes = await clientPortalService.getMyGroups();
        if (groupsRes.success) {
          const updated = groupsRes.data.groups.find((g) => g.id === managingGroup.id);
          if (updated) setManagingGroup(updated);
        }
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
      const response = await clientPortalService.removeEmployeeFromGroup(managingGroup.id, employeeId);
      if (response.success) {
        setError('');
        await refreshGroups();
        // Refresh the managing group data
        const groupsRes = await clientPortalService.getMyGroups();
        if (groupsRes.success) {
          const updated = groupsRes.data.groups.find((g) => g.id === managingGroup.id);
          if (updated) setManagingGroup(updated);
        }
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Groups</h2>
          <p className="text-gray-500">Manage your groups and their employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={fetchGroups}>
            Refresh
          </Button>
          {canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
              Create Group
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && !managingGroup && !deleteGroup && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Groups List */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-gray-500">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No groups yet</p>
            {canCreate && (
              <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create First Group
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.id} padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-gray-500">{group.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default" size="sm">
                    {group.employeeCount} employee{group.employeeCount !== 1 ? 's' : ''}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(group.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {canManageEmployees && (
                    <button
                      className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                      onClick={() => openManageEmployees(group)}
                      title="Manage Employees"
                    >
                      <UserPlus className="w-4 h-4 text-primary" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                      onClick={() => openEditModal(group)}
                      title="Edit Group"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500 hover:text-red-700"
                      onClick={() => setDeleteGroup(group)}
                      title="Remove Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline employee list */}
              {group.employees?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                  {group.employees.map((ge) => (
                    <div key={ge.employee?.id || ge.id} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
                      <Avatar
                        src={ge.employee?.profilePhoto}
                        name={`${ge.employee?.firstName || ''} ${ge.employee?.lastName || ''}`}
                        size="xs"
                      />
                      <span className="text-xs text-gray-700">
                        {ge.employee?.firstName} {ge.employee?.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setNewGroupName(''); setNewGroupDescription(''); setError(''); }}
        title="Create New Group"
        size="sm"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input
            label="Group Name"
            placeholder="Enter group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            required
          />
          <textarea
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm"
            rows={3}
            placeholder="Description (optional)"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setShowCreateModal(false); setNewGroupName(''); setNewGroupDescription(''); setError(''); }}>
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
        isOpen={!!editGroup}
        onClose={() => { setEditGroup(null); setEditGroupName(''); setEditGroupDescription(''); setError(''); }}
        title="Edit Group"
        size="sm"
      >
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <Input
            label="Group Name"
            placeholder="Enter group name"
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
            required
          />
          <textarea
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm"
            rows={3}
            placeholder="Description (optional)"
            value={editGroupDescription}
            onChange={(e) => setEditGroupDescription(e.target.value)}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setEditGroup(null); setEditGroupName(''); setEditGroupDescription(''); setError(''); }}>
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
        isOpen={!!deleteGroup}
        onClose={() => { setDeleteGroup(null); setError(''); }}
        title="Remove Group"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to remove <strong>{deleteGroup?.name}</strong>? This will unassign all its employees from this group.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setDeleteGroup(null); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleConfirmDelete} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Employees Modal */}
      <Modal
        isOpen={!!managingGroup}
        onClose={() => { setManagingGroup(null); setSelectedEmployeeIds([]); setError(''); }}
        title={`Manage Employees - ${managingGroup?.name || ''}`}
        size="lg"
      >
        {managingGroup && (
          <div className="space-y-6">
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
                          src={ge.employee?.profilePhoto}
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
        )}
      </Modal>
    </div>
  );
};

export default Groups;
