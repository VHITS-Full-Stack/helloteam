import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { Card, Button, Badge, Avatar } from "../../components/common";
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
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionRecordIds, setRevisionRecordIds] = useState([]);
  const [clientTimezone, setClientTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const handlePrevWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };
  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };
  const handleCurrentWeek = () => {
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
    (sum, r) => sum + Math.max(0, (r.totalHours || 0) - (r.approvedOvertimeHours || 0)),
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
      const startDate = weekStart.toISOString().split("T")[0];
      const endD = new Date(weekStart);
      endD.setDate(endD.getDate() + 6);
      const endDate = endD.toISOString().split("T")[0];
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
  }, [statusFilter, weekStart]);

  useEffect(() => {
    fetchTimeRecords();
  }, [fetchTimeRecords]);

  useEffect(() => {
    if (prevSearchRef.current === searchQuery) return;
    prevSearchRef.current = searchQuery;
    const timer = setTimeout(() => {
      fetchTimeRecords();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
            .filter((o) => o.status === "APPROVED" || o.status === "AUTO_APPROVED")
            .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
          const regularM = totalM;
          return [
            emp.employee,
            dateLabel,
            rec.billingStart
              ? formatClockTime(rec.billingStart, clientTimezone)
              : rec.clockIn
                ? formatClockTime(rec.clockIn, clientTimezone)
                : "",
            rec.billingEnd
              ? formatClockTime(rec.billingEnd, clientTimezone)
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
    a.download = `time-records-${weekStart.toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleViewTimesheet = (empId, empName, empPhoto) => {
    navigate(`/client/time-records/${empId}`, {
      state: { employeeName: empName, employeePhoto: empPhoto },
    });
  };

  const handleRequestRevision = (timeRecordIds) => {
    setRevisionRecordIds(
      Array.isArray(timeRecordIds) ? timeRecordIds : [timeRecordIds],
    );
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
      }
    } catch (err) {
      setError(err.message || "Failed to request revision");
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
            <button
              onClick={handlePrevWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg min-w-[220px] justify-center">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 text-sm">
                {weekLabel}
              </span>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
            <Button variant="ghost" size="sm" onClick={handleCurrentWeek}>
              Today
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input py-2 appearance-none pr-9"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="revision_requested">Revision Requested</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input w-full md:w-64"
                style={{ paddingLeft: "2.5rem" }}
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
                        {emp.overtimeHours > 0 && (
                          <span className="text-orange-600">
                            {formatHours(emp.overtimeHours)} OT
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
                      <span className="font-medium">Revision requested:</span>{" "}
                      {revisionRecord.revisionReason}
                    </p>
                  </div>
                )}

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-4 w-[150px]">
                          Date
                        </th>
                        <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3 w-[180px]">
                          Billing In / Out
                        </th>
                        <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3 w-[70px]">
                          Break
                        </th>
                        <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3 w-[80px]">
                          Regular
                        </th>
                        <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3 w-[110px]">
                          Overtime{" "}
                          <span className="text-[9px] font-medium text-gray-400 normal-case tracking-normal block">
                            Ext / Off‑Shift
                          </span>
                        </th>
                        <th className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-3 w-[120px]">
                          <span className="whitespace-nowrap">
                            Unapproved OT{" "}
                            <span className="text-[9px] font-medium text-gray-400 normal-case tracking-normal block">
                              Ext / Off‑Shift
                            </span>
                          </span>
                        </th>
                        <th className="text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider py-2 px-4 w-[120px]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {emp.filteredRecords.map((rec, idx) => {
                        const status = rec.status?.toLowerCase();
                        const isLeaveOrHoliday =
                          status === "paid_leave" ||
                          status === "unpaid_leave" ||
                          status === "holiday";
                        const otEntries = rec.overtimeEntries || [];
                        const totalM = rec.totalMinutes || 0;
                        const billingM = rec.billingMinutes || 0;
                        const approvedEntries = otEntries.filter(
                          (ot) =>
                            ot.status === "APPROVED" ||
                            ot.status === "AUTO_APPROVED",
                        );
                        const unapprovedEntries = otEntries.filter(
                          (ot) =>
                            ot.status === "PENDING" || ot.status === "REJECTED",
                        );
                        const approvedOTM = approvedEntries.reduce(
                          (s, o) => s + (o.requestedMinutes || 0),
                          0,
                        );
                        const unapprovedOTMinutes = unapprovedEntries.reduce(
                          (s, o) => s + (o.requestedMinutes || 0),
                          0,
                        );
                        const regularM = totalM;
                        const hasOT =
                          approvedOTM > 0 || unapprovedOTMinutes > 0;
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
                          <tr
                            key={rec.date}
                            className={`border-b border-gray-50 last:border-b-0 ${hasOT ? "bg-orange-50/30" : "hover:bg-gray-50/50"}`}
                          >
                            <td className="py-2.5 px-4 text-sm">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-gray-900 whitespace-nowrap">
                                  {dateLabel}
                                </span>
                                {rec.isLate && (
                                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                    LATE
                                  </span>
                                )}
                              </div>
                              {hasOT && (
                                <span className="inline-block mt-0.5 text-[10px] font-semibold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  Includes OT
                                </span>
                              )}
                            </td>

                            {isLeaveOrHoliday ? (
                              <td
                                colSpan={5}
                                className="py-2.5 px-3 text-center"
                              >
                                {getStatusBadge(status)}
                              </td>
                            ) : (
                              <>
                                <td className="py-2.5 px-3 text-center text-sm">
                                  {rec.billingStart && rec.billingEnd ? (
                                    <span className="text-gray-900">
                                      {formatClockTime(
                                        rec.billingStart,
                                        clientTimezone,
                                      )}
                                      <span className="text-gray-300 mx-1">
                                        –
                                      </span>
                                      {formatClockTime(
                                        rec.billingEnd,
                                        clientTimezone,
                                      )}
                                    </span>
                                  ) : rec.clockIn ? (
                                    <span className="text-gray-600">
                                      {formatClockTime(
                                        rec.clockIn,
                                        clientTimezone,
                                      )}
                                      <span className="text-gray-300 mx-1">
                                        –
                                      </span>
                                      {rec.clockOut ? (
                                        formatClockTime(
                                          rec.clockOut,
                                          clientTimezone,
                                        )
                                      ) : (
                                        <span className="text-green-600 font-medium">
                                          In Progress
                                        </span>
                                      )}
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

                                <td className="py-2.5 px-3 text-center text-sm">
                                  {approvedOTM > 0 ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      {approvedEntries
                                        .filter(
                                          (ot) => ot.type === "SHIFT_EXTENSION",
                                        )
                                        .map((ot, i) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center gap-1 whitespace-nowrap"
                                          >
                                            <span className="text-purple-600 font-medium">
                                              {formatHours(
                                                ot.requestedMinutes / 60,
                                              )}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                              ext
                                            </span>
                                            <span className="text-[10px] text-green-600">
                                              ✓
                                            </span>
                                          </span>
                                        ))}
                                      {approvedEntries
                                        .filter((ot) => ot.type === "OFF_SHIFT")
                                        .map((ot, i) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center gap-1 whitespace-nowrap"
                                          >
                                            <span className="text-orange-600 font-medium">
                                              {formatHours(
                                                ot.requestedMinutes / 60,
                                              )}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                              off
                                            </span>
                                            <span className="text-[10px] text-green-600">
                                              ✓
                                            </span>
                                          </span>
                                        ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center text-sm">
                                  {unapprovedOTMinutes > 0 ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      {unapprovedEntries
                                        .filter(
                                          (ot) => ot.type === "SHIFT_EXTENSION",
                                        )
                                        .map((ot, i) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center gap-1 whitespace-nowrap"
                                          >
                                            <span className="text-purple-600 font-medium">
                                              {formatHours(
                                                ot.requestedMinutes / 60,
                                              )}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                              ext
                                            </span>
                                            <span
                                              className={`text-[10px] ${ot.status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}
                                            >
                                              {ot.status === "REJECTED"
                                                ? "✗"
                                                : "⏳"}
                                            </span>
                                          </span>
                                        ))}
                                      {unapprovedEntries
                                        .filter((ot) => ot.type === "OFF_SHIFT")
                                        .map((ot, i) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center gap-1 whitespace-nowrap"
                                          >
                                            <span className="text-orange-600 font-medium">
                                              {formatHours(
                                                ot.requestedMinutes / 60,
                                              )}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                              off
                                            </span>
                                            <span
                                              className={`text-[10px] ${ot.status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}
                                            >
                                              {ot.status === "REJECTED"
                                                ? "✗"
                                                : "⏳"}
                                            </span>
                                          </span>
                                        ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </>
                            )}

                            <td className="py-2.5 px-5 text-right">
                              {getStatusBadge(status)}
                            </td>
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
                    const mobileApprovedOTEntries = otEntries.filter(
                      (ot) =>
                        ot.status === "APPROVED" || ot.status === "AUTO_APPROVED",
                    );
                    const mobileApprovedOTM = mobileApprovedOTEntries.reduce(
                      (s, o) => s + (o.requestedMinutes || 0),
                      0,
                    );
                    const mobileUnapprovedEntries = otEntries.filter(
                      (ot) =>
                        ot.status === "PENDING" || ot.status === "REJECTED",
                    );
                    const mobileUnapprovedOTM = mobileUnapprovedEntries.reduce(
                      (s, o) => s + (o.requestedMinutes || 0),
                      0,
                    );
                    const regularM = billingM > 0 ? Math.max(0, billingM - mobileApprovedOTM) : Math.max(0, totalM - mobileApprovedOTM);
                    const mobileApprovedEntries = otEntries.filter(
                      (ot) =>
                        ot.status === "APPROVED" ||
                        ot.status === "AUTO_APPROVED",
                    );
                    const hasOT = otEntries.length > 0;
                    const dateLabel = rec.dateObj.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    });

                    return (
                      <div
                        key={rec.date}
                        className={`px-4 py-3 ${hasOT ? "bg-orange-50/30" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {dateLabel}
                              </span>
                              {rec.isLate && (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                  LATE
                                </span>
                              )}
                            </div>
                            {hasOT && (
                              <span className="inline-block mt-0.5 text-[10px] font-semibold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded">
                                Includes OT
                              </span>
                            )}
                          </div>
                          {getStatusBadge(status)}
                        </div>
                        {!isLeaveOrHoliday && (
                          <>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {rec.billingStart && rec.billingEnd ? (
                                <span>
                                  {formatClockTime(
                                    rec.billingStart,
                                    clientTimezone,
                                  )}{" "}
                                  –{" "}
                                  {formatClockTime(
                                    rec.billingEnd,
                                    clientTimezone,
                                  )}
                                </span>
                              ) : rec.clockIn ? (
                                <span>
                                  {formatClockTime(rec.clockIn, clientTimezone)}{" "}
                                  –{" "}
                                  {rec.clockOut
                                    ? formatClockTime(
                                        rec.clockOut,
                                        clientTimezone,
                                      )
                                    : "In Progress"}
                                </span>
                              ) : null}
                              {(rec.breakMinutes || 0) > 0 && (
                                <span className="text-yellow-600">
                                  Break: {formatHours(rec.breakMinutes / 60)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                              <span className="text-gray-700 font-medium">
                                Reg: {formatHours(regularM / 60)}
                              </span>
                              {mobileApprovedEntries.map((ot, i) => (
                                <span
                                  key={`a-${i}`}
                                  className={
                                    ot.type === "SHIFT_EXTENSION"
                                      ? "text-purple-600"
                                      : "text-orange-600"
                                  }
                                >
                                  {ot.type === "SHIFT_EXTENSION"
                                    ? "Ext"
                                    : "Off"}
                                  : {formatHours(ot.requestedMinutes / 60)}
                                  <span className="ml-0.5 text-green-600">
                                    ✓
                                  </span>
                                </span>
                              ))}
                              {mobileUnapprovedEntries.map((ot, i) => (
                                <span
                                  key={`u-${i}`}
                                  className={
                                    ot.type === "SHIFT_EXTENSION"
                                      ? "text-purple-600"
                                      : "text-orange-600"
                                  }
                                >
                                  {ot.type === "SHIFT_EXTENSION"
                                    ? "Ext"
                                    : "Off"}
                                  : {formatHours(ot.requestedMinutes / 60)}
                                  <span
                                    className={`ml-0.5 ${ot.status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}
                                  >
                                    {ot.status === "REJECTED" ? "✗" : "⏳"}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Request Revisions footer */}
                {revisionEligible.length > 0 && (
                  <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() =>
                        handleRequestRevision(
                          revisionEligible.map((r) => r.timeRecordId),
                        )
                      }
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Request Revisions
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowRevisionModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
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
