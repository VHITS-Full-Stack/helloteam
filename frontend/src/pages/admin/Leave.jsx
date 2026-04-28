import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Search,
  Check,
  X,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckSquare,
  Square,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Avatar,
  Modal,
} from "../../components/common";
import leavePolicyService from "../../services/leavePolicy.service";
import clientService from "../../services/client.service";
import employeeService from "../../services/employee.service";
import { formatDate } from "../../utils/formatDateTime";
import { useSearchParams } from "react-router-dom";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "client-approved", label: "Client Approved" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const getStatusBadge = (status) => {
  const map = {
    PENDING: { variant: "warning", label: "Pending" },
    APPROVED_BY_CLIENT: { variant: "info", label: "Client Approved" },
    APPROVED: { variant: "success", label: "Approved" },
    REJECTED: { variant: "danger", label: "Rejected" },
    CANCELLED: { variant: "default", label: "Cancelled" },
  };
  const cfg = map[status] || { variant: "default", label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

const getActionTaken = (request) => {
  const { status, clientApprovedAt, adminApprovedAt, rejectedAt } = request;
  
  if (status === 'PENDING') {
    return <span className="text-xs text-yellow-600">Pending</span>;
  }
  
  if (status === 'CANCELLED') {
    return <span className="text-xs text-gray-500">Cancelled by employee</span>;
  }
  
  let action = '';
  let actionBy = '';
  let actionAt = null;
  let actionTime = '';
  
  if (status === 'REJECTED') {
    action = 'Rejected';
    actionBy = 'Client';
    actionAt = rejectedAt;
  } else if (status === 'APPROVED_BY_CLIENT') {
    action = 'Approved';
    actionBy = 'Client';
    actionAt = clientApprovedAt;
  } else if (status === 'APPROVED') {
    action = 'Approved';
    actionBy = 'Admin';
    actionAt = adminApprovedAt;
  }
  
  if (actionAt) {
    const date = new Date(actionAt);
    const today = new Date();
    const diffMs = today.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 24) {
      actionTime = diffHours === 0 ? 'Just now' : `${diffHours}h ago`;
    } else if (diffDays < 7) {
      actionTime = `${diffDays}d ago`;
    } else {
      actionTime = new Date(actionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  
  return (
    <div className="text-xs space-y-0.5">
      <div className={`font-medium ${status === 'REJECTED' ? 'text-red-600' : 'text-green-600'}`}>
        {action} by {actionBy}
      </div>
      {actionTime && <div className="text-gray-500">{actionTime}</div>}
    </div>
  );
};

const getLeaveTypeLabel = (type) => {
  const labels = { PTO: "PTO", VTO: "VTO", PAID: "PTO", UNPAID: "VTO" };
  return labels[type] || type;
};

const formatDurationFromDays = (days) => {
  const totalMinutes = Math.round(Number(days || 0) * 8 * 60);
  return formatDurationFromMinutes(totalMinutes);
};

const formatDurationFromMinutes = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
};

const today = () => new Date().toISOString().split("T")[0];

const AdminLeave = () => {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    clientApproved: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState(today());
  const [endDateFilter, setEndDateFilter] = useState(today());

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  // Selection
  const [selected, setSelected] = useState([]);

  // Clients list for filter dropdown
  const [filterClients, setFilterClients] = useState([]);

  // Approve confirmation
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Bulk approve confirmation
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Add leave modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addClients, setAddClients] = useState([]);
  const [addEmployees, setAddEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    clientId: "",
    employeeId: "",
    leaveType: "VTO",
    days: [{ date: today(), hours: 8, mins: 0 }],
    notes: "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeType, setActiveType] = useState(
    searchParams.get("type") || "leave",
  );
  const addTotalMinutes = addForm.days.reduce(
    (sum, d) => sum + Number(d.hours) * 60 + Number(d.mins),
    0,
  );
  const addTotalHours = Math.floor(addTotalMinutes / 60);
  const addTotalMins = addTotalMinutes % 60;
  // const handleBulkApprove = async () => {
  //   if (selectedItems.length === 0) return;
  //   setProcessing(true);
  //   try {
  //     if (isOTType) {
  //       for (const id of selectedItems)
  //         await overtimeService.approveOvertimeRequest(id);
  //     } else {
  //       await adminPortalService.bulkApproveTimeRecords(selectedItems);
  //     }
  //     setItems((prev) =>
  //       prev.filter((item) => !selectedItems.includes(item.id)),
  //     );
  //     setTotalItems((prev) => Math.max(0, prev - selectedItems.length));
  //     setSelectedItems([]);
  //     fetchPendingCounts();
  //     window.dispatchEvent(new Event("approvals-updated"));
  //   } catch (error) {
  //     console.error("Bulk approve error:", error);
  //   } finally {
  //     setProcessing(false);
  //   }
  // };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await leavePolicyService.getAllLeaveRequests({
        status: statusFilter,
        clientId: clientFilter !== "all" ? clientFilter : undefined,
        search: search.trim() || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
        page,
        limit: pageSize,
      });
      if (res.success) {
        setRequests(res.data.requests || []);
        setStats(res.data.stats || {});
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalItems(res.data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    clientFilter,
    search,
    startDateFilter,
    endDateFilter,
    page,
  ]);

  // Load all clients for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const allClients = [];
        let currentPage = 1;
        let totalPagesFromApi = 1;

        do {
          const res = await clientService.getClients({
            page: currentPage,
            limit: 200,
          });
          if (!res.success) break;

          const clients = res.data?.clients || res.data || [];
          allClients.push(...clients);
          totalPagesFromApi = res.data?.pagination?.totalPages || 1;
          currentPage += 1;
        } while (currentPage <= totalPagesFromApi);

        const unique = new Map();
        allClients.forEach((client) => {
          if (!client?.id) return;
          const displayName =
            client.companyName || client.name || `Client ${client.id}`;
          unique.set(client.id, displayName);
        });

        const normalizedClients = [...unique.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setFilterClients(normalizedClients);
      } catch (err) {
        console.error("Failed to load clients", err);
      }
    })();
  }, []);

  // Load clients for add modal
  useEffect(() => {
    (async () => {
      try {
        const res = await clientService.getClients({ limit: 200 });
        if (res.success) setAddClients(res.data?.clients || res.data || []);
      } catch (err) {
        console.error("Failed to load clients", err);
      }
    })();
  }, []);

  useEffect(() => {
    fetchRequests();
    setSelected([]);
  }, [fetchRequests]);

  // Load employees when client changes in add modal
  useEffect(() => {
    if (!addForm.clientId) {
      setAddEmployees([]);
      return;
    }
    setEmployeesLoading(true);
    employeeService
      .getEmployees({ clientId: addForm.clientId, limit: 200 })
      .then((res) => {
        if (res.success) setAddEmployees(res.data?.employees || res.data || []);
      })
      .catch(() => {})
      .finally(() => setEmployeesLoading(false));
  }, [addForm.clientId]);

  const handleStatusChange = (s) => {
    setStatusFilter(s);
    setPage(1);
  };
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };
  const handleClientChange = (e) => {
    setClientFilter(e.target.value);
    setPage(1);
  };
  const handleStartDateChange = (e) => {
    const value = e.target.value;
    setStartDateFilter(value);
    if (endDateFilter && value && value > endDateFilter) {
      setEndDateFilter(value);
    }
    setPage(1);
  };
  const handleEndDateChange = (e) => {
    const value = e.target.value;
    setEndDateFilter(value);
    setPage(1);
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  // Approve single (with confirmation)
  const openApproveModal = (request) => {
    setApproveTarget(request);
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setActionLoading(approveTarget.id);
    try {
      const res = await leavePolicyService.approveLeaveRequest(
        approveTarget.id,
      );
      if (res.success) {
        setShowApproveModal(false);
        showSuccess("Leave request approved.");
        fetchRequests();
      } else {
        setError(res.error || "Failed to approve");
      }
    } catch (err) {
      setError(err.message || "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  // Reject
  const openRejectModal = (request) => {
    setRejectTarget(request);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      const res = await leavePolicyService.rejectLeaveRequest(
        rejectTarget.id,
        rejectReason,
      );
      if (res.success) {
        setShowRejectModal(false);
        showSuccess("Leave request rejected.");
        fetchRequests();
      } else {
        setError(res.error || "Failed to reject");
      }
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    setShowBulkModal(false);
    setActionLoading("bulk");
    try {
      const res = await leavePolicyService.bulkApproveLeaveRequests(selected);
      if (res.success) {
        setSelected([]);
        showSuccess(`${selected.length} request(s) approved.`);
        fetchRequests();
      } else {
        setError(res.error || "Failed to bulk approve");
      }
    } catch (err) {
      setError(err.message || "Failed to bulk approve");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const approvableRequests = requests.filter(
    (r) => r.status === "PENDING" || r.status === "APPROVED_BY_CLIENT",
  );
  const allSelected =
    approvableRequests.length > 0 &&
    approvableRequests.every((r) => selected.includes(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? [] : approvableRequests.map((r) => r.id));

  // Add leave submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddSubmitting(true);
    setError("");
    try {
      const res = await leavePolicyService.adminCreateLeave({
        employeeId: addForm.employeeId,
        clientId: addForm.clientId,
        leaveType: addForm.leaveType,
        days: addForm.days,
        notes: addForm.notes,
      });
      if (res.success) {
        setShowAddModal(false);
        setAddForm({
          clientId: "",
          employeeId: "",
          leaveType: "VTO",
          days: [{ date: today(), hours: 8, mins: 0 }],
          notes: "",
        });
        showSuccess("Leave added successfully.");
        setStatusFilter("pending");
        setPage(1);
      } else {
        setError(res.error || "Failed to add leave");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to add leave");
    } finally {
      setAddSubmitting(false);
    }
  };

  const updateDay = (idx, field, value) => {
    const updated = [...addForm.days];
    updated[idx] = { ...updated[idx], [field]: value };
    setAddForm({ ...addForm, days: updated });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage employee leave across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <Button
              variant="primary"
              icon={Check}
              loading={actionLoading === "bulk"}
              onClick={() => setShowBulkModal(true)}
            >
              Approve Selected ({selected.length})
            </Button>
          )}
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowAddModal(true)}
          >
            Add Leave
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 flex-1">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Pending",
            value: stats.pending,
            textColor: "text-yellow-700",
            bg: "bg-yellow-50",
            iconBg: "text-yellow-600",
            Icon: Clock,
            key: "pending",
          },
          {
            label: "Client Approved",
            value: stats.clientApproved,
            textColor: "text-blue-700",
            bg: "bg-blue-50",
            iconBg: "text-blue-600",
            Icon: CheckCircle,
            key: "client-approved",
          },
          {
            label: "Approved",
            value: stats.approved,
            textColor: "text-green-700",
            bg: "bg-green-50",
            iconBg: "text-green-600",
            Icon: CheckCircle,
            key: "approved",
          },
          {
            label: "Rejected",
            value: stats.rejected,
            textColor: "text-red-700",
            bg: "bg-red-50",
            iconBg: "text-red-600",
            Icon: XCircle,
            key: "rejected",
          },
        ].map(({ key, label, value, textColor, bg, iconBg, Icon }) => (
          <button
            key={key}
            onClick={() => handleStatusChange(key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${bg} ${statusFilter === key ? "ring-2 ring-offset-1 ring-primary shadow-sm" : "hover:shadow-sm"}`}
          >
            <div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
              <Icon className={`w-5 h-5 ${iconBg}`} />
            </div>
            <div className="text-left">
              <p className={`text-xl font-bold ${textColor}`}>{value ?? 0}</p>
              <p className={`text-xs ${iconBg}`}>{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employee or client..."
                value={search}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="relative">
              <select
                value={clientFilter}
                onChange={handleClientChange}
                className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Clients</option>
                {filterClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setSelected([]);
                  setPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="client-approved">Client Approved</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                {activeType === "timesheet" && (
                  <option value="revision_requested">Revision Requested</option>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <input
              type="date"
              value={startDateFilter}
              onChange={handleStartDateChange}
              max={endDateFilter || undefined}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Start date"
              title="Start date"
            />
            <input
              type="date"
              value={endDateFilter}
              onChange={handleEndDateChange}
              min={startDateFilter || undefined}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="End date"
              title="End date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No leave requests found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 w-10">
                        <button
                          onClick={toggleAll}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Team Member
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Days Off
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Hours
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Code
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Created At
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Action Taken
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requests.map((r) => {
                      const canAct =
                        r.status === "PENDING" ||
                        r.status === "APPROVED_BY_CLIENT";
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            {canAct ? (
                              <button
                                onClick={() => toggleSelect(r.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {selected.includes(r.id) ? (
                                  <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 h-4 block" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={r.employee.name}
                                size="sm"
                                src={r.employee.profilePhoto}
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {r.employee.name}
                                </p>
                                {r.isShortNotice && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-yellow-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    Short notice
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">
                              {formatDate(r.startDate, { includeYear: true })}
                            </p>
                            {r.startDate !== r.endDate && (
                              <p className="text-xs text-gray-400">
                                to{" "}
                                {formatDate(r.endDate, { includeYear: true })}
                              </p>
                            )}
                            <p className="text-xs font-medium text-primary mt-1">
                              {r.days} days
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {r.client.name}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                            {r.totalMinutes ? (r.totalMinutes / 60) : (r.days * 8)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-medium text-gray-900">
                              {getLeaveTypeLabel(r.leaveType)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(r.createdAt, { includeYear: true })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(r.status)}
                          </td>
                          <td className="px-4 py-3">
                            {getActionTaken(r)}
                          </td>
                          <td className="px-4 py-3">
                            {canAct ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openApproveModal(r)}
                                  disabled={!!actionLoading}
                                  className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 transition-colors"
                                  title="Approve"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openRejectModal(r)}
                                  disabled={!!actionLoading}
                                  className="flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 transition-colors"
                                  title="Reject"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="block text-center text-xs text-gray-400">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, totalItems)} of {totalItems}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${page === p ? "bg-primary text-white" : "text-gray-600 bg-gray-100 hover:bg-gray-200"}`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Leave Request"
      >
        {approveTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p>
                <span className="text-gray-500">Employee:</span>{" "}
                <span className="font-medium">
                  {approveTarget.employee.name}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Client:</span>{" "}
                <span className="font-medium">{approveTarget.client.name}</span>
              </p>
              <p>
                <span className="text-gray-500">Type:</span>{" "}
                <span className="font-medium">
                  {getLeaveTypeLabel(approveTarget.leaveType)}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Dates:</span>{" "}
                <span className="font-medium">
                  {formatDate(approveTarget.startDate, { includeYear: true })} –{" "}
                  {formatDate(approveTarget.endDate, { includeYear: true })}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Days:</span>{" "}
                <span className="font-medium">{approveTarget.days}</span>
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to approve this leave request?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApproveModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Check}
                loading={actionLoading === approveTarget.id}
                onClick={handleApprove}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Leave Request"
      >
        {rejectTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p>
                <span className="text-gray-500">Employee:</span>{" "}
                <span className="font-medium">
                  {rejectTarget.employee.name}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Client:</span>{" "}
                <span className="font-medium">{rejectTarget.client.name}</span>
              </p>
              <p>
                <span className="text-gray-500">Type:</span>{" "}
                <span className="font-medium">
                  {getLeaveTypeLabel(rejectTarget.leaveType)}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Dates:</span>{" "}
                <span className="font-medium">
                  {formatDate(rejectTarget.startDate, { includeYear: true })} –{" "}
                  {formatDate(rejectTarget.endDate, { includeYear: true })}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={actionLoading === rejectTarget?.id}
                onClick={handleReject}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Approve Confirmation Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Approve Selected Requests"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to approve{" "}
            <span className="font-semibold">
              {selected.length} leave request{selected.length !== 1 ? "s" : ""}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBulkModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Check}
              loading={actionLoading === "bulk"}
              onClick={handleBulkApprove}
            >
              Approve All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Leave Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Leave on Behalf of Employee"
      >
        <form onSubmit={handleAddSubmit}>
          <div className="space-y-4">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Client
              </label>
              <div className="relative">
                <select
                  value={addForm.clientId}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      clientId: e.target.value,
                      employeeId: "",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                  required
                >
                  <option value="">Select client...</option>
                  {addClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Employee */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Employee
              </label>
              <div className="relative">
                <select
                  value={addForm.employeeId}
                  onChange={(e) =>
                    setAddForm({ ...addForm, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9 disabled:bg-gray-50"
                  required
                  disabled={!addForm.clientId || employeesLoading}
                >
                  <option value="">
                    {employeesLoading ? "Loading..." : "Select employee..."}
                  </option>
                  {addEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Leave Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Leave Type
              </label>
              <div className="relative">
                <select
                  value={addForm.leaveType}
                  onChange={(e) =>
                    setAddForm({ ...addForm, leaveType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                  required
                >
                  <option value="VTO">VTO (Voluntary Time Off)</option>
                  <option value="PTO">PTO (Paid Time Off)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Per-day rows */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Days
              </label>
              <div className="space-y-2">
                {addForm.days.map((day, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={day.date}
                        onChange={(e) => updateDay(idx, "date", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                    <div className="w-20">
                      <div className="relative">
                        <select
                          value={day.hours}
                          onChange={(e) =>
                            updateDay(idx, "hours", Number(e.target.value))
                          }
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary appearance-none pr-6"
                        >
                          {Array.from({ length: 13 }, (_, i) => (
                            <option key={i} value={i}>
                              {i}h
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div className="w-20">
                      <div className="relative">
                        <select
                          value={day.mins}
                          onChange={(e) =>
                            updateDay(idx, "mins", Number(e.target.value))
                          }
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary appearance-none pr-6"
                        >
                          {[0, 15, 30, 45].map((m) => (
                            <option key={m} value={m}>
                              {String(m).padStart(2, "0")}m
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAddForm({
                          ...addForm,
                          days: addForm.days.filter((_, i) => i !== idx),
                        })
                      }
                      disabled={addForm.days.length === 1}
                      className="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setAddForm({
                    ...addForm,
                    days: [
                      ...addForm.days,
                      { date: today(), hours: 8, mins: 0 },
                    ],
                  })
                }
                className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-700"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs">
                  <Plus className="w-3 h-3" />
                </span>
                Add day
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes
              </label>
              <textarea
                value={addForm.notes}
                onChange={(e) =>
                  setAddForm({ ...addForm, notes: e.target.value })
                }
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                placeholder="Optional notes..."
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {addTotalHours}
                  <span className="text-base font-semibold">h</span>{" "}
                  {String(addTotalMins).padStart(2, "0")}
                  <span className="text-base font-semibold">m</span>
                </span>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={addSubmitting}
                  disabled={
                    !addForm.clientId ||
                    !addForm.employeeId ||
                    addForm.days.some((d) => !d.date) ||
                    addTotalMinutes === 0
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminLeave;
