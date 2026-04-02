import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Users,
  Download,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Timer,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
  TrendingUp,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Avatar,
  OTSelectionModal,
} from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";
import { formatHours } from "../../utils/formatTime";

const formatClockTime = (dateStr, tz) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
};

const TimeRecords = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRecords, setTimeRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewTab, setViewTab] = useState("by-employee"); // "by-employee" | "all-records"
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionRecordIds, setRevisionRecordIds] = useState([]);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [pendingActionIds, setPendingActionIds] = useState([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showOTSelectionModal, setShowOTSelectionModal] = useState(false);
  const [otSelectionAction, setOTSelectionAction] = useState("approve");
  const [otSelectionEntries, setOTSelectionEntries] = useState([]);
  const [clientTimezone, setClientTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  // Date range navigation
  const [viewMode, setViewMode] = useState("week"); // week, month, custom
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      const now = new Date(weekStart);
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    if (viewMode === "custom" && customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd) };
    }
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return { start: weekStart, end };
  }, [viewMode, weekStart, customStart, customEnd]);

  const { start: rangeStart, end: rangeEnd } = dateRange;
  const rangeLabel =
    viewMode === "month"
      ? rangeStart.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : `${rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const handlePrev = () => {
    if (viewMode === "month") {
      setWeekStart((prev) => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() - 1);
        return d;
      });
    } else {
      setWeekStart((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    }
  };
  const handleNext = () => {
    if (viewMode === "month") {
      setWeekStart((prev) => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + 1);
        return d;
      });
    } else {
      setWeekStart((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    }
  };
  const handleToday = () => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  // Flatten all day records for stats
  const allDayRecords = timeRecords.flatMap((emp) => emp.records || []);

  // Compute stats
  const totalEmployees = timeRecords.length;
  const activeCount = timeRecords.filter((r) => r.status === "active").length;
  const totalBillingHours = timeRecords.reduce(
    (sum, r) => sum + (r.totalHours || 0),
    0,
  );
  const totalRegularHours = timeRecords.reduce(
    (sum, r) =>
      sum + Math.max(0, (r.totalHours || 0) - (r.approvedOvertimeHours || 0)),
    0,
  );
  const totalApprovedOT = timeRecords.reduce(
    (sum, r) => sum + (r.approvedOvertimeHours || 0),
    0,
  );
  const totalUnapprovedOT = timeRecords.reduce(
    (sum, r) => sum + (r.unapprovedOvertimeHours || 0),
    0,
  );
  const pendingRecordCount = allDayRecords.filter(
    (r) => r.status?.toLowerCase() === "pending",
  ).length;
  const lateCount = allDayRecords.filter((r) => r.isLate).length;

  const fetchingRef = useRef(false);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const prevSearchRef = useRef(searchQuery);

  const fetchTimeRecords = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const rs = rangeStart;
      const re = rangeEnd;
      const startDate = rs.toISOString().split("T")[0];
      const endDate = re.toISOString().split("T")[0];
      const response = await clientPortalService.getTimeRecords({
        startDate,
        endDate,
        status: statusFilter !== "all" ? statusFilter.toUpperCase() : undefined,
        search: searchQueryRef.current || undefined,
      });

      if (response.success) {
        setTimeRecords(response.data.records || []);
        if (response.data.clientTimezone)
          setClientTimezone(response.data.clientTimezone);
      } else {
        setError(response.error || "Failed to load time records");
      }
    } catch (err) {
      console.error("Error fetching time records:", err);
      setError("Failed to load time records");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [statusFilter, rangeStart, rangeEnd]);

  useEffect(() => {
    fetchTimeRecords();
  }, [fetchTimeRecords]);

  useEffect(() => {
    if (prevSearchRef.current === searchQuery) {
      return undefined;
    }
    prevSearchRef.current = searchQuery;
    const timer = setTimeout(() => {
      fetchTimeRecords();
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, fetchTimeRecords]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <Badge variant="success">Approved</Badge>;
      case "auto_approved":
        return <Badge variant="success">Auto Approved</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "active":
        return <Badge variant="info">Active</Badge>;
      case "rejected":
        return <Badge variant="danger">Rejected</Badge>;
      case "revision_requested":
        return (
          <Badge variant="warning" className="bg-amber-100 text-amber-800">
            Revision Requested
          </Badge>
        );
      case "paid_leave":
        return (
          <Badge variant="info" className="bg-purple-100 text-purple-800">
            Paid Leave
          </Badge>
        );
      case "unpaid_leave":
        return (
          <Badge variant="default" className="bg-gray-200 text-gray-700">
            Unpaid Leave
          </Badge>
        );
      case "holiday":
        return (
          <Badge variant="info" className="bg-blue-100 text-blue-800">
            Holiday
          </Badge>
        );
      case "ot_rejected":
        return (
          <Badge variant="danger" className="bg-orange-100 text-orange-800">
            OT Rejected
          </Badge>
        );
      case "not_started":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
            Not Started
          </span>
        );
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleExport = () => {
    const headers = [
      "Employee",
      "Date",
      "Billing In",
      "Billing Out",
      "Break",
      "Regular Hours",
      "OT Hours",
      "Status",
    ];
    const rows = timeRecords.flatMap((emp) =>
      (emp.records || [])
        .filter((r) => r.status?.toLowerCase() !== "not_started")
        .map((rec) => {
          const d = new Date(rec.date);
          const dateLabel = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          });
          const totalM = rec.totalMinutes || 0;
          const billingM = rec.billingMinutes || 0;
          const otEntries = rec.overtimeEntries || [];
          const approvedOTM = otEntries
            .filter(
              (o) => o.status === "APPROVED" || o.status === "AUTO_APPROVED",
            )
            .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
          const regularM =
            rec.regularMinutes !== null
              ? rec.regularMinutes
              : billingM > 0
                ? billingM
                : Math.max(0, totalM - approvedOTM);
          return [
            emp.employee,
            dateLabel,
            rec.billingStart
              ? formatClockTime(rec.billingStart, clientTimezone)
              : rec.clockIn
                ? formatClockTime(rec.clockIn, clientTimezone)
                : "",
            rec.billingEnd
              ? (() => {
                  const csvApprovedOT = (rec.overtimeEntries || [])
                    .filter(
                      (ot) =>
                        ot.status === "APPROVED" ||
                        ot.status === "AUTO_APPROVED",
                    )
                    .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
                  if (csvApprovedOT > 0) {
                    return formatClockTime(
                      new Date(
                        new Date(rec.billingEnd).getTime() +
                          csvApprovedOT * 60000,
                      ),
                      clientTimezone,
                    );
                  }
                  return formatClockTime(rec.billingEnd, clientTimezone);
                })()
              : rec.clockOut
                ? formatClockTime(rec.clockOut, clientTimezone)
                : "",
            formatHours((rec.breakMinutes || 0) / 60),
            formatHours(regularM / 60),
            formatHours(approvedOTM / 60),
            rec.status,
          ];
        }),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-records-${rangeStart.toISOString().slice(0, 10)}-to-${rangeEnd.toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleViewTimesheet = (empId, empName, empPhoto) => {
    const { start, end } = dateRange;
    navigate(`/client/time-records/${empId}`, {
      state: {
        employeeName: empName,
        employeePhoto: empPhoto,
        viewMode,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });
  };

  const handleRequestRevision = (timeRecordIds) => {
    const ids = Array.isArray(timeRecordIds) ? timeRecordIds : [timeRecordIds];
    setRevisionRecordIds([...new Set(ids.filter(Boolean))]);
    setRevisionReason("");
    setShowRevisionModal(true);
  };

  const confirmRequestRevision = async () => {
    if (!revisionRecordIds.length || !revisionReason.trim()) return;
    try {
      setActionLoading(true);
      let response;
      if (revisionRecordIds.length === 1) {
        response = await clientPortalService.requestRevisionTimeRecord(
          revisionRecordIds[0],
          revisionReason,
        );
      } else {
        response = await clientPortalService.bulkRequestRevision(
          revisionRecordIds,
          revisionReason,
        );
      }
      if (response.success) {
        setShowRevisionModal(false);
        setRevisionReason("");
        setRevisionRecordIds([]);
        fetchTimeRecords();
      } else {
        setError(response.error || "Failed to request revision");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to request revision");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = (recordIdOrIds) => {
    const ids = Array.isArray(recordIdOrIds) ? recordIdOrIds : [recordIdOrIds];
    setPendingActionIds(ids);
    setShowApproveConfirm(true);
  };

  const confirmApprove = async () => {
    try {
      setActionLoading(true);
      for (const id of pendingActionIds) {
        await clientPortalService.approveTimeRecord(id);
      }
      setShowApproveConfirm(false);
      setPendingActionIds([]);
      fetchTimeRecords();
    } catch (err) {
      console.error("Failed to approve time record:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = (recordIdOrIds) => {
    const ids = Array.isArray(recordIdOrIds) ? recordIdOrIds : [recordIdOrIds];
    setPendingActionIds(ids);
    setRejectReason("");
    setShowRejectConfirm(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      setActionLoading(true);
      for (const id of pendingActionIds) {
        await clientPortalService.rejectTimeRecord(id, rejectReason.trim());
      }
      setShowRejectConfirm(false);
      setPendingActionIds([]);
      setRejectReason("");
      fetchTimeRecords();
    } catch (err) {
      console.error("Failed to reject time record:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const openOTSelectionModal = (pendingOTs, action) => {
    setOTSelectionEntries(pendingOTs);
    setOTSelectionAction(action);
    setShowOTSelectionModal(true);
  };

  const handleOTSelectionConfirm = async (selectedIds, rejectReason) => {
    try {
      setActionLoading(true);
      if (otSelectionAction === "approve") {
        for (const id of selectedIds) {
          await clientPortalService.approveOvertime(id);
        }
      } else {
        for (const id of selectedIds) {
          await clientPortalService.rejectOvertime(id, rejectReason);
        }
      }
      setShowOTSelectionModal(false);
      setOTSelectionEntries([]);
      fetchTimeRecords();
    } catch (err) {
      setError(err.message || `Failed to ${otSelectionAction} overtime`);
    } finally {
      setActionLoading(false);
    }
  };

  // Prepare employee groups with filtered day records
  const employeeGroups = timeRecords
    .sort((a, b) => (a.employee || "").localeCompare(b.employee || ""))
    .map((emp) => {
      const dayRecords = (emp.records || [])
        .map((r) => {
          const d = new Date(r.date);
          return { ...r, dateObj: d, dayOfWeek: d.getUTCDay() };
        })
        .filter((r) => {
          const isWeekend = r.dayOfWeek === 0 || r.dayOfWeek === 6;
          const status = r.status?.toLowerCase();
          if (
            isWeekend &&
            (r.totalMinutes || 0) === 0 &&
            status === "not_started"
          )
            return false;
          return true;
        })
        .sort((a, b) => a.dateObj - b.dateObj);

      return { ...emp, filteredRecords: dayRecords };
    });

  if (loading && timeRecords.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-gray-500">View and manage employee time records</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrev}>Prev</Button>
            <Button size="sm" variant="outline" onClick={handleToday}>Today</Button>
            <Button size="sm" variant="outline" onClick={handleNext}>Next</Button>
            <span className="text-sm text-gray-500 ml-2">{rangeLabel}</span>
          </div>
        </div>
        <Button variant="outline" icon={Download} onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={fetchTimeRecords} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employees
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900">
                  {totalEmployees}
                </p>
                {activeCount > 0 && (
                  <span className="text-xs text-green-600 font-medium">
                    {activeCount} active
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Hours
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900">
                  {formatHours(totalBillingHours)}
                </p>
                <span className="text-xs text-gray-400">
                  reg: {formatHours(totalRegularHours)}
                </span>
              </div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 rounded-xl">
              <Timer className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Overtime
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-orange-600">
                  {totalApprovedOT > 0 ? formatHours(totalApprovedOT) : "0h"}
                </p>
                {totalUnapprovedOT > 0 && (
                  <span className="text-xs text-amber-500 font-medium">
                    {formatHours(totalUnapprovedOT)} pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attention
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-amber-600">
                  {pendingRecordCount}
                </p>
                <span className="text-xs text-gray-400">pending</span>
                {lateCount > 0 && (
                  <span className="text-xs text-red-500 font-medium">
                    {lateCount} late
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Week Navigation + Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* View mode selector */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setViewMode(m.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === m.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setViewMode("custom");
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setViewMode("custom");
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-40 h-9 px-3 border border-gray-300 rounded-lg text-xs bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="revision_requested">Revision Requested</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search employees..."
                className="w-44 h-9 pl-8 pr-3 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Time Records by Employee */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : employeeGroups.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No time records
            </h3>
            <p className="text-gray-500">
              No time records found for this week.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Tab Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setViewTab("by-employee")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${viewTab === "by-employee" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              By Employee
            </button>
            <button
              onClick={() => setViewTab("all-records")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${viewTab === "all-records" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              All Records
            </button>
          </div>

          {viewTab === "all-records" ? (
            /* Flat table — all employees */
            (() => {
              const allFlatRecords = employeeGroups.flatMap((emp) =>
                emp.filteredRecords.map((rec) => ({
                  ...rec,
                  empId: emp.id,
                  empName: emp.employee,
                })),
              );
              const allPendingIds = allFlatRecords
                .filter(
                  (r) =>
                    r.timeRecordId && r.status?.toLowerCase() === "pending",
                )
                .map((r) => r.timeRecordId);
              const allPendingOTs = allFlatRecords.flatMap((r) =>
                (r.overtimeEntries || [])
                  .filter((ot) => ot.status === "PENDING")
                  .map((ot) => ({
                    ...ot,
                    _date: r.date,
                    _clockIn: r.billingStart || r.clockIn,
                    _clockOut: r.billingEnd || r.clockOut,
                    _empName: r.empName,
                  })),
              );
              const allPendingOTIds = allPendingOTs.map((ot) => ot.id);

              return (
                <Card padding="none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-4">
                            Employee
                          </th>
                          <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Date
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Clock In
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Clock Out
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Break
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Regular Hours
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Overtime
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            OT Without Prior Approval
                          </th>
                          <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                            Status
                          </th>
                          <th className="text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-4">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {allFlatRecords.map((rec) => {
                          const status = rec.status?.toLowerCase();
                          const otEntries = rec.overtimeEntries || [];
                          const regularM =
                            rec.regularMinutes !== null
                              ? rec.regularMinutes
                              : Math.max(
                                  0,
                                  (rec.billingMinutes ||
                                    rec.totalMinutes ||
                                    0) - (rec.breakMinutes || 0),
                                );
                          const requestedOTEntries = otEntries.filter(
                            (ot) => !ot.isAutoGenerated,
                          );
                          const autoOTEntries = otEntries.filter(
                            (ot) => ot.isAutoGenerated,
                          );
                          const pendingOTs = otEntries.filter(
                            (ot) => ot.status === "PENDING",
                          );
                          const clockIn = rec.billingStart || rec.clockIn;
                          const clockOut = rec.billingEnd || rec.clockOut;

                          return (
                            <tr
                              key={`${rec.empId}-${rec.id}`}
                              className="hover:bg-gray-50/50"
                            >
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                                    {rec.empName?.charAt(0) || "?"}
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                                    {rec.empName}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-sm text-gray-700 whitespace-nowrap">
                                {rec.dateObj?.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  timeZone: "UTC",
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm text-gray-700">
                                {clockIn ? (
                                  formatClockTime(clockIn, clientTimezone)
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm">
                                {rec.clockOut ? (
                                  formatClockTime(clockOut, clientTimezone)
                                ) : clockIn ? (
                                  <span className="text-green-600 font-medium text-xs">
                                    In Progress
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm">
                                {(rec.breakMinutes || 0) > 0 ? (
                                  <span className="text-yellow-600">
                                    {formatHours((rec.breakMinutes || 0) / 60)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-900">
                                {regularM > 0 ? (
                                  formatHours(regularM / 60)
                                ) : (
                                  <span className="text-gray-300">0m</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm">
                                {requestedOTEntries.length > 0 ? (
                                  <span className="text-orange-600 font-medium">
                                    {formatHours(
                                      requestedOTEntries.reduce(
                                        (s, o) => s + (o.requestedMinutes || 0),
                                        0,
                                      ) / 60,
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm">
                                {autoOTEntries.length > 0 ? (
                                  <span className="text-red-600 font-medium">
                                    {formatHours(
                                      autoOTEntries.reduce(
                                        (s, o) => s + (o.requestedMinutes || 0),
                                        0,
                                      ) / 60,
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {getStatusBadge(status)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {pendingOTs.length > 0 ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() =>
                                        openOTSelectionModal(
                                          pendingOTs,
                                          "approve",
                                        )
                                      }
                                      disabled={actionLoading}
                                      className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-green-700 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50"
                                    >
                                      <Check className="w-3 h-3" /> Approve
                                    </button>
                                    <button
                                      onClick={() =>
                                        openOTSelectionModal(
                                          pendingOTs,
                                          "reject",
                                        )
                                      }
                                      disabled={actionLoading}
                                      className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
                                    >
                                      <X className="w-3 h-3" /> Deny
                                    </button>
                                  </div>
                                ) : rec.timeRecordId && status === "pending" ? (
                                  <button
                                    onClick={() =>
                                      handleApprove(rec.timeRecordId)
                                    }
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-green-700 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50"
                                  >
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bulk Actions Footer */}
                  {(allPendingIds.length > 0 || allPendingOTIds.length > 0) && (
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                      {allPendingIds.length > 0 && (
                        <button
                          onClick={() => handleApprove(allPendingIds)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve All ({allPendingIds.length})
                        </button>
                      )}
                      {allPendingOTs.length > 0 && (
                        <button
                          onClick={() =>
                            openOTSelectionModal(allPendingOTs, "approve")
                          }
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve All OT ({allPendingOTs.length})
                        </button>
                      )}
                      {allPendingOTs.length > 0 && (
                        <button
                          onClick={() =>
                            openOTSelectionModal(allPendingOTs, "reject")
                          }
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject All OT ({allPendingOTs.length})
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })()
          ) : (
            <div className="space-y-4">
              {employeeGroups.map((emp) => {
                const revisionEligible = emp.filteredRecords.filter(
                  (r) =>
                    r.timeRecordId &&
                    r.status &&
                    r.status !== "REVISION_REQUESTED" &&
                    r.status !== "NOT_STARTED" &&
                    r.status !== "PAID_LEAVE" &&
                    r.status !== "UNPAID_LEAVE" &&
                    r.status !== "HOLIDAY",
                );
                const revisionRecord = emp.filteredRecords.find(
                  (r) => r.status === "REVISION_REQUESTED" && r.revisionReason,
                );
                const allPendingAutoOTs = emp.filteredRecords.flatMap((r) =>
                  (r.overtimeEntries || [])
                    .filter(
                      (ot) => ot.status === "PENDING" && ot.isAutoGenerated,
                    )
                    .map((ot) => ({
                      ...ot,
                      _date: r.date,
                      _clockIn: r.billingStart || r.clockIn,
                      _clockOut: r.billingEnd || r.clockOut,
                    })),
                );
                return (
                  <Card key={emp.id} padding="none" className="overflow-hidden">
                    {/* Employee Header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={emp.employee}
                          src={emp.profilePhoto}
                          size="sm"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {emp.employee}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{formatHours(emp.totalHours)} total</span>
                            {(emp.approvedOvertimeHours || 0) > 0 && (
                              <span className="text-orange-600">
                                {formatHours(emp.approvedOvertimeHours)} OT
                              </span>
                            )}
                            {emp.unapprovedOvertimeHours > 0 && (
                              <span className="text-red-600">
                                {formatHours(emp.unapprovedOvertimeHours)}{" "}
                                Unapproved OT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(emp.status)}
                        <button
                          onClick={() =>
                            handleViewTimesheet(
                              emp.id,
                              emp.employee,
                              emp.profilePhoto,
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </div>
                    </div>

                    {/* Revision reason banner */}
                    {revisionRecord && (
                      <div className="px-5 py-2 bg-amber-50 border-b border-amber-200">
                        <p className="text-xs text-amber-700">
                          <span className="font-medium">
                            Revision requested:
                          </span>{" "}
                          {revisionRecord.revisionReason}
                        </p>
                      </div>
                    )}

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-4">
                              Date
                            </th>
                            <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                              Clock In
                            </th>
                            <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                              Clock Out
                            </th>
                            <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                              Break
                            </th>
                            <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                              Regular Hours
                            </th>
                            <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                              Overtime
                            </th>
                            <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3">
                              OT Without Prior Approval
                            </th>
                            <th className="text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-4 w-[180px]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {emp.filteredRecords.map((rec) => {
                            const status = rec.status?.toLowerCase();
                            const isLeaveOrHoliday =
                              status === "paid_leave" ||
                              status === "unpaid_leave" ||
                              status === "holiday";
                            const otEntries = rec.overtimeEntries || [];
                            const totalM = rec.totalMinutes || 0;
                            const billingM = rec.billingMinutes || 0;
                            const regularM =
                              rec.regularMinutes !== null
                                ? rec.regularMinutes
                                : Math.max(
                                    0,
                                    (billingM > 0 ? billingM : totalM) -
                                      (rec.breakMinutes || 0),
                                  );
                            // Pre-requested OT + all shift extensions
                            const requestedOTEntries = otEntries.filter(
                              (ot) =>
                                !ot.isAutoGenerated ||
                                ot.type === "SHIFT_EXTENSION",
                            );
                            // const approvedRequestedOT = requestedOTEntries.filter(
                            //   (ot) =>
                            //     ot.status === "APPROVED" ||
                            //     ot.status === "AUTO_APPROVED",
                            // );
                            const pendingRequestedOT = requestedOTEntries
                              .filter((ot) => ot.status === "PENDING")
                              .map((ot) => ({
                                ...ot,
                                _date: rec.date,
                                _clockIn: rec.billingStart || rec.clockIn,
                                _clockOut: rec.billingEnd || rec.clockOut,
                              }));
                            // Auto-generated off-shift OT only
                            const autoOTEntries = otEntries.filter(
                              (ot) =>
                                ot.isAutoGenerated &&
                                ot.type !== "SHIFT_EXTENSION",
                            );
                            const pendingAutoOT = autoOTEntries
                              .filter((ot) => ot.status === "PENDING")
                              .map((ot) => ({
                                ...ot,
                                _date: rec.date,
                                _clockIn: rec.billingStart || rec.clockIn,
                                _clockOut: rec.billingEnd || rec.clockOut,
                              }));

                            const dateLabel = rec.dateObj.toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              },
                            );

                            const clockIn = rec.billingStart || rec.clockIn;
                            const clockOut = rec.billingEnd || rec.clockOut;

                            return (
                              <tr
                                key={rec.date}
                                className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
                              >
                                <td className="py-2.5 px-4 text-sm">
                                  <span className="text-gray-900 whitespace-nowrap">
                                    {dateLabel}
                                  </span>
                                  {rec.isLate && regularM > 0 && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                      LATE
                                    </span>
                                  )}
                                </td>

                                {isLeaveOrHoliday ? (
                                  <td
                                    colSpan={7}
                                    className="py-2.5 px-3 text-center"
                                  >
                                    {getStatusBadge(status)}
                                  </td>
                                ) : (
                                  <>
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {clockIn ? (
                                        <span className="text-gray-900">
                                          {formatClockTime(
                                            clockIn,
                                            clientTimezone,
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {clockOut ? (
                                        <span className="text-gray-900">
                                          {formatClockTime(
                                            clockOut,
                                            clientTimezone,
                                          )}
                                        </span>
                                      ) : clockIn ? (
                                        <span className="text-green-600 font-medium text-xs">
                                          In Progress
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-3 text-center text-sm">
                                      <span
                                        className={
                                          (rec.breakMinutes || 0) > 0
                                            ? "text-yellow-600 font-medium"
                                            : "text-gray-300"
                                        }
                                      >
                                        {(rec.breakMinutes || 0) > 0
                                          ? formatHours(rec.breakMinutes / 60)
                                          : "—"}
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-3 text-center text-sm">
                                      <span
                                        className={
                                          regularM > 0
                                            ? "font-semibold text-gray-900"
                                            : "text-gray-300"
                                        }
                                      >
                                        {formatHours(regularM / 60)}
                                      </span>
                                    </td>

                                    {/* Overtime (pre-requested) */}
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {requestedOTEntries.length > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          {requestedOTEntries.map((ot, i) => (
                                            <span
                                              key={ot.id || i}
                                              className="inline-flex items-center gap-1 whitespace-nowrap"
                                            >
                                              <span
                                                className={
                                                  ot.status === "APPROVED" ||
                                                  ot.status === "AUTO_APPROVED"
                                                    ? "text-green-700 font-medium"
                                                    : "text-orange-600 font-medium"
                                                }
                                              >
                                                {formatHours(
                                                  ot.requestedMinutes / 60,
                                                )}
                                              </span>
                                              <span className="text-[10px] text-gray-400">
                                                {ot.type === "SHIFT_EXTENSION"
                                                  ? "ext"
                                                  : "off"}
                                              </span>
                                              {(ot.status === "APPROVED" ||
                                                ot.status ===
                                                  "AUTO_APPROVED") && (
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                              )}
                                              {ot.status === "PENDING" && (
                                                <span className="text-[10px] text-amber-500">
                                                  pending
                                                </span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>

                                    {/* OT Without Prior Approval */}
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {autoOTEntries.length > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          {autoOTEntries.map((ot, i) => (
                                            <span
                                              key={ot.id || i}
                                              className="inline-flex items-center gap-1 whitespace-nowrap"
                                            >
                                              <span
                                                className={
                                                  ot.status === "APPROVED" ||
                                                  ot.status === "AUTO_APPROVED"
                                                    ? "text-green-700 font-medium"
                                                    : "text-orange-600 font-medium"
                                                }
                                              >
                                                {formatHours(
                                                  ot.requestedMinutes / 60,
                                                )}
                                              </span>
                                              <span className="text-[10px] text-gray-400">
                                                {ot.type === "SHIFT_EXTENSION"
                                                  ? "ext"
                                                  : "off"}
                                              </span>
                                              {/* {(ot.status === "APPROVED" ||
                                            ot.status === "AUTO_APPROVED") && (
                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                          )} */}
                                              {/* {ot.status === "PENDING" && (
                                            <span className="text-[10px] text-amber-500">
                                              pending
                                            </span>
                                          )} */}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>

                                    {/* Actions */}
                                    <td className="py-2.5 px-4 text-right">
                                      {[...pendingRequestedOT, ...pendingAutoOT]
                                        .length > 0 ? (
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            onClick={() =>
                                              openOTSelectionModal(
                                                [
                                                  ...pendingRequestedOT,
                                                  ...pendingAutoOT,
                                                ],
                                                "approve",
                                              )
                                            }
                                            disabled={actionLoading}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                                          >
                                            <Check className="w-3 h-3" />
                                            Approve
                                          </button>
                                          <button
                                            onClick={() =>
                                              openOTSelectionModal(
                                                [
                                                  ...pendingRequestedOT,
                                                  ...pendingAutoOT,
                                                ],
                                                "reject",
                                              )
                                            }
                                            disabled={actionLoading}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                                          >
                                            <X className="w-3 h-3" />
                                            Deny
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-gray-50">
                      {emp.filteredRecords.map((rec) => {
                        const status = rec.status?.toLowerCase();
                        const isLeaveOrHoliday =
                          status === "paid_leave" ||
                          status === "unpaid_leave" ||
                          status === "holiday";
                        const otEntries = rec.overtimeEntries || [];
                        const totalM = rec.totalMinutes || 0;
                        const billingM = rec.billingMinutes || 0;
                        const regularM =
                          rec.regularMinutes !== null
                            ? rec.regularMinutes
                            : Math.max(
                                0,
                                (billingM > 0 ? billingM : totalM) -
                                  (rec.breakMinutes || 0),
                              );
                        const requestedOTEntries = otEntries.filter(
                          (ot) =>
                            !ot.isAutoGenerated ||
                            ot.type === "SHIFT_EXTENSION",
                        );
                        const autoOTEntries = otEntries.filter(
                          (ot) =>
                            ot.isAutoGenerated && ot.type !== "SHIFT_EXTENSION",
                        );
                        const pendingAutoOT = autoOTEntries
                          .filter((ot) => ot.status === "PENDING")
                          .map((ot) => ({
                            ...ot,
                            _date: rec.date,
                            _clockIn: rec.billingStart || rec.clockIn,
                            _clockOut: rec.billingEnd || rec.clockOut,
                          }));

                        const clockIn = rec.billingStart || rec.clockIn;
                        const clockOut = rec.billingEnd || rec.clockOut;
                        const dateLabel = rec.dateObj.toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          },
                        );

                        return (
                          <div key={rec.date} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-gray-900">
                                {dateLabel}
                                {rec.isLate && regularM > 0 && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                    LATE
                                  </span>
                                )}
                              </span>
                              {isLeaveOrHoliday && getStatusBadge(status)}
                            </div>
                            {!isLeaveOrHoliday && (
                              <>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  {clockIn && (
                                    <span>
                                      In:{" "}
                                      {formatClockTime(clockIn, clientTimezone)}
                                    </span>
                                  )}
                                  {clockOut ? (
                                    <span>
                                      Out:{" "}
                                      {formatClockTime(
                                        clockOut,
                                        clientTimezone,
                                      )}
                                    </span>
                                  ) : clockIn ? (
                                    <span className="text-green-600">
                                      In Progress
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                                  <span className="text-gray-700 font-medium">
                                    Reg: {formatHours(regularM / 60)}
                                  </span>
                                  {requestedOTEntries.map((ot, i) => (
                                    <span
                                      key={ot.id || `r-${i}`}
                                      className="inline-flex items-center gap-0.5"
                                    >
                                      <span
                                        className={
                                          ot.status === "APPROVED" ||
                                          ot.status === "AUTO_APPROVED"
                                            ? "text-green-700"
                                            : "text-orange-600"
                                        }
                                      >
                                        OT:{" "}
                                        {formatHours(ot.requestedMinutes / 60)}
                                      </span>
                                      {(ot.status === "APPROVED" ||
                                        ot.status === "AUTO_APPROVED") && (
                                        <CheckCircle className="w-3 h-3 text-green-500" />
                                      )}
                                      {ot.status === "PENDING" && (
                                        <span className="text-amber-500">
                                          pending
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                  {autoOTEntries.length > 0 && (
                                    <span className="text-orange-600 font-medium">
                                      No Prior Approval:{" "}
                                      {formatHours(
                                        autoOTEntries.reduce(
                                          (s, o) =>
                                            s + (o.requestedMinutes || 0),
                                          0,
                                        ) / 60,
                                      )}
                                    </span>
                                  )}
                                </div>
                                {pendingAutoOT.length > 0 && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <button
                                      onClick={() =>
                                        openOTSelectionModal(
                                          pendingAutoOT,
                                          "approve",
                                        )
                                      }
                                      disabled={actionLoading}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                                    >
                                      <Check className="w-3 h-3" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() =>
                                        openOTSelectionModal(
                                          pendingAutoOT,
                                          "reject",
                                        )
                                      }
                                      disabled={actionLoading}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                                    >
                                      <X className="w-3 h-3" />
                                      Deny
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                            {rec.timeRecordId && status === "pending" && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                                <button
                                  onClick={() =>
                                    handleApprove(rec.timeRecordId)
                                  }
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </button>
                                {(rec.overtimeEntries || []).some(
                                  (ot) => ot.status === "PENDING",
                                ) && (
                                  <button
                                    onClick={() =>
                                      handleReject(rec.timeRecordId)
                                    }
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                                  >
                                    <X className="w-3 h-3" />
                                    Reject OT
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions footer */}
                    {(() => {
                      const pendingRecords = emp.filteredRecords.filter(
                        (r) =>
                          r.timeRecordId &&
                          r.status?.toLowerCase() === "pending",
                      );
                      const otPendingRecords = emp.filteredRecords.filter(
                        (r) =>
                          r.timeRecordId &&
                          (r.overtimeEntries || []).some(
                            (ot) => ot.status === "PENDING",
                          ),
                      );
                      const showFooter =
                        pendingRecords.length > 0 ||
                        otPendingRecords.length > 0 ||
                        allPendingAutoOTs.length > 0 ||
                        revisionEligible.length > 0;

                      return showFooter ? (
                        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {pendingRecords.length > 0 && (
                              <button
                                onClick={() =>
                                  handleApprove(
                                    pendingRecords.map((r) => r.timeRecordId),
                                  )
                                }
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve All
                              </button>
                            )}
                            {allPendingAutoOTs.length > 0 && (
                              <button
                                onClick={() =>
                                  openOTSelectionModal(
                                    allPendingAutoOTs,
                                    "approve",
                                  )
                                }
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approve All OT ({allPendingAutoOTs.length})
                              </button>
                            )}
                            {allPendingAutoOTs.length > 0 && (
                              <button
                                onClick={() =>
                                  openOTSelectionModal(
                                    allPendingAutoOTs,
                                    "reject",
                                  )
                                }
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject All OT ({allPendingAutoOTs.length})
                              </button>
                            )}
                          </div>
                          <div>
                            {revisionEligible.length > 0 && (
                              <button
                                onClick={() =>
                                  handleRequestRevision(
                                    revisionEligible.map((r) => r.timeRecordId),
                                  )
                                }
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Request Revisions
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <OTSelectionModal
        isOpen={showOTSelectionModal}
        onClose={() => setShowOTSelectionModal(false)}
        action={otSelectionAction}
        entries={otSelectionEntries}
        clientTimezone={clientTimezone}
        onConfirm={handleOTSelectionConfirm}
        actionLoading={actionLoading}
      />

      {/* Approve Timesheet Confirmation */}
      {showApproveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          role="button"
          tabIndex="0"
          onClick={() => setShowApproveConfirm(false)}
          onKeyDown={(evt) => {
            if (evt.key === "Escape" || evt.key === "Enter") {
              setShowApproveConfirm(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
            role="dialog"
            aria-modal="true"
            tabIndex="0"
            onKeyDown={(evt) => {
              if (evt.key === "Escape") {
                setShowApproveConfirm(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Approve Timesheet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to approve{" "}
              {pendingActionIds.length > 1
                ? `${pendingActionIds.length} time records`
                : "this time record"}
              ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Timesheet Confirmation */}
      {showRejectConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          role="button"
          tabIndex="0"
          onClick={() => setShowRejectConfirm(false)}
          onKeyDown={(evt) => {
            if (evt.key === 'Escape' || evt.key === 'Enter') {
              setShowRejectConfirm(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            role="dialog"
            aria-modal="true"
            tabIndex="0"
            onKeyDown={(evt) => {
              if (evt.key === 'Escape') {
                setShowRejectConfirm(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Reject Timesheet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for rejecting{" "}
              {pendingActionIds.length > 1
                ? `${pendingActionIds.length} time records`
                : "this time record"}
              .
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          role="button"
          tabIndex="0"
          onClick={() => setShowRevisionModal(false)}
          onKeyDown={(evt) => {
            if (evt.key === 'Escape' || evt.key === 'Enter') {
              setShowRevisionModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            role="dialog"
            aria-modal="true"
            tabIndex="0"
            onKeyDown={(evt) => {
              if (evt.key === 'Escape') {
                setShowRevisionModal(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Request Revision
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              The employee will be notified and can review and resubmit their
              timesheet.
            </p>
            <textarea
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Describe what needs to be revised..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRequestRevision}
                disabled={actionLoading || !revisionReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRecords;
