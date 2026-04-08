import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Calendar,
  MessageSquare,
  AlertCircle,
  X,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  ClipboardList,
  Building2,
  User,
  Activity,
  ArrowRight,
  Flag,
  UserPlus,
  UserMinus,
  Type,
  FileText,
  CalendarDays,
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
  TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-700', icon: Circle },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  DONE: { label: 'Done', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
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
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTab, setDetailTab] = useState('activity');
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Unique clients for filter
  const clients = useMemo(() => {
    const map = new Map();
    allTasks.forEach(t => {
      if (t.client && !map.has(t.client.id)) map.set(t.client.id, t.client.companyName);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allTasks]);

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

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      if (search) {
        const q = search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) return false;
      }
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (clientFilter && task.clientId !== clientFilter) return false;
      return true;
    });
  }, [allTasks, search, statusFilter, priorityFilter, clientFilter]);

  // Stats
  const stats = useMemo(() => {
    const todo = filteredTasks.filter(t => t.status === 'TODO').length;
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const done = filteredTasks.filter(t => t.status === 'DONE').length;
    const overdue = filteredTasks.filter(t => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date(new Date().toDateString())).length;
    return { total: filteredTasks.length, todo, inProgress, done, overdue };
  }, [filteredTasks]);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks Overview</h1>
        <p className="text-sm text-gray-500 mt-1">View all tasks across clients (read-only)</p>
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

      {/* Filters */}
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
        {clients.length > 0 && (
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
            <option value="">All Clients</option>
            {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Status</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Priority</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tasks Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4"><ClipboardList className="w-12 h-12 mx-auto" /></div>
          <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
          <p className="text-gray-500 mt-1">No tasks match the current filters</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Title</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Assignee</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Due Date</TableHeader>
                <TableHeader>Created</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map(task => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(task)}>
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
                  <TableCell><span className="text-sm text-gray-600">{task.client?.companyName || '-'}</span></TableCell>
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
                  <TableCell><span className="text-sm text-gray-500">{formatDate(task.createdAt)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Task Detail Modal (read-only) */}
      <Modal
        isOpen={showDetailModal && !!selectedTask}
        onClose={() => { setShowDetailModal(false); setSelectedTask(null); setComments([]); setActivities([]); }}
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
                  <p className="text-xs text-gray-500 mb-1">Client</p>
                  <p className="font-medium text-gray-900">{selectedTask.client?.companyName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Assignee</p>
                  {selectedTask.assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                        {selectedTask.assignee.profilePhoto ? (
                          <img src={selectedTask.assignee.profilePhoto} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-primary-700">{selectedTask.assignee.firstName?.charAt(0)}</span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{selectedTask.assignee.firstName} {selectedTask.assignee.lastName}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className={`font-medium ${isOverdue(selectedTask) ? 'text-red-500' : 'text-gray-900'}`}>{formatDate(selectedTask.dueDate)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedTask.createdAt)}</p>
                </div>
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

              <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[400px]">
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
                    <p className="text-sm text-gray-400 text-center py-8">No comments</p>
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
                              <span className={`text-xs px-1.5 py-0.5 rounded ${comment.authorRole === 'CLIENT' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {comment.authorRole === 'CLIENT' ? 'Client' : comment.authorRole === 'EMPLOYEE' ? 'Employee' : 'Admin'}
                              </span>
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;
