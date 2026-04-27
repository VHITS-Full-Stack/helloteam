import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Send,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  HelpCircle,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, Button, Badge } from "../../components/common";
import supportTicketService from "../../services/supportTicket.service";

const Support = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    subject: "",
    category: "Time & Attendance",
    message: "",
  });

  // View ticket detail
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await supportTicketService.getTickets();
      if (response.success) {
        setTickets(response.data.tickets || []);
      }
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) {
      setError("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await supportTicketService.createTicket({
        subject: form.subject,
        description: `[${form.category}] ${form.message}`,
        priority: "MEDIUM",
      });
      if (response.success) {
        setSuccess("Ticket submitted successfully!");
        setForm({ subject: "", category: "Time & Attendance", message: "" });
        fetchTickets();
      }
    } catch (err) {
      setError(err.error || "Failed to submit ticket");
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
      console.error("Failed to fetch ticket:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await supportTicketService.addMessage(selectedTicket, {
        message: newMessage.trim(),
      });
      setNewMessage("");
      fetchTicketDetail(selectedTicket);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      OPEN: { variant: "warning", label: "Open" },
      IN_PROGRESS: { variant: "info", label: "In Progress" },
      RESOLVED: { variant: "success", label: "Resolved" },
      CLOSED: { variant: "default", label: "Closed" },
    };
    const s = map[status] || { variant: "default", label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const map = {
      LOW: { variant: "default", label: "Low" },
      MEDIUM: { variant: "info", label: "Medium" },
      HIGH: { variant: "warning", label: "High" },
      URGENT: { variant: "danger", label: "Urgent" },
    };
    const p = map[priority] || map.MEDIUM;
    return <Badge variant={p.variant}>{p.label}</Badge>;
  };

  // Ticket detail view
  if (selectedTicket && ticketDetail) {
    const visibleMessages = (ticketDetail.messages || []).filter(
      (m) => !m.isInternal,
    );

    const category = ticketDetail.description?.match(/^\[(.+?)\]/)?.[1] || "—";
    const descText =
      ticketDetail.description?.replace(/^\[.+?\]\s*/, "") ||
      ticketDetail.description;

    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => {
            setSelectedTicket(null);
            setTicketDetail(null);
          }}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          Back
        </button>

        <div className="grid grid-cols-3 gap-4">
          {/* Left Column - Ticket Details */}
          <div className="col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {ticketDetail.subject}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>#{ticketDetail.id.slice(0, 8).toUpperCase()}</span>
                    <span className="w-0.5 h-0.5 bg-gray-300 rounded-full" />
                    <span className="text-primary font-medium">{category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(ticketDetail.status)}
                  {getPriorityBadge(ticketDetail.priority)}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700">{descText}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Created</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(ticketDetail.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(ticketDetail.updatedAt).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Chat */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-gray-900">Chat</h3>
                <span className="text-xs text-gray-400">
                  ({visibleMessages.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-350px)]">
                {visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-gray-500">No messages yet</p>
                    <p className="text-xs text-gray-400">
                      Start the conversation
                    </p>
                  </div>
                ) : (
                  visibleMessages.map((msg) => {
                    const isEmployee = msg.senderType === "employee";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isEmployee ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                            isEmployee
                              ? "bg-primary text-white rounded-br-md"
                              : "bg-gray-100 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          {!isEmployee && (
                            <p className="text-xs font-medium mb-1 text-gray-500">
                              Admin
                            </p>
                          )}
                          <p
                            className={
                              isEmployee ? "text-white" : "text-gray-700"
                            }
                          >
                            {msg.message}
                          </p>
                          <p
                            className={`text-[10px] mt-1.5 ${isEmployee ? "text-white/70" : "text-gray-400"}`}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {ticketDetail.status !== "CLOSED" && (
                <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                  <div className="flex items-end gap-2">
                    <textarea
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={1}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      style={{ minHeight: "42px", maxHeight: "100px" }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Send}
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="!h-10 !w-10 !p-0 shrink-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
            <div className="p-2 bg-green-50 rounded-lg">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Phone Support</p>
              <p className="text-xs text-gray-500">1-800-HELLO-TM</p>
            </div>
          </div>
          <Button variant="outline" className="w-full">
            Call Now
          </Button>
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
          <Button variant="outline" className="w-full">
            Send Email
          </Button>
        </Card>
      </div>

      {/* Submit a Ticket + FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Submit a Ticket */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Submit a Ticket
          </h3>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                placeholder="Brief description of your issue"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                placeholder="Describe your issue in detail..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              icon={Send}
              loading={submitting}
            >
              Submit Ticket
            </Button>
          </form>
        </Card>

        {/* FAQ */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">FAQ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              {
                q: "How do I request time off?",
                a: "Navigate to Leave Requests and click 'New Request'.",
              },
              {
                q: "What if I forget to clock out?",
                a: "Contact support to request a time adjustment.",
              },
              {
                q: "How do I update my profile?",
                a: "Go to Profile settings to update your information.",
              },
              {
                q: "Who approves my timesheets?",
                a: "Your client manager reviews, then Hello Team approves.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="flex gap-2.5 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-900">{faq.q}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* My Tickets */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">My Tickets</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No tickets yet. Submit one above!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Subject
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Priority
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => {
                  const category =
                    ticket.description?.match(/^\[(.+?)\]/)?.[1] || "—";
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket.id);
                        fetchTicketDetail(ticket.id);
                      }}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[250px]">
                          {ticket.subject}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPriorityBadge(ticket.priority)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(ticket.status)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {new Date(
                            ticket.updatedAt || ticket.createdAt,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className="w-4 h-4 text-gray-400 inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Support;
