import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  MessageSquare,
  AlertCircle,
  X,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
  Flag,
  UserPlus,
  UserMinus,
  Type,
  FileText,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../../components/common';
import taskService from '../../../services/task.service';
import clientPortalService from '../../../services/clientPortal.service';
import { formatDate } from '../../../utils/formatDateTime';

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
};

const STATUS_CONFIG = {
  TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-700', icon: Circle, headerColor: 'border-gray-300', dotColor: 'bg-gray-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock, headerColor: 'border-blue-400', dotColor: 'bg-blue-400' },
  DONE: { label: 'Done', color: 'bg-green-100 text-green-700', icon: CheckCircle2, headerColor: 'border-green-400', dotColor: 'bg-green-400' },
};

const ACTIVITY_ICONS = {
  CREATED: CheckCircle2,
  STATUS_CHANGED: ArrowRight,
  ASSIGNED: UserPlus,
  UNASSIGNED: UserMinus,
  PRIORITY_CHANGED: Flag,
  DUE_DATE_CHANGED: CalendarDays,
  TITLE_UPDATED: Type,
  DESCRIPTION_UPDATED: FileText,
  COMMENTED: MessageSquare,
};

const STATUS_LABELS = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };

const getActivityMessage = (activity) => {
  switch (activity.action) {
    case 'CREATED': return 'created this task';
    case 'STATUS_CHANGED': return `changed status from ${STATUS_LABELS[activity.oldValue] || activity.oldValue} to ${STATUS_LABELS[activity.newValue] || activity.newValue}`;
    case 'ASSIGNED': return activity.oldValue ? `reassigned from ${activity.oldValue} to ${activity.newValue}` : `assigned to ${activity.newValue}`;
    case 'UNASSIGNED': return `unassigned ${activity.oldValue}`;
    case 'PRIORITY_CHANGED': return `changed priority from ${activity.oldValue} to ${activity.newValue}`;
    case 'DUE_DATE_CHANGED': return activity.newValue ? `changed due date to ${new Date(activity.newValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'removed due date';
    case 'TITLE_UPDATED': return 'updated the title';
    case 'DESCRIPTION_UPDATED': return 'updated the description';
    case 'COMMENTED': return 'added a comment';
    default: return activity.action;
  }
};

const Tasks = () => {
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View removed - table only

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', dueDate: new Date().toISOString().split('T')[0], employeeId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');



  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await taskService.getTasks({ limit: 200 });
      if (response.success) {
        setAllTasks(response.data.tasks);
      }
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await clientPortalService.getMyEmployees();
      if (response.success) setEmployees(response.data?.employees || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      if (search) {
        const q = search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) return false;
      }
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (employeeFilter && task.employeeId !== employeeFilter) return false;
      return true;
    });
  }, [allTasks, search, priorityFilter, employeeFilter]);

  // Stats
  const stats = useMemo(() => {
    const todo = filteredTasks.filter(t => t.status === 'TODO').length;
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const done = filteredTasks.filter(t => t.status === 'DONE').length;
    const overdue = filteredTasks.filter(t => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date(new Date().toDateString())).length;
    return { total: filteredTasks.length, todo, inProgress, done, overdue };
  }, [filteredTasks]);


  const resetForm = () => { setForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', dueDate: new Date().toISOString().split('T')[0], employeeId: '' }); setFormError(''); };

  const openCreate = () => { resetForm(); setIsEditing(false); setShowCreateModal(true); };

  const openEdit = (task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      employeeId: task.employeeId || '',
    });
    setSelectedTask(task);
    setIsEditing(true);
    setFormError('');
    setShowCreateModal(true);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, status: isEditing ? form.status : undefined, dueDate: form.dueDate || null, employeeId: form.employeeId || null };
      const response = isEditing ? await taskService.updateTask(selectedTask.id, payload) : await taskService.createTask(payload);
      if (response.success) { setShowCreateModal(false); resetForm(); fetchTasks(); }
      else setFormError(response.error || 'Failed to save task');
    } catch (err) {
      setFormError(err.message || 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const response = await taskService.deleteTask(selectedTask.id);
      if (response.success) { setShowDeleteModal(false); setSelectedTask(null); fetchTasks(); }
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = (task) => {
    if (!task.dueDate || task.status === 'DONE') return false;
    return new Date(task.dueDate) < new Date(new Date().toDateString());
  };

  const formatRelativeTime = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage tasks for your team</p>
        </div>
        <Button onClick={openCreate} size="sm" rounded="lg" icon={Plus} className="normal-case tracking-normal whitespace-nowrap cursor-pointer">
          New Task
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'To Do', value: stats.todo, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Done', value: stats.done, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + View Switcher */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9">
            <option value="">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9">
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4"><CheckCircle2 className="w-12 h-12 mx-auto" /></div>
          <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
          <p className="text-gray-500 mt-1">Create your first task to get started</p>
          <Button onClick={openCreate} size="sm" rounded="lg" icon={Plus} className="mt-4 normal-case tracking-normal whitespace-nowrap cursor-pointer">Create Task</Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Task</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Assignee</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Due Date</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map(task => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(task.id)}>
                  <TableCell>
                    <div>
                      <p className={`font-medium text-sm ${task.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                      {task._count?.comments > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MessageSquare className="w-3 h-3" />{task._count.comments}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-500 line-clamp-2">{task.description || '-'}</p>
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          {task.assignee.profilePhoto ? (
                            <img src={task.assignee.profilePhoto} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-primary-700">{task.assignee.firstName?.charAt(0)}</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-600">{task.assignee.firstName} {task.assignee.lastName}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[task.priority].color}`}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[task.status].color}`}>
                      {STATUS_CONFIG[task.status].label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm ${isOverdue(task) ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                      {formatDate(task.dueDate)}
                      {isOverdue(task) && ' (Overdue)'}
                    </span>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setSelectedTask(task); setShowDeleteModal(true); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={isEditing ? 'Edit Task' : 'New Task'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter task title" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={3} placeholder="Enter task description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="relative">
                <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="relative">
                  <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9">
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input type="date" value={form.dueDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Employee</label>
            <div className="relative">
              <select value={form.employeeId} onChange={(e) => setForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9">
                <option value="">Unassigned</option>
                {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEditing ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal && !!selectedTask} onClose={() => setShowDeleteModal(false)} title="Delete Task">
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <strong>"{selectedTask?.title}"</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Delete
          </Button>
        </div>
      </Modal>

    </div>
  );
};

export default Tasks;
