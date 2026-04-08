import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  MessageSquare,
  Calendar,
  AlertCircle,
  X,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  LayoutGrid,
  List,
  Activity,
  ArrowRight,
  Flag,
  UserPlus,
  UserMinus,
  Type,
  FileText,
  CalendarDays,
  GripVertical,
  ChevronDown,
  ClipboardList,
  User,
  Edit2,
  Trash2,
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
} from '../../components/common';
import taskService from '../../services/task.service';
import { formatDate } from '../../utils/formatDateTime';

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
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
  const [searchParams] = useSearchParams();
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'assigned');

  // View
  const [viewMode, setViewMode] = useState('board');

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTab, setDetailTab] = useState('activity');
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
  const [editingTask, setEditingTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Create modal (personal tasks)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete modal (personal tasks)
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Drag state
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await taskService.getTasks({ limit: 200 });
      if (response.success) setAllTasks(response.data.tasks);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Split tasks by type
  const assignedTasks = useMemo(() => allTasks.filter(t => !t.isPersonal), [allTasks]);
  const personalTasks = useMemo(() => allTasks.filter(t => t.isPersonal), [allTasks]);
  const activeTasks = activeTab === 'assigned' ? assignedTasks : personalTasks;

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return activeTasks.filter(task => {
      if (search) {
        const q = search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) return false;
      }
      if (priorityFilter && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [activeTasks, search, priorityFilter]);

  // Stats
  const stats = useMemo(() => {
    const todo = filteredTasks.filter(t => t.status === 'TODO').length;
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const done = filteredTasks.filter(t => t.status === 'DONE').length;
    const overdue = filteredTasks.filter(t => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date(new Date().toDateString())).length;
    return { total: filteredTasks.length, todo, inProgress, done, overdue };
  }, [filteredTasks]);

  // Board columns
  const columns = useMemo(() => ({
    TODO: filteredTasks.filter(t => t.status === 'TODO'),
    IN_PROGRESS: filteredTasks.filter(t => t.status === 'IN_PROGRESS'),
    DONE: filteredTasks.filter(t => t.status === 'DONE'),
  }), [filteredTasks]);

  const openDetail = async (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
    setDetailTab('activity');
    setLoadingDetail(true);
    try {
      const [taskRes, actRes] = await Promise.all([
        taskService.getTask(task.id),
        taskService.getTaskActivities(task.id),
      ]);
      if (taskRes.success) { setSelectedTask(taskRes.data); setComments(taskRes.data.comments || []); }
      if (actRes.success) setActivities(actRes.data || []);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    if (showDetailModal && selectedTask?.id === task.id) setSelectedTask(prev => ({ ...prev, status: newStatus }));
    try {
      const response = await taskService.updateTaskStatus(task.id, newStatus);
      if (!response.success) {
        setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      }
    } catch (err) {
      setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      setError(err.message || 'Failed to update status');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    setSubmittingComment(true);
    try {
      const response = await taskService.addTaskComment(selectedTask.id, newComment.trim());
      if (response.success) { setComments(prev => [...prev, response.data]); setNewComment(''); setDetailTab('comments'); }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const openEdit = (task) => {
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    });
    setEditingTask(task);
    setFormError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) { setFormError('Title is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { title: editForm.title.trim(), description: editForm.description.trim() || null, priority: editForm.priority, dueDate: editForm.dueDate || null };
      const response = await taskService.updateTask(editingTask.id, payload);
      if (response.success) {
        setShowEditModal(false);
        setShowDetailModal(false);
        setEditingTask(null);
        setFormError('');
        fetchTasks();
      } else {
        setFormError(response.error || 'Failed to update task');
      }
    } catch (err) {
      setFormError(err.error || err.message || 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setCreateForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) { setCreateError('Title is required'); return; }
    setCreateSubmitting(true);
    setCreateError('');
    try {
      const payload = { title: createForm.title.trim(), description: createForm.description.trim() || null, priority: createForm.priority, dueDate: createForm.dueDate || null };
      const response = await taskService.createTask(payload);
      if (response.success) {
        setShowCreateModal(false);
        setCreateForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
        setCreateError('');
        fetchTasks();
      } else {
        setCreateError(response.error || 'Failed to create task');
      }
    } catch (err) {
      setCreateError(err.error || err.message || 'Failed to create task');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const response = await taskService.deleteTask(selectedTask.id);
      if (response.success) {
        setShowDeleteModal(false);
        setShowDetailModal(false);
        setSelectedTask(null);
        fetchTasks();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    } finally {
      setSubmitting(false);
    }
  };

  // Drag and drop
  const handleDragStart = (e, task) => { setDraggedTask(task); e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.5'; };
  const handleDragEnd = (e) => { e.target.style.opacity = '1'; setDraggedTask(null); setDragOverColumn(null); };
  const handleDragOver = (e, status) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverColumn(status); };
  const handleDragLeave = () => { setDragOverColumn(null); };
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedTask && draggedTask.status !== newStatus) handleStatusChange(draggedTask, newStatus);
    setDraggedTask(null);
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
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'assigned' ? 'Tasks assigned to you by your manager' : 'Your personal private tasks'}
          </p>
        </div>
        {activeTab === 'personal' && (
          <Button onClick={openCreate} size="sm" rounded="lg" icon={Plus} className="normal-case tracking-normal whitespace-nowrap">
            New Task
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('assigned'); setSearch(''); setPriorityFilter(''); }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'assigned' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Assigned Tasks
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">{assignedTasks.length}</span>
        </button>
        <button
          onClick={() => { setActiveTab('personal'); setSearch(''); setPriorityFilter(''); }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'personal' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Personal Tasks
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">{personalTasks.length}</span>
        </button>
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
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="appearance-none pr-9 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
            <option value="">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* View Switcher */}
        <div className="flex items-center p-1 bg-gray-100 rounded-lg">
          <button onClick={() => setViewMode('board')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <LayoutGrid className="w-4 h-4" />Board
          </button>
          <button onClick={() => setViewMode('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <List className="w-4 h-4" />List
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4"><ClipboardList className="w-12 h-12 mx-auto" /></div>
          <h3 className="text-lg font-medium text-gray-900">
            {activeTab === 'assigned' ? 'No tasks assigned' : 'No personal tasks'}
          </h3>
          <p className="text-gray-500 mt-1">
            {activeTab === 'assigned' ? "You don't have any assigned tasks yet" : 'Create a personal task to get started'}
          </p>
          {activeTab === 'personal' && (
            <Button onClick={openCreate} size="sm" rounded="lg" icon={Plus} className="mt-4 normal-case tracking-normal whitespace-nowrap">Create Task</Button>
          )}
        </Card>
      ) : viewMode === 'board' ? (
        /* ===== BOARD VIEW ===== */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
            <div
              key={status}
              className={`rounded-xl border-2 ${dragOverColumn === status ? 'border-primary-300 bg-primary-50/50' : 'border-transparent bg-gray-50/80'} transition-colors`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className={`px-4 py-3 border-b-2 ${STATUS_CONFIG[status].headerColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[status].dotColor}`} />
                    <h3 className="text-sm font-semibold text-gray-700">{STATUS_CONFIG[status].label}</h3>
                  </div>
                  <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">{columns[status].length}</span>
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {columns[status].map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openDetail(task)}
                    className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group ${isOverdue(task) ? 'border-l-3 border-l-red-400' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_CONFIG[task.priority].color}`}>
                            {PRIORITY_CONFIG[task.priority].label}
                          </span>
                        </div>
                        <h4 className={`text-sm font-medium leading-snug ${task.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </h4>
                        {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          {activeTab === 'assigned' && task.client && (
                            <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                              <User className="w-3 h-3" />{task.client.companyName}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={`text-[11px] flex items-center gap-0.5 ${isOverdue(task) ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {task._count?.comments > 0 && (
                            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                              <MessageSquare className="w-3 h-3" />{task._count.comments}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ===== LIST VIEW (Table) ===== */
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Task</TableHeader>
                {activeTab === 'assigned' && <TableHeader>Client</TableHeader>}
                <TableHeader>Priority</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Due Date</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map(task => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(task)}>
                  <TableCell>
                    <div>
                      <p className={`font-medium text-sm ${task.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                      {task.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{task.description}</p>}
                      {task._count?.comments > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MessageSquare className="w-3 h-3" />{task._count.comments}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {activeTab === 'assigned' && (
                    <TableCell>
                      <span className="text-sm text-gray-600">{task.client?.companyName || '-'}</span>
                    </TableCell>
                  )}
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[task.priority].color}`}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                        className={`appearance-none pr-9 text-xs font-medium rounded-lg px-2 py-1 border-0 cursor-pointer ${STATUS_CONFIG[task.status].color}`}
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm ${isOverdue(task) ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                      {formatDate(task.dueDate)}
                      {isOverdue(task) && ' (Overdue)'}
                    </span>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {task.isPersonal && (
                        <button onClick={() => { setSelectedTask(task); setShowDeleteModal(true); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Task Detail Modal */}
      <Modal
        isOpen={showDetailModal && !!selectedTask}
        onClose={() => { setShowDetailModal(false); setSelectedTask(null); setComments([]); setActivities([]); setNewComment(''); }}
        title=""
        size="2xl"
      >
        {selectedTask && (
          <div className="flex flex-col lg:flex-row gap-6 -mt-2">
            {/* Left Side */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[selectedTask.priority].color}`}>
                  {PRIORITY_CONFIG[selectedTask.priority].label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTask.status].color}`}>
                  {STATUS_CONFIG[selectedTask.status].label}
                </span>
                {isOverdue(selectedTask) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Overdue</span>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
              {selectedTask.description && (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{selectedTask.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{selectedTask.isPersonal ? 'Type' : 'Client'}</p>
                  <p className="font-medium text-gray-900">{selectedTask.isPersonal ? 'Personal Task' : selectedTask.client?.companyName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className={`font-medium ${isOverdue(selectedTask) ? 'text-red-500' : 'text-gray-900'}`}>{formatDate(selectedTask.dueDate)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedTask.createdAt)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Priority</p>
                  <p className="font-medium text-gray-900">{PRIORITY_CONFIG[selectedTask.priority].label}</p>
                </div>
              </div>

              {/* Status Buttons */}
              <div className="flex gap-2 mt-4">
                {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(selectedTask, status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedTask.status === status ? STATUS_CONFIG[status].color + ' ring-2 ring-offset-1 ring-primary-400' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    {STATUS_CONFIG[status].label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => { setShowDetailModal(false); openEdit(selectedTask); }}>
                  <Edit2 className="w-3.5 h-3.5" />Edit
                </button>
                {selectedTask.isPersonal && (
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors" onClick={() => { setShowDetailModal(false); setShowDeleteModal(true); }}>
                    <Trash2 className="w-3.5 h-3.5" />Delete
                  </button>
                )}
              </div>
            </div>

            {/* Right Side: Activity / Comments Tabs */}
            <div className="lg:w-[340px] lg:border-l lg:pl-6 border-t lg:border-t-0 pt-4 lg:pt-0 flex flex-col min-h-[400px]">
              <div className="flex border-b mb-3">
                <button onClick={() => setDetailTab('activity')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === 'activity' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <Activity className="w-4 h-4 inline mr-1.5" />Activity
                </button>
                <button onClick={() => setDetailTab('comments')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === 'comments' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <MessageSquare className="w-4 h-4 inline mr-1.5" />Comments ({comments.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[350px]">
                {loadingDetail ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : detailTab === 'activity' ? (
                  activities.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map(act => {
                        const Icon = ACTIVITY_ICONS[act.action] || Activity;
                        return (
                          <div key={act.id} className="flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Icon className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium text-gray-900">{act.authorName}</span>{' '}
                                {getActivityMessage(act)}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(act.createdAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No comments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            {comment.authorAvatar ? (
                              <img src={comment.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold text-primary-700">{comment.authorName?.charAt(0) || '?'}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{comment.authorName}</span>
                              <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap break-words">{comment.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2 mt-3 pt-3 border-t">
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                <Button type="submit" disabled={!newComment.trim() || submittingComment} size="sm">
                  {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Task Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Task">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter task title" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={3} placeholder="Enter task description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="relative">
                <select value={editForm.priority} onChange={(e) => setEditForm(f => ({ ...f, priority: e.target.value }))} className="appearance-none pr-9 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={editForm.dueDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Personal Task Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Personal Task">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{createError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={createForm.title} onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter task title" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" rows={3} placeholder="Enter task description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="relative">
                <select value={createForm.priority} onChange={(e) => setCreateForm(f => ({ ...f, priority: e.target.value }))} className="appearance-none pr-9 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={createForm.dueDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setCreateForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Task Modal */}
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
