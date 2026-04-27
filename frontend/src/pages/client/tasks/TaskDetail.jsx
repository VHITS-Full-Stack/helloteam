import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ArrowRight,
  Flag,
  UserPlus,
  UserMinus,
  Type,
  FileText,
  CalendarDays,
  Edit2,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button, Modal } from '../../../components/common';
import taskService from '../../../services/task.service';
import clientPortalService from '../../../services/clientPortal.service';
import { formatDate } from '../../../utils/formatDateTime';

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-50 text-blue-700' },
  HIGH: { label: 'High', color: 'bg-orange-50 text-orange-700' },
  URGENT: { label: 'Urgent', color: 'bg-red-50 text-red-700' },
};

const STATUS_CONFIG = {
  TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-700', icon: Circle },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-50 text-blue-700', icon: Clock },
  DONE: { label: 'Done', color: 'bg-green-50 text-green-700', icon: CheckCircle2 },
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
    case 'STATUS_CHANGED': return `changed status from "${STATUS_LABELS[activity.oldValue] || activity.oldValue}" to "${STATUS_LABELS[activity.newValue] || activity.newValue}"`;
    case 'ASSIGNED': return activity.oldValue ? `reassigned from ${activity.oldValue} to ${activity.newValue}` : `assigned to ${activity.newValue}`;
    case 'UNASSIGNED': return `unassigned ${activity.oldValue}`;
    case 'PRIORITY_CHANGED': return `changed priority from ${activity.oldValue} to ${activity.newValue}`;
    case 'DUE_DATE_CHANGED': return activity.newValue ? `set due date to ${new Date(activity.newValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'removed due date';
    case 'TITLE_UPDATED': return 'updated the title';
    case 'DESCRIPTION_UPDATED': return 'updated the description';
    case 'COMMENTED': return 'added a comment';
    default: return activity.action;
  }
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

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailTab, setDetailTab] = useState('activity');

  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', dueDate: '', employeeId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, actRes] = await Promise.all([
        taskService.getTask(id),
        taskService.getTaskActivities(id),
      ]);
      if (taskRes.success) {
        setTask(taskRes.data);
        setComments(taskRes.data.comments || []);
      } else {
        setError('Task not found');
      }
      if (actRes.success) setActivities(actRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    clientPortalService.getMyEmployees()
      .then(res => { if (res.success) setEmployees(res.data?.employees || []); })
      .catch(() => {});
  }, []);

  const isOverdue = (t) => {
    if (!t.dueDate || t.status === 'DONE') return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const response = await taskService.addTaskComment(id, newComment.trim());
      if (response.success) {
        setComments(prev => [...prev, response.data]);
        setNewComment('');
        setDetailTab('comments');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const openEdit = () => {
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      employeeId: task.employeeId || '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate || null,
        employeeId: form.employeeId || null,
      };
      const response = await taskService.updateTask(id, payload);
      if (response.success) {
        setShowEditModal(false);
        fetchData();
      } else {
        setFormError(response.error || 'Failed to update task');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const response = await taskService.deleteTask(id);
      if (response.success) navigate(-1);
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />{error || 'Task not found'}
        </div>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[task.status].icon;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 line-clamp-1">{task.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Task Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: Task Info (2/3) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* Title & Description */}
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-1">{task.title}</h2>
              {task.description ? (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No description provided.</p>
              )}
            </div>

            {/* Details Table */}
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-6 py-3 text-gray-500 w-36">Status</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[task.status].color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {STATUS_CONFIG[task.status].label}
                    </span>
                    {isOverdue(task) && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                        <AlertCircle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-gray-500">Priority</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[task.priority].color}`}>
                      <Flag className="w-3 h-3" />
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-gray-500">Assignee</td>
                  <td className="px-6 py-3">
                    {task.assignee ? (
                      <span className="text-sm font-medium text-gray-900">{task.assignee.firstName} {task.assignee.lastName}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-gray-500">Due Date</td>
                  <td className="px-6 py-3">
                    <span className={`text-sm font-medium ${isOverdue(task) ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatDate(task.dueDate) || '—'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-gray-500">Created</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{formatDate(task.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Activity & Comments Sidebar (1/3) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ minHeight: '420px' }}>
          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-1 pt-1">
            <button
              onClick={() => setDetailTab('activity')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                detailTab === 'activity'
                  ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/30'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Activity className="w-4 h-4" /> Activity
            </button>
            <button
              onClick={() => setDetailTab('comments')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                detailTab === 'comments'
                  ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/30'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Comments
              {comments.length > 0 && (
                <span className="ml-0.5 bg-primary-100 text-primary-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {comments.length}
                </span>
              )}
            </button>
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
            {detailTab === 'activity' ? (
              activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <Activity className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">No activity yet</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
                  <div className="space-y-4">
                    {activities.map(act => {
                      const Icon = ACTIVITY_ICONS[act.action] || Activity;
                      return (
                        <div key={act.id} className="flex gap-3 relative">
                          <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0 z-10">
                            <Icon className="w-3 h-3 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm text-gray-700 leading-snug">
                              <span className="font-semibold text-gray-900">{act.authorName}</span>{' '}
                              {getActivityMessage(act)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(act.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <MessageSquare className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">No comments yet</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to comment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-center overflow-hidden">
                        {comment.authorAvatar ? (
                          <img src={comment.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-primary-700">{comment.authorName?.charAt(0) || '?'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-xl rounded-tl-sm px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-gray-900">{comment.authorName}</span>
                            <span className="text-xs text-gray-400">· {formatRelativeTime(comment.createdAt)} · {new Date(comment.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Comment Input */}
          {detailTab === 'comments' && (
          <div className="p-3 border-t border-gray-100">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Task">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter task title"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              placeholder="Enter task description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="relative">
                <select
                  value={form.priority}
                  onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Employee</label>
            <div className="relative">
              <select
                value={form.employeeId}
                onChange={(e) => setForm(f => ({ ...f, employeeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 appearance-none pr-9"
              >
                <option value="">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Task">
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <strong>"{task.title}"</strong>? This action cannot be undone.
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

export default TaskDetail;
