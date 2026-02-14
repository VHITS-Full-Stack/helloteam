import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  MessageSquare,
  AlertCircle,
  X,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  ClipboardList,
  User,
} from 'lucide-react';
import {
  Card,
  Button,
} from '../../components/common';
import taskService from '../../services/task.service';

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

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await taskService.getTasks({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      if (response.success) {
        setTasks(response.data.tasks);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (task, newStatus) => {
    try {
      const response = await taskService.updateTaskStatus(task.id, newStatus);
      if (response.success) {
        fetchTasks();
        if (showDetailModal && selectedTask?.id === task.id) {
          setSelectedTask(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const openDetail = async (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
    setLoadingComments(true);
    try {
      const response = await taskService.getTask(task.id);
      if (response.success) {
        setSelectedTask(response.data);
        setComments(response.data.comments || []);
      }
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;

    setSubmittingComment(true);
    try {
      const response = await taskService.addTaskComment(selectedTask.id, newComment.trim());
      if (response.success) {
        setComments(prev => [...prev, response.data]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (task) => {
    if (!task.dueDate || task.status === 'DONE') return false;
    return new Date(task.dueDate) < new Date(new Date().toDateString());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">Tasks assigned to you by your manager</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <ClipboardList className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No tasks assigned</h3>
          <p className="text-gray-500 mt-1">You don't have any tasks yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <Card
              key={task.id}
              className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${isOverdue(task) ? 'border-l-4 border-l-red-400' : ''}`}
              onClick={() => openDetail(task)}
            >
              <div className="flex items-start gap-4">
                {/* Status toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextStatus = task.status === 'TODO' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
                    handleStatusChange(task, nextStatus);
                  }}
                  className="mt-0.5 flex-shrink-0"
                  title={`Click to change status (${STATUS_CONFIG[task.status].label})`}
                >
                  {(() => {
                    const StatusIcon = STATUS_CONFIG[task.status].icon;
                    return <StatusIcon className={`w-5 h-5 ${task.status === 'DONE' ? 'text-green-500' : task.status === 'IN_PROGRESS' ? 'text-blue-500' : 'text-gray-400'}`} />;
                  })()}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-medium ${task.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[task.priority].color}`}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[task.status].color}`}>
                      {STATUS_CONFIG[task.status].label}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {task.client && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.client.companyName}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-500 font-medium' : ''}`}>
                        <Calendar className="w-3 h-3" />
                        {formatDate(task.dueDate)}
                        {isOverdue(task) && ' (Overdue)'}
                      </span>
                    )}
                    {task._count?.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {task._count.comments}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Task Detail Modal with Comments */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowDetailModal(false); setSelectedTask(null); setComments([]); setNewComment(''); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedTask(null); setComments([]); setNewComment(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Task Info */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
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
                <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{selectedTask.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                  {selectedTask.dueDate && (
                    <span className={`flex items-center gap-1 ${isOverdue(selectedTask) ? 'text-red-500' : ''}`}>
                      <Calendar className="w-4 h-4" />
                      Due: {formatDate(selectedTask.dueDate)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Created: {formatDate(selectedTask.createdAt)}
                  </span>
                </div>

                {/* Status buttons */}
                <div className="flex gap-2 mt-4">
                  {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(selectedTask, status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedTask.status === status
                          ? STATUS_CONFIG[status].color + ' ring-2 ring-offset-1 ring-primary-400'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {STATUS_CONFIG[status].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments ({comments.length})
                </h3>

                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {comments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          {comment.authorAvatar ? (
                            <img src={comment.authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-primary-700">
                              {comment.authorName?.charAt(0) || '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{comment.authorName}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(comment.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment */}
                <form onSubmit={handleAddComment} className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <Button
                    type="submit"
                    disabled={!newComment.trim() || submittingComment}
                    size="sm"
                  >
                    {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
