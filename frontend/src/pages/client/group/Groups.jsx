import { useState, useEffect } from 'react';
import {
  Users,
  FolderOpen,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Edit,
  ChevronLeft,
  AlertCircle,
  X,
  Search,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  RefreshButton,
  AddButton,
} from '../../../components/common';
import clientPortalService from '../../../services/clientPortal.service';
import { usePermissions } from '../../../hooks/usePermissions';
import { PERMISSIONS } from '../../../config/permissions';

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupBillingRate, setNewGroupBillingRate] = useState('');

  // Edit group
  const [editGroup, setEditGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupBillingRate, setEditGroupBillingRate] = useState('');

  // Delete confirmation
  const [deleteGroup, setDeleteGroup] = useState(null);

  // Manage employees
  const [managingGroup, setManagingGroup] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

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
        billingRate: newGroupBillingRate || null,
      });
      if (response.success) {
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupBillingRate('');
        setShowCreateForm(false);
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

  // Open edit form
  const openEditForm = (group) => {
    setEditGroup(group);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || '');
    setEditGroupBillingRate(group.billingRate ? String(group.billingRate) : '');
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
        billingRate: editGroupBillingRate || null,
      });
      if (response.success) {
        setEditGroup(null);
        setEditGroupName('');
        setEditGroupDescription('');
        setEditGroupBillingRate('');
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
    setEmployeeSearch('');
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

  const filteredAvailableEmployees = getAvailableEmployees().filter((emp) => {
    if (!employeeSearch) return true;
    const query = employeeSearch.toLowerCase();
    return (
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||
      emp.user?.email?.toLowerCase().includes(query)
    );
  });

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
                      src={ge.employee?.profilePhoto}
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Groups</h2>
          <p className="text-gray-500">Manage your groups and their employees</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={fetchGroups} />
          {canCreate && (
            <AddButton onClick={() => setShowCreateForm(true)}>
              Create Group
            </AddButton>
          )}
        </div>
      </div>

      {/* Error */}
      {error && !deleteGroup && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create Group Form */}
      {showCreateForm && (
        <Card>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create New Group</h3>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setNewGroupName(''); setNewGroupDescription(''); setNewGroupBillingRate(''); setError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
            <Input
              label="Billing Rate"
              type="number"
              placeholder="e.g. 25.00 (optional)"
              value={newGroupBillingRate}
              onChange={(e) => setNewGroupBillingRate(e.target.value)}
              min="0"
              step="0.01"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setShowCreateForm(false); setNewGroupName(''); setNewGroupDescription(''); setNewGroupBillingRate(''); setError(''); }}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Create Group
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Edit Group Form */}
      {editGroup && (
        <Card>
          <form onSubmit={handleUpdateGroup} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Group - {editGroup.name}</h3>
              <button
                type="button"
                onClick={() => { setEditGroup(null); setEditGroupName(''); setEditGroupDescription(''); setEditGroupBillingRate(''); setError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
            <Input
              label="Billing Rate"
              type="number"
              placeholder="e.g. 25.00 (optional)"
              value={editGroupBillingRate}
              onChange={(e) => setEditGroupBillingRate(e.target.value)}
              min="0"
              step="0.01"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditGroup(null); setEditGroupName(''); setEditGroupDescription(''); setEditGroupBillingRate(''); setError(''); }}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
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
            Are you sure you want to remove <strong>{deleteGroup.name}</strong>? This will unassign all its employees from this group.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDeleteGroup(null); setError(''); }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleConfirmDelete} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Groups List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-gray-500">Loading groups...</p>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No groups yet</p>
            {canCreate && (
              <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowCreateForm(true)}>
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
                  {group.billingRate && (
                    <Badge variant="default" size="sm">
                      ${Number(group.billingRate).toFixed(2)}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(group.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {canManageEmployees && (
                    <button
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded transition-colors"
                      onClick={() => openManageEmployees(group)}
                      title="Manage Employees"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      onClick={() => openEditForm(group)}
                      title="Edit Group"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
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
    </div>
  );
};

export default Groups;
