import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Send,
  Search,
  Clock,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { Card, Button, Badge, Avatar, Modal } from "../../components/common";
import supportTicketService from "../../services/supportTicket.service";

const Support = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // View ticket
  const [selectedTicket, setSelectedTicket] = useState(
    searchParams.get("ticket") || null,
  );
  const [ticketDetail, setTicketDetail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { ticketId, status }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const response = await supportTicketService.getTickets(params);
      if (response.success) {
        setTickets(response.data.tickets || []);
      }
    } catch (err) {
      setError("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Open ticket from URL param (?ticket=id)
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId && !ticketDetail) {
      setSelectedTicket(ticketId);
      fetchTicketDetail(ticketId);
    }
  }, [searchParams]);

  const fetchTicketDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const response = await supportTicketService.getTicket(id);
      if (response.success) setTicketDetail(response.data);
    } catch (err) {
      setError("Failed to load ticket");
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
        isInternal,
      });
      setNewMessage("");
      fetchTicketDetail(selectedTicket);
    } catch (err) {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await supportTicketService.updateTicket(ticketId, { status: newStatus });
      fetchTickets();
      if (selectedTicket === ticketId) fetchTicketDetail(ticketId);
    } catch (err) {
      setError("Failed to update status");
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
      LOW: "text-gray-500 bg-gray-100",
      MEDIUM: "text-blue-600 bg-blue-50",
      HIGH: "text-orange-600 bg-orange-50",
      URGENT: "text-red-600 bg-red-50",
    };
    return (
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[priority] || map.MEDIUM}`}
      >
        {priority}
      </span>
    );
  };

  const stats = {
    open: tickets.filter((t) => t.status === "OPEN").length,
    inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
    resolved: tickets.filter((t) => t.status === "RESOLVED").length,
  };

  // Ticket detail view
  if (selectedTicket && ticketDetail) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header with back button and title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedTicket(null);
              setTicketDetail(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {ticketDetail.subject}
          </h2>
        </div>

        {/* Two column layout: Left = ticket info, Right = chat */}
<div className="grid grid-cols-3 gap-4">
          {/* Left Column - Ticket Info */}
          <div className="col-span-2 space-y-4">
            {/* Ticket Meta Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Avatar
                  name={`${ticketDetail.employee?.firstName} ${ticketDetail.employee?.lastName}`}
                  src={ticketDetail.employee?.profilePhoto}
                  size="lg"
                />
                <div>
                  <p className="font-semibold text-gray-900">
                    {ticketDetail.employee?.firstName} {ticketDetail.employee?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {ticketDetail.employee?.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(ticketDetail.status)}
                    {getPriorityBadge(ticketDetail.priority)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticketDetail.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Created</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(ticketDetail.createdAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(ticketDetail.updatedAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                  {ticketDetail.status === "OPEN" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(selectedTicket, "IN_PROGRESS")}
                    >
                      Mark In Progress
                    </Button>
                  )}
                  {(ticketDetail.status === "OPEN" ||
                    ticketDetail.status === "IN_PROGRESS") && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={CheckCircle}
                      onClick={() =>
                        setConfirmAction({
                          ticketId: selectedTicket,
                          status: "RESOLVED",
                        })
                      }
                    >
                      Resolve
                    </Button>
                  )}
                  {ticketDetail.status !== "CLOSED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirmAction({ ticketId: selectedTicket, status: "CLOSED" })
                      }
                    >
                      Close
                    </Button>
                  )}
                </div>
              </div>

              
            </div>
          </div>

          {/* Right Column - Chat */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col">
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-gray-900">Chat</h3>
                  <span className="text-xs text-gray-400">
                    ({ticketDetail.messages?.length || 0})
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(ticketDetail.messages || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-gray-500">No messages yet</p>
                    <p className="text-xs text-gray-400">Start the conversation</p>
                  </div>
                ) : (
                  ticketDetail.messages.map((msg) => {
                    const isAdmin = msg.senderType === "admin";
                    const isEmployee = msg.senderType === "employee";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                            msg.isInternal
                              ? "bg-yellow-50 border border-yellow-200"
                              : isAdmin
                                ? "bg-primary text-white rounded-br-md"
                                : isEmployee
                                  ? "bg-gray-100 text-gray-900 rounded-bl-md"
                                  : "bg-primary/10 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          {!isAdmin && (
                            <p className={`text-xs font-medium mb-1 ${
                              msg.isInternal
                                ? "text-yellow-700"
                                : "text-gray-500"
                            }`}>
                              {msg.senderName ||
                                (msg.senderType === "employee"
                                  ? `${ticketDetail.employee?.firstName} ${ticketDetail.employee?.lastName}`
                                  : msg.senderType === "client"
                                    ? "Client"
                                    : "Admin")}
                              {msg.isInternal && (
                                <span className="text-yellow-600 ml-1">(Internal)</span>
                              )}
                            </p>
                          )}
                          <p className={isAdmin ? "text-white" : "text-gray-700"}>
                            {msg.message}
                          </p>
                          <p className={`text-[10px] mt-1.5 ${
                            isAdmin ? "text-white/70" : "text-gray-400"
                          }`}>
                            {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Input */}
              {ticketDetail.status !== "CLOSED" && (
                <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
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
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                        style={{ minHeight: "42px", maxHeight: "100px" }}
                      />
                    </div>
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

        {/* Confirm Resolve/Close Modal */}
        <Modal
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={
            confirmAction?.status === "RESOLVED"
              ? "Resolve Ticket"
              : "Close Ticket"
          }
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant={
                  confirmAction?.status === "RESOLVED" ? "primary" : "danger"
                }
                icon={confirmAction?.status === "RESOLVED" ? CheckCircle : X}
                onClick={async () => {
                  await handleStatusChange(
                    confirmAction.ticketId,
                    confirmAction.status,
                  );
                  setConfirmAction(null);
                }}
              >
                {confirmAction?.status === "RESOLVED" ? "Resolve" : "Close"}
              </Button>
            </>
          }
        >
          <p className="text-gray-700">
            Are you sure you want to{" "}
            {confirmAction?.status === "RESOLVED" ? "resolve" : "close"} this
            ticket?
            {confirmAction?.status === "CLOSED" && (
              <span className="block text-sm text-gray-500 mt-1">
                This action cannot be undone.
              </span>
            )}
          </p>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
        <p className="text-gray-500">Manage employee support requests</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700">{stats.open}</p>
            <p className="text-xs text-amber-600">Open</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-700">
              {stats.inProgress}
            </p>
            <p className="text-xs text-blue-600">In Progress</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-700">{stats.resolved}</p>
            <p className="text-xs text-green-600">Resolved</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
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

      {/* Tickets List */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => {
                  setSelectedTicket(ticket.id);
                  fetchTicketDetail(ticket.id);
                }}
                className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4"
              >
                <Avatar
                  name={`${ticket.employee?.firstName} ${ticket.employee?.lastName}`}
                  src={ticket.employee?.profilePhoto}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ticket.employee?.firstName} {ticket.employee?.lastName}{" "}
                    &middot; {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(ticket.status)}
                  {getPriorityBadge(ticket.priority)}
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-xs">
                    {ticket._count?.messages || 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Support;
