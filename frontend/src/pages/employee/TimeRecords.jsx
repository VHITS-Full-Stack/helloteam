import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  Plus,
  Search,
  Coffee,
  X,
  RotateCcw,
  FileText,
  Loader2,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Modal,
} from "../../components/common";
import workSessionService from "../../services/workSession.service";
import timeRecordService from "../../services/timeRecord.service";
import {
  formatDuration as formatDurationShort,
  formatTime12,
} from "../../utils/formatDateTime";

const TimeRecords = () => {
  const [activeTab, setActiveTab] = useState("timesheets");
  const [viewMode, setViewMode] = useState("week"); // 'week', 'month', or 'custom'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [resubmitLoading, setResubmitLoading] = useState(null);

  // Manual time entry modal
  const [showAddTimeModal, setShowAddTimeModal] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "17:00",
    notes: "",
  });
  const [addTimeLoading, setAddTimeLoading] = useState(false);
  const [addTimeError, setAddTimeError] = useState(null);
  const [manualEntries, setManualEntries] = useState([]);
  const [manualEntriesLoading, setManualEntriesLoading] = useState(false);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Calculate week range
  const getWeekRange = useCallback((date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  const weekRange = useMemo(
    () => getWeekRange(currentDate),
    [currentDate, getWeekRange],
  );

  // Get month range for month view
  const getMonthRange = useCallback((date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  const monthRange = useMemo(
    () => getMonthRange(currentDate),
    [currentDate, getMonthRange],
  );

  // Get the active date range based on view mode
  const activeRange = useMemo(() => {
    if (viewMode === "custom" && customStart && customEnd) {
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return viewMode === "week" ? weekRange : monthRange;
  }, [viewMode, weekRange, monthRange, customStart, customEnd]);

  // Fetch sessions
  const fetchingSessionsRef = useRef(false);
  const fetchSessions = useCallback(async () => {
    if (fetchingSessionsRef.current) return;
    fetchingSessionsRef.current = true;
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        startDate: toLocalDateString(activeRange.start),
        endDate: toLocalDateString(activeRange.end),
        limit: 100,
      };

      const result = await workSessionService.getSessionHistory(params);

      if (result?.success) {
        setSessions(result.sessions || []);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      setError("Failed to load time entries. Please try again.");
    } finally {
      setIsLoading(false);
      fetchingSessionsRef.current = false;
    }
  }, [activeRange]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Fetch manual entries
  const fetchManualEntries = useCallback(async () => {
    try {
      setManualEntriesLoading(true);
      const result = await workSessionService.getManualEntries({
        startDate: toLocalDateString(activeRange.start),
        endDate: toLocalDateString(activeRange.end),
      });
      if (result?.success) {
        setManualEntries(result.entries || []);
      }
    } catch (err) {
      console.error("Failed to fetch manual entries:", err);
    } finally {
      setManualEntriesLoading(false);
    }
  }, [activeRange]);

  useEffect(() => {
    if (activeTab === "manual") {
      fetchManualEntries();
    }
  }, [activeTab, fetchManualEntries]);

  // Navigation handlers
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setCustomStart("");
    setCustomEnd("");
    if (viewMode === "custom") setViewMode("week");
  };

  // Helper to format date as YYYY-MM-DD using local timezone
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format helpers
  // Derive display timezone from the first session's client, fallback to browser local
  const displayTimezone = useMemo(() => {
    for (const s of sessions) {
      if (s.client?.timezone) return s.client.timezone;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [sessions]);

  const formatTime = (dateString) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: displayTimezone,
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return "-";
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
  };

  const formatDateHeader = (dateString) => {
    if (!dateString) return "Invalid Date";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    return localDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatWeekRange = () => {
    const startMonth = weekRange.start.toLocaleDateString("en-US", {
      month: "short",
    });
    const endMonth = weekRange.end.toLocaleDateString("en-US", {
      month: "short",
    });
    const startDay = weekRange.start.getDate();
    const endDay = weekRange.end.getDate();
    const year = weekRange.end.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  };

  const formatMonthDisplay = () => {
    return currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatDateDisplay = () => {
    if (viewMode === "custom" && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return viewMode === "week" ? formatWeekRange() : formatMonthDisplay();
  };

  // Check if session is currently active
  const isActiveSession = (session) => {
    return session.status === "ACTIVE" || session.status === "ON_BREAK";
  };

  // Handle view detail
  const handleViewDetail = async (session) => {
    setSelectedSession(session);
    setShowDetailModal(true);
    setSessionLogs([]);
    setLogsLoading(true);

    try {
      const result = await workSessionService.getSessionLogs(session.id);
      if (result?.success) {
        setSessionLogs(result.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch session logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Handle add manual time
  const handleAddTime = async (e) => {
    e.preventDefault();
    if (manualEntry.endTime <= manualEntry.startTime) {
      return;
    }
    setAddTimeLoading(true);
    setAddTimeError(null);

    try {
      const result = await workSessionService.addManualEntry(manualEntry);
      if (result?.success) {
        setShowAddTimeModal(false);
        setAddTimeError(null);
        setManualEntry({
          date: new Date().toISOString().split("T")[0],
          startTime: "09:00",
          endTime: "17:00",
          notes: "",
        });
        fetchManualEntries();
      } else {
        setAddTimeError(result?.message || "Failed to add time entry");
      }
    } catch (err) {
      console.error("Failed to add time entry:", err);
      setAddTimeError(err.message || "Failed to add time entry");
    } finally {
      setAddTimeLoading(false);
    }
  };

  // Get status badge — checks overtime entry statuses first, then falls back to TimeRecord status
  const getStatusBadge = (session) => {
    if (session.status === "ACTIVE") {
      return (
        <Badge variant="info" size="xs">
          Working
        </Badge>
      );
    }
    if (session.status === "ON_BREAK") {
      return (
        <Badge variant="warning" size="xs">
          On Break
        </Badge>
      );
    }

    // If session has overtime entries, derive status from their actual statuses
    const otEntries = session.overtimeEntries || [];
    if (otEntries.length > 0) {
      const hasRejected = otEntries.some((ot) => ot.status === "REJECTED");
      const hasPending = otEntries.some((ot) => ot.status === "PENDING");
      if (hasRejected && !hasPending) {
        return (
          <Badge variant="danger" size="xs">
            OT Rejected
          </Badge>
        );
      }
      if (hasPending) {
        return (
          <Badge variant="warning" size="xs">
            OT Pending
          </Badge>
        );
      }
      // All approved/auto-approved
      return (
        <Badge variant="success" size="xs">
          OT Approved
        </Badge>
      );
    }

    if (session.approvalStatus === "APPROVED") {
      return (
        <Badge variant="success" size="xs">
          Approved
        </Badge>
      );
    }
    if (session.approvalStatus === "AUTO_APPROVED") {
      return (
        <Badge variant="success" size="xs">
          Auto-Approved
        </Badge>
      );
    }
    if (session.approvalStatus === "REJECTED") {
      return (
        <Badge variant="danger" size="xs">
          Rejected
        </Badge>
      );
    }
    if (session.approvalStatus === "REVISION_REQUESTED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
          Revision
        </span>
      );
    }
    if (session.approvalStatus === "PENDING" || !session.approvedAt) {
      return (
        <Badge variant="warning" size="xs">
          Pending
        </Badge>
      );
    }
    return null;
  };

  // Get arrival badge — billing isLate (>7 min grace) takes precedence
  // Don't show Late for off-shift OT sessions
  const getArrivalBadge = (session) => {
    const isOffShiftOT = (session.overtimeMinutes || 0) > 0 && (session.workMinutes || 0) === 0;
    if (isOffShiftOT) return null;
    if (session.isLate || session.arrivalStatus === "Late") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
          Late
          {session.lateMinutes
            ? ` ${session.lateMinutes >= 60 ? `${Math.floor(session.lateMinutes / 60)}h ${session.lateMinutes % 60}m` : `${session.lateMinutes}m`}`
            : ""}
        </span>
      );
    }
    if (session.arrivalStatus === "On Time") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
          On Time
        </span>
      );
    }
    if (session.arrivalStatus === "Early") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">
          Early
        </span>
      );
    }
    return null;
  };

  // Handle resubmit after revision request
  const handleResubmit = async (recordId) => {
    try {
      setResubmitLoading(recordId);
      setError(null);
      const result = await timeRecordService.resubmitTimeRecord(recordId);
      if (result?.success) {
        fetchSessions();
      } else {
        setError(result?.message || "Failed to resubmit timesheet");
      }
    } catch (err) {
      console.error("Failed to resubmit:", err);
      setError(err.message || "Failed to resubmit timesheet");
    } finally {
      setResubmitLoading(null);
    }
  };

  // Compute summary stats
  const summary = useMemo(() => {
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    let breakMinutes = 0;
    for (const s of sessions) {
      totalMinutes += s.totalMinutes || 0;
      // Only count auto-generated pending OT as overtime
      // Pre-requested OTs are just approvals — they don't represent worked time yet
      const otEntries = s.overtimeEntries || [];
      const unapprovedOT = otEntries
        .filter((o) => o.status === "PENDING" && o.isAutoGenerated)
        .reduce((sum, o) => sum + (o.requestedMinutes || 0), 0);
      overtimeMinutes += unapprovedOT;
      breakMinutes += s.breakMinutes || s.totalBreakMinutes || 0;
    }
    return {
      totalMinutes,
      overtimeMinutes,
      breakMinutes,
      count: sessions.length,
    };
  }, [sessions]);

  const tabs = [
    { id: "timesheets", label: "Timesheets" },
    { id: "manual", label: "Manual Entry" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Entries</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your work sessions
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowAddTimeModal(true)}
        >
          Add Time
        </Button>
      </div>

      {/* Summary Cards */}
      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sessions
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.count}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Hours
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDurationShort(summary.totalMinutes)}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Timer className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Overtime
              </p>
              <p
                className={`text-2xl font-bold ${summary.overtimeMinutes > 0 ? "text-orange-600" : "text-gray-900"}`}
              >
                {formatDurationShort(summary.overtimeMinutes)}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Coffee className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Breaks
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatDurationShort(summary.breakMinutes)}
              </p>
            </div>
          </div>
        </Card>
      </div> */}

      {/* Main Card */}
      <Card className="overflow-hidden" padding="none">
        {/* Tabs + Toolbar */}
        <div className="border-b border-gray-200 bg-gray-50/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4">
            {/* Left: Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: Navigation + View Toggle */}
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {[
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setViewMode(m.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      viewMode === m.value || (viewMode === "custom" && m.value === "week")
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart || toLocalDateString(activeRange.start)}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    if (!customEnd) {
                      setCustomEnd(toLocalDateString(activeRange.end));
                    }
                    setViewMode("custom");
                  }}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEnd || toLocalDateString(activeRange.end)}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    if (!customStart) {
                      setCustomStart(toLocalDateString(activeRange.start));
                    }
                    setViewMode("custom");
                  }}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === "timesheets" && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No Time Entries
                </h3>
                <p className="text-gray-500 mb-4 text-sm">
                  No time entries found for this period.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowAddTimeModal(true)}
                >
                  Add Time Entry
                </Button>
              </div>
            ) : (
              <>
                {(() => {
                  const totalPages = Math.ceil(sessions.length / pageSize);
                  const startIdx = (currentPage - 1) * pageSize;
                  const paginatedSessions = sessions.slice(startIdx, startIdx + pageSize);

                  return (
                  <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-slate-50/50">
                        <th className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-4">Date</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Schedule</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Clock In</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Clock Out</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Break</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Regular Hours</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Overtime</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Status</th>
                        <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedSessions.map((session) => {
                        const isOT = session.overtimeMinutes > 0;
                        const otEntries = session.overtimeEntries || [];
                        const totalM = session.totalMinutes || 0;
                        const allOTM = otEntries.reduce((s, o) => s + (o.requestedMinutes || 0), 0);
                        const effectiveOTM = otEntries.filter(o => o.isAutoGenerated).reduce((s, o) => s + (o.requestedMinutes || 0), 0);
                        const regularM = Math.max(0, totalM - effectiveOTM);
                        const breakM = session.breakMinutes || session.totalBreakMinutes || 0;
                        const active = isActiveSession(session);

                        return (
                          <React.Fragment key={session.id}>
                            <tr className={`transition-colors ${isOT ? "bg-orange-50/30 hover:bg-orange-50/50" : "hover:bg-gray-50/50"}`}>
                              {/* Date */}
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-gray-900">{formatDateHeader(session.startTime)}</span>
                                  {getArrivalBadge(session)}
                                </div>
                                {session.client && (
                                  <span className="text-xs text-gray-400">{session.client.companyName}</span>
                                )}
                              </td>

                              {/* Schedule */}
                              <td className="py-2.5 px-3 text-center text-sm">
                                {session.scheduledStart && session.scheduledEnd ? (
                                  <span className="text-gray-700">
                                    {typeof session.scheduledStart === 'string' && /^\d{1,2}:\d{2}$/.test(session.scheduledStart)
                                      ? formatTime12(session.scheduledStart)
                                      : formatTime(session.scheduledStart)}
                                    <span className="text-gray-300 mx-0.5">–</span>
                                    {typeof session.scheduledEnd === 'string' && /^\d{1,2}:\d{2}$/.test(session.scheduledEnd)
                                      ? formatTime12(session.scheduledEnd)
                                      : formatTime(session.scheduledEnd)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {/* Clock In */}
                              <td className="py-2.5 px-3 text-center text-sm text-gray-900">
                                {formatTime(session.startTime)}
                              </td>

                              {/* Clock Out */}
                              <td className="py-2.5 px-3 text-center text-sm">
                                {active ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                                    <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                                    Active
                                  </span>
                                ) : session.endTime ? (
                                  <span className="text-gray-900">{formatTime(session.endTime)}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {/* Break */}
                              <td className="py-2.5 px-3 text-center text-sm">
                                {breakM > 0 ? (
                                  <span className="text-yellow-600 font-medium">{formatDurationShort(breakM)}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {/* Regular Hours */}
                              <td className="py-2.5 px-3 text-center text-sm">
                                {active ? (
                                  <span className="text-green-600 font-medium">In Progress</span>
                                ) : (
                                  <span className="font-semibold text-gray-900">{formatDuration(regularM)}</span>
                                )}
                              </td>

                              {/* Overtime */}
                              <td className="py-2.5 px-3 text-center">
                                {allOTM > 0 ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    {otEntries.map((ot, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 text-xs">
                                        <span className={`font-medium ${ot.status === "APPROVED" || ot.status === "AUTO_APPROVED" ? "text-green-600" : ot.status === "REJECTED" ? "text-red-500" : "text-amber-600"}`}>
                                          {formatDuration(ot.requestedMinutes)}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{ot.type === "SHIFT_EXTENSION" ? "ext" : "off"}</span>
                                        {/* {ot.status === "APPROVED" || ot.status === "AUTO_APPROVED" ? (
                                          <span className="text-green-500 text-[10px]">✓</span>
                                        ) : ot.status === "REJECTED" ? (
                                          <span className="text-red-400 text-[10px]">✗</span>
                                        ) : (
                                          <Clock className="w-3 h-3 text-amber-400" />
                                        )} */}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-2.5 px-3 text-center">
                                {getStatusBadge(session)}
                              </td>

                              {/* Actions */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleViewDetail(session)}
                                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {session.approvalStatus === "REVISION_REQUESTED" && session.timeRecordId && (
                                    <button
                                      onClick={() => handleResubmit(session.timeRecordId)}
                                      disabled={resubmitLoading === session.timeRecordId}
                                      className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                      title="Resubmit"
                                    >
                                      <RotateCcw className={`w-4 h-4 ${resubmitLoading === session.timeRecordId ? "animate-spin" : ""}`} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Revision banner */}
                            {session.approvalStatus === "REVISION_REQUESTED" && (
                              <tr className="bg-amber-50 border-b border-amber-100">
                                <td colSpan={8} className="px-4 py-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-amber-700">
                                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                      <span><strong>Revision requested:</strong> {session.revisionReason || "Please review and resubmit."}</span>
                                    </div>
                                    {session.timeRecordId && (
                                      <button
                                        onClick={() => handleResubmit(session.timeRecordId)}
                                        disabled={resubmitLoading === session.timeRecordId}
                                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                                      >
                                        <RotateCcw className={`w-3 h-3 ${resubmitLoading === session.timeRecordId ? "animate-spin" : ""}`} />
                                        {resubmitLoading === session.timeRecordId ? "Resubmitting..." : "Resubmit"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="md:hidden">
                  <div className="divide-y divide-gray-100">
                    {paginatedSessions.map((session) => {
                      const isOT = session.overtimeMinutes > 0;
                      return (
                        <div
                          key={session.id}
                          className={`p-4 ${isOT ? "bg-amber-50/40" : ""}`}
                        >
                          {/* Top row: date + status + actions */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {formatDateHeader(session.startTime)}
                                </span>
                                {getArrivalBadge(session)}
                              </div>
                              {session.client && (
                                <span className="text-xs text-gray-400">
                                  {session.client.companyName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(session)}
                              <button
                                onClick={() => handleViewDetail(session)}
                                className="p-1.5 text-gray-400 hover:text-primary rounded-lg"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Schedule + Actual In/Out */}
                          {session.scheduledStart && session.scheduledEnd && (
                            <div className="mb-2 px-3 py-1.5 bg-primary-50 rounded-lg flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-primary-400" />
                              <span className="text-xs text-gray-500">
                                Schedule:
                              </span>
                              <span className="text-xs font-medium text-gray-700">
                                {typeof session.scheduledStart === 'string' && /^\d{1,2}:\d{2}$/.test(session.scheduledStart)
                                  ? formatTime12(session.scheduledStart)
                                  : formatTime(session.scheduledStart)} –{" "}
                                {typeof session.scheduledEnd === 'string' && /^\d{1,2}:\d{2}$/.test(session.scheduledEnd)
                                  ? formatTime12(session.scheduledEnd)
                                  : formatTime(session.scheduledEnd)}
                              </span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                Actual In
                              </p>
                              <span className="text-sm font-semibold text-gray-900">
                                {formatTime(session.startTime)}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                Actual Out
                              </p>
                              {isActiveSession(session) ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                  Working
                                </span>
                              ) : session.endTime ? (
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatTime(session.endTime)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  Manual
                                </span>
                              )}
                            </div>

                            {/* Billing In/Out */}
                            <div>
                              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-0.5">
                                Billing In
                              </p>
                              {session.billingStart ? (
                                <span className="text-sm font-semibold text-blue-700">
                                  {formatTime(session.billingStart)}
                                </span>
                              ) : isActiveSession(session) ? (
                                <span className="text-xs text-gray-400 italic">
                                  In progress
                                </span>
                              ) : (
                                <span className="text-sm text-gray-300">
                                  &mdash;
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-0.5">
                                Billing Out
                              </p>
                              {session.billingEnd ? (
                                <span className="text-sm font-semibold text-blue-700">
                                  {(() => {
                                    const approvedOTMins = (session.overtimeEntries || [])
                                      .filter(ot => ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED')
                                      .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
                                    if (approvedOTMins > 0) {
                                      const adjustedEnd = new Date(new Date(session.billingEnd).getTime() + approvedOTMins * 60000);
                                      return formatTime(adjustedEnd);
                                    }
                                    return formatTime(session.billingEnd);
                                  })()}
                                </span>
                              ) : isActiveSession(session) ? (
                                <span className="text-xs text-gray-400 italic">
                                  In progress
                                </span>
                              ) : (
                                <span className="text-sm text-gray-300">
                                  &mdash;
                                </span>
                              )}
                            </div>

                            {/* Break */}
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                Break
                              </p>
                              {(session.breakMinutes ||
                                session.totalBreakMinutes) > 0 ? (
                                <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-600">
                                  <Coffee className="w-3 h-3" />
                                  {formatDurationShort(
                                    session.breakMinutes ||
                                      session.totalBreakMinutes,
                                  )}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-300">
                                  &mdash;
                                </span>
                              )}
                            </div>

                            {/* Regular Hours */}
                            <div>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                Regular
                              </p>
                              {(() => {
                                const otEntries = session.overtimeEntries || [];
                                const totalM = session.totalMinutes || 0;
                                const effectiveOTM = otEntries.filter(o => o.isAutoGenerated).reduce(
                                  (s, o) => s + (o.requestedMinutes || 0),
                                  0,
                                );
                                const regularM = Math.max(0, totalM - effectiveOTM);
                                return isActiveSession(session) ? (
                                  <span className="text-sm font-bold text-green-600">
                                    In Progress
                                  </span>
                                ) : (
                                  <span className="text-sm font-bold text-gray-900">
                                    {formatDuration(regularM)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

                          {/* OT summary row */}
                          {(() => {
                            const otEntries = session.overtimeEntries || [];
                            const shiftExtM = otEntries
                              .filter((o) => o.type === "SHIFT_EXTENSION")
                              .reduce(
                                (s, o) => s + (o.requestedMinutes || 0),
                                0,
                              );
                            const extraTimeM = otEntries
                              .filter((o) => o.type === "OFF_SHIFT")
                              .reduce(
                                (s, o) => s + (o.requestedMinutes || 0),
                                0,
                              );
                            if (shiftExtM === 0 && extraTimeM === 0)
                              return null;
                            return (
                              <div className="mt-3 flex items-center gap-6 text-sm text-gray-700">
                                {otEntries
                                  .filter((o) => o.type === "SHIFT_EXTENSION")
                                  .map((ot, i) => (
                                    <div key={i}>
                                      <p className="text-[10px] text-gray-400 uppercase">
                                        Shift Ext.
                                      </p>
                                      <div className="font-semibold text-purple-600">
                                        {formatDuration(ot.requestedMinutes)}
                                      </div>
                                      <span
                                        className={`text-[10px] ${ot.status === "APPROVED" ? "text-green-600" : ot.status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}
                                      >
                                        {ot.status === "APPROVED"
                                          ? "Approved"
                                          : ot.status === "REJECTED"
                                            ? "Rejected"
                                            : "Pending"}
                                      </span>
                                    </div>
                                  ))}
                                {otEntries
                                  .filter((o) => o.type === "OFF_SHIFT")
                                  .map((ot, i) => (
                                    <div key={i}>
                                      <p className="text-[10px] text-gray-400 uppercase">
                                        Off‑Shift
                                      </p>
                                      <div className="font-semibold text-orange-600">
                                        {formatDuration(ot.requestedMinutes)}
                                      </div>
                                      <span
                                        className={`text-[10px] ${ot.status === "APPROVED" ? "text-green-600" : ot.status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}
                                      >
                                        {ot.status === "APPROVED"
                                          ? "Approved"
                                          : ot.status === "REJECTED"
                                            ? "Rejected"
                                            : "Pending"}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            );
                          })()}

                          {/* Overtime entries */}
                          {session.overtimeEntries &&
                            session.overtimeEntries.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {session.overtimeEntries.map((ot, otIdx) => {
                                  const isApproved =
                                    ot.status === "APPROVED" ||
                                    ot.status === "AUTO_APPROVED";
                                  const isDenied = ot.status === "REJECTED";
                                  const badgeBg = isApproved
                                    ? "bg-green-100 text-green-800"
                                    : isDenied
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800";
                                  const badgeLabel = isApproved
                                    ? "Approved"
                                    : isDenied
                                      ? "Denied"
                                      : "Pending";
                                  return (
                                    <span
                                      key={ot.id || otIdx}
                                      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded ${badgeBg}`}
                                    >
                                      OT +
                                      {formatDurationShort(ot.requestedMinutes)}{" "}
                                      · {badgeLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                          {/* Revision banner */}
                          {session.approvalStatus === "REVISION_REQUESTED" && (
                            <div className="mt-3 p-2 bg-amber-100 rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-amber-700">
                                  <strong>Revision:</strong>{" "}
                                  {session.revisionReason ||
                                    "Please review and resubmit."}
                                </p>
                                {session.timeRecordId && (
                                  <button
                                    onClick={() =>
                                      handleResubmit(session.timeRecordId)
                                    }
                                    disabled={
                                      resubmitLoading === session.timeRecordId
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0"
                                  >
                                    <RotateCcw
                                      className={`w-3 h-3 ${resubmitLoading === session.timeRecordId ? "animate-spin" : ""}`}
                                    />
                                    Resubmit
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Showing {startIdx + 1}–{Math.min(startIdx + pageSize, sessions.length)} of {sessions.length} entries
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            currentPage === page
                              ? "bg-primary text-white"
                              : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                  </>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* Manual Time Card Tab */}
        {activeTab === "manual" && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm text-gray-500">
                Manual time entries for days you forgot to clock in.
              </p>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setShowAddTimeModal(true)}
              >
                Add Entry
              </Button>
            </div>
            {manualEntriesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : manualEntries.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No Manual Entries
                </h3>
                <p className="text-gray-500 text-sm">
                  No manual time entries found for this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Start Time
                      </th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        End Time
                      </th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Total Hours
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {manualEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-900 text-sm">
                            {formatDateHeader(entry.startTime)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {formatTime(entry.startTime)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {formatTime(entry.endTime)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-gray-900 text-sm">
                            {formatDuration(entry.workMinutes || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-gray-500">
                            {entry.notes || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Time Modal */}
      <Modal
        isOpen={showAddTimeModal}
        onClose={() => {
          setShowAddTimeModal(false);
          setAddTimeError(null);
        }}
        title="Add Time Entry"
        size="md"
      >
        <form onSubmit={handleAddTime} className="space-y-4">
          {addTimeError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 flex-1">{addTimeError}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={manualEntry.date}
              onChange={(e) =>
                setManualEntry({ ...manualEntry, date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={manualEntry.startTime}
                onChange={(e) =>
                  setManualEntry({ ...manualEntry, startTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={manualEntry.endTime}
                min={manualEntry.startTime}
                onChange={(e) =>
                  setManualEntry({ ...manualEntry, endTime: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                  manualEntry.endTime && manualEntry.endTime <= manualEntry.startTime
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                required
              />
              {manualEntry.endTime && manualEntry.endTime < manualEntry.startTime && (
                <p className="text-xs text-red-500 mt-1">End time can not be less than start time</p>
              )}
              {manualEntry.endTime && manualEntry.endTime === manualEntry.startTime && (
                <p className="text-xs text-red-500 mt-1">End time must be greater than start time</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={manualEntry.notes}
              onChange={(e) =>
                setManualEntry({ ...manualEntry, notes: e.target.value })
              }
              placeholder="Add notes about your work..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddTimeModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={addTimeLoading}
              className="flex-1"
            >
              Add Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSession(null);
          setSessionLogs([]);
        }}
        title="Session Details"
        size="xl"
      >
        {selectedSession && (
          <div className="space-y-6">
            {/* Session Summary */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {formatDateHeader(selectedSession.startTime)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actual Time
                  </p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {formatTime(selectedSession.startTime)}
                    {selectedSession.endTime
                      ? ` - ${formatTime(selectedSession.endTime)}`
                      : isActiveSession(selectedSession)
                        ? " - Active"
                        : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Billing Time
                  </p>
                  <p className="font-semibold text-blue-700 mt-1">
                    {selectedSession.billingStart && selectedSession.billingEnd
                      ? (() => {
                          const approvedOTMins = (selectedSession.overtimeEntries || [])
                            .filter(ot => ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED')
                            .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
                          const endTime = approvedOTMins > 0
                            ? new Date(new Date(selectedSession.billingEnd).getTime() + approvedOTMins * 60000)
                            : selectedSession.billingEnd;
                          return `${formatTime(selectedSession.billingStart)} - ${formatTime(endTime)}`;
                        })()
                      : isActiveSession(selectedSession)
                        ? "In Progress"
                        : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Duration
                  </p>
                  <p className="font-semibold text-green-600 mt-1">
                    {isActiveSession(selectedSession)
                      ? "In Progress"
                      : formatDuration(Math.max(0, selectedSession.totalMinutes || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </p>
                  <div className="mt-1">{getStatusBadge(selectedSession)}</div>
                </div>
              </div>

              {/* Overtime entries in detail */}
              {selectedSession.overtimeEntries &&
                selectedSession.overtimeEntries.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      Overtime
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSession.overtimeEntries.map((ot, otIdx) => {
                        const isApproved =
                          ot.status === "APPROVED" ||
                          ot.status === "AUTO_APPROVED";
                        const isDenied = ot.status === "REJECTED";
                        const badgeBg = isApproved
                          ? "bg-green-50 border-green-200 text-green-800"
                          : isDenied
                            ? "bg-red-50 border-red-200 text-red-800"
                            : "bg-amber-50 border-amber-200 text-amber-800";
                        const badgeLabel = isApproved
                          ? "Approved"
                          : isDenied
                            ? "Denied"
                            : "Pending";
                        return (
                          <div
                            key={ot.id || otIdx}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${badgeBg}`}
                          >
                            +{formatDurationShort(ot.requestedMinutes)} ·{" "}
                            {ot.type === "SHIFT_EXTENSION" ? "Shift Extension" : "Off-Shift"} ·{" "}
                            {badgeLabel}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {/* Notes */}
            {selectedSession.notes && (
              <div>
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Notes
                </h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {selectedSession.notes}
                </p>
              </div>
            )}

            {/* Activity Log */}
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Activity Log
              </h4>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : sessionLogs.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-700 text-white">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium">
                      <div className="col-span-4">Time</div>
                      <div className="col-span-3">User</div>
                      <div className="col-span-5">Log Message</div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {sessionLogs.map((log, index) => (
                      <div
                        key={log.id || index}
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-sm ${
                          index % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                        }`}
                      >
                        <div className="col-span-4 text-gray-500 text-xs">
                          <div>
                            {new Date(log.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                            ,{" "}
                            {new Date(log.createdAt)
                              .toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                              .toLowerCase()}
                          </div>
                        </div>
                        <div className="col-span-3 text-gray-900 text-xs font-medium">
                          {log.userName || "System"}
                        </div>
                        <div className="col-span-5 text-gray-600 text-xs">
                          {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-100">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No activity logs available</p>
                </div>
              )}
            </div>

            {/* Breaks List */}
            {selectedSession.breaks && selectedSession.breaks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Breaks
                </h4>
                <div className="space-y-2">
                  {selectedSession.breaks.map((brk, index) => (
                    <div
                      key={brk.id || index}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100"
                    >
                      <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-600">
                          {formatTime(brk.startTime)}
                          {brk.endTime && ` - ${formatTime(brk.endTime)}`}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-yellow-600">
                        {brk.durationMinutes
                          ? `${brk.durationMinutes} min`
                          : "In Progress"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimeRecords;
