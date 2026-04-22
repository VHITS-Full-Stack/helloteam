import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Avatar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Modal,
} from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";
import overtimeService from "../../services/overtime.service";
import {
  formatDate,
  formatDateTime,
  formatHours,
  formatTime12,
  formatTimeInTimeZone,
  formatDuration,
} from "../../utils/formatDateTime";

const Approvals = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("status") === "revision_requested"
      ? "revision_requested"
      : "pending",
  );
  const [activeType, setActiveType] = useState(
    searchParams.get("type") === "overtime" ||
      searchParams.get("tab") === "overtime"
      ? "overtime"
      : searchParams.get("type") === "auto-overtime"
        ? "autoOvertime"
        : searchParams.get("type") === "timesheet"
          ? "timesheet"
          : "leave",
  );
  const [approvals, setApprovals] = useState([]);
  const [timesheetApprovals, setTimesheetApprovals] = useState([]);
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [autoOvertimeRequests, setAutoOvertimeRequests] = useState([]);
  const [summary, setSummary] = useState({
    pending: 0,
    overtimePending: 0,
    approvedThisWeek: 0,
    rejectedThisWeek: 0,
  });
  const [timesheetSummary, setTimesheetSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    revision_requested: 0,
  });
  const [overtimeSummary, setOvertimeSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalApprovedMinutes: 0,
    totalPendingMinutes: 0,
  });
  const [autoOvertimeSummary, setAutoOvertimeSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalApprovedMinutes: 0,
    totalPendingMinutes: 0,
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [clientTimezone, setClientTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  const fetchingApprovalsRef = useRef(false);
  const fetchingTimesheetsRef = useRef(false);
  const fetchingOvertimeRef = useRef(false);

  const fetchApprovals = useCallback(async () => {
    if (fetchingApprovalsRef.current) return;
    fetchingApprovalsRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getApprovals({
        status: activeTab,
        type: "leave",
        page: 1,
        limit: 50,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      if (response.success) {
        // Only keep leave requests
        const leaveOnly = (response.data.approvals || []).filter(
          (a) => a.type === "leave",
        );
        setApprovals(leaveOnly);
        setSummary(
          response.data.summary || {
            pending: 0,
            overtimePending: 0,
            approvedThisWeek: 0,
            rejectedThisWeek: 0,
          },
        );
        if (response.data.clientTimezone)
          setClientTimezone(response.data.clientTimezone);
      } else {
        setError(response.error || "Failed to load approvals");
      }
    } catch (err) {
      console.error("Error fetching approvals:", err);
      setError(err?.data?.error || err?.message || "Failed to load approvals");
    } finally {
      setLoading(false);
      fetchingApprovalsRef.current = false;
    }
  }, [activeTab, dateRange.startDate, dateRange.endDate]);

  const fetchTimesheets = useCallback(async () => {
    if (fetchingTimesheetsRef.current) return;
    fetchingTimesheetsRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getApprovals({
        status: "all",
        type: "timesheet",
        page: 1,
        limit: 100,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      if (response.success) {
        const timeOnly = (response.data.approvals || []).filter(
          (a) => a.type === "timesheet",
        );
        setTimesheetApprovals(timeOnly);
        const pending = timeOnly.filter((a) => a.status === "pending").length;
        const approved = timeOnly.filter(
          (a) => a.status === "approved" || a.status === "auto_approved",
        ).length;
        const revision_requested = timeOnly.filter(
          (a) => a.status === "revision_requested",
        ).length;
        const rejected = timeOnly.filter((a) => a.status === "rejected").length;
        setTimesheetSummary({
          pending,
          approved,
          revision_requested,
          rejected,
        });
        if (response.data.clientTimezone)
          setClientTimezone(response.data.clientTimezone);
      } else {
        setError(response.error || "Failed to load timesheets");
      }
    } catch (err) {
      console.error("Error fetching timesheets:", err);
      setError(err?.data?.error || err?.message || "Failed to load timesheets");
    } finally {
      setLoading(false);
      fetchingTimesheetsRef.current = false;
    }
  }, [dateRange.startDate, dateRange.endDate]);

  const fetchOvertimeRequests = useCallback(async () => {
    if (fetchingOvertimeRef.current) return;
    fetchingOvertimeRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const status =
        activeTab === "pending"
          ? "PENDING"
          : activeTab === "approved"
            ? "APPROVED"
            : "REJECTED";
      const [requestsResponse, summaryResponse] = await Promise.all([
        overtimeService.getOvertimeRequests({
          status,
          isAutoGenerated: "false",
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
        overtimeService.getOvertimeSummary({
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
      ]);

      if (requestsResponse.success) {
        setOvertimeRequests(requestsResponse.data.requests || []);
      }
      if (summaryResponse.success) {
        setOvertimeSummary(
          summaryResponse.data || {
            pending: 0,
            approved: 0,
            rejected: 0,
            totalApprovedMinutes: 0,
            totalPendingMinutes: 0,
          },
        );
      }
    } catch (err) {
      console.error("Error fetching overtime requests:", err);
      setError("Failed to load overtime requests");
    } finally {
      setLoading(false);
      fetchingOvertimeRef.current = false;
    }
  }, [activeTab, dateRange.startDate, dateRange.endDate]);

  const fetchAutoOvertimeRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch ALL auto-OT requests to build summary counts, then filter by active tab
      const requestsResponse = await overtimeService.getOvertimeRequests({
        isAutoGenerated: "true",
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });

      if (requestsResponse.success) {
        const allRequests = requestsResponse.data.requests || [];
        const pending = allRequests.filter(
          (r) => r.status === "PENDING",
        ).length;
        const approved = allRequests.filter(
          (r) => r.status === "APPROVED",
        ).length;
        const rejected = allRequests.filter(
          (r) => r.status === "REJECTED",
        ).length;
        setAutoOvertimeSummary({
          pending,
          approved,
          rejected,
          totalApprovedMinutes: 0,
          totalPendingMinutes: 0,
        });

        // Filter by active tab for display
        const statusFilter =
          activeTab === "pending"
            ? "PENDING"
            : activeTab === "approved"
              ? "APPROVED"
              : "REJECTED";
        setAutoOvertimeRequests(
          allRequests.filter((r) => r.status === statusFilter),
        );
      }
    } catch (err) {
      console.error("Error fetching auto overtime requests:", err);
      setError("Failed to load overtime without prior approval");
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange.startDate, dateRange.endDate]);

  // Always fetch overtime summary so the pending badge shows on the tab
  const initialOTFetchDone = useRef(false);
  useEffect(() => {
    if (!initialOTFetchDone.current) {
      initialOTFetchDone.current = true;
      // Fetch OT summary in background to show pending count on tab badge
      (async () => {
        try {
          const [summaryRes, autoRes, tsRes] = await Promise.all([
            overtimeService.getOvertimeSummary({}),
            overtimeService.getOvertimeRequests({
              status: "PENDING",
              isAutoGenerated: "true",
            }),
            clientPortalService.getApprovals({
              status: "pending",
              type: "timesheet",
              page: 1,
              limit: 1,
            }),
          ]);
          if (summaryRes.success) {
            const otSummary = summaryRes.data || {
              pending: 0,
              approved: 0,
              rejected: 0,
              totalApprovedMinutes: 0,
              totalPendingMinutes: 0,
            };
            setOvertimeSummary(otSummary);
          }
          if (autoRes.success) {
            const autoPending = (autoRes.data.requests || []).length;
            setAutoOvertimeSummary((prev) => ({
              ...prev,
              pending: autoPending,
            }));
            // Auto-switch to auto OT tab if there are pending auto OT
            if (
              autoPending > 0 &&
              activeType === "leave" &&
              !searchParams.get("type")
            ) {
              setActiveType("autoOvertime");
            }
          }
          if (tsRes?.success) {
            const pending = tsRes.data?.pagination?.total || 0;
            setTimesheetSummary((prev) => ({ ...prev, pending }));
          }
        } catch (e) {
          console.error("Failed to fetch OT summary:", e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (activeType === "leave") {
      fetchApprovals();
    } else if (activeType === "timesheet") {
      fetchTimesheets();
    } else if (activeType === "overtime") {
      fetchOvertimeRequests();
    } else if (activeType === "autoOvertime") {
      fetchAutoOvertimeRequests();
    }
    setSelectedItems([]);
  }, [
    activeType,
    activeTab,
    fetchApprovals,
    fetchTimesheets,
    fetchOvertimeRequests,
    fetchAutoOvertimeRequests,
  ]);

  const getTypeBadge = (type) => {
    switch (type) {
      case "time-entry":
        return <Badge variant="info">Time Entry</Badge>;
      case "overtime":
        return <Badge variant="warning">Overtime</Badge>;
      case "leave":
        return <Badge variant="primary">Leave</Badge>;
      case "adjustment":
        return <Badge variant="default">Adjustment</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const getTabCount = (tabId) => {
    if (activeType === "leave") {
      return tabId === "pending"
        ? summary.pending
        : tabId === "approved"
          ? summary.approvedThisWeek
          : summary.rejectedThisWeek;
    }
    if (activeType === "timesheet") {
      if (tabId === "pending") return timesheetSummary.pending;
      if (tabId === "approved") return timesheetSummary.approved;
      if (tabId === "revision_requested")
        return timesheetSummary.revision_requested;
      return timesheetSummary.rejected;
    }
    if (activeType === "autoOvertime") {
      return tabId === "pending"
        ? autoOvertimeSummary.pending
        : tabId === "approved"
          ? autoOvertimeSummary.approved
          : autoOvertimeSummary.rejected;
    }
    return tabId === "pending"
      ? overtimeSummary.pending
      : tabId === "approved"
        ? overtimeSummary.approved
        : overtimeSummary.rejected;
  };

  const tabs =
    activeType === "timesheet"
      ? [
          { id: "pending", label: "Pending", count: getTabCount("pending") },
          { id: "approved", label: "Approved", count: getTabCount("approved") },
          // { id: "revision_requested", label: "Revision Requested", count: getTabCount("revision_requested") },
          { id: "rejected", label: "Rejected", count: getTabCount("rejected") },
        ]
      : [
          { id: "pending", label: "Pending", count: getTabCount("pending") },
          { id: "approved", label: "Approved", count: getTabCount("approved") },
          { id: "rejected", label: "Rejected", count: getTabCount("rejected") },
        ];

  const getStatusBadge = (status) => {
    const s = (status || "").toString().toUpperCase();
    if (s === "APPROVED" || s === "AUTO_APPROVED")
      return <Badge variant="success">Approved</Badge>;
    if (s === "PENDING") return <Badge variant="warning">Pending</Badge>;
    if (s === "REVISION_REQUESTED")
      return (
        <Badge variant="warning" className="bg-amber-100 text-amber-800">
          Revision
        </Badge>
      );
    if (s === "REJECTED") return <Badge variant="danger">Rejected</Badge>;
    return <Badge variant="default">{status}</Badge>;
  };

  const handleApprove = async (item) => {
    setSelectedItem(item);
    setShowApprovalModal(true);
  };

  const handleReject = (item) => {
    setSelectedItem(item);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleRequestRevision = (item) => {
    setSelectedItem(item);
    setRevisionReason("");
    setShowRevisionModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      let response;
      if (activeType === "overtime" || activeType === "autoOvertime") {
        response = await overtimeService.approveOvertimeRequest(
          selectedItem.id,
        );
      } else if (
        activeType === "timesheet" ||
        selectedItem.type === "time-entry"
      ) {
        response = await clientPortalService.approveTimeRecord(selectedItem.id);
      } else if (selectedItem.type === "leave") {
        response = await clientPortalService.approveLeaveRequest(
          selectedItem.id,
        );
      } else {
        response = await clientPortalService.approveTimeRecord(selectedItem.id);
      }

      if (response.success) {
        setShowApprovalModal(false);
        setSelectedItem(null);
        if (activeType === "leave") {
          fetchApprovals();
        } else if (activeType === "timesheet") {
          fetchTimesheets();
        } else if (activeType === "autoOvertime") {
          fetchAutoOvertimeRequests();
        } else {
          fetchOvertimeRequests();
        }
        window.dispatchEvent(new Event("approvals-updated"));
      } else {
        alert(response.error || "Failed to approve");
      }
    } catch (err) {
      console.error("Approve error:", err);
      alert("Failed to approve request");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmReject = async () => {
    if (!selectedItem || !rejectReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }
    setActionLoading(true);
    try {
      let response;
      if (activeType === "overtime" || activeType === "autoOvertime") {
        response = await overtimeService.rejectOvertimeRequest(
          selectedItem.id,
          rejectReason,
        );
      } else if (
        activeType === "timesheet" ||
        selectedItem.type === "time-entry"
      ) {
        response = await clientPortalService.rejectTimeRecord(
          selectedItem.id,
          rejectReason,
        );
      } else {
        response = await clientPortalService.rejectLeaveRequest(
          selectedItem.id,
          rejectReason,
        );
      }

      if (response.success) {
        setShowRejectModal(false);
        setSelectedItem(null);
        setRejectReason("");
        if (activeType === "leave") {
          fetchApprovals();
        } else if (activeType === "timesheet") {
          fetchTimesheets();
        } else if (activeType === "autoOvertime") {
          fetchAutoOvertimeRequests();
        } else {
          fetchOvertimeRequests();
        }
        window.dispatchEvent(new Event("approvals-updated"));
      } else {
        alert(response.error || "Failed to reject");
      }
    } catch (err) {
      console.error("Reject error:", err);
      alert("Failed to reject request");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRequestRevision = async () => {
    if (!selectedItem || !revisionReason.trim()) {
      alert("Please provide revision notes");
      return;
    }
    setActionLoading(true);
    try {
      const response = await clientPortalService.requestRevisionTimeRecord(
        selectedItem.id,
        revisionReason,
      );
      if (response.success) {
        setShowRevisionModal(false);
        setSelectedItem(null);
        setRevisionReason("");
        fetchTimesheets();
        window.dispatchEvent(new Event("approvals-updated"));
      } else {
        alert(response.error || "Failed to request revision");
      }
    } catch (err) {
      console.error("Request revision error:", err);
      alert("Failed to request revision");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    const items =
      activeType === "leave"
        ? filteredApprovals
        : activeType === "timesheet"
          ? filteredTimesheetApprovals.filter((a) => a.status === "pending")
          : activeType === "autoOvertime"
            ? filteredAutoOvertimeRequests
            : filteredOvertimeRequests;

    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((a) => a.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) return;
    setActionLoading(true);
    try {
      if (activeType === "leave") {
        for (const id of selectedItems) {
          await clientPortalService.approveLeaveRequest(id);
        }
        setSelectedItems([]);
        fetchApprovals();
      } else if (activeType === "timesheet") {
        await clientPortalService.bulkApproveTimeRecords(selectedItems);
        setSelectedItems([]);
        fetchTimesheets();
      } else {
        for (const id of selectedItems) {
          await overtimeService.approveOvertimeRequest(id);
        }
        setSelectedItems([]);
        if (activeType === "autoOvertime") {
          fetchAutoOvertimeRequests();
        } else {
          fetchOvertimeRequests();
        }
      }
      window.dispatchEvent(new Event("approvals-updated"));
    } catch (err) {
      console.error("Bulk approve error:", err);
      alert("Failed to bulk approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkRequestRevision = async () => {
    if (selectedItems.length === 0) return;
    const reason = prompt("Enter revision notes for selected timesheets:");
    if (!reason || !reason.trim()) return;
    setActionLoading(true);
    try {
      await clientPortalService.bulkRequestRevision(
        selectedItems,
        reason.trim(),
      );
      setSelectedItems([]);
      fetchTimesheets();
      window.dispatchEvent(new Event("approvals-updated"));
    } catch (err) {
      console.error("Bulk request revision error:", err);
      alert("Failed to request revisions");
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimesheetDescription = (item) => {
    if (!item) return "";
    if (Number.isFinite(Number(item.hours))) {
      return `${formatHours(Number(item.hours))} total`;
    }

    const desc = (item.description || "").toString();
    const match = desc.match(/(\d+(?:\.\d+)?)\s*h\s*total/i);
    if (!match) return desc;

    const hours = Number(match[1]);
    if (!Number.isFinite(hours)) return desc;
    return desc.replace(match[0], `${formatHours(hours)} total`);
  };

  const filterBySearch = (items) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const name =
        typeof item.employee === "string"
          ? item.employee
          : item.employee
            ? `${item.employee.firstName} ${item.employee.lastName}`
            : item.employeeName || "";
      return name.toLowerCase().includes(q);
    });
  };

  const filteredApprovals = filterBySearch(approvals);
  const filteredTimesheetApprovals = filterBySearch(timesheetApprovals);
  const filteredOvertimeRequests = filterBySearch(overtimeRequests);
  const filteredAutoOvertimeRequests = filterBySearch(autoOvertimeRequests);

  const selectableItems =
    activeType === "leave"
      ? filteredApprovals
      : activeType === "timesheet"
        ? filteredTimesheetApprovals.filter((a) => a.status === "pending")
        : activeType === "autoOvertime"
          ? filteredAutoOvertimeRequests
          : filteredOvertimeRequests;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approvals</h2>
          <p className="text-gray-500">
            Review leave requests and overtime pre-approvals
          </p>
          {activeType === "overtime" ||
            (activeType === "autoOvertime" && (
              <p className="text-m text-gray-500 mt-2 font-bold">
                These employees have already worked overtime without submitting
                a prior approval request. <br />
                Approve to process payment and billing. Deny to exclude from
                payroll
              </p>
            ))}
        </div>
        <div className="flex items-center gap-3">
          {(activeTab === "pending" || activeType === "timesheet") &&
            selectedItems.length > 0 && (
              <Button
                variant="success"
                icon={CheckCircle}
                onClick={handleBulkApprove}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Approving..."
                  : `Approve Selected (${selectedItems.length})`}
              </Button>
            )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() =>
              activeType === "leave"
                ? fetchApprovals()
                : activeType === "autoOvertime"
                  ? fetchAutoOvertimeRequests()
                  : fetchOvertimeRequests()
            }
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Type Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => {
            setActiveType("leave");
            setSelectedItems([]);
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeType === "leave"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Leave Requests
        </button>
        <button
          onClick={() => {
            setActiveType("overtime");
            setSelectedItems([]);
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeType === "overtime"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Overtime Requests
          {overtimeSummary.pending - (autoOvertimeSummary.pending || 0) > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-warning text-warning-dark text-xs rounded-full">
              {overtimeSummary.pending - (autoOvertimeSummary.pending || 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveType("autoOvertime");
            setActiveTab("pending");
            setSelectedItems([]);
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeType === "autoOvertime"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Worked OT Without Prior Approval
          {autoOvertimeSummary.pending > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
              {autoOvertimeSummary.pending}
            </span>
          )}
        </button>{" "}
        <button
          onClick={() => {
            setActiveType("timesheet");
            setActiveTab("pending");
            setSelectedItems([]);
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeType === "timesheet"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Timesheet Review
          {timesheetSummary.pending > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
              {timesheetSummary.pending}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                startDate: e.target.value,
              }))
            }
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
            }
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
          {(dateRange.startDate || dateRange.endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({ startDate: "", endDate: "" })}
            >
              Clear
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 h-9 pl-8 pr-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === "leave"
                  ? summary.pending
                  : activeType === "timesheet"
                    ? timesheetSummary.pending
                    : activeType === "autoOvertime"
                      ? autoOvertimeSummary.pending
                      : Math.max(
                          0,
                          (overtimeSummary.pending || 0) -
                            (autoOvertimeSummary.pending || 0),
                        )}
              </p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === "leave"
                  ? summary.overtimePending
                  : activeType === "timesheet"
                    ? timesheetSummary.revision_requested
                    : activeType === "autoOvertime"
                      ? autoOvertimeSummary.pending
                      : formatDuration(overtimeSummary.totalPendingMinutes)}
              </p>
              <p className="text-sm text-gray-500">
                {activeType === "leave"
                  ? "Overtime Requests"
                  : activeType === "timesheet"
                    ? "Revision Requested"
                    : activeType === "autoOvertime"
                      ? "Needs Approval"
                      : "Pending Hours"}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === "leave"
                  ? summary.approvedThisWeek
                  : activeType === "timesheet"
                    ? timesheetSummary.approved
                    : activeType === "autoOvertime"
                      ? autoOvertimeSummary.approved
                      : overtimeSummary.approved}
              </p>
              <p className="text-sm text-gray-500">
                {activeType === "leave" ? "Approved This Week" : "Approved"}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeType === "leave"
                  ? summary.rejectedThisWeek
                  : activeType === "timesheet"
                    ? timesheetSummary.rejected || 0
                    : activeType === "autoOvertime"
                      ? autoOvertimeSummary.rejected
                      : overtimeSummary.rejected}
              </p>
              <p className="text-sm text-gray-500">
                {activeType === "leave" ? "Rejected This Week" : "Rejected"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Status filter tabs */}
      {(
        <div className="border-b border-gray-200">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                {tab.label}
                <span
                  className={`
                  ml-2 py-0.5 px-2 rounded-full text-xs
                  ${
                    activeTab === tab.id
                      ? "bg-primary-100 text-primary"
                      : "bg-gray-100 text-gray-600"
                  }
                `}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Approval Items */}
      {loading ? (
        <Card padding="none">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </Card>
      ) : activeType === "leave" ? (
        /* Leave Requests */
        <Card padding="none">
          {filteredApprovals.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader className="!px-3">Employee</TableHeader>
                  <TableHeader className="!px-3">Type</TableHeader>
                  <TableHeader className="!px-3">Description</TableHeader>
                  <TableHeader className="!px-3">Date</TableHeader>
                  <TableHeader className="!px-3">Days</TableHeader>
                  <TableHeader className="!px-3">Submitted</TableHeader>
                  {activeTab === "pending" && (
                    <TableHeader className="!px-3">Actions</TableHeader>
                  )}
                  {activeTab === "approved" && (
                    <TableHeader className="!px-3">Approved On</TableHeader>
                  )}
                  {activeTab === "approved" && (
                    <TableHeader className="!px-3">Approved By</TableHeader>
                  )}
                  {activeTab === "rejected" && (
                    <TableHeader className="!px-3">
                      Rejection Reason
                    </TableHeader>
                  )}
                  {activeTab === "rejected" && (
                    <TableHeader className="!px-3">Rejected By</TableHeader>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApprovals.map((item) => (
                  <TableRow key={`leave-${item.id}`}>
                    <TableCell className="!px-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={item.employee}
                          src={item.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium text-sm truncate">
                          {item.employee}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!px-3">
                      {getTypeBadge(item.type)}
                    </TableCell>
                    <TableCell className="!whitespace-normal !px-3">
                      <div>
                        <p
                          className="text-gray-900 text-sm line-clamp-2"
                          title={item.description}
                        >
                          {item.description}
                        </p>
                        {item.reason && (
                          <p
                            className="text-xs text-gray-500 mt-1 line-clamp-2"
                            title={item.reason}
                          >
                            Reason: {item.reason}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="!px-3">
                      {formatDate(item.date)}
                    </TableCell>
                    <TableCell className="!px-3">
                      {item.days} day{item.days !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="!px-3">
                      <span className="text-xs text-gray-500">
                        {formatDateTime(item.submittedAt, {
                          timeZone: clientTimezone,
                        })}
                      </span>
                    </TableCell>
                    {activeTab === "pending" && (
                      <TableCell className="!px-3">
                        <div className="flex gap-1.5">
                          <Button
                            variant="success"
                            size="xs"
                            icon={CheckCircle}
                            onClick={() => handleApprove(item)}
                            disabled={actionLoading}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={XCircle}
                            onClick={() => handleReject(item)}
                            disabled={actionLoading}
                          >
                            Deny
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    {activeTab === "approved" && (
                      <TableCell className="!px-3">
                        <span className="text-xs text-green-600">
                          {formatDateTime(item.approvedAt, {
                            timeZone: clientTimezone,
                          })}
                        </span>
                      </TableCell>
                    )}
                    {activeTab === "rejected" && (
                      <TableCell className="!whitespace-normal !px-3">
                        <span
                          className="text-sm text-red-600 line-clamp-2"
                          title={item.rejectionReason}
                        >
                          {item.rejectionReason || "-"}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No leave requests
              </h3>
              <p className="text-gray-500">
                {activeTab === "pending"
                  ? "All caught up! No pending leave requests."
                  : `No ${activeTab} leave requests to show.`}
              </p>
            </div>
          )}
        </Card>
      ) : activeType === "timesheet" ? (
        /* Timesheet Review */
        <Card padding="none">
          {(() => {
            const tsStatusFilter = activeTab === "approved" ? ["approved", "auto_approved"] : [activeTab];
            const visibleTimesheets = filteredTimesheetApprovals.filter((a) => tsStatusFilter.includes(a.status));
            return visibleTimesheets.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader className="!px-3 !w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.length === selectableItems.length &&
                        selectableItems.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHeader>
                  <TableHeader className="!px-3">Employee</TableHeader>
                  <TableHeader className="!px-3">Description</TableHeader>
                  <TableHeader className="!px-3">Date</TableHeader>
                  <TableHeader className="!px-3">Schedule</TableHeader>
                  <TableHeader className="!px-3">Clock In/Out</TableHeader>
                  <TableHeader className="!px-3">Status</TableHeader>
                  <TableHeader className="!px-3">Submitted</TableHeader>
                  <TableHeader className="!px-3">Actions</TableHeader>
                  <TableHeader className="!px-3">Reviewed By</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleTimesheets.map((item) => (
                  <TableRow key={`timesheet-${item.id}`}>
                    <TableCell className="!px-3">
                      {item.status === "pending" ? (
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded border-gray-300"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="!px-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={item.employee}
                          src={item.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium text-sm truncate">
                          {item.employee}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!px-3 !whitespace-normal">
                      <p className="text-gray-900 text-sm whitespace-nowrap">
                        {formatTimesheetDescription(item)}
                      </p>
                      {item.details && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.details}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="!px-3">
                      {formatDate(item.date)}
                    </TableCell>
                    <TableCell className="!px-3">
                      {item.scheduledStart && item.scheduledEnd ? (
                        <span className="text-sm text-gray-700">
                          {typeof item.scheduledStart === "string" &&
                          /^\d{1,2}:\d{2}$/.test(item.scheduledStart)
                            ? formatTime12(item.scheduledStart)
                            : formatTimeInTimeZone(
                                item.scheduledStart,
                                clientTimezone,
                              )}
                          <span className="text-gray-300 mx-0.5">–</span>
                          {typeof item.scheduledEnd === "string" &&
                          /^\d{1,2}:\d{2}$/.test(item.scheduledEnd)
                            ? formatTime12(item.scheduledEnd)
                            : formatTimeInTimeZone(
                                item.scheduledEnd,
                                clientTimezone,
                              )}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="!px-3">
                      {item.clockIn ? (
                        <span className="text-sm text-gray-700">
                          {formatTimeInTimeZone(item.clockIn, clientTimezone)}
                          <span className="text-gray-300 mx-0.5">–</span>
                          {item.clockOut ? (
                            formatTimeInTimeZone(item.clockOut, clientTimezone)
                          ) : (
                            <span className="text-green-600">Active</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="!px-3">
                      {getStatusBadge(item.status)}
                    </TableCell>
                    <TableCell className="!px-3">
                      <span className="text-xs text-gray-500">
                        {formatDateTime(item.submittedAt, {
                          timeZone: clientTimezone,
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="!px-3">
                      {item.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <Button
                            variant="success"
                            size="xs"
                            icon={CheckCircle}
                            onClick={() => handleApprove(item)}
                            disabled={actionLoading}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={RotateCcw}
                            onClick={() => handleRequestRevision(item)}
                            disabled={actionLoading}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            Revise
                          </Button>
                        </div>
                      ) : item.status === "approved" ||
                        item.status === "auto_approved" ? (
                        <span className="text-xs text-green-600">
                          {formatDateTime(item.approvedAt, {
                            timeZone: clientTimezone,
                          })}
                        </span>
                      ) : item.status === "revision_requested" ? (
                        <span
                          className="text-sm text-amber-700 line-clamp-2"
                          title={item.revisionReason}
                        >
                          {item.revisionReason || "-"}
                        </span>
                      ) : item.status === "rejected" ? (
                        <span className="text-xs text-red-600">Rejected</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="!px-3">
                      <span className="text-sm text-gray-700">
                        {item.approver?.name || item.approvedByName || <span className="text-gray-300">—</span>}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No timesheets
              </h3>
              <p className="text-gray-500">No {activeTab.replace("_", " ")} timesheets to show.</p>
            </div>
          );
          })()}
        </Card>
      ) : activeType === "overtime" || activeType === "autoOvertime" ? (
        /* Overtime Requests tab / Auto OT tab — shared table */
        <Card padding="none">
          {(activeType === "overtime"
            ? filteredOvertimeRequests
            : filteredAutoOvertimeRequests
          ).length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  {activeTab === "pending" && (
                    <TableHeader className="!px-3 !w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedItems.length === selectableItems.length &&
                          selectableItems.length > 0
                        }
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHeader>
                  )}
                  <TableHeader className="!px-3">Employee</TableHeader>
                  <TableHeader className="!px-3">Type</TableHeader>
                  <TableHeader className="!px-3">Reason</TableHeader>
                  <TableHeader className="!px-3">Date</TableHeader>
                  <TableHeader className="!px-3">Hours</TableHeader>
                  <TableHeader className="!px-3">Submitted</TableHeader>
                  {activeTab === "pending" && (
                    <TableHeader className="!px-3">Actions</TableHeader>
                  )}
                  {activeTab === "approved" && (
                    <TableHeader className="!px-3">Approved On</TableHeader>
                  )}
                  {activeTab === "approved" && (
                    <TableHeader className="!px-3">Approved By</TableHeader>
                  )}
                  {activeTab === "rejected" && (
                    <TableHeader className="!px-3">
                      Rejection Reason
                    </TableHeader>
                  )}
                  {activeTab === "rejected" && (
                    <TableHeader className="!px-3">Rejected By</TableHeader>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {(activeType === "overtime"
                  ? filteredOvertimeRequests
                  : filteredAutoOvertimeRequests
                ).map((request) => (
                  <TableRow key={request.id}>
                    {activeTab === "pending" && (
                      <TableCell className="!px-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(request.id)}
                          onChange={() => handleSelectItem(request.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                    )}
                    <TableCell className="!px-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={
                            request.employee
                              ? `${request.employee.firstName} ${request.employee.lastName}`
                              : "Unknown"
                          }
                          src={request.employee?.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium text-sm truncate">
                          {request.employee
                            ? `${request.employee.firstName} ${request.employee.lastName}`
                            : "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!px-3">
                      <Badge
                        variant={
                          request.type === "OFF_SHIFT" ? "info" : "secondary"
                        }
                        size="xs"
                      >
                        {request.type === "OFF_SHIFT"
                          ? "Off-Shift"
                          : "Extension"}
                      </Badge>
                    </TableCell>
                    <TableCell className="!whitespace-normal !px-3">
                      <p
                        className="text-gray-900 text-sm line-clamp-2"
                        title={request.reason}
                      >
                        {request.reason}
                      </p>
                    </TableCell>
                    <TableCell className="!px-3">
                      <span className="text-sm">
                        {formatDate(request.date)}
                      </span>
                      {(request.requestedStartTime ||
                        request.estimatedEndTime) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {request.requestedStartTime &&
                          request.requestedEndTime
                            ? `${formatTimeInTimeZone(request.requestedStartTime, clientTimezone)} – ${formatTimeInTimeZone(request.requestedEndTime, clientTimezone)}`
                            : request.estimatedEndTime
                              ? `until ${formatTimeInTimeZone(request.estimatedEndTime, clientTimezone)}`
                              : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="!px-3">
                      <Badge variant="warning">
                        {formatDuration(request.requestedMinutes)}
                      </Badge>
                    </TableCell>
                    <TableCell className="!px-3">
                      <span className="text-xs text-gray-500">
                        {formatDateTime(request.createdAt, {
                          timeZone: clientTimezone,
                        })}
                      </span>
                    </TableCell>
                    {activeTab === "pending" && (
                      <TableCell className="!px-3">
                        <div className="flex gap-1.5">
                          <Button
                            variant="success"
                            size="xs"
                            icon={CheckCircle}
                            onClick={() => handleApprove(request)}
                            disabled={actionLoading}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={XCircle}
                            onClick={() => handleReject(request)}
                            disabled={actionLoading}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    {activeTab === "approved" && (
                      <TableCell className="!px-3">
                        <span className="text-xs text-green-600">
                          {formatDateTime(request.approvedAt, { timeZone: clientTimezone })}
                        </span>
                      </TableCell>
                    )}
                    {activeTab === "approved" && (
                      <TableCell className="!px-3">
                        <span className="text-sm text-gray-700">{request.approver?.name || <span className="text-gray-300">—</span>}</span>
                      </TableCell>
                    )}
                    {activeTab === "rejected" && (
                      <TableCell className="!whitespace-normal !px-3">
                        <span className="text-sm text-red-600 line-clamp-2" title={request.rejectionReason}>
                          {request.rejectionReason || "—"}
                        </span>
                      </TableCell>
                    )}
                    {activeTab === "rejected" && (
                      <TableCell className="!px-3">
                        <span className="text-sm text-gray-700">{request.rejecter?.name || <span className="text-gray-300">—</span>}</span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No items
              </h3>
              <p className="text-gray-500">
                {activeTab === "pending"
                  ? activeType === "autoOvertime"
                    ? "All caught up! No pending overtime without prior approval."
                    : "All caught up! No pending overtime requests."
                  : `No ${activeTab} ${activeType === "autoOvertime" ? "overtime without prior approval" : "overtime requests"} to show.`}
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Confirm Approval"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowApprovalModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={confirmApprove}
              disabled={actionLoading}
            >
              {actionLoading ? "Approving..." : "Approve"}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to approve this{" "}
              {activeType === "leave" ? "leave request" : "overtime request"}?
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">
                  {activeType === "overtime" || activeType === "autoOvertime"
                    ? `${selectedItem.employee?.firstName} ${selectedItem.employee?.lastName}`
                    : selectedItem.employee}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">
                  {formatDate(selectedItem.date)}
                </span>
              </div>
              {(activeType === "overtime" || activeType === "autoOvertime") && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">
                    {selectedItem.type === "OFF_SHIFT"
                      ? "Off-Shift Hours"
                      : "Shift Extension"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {activeType === "overtime" || activeType === "autoOvertime"
                    ? formatDuration(selectedItem.requestedMinutes)
                    : selectedItem.hours !== undefined
                      ? `${selectedItem.hours} hours`
                      : `${selectedItem.days} days`}
                </span>
              </div>
              {(activeType === "overtime" || activeType === "autoOvertime") &&
                selectedItem.type === "OFF_SHIFT" &&
                selectedItem.requestedStartTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium">
                      {formatTime12(selectedItem.requestedStartTime)} –{" "}
                      {formatTime12(selectedItem.requestedEndTime)}
                    </span>
                  </div>
                )}
              {(activeType === "overtime" || activeType === "autoOvertime") &&
                selectedItem.reason && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reason</span>
                    <span className="font-medium text-right max-w-xs">
                      {selectedItem.reason}
                    </span>
                  </div>
                )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={
          activeType === "overtime" || activeType === "autoOvertime"
            ? "Deny Overtime"
            : "Deny Leave Request"
        }
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowRejectModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={confirmReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              {actionLoading ? "Submitting..." : "Deny"}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <p className="text-gray-600">
              {activeType === "overtime" || activeType === "autoOvertime"
                ? "Please provide a reason for denying this overtime request."
                : "Please provide a reason for denying this leave request. The employee will be notified."}
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">
                  {activeType === "overtime" || activeType === "autoOvertime"
                    ? `${selectedItem.employee?.firstName} ${selectedItem.employee?.lastName}`
                    : selectedItem.employee}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">
                  {formatDate(selectedItem.date)}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Denial Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for denial..."
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Revision Modal (Timesheet) */}
      <Modal
        isOpen={showRevisionModal}
        onClose={() => setShowRevisionModal(false)}
        title="Request Revisions"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowRevisionModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={RotateCcw}
              onClick={confirmRequestRevision}
              disabled={actionLoading || !revisionReason.trim()}
              className="bg-amber-500 hover:bg-amber-600 border-amber-500"
            >
              {actionLoading ? "Submitting..." : "Request Revisions"}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">{selectedItem.employee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">
                  {formatDate(selectedItem.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hours</span>
                <span className="font-medium">{selectedItem.hours}h</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revision Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full"
                rows={3}
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Describe what needs to be revised..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Approvals;
