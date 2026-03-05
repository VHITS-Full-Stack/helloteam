import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Timer,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card, Button, Badge, Avatar } from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";
import { formatHours, formatDuration } from "../../utils/formatTime";

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

const TimesheetDetail = () => {
  const { employeeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Employee info from navigation state (for fast initial render)
  const stateData = location.state || {};
  const [employeeInfo, setEmployeeInfo] = useState({
    name: stateData.employeeName || "",
    photo: stateData.employeePhoto || null,
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [halfFilter, setHalfFilter] = useState("full"); // 'full' | '1st' | '2nd'

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionRecordIds, setRevisionRecordIds] = useState([]);
  const [clientTimezone, setClientTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showOTApproveModal, setShowOTApproveModal] = useState(false);
  const [showOTRejectModal, setShowOTRejectModal] = useState(false);
  const [selectedOTRecord, setSelectedOTRecord] = useState(null);
  const [otRejectReason, setOtRejectReason] = useState("");

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const response = await clientPortalService.getTimeRecords({
        startDate,
        endDate,
      });
      if (response.success) {
        if (response.data.clientTimezone) setClientTimezone(response.data.clientTimezone);
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
  }, [currentMonth, employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation handlers
  const handlePreviousMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };
  const handleNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };
  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
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
        fetchData();
      }
    } catch (err) {
      setError(err.message || "Failed to request revision");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveOvertime = (dayRecord) => {
    if (!dayRecord?.timeRecordId) return;
    setSelectedOTRecord(dayRecord);
    setShowOTApproveModal(true);
  };

  const handleRejectOvertime = (dayRecord) => {
    if (!dayRecord?.timeRecordId) return;
    setSelectedOTRecord(dayRecord);
    setOtRejectReason("");
    setShowOTRejectModal(true);
  };

  const confirmApproveOvertime = async () => {
    if (!selectedOTRecord?.timeRecordId) return;
    try {
      setActionLoading(true);
      const response = await clientPortalService.approveTimeRecord(
        selectedOTRecord.timeRecordId,
      );
      if (response.success) {
        setShowOTApproveModal(false);
        setSelectedOTRecord(null);
        await fetchData();
      } else {
        setError(response.error || "Failed to approve overtime");
      }
    } catch (err) {
      setError(
        err?.error || err?.message || "Failed to approve overtime",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRejectOvertime = async () => {
    if (!selectedOTRecord?.timeRecordId || !otRejectReason.trim()) return;
    try {
      setActionLoading(true);
      const response = await clientPortalService.rejectTimeRecord(
        selectedOTRecord.timeRecordId,
        otRejectReason.trim(),
      );
      if (response.success) {
        setShowOTRejectModal(false);
        setSelectedOTRecord(null);
        setOtRejectReason("");
        await fetchData();
      } else {
        setError(response.error || "Failed to deny overtime");
      }
    } catch (err) {
      setError(
        err?.error || err?.message || "Failed to deny overtime",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Build day data map: dayOfMonth -> record
  const dayDataMap = {};
  record?.records?.forEach((rec) => {
    const d = new Date(rec.date);
    dayDataMap[d.getUTCDate()] = rec;
  });

  // Compute totals
  const totalHours = record?.totalHours ?? 0;
  const overtimeHours = record?.overtimeHours ?? 0;
  const regularHours = totalHours - overtimeHours;
  const otEntryCount = record?.overtimeEntries?.length ?? 0;

  const getStatusBadge = (status, holidayName) => {
    switch (status) {
      case "approved":
      case "auto_approved":
        return <Badge variant="success">Approved</Badge>;
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

  const periodLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with back button */}
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

      {/* Period Navigation + Half Filter */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Half filter toggle */}
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            {[
              { key: "full", label: "Full Month" },
              { key: "1st", label: "1st Half" },
              { key: "2nd", label: "2nd Half" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setHalfFilter(opt.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${halfFilter === opt.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg min-w-[180px] justify-center">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 text-sm">
                {periodLabel}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
            <Button variant="ghost" size="sm" onClick={handleCurrentMonth}>
              Today
            </Button>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    {formatHours(totalHours)}
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regular
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatHours(regularHours)}
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
                  <p className="text-2xl font-bold text-orange-600">
                    {formatHours(overtimeHours)}
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OT Entries
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {otEntryCount}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Monthly View — single flat table */}
          {(() => {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

            // Determine day range based on half filter
            const rangeStart = halfFilter === "2nd" ? 16 : 1;
            const rangeEnd = halfFilter === "1st" ? 15 : daysInMonth;

            // Compute filtered totals
            let filteredTotalMins = 0;
            let filteredOtMins = 0;
            let filteredApprovedOtMins = 0;
            for (let day = rangeStart; day <= rangeEnd; day++) {
              const rec = dayDataMap[day];
              if (rec) {
                filteredTotalMins += rec.totalMinutes || 0;
                filteredOtMins += rec.overtimeMinutes || 0;
                filteredApprovedOtMins += (rec.overtimeEntries || [])
                  .filter(
                    (ot) =>
                      ot.status === "APPROVED" || ot.status === "AUTO_APPROVED",
                  )
                  .reduce((sum, ot) => sum + (ot.requestedMinutes || 0), 0);
              }
            }
            const filteredRegularMins = filteredTotalMins - filteredOtMins;
            const filteredDisplayTotal =
              filteredRegularMins + filteredApprovedOtMins;
            const totalLabel =
              halfFilter === "1st"
                ? "1st Half Total"
                : halfFilter === "2nd"
                  ? "2nd Half Total"
                  : "Monthly Total";

            // Format schedule time (HH:MM -> readable)
            const formatScheduleTime = (timeStr) => {
              if (!timeStr) return null;
              const [h, m] = timeStr.split(":").map(Number);
              const ampm = h >= 12 ? "PM" : "AM";
              const hr = h % 12 || 12;
              return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
            };

            return (
              <Card padding="none">
                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Date
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Schedule
                        </th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Billing In/Out
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Break Duration
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Regular Hours
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Shift Extension Hours
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Off‑Shift / Extra Time
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Total
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2.5 px-5">
                          Approval Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const rows = [];
                        for (let day = rangeStart; day <= rangeEnd; day++) {
                          const date = new Date(year, month, day);
                          const dayOfWeek = date.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const rec = dayDataMap[day];
                          const totalM = rec ? rec.totalMinutes || 0 : 0;

                          // Skip days with no work data
                          if (!rec) continue;
                          // Skip weekends with no hours
                          if (isWeekend && totalM === 0) continue;

                          const isToday =
                            today.getDate() === day &&
                            today.getMonth() === month &&
                            today.getFullYear() === year;
                          const recStatus = rec?.status?.toLowerCase();
                          const isLeaveOrHoliday =
                            recStatus === "paid_leave" ||
                            recStatus === "unpaid_leave" ||
                            recStatus === "holiday";
                          const otM = rec ? rec.overtimeMinutes || 0 : 0;
                          const approvedOtM = (rec?.overtimeEntries || [])
                            .filter(
                              (ot) =>
                                ot.status === "APPROVED" ||
                                ot.status === "AUTO_APPROVED",
                            )
                            .reduce(
                              (sum, ot) => sum + (ot.requestedMinutes || 0),
                              0,
                            );
                          const regularM = Math.max(0, totalM - otM);
                          const displayTotal = regularM + approvedOtM;
                          const dateLabel = date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                          const schedStart = formatScheduleTime(
                            rec?.scheduledStart,
                          );
                          const schedEnd = formatScheduleTime(
                            rec?.scheduledEnd,
                          );

                          const hasOT = otM > 0;
                          const rowBg = isLeaveOrHoliday
                            ? "bg-gray-50/50"
                            : hasOT
                              ? "bg-yellow-50/60"
                              : isToday
                                ? "bg-primary-50/30"
                                : "";

                          // Determine status display
                          const getRowStatus = () => {
                            if (!rec)
                              return (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                  Not Started
                                </span>
                              );
                            if (hasOT && recStatus === "pending")
                              return (
                                <Badge
                                  variant="warning"
                                  className="bg-orange-100 text-orange-700"
                                >
                                  OT Pending
                                </Badge>
                              );
                            return getStatusBadge(recStatus);
                          };

                          rows.push(
                            <tr key={day} className={rowBg}>
                              <td className="py-3 px-5 text-sm">
                                <span
                                  className={`font-medium ${isToday ? "text-primary-700" : "text-gray-900"}`}
                                >
                                  {dateLabel}
                                </span>
                              </td>
                              <td className="py-3 px-5 text-sm text-gray-600">
                                {schedStart && schedEnd ? (
                                  <span className="whitespace-nowrap">
                                    {schedStart} - {schedEnd}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">&mdash;</span>
                                )}
                              </td>
                              {isLeaveOrHoliday ? (
                                <td
                                  colSpan={6}
                                  className="py-3 px-5 text-sm text-center"
                                >
                                  {getStatusBadge(recStatus, rec?.holidayName)}
                                </td>
                              ) : (
                                <>
                                  <td className="py-3 px-5 text-sm text-center">
                                    {rec?.billingStart && rec?.billingEnd ? (
                                      <span className="text-gray-900 font-medium">
                                        {formatClockTime(rec.billingStart, clientTimezone)}
                                        <span className="text-gray-300 mx-1">–</span>
                                        {formatClockTime(rec.billingEnd, clientTimezone)}
                                      </span>
                                    ) : rec?.clockIn ? (
                                      <span className="text-gray-700">
                                        {formatClockTime(rec.clockIn, clientTimezone)}
                                        <span className="text-gray-300 mx-1">–</span>
                                        {rec?.clockOut ? formatClockTime(rec.clockOut, clientTimezone) : '—'}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">&mdash;</span>
                                    )}
                                    {rec?.isLate && <span className="ml-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">LATE</span>}
                                  </td>
                                  <td className="py-3 px-5 text-sm">
                                    <span
                                      className={
                                        (rec?.breakMinutes || 0) > 0
                                          ? "font-medium text-yellow-600"
                                          : "text-gray-400"
                                      }
                                    >
                                      {(rec?.breakMinutes || 0) > 0
                                        ? formatHours(rec.breakMinutes / 60)
                                        : "—"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-5 text-sm">
                                    <span
                                      className={
                                        regularM > 0
                                          ? "font-medium text-gray-900"
                                          : "text-gray-400"
                                      }
                                    >
                                      {formatHours(regularM / 60)}
                                    </span>
                                  </td>
                                  {(() => {
                                    const shiftExtM = (
                                      rec?.overtimeEntries || []
                                    )
                                      .filter(
                                        (ot) => ot.type === "SHIFT_EXTENSION",
                                      )
                                      .reduce(
                                        (sum, ot) =>
                                          sum + (ot.requestedMinutes || 0),
                                        0,
                                      );
                                    const extraTimeM = (
                                      rec?.overtimeEntries || []
                                    )
                                      .filter((ot) => ot.type === "OFF_SHIFT")
                                      .reduce(
                                        (sum, ot) =>
                                          sum + (ot.requestedMinutes || 0),
                                        0,
                                      );
                                    return (
                                      <>
                                        <td className="py-3 px-5 text-sm">
                                          <span
                                            className={
                                              shiftExtM > 0
                                                ? "font-medium text-purple-600"
                                                : "text-gray-400"
                                            }
                                          >
                                            {shiftExtM > 0
                                              ? formatHours(shiftExtM / 60)
                                              : "—"}
                                          </span>
                                        </td>
                                        <td className="py-3 px-5 text-sm">
                                          <span
                                            className={
                                              extraTimeM > 0
                                                ? "font-medium text-orange-600"
                                                : "text-gray-400"
                                            }
                                          >
                                            {extraTimeM > 0
                                              ? formatHours(extraTimeM / 60)
                                              : "—"}
                                          </span>
                                        </td>
                                      </>
                                    );
                                  })()}
                                  <td className="py-3 px-5 text-sm">
                                    <span
                                      className={
                                        displayTotal > 0
                                          ? "font-semibold text-green-700"
                                          : "text-gray-400"
                                      }
                                    >
                                      {formatHours(displayTotal / 60)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {getRowStatus()}
                                      {hasOT && recStatus === "pending" && rec?.timeRecordId && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleApproveOvertime(rec)}
                                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                          >
                                            Approve OT
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectOvertime(rec)}
                                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                                          >
                                            Deny OT
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>,
                          );
                        }
                        return rows;
                      })()}
                    </tbody>
                    <tfoot>
                      {(() => {
                        let filteredShiftExtMins = 0;
                        let filteredExtraTimeMins = 0;
                        for (let d = rangeStart; d <= rangeEnd; d++) {
                          const r = dayDataMap[d];
                          if (r) {
                            filteredShiftExtMins += (r.overtimeEntries || [])
                              .filter((ot) => ot.type === "SHIFT_EXTENSION")
                              .reduce(
                                (sum, ot) => sum + (ot.requestedMinutes || 0),
                                0,
                              );
                            filteredExtraTimeMins += (r.overtimeEntries || [])
                              .filter((ot) => ot.type === "OFF_SHIFT")
                              .reduce(
                                (sum, ot) => sum + (ot.requestedMinutes || 0),
                                0,
                              );
                          }
                        }
                        return (
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <td className="py-3 px-5 text-sm font-semibold text-gray-700">
                              {totalLabel}
                            </td>
                            <td colSpan={4} />
                            <td className="py-3 px-5 text-sm font-semibold text-gray-900">
                              {formatHours(filteredRegularMins / 60)}
                            </td>
                            <td className="py-3 px-5 text-sm font-semibold text-purple-700">
                              {filteredShiftExtMins > 0
                                ? formatHours(filteredShiftExtMins / 60)
                                : "0h"}
                            </td>
                            <td className="py-3 px-5 text-sm font-semibold text-orange-700">
                              {filteredExtraTimeMins > 0
                                ? formatHours(filteredExtraTimeMins / 60)
                                : "0h"}
                            </td>
                            <td className="py-3 px-5 text-sm font-semibold text-green-700">
                              {formatHours(filteredDisplayTotal / 60)}
                            </td>
                            <td className="py-3 px-5" />
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden px-4 py-4 space-y-2">
                  {(() => {
                    const items = [];
                    for (let day = rangeStart; day <= rangeEnd; day++) {
                      const date = new Date(year, month, day);
                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const rec = dayDataMap[day];
                      const totalM = rec ? rec.totalMinutes || 0 : 0;

                      // Skip days with no work data
                      if (!rec) continue;
                      // Skip weekends with no hours
                      if (isWeekend && totalM === 0) continue;

                      const recStatus = rec?.status?.toLowerCase();
                      const isLeaveOrHoliday =
                        recStatus === "paid_leave" ||
                        recStatus === "unpaid_leave" ||
                        recStatus === "holiday";
                      const otM = rec ? rec.overtimeMinutes || 0 : 0;
                      const approvedOtM = (rec?.overtimeEntries || [])
                        .filter(
                          (ot) =>
                            ot.status === "APPROVED" ||
                            ot.status === "AUTO_APPROVED",
                        )
                        .reduce(
                          (sum, ot) => sum + (ot.requestedMinutes || 0),
                          0,
                        );
                      const regularM = Math.max(0, totalM - otM);
                      const displayTotal = regularM + approvedOtM;
                      const dateLabel = date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                      const schedStart = formatScheduleTime(
                        rec?.scheduledStart,
                      );
                      const schedEnd = formatScheduleTime(rec?.scheduledEnd);

                      const hasOT = otM > 0;
                      const cardBg = isLeaveOrHoliday
                        ? "bg-gray-50"
                        : hasOT
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-white border-gray-100";

                      // Determine status display for mobile
                      const getMobileStatus = () => {
                        if (hasOT && recStatus === "pending")
                          return (
                            <Badge
                              variant="warning"
                              className="bg-orange-100 text-orange-700"
                            >
                              OT Pending
                            </Badge>
                          );
                        return getStatusBadge(recStatus, rec?.holidayName);
                      };

                      items.push(
                        <div
                          key={day}
                          className={`px-3 py-2.5 rounded-lg border ${cardBg}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {dateLabel}
                            </span>
                            <div className="flex items-center gap-2">
                              {getMobileStatus()}
                              {hasOT && recStatus === "pending" && rec?.timeRecordId && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOvertime(rec)}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectOvertime(rec)}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                                  >
                                    Deny
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {schedStart && schedEnd && (
                            <p className="text-xs text-gray-400 mt-1">
                              Schedule: {schedStart} - {schedEnd}
                            </p>
                          )}
                          {!isLeaveOrHoliday && (
                            <>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                {rec?.billingStart && rec?.billingEnd ? (
                                  <>
                                    <span>In: {formatClockTime(rec.billingStart, clientTimezone)}</span>
                                    <span>Out: {formatClockTime(rec.billingEnd, clientTimezone)}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>In: {rec?.clockIn ? formatClockTime(rec.clockIn, clientTimezone) : "—"}</span>
                                    <span>Out: {rec?.clockOut ? formatClockTime(rec.clockOut, clientTimezone) : "—"}</span>
                                  </>
                                )}
                                {rec?.isLate && <span className="text-red-600 font-semibold">LATE</span>}
                                {(rec?.breakMinutes || 0) > 0 && (
                                  <span className="text-yellow-600">
                                    Break: {formatHours(rec.breakMinutes / 60)}
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const shiftExtM = (rec?.overtimeEntries || [])
                                  .filter((ot) => ot.type === "SHIFT_EXTENSION")
                                  .reduce(
                                    (sum, ot) =>
                                      sum + (ot.requestedMinutes || 0),
                                    0,
                                  );
                                const extraTimeM = (rec?.overtimeEntries || [])
                                  .filter((ot) => ot.type === "OFF_SHIFT")
                                  .reduce(
                                    (sum, ot) =>
                                      sum + (ot.requestedMinutes || 0),
                                    0,
                                  );
                                return (
                                  <div className="flex items-center gap-3 mt-1 text-xs">
                                    <span
                                      className={
                                        regularM > 0
                                          ? "text-gray-700"
                                          : "text-gray-400"
                                      }
                                    >
                                      Reg: {formatHours(regularM / 60)}
                                    </span>
                                    {shiftExtM > 0 && (
                                      <span className="text-purple-600">
                                        Ext: {formatHours(shiftExtM / 60)}
                                      </span>
                                    )}
                                    {extraTimeM > 0 && (
                                      <span className="text-orange-600">
                                        Extra: {formatHours(extraTimeM / 60)}
                                      </span>
                                    )}
                                    <span
                                      className={`ml-auto text-sm font-semibold ${displayTotal > 0 ? "text-green-700" : "text-gray-400"}`}
                                    >
                                      Total: {formatHours(displayTotal / 60)}
                                    </span>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>,
                      );
                    }
                    return items;
                  })()}
                  {(() => {
                    let mobileShiftExtMins = 0;
                    let mobileExtraTimeMins = 0;
                    for (let d = rangeStart; d <= rangeEnd; d++) {
                      const r = dayDataMap[d];
                      if (r) {
                        mobileShiftExtMins += (r.overtimeEntries || [])
                          .filter((ot) => ot.type === "SHIFT_EXTENSION")
                          .reduce(
                            (sum, ot) => sum + (ot.requestedMinutes || 0),
                            0,
                          );
                        mobileExtraTimeMins += (r.overtimeEntries || [])
                          .filter((ot) => ot.type === "OFF_SHIFT")
                          .reduce(
                            (sum, ot) => sum + (ot.requestedMinutes || 0),
                            0,
                          );
                      }
                    }
                    return (
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-100 font-semibold mt-2">
                        <span className="text-sm text-gray-700">
                          {totalLabel}
                        </span>
                        <div className="text-right text-sm">
                          <span className="text-gray-900">
                            {formatHours(filteredRegularMins / 60)} reg
                          </span>
                          {mobileShiftExtMins > 0 && (
                            <span className="text-purple-600">
                              {" "}
                              + {formatHours(mobileShiftExtMins / 60)} ext
                            </span>
                          )}
                          {mobileExtraTimeMins > 0 && (
                            <span className="text-orange-600">
                              {" "}
                              + {formatHours(mobileExtraTimeMins / 60)} extra
                            </span>
                          )}
                          <span className="text-green-700 font-bold ml-2">
                            = {formatHours(filteredDisplayTotal / 60)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            );
          })()}

          {/* Revision reason display */}
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
            if (revisionEligible.length === 0) return null;
            return (
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    handleRequestRevision(
                      revisionEligible.map((r) => r.timeRecordId),
                    )
                  }
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Request Revisions
                </button>
              </div>
            );
          })()}
        </>
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
      )}

      {/* Overtime Approval Modal */}
      {showOTApproveModal && selectedOTRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowOTApproveModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Approve Overtime
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to approve overtime for{" "}
              <span className="font-semibold">
                {new Date(selectedOTRecord.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowOTApproveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmApproveOvertime}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? "Approving..." : "Approve Overtime"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overtime Deny Modal */}
      {showOTRejectModal && selectedOTRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowOTRejectModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Deny Overtime
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for denying overtime on{" "}
              <span className="font-semibold">
                {new Date(selectedOTRecord.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              . The employee will be notified.
            </p>
            <textarea
              value={otRejectReason}
              onChange={(e) => setOtRejectReason(e.target.value)}
              placeholder="Enter reason for denial..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowOTRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectOvertime}
                disabled={actionLoading || !otRejectReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? "Submitting..." : "Deny Overtime"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetDetail;
