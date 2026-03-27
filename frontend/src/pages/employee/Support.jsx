import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Phone, Mail, Clock, ChevronRight, HelpCircle, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';
import supportTicketService from '../../services/supportTicket.service';

const Support = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ subject: '', category: 'Time & Attendance', message: '' });

  // View ticket detail
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await supportTicketService.getTickets();
      if (response.success) {
        setTickets(response.data.tickets || []);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) {
      setError('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await supportTicketService.createTicket({
        subject: form.subject,
        description: `[${form.category}] ${form.message}`,
        priority: 'MEDIUM',
      });
      if (response.success) {
        setSuccess('Ticket submitted successfully!');
        setForm({ subject: '', category: 'Time & Attendance', message: '' });
        fetchTickets();
      }
    } catch (err) {
      setError(err.error || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchTicketDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const response = await supportTicketService.getTicket(id);
      if (response.success) setTicketDetail(response.data);
    } catch (err) {
      console.error('Failed to fetch ticket:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await supportTicketService.addMessage(selectedTicket, { message: newMessage.trim() });
      setNewMessage('');
      fetchTicketDetail(selectedTicket);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
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
      LOW: { variant: 'default', label: 'Low' },
      MEDIUM: { variant: 'info', label: 'Medium' },
      HIGH: { variant: 'warning', label: 'High' },
      URGENT: { variant: 'danger', label: 'Urgent' },
    };
    const p = map[priority] || map.MEDIUM;
    return <Badge variant={p.variant}>{p.label}</Badge>;
  };

  // Ticket detail view
  if (selectedTicket && ticketDetail) {
    const visibleMessages = (ticketDetail.messages || []).filter(m => !m.isInternal);

    return (
      <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
        {/* Header */}
        <Card>
          <div className="flex items-start gap-4">
            <button
              onClick={() => { setSelectedTicket(null); setTicketDetail(null); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-0.5"
            >
              <ChevronRight className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{ticketDetail.subject}</h2>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(ticketDetail.priority)}
                  {getStatusBadge(ticketDetail.status)}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Ticket #{ticketDetail.id.slice(0, 8).toUpperCase()} &middot; Opened {new Date(ticketDetail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {ticketDetail.resolvedAt && ` &middot; Resolved ${new Date(ticketDetail.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </p>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{ticketDetail.description}</p>
              </div>
            </div>
          </div>
        </Card>

      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Support</h2>
        <p className="text-gray-500">Get help and contact our support team</p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Live Chat</p>
              <p className="text-xs text-gray-500">Available 9 AM – 6 PM</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate('/employee/chat')}>Start Chat</Button>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Phone Support</p>
              <p className="text-xs text-gray-500">1-800-HELLO-TM</p>
            </div>
          </div>
          <Button variant="outline" className="w-full">Call Now</Button>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Mail className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Email</p>
              <p className="text-xs text-gray-500">support@helloteam.com</p>
            </div>
          </div>
          <Button variant="outline" className="w-full">Send Email</Button>
        </Card>
      </div>

      {/* Submit a Ticket + FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Submit a Ticket */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit a Ticket</h3>

          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && (
            <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                placeholder="Brief description of your issue"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option>Time & Attendance</option>
                <option>Pay & Benefits</option>
                <option>Schedule</option>
                <option>Leave & PTO</option>
                <option>Technical Issue</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                placeholder="Describe your issue in detail..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full" icon={Send} loading={submitting}>
              Submit Ticket
            </Button>
          </form>
        </Card>

        {/* FAQ */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            {[
              { q: 'How do I request time off?', a: "Navigate to Leave Requests and click 'New Request'." },
              { q: 'What if I forget to clock out?', a: 'Contact support to request a time adjustment.' },
              { q: 'How do I update my profile?', a: 'Go to Profile settings to update your information.' },
              { q: 'Who approves my timesheets?', a: 'Your client manager reviews, then Hello Team approves.' },
            ].map((faq, i) => (
              <div key={i} className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{faq.q}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* My Tickets */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Tickets</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No tickets yet. Submit one above!</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => { setSelectedTicket(ticket.id); fetchTicketDetail(ticket.id); }}
                className="w-full py-3 flex items-center gap-3 text-left hover:bg-gray-50 -mx-1 px-1 rounded transition-colors"
              >
                <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ticket.description?.match(/^\[(.+?)\]/) && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {ticket.description.match(/^\[(.+?)\]/)[1]}
                      </span>
                    )}
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">
                      {new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getPriorityBadge(ticket.priority)}
                  {getStatusBadge(ticket.status)}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Support;
