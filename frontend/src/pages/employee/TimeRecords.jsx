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
  AlertCircle,
  CheckCircle,
  Eye,
  Plus,
  Coffee,
  X,
  RotateCcw,
  FileText,
  Loader2,
  Timer,
} from "lucide-react";
import { Card, Badge, Button, Modal } from "../../components/common";
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
  const [timesheetStatusFilter, setTimesheetStatusFilter] = useState("all");
  const [manualEntries, setManualEntries] = useState([]);
  const [manualEntriesLoading, setManualEntriesLoading] = useState(false);
  const [manualStatusFilter, setManualStatusFilter] = useState("all");

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Auto-clear toast message after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

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
    for (const e of manualEntries) {
      if (e.clientTimezone) return e.clientTimezone;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [sessions, manualEntries]);

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

    // Check for overlapping approved entries on the same date
    const entryDate = manualEntry.date;
    const newStart = manualEntry.startTime;
    const newEnd = manualEntry.endTime;

    const hasOverlap = manualEntries.some((entry) => {
      if (entry.date !== entryDate) return false;
      const status = entry.status?.toUpperCase();
      if (status !== "APPROVED" && status !== "AUTO_APPROVED" && status !== "PENDING") return false;

      const existingStart = entry.startTime;
      const existingEnd = entry.endTime;

      // Check for overlap: newStart < existingEnd AND newEnd > existingStart
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (hasOverlap) {
      setAddTimeError("You already have an entry for this time slot. Please choose different times.");
      return;
    }

    setAddTimeLoading(true);
    setAddTimeError(null);

    try {
      const result = await workSessionService.addManualEntry(manualEntry);
      if (result?.success) {
        // Trigger Toast on Success
        setToastMessage({
          title: "Manual Request Submitted Successful",
          description: "Hello Team will review and approve.",
        });
        
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
    const isOffShiftOT =
      (session.overtimeMinutes || 0) > 0 && (session.workMinutes || 0) === 0;
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

  const filteredSessions = useMemo(() => {
    if (timesheetStatusFilter === "all") return sessions;
    return sessions.filter((s) => {
      const status = s.approvalStatus?.toUpperCase();
      const otEntries = s.overtimeEntries || [];
      if (timesheetStatusFilter === "approved")
        return status === "APPROVED" || status === "AUTO_APPROVED";
      if (timesheetStatusFilter === "rejected") return status === "REJECTED";
      if (timesheetStatusFilter === "pending")
        return !status || status === "PENDING";
      if (timesheetStatusFilter === "revision")
        return status === "REVISION_REQUESTED";
      if (timesheetStatusFilter === "ot_rejected") {
        return (
          otEntries.length > 0 &&
          otEntries.some((ot) => ot.status === "REJECTED") &&
          !otEntries.some((ot) => ot.status === "PENDING")
        );
      }
      return true;
    });
  }, [sessions, timesheetStatusFilter]);

  const filteredManualEntries = useMemo(() => {
    if (manualStatusFilter === "all") return manualEntries;
    return manualEntries.filter((entry) => {
      const s = entry.status?.toUpperCase();
      if (manualStatusFilter === "approved")
        return s === "APPROVED" || s === "AUTO_APPROVED";
      if (manualStatusFilter === "rejected") return s === "REJECTED";
      if (manualStatusFilter === "pending") return !s || s === "PENDING";
      return true;
    });
  }, [manualEntries, manualStatusFilter]);

  const tabs = [
    { id: "timesheets", label: "Timesheets" },
    { id: "manual", label: "Manual Entry" },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Entries</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your work sessions
          </p>
        </div>
        {activeTab === "manual" && (
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowAddTimeModal(true)}
          >
            Add Time
          </Button>
        )}
      </div>

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
              {/* Status Filter */}
              {activeTab === "timesheets" && (
                <select
                  value={timesheetStatusFilter}
                  onChange={(e) => {
                    setTimesheetStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="ot_rejected">OT Rejected</option>
                  <option value="revision">Revision</option>
                </select>
              )}
              {activeTab === "manual" && (
                <select
                  value={manualStatusFilter}
                  onChange={(e) => setManualStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              )}
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
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No Time Entries
                </h3>
                <p className="text-gray-500 mb-4 text-sm">
                  {timesheetStatusFilter !== "all"
                    ? "No entries match the selected status."
                    : "No time entries found for this period."}
                </p>
                {timesheetStatusFilter === "all" && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => setShowAddTimeModal(true)}
                  >
                    Add Time Entry
                  </Button>
                )}
              </div>
            ) : (
              <>
                {(() => {
                  const totalPages = Math.ceil(
                    filteredSessions.length / pageSize,
                  );
                  const startIdx = (currentPage - 1) * pageSize;
                  const paginatedSessions = filteredSessions.slice(
                    startIdx,
                    startIdx + pageSize,
                  );

                  return (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 bg-slate-50/50">
                              <th className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-4">
                                Date
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Schedule
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Clock In
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Clock Out
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Break
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Regular Hours
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Overtime
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">
                                Status
                              </th>
                              <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3 w-16" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {paginatedSessions.map((session) => {
                              const isOT = session.overtimeMinutes > 0;
                              const otEntries = session.overtimeEntries || [];
                              const totalM = session.totalMinutes || 0;
                              const allOTM = otEntries.reduce(
                                (s, o) => s + (o.requestedMinutes || 0),
                                0,
                              );
                              const effectiveOTM = otEntries
                                .filter((o) => o.isAutoGenerated)
                                .reduce(
                                  (s, o) => s + (o.requestedMinutes || 0),
                                  0,
                                );
                              const regularM = Math.max(
                                0,
                                totalM - effectiveOTM,
                              );
                              const breakM =
                                session.breakMinutes ||
                                session.totalBreakMinutes ||
                                0;
                              const active = isActiveSession(session);

                              return (
                                <React.Fragment key={session.id}>
                                  <tr
                                    className={`transition-colors ${isOT ? "bg-orange-50/30 hover:bg-orange-50/50" : "hover:bg-gray-50/50"}`}
                                  >
                                    <td className="py-2.5 px-4">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-gray-900">
                                          {formatDateHeader(session.startTime)}
                                        </span>
                                        {getArrivalBadge(session)}
                                      </div>
                                      {session.client && (
                                        <span className="text-xs text-gray-400">
                                          {session.client.companyName}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {session.scheduledStart &&
                                      session.scheduledEnd ? (
                                        <span className="text-gray-700">
                                          {typeof session.scheduledStart ===
                                            "string" &&
                                          /^\d{1,2}:\d{2}$/.test(
                                            session.scheduledStart,
                                          )
                                            ? formatTime12(
                                                session.scheduledStart,
                                              )
                                            : formatTime(
                                                session.scheduledStart,
                                              )}
                                          <span className="text-gray-300 mx-0.5">
                                            –
                                          </span>
                                          {typeof session.scheduledEnd ===
                                            "string" &&
                                          /^\d{1,2}:\d{2}$/.test(
                                            session.scheduledEnd,
                                          )
                                            ? formatTime12(session.scheduledEnd)
                                            : formatTime(session.scheduledEnd)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-sm text-gray-900">
                                      {formatTime(session.startTime)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {active ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                                          <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                                          Active
                                        </span>
                                      ) : session.endTime ? (
                                        <span className="text-gray-900">
                                          {formatTime(session.endTime)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {breakM > 0 ? (
                                        <span className="text-yellow-600 font-medium">
                                          {formatDurationShort(breakM)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-sm">
                                      {active ? (
                                        <span className="text-green-600 font-medium">
                                          In Progress
                                        </span>
                                      ) : (
                                        <span className="font-semibold text-gray-900">
                                          {formatDuration(regularM)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {allOTM > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          {otEntries.map((ot, i) => (
                                            <span
                                              key={i}
                                              className="inline-flex items-center gap-1 text-xs"
                                            >
                                              <span
                                                className={`font-medium ${ot.status === "APPROVED" || ot.status === "AUTO_APPROVED" ? "text-green-600" : ot.status === "REJECTED" ? "text-red-500" : "text-amber-600"}`}
                                              >
                                                {formatDuration(
                                                  ot.requestedMinutes,
                                                )}
                                              </span>
                                              <span className="text-[10px] text-gray-400">
                                                {ot.type === "SHIFT_EXTENSION"
                                                  ? "ext"
                                                  : "off"}
                                              </span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {getStatusBadge(session)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() =>
                                            handleViewDetail(session)
                                          }
                                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                          title="View details"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        {session.approvalStatus ===
                                          "REVISION_REQUESTED" &&
                                          session.timeRecordId && (
                                            <button
                                              onClick={() =>
                                                handleResubmit(
                                                  session.timeRecordId,
                                                )
                                              }
                                              disabled={
                                                resubmitLoading ===
                                                session.timeRecordId
                                              }
                                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                              title="Resubmit"
                                            >
                                              <RotateCcw
                                                className={`w-4 h-4 ${resubmitLoading === session.timeRecordId ? "animate-spin" : ""}`}
                                              />
                                            </button>
                                          )}
                                      </div>
                                    </td>
                                  </tr>
                                  {session.approvalStatus ===
                                    "REVISION_REQUESTED" && (
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                      <td colSpan={8} className="px-4 py-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 text-sm text-amber-700">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <span>
                                              <strong>
                                                Revision requested:
                                              </strong>{" "}
                                              {session.revisionReason ||
                                                "Please review and resubmit."}
                                            </span>
                                          </div>
                                          {session.timeRecordId && (
                                            <button
                                              onClick={() =>
                                                handleResubmit(
                                                  session.timeRecordId,
                                                )
                                              }
                                              disabled={
                                                resubmitLoading ===
                                                session.timeRecordId
                                              }
                                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                                            >
                                              <RotateCcw
                                                className={`w-3 h-3 ${resubmitLoading === session.timeRecordId ? "animate-spin" : ""}`}
                                              />
                                              {resubmitLoading ===
                                              session.timeRecordId
                                                ? "Resubmitting..."
                                                : "Resubmit"}
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

                      {/* Pagination UI Placeholder (kept as is) */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            Showing {startIdx + 1}–
                            {Math.min(
                              startIdx + pageSize,
                              filteredSessions.length,
                            )}{" "}
                            of {filteredSessions.length} entries
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                              }
                              disabled={currentPage === 1}
                              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Previous
                            </button>
                            {Array.from(
                              { length: totalPages },
                              (_, i) => i + 1,
                            ).map((page) => (
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
                              onClick={() =>
                                setCurrentPage((p) =>
                                  Math.min(totalPages, p + 1),
                                )
                              }
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

        {/* Manual Tab content (kept as is) */}
        {activeTab === "manual" && (
          <>
            {manualEntriesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredManualEntries.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No Manual Entries
                </h3>
                <p className="text-gray-500 text-sm">
                  {manualStatusFilter !== "all"
                    ? "No entries match the selected status."
                    : "No manual time entries found for this period."}
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
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredManualEntries.map((entry) => {
                      const status = entry.status?.toUpperCase();
                      const statusBadge =
                        status === "APPROVED" || status === "AUTO_APPROVED" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Approved
                          </span>
                        ) : status === "REJECTED" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            Pending
                          </span>
                        );
                      return (
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
                          <td className="py-3 px-3 text-center">
                            {statusBadge}
                          </td>
                        </tr>
                      );
                    })}
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
                  manualEntry.endTime &&
                  manualEntry.endTime <= manualEntry.startTime
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                required
              />
              {manualEntry.endTime &&
                manualEntry.endTime < manualEntry.startTime && (
                  <p className="text-xs text-red-500 mt-1">
                    End time can not be less than start time
                  </p>
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
              Submit
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
        }}
        title="Session Details"
        size="xl"
      >
        {selectedSession && (() => {
          const s = selectedSession;
          const startDt = s.startTime ? new Date(s.startTime) : null;
          const endDt = s.endTime ? new Date(s.endTime) : null;
          const sessionDate = startDt
            ? startDt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : '—';

          const fmtTime = (dt) =>
            dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';

          // Handles both ISO datetimes and raw "HH:MM" strings
          const fmtScheduledTime = (val) => {
            if (!val) return '—';
            if (/^\d{1,2}:\d{2}$/.test(val)) {
              const [h, m] = val.split(':').map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
            const dt = new Date(val);
            return isNaN(dt.getTime()) ? val : fmtTime(dt);
          };

          const fmtMins = (mins) => {
            if (mins == null || mins === 0) return '0m';
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
          };

          const statusColors = {
            ACTIVE: 'bg-green-100 text-green-700',
            ON_BREAK: 'bg-yellow-100 text-yellow-700',
            COMPLETED: 'bg-blue-100 text-blue-700',
            APPROVED: 'bg-green-100 text-green-700',
            PENDING: 'bg-yellow-100 text-yellow-700',
            REJECTED: 'bg-red-100 text-red-700',
          };
          const statusLabel = {
            ACTIVE: 'Active',
            ON_BREAK: 'On Break',
            COMPLETED: 'Completed',
            APPROVED: 'Approved',
            PENDING: 'Pending',
            REJECTED: 'Rejected',
          };

          const lunchStatusColors = {
            ON_TIME: 'bg-green-100 text-green-700',
            EXTENDED: 'bg-yellow-100 text-yellow-700',
            WAS_WORKING: 'bg-blue-100 text-blue-700',
            UNAUTHORIZED: 'bg-red-100 text-red-700',
          };
          const lunchStatusLabel = {
            ON_TIME: 'On Time',
            EXTENDED: 'Extended',
            WAS_WORKING: 'Was Working',
            UNAUTHORIZED: 'Unauthorized',
          };

          const approvalStatusColors = {
            PENDING: 'bg-yellow-100 text-yellow-700',
            APPROVED: 'bg-green-100 text-green-700',
            AUTO_APPROVED: 'bg-blue-100 text-blue-700',
            PENDING_REVIEW: 'bg-orange-100 text-orange-700',
            DENIED: 'bg-red-100 text-red-700',
          };
          const approvalStatusLabel = {
            PENDING: 'Pending',
            APPROVED: 'Approved',
            AUTO_APPROVED: 'Auto-Approved',
            PENDING_REVIEW: 'Pending Review',
            DENIED: 'Denied',
          };

          const breaks = s.breaks || [];

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{sessionDate}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-lg font-semibold text-gray-900">
                      {fmtTime(startDt)} – {fmtTime(endDt)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[s.status] || s.status}
                    </span>
                  </div>
                  {s.client?.companyName && (
                    <p className="text-sm text-gray-500 mt-0.5">{s.client.companyName}</p>
                  )}
                </div>
                {s.approvalStatus && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${approvalStatusColors[s.approvalStatus] || 'bg-gray-100 text-gray-600'}`}>
                    {approvalStatusLabel[s.approvalStatus] || s.approvalStatus}
                  </span>
                )}
              </div>

              {/* Time Summary */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Time Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-8 gap-1">
                  {[
                    { label: 'Scheduled', value: `${fmtScheduledTime(s.scheduledStart)} – ${fmtScheduledTime(s.scheduledEnd)}`, full: true },
                    { label: 'Total Time', value: fmtMins(s.totalMinutes) },
                    { label: 'Work Time', value: fmtMins(s.workMinutes) },
                    { label: 'Break Time', value: fmtMins(s.breakMinutes) },
                    { label: 'Overtime', value: fmtMins(s.overtimeMinutes) },
                    ...(s.billingMinutes != null ? [{ label: 'Billing', value: fmtMins(s.billingMinutes) }] : []),
                  ].map((item, i) => (
                    <div key={i} className={`bg-gray-50 rounded-lg px-3 py-2.5 ${item.full ? 'col-span-2 sm:col-span-3' : ''}`}>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breaks */}
              {breaks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Breaks ({breaks.length})
                  </h3>
                  <div className="space-y-2">
                    {breaks.map((brk, i) => {
                      const bStart = brk.startTime ? new Date(brk.startTime) : null;
                      const bEnd = brk.endTime ? new Date(brk.endTime) : null;
                      return (
                        <div key={i} className="border border-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Coffee className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-700">
                                {fmtTime(bStart)} – {fmtTime(bEnd)}
                              </span>
                              {brk.durationMinutes != null && (
                                <span className="text-xs text-gray-500">({fmtMins(brk.durationMinutes)})</span>
                              )}
                            </div>
                            {brk.lunchStatus && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lunchStatusColors[brk.lunchStatus] || 'bg-gray-100 text-gray-600'}`}>
                                {lunchStatusLabel[brk.lunchStatus] || brk.lunchStatus}
                              </span>
                            )}
                          </div>
                          {(brk.paidMinutes != null || brk.unpaidMinutes != null) && (
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              {brk.paidMinutes != null && <span>Paid: {fmtMins(brk.paidMinutes)}</span>}
                              {brk.unpaidMinutes != null && <span>Unpaid: {fmtMins(brk.unpaidMinutes)}</span>}
                            </div>
                          )}
                          {brk.bypassApprovalStatus && brk.bypassApprovalStatus !== 'PENDING_REVIEW' && (
                            <div className="mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${approvalStatusColors[brk.bypassApprovalStatus] || 'bg-gray-100 text-gray-600'}`}>
                                {approvalStatusLabel[brk.bypassApprovalStatus] || brk.bypassApprovalStatus}
                              </span>
                            </div>
                          )}
                          {brk.bypassApprovalStatus === 'PENDING_REVIEW' && (
                            <div className="mt-2 bg-orange-50 text-orange-700 text-xs rounded px-2 py-1">
                              Pending Hello Team approval
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {s.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap">{s.notes}</p>
                </div>
              )}

              {/* Activity Log */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity Log</h3>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-sm">Loading activity...</span>
                  </div>
                ) : sessionLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No activity recorded.</p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {sessionLogs.map((log, i) => (
                      <div key={i} className="flex gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5 w-32 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-700">{log.action?.replace(/_/g, ' ')}</span>
                          {log.details && <span className="text-gray-500 ml-1">— {log.details}</span>}
                          {log.actorName && <span className="text-xs text-gray-400 ml-1">by {log.actorName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Toast Notification UI */}
      {toastMessage && (
        <div className="fixed top-15 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white border-l-4 border-green-500 shadow-2xl rounded-lg p-4 flex items-start gap-3 min-w-[320px] ring-1 ring-black/5">
            <div className="bg-green-100 p-1.5 rounded-full flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900">{toastMessage.title}</h3>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                {toastMessage.description}
              </p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRecords;