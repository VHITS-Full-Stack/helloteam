import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock,
  Calendar,
  Filter,
  Search,
  Building2,
  Edit,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUpDown,
  Coffee,
  Loader2,
  Users,
  Check,
  X,
  CheckCircle,
} from "lucide-react";
import { Card, Button, Badge, Avatar, Modal, ExportButton } from "../../components/common";
import adminPortalService from "../../services/adminPortal.service";
import overtimeService from "../../services/overtime.service";
import clientService from "../../services/client.service";
import groupService from "../../services/group.service";
import {
  formatHours,
  formatDuration,
  formatTime12,
} from "../../utils/formatTime";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TimeRecords = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(
    searchParams.get("clientId") || "all",
  );
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [timeRecords, setTimeRecords] = useState([]);
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [stats, setStats] = useState({
    totalRecords: 0,
    pendingReview: 0,
    adjustments: 0,
    flagged: 0,
  });
  const [clients, setClients] = useState([{ id: "all", name: "All Clients" }]);
  const [sessionEdits, setSessionEdits] = useState([]);
  const [billingEdits, setBillingEdits] = useState({
    billingIn: "",
    billingOut: "",
  });
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [otActionModal, setOtActionModal] = useState({
    show: false,
    type: null,
    otId: null,
    otEntry: null,
  });
  const [otActionNotes, setOtActionNotes] = useState("");
  const [otActionReason, setOtActionReason] = useState("");
  const [otActionLoading, setOtActionLoading] = useState(false);
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Set default date range (current week)
  useEffect(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatLocal = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setStartDate(formatLocal(startOfWeek));
    setEndDate(formatLocal(endOfWeek));
  }, []);

  const fetchingClientsRef = useRef(false);
  const fetchingRecordsRef = useRef(false);

  // Fetch clients list
  useEffect(() => {
    const fetchClients = async () => {
      if (fetchingClientsRef.current) return;
      fetchingClientsRef.current = true;
      try {
        const response = await clientService.getClients({ limit: 100 });
        if (response?.success) {
          setClients([
            { id: "all", name: "All Clients" },
            ...response.data.clients.map((c) => ({
              id: c.id,
              name: c.companyName,
            })),
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      } finally {
        fetchingClientsRef.current = false;
      }
    };
    fetchClients();
    const fetchGroups = async () => {
      try {
        const response = await groupService.getGroups({ limit: 100 });
        if (response?.success) {
          setGroups(response.data?.groups || []);
        }
      } catch (error) {
        console.error("Failed to fetch groups:", error);
      }
    };
    fetchGroups();
  }, []);

  // Fetch time records
  const fetchTimeRecords = async () => {
    if (fetchingRecordsRef.current) return;
    fetchingRecordsRef.current = true;
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (selectedClient !== "all") params.clientId = selectedClient;
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (searchTerm) params.search = searchTerm;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await adminPortalService.getTimeRecords(params);
      if (response?.success) {
        setTimeRecords(response.data.records);
        setStats(response.data.stats);
        if (response.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            totalPages: response.data.pagination.totalPages,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch time records:", error);
    } finally {
      setLoading(false);
      fetchingRecordsRef.current = false;
    }
  };

  // Fetch on filter/date/page changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchTimeRecords();
    }
  }, [selectedClient, selectedStatus, startDate, endDate, pagination.page]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPagination((prev) => (prev.page !== 1 ? { ...prev, page: 1 } : prev));
  }, [selectedClient, selectedStatus, startDate, endDate]);

  // Debounce search term
  useEffect(() => {
    if (!startDate || !endDate) return;
    setPagination((prev) => ({ ...prev, page: 1 }));
    const timer = setTimeout(() => {
      fetchTimeRecords();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter by group (get employee IDs in selected group)
  // Filter groups by selected client
  const filteredGroups = useMemo(() => {
    if (selectedClient === "all") return groups;
    return groups.filter((g) =>
      (g.clients || []).some(
        (cg) =>
          cg.client?.id === selectedClient || cg.clientId === selectedClient,
      ),
    );
  }, [groups, selectedClient]);

  // Reset group when client changes and selected group is no longer valid
  useEffect(() => {
    if (
      selectedGroup !== "all" &&
      !filteredGroups.find((g) => g.id === selectedGroup)
    ) {
      setSelectedGroup("all");
    }
  }, [filteredGroups, selectedGroup]);

  const groupEmployeeIds = useMemo(() => {
    if (selectedGroup === "all") return null;
    const group = groups.find((g) => g.id === selectedGroup);
    if (!group) return new Set();
    const empList = group.employees || [];
    const ids = new Set(
      empList.map((ge) => ge.employee?.id || ge.employeeId).filter(Boolean),
    );
    return ids;
  }, [selectedGroup, groups]);

  // Group time records by client
  const clientGroups = useMemo(() => {
    const grouped = new Map();
    for (const record of timeRecords) {
      // Skip if group filter is active and employee not in group
      if (groupEmployeeIds && !groupEmployeeIds.has(record.employeeId))
        continue;
      const key = record.clientId || "unassigned";
      if (!grouped.has(key)) {
        grouped.set(key, {
          clientId: key,
          clientName: record.client || "Unassigned",
          employees: [],
          totalHours: 0,
          overtimeHours: 0,
          employeeCount: 0,
        });
      }
      const g = grouped.get(key);
      g.employees.push(record);
      g.totalHours += record.totalHours;
      // Only count pending OT as overtime
      const dailyRecords = record.dailyRecords || [];
      for (const day of dailyRecords) {
        const otEntries = day.overtimeEntries || [];
        const pendingOTMinutes = otEntries
          .filter((o) => o.status === "PENDING")
          .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
        g.overtimeHours += pendingOTMinutes / 60;
      }
      g.employeeCount++;
    }
    for (const g of grouped.values()) {
      g.totalHours = Math.round(g.totalHours * 100) / 100;
      g.overtimeHours = Math.round(g.overtimeHours * 100) / 100;
    }
    return Array.from(grouped.values());
  }, [timeRecords, groupEmployeeIds]);

  const toggleClient = (clientId) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleEmployee = (employeeId) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClients(new Set(clientGroups.map((g) => g.clientId)));
    setExpandedEmployees(new Set(timeRecords.map((r) => r.employeeId)));
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedEmployees(new Set());
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="success" size="xs">
            Approved
          </Badge>
        );
      case "auto_approved":
        return (
          <Badge variant="success" size="xs">
            Auto Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="warning" size="xs">
            Pending
          </Badge>
        );
      case "active":
        return (
          <Badge variant="info" size="xs">
            Active
          </Badge>
        );
      case "adjusted":
        return (
          <Badge variant="primary" size="xs">
            Adjusted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="danger" size="xs">
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="xs">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Format clock time to 12h display in client timezone when possible.
  // If `timeStr` is an ISO datetime string, convert to the given timezone.
  // If `timeStr` is HH:MM, convert to 12h with formatTime12.
  const fmtTime = (timeInput, tz) => {
    if (!timeInput) return "-";
    const timeStr =
      typeof timeInput === "string"
        ? timeInput
        : timeInput instanceof Date
          ? timeInput.toISOString()
          : String(timeInput);
    const timezone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // ISO datetime (contains 'T' or 'Z' or full date)
    if (
      timeStr.includes("T") ||
      timeStr.includes("Z") ||
      /\d{4}-\d{2}-\d{2}/.test(timeStr)
    ) {
      try {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: timezone,
          });
        }
      } catch (e) {
        // fallthrough
      }
    }
    // 24h HH:MM or 12h strings
    if (/^\d{1,2}:\d{2}$/.test(timeStr) || /AM|PM/i.test(timeStr)) {
      return formatTime12(timeStr);
    }
    return timeStr;
  };

  // Convert 12h time string "HH:MM AM/PM" to 24h "HH:MM" for input
  const to24h = (timeStr, tz) => {
    if (!timeStr) return "";
    const timezone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // If it's an ISO datetime, convert using Date
    if (
      timeStr.includes("T") ||
      timeStr.includes("Z") ||
      /\d{4}-\d{2}-\d{2}/.test(timeStr)
    ) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
        });
      }
    }
    // Already 24h format
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    // Parse "HH:MM AM/PM" or "H:MM AM/PM"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return "";
    let h = parseInt(match[1], 10);
    const m = match[2];
    const period = match[3].toUpperCase();
    if (period === "AM" && h === 12) h = 0;
    if (period === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  };

  const handleAdjust = (record, employeeRecord) => {
    setSelectedRecord({
      ...record,
      employee: employeeRecord.employee,
      client: employeeRecord.client,
      clientTimezone: employeeRecord.clientTimezone,
    });
    // Initialize editable session data
    const tz = employeeRecord.clientTimezone;
    const sessions =
      record.sessions && record.sessions.length > 0
        ? record.sessions.map((s) => ({
            id: s.id,
            clockIn: to24h(s.clockIn, tz),
            clockOut: to24h(s.clockOut, tz),
            hours: s.hours,
            breakMinutes: s.breakMinutes,
            status: s.status,
            notes: s.notes || "",
          }))
        : [
            {
              id: record.id,
              clockIn: to24h(record.clockIn, tz),
              clockOut: to24h(record.clockOut, tz),
              hours: record.hours,
              breakMinutes: 0,
              status: record.status,
              notes: "",
            },
          ];
    setBillingEdits({
      billingIn: to24h(record.billingStart, tz),
      billingOut: to24h(record.billingEnd, tz),
    });
    setSessionEdits(sessions);
    setAdjustmentNotes(record.notes || "");
    setShowAdjustment(true);
  };

  const updateSessionEdit = (idx, field, value) => {
    setSessionEdits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  const handleSaveAdjustment = async () => {
    if (!selectedRecord) return;
    setSaving(true);
    try {
      const response = await adminPortalService.adjustTimeRecord(
        selectedRecord.id,
        {
          sessions: sessionEdits.map((s) => ({
            id: s.id,
            clockIn: s.clockIn,
            clockOut: s.clockOut,
            notes: s.notes,
          })),
          billingIn: billingEdits.billingIn || undefined,
          billingOut: billingEdits.billingOut || undefined,
          timezone: selectedRecord.clientTimezone || "America/New_York",
          notes: adjustmentNotes,
        },
      );
      if (response?.success) {
        setShowAdjustment(false);
        fetchTimeRecords();
      }
    } catch (error) {
      console.error("Failed to adjust time record:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleOTApprove = (otEntry) => {
    setOtActionModal({
      show: true,
      type: "approve",
      otId: otEntry.id,
      otEntry,
    });
    setOtActionNotes("");
  };

  const handleOTDeny = (otEntry) => {
    setOtActionModal({ show: true, type: "deny", otId: otEntry.id, otEntry });
    setOtActionNotes("");
    setOtActionReason("");
  };

  const confirmOTAction = async () => {
    if (!otActionModal.otId) return;
    if (otActionModal.type === "deny" && !otActionReason.trim()) return;
    try {
      setOtActionLoading(true);
      let response;
      if (otActionModal.type === "approve") {
        response = await overtimeService.approveOvertimeRequest(
          otActionModal.otId,
          otActionNotes.trim() || undefined,
        );
      } else {
        response = await overtimeService.rejectOvertimeRequest(
          otActionModal.otId,
          otActionReason.trim(),
          otActionNotes.trim() || undefined,
        );
      }
      if (response.success) {
        setOtActionModal({
          show: false,
          type: null,
          otId: null,
          otEntry: null,
        });
        setOtActionNotes("");
        setOtActionReason("");
        fetchTimeRecords();
      }
    } catch (err) {
      console.error("OT action error:", err);
    } finally {
      setOtActionLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Employee",
      "Client",
      "Date",
      "Actual In",
      "Actual Out",
      "Billing In",
      "Billing Out",
      "Regular Hours",
      "Overtime",
      "OT Without Prior Approval",
      "Breaks",
      "Status",
    ];
    const rows = [];
    for (const emp of timeRecords) {
      for (const day of emp.dailyRecords) {
        const otEntries = day.overtimeEntries || [];
        const requestedOTMins = otEntries
          .filter((o) => !o.isAutoGenerated)
          .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
        const autoOTMins = otEntries
          .filter((o) => o.isAutoGenerated)
          .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
        const regularHours =
          Math.round((day.regularHours || day.hours || 0) * 100) / 100;
        rows.push(
          [
            `"${emp.employee}"`,
            `"${emp.client}"`,
            day.date,
            fmtTime(day.clockIn, emp.clientTimezone) || "N/A",
            fmtTime(day.clockOut, emp.clientTimezone) || "N/A",
            fmtTime(day.billingStart, emp.clientTimezone) || "N/A",
            fmtTime(day.billingEnd, emp.clientTimezone) || "N/A",
            regularHours,
            Math.round((requestedOTMins / 60) * 100) / 100,
            Math.round((autoOTMins / 60) * 100) / 100,
            day.breaks || 0,
            day.status,
          ].join(","),
        );
      }
    }
    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-records-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Time Records: ${startDate} to ${endDate}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const rows = [];
    for (const emp of timeRecords) {
      for (const day of emp.dailyRecords) {
        const otEntries = day.overtimeEntries || [];
        const requestedOTMins = otEntries.filter(o => !o.isAutoGenerated).reduce((s, o) => s + (o.requestedMinutes || 0), 0);
        const autoOTMins = otEntries.filter(o => o.isAutoGenerated).reduce((s, o) => s + (o.requestedMinutes || 0), 0);
        rows.push([
          emp.employee,
          emp.client,
          day.date,
          day.scheduledStart && day.scheduledEnd
            ? `${typeof day.scheduledStart === 'string' && /^\d{1,2}:\d{2}$/.test(day.scheduledStart) ? formatTime12(day.scheduledStart) : fmtTime(day.scheduledStart, emp.clientTimezone)} - ${typeof day.scheduledEnd === 'string' && /^\d{1,2}:\d{2}$/.test(day.scheduledEnd) ? formatTime12(day.scheduledEnd) : fmtTime(day.scheduledEnd, emp.clientTimezone)}`
            : '-',
          fmtTime(day.clockIn, emp.clientTimezone) || '-',
          day.clockOut ? fmtTime(day.clockOut, emp.clientTimezone) : '-',
          fmtTime(day.billingStart, emp.clientTimezone) || '-',
          fmtTime(day.billingEnd, emp.clientTimezone) || '-',
          formatHours(day.regularHours ?? day.hours ?? 0),
          requestedOTMins > 0 ? formatDuration(requestedOTMins) : '-',
          autoOTMins > 0 ? formatDuration(autoOTMins) : '-',
          day.status || '-',
        ]);
      }
    }

    autoTable(doc, {
      startY: 25,
      head: [['Employee', 'Client', 'Date', 'Schedule', 'In', 'Out', 'Bill In', 'Bill Out', 'Regular', 'OT', 'Auto OT', 'Status']],
      body: rows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 55, 75], fontSize: 7 },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 22 } },
    });

    doc.save(`time-records-${startDate}-to-${endDate}.pdf`);
  };

  // Compute totals from all records
  // Only count pending OT as overtime; approved/auto-approved OT stays in regular hours
  const totals = useMemo(() => {
    let totalHours = 0;
    let unapprovedOTHours = 0;
    for (const r of timeRecords) {
      totalHours += r.totalHours || 0;
      const dailyRecords = r.dailyRecords || [];
      for (const day of dailyRecords) {
        const otEntries = day.overtimeEntries || [];
        const pendingOTMinutes = otEntries
          .filter((o) => o.status === "PENDING")
          .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
        unapprovedOTHours += pendingOTMinutes / 60;
      }
    }
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      overtimeHours: Math.round(unapprovedOTHours * 100) / 100,
      regularHours: Math.round(totalHours * 100) / 100,
    };
  }, [timeRecords]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Records</h2>
          <p className="text-sm text-gray-500 mt-1">
            View and manage all employee time records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} />
          <ExportButton onClick={handleExportPDF}>Export PDF</ExportButton>
        </div>
      </div>

      {/* Stats Cards */}
      {/* <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRecords}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatHours(totals.totalHours)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Regular</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatHours(totals.regularHours)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</p>
          <p className={`text-2xl font-bold mt-1 ${totals.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {formatHours(totals.overtimeHours)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Now</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.adjustments}</p>
        </Card>
      </div> */}

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              className="w-44 pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <input
            type="date"
            className="w-36 px-2.5 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            className="w-36 px-2.5 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          {/* Dropdowns */}
          <div className="relative flex-shrink-0">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative flex-shrink-0">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="all">All Groups</option>
              {filteredGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative flex-shrink-0">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </Card>

      {/* Time Records Table */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : timeRecords.filter(
            (r) => !groupEmployeeIds || groupEmployeeIds.has(r.employeeId),
          ).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: "name", label: "Name" },
                    { key: "client", label: "Client" },
                    { key: "date", label: "Date" },
                    { key: null, label: "Schedule" },
                    { key: null, label: "Actual In/Out" },
                    { key: null, label: "Billing In/Out" },
                    { key: null, label: "Break" },
                    { key: "regular", label: "Regular" },
                    { key: "overtime", label: "Overtime" },
                    { key: null, label: "OT Without Prior Approval", nowrap: true },
                    { key: "status", label: "Status" },
                  ].map((col) => (
                    <th
                      key={col.label}
                      onClick={col.key ? () => handleSort(col.key) : undefined}
                      className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.nowrap ? "whitespace-nowrap" : ""} ${col.key ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.key && (
                          sortField === col.key ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {timeRecords
                  .filter(
                    (empRecord) =>
                      !groupEmployeeIds ||
                      groupEmployeeIds.has(empRecord.employeeId),
                  )
                  .flatMap((empRecord) =>
                    empRecord.dailyRecords.map((day) => ({
                      empRecord,
                      day,
                    })),
                  )
                  .sort((a, b) => {
                    let cmp = 0;
                    switch (sortField) {
                      case "name":
                        cmp = (a.empRecord.employee || "").localeCompare(b.empRecord.employee || "");
                        break;
                      case "client":
                        cmp = (a.empRecord.client || "").localeCompare(b.empRecord.client || "");
                        break;
                      case "date":
                        cmp = new Date(a.day.date).getTime() - new Date(b.day.date).getTime();
                        break;
                      case "regular":
                        cmp = (a.day.regularMinutes || 0) - (b.day.regularMinutes || 0);
                        break;
                      case "overtime": {
                        const aOT = (a.day.overtimeEntries || []).filter((o) => !o.isAutoGenerated).reduce((s, o) => s + (o.requestedMinutes || 0), 0);
                        const bOT = (b.day.overtimeEntries || []).filter((o) => !o.isAutoGenerated).reduce((s, o) => s + (o.requestedMinutes || 0), 0);
                        cmp = aOT - bOT;
                        break;
                      }
                      case "status":
                        cmp = (a.day.status || "").localeCompare(b.day.status || "");
                        break;
                      default:
                        cmp = new Date(a.day.date).getTime() - new Date(b.day.date).getTime();
                    }
                    return sortDirection === "asc" ? cmp : -cmp;
                  })
                  .map(({ empRecord, day }) => (
                      <tr
                        key={`${empRecord.employeeId}-${day.id}`}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Name */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={empRecord.employee}
                              size="sm"
                              src={empRecord.profilePhoto}
                            />
                            <span className="font-semibold text-gray-900 text-sm">
                              {empRecord.employee}
                            </span>
                          </div>
                        </td>

                        {/* Client */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                            <Building2 className="w-3 h-3" />
                            {empRecord.client}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm text-gray-900">
                            {formatDate(day.date)}
                          </p>
                        </td>

                        {/* Schedule */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {day.scheduledStart || day.scheduledEnd ? (
                            <div className="text-sm text-gray-700">
                              {day.scheduledStart
                                ? fmtTime(
                                    day.scheduledStart,
                                    empRecord.clientTimezone,
                                  )
                                : "-"}
                              <span className="text-gray-300 mx-1">–</span>
                              {day.scheduledEnd
                                ? fmtTime(
                                    day.scheduledEnd,
                                    empRecord.clientTimezone,
                                  )
                                : "-"}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Actual In/Out */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-700">
                            {fmtTime(day.clockIn, empRecord.clientTimezone)}
                            <span className="text-gray-300 mx-1">–</span>
                            {day.clockOut ? (
                              fmtTime(day.clockOut, empRecord.clientTimezone)
                            ) : day.status === "active" ? (
                              <span className="text-green-600 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Now
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                          {(day.isLate || day.arrivalStatus === "Late") &&
                            (day.overtimeHours === 0 ||
                              day.regularHours === 0) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-red-100 text-red-700 mt-0.5">
                                Late
                                {day.lateMinutes
                                  ? ` ${day.lateMinutes >= 60 ? `${Math.floor(day.lateMinutes / 60)}h ${day.lateMinutes % 60}m` : `${day.lateMinutes}m`}`
                                  : ""}
                              </span>
                            )}
                          {!day.isLate && day.arrivalStatus === "Early" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-blue-100 text-blue-700 mt-0.5">
                              Early
                            </span>
                          )}
                          {!day.isLate && day.arrivalStatus === "On Time" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-green-100 text-green-700 mt-0.5">
                              On Time
                            </span>
                          )}
                        </td>

                        {/* Billing In/Out */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {(() => {
                            const otEntries = day.overtimeEntries || [];
                            const hasOffShift = otEntries.some(
                              (ot) => ot.type === "OFF_SHIFT",
                            );
                            const displayStart =
                              hasOffShift && day.clockIn
                                ? day.clockIn
                                : day.billingStart;
                            const displayEnd =
                              hasOffShift && day.clockOut
                                ? day.clockOut
                                : day.billingEnd;

                            if (displayStart && displayEnd) {
                              const approvedExtMins = otEntries
                                .filter(
                                  (ot) =>
                                    (ot.status === "APPROVED" ||
                                      ot.status === "AUTO_APPROVED") &&
                                    ot.type === "SHIFT_EXTENSION",
                                )
                                .reduce(
                                  (sum, ot) => sum + (ot.requestedMinutes || 0),
                                  0,
                                );
                              return (
                                <span className="text-blue-700 font-medium">
                                  {fmtTime(
                                    displayStart,
                                    empRecord.clientTimezone,
                                  )}
                                  <span className="text-blue-300 mx-1">–</span>
                                  {approvedExtMins > 0
                                    ? fmtTime(
                                        new Date(
                                          new Date(displayEnd).getTime() +
                                            approvedExtMins * 60000,
                                        ),
                                        empRecord.clientTimezone,
                                      )
                                    : fmtTime(
                                        displayEnd,
                                        empRecord.clientTimezone,
                                      )}
                                </span>
                              );
                            }
                            if (day.status === "active")
                              return (
                                <span className="text-gray-400 italic">
                                  In progress
                                </span>
                              );
                            return <span className="text-gray-300">—</span>;
                          })()}
                        </td>

                        {/* Break */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {day.breaks > 0 ? (
                            <span className="text-yellow-600 font-medium inline-flex items-center gap-1">
                              <Coffee className="w-3 h-3" />
                              {formatHours(day.breaks)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* Regular */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                          {day.regularHours !== null &&
                          day.regularHours !== undefined
                            ? formatHours(day.regularHours)
                            : day.hours !== null && day.hours !== undefined
                              ? formatHours(day.hours)
                              : "-"}
                        </td>

                        {/* Overtime (pre-requested + all shift extensions) */}
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const requestedOT = (
                              day.overtimeEntries || []
                            ).filter((o) => !o.isAutoGenerated);
                            if (requestedOT.length > 0) {
                              return (
                                <div className="flex flex-col gap-1.5">
                                  {requestedOT.map((ot, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-1 flex-wrap"
                                    >
                                      <span
                                        className={`text-xs font-medium ${ot.status === "APPROVED" || ot.status === "AUTO_APPROVED" ? "text-green-700" : "text-orange-600"}`}
                                      >
                                        {formatDuration(ot.requestedMinutes)}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        {ot.type === "SHIFT_EXTENSION"
                                          ? "ext"
                                          : "off"}
                                      </span>
                                      {/* {(ot.status === 'APPROVED' || ot.status === 'AUTO_APPROVED') && <span className="text-[10px] text-green-600">✓</span>}
                                    {ot.status === 'REJECTED' && <span className="text-[10px] text-red-500">✗</span>}
                                    {ot.status === 'PENDING' && (
                                      <div className="inline-flex items-center gap-0.5 ml-1">
                                        <button onClick={() => handleOTApprove(ot)} className="px-1.5 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 rounded hover:bg-green-100 transition-colors" title="Approve">
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => handleOTDeny(ot)} className="px-1.5 py-0.5 text-[10px] font-semibold text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors" title="Deny">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )} */}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return <span className="text-gray-300">—</span>;
                          })()}
                        </td>

                        {/* OT Without Prior Approval (auto-generated off-shift only) */}
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const autoOT = (day.overtimeEntries || []).filter(
                              (o) => o.isAutoGenerated,
                            );
                            const recordApproved =
                              day.status === "approved" ||
                              day.status === "auto_approved";
                            if (autoOT.length > 0) {
                              return (
                                <div className="flex flex-col gap-1.5">
                                  {autoOT.map((ot, i) => {
                                    // If record is already approved, treat PENDING OT as approved
                                    const effectiveStatus =
                                      recordApproved && ot.status === "PENDING"
                                        ? "APPROVED"
                                        : ot.status;
                                    return (
                                      <div
                                        key={i}
                                        className="flex items-center gap-1 flex-wrap"
                                      >
                                        <span
                                          className={`text-xs font-medium ${effectiveStatus === "APPROVED" || effectiveStatus === "AUTO_APPROVED" ? "text-green-700" : "text-orange-600"}`}
                                        >
                                          {formatDuration(ot.requestedMinutes)}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                          {ot.type === "SHIFT_EXTENSION"
                                            ? "ext"
                                            : "off"}
                                        </span>
                                        {(effectiveStatus === "APPROVED" ||
                                          effectiveStatus ===
                                            "AUTO_APPROVED") && (
                                          <span className="text-[10px] text-green-600">
                                            ✓
                                          </span>
                                        )}
                                        {effectiveStatus === "REJECTED" && (
                                          <span className="text-[10px] text-red-500">
                                            ✗
                                          </span>
                                        )}
                                        {effectiveStatus === "PENDING" && (
                                          <div className="inline-flex items-center gap-0.5 ml-1">
                                            <button
                                              onClick={() =>
                                                handleOTApprove(ot)
                                              }
                                              className="px-1.5 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 rounded hover:bg-green-100 transition-colors"
                                              title="Approve"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => handleOTDeny(ot)}
                                              className="px-1.5 py-0.5 text-[10px] font-semibold text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                                              title="Deny"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return <span className="text-gray-300">—</span>;
                          })()}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(day.status)}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleAdjust(day, empRecord)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                            title="Adjust"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No time records found
            </h3>
            <p className="text-sm text-gray-500">
              Try adjusting your filters or date range
            </p>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page === 1}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {(() => {
              const pages = [];
              const total = pagination.totalPages;
              const current = pagination.page;

              const addPage = (p) => {
                pages.push(
                  <button
                    key={p}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: p }))
                    }
                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                      p === current
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>,
                );
              };

              const addEllipsis = (key) => {
                pages.push(
                  <span
                    key={key}
                    className="w-9 h-9 flex items-center justify-center text-sm text-gray-400"
                  >
                    ...
                  </span>,
                );
              };

              if (total <= 7) {
                for (let i = 1; i <= total; i++) addPage(i);
              } else {
                addPage(1);
                if (current > 3) addEllipsis("start");
                for (
                  let i = Math.max(2, current - 1);
                  i <= Math.min(total - 1, current + 1);
                  i++
                ) {
                  addPage(i);
                }
                if (current < total - 2) addEllipsis("end");
                addPage(total);
              }
              return pages;
            })()}
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustment}
        onClose={() => setShowAdjustment(false)}
        title="Adjust Time Record"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdjustment(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAdjustment}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Adjustment"}
            </Button>
          </>
        }
      >
        {selectedRecord && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    Employee
                  </p>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">
                    {selectedRecord.employee}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    Client
                  </p>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">
                    {selectedRecord.client}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </p>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">
                    {selectedRecord.date
                      ? formatDate(selectedRecord.date)
                      : "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Sessions */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Sessions ({sessionEdits.length})
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {sessionEdits.map((session, idx) => (
                  <div key={session.id || idx} className="p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-900">
                        Session {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {session.hours !== null &&
                          session.hours !== undefined && (
                            <span className="text-xs text-gray-500">
                              {formatHours(session.hours)}
                            </span>
                          )}
                        {session.breakMinutes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-yellow-600">
                            <Coffee className="w-3 h-3" />
                            {session.breakMinutes}m break
                          </span>
                        )}
                        {session.status === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-gray-400 uppercase">
                          Clock In
                        </label>
                        <input
                          type="time"
                          className="input mt-1 text-sm"
                          value={session.clockIn}
                          onChange={(e) =>
                            updateSessionEdit(idx, "clockIn", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-gray-400 uppercase">
                          Clock Out
                        </label>
                        {session.status === "ACTIVE" ? (
                          <p className="text-sm font-medium text-green-600 mt-1 py-2">
                            In Progress
                          </p>
                        ) : (
                          <input
                            type="time"
                            className="input mt-1 text-sm"
                            value={session.clockOut}
                            onChange={(e) =>
                              updateSessionEdit(idx, "clockOut", e.target.value)
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing Time */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Billing Time
              </p>
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-blue-500 uppercase">
                      Billing In
                    </label>
                    <input
                      type="time"
                      className="input mt-1 text-sm"
                      value={billingEdits.billingIn}
                      onChange={(e) =>
                        setBillingEdits((prev) => ({
                          ...prev,
                          billingIn: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-blue-500 uppercase">
                      Billing Out
                    </label>
                    <input
                      type="time"
                      className="input mt-1 text-sm"
                      value={billingEdits.billingOut}
                      onChange={(e) =>
                        setBillingEdits((prev) => ({
                          ...prev,
                          billingOut: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Overtime Entries (read-only) */}
            {selectedRecord.overtimeEntries &&
              selectedRecord.overtimeEntries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Overtime ({selectedRecord.overtimeEntries.length})
                  </p>
                  <div className="space-y-2">
                    {selectedRecord.overtimeEntries.map((ot, otIdx) => {
                      const isApproved =
                        ot.status === "APPROVED" ||
                        ot.status === "AUTO_APPROVED";
                      const isDenied = ot.status === "REJECTED";
                      const borderColor = isApproved
                        ? "border-green-200 bg-green-50"
                        : isDenied
                          ? "border-red-200 bg-red-50"
                          : "border-amber-200 bg-amber-50";
                      const badgeColor = isApproved
                        ? "bg-green-100 text-green-800"
                        : isDenied
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800";
                      const badgeLabel = isApproved
                        ? "Approved"
                        : isDenied
                          ? "Denied"
                          : "Pending";
                      const timeRange =
                        ot.type === "OFF_SHIFT"
                          ? `${formatTime12(ot.requestedStartTime)} → ${formatTime12(ot.requestedEndTime)}`
                          : ot.estimatedEndTime
                            ? `until ${formatTime12(ot.estimatedEndTime)}`
                            : "";
                      return (
                        <div
                          key={ot.id || otIdx}
                          className={`p-3 rounded-lg border ${borderColor}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded ${badgeColor}`}
                              >
                                +{formatDuration(ot.requestedMinutes)} ·{" "}
                                {badgeLabel}
                              </span>
                              <span className="text-[10px] text-gray-500 uppercase">
                                {ot.type === "OFF_SHIFT"
                                  ? "Off-Shift"
                                  : "Extension"}
                              </span>
                            </div>
                          </div>
                          {timeRange && (
                            <p className="text-xs text-gray-500 mt-1">
                              {timeRange}
                            </p>
                          )}
                          {ot.reason && (
                            <p className="text-[10px] text-gray-400 mt-1 italic">
                              {ot.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Day Totals */}
            {(() => {
              const otEntries = selectedRecord.overtimeEntries || [];
              const unapprovedOTMinutes = otEntries
                .filter((o) => o.status === "PENDING")
                .reduce((s, o) => s + (o.requestedMinutes || 0), 0);
              const unapprovedOTHours = unapprovedOTMinutes / 60;
              const regularHours =
                selectedRecord.regularHours || selectedRecord.hours || 0;
              return (
                <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-gray-400 uppercase">
                      Regular
                    </p>
                    <p className="font-semibold text-gray-900 text-sm">
                      {formatHours(regularHours)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-gray-400 uppercase">
                      Overtime
                    </p>
                    <p
                      className={`font-semibold text-sm ${unapprovedOTHours > 0 ? "text-orange-600" : "text-gray-900"}`}
                    >
                      {formatHours(unapprovedOTHours)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-gray-400 uppercase">
                      Breaks
                    </p>
                    <p className="font-semibold text-yellow-600 text-sm">
                      {formatHours(selectedRecord.breaks)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            <div>
              <label className="label">Adjustment Reason</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Reason for adjustment..."
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
              />
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">
                This adjustment will be logged and visible to the client for
                approval.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* OT Approve/Deny Modal */}
      {otActionModal.show && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() =>
            setOtActionModal({
              show: false,
              type: null,
              otId: null,
              otEntry: null,
            })
          }
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {otActionModal.type === "approve"
                ? "Approve Overtime"
                : "Deny Overtime"}
            </h3>
            {otActionModal.otEntry && (
              <div className="p-3 bg-gray-50 rounded-lg mb-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">
                    {otActionModal.otEntry.type === "OFF_SHIFT"
                      ? "Off-Shift"
                      : "Shift Extension"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium">
                    {formatDuration(otActionModal.otEntry.requestedMinutes)}
                  </span>
                </div>
                {otActionModal.otEntry.reason && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Reason</span>
                    <span className="font-medium text-right max-w-[200px]">
                      {otActionModal.otEntry.reason}
                    </span>
                  </div>
                )}
              </div>
            )}
            {otActionModal.type === "deny" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Denial Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={otActionReason}
                  onChange={(e) => setOtActionReason(e.target.value)}
                  placeholder="Reason for denial..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            )}
            {otActionModal.type === "approve" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={otActionNotes}
                  onChange={(e) => setOtActionNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setOtActionModal({
                    show: false,
                    type: null,
                    otId: null,
                    otEntry: null,
                  })
                }
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={otActionLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmOTAction}
                disabled={
                  otActionLoading ||
                  (otActionModal.type === "deny" && !otActionReason.trim())
                }
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2 ${
                  otActionModal.type === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {otActionLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {otActionModal.type === "approve" ? "Approve" : "Deny"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRecords;
