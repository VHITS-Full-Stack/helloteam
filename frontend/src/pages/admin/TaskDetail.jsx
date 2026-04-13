import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  MessageSquare,
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
} from 'lucide-react';
import taskService from '../../services/task.service';
import { formatDate } from '../../utils/formatDateTime';

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-600 border border-gray-200' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  HIGH: { label: 'High', color: 'bg-orange-50 text-orange-700 border border-orange-200' },
  URGENT: { label: 'Urgent', color: 'bg-red-50 text-red-700 border border-red-200' },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailTab, setDetailTab] = useState('activity');

  useEffect(() => {
    const fetchData = async () => {
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
    };
    fetchData();
  }, [id]);

  const isOverdue = (t) => {
    if (!t.dueDate || t.status === 'DONE') return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 line-clamp-1">{task.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{task.client?.companyName || 'Task'}</p>
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
                  <td className="px-6 py-3 text-gray-500">Client</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{task.client?.companyName || '—'}</td>
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
                  <p className="text-sm text-gray-400">No comments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {comment.authorAvatar ? (
                          <img src={comment.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-primary-700">{comment.authorName?.charAt(0) || '?'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-xl rounded-tl-sm px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-gray-900">{comment.authorName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${comment.authorRole === 'CLIENT' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                              {comment.authorRole === 'CLIENT' ? 'Client' : comment.authorRole === 'EMPLOYEE' ? 'Employee' : 'Admin'}
                            </span>
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
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
