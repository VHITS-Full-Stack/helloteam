import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  AlertCircle,
  X,
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
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/common';
import taskService from '../../services/task.service';
import clientService from '../../services/client.service';
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


const Tasks = () => {
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [tasksRes, clientsRes] = await Promise.all([
        taskService.getTasks({ limit: 200 }),
        clientService.getClients({ limit: 200 }),
      ]);
      if (tasksRes.success) setAllTasks(tasksRes.data.tasks);
      if (clientsRes.success) setClients(clientsRes.data.clients.map(c => ({ id: c.id, name: c.companyName })));
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


  const isOverdue = (task) => {
    if (!task.dueDate || task.status === 'DONE') return false;
    return new Date(task.dueDate) < new Date(new Date().toDateString());
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

    </div>
  );
};

export default Tasks;
