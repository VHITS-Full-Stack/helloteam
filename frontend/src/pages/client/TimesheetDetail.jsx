import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Loader2,
  RotateCcw,
  Check,
  X,
  CheckCircle,
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

const formatScheduleTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const TimesheetDetail = () => {
  const { employeeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state || {};
  const [employeeInfo, setEmployeeInfo] = useState({
    name: stateData.employeeName || "",
    photo: stateData.employeePhoto || null,
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState("month");
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionRecordIds, setRevisionRecordIds] = useState([]);
  const [clientTimezone, setClientTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [showOTSelectionModal, setShowOTSelectionModal] = useState(false);
  const [otSelectionAction, setOTSelectionAction] = useState("approve");
  const [otSelectionEntries, setOTSelectionEntries] = useState([]);

  const getDateRange = useCallback(() => {
    if (viewMode === "week") {
      const end = new Date(weekStart);
      end.setDate(weekStart.getDate() + 6);
      return { start: weekStart, end };
    }
    if (viewMode === "custom" && customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd) };
    }
    // Default: month
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0),
    };
  }, [viewMode, weekStart, currentMonth, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange();
      const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

      const response = await clientPortalService.getTimeRecords({
        startDate,
        endDate,
      });
      if (response.success) {
        if (response.data.clientTimezone)
          setClientTimezone(response.data.clientTimezone);
        const empRecord = (response.data.records || []).find(
          (r) => r.id === employeeId,
        );
        if (empRecord) {
          setRecord(empRecord);
          setEmployeeInfo({
            name: empRecord.employee,
            photo: empRecord.profilePhoto,
          });
        } else {
          setRecord(null);
        }
      } else {
        setError(response.error || "Failed to load time records");
      }
    } catch (err) {
      console.error("Error fetching time records:", err);
      setError("Failed to load time records");
    } finally {
      setLoading(false);
    }
  }, [getDateRange, employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        fetchData();
      }
    } catch (err) {
      setError(err.message || "Failed to request revision");
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
      fetchData();
    } catch (err) {
      setError(
        err?.error || err?.message || `Failed to ${otSelectionAction} overtime`,
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Group session records by date string (YYYY-MM-DD)
  const sessionsByDate = {};
  (record?.records || []).forEach((rec) => {
    const dayKey = rec.date ? rec.date.split("T")[0] : null;
    if (!dayKey) return;
    if (!sessionsByDate[dayKey]) sessionsByDate[dayKey] = [];
    sessionsByDate[dayKey].push(rec);
  });

  // Use backend data directly
  const totalHours = record?.totalHours ?? 0;
  const approvedOTHours = record?.approvedOvertimeHours ?? 0;
  const regularHours = Math.max(0, totalHours - approvedOTHours);
  const pendingOTHours = record?.unapprovedOvertimeHours ?? 0;

  const getStatusBadge = (status, holidayName) => {
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
            {holidayName || "Holiday"}
          </Badge>
        );
      case "not_started":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Not Started
          </span>
        );
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const periodLabel = (() => {
    const { start, end } = getDateRange();
    if (viewMode === "month") {
      return currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/client/time-records")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <Avatar
            name={employeeInfo.name || "Employee"}
            src={employeeInfo.photo}
            size="md"
          />
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {employeeInfo.name || "Employee Timesheet"}
            </h2>
            <p className="text-sm text-gray-500">{periodLabel}</p>
          </div>
        </div>
        {record && getStatusBadge(record.status)}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Period + Stats */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => {
                    if (m.value === "month") {
                      // Sync currentMonth to the month the current week falls in
                      setCurrentMonth(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
                    } else if (m.value === "week") {
                      // Set weekStart to Monday of current week
                      const now = new Date();
                      const d = new Date(now);
                      const day = d.getDay();
                      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
                      d.setHours(0, 0, 0, 0);
                      setWeekStart(d);
                    }
                    setViewMode(m.value);
                  }}
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
                value={(() => {
                  const { start } = getDateRange();
                  const y = start.getFullYear();
                  const m = String(start.getMonth() + 1).padStart(2, "0");
                  const dd = String(start.getDate()).padStart(2, "0");
                  return `${y}-${m}-${dd}`;
                })()}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  if (customEnd) {
                    setViewMode("custom");
                  } else {
                    const endDate = new Date(e.target.value);
                    endDate.setDate(endDate.getDate() + 6);
                    const ey = endDate.getFullYear();
                    const em = String(endDate.getMonth() + 1).padStart(2, "0");
                    const ed = String(endDate.getDate()).padStart(2, "0");
                    setCustomEnd(`${ey}-${em}-${ed}`);
                    setViewMode("custom");
                  }
                }}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={(() => {
                  const { end } = getDateRange();
                  const y = end.getFullYear();
                  const m = String(end.getMonth() + 1).padStart(2, "0");
                  const dd = String(end.getDate()).padStart(2, "0");
                  return `${y}-${m}-${dd}`;
                })()}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  if (!customStart) {
                    const { start } = getDateRange();
                    const sy = start.getFullYear();
                    const sm = String(start.getMonth() + 1).padStart(2, "0");
                    const sd = String(start.getDate()).padStart(2, "0");
                    setCustomStart(`${sy}-${sm}-${sd}`);
                  }
                  setViewMode("custom");
                }}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Total
              </p>
              <p className="text-sm font-bold text-gray-900">
                {formatHours(totalHours)}
              </p>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Regular
              </p>
              <p className="text-sm font-bold text-blue-600">
                {formatHours(regularHours)}
              </p>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Approved OT
              </p>
              <p className="text-sm font-bold text-green-600">
                {approvedOTHours > 0 ? formatHours(approvedOTHours) : "0h"}
              </p>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Pending OT
              </p>
              <p className="text-sm font-bold text-amber-600">
                {pendingOTHours > 0 ? formatHours(pendingOTHours) : "0h"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !record ? (
        <Card>
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No records found
            </h3>
            <p className="text-gray-500">
              No time records found for this period.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Revision reason banner */}
          {(() => {
            const revisionRecord = record?.records?.find(
              (r) => r.status === "REVISION_REQUESTED" && r.revisionReason,
            );
            if (!revisionRecord) return null;
            return (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Revision requested:</span>{" "}
                  {revisionRecord.revisionReason}
                </p>
              </div>
            );
          })()}

          {/* Monthly Table */}
          {(() => {
            const { start, end } = getDateRange();
            const today = new Date();
            const totalLabel =
              viewMode === "week"
                ? "Weekly Total"
                : viewMode === "custom"
                  ? "Total"
                  : "Monthly Total";

            // Build rows: iterate through all days, show all sessions per day
            const dayRows = [];
            const iterStart = new Date(start);
            const iterEnd = new Date(end);
            for (let d = new Date(iterStart); d <= iterEnd; d.setDate(d.getDate() + 1)) {
              const dayOfWeek = d.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const sessions = sessionsByDate[dayKey] || [];

              // Skip weekends with no data
              if (isWeekend && sessions.length === 0) continue;
              if (isWeekend && sessions.every(s => (s.totalMinutes || 0) === 0 && s.status?.toLowerCase() === "not_started")) continue;

              const isToday =
                today.getDate() === d.getDate() &&
                today.getMonth() === d.getMonth() &&
                today.getFullYear() === d.getFullYear();
              const dateLabel = d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });

              if (sessions.length === 0) {
                // Day exists in range but no records — show empty row
                dayRows.push({
                  key: `empty-${dayKey}`,
                  rec: null,
                  isToday,
                  recStatus: "not_started",
                  isLeaveOrHoliday: false,
                  totalM: 0,
                  regularM: 0,
                  hasOT: false,
                  requestedOTEntries: [],
                  autoOTEntries: [],
                  pendingAutoOT: [],
                  dateLabel,
                  schedStart: null,
                  schedEnd: null,
                });
              } else {
                // Show each session as its own row
                sessions.forEach((rec) => {
                  const totalM = rec.totalMinutes || 0;
                  const recStatus = rec.status?.toLowerCase();
                  const isLeaveOrHoliday =
                    recStatus === "paid_leave" ||
                    recStatus === "unpaid_leave" ||
                    recStatus === "holiday";
                  const otEntries = rec.overtimeEntries || [];
                  const billingM = rec.billingMinutes || 0;
                  const regularM =
                    rec.regularMinutes !== null && rec.regularMinutes !== undefined
                      ? rec.regularMinutes
                      : Math.max(
                          0,
                          (billingM > 0 ? billingM : totalM) -
                            (rec.breakMinutes || 0),
                        );
                  const requestedOTEntries = otEntries.filter(
                    (ot) => !ot.isAutoGenerated,
                  );
                  const autoOTEntries = otEntries.filter(
                    (ot) => ot.isAutoGenerated,
                  );
                  const clockIn = rec.billingStart || rec.clockIn;
                  const clockOut = rec.billingEnd || rec.clockOut;
                  const pendingAutoOT = autoOTEntries
                    .filter((ot) => ot.status === "PENDING")
                    .map((ot) => ({
                      ...ot,
                      _date: rec.date,
                      _clockIn: clockIn,
                      _clockOut: clockOut,
                    }));
                  const hasOT = otEntries.length > 0;
                  const schedStart = formatScheduleTime(rec.scheduledStart);
                  const schedEnd = formatScheduleTime(rec.scheduledEnd);

                  dayRows.push({
                    key: rec.id || `${dayKey}-${clockIn}`,
                    rec,
                    isToday,
                    recStatus,
                    isLeaveOrHoliday,
                    totalM,
                    regularM,
                    hasOT,
                    requestedOTEntries,
                    autoOTEntries,
                    pendingAutoOT,
                    dateLabel,
                    schedStart,
                    schedEnd,
                  });
                });
              }
            }

            // Compute totals from displayed rows
            let filteredTotalMins = 0;
            let filteredOtMins = 0;
            let filteredShiftExtMins = 0;
            let filteredExtraTimeMins = 0;
            dayRows.forEach(({ rec }) => {
              if (!rec) return;
              filteredTotalMins += rec.totalMinutes || 0;
              filteredOtMins += rec.overtimeMinutes || 0;
              filteredShiftExtMins += (rec.overtimeEntries || [])
                .filter((ot) => ot.type === "SHIFT_EXTENSION")
                .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
              filteredExtraTimeMins += (rec.overtimeEntries || [])
                .filter((ot) => ot.type === "OFF_SHIFT")
                .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
            });
            const filteredRegularMins = filteredTotalMins - filteredOtMins;
            const filteredOTTotal =
              filteredShiftExtMins + filteredExtraTimeMins;

            return (
              <Card padding="none" className="overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
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
                      {dayRows.map(
                        ({
                          key,
                          rec,
                          isToday,
                          recStatus,
                          isLeaveOrHoliday,
                          regularM,
                          hasOT,
                          requestedOTEntries,
                          autoOTEntries,
                          pendingAutoOT,
                          dateLabel,
                          schedStart,
                          schedEnd,
                        }) => {
                          const rowBg = isLeaveOrHoliday
                            ? "bg-gray-50/50"
                            : hasOT
                              ? "bg-orange-50/30"
                              : isToday
                                ? "bg-primary-50/20"
                                : "";

                          return (
                            <tr
                              key={key}
                              className={`border-b border-gray-50 last:border-b-0 ${rowBg} hover:bg-gray-50/50`}
                            >
                              {/* Date */}
                              <td className="py-2.5 px-4 text-sm">
                                <span
                                  className={`font-medium ${isToday ? "text-primary-700" : "text-gray-900"}`}
                                >
                                  {dateLabel}
                                </span>
                                {rec?.isLate && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                    LATE
                                  </span>
                                )}
                              </td>

                              {/* Clock In */}
                              <td className="py-2.5 px-3 text-center text-sm">
                                {rec?.clockIn ? (
                                  <span className="text-gray-900">
                                    {formatClockTime(
                                      rec.clockIn,
                                      clientTimezone,
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {isLeaveOrHoliday ? (
                                <td
                                  colSpan={6}
                                  className="py-2.5 px-3 text-center"
                                >
                                  {getStatusBadge(recStatus, rec?.holidayName)}
                                </td>
                              ) : (
                                <>
                                  {/* Clock Out */}
                                  <td className="py-2.5 px-3 text-center text-sm">
                                    {rec?.clockOut ? (
                                      <span className="text-gray-900">
                                        {formatClockTime(
                                          rec.clockOut,
                                          clientTimezone,
                                        )}
                                      </span>
                                    ) : rec?.clockIn ? (
                                      <span className="text-green-600 font-medium">
                                        In Progress
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>

                                  {/* Break */}
                                  <td className="py-2.5 px-3 text-center text-sm">
                                    <span
                                      className={
                                        (rec?.breakMinutes || 0) > 0
                                          ? "text-yellow-600 font-medium"
                                          : "text-gray-300"
                                      }
                                    >
                                      {(rec?.breakMinutes || 0) > 0
                                        ? formatHours(rec.breakMinutes / 60)
                                        : "—"}
                                    </span>
                                  </td>

                                  {/* Regular */}
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
                                            key={i}
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
                                            key={i}
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

                                  {/* Action */}
                                  <td className="py-2.5 px-4 text-center">
                                    {pendingAutoOT.length > 0 ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
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
                                          type="button"
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
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td
                          className="py-3 px-4 text-sm font-semibold text-gray-700"
                          colSpan={4}
                        >
                          {totalLabel}
                        </td>
                        <td className="py-3 px-3 text-center text-sm font-semibold text-gray-900">
                          {formatHours(filteredRegularMins / 60)}
                        </td>
                        <td className="py-3 px-3 text-center text-sm font-semibold">
                          {filteredOTTotal > 0 ? (
                            <span className="text-green-600">
                              {formatHours(filteredOTTotal / 60)}
                            </span>
                          ) : (
                            <span className="text-gray-400">0h</span>
                          )}
                        </td>
                        <td className="py-3 px-3" />
                        <td className="py-3 px-4" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden px-4 py-3 space-y-2">
                  {dayRows.map(
                    ({
                      key,
                      rec,
                      recStatus,
                      isLeaveOrHoliday,
                      regularM,
                      hasOT,
                      requestedOTEntries,
                      autoOTEntries,
                      pendingAutoOT,
                      dateLabel,
                      schedStart,
                      schedEnd,
                    }) => {
                      const cardBg = isLeaveOrHoliday
                        ? "bg-gray-50 border-gray-100"
                        : hasOT
                          ? "bg-orange-50/50 border-orange-100"
                          : "bg-white border-gray-100";

                      return (
                        <div
                          key={key}
                          className={`px-3 py-2.5 rounded-lg border ${cardBg}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {dateLabel}
                              </span>
                              {rec?.isLate && (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                  LATE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getStatusBadge(recStatus, rec?.holidayName)}
                            </div>
                          </div>
                          {schedStart && schedEnd && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              Schedule: {schedStart} – {schedEnd}
                            </p>
                          )}
                          {!isLeaveOrHoliday && (
                            <>
                              <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                                {rec?.billingStart && rec?.billingEnd ? (
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
                                ) : rec?.clockIn ? (
                                  <span>
                                    {formatClockTime(
                                      rec.clockIn,
                                      clientTimezone,
                                    )}{" "}
                                    –{" "}
                                    {rec?.clockOut
                                      ? formatClockTime(
                                          rec.clockOut,
                                          clientTimezone,
                                        )
                                      : "In Progress"}
                                  </span>
                                ) : null}
                                {(rec?.breakMinutes || 0) > 0 && (
                                  <span className="text-yellow-600">
                                    Break: {formatHours(rec.breakMinutes / 60)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                                <span className="text-gray-700 font-medium">
                                  Reg: {formatHours(regularM / 60)}
                                </span>
                                {requestedOTEntries.map((ot, i) => (
                                  <span
                                    key={`r-${i}`}
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
                                        (s, o) => s + (o.requestedMinutes || 0),
                                        0,
                                      ) / 60,
                                    )}
                                  </span>
                                )}
                              </div>
                              {pendingAutoOT.length > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    type="button"
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
                                    type="button"
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
                        </div>
                      );
                    },
                  )}
                  {/* Mobile total */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-100 font-semibold mt-2">
                    <span className="text-sm text-gray-700">{totalLabel}</span>
                    <div className="text-right text-sm flex items-center gap-2">
                      <span className="text-gray-900">
                        {formatHours(filteredRegularMins / 60)} reg
                      </span>
                      {filteredOTTotal > 0 && (
                        <span className="text-orange-600">
                          + {formatHours(filteredOTTotal / 60)} OT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* Request Revisions button */}
          {(() => {
            const revisionEligible =
              record?.records?.filter(
                (r) =>
                  r.timeRecordId &&
                  r.status &&
                  r.status !== "REVISION_REQUESTED" &&
                  r.status !== "NOT_STARTED" &&
                  r.status !== "PAID_LEAVE" &&
                  r.status !== "UNPAID_LEAVE" &&
                  r.status !== "HOLIDAY",
              ) || [];
            // if (revisionEligible.length === 0) return null;
            // return (
            //   <div className="flex justify-end">
            //     <button
            //       onClick={() =>
            //         handleRequestRevision(
            //           revisionEligible.map((r) => r.timeRecordId),
            //         )
            //       }
            //       disabled={actionLoading}
            //       className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
            //     >
            //       <RotateCcw className="w-4 h-4" />
            //       Request Revisions
            //     </button>
            //   </div>
            // );
          })()}
        </>
      )}

      {/* Revision Request Modal */}
      {/* {showRevisionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowRevisionModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Request Revisions
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
      )} */}

      <OTSelectionModal
        isOpen={showOTSelectionModal}
        onClose={() => setShowOTSelectionModal(false)}
        action={otSelectionAction}
        entries={otSelectionEntries}
        clientTimezone={clientTimezone}
        onConfirm={handleOTSelectionConfirm}
        actionLoading={actionLoading}
      />
    </div>
  );
};

export default TimesheetDetail;
