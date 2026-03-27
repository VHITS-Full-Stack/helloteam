import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, Clock, AlertCircle, Loader2, ArrowLeft, X, ChevronDown } from 'lucide-react';
import { Card, Button, Badge, Avatar } from '../../components/common';
import supportTicketService from '../../services/supportTicket.service';

const ClientSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // View ticket
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await supportTicketService.getTickets(params);
      if (response.success) setTickets(response.data.tickets || []);
    } catch (err) {
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const fetchTicketDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const response = await supportTicketService.getTicket(id);
      if (response.success) setTicketDetail(response.data);
    } catch (err) {
      setError('Failed to load ticket');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      OPEN: { variant: 'warning', label: 'Open' },
      IN_PROGRESS: { variant: 'info', label: 'In Progress' },
      RESOLVED: { variant: 'success', label: 'Resolved' },
      CLOSED: { variant: 'default', label: 'Closed' },
    };
    const s = map[status] || { variant: 'default', label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const map = {
      LOW: 'text-gray-500 bg-gray-100',
      MEDIUM: 'text-blue-600 bg-blue-50',
      HIGH: 'text-orange-600 bg-orange-50',
      URGENT: 'text-red-600 bg-red-50',
    };
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[priority] || map.MEDIUM}`}>{priority}</span>;
  };

  // Ticket detail view (read-only for client)
  if (selectedTicket && ticketDetail) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedTicket(null); setTicketDetail(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <Avatar name={`${ticketDetail.employee?.firstName} ${ticketDetail.employee?.lastName}`} src={ticketDetail.employee?.profilePhoto} size="sm" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{ticketDetail.subject}</h2>
              <p className="text-xs text-gray-500">
                {ticketDetail.employee?.firstName} {ticketDetail.employee?.lastName} &middot; {new Date(ticketDetail.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(ticketDetail.status)}
            {getPriorityBadge(ticketDetail.priority)}
          </div>
        </div>

        <Card>
          <p className="text-sm text-gray-700">{ticketDetail.description}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Employee Support Tickets</h2>
        <p className="text-gray-500">View support tickets from your employees</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets from your employees</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => { setSelectedTicket(ticket.id); fetchTicketDetail(ticket.id); }}
                className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4"
              >
                <Avatar name={`${ticket.employee?.firstName} ${ticket.employee?.lastName}`} src={ticket.employee?.profilePhoto} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ticket.employee?.firstName} {ticket.employee?.lastName} &middot; {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(ticket.status)}
                  {getPriorityBadge(ticket.priority)}
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-xs">{ticket._count?.messages || 0}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientSupport;
