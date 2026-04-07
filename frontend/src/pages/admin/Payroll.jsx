import React, { useState, useEffect, useCallback, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DollarSign,
  Download,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileText,
  Send,
  Lock,
  Unlock,
  Building2,
  Filter,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  TrendingUp,
  FileDown,
  Eye,
  Plus,
  Minus,
  Trash2,
  X,
  View,
  EyeIcon,
  Search,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "../../components/common";
import payrollService from "../../services/payroll.service";
import { formatHours } from "../../utils/formatTime";
import adminPortalService from "../../services/adminPortal.service";

const Payroll = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(
    tabParam === "periods" ? "periods" : "employees",
  );

  useEffect(() => {
    if (tabParam === "employees" || tabParam === "periods") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Unapproved OT & Next Payroll
  const [unapprovedOTData, setUnapprovedOTData] = useState(null);
  const [sendingOTPush, setSendingOTPush] = useState(false);
  const [showUpdatePayrollDate, setShowUpdatePayrollDate] = useState(false);
  const [newPayrollDate, setNewPayrollDate] = useState("");
  const [updatingPayrollDate, setUpdatingPayrollDate] = useState(false);
  const [showPayrollHistory, setShowPayrollHistory] = useState(false);
  const [confirmPayrollDate, setConfirmPayrollDate] = useState(false);
  const [payrollDateLogs, setPayrollDateLogs] = useState([]);

  // Period selection
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [sortField, setSortField] = useState("employee");
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [employeeSummary, setEmployeeSummary] = useState(null);
  const [periods, setPeriods] = useState([]);

  // Modals
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Adjustment modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState("BONUS");
  const [adjustmentEmployee, setAdjustmentEmployee] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteAdjustmentId, setDeleteAdjustmentId] = useState(null);

  // Generate list of semi-monthly pay periods (current + 12 months back)
  const generatePayPeriods = () => {
    const periods = [];
    const today = new Date();
    const dayOfMonth = today.getDate();
    const pad = (n) => String(n).padStart(2, "0");

    // Determine the latest period boundary
    let startYear = today.getFullYear();
    let startMonth = today.getMonth(); // 0-indexed

    // Build periods from current forward to the latest applicable, then backwards
    // We'll generate from the most recent period going back ~24 periods (~12 months)
    let periodsToGenerate = 12;

    // Figure out the current/latest period
    let curYear, curMonth, curHalf;
    if (dayOfMonth <= 7) {
      // We're in the 22nd-7th period
      curYear = startYear;
      curMonth = startMonth; // the month of the 7th
      curHalf = "first"; // 22nd(prev)-7th(this)
    } else if (dayOfMonth <= 21) {
      // We're in the 8th-21st period
      curYear = startYear;
      curMonth = startMonth;
      curHalf = "second"; // 8th-21st
    } else {
      // We're in the 22nd-7th(next) period
      curYear = startYear;
      curMonth = startMonth;
      curHalf = "third"; // 22nd(this)-7th(next)
    }

    // Helper to add a period
    const addPeriod = (pStart, pEnd, label) => {
      periods.push({ start: pStart, end: pEnd, label });
    };

    // Add the next upcoming period at top
    if (curHalf === "first") {
      // Next is 8th-21st of current month
      const pStart = `${curYear}-${pad(curMonth + 1)}-08`;
      const pEnd = `${curYear}-${pad(curMonth + 1)}-21`;
      const label = `${pad(curMonth + 1)}/08 - ${pad(curMonth + 1)}/21, ${curYear}`;
      addPeriod(pStart, pEnd, label);
    } else if (curHalf === "second") {
      // Next is 22nd of current month to 7th of next month
      const nextM = curMonth === 11 ? 0 : curMonth + 1;
      const nextY = curMonth === 11 ? curYear + 1 : curYear;
      const pStart = `${curYear}-${pad(curMonth + 1)}-22`;
      const pEnd = `${nextY}-${pad(nextM + 1)}-07`;
      const label = `${pad(curMonth + 1)}/22 - ${pad(nextM + 1)}/07, ${nextY}`;
      addPeriod(pStart, pEnd, label);
    } else {
      // Next is 8th-21st of next month
      const nextM = curMonth === 11 ? 0 : curMonth + 1;
      const nextY = curMonth === 11 ? curYear + 1 : curYear;
      const pStart = `${nextY}-${pad(nextM + 1)}-08`;
      const pEnd = `${nextY}-${pad(nextM + 1)}-21`;
      const label = `${pad(nextM + 1)}/08 - ${pad(nextM + 1)}/21, ${nextY}`;
      addPeriod(pStart, pEnd, label);
    }

    // Walk backwards from current period
    let y = curYear;
    let m = curMonth; // 0-indexed
    let half = curHalf;

    for (let i = 0; i < periodsToGenerate; i++) {
      if (half === "third") {
        // 22nd of m to 7th of m+1
        const nextM = m === 11 ? 0 : m + 1;
        const nextY = m === 11 ? y + 1 : y;
        const pStart = `${y}-${pad(m + 1)}-22`;
        const pEnd = `${nextY}-${pad(nextM + 1)}-07`;
        const label = `${pad(m + 1)}/22 - ${pad(nextM + 1)}/07, ${nextY}`;
        addPeriod(pStart, pEnd, label);
        // Move to previous half: 8th-21st of same month
        half = "second";
      } else if (half === "second") {
        // 8th to 21st of m
        const pStart = `${y}-${pad(m + 1)}-08`;
        const pEnd = `${y}-${pad(m + 1)}-21`;
        const label = `${pad(m + 1)}/08 - ${pad(m + 1)}/21, ${y}`;
        addPeriod(pStart, pEnd, label);
        // Move to previous half: 22nd(prev)-7th(this)
        half = "first";
      } else {
        // first: 22nd of (m-1) to 7th of m
        const prevM = m === 0 ? 11 : m - 1;
        const prevY = m === 0 ? y - 1 : y;
        const pStart = `${prevY}-${pad(prevM + 1)}-22`;
        const pEnd = `${y}-${pad(m + 1)}-07`;
        const label = `${pad(prevM + 1)}/22 - ${pad(m + 1)}/07, ${y}`;
        addPeriod(pStart, pEnd, label);
        // Move to previous half: 8th-21st of prev month
        m = prevM;
        y = prevY;
        half = "second";
      }
    }

    return periods;
  };

  const payPeriods = generatePayPeriods();
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState("1"); // index 1 = current period (0 = next upcoming)

  // Set default period to current period
  useEffect(() => {
    if (payPeriods.length > 1) {
      setPeriodStart(payPeriods[1].start);
      setPeriodEnd(payPeriods[1].end);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle period dropdown change
  const handlePeriodChange = (e) => {
    const idx = e.target.value;
    setSelectedPeriodIdx(idx);
    const period = payPeriods[parseInt(idx)];
    if (period) {
      setPeriodStart(period.start);
      setPeriodEnd(period.end);
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!periodStart || !periodEnd) return;

    try {
      setLoading(true);
      setError("");

      const [dashboardRes, employeeSummaryRes, periodsRes, unapprovedOTRes] =
        await Promise.all([
          payrollService.getDashboard(periodStart, periodEnd),
          payrollService.getEmployeeSummary(
            periodStart,
            periodEnd,
            selectedClient || undefined,
          ),
          payrollService.getPeriods({ limit: 10 }),
          adminPortalService.getClientWiseUnapprovedOT(),
        ]);

      if (dashboardRes.success) {
        setDashboardData(dashboardRes.data);
      }

      if (employeeSummaryRes.success) {
        setEmployeeSummary(employeeSummaryRes.data);
      }

      if (periodsRes.success) {
        setPeriods(periodsRes.data?.periods || []);
      }

      if (unapprovedOTRes?.success) {
        setUnapprovedOTData(unapprovedOTRes.data);
      }
    } catch (err) {
      console.error("Error fetching payroll data:", err);
      setError(err.message || "Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd, selectedClient]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPeriodLabel = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const month = startDate.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`;
  };

  const getReadinessBadge = (readiness) => {
    switch (readiness) {
      case "ready":
        return <Badge variant="success">Ready</Badge>;
      case "warning":
        return <Badge variant="warning">Warning</Badge>;
      case "critical":
        return <Badge variant="danger">Critical</Badge>;
      default:
        return <Badge variant="default">{readiness}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ready":
        return <Badge variant="success">Ready</Badge>;
      case "completed":
        return <Badge variant="primary">Completed</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "flagged":
        return <Badge variant="danger">Flagged</Badge>;
      case "OPEN":
        return <Badge variant="default">Open</Badge>;
      case "LOCKED":
        return <Badge variant="warning">Locked</Badge>;
      case "FINALIZED":
        return <Badge variant="success">Finalized</Badge>;
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleExport = async (format) => {
    try {
      setActionLoading(true);
      if (format === "csv") {
        await payrollService.downloadCsv(
          periodStart,
          periodEnd,
          selectedClient || undefined,
        );
      } else {
        const response = await payrollService.exportData(
          periodStart,
          periodEnd,
          selectedClient || undefined,
          format,
        );
        if (response.success) {
          // Download JSON as file
          const blob = new Blob([JSON.stringify(response.data, null, 2)], {
            type: "application/json",
          });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `payroll-${periodStart}-${periodEnd}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
      setShowExportModal(false);
    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export data");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockPeriod = async () => {
    if (!selectedPeriod) return;

    try {
      setActionLoading(true);
      const response = await payrollService.lockPeriod(selectedPeriod.id);
      if (response.success) {
        setShowLockModal(false);
        setSelectedPeriod(null);
        fetchData();
      } else {
        setError(response.error || "Failed to lock period");
      }
    } catch (err) {
      setError(err.message || "Failed to lock period");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockPeriod = async () => {
    if (!selectedPeriod || !unlockReason.trim()) return;

    try {
      setActionLoading(true);
      const response = await payrollService.unlockPeriod(
        selectedPeriod.id,
        unlockReason,
      );
      if (response.success) {
        setShowUnlockModal(false);
        setSelectedPeriod(null);
        setUnlockReason("");
        fetchData();
      } else {
        setError(response.error || "Failed to unlock period");
      }
    } catch (err) {
      setError(err.message || "Failed to unlock period");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizePeriod = async () => {
    try {
      setActionLoading(true);

      // Determine period dates
      const pStart = selectedPeriod
        ? (selectedPeriod.periodStart?.split("T")[0] || periodStart)
        : periodStart;
      const pEnd = selectedPeriod
        ? (selectedPeriod.periodEnd?.split("T")[0] || periodEnd)
        : periodEnd;

      // Generate payslips for all employees across all clients
      const response = await payrollService.generatePayslips(pStart, pEnd);

      // Also finalize period status if selected
      if (selectedPeriod) {
        await payrollService.finalizePeriod(selectedPeriod.id).catch(() => {});
      }

      if (response.success) {
        const msgs = [];
        if (response.data?.generated > 0) {
          msgs.push(
            `${response.data.generated} payslip(s) generated for employees.`,
          );
        } else {
          msgs.push("Payroll processed. No new payslips to generate.");
        }
        if (response.data?.warnings?.length > 0) {
          msgs.push(...response.data.warnings);
        }
        setSuccessMsg(msgs.join(" "));
        setShowProcessModal(false);
        setConfirmFinalize(false);
        setSelectedPeriod(null);
        fetchData();
      } else {
        setError(response.error || "Failed to process payroll");
      }
    } catch (err) {
      setError(err.message || "Failed to process payroll");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const openAdjustmentModal = (employee, type) => {
    setAdjustmentEmployee(employee);
    setAdjustmentType(type);
    setAdjustmentAmount("");
    setAdjustmentReason("");
    setShowAdjustmentModal(true);
  };

  const handleAddAdjustment = async () => {
    if (!adjustmentEmployee || !adjustmentAmount || !adjustmentReason.trim())
      return;

    try {
      setAdjustmentLoading(true);
      const response = await payrollService.addAdjustment({
        employeeId: adjustmentEmployee.employee.id,
        type: adjustmentType,
        amount: Number(adjustmentAmount),
        reason: adjustmentReason.trim(),
        periodStart,
        periodEnd,
      });

      if (response.success) {
        setShowAdjustmentModal(false);
        setAdjustmentEmployee(null);
        setAdjustmentAmount("");
        setAdjustmentReason("");
        setError("");
        setSuccessMsg(
          response.message ||
            `${adjustmentType === "BONUS" ? "Bonus" : "Deduction"} added successfully`,
        );
        fetchData();
      } else {
        setError(response.error || "Failed to add adjustment");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to add adjustment");
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const handleDeleteAdjustment = async () => {
    if (!deleteAdjustmentId) return;
    try {
      const response =
        await payrollService.deleteAdjustment(deleteAdjustmentId);
      if (response.success) {
        setDeleteAdjustmentId(null);
        setSuccessMsg("Adjustment deleted successfully");
        fetchData();
      } else {
        setError(response.error || "Failed to delete adjustment");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to delete adjustment");
    }
  };

  const handleSendOTPush = async () => {
    try {
      setSendingOTPush(true);
      const response = await payrollService.sendReminders();
      if (response.success) {
        setSuccessMsg(
          response.message || "OT approval reminders sent to all clients and employees",
        );
      } else {
        setError(response.error || "Failed to send reminders");
      }
    } catch (err) {
      setError(err.message || "Failed to send OT reminders");
    } finally {
      setSendingOTPush(false);
    }
  };

  const handleUpdatePayrollDate = async () => {
    if (!newPayrollDate) return;
    try {
      setUpdatingPayrollDate(true);
      // Find the current period and update its cutoff
      const currentPeriod = periods.find((p) => {
        const pStart = p.periodStart?.split("T")[0] || p.start;
        const pEnd = p.periodEnd?.split("T")[0] || p.end;
        return pStart === periodStart && pEnd === periodEnd;
      });
      if (currentPeriod) {
        const response = await payrollService.updateCutoff(
          currentPeriod.id,
          newPayrollDate,
          "Payroll date updated by admin for early processing",
        );
        if (response.success) {
          setSuccessMsg(
            "Next payroll date updated. Employees and clients will be notified.",
          );
          setShowUpdatePayrollDate(false);
          setNewPayrollDate("");
          setConfirmPayrollDate(false);
          setPayrollDateLogs([]);
          fetchData();
        } else {
          setError(response.error || "Failed to update payroll date");
        }
      } else {
        // No period exists — create periods for all clients, then update cutoff
        try {
          const clientList = dashboardData?.clients || [];
          if (clientList.length === 0) {
            setError("No clients found. Please create a client first.");
            return;
          }
          let createdPeriodId = null;
          for (const client of clientList) {
            try {
              const createRes = await payrollService.createPeriod({
                clientId: client.clientId,
                periodStart,
                periodEnd,
                cutoffDate: newPayrollDate,
              });
              if (createRes.success && !createdPeriodId) {
                createdPeriodId = createRes.data.id;
              }
            } catch (e) {
              // Skip if period already exists for this client
            }
          }
          if (createdPeriodId) {
            // Update cutoff to trigger notifications
            await payrollService.updateCutoff(
              createdPeriodId,
              newPayrollDate,
              "Payroll date set by admin",
            );
          }
          setSuccessMsg(
            "Payroll period created and date set. Employees and clients will be notified.",
          );
          setShowUpdatePayrollDate(false);
          setNewPayrollDate("");
          setConfirmPayrollDate(false);
          setPayrollDateLogs([]);
          fetchData();
        } catch (createErr) {
          setError(createErr.message || "Failed to create payroll period");
        }
      }
    } catch (err) {
      setError(err.message || "Failed to update payroll date");
    } finally {
      setUpdatingPayrollDate(false);
    }
  };

  // Compute next payroll date from current period
  const nextPayrollDate = (() => {
    const currentPeriod = periods.find((p) => {
      const pStart = p.periodStart?.split("T")[0] || p.start;
      const pEnd = p.periodEnd?.split("T")[0] || p.end;
      return pStart === periodStart && pEnd === periodEnd;
    });
    if (currentPeriod?.cutoffDate) {
      return new Date(currentPeriod.cutoffDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    // Fallback: end of period + 1 day
    if (periodEnd) {
      const d = new Date(periodEnd + "T00:00:00Z");
      d.setDate(d.getDate() + 1);
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return null;
  })();

  const unapprovedOTEntries =
    unapprovedOTData?.clients?.flatMap((client) =>
      client.employees.map((emp) => ({
        employee: emp.name,
        client: client.clientName,
        hours: emp.hours,
        count: emp.count,
        amountAtRisk: 0, // placeholder
      })),
    ) || [];

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const summary = dashboardData?.summary || {};
  const clients = dashboardData?.clients || [];
  const employees = employeeSummary?.employees || [];
  const totals = employeeSummary?.totals || {};

  const totalBonuses = employees.reduce(
    (sum, e) => sum + (e.totalBonuses || 0),
    0,
  );
  const totalDeductions = employees.reduce(
    (sum, e) => sum + (e.totalDeductions || 0),
    0,
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payroll</h2>
          <p className="text-sm text-gray-500">
            Process and manage employee payroll
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={fetchData}
            disabled={loading}
          />
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => setShowExportModal(true)}
          >
            Export
          </Button>
          <Button
            variant={totals.payrollProcessed ? "outline" : "primary"}
            size="sm"
            icon={totals.payrollProcessed ? CheckCircle : Send}
            onClick={() =>
              !totals.payrollProcessed && setShowProcessModal(true)
            }
            disabled={totals.payrollProcessed}
          >
            {totals.payrollProcessed ? "Processed" : "Process Payroll"}
          </Button>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700 flex-1">{successMsg}</span>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-green-400 hover:text-green-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Next Payroll Date & Unapproved OT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex items-center justify-between px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-500 uppercase tracking-wider">Next Payroll Date</p>
              <p className="text-xl font-bold text-blue-800 mt-0.5">
                {nextPayrollDate || "Not set"}
              </p>
              <p className="text-xs text-blue-500 mt-0.5">
                Period: {periodStart} to {periodEnd}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={Calendar}
            onClick={() => { setShowUpdatePayrollDate(true); setNewPayrollDate(""); }}
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            Update Date
          </Button>
        </div>

        <div className={`flex items-center justify-between px-5 py-4 rounded-xl border ${
          (unapprovedOTData?.totalCount || 0) > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              {(unapprovedOTData?.totalCount || 0) > 0
                ? <AlertTriangle className="w-6 h-6 text-red-500" />
                : <CheckCircle className="w-6 h-6 text-green-500" />
              }
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wider ${
                (unapprovedOTData?.totalCount || 0) > 0 ? 'text-red-500' : 'text-green-500'
              }`}>Unapproved Overtime</p>
              <p className={`text-xl font-bold mt-0.5 ${
                (unapprovedOTData?.totalCount || 0) > 0 ? 'text-red-800' : 'text-green-800'
              }`}>
                {(unapprovedOTData?.totalCount || 0) > 0
                  ? `${unapprovedOTData.totalCount} entries pending`
                  : 'All clear'}
              </p>
              <p className={`text-xs mt-0.5 ${
                (unapprovedOTData?.totalCount || 0) > 0 ? 'text-red-500' : 'text-green-500'
              }`}>
                {(unapprovedOTData?.totalCount || 0) > 0
                  ? 'Must be resolved before payroll'
                  : 'No pending overtime'}
              </p>
            </div>
          </div>
          {(unapprovedOTData?.totalCount || 0) > 0 && (
            <Button
              variant="danger"
              size="sm"
              icon={Send}
              onClick={handleSendOTPush}
              disabled={sendingOTPush}
            >
              {sendingOTPush ? "Sending..." : "Send Reminder"}
            </Button>
          )}
        </div>
      </div>

      {/* Update Payroll Date Modal */}
      <Modal
        isOpen={showUpdatePayrollDate}
        onClose={() => { setShowUpdatePayrollDate(false); setConfirmPayrollDate(false); }}
        title="Update Next Payroll Date"
        size="sm"
        footer={
          confirmPayrollDate ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setConfirmPayrollDate(false)}
                disabled={updatingPayrollDate}
              >
                Back
              </Button>
              <Button
                variant="danger"
                icon={CheckCircle}
                onClick={handleUpdatePayrollDate}
                disabled={updatingPayrollDate}
              >
                {updatingPayrollDate ? "Updating..." : "Yes, Confirm Update"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setShowUpdatePayrollDate(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Calendar}
                onClick={() => setConfirmPayrollDate(true)}
                disabled={!newPayrollDate}
              >
                Update Date
              </Button>
            </>
          )
        }
      >
        {confirmPayrollDate ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-red-800">
                Are you sure you want to change the payroll date?
              </p>
              <p className="text-lg font-bold text-red-900 mt-2">
                {new Date(newPayrollDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </p>
              <p className="text-xs text-red-600 mt-2">
                All employees and clients will be notified about this change.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Use this to run payroll early before holidays or special dates. All
              employees and clients will be notified.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Payroll Date
              </label>
              <input
                type="date"
                className="input w-full"
                value={newPayrollDate}
                onChange={(e) => setNewPayrollDate(e.target.value)}
              />
            </div>
            <div className="p-3 bg-amber-50 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Changing the payroll date will notify all employees and clients.
                Any unapproved overtime must be resolved before this date.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Unapproved OT Table */}
      {unapprovedOTEntries.length > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-700">
                Unapproved Overtime — Action Required
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/approvals?type=autoOvertime")}
            >
              View All
            </Button>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader className="text-center">Hours</TableHeader>
                <TableHeader className="text-center">Entries</TableHeader>
                <TableHeader className="text-center">Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {unapprovedOTEntries.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <span className="font-medium text-gray-900">
                      {entry.employee}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600">{entry.client}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-red-600">
                      {entry.hours}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.count} {entry.count === 1 ? "entry" : "entries"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="danger">Pending</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {[
            { key: "employees", label: "Employees", count: employees.length },
            { key: "periods", label: "Payroll Periods", count: periods.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === tab.key
                    ? "bg-primary/10 text-primary"
                    : tab.key === "unapprovedOT" && tab.count > 0
                      ? "bg-red-100 text-red-600"
                      : "bg-gray-100 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Employees */}
      {activeTab === "employees" && (
        <>
          {/* Stats Pills */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-green-500" />
              <span className="text-sm text-green-600">Hours</span>
              <span className="text-sm font-bold text-green-700">
                {formatHours(totals.totalHours || summary.totalHours || 0)}
              </span>
            </div>
            {(totals.overtimeHours || summary.overtimeHours || 0) > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg">
                <span className="text-sm text-orange-600">OT</span>
                <span className="text-sm font-bold text-orange-700">
                  {formatHours(totals.overtimeHours || summary.overtimeHours || 0)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-600">Approved</span>
              <span className="text-sm font-bold text-blue-700">
                {formatHours(totals.approvedHours || summary.approvedHours || 0)}
              </span>
            </div>
            {(totals.pendingHours || summary.pendingHours || 0) > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
                <span className="text-sm text-yellow-600">Pending</span>
                <span className="text-sm font-bold text-yellow-700">
                  {formatHours(totals.pendingHours || summary.pendingHours || 0)}
                </span>
              </div>
            )}
            {totalBonuses > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-lg">
                <span className="text-sm text-teal-600">Bonuses</span>
                <span className="text-sm font-bold text-teal-700">
                  +${totalBonuses.toFixed(2)}
                </span>
              </div>
            )}
            {totalDeductions > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg">
                <span className="text-sm text-red-600">Deductions</span>
                <span className="text-sm font-bold text-red-700">
                  -${totalDeductions.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-sm text-emerald-600">Gross Pay</span>
              <span className="text-sm font-bold text-emerald-700">
                ${(totals.totalGrossPay || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Employee Payroll Summary</h3>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

        {employees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: "employee", label: "Employee", align: "left", px: "px-4" },
                    { key: "hours", label: "Hours Worked", align: "center", px: "px-2" },
                    { key: "overtime", label: "OT Hours", align: "center", px: "px-2" },
                    { key: null, label: "PTO Hours", align: "center", px: "px-2" },
                    { key: null, label: "VTO Hours", align: "center", px: "px-2" },
                    { key: "pending", label: "Pending Approval", align: "center", px: "px-2" },
                    { key: "totalHours", label: "Total Hours", align: "center", px: "px-2" },
                    { key: null, label: "Total Bonuses", align: "center", px: "px-2" },
                    { key: null, label: "Total Deductions", align: "center", px: "px-2" },
                    { key: "grossPay", label: "Gross Pay", align: "center", px: "px-2" },
                    { key: null, label: "Action", align: "center", px: "px-2" },
                  ].map((col) => (
                    <th
                      key={col.label}
                      onClick={col.key ? () => handleSort(col.key) : undefined}
                      className={`${col.px} py-3 text-${col.align} text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.key ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === "center" ? "justify-center" : ""}`}>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {employees
                .filter((emp) => {
                  if (!employeeSearch.trim()) return true;
                  const name =
                    `${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}`.toLowerCase();
                  return name.includes(employeeSearch.toLowerCase().trim());
                })
                .sort((a, b) => {
                  let cmp = 0;
                  switch (sortField) {
                    case "employee":
                      cmp = `${a.employee?.firstName || ""} ${a.employee?.lastName || ""}`.localeCompare(`${b.employee?.firstName || ""} ${b.employee?.lastName || ""}`);
                      break;
                    case "hours":
                      cmp = (a.approvedHours || 0) - (b.approvedHours || 0);
                      break;
                    case "overtime":
                      cmp = (a.overtimeHours || 0) - (b.overtimeHours || 0);
                      break;
                    case "pending":
                      cmp = (a.pendingHours || 0) - (b.pendingHours || 0);
                      break;
                    case "totalHours":
                      cmp = (a.totalHoursWithPTO || a.totalHours || 0) - (b.totalHoursWithPTO || b.totalHours || 0);
                      break;
                    case "grossPay":
                      cmp = (a.grossPay || 0) - (b.grossPay || 0);
                      break;
                    default:
                      cmp = `${a.employee?.firstName || ""}`.localeCompare(`${b.employee?.firstName || ""}`);
                  }
                  return sortDirection === "asc" ? cmp : -cmp;
                })
                .map((emp) => (
                  <React.Fragment key={emp.employee.id}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() =>
                        setExpandedEmployee(
                          expandedEmployee === emp.employee.id
                            ? null
                            : emp.employee.id,
                        )
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${expandedEmployee === emp.employee.id ? "rotate-90" : ""}`}
                          />
                          <Avatar
                            name={`${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}`}
                            src={emp.employee?.profilePhoto}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {emp.employee?.firstName || ""}{" "}
                              {emp.employee?.lastName || ""}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {emp.client?.companyName || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        <span className="font-semibold text-gray-900">
                          {formatHours(emp.approvedHours || 0)}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        {emp.overtimeHours > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {formatHours(emp.overtimeHours || 0)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        {(emp.ptoHours || 0) > 0 ? (
                          <span className="text-purple-600 font-medium">
                            {formatHours(emp.ptoHours || 0)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        {(emp.vtoHours || 0) > 0 ? (
                          <span className="text-blue-600 font-medium">
                            {formatHours(emp.vtoHours || 0)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        {emp.pendingHours > 0 ? (
                          <span className="text-amber-600 font-medium">
                            {formatHours(emp.pendingHours || 0)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        <span className="font-bold text-blue-700">
                          {formatHours(emp.totalHoursWithPTO || emp.totalHours || 0)}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        {emp.totalBonuses > 0 ? (
                          <span className="text-green-600 font-medium">
                            +${(emp.totalBonuses || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm">
                        {emp.totalDeductions > 0 ? (
                          <span className="text-red-600 font-medium">
                            -${(emp.totalDeductions || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm font-semibold text-green-600">
                        {emp.grossPay > 0
                          ? `$${(emp.grossPay || 0).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {emp.status !== "completed" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAdjustmentModal(emp, "BONUS");
                            }}
                            className="px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                          >
                            Adjust
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    {/* Expanded Detail Row */}
                    {expandedEmployee === emp.employee.id && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-0 py-0 bg-gray-50 border-b border-gray-200"
                        >
                          <div className="px-6 py-4">
                            {/* Time Records */}
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Time Records
                              </h4>
                              {emp.records && emp.records.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="text-left py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          Date
                                        </th>
                                        <th className="text-center py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          Clock In
                                        </th>
                                        <th className="text-center py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          Clock Out
                                        </th>
                                        <th className="text-center py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          Hours
                                        </th>
                                        <th className="text-center py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          OT
                                        </th>
                                        <th className="text-center py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          Break
                                        </th>
                                        <th className="text-left py-1.5 px-3 text-[11px] font-medium text-gray-400 uppercase">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {emp.records
                                        .sort(
                                          (a, b) =>
                                            new Date(a.date) - new Date(b.date),
                                        )
                                        .map((rec) => {
                                          const fmtMins = (mins) => {
                                            if (!mins) return "0m";
                                            const h = Math.floor(mins / 60);
                                            const m = Math.round(mins % 60);
                                            if (h === 0) return `${m}m`;
                                            if (m === 0) return `${h}h`;
                                            return `${h}h ${m}m`;
                                          };
                                          const totalH = rec.totalMinutes || 0;
                                          const extOT = rec.shiftExtensionMinutes || 0;
                                          const extraOT = rec.extraTimeMinutes || 0;
                                          const otH = extOT + extraOT || rec.overtimeMinutes || 0;
                                          const breakH = rec.breakMinutes || 0;
                                          const dateStr = new Date(
                                            rec.date,
                                          ).toLocaleDateString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            timeZone: "UTC",
                                          });
                                          const empTz = emp.client?.timezone || 'America/New_York';
                                          const fmtTime = (d) =>
                                            d
                                              ? new Date(d).toLocaleTimeString(
                                                  "en-US",
                                                  {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                    hour12: true,
                                                    timeZone: empTz,
                                                  },
                                                )
                                              : "—";
                                          const statusBg =
                                            rec.status === "APPROVED" ||
                                            rec.status === "AUTO_APPROVED"
                                              ? "bg-green-100 text-green-700"
                                              : rec.status === "PENDING"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-red-100 text-red-700";
                                          return (
                                            <tr
                                              key={rec.id}
                                              className="border-b border-gray-100 last:border-0"
                                            >
                                              <td className="py-1.5 px-3 text-gray-900">
                                                {dateStr}
                                              </td>
                                              <td className="py-1.5 px-3 text-center text-gray-600">
                                                {fmtTime(rec.clockIn)}
                                              </td>
                                              <td className="py-1.5 px-3 text-center text-gray-600">
                                                {fmtTime(rec.clockOut)}
                                              </td>
                                              <td className="py-1.5 px-3 text-center font-medium">
                                                {fmtMins(totalH)}
                                              </td>
                                              <td className="py-1.5 px-3 text-center">
                                                {otH > 0 ? (
                                                  <span className="text-orange-600">
                                                    {fmtMins(otH)}
                                                    {extOT > 0 && <span className="text-[10px] text-gray-400 ml-1">ext</span>}
                                                    {extraOT > 0 && <span className="text-[10px] text-gray-400 ml-1">off</span>}
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-300">
                                                    —
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-1.5 px-3 text-center">
                                                {breakH > 0 ? (
                                                  <span className="text-yellow-600">
                                                    {fmtMins(breakH)}
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-300">
                                                    —
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-1.5 px-3">
                                                <span
                                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBg}`}
                                                >
                                                  {rec.status ===
                                                  "AUTO_APPROVED"
                                                    ? "Auto Approved"
                                                    : rec.status?.charAt(0) +
                                                      rec.status
                                                        ?.slice(1)
                                                        .toLowerCase()}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">
                                  No time records for this period
                                </p>
                              )}
                            </div>
                            {/* Adjustments */}
                            <div className="flex items-start gap-8">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                  Bonuses & Deductions
                                </h4>
                                {emp.adjustments &&
                                emp.adjustments.length > 0 ? (
                                  <div className="space-y-1">
                                    {emp.adjustments.map((adj) => (
                                      <div
                                        key={adj.id}
                                        className="flex items-center gap-3"
                                      >
                                        <span
                                          className={`text-sm font-semibold ${adj.type === "BONUS" ? "text-green-600" : "text-red-600"}`}
                                        >
                                          {adj.type === "BONUS" ? "+" : "-"}$
                                          {adj.amount.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {adj.reason}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteAdjustmentId(adj.id);
                                          }}
                                          className="p-0.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">
                                    No adjustments
                                  </p>
                                )}
                              </div>
                              {emp.employeeDeduction > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    Default Deduction
                                  </h4>
                                  <span className="text-sm font-semibold text-red-600">
                                    -${emp.employeeDeduction.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {emp.status !== "completed" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAdjustmentModal(emp, "BONUS");
                                  }}
                                  className="mt-5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                >
                                  + Add Adjustment
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No employee data for this period</p>
          </div>
        )}
      </Card>
        </>
      )}

      {/* Tab: Payroll Periods */}
      {activeTab === "periods" && (
        <Card padding="none">
          {periods.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cutoff Date</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Hours</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Gross Pay</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {periods.map((period) => (
                    <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatPeriodLabel(period.periodStart, period.periodEnd)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(period.cutoffDate)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-sm">
                        {period.totalHours && Number(period.totalHours) > 0 ? (
                          <span className="font-semibold text-gray-900">{formatHours(Number(period.totalHours))}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-sm">
                        {period.grossPay && Number(period.grossPay) > 0 ? (
                          <span className="font-semibold text-green-600">${Number(period.grossPay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {getStatusBadge(period.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {period.status === "OPEN" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Lock}
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setShowLockModal(true);
                                }}
                              >
                                Lock
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={CheckCircle}
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setShowProcessModal(true);
                                }}
                              >
                                Finalize
                              </Button>
                            </>
                          )}
                          {period.status === "LOCKED" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Unlock}
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setShowUnlockModal(true);
                                }}
                              >
                                Unlock
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={CheckCircle}
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setShowProcessModal(true);
                                }}
                              >
                                Finalize
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={EyeIcon}
                            onClick={() => {
                              const pStart =
                                period.periodStart?.split("T")[0] || period.start;
                              const pEnd =
                                period.periodEnd?.split("T")[0] || period.end;
                              navigate(
                                `/admin/payroll/report?periodStart=${pStart}&periodEnd=${pEnd}&tab=periods`,
                              );
                            }}
                          >
                            Report
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="font-medium text-gray-900">No Payroll Periods</p>
              <p className="text-sm mt-1">Payroll periods will appear here once created</p>
            </div>
          )}
        </Card>
      )}

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Payroll Data"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Export payroll data for {formatPeriodLabel(periodStart, periodEnd)}
          </p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              icon={FileDown}
              onClick={() => handleExport("csv")}
              disabled={actionLoading}
            >
              Download as CSV
            </Button>
          </div>
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportData(null);
        }}
        title={`Payroll Report — ${reportPeriod ? formatPeriodLabel(reportPeriod.start, reportPeriod.end) : ""}`}
        size="xl"
      >
        {reportLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : reportData?.employees?.length > 0 ? (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm text-blue-700 font-semibold">
                  {reportData.totals?.totalEmployees || 0} Employees
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-green-500" />
                <span className="text-sm text-green-700 font-semibold">
                  {formatHours(reportData.totals?.totalHours || 0)} Total
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                <DollarSign className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm text-purple-700 font-semibold">
                  ${(reportData.totals?.totalGrossPay || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Employee table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Client
                    </th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Days
                    </th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Total Hours
                    </th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      OT Hours
                    </th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Rate
                    </th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase">
                      Gross Pay
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.employees.map((emp, idx) => {
                    const ratePeriods = Object.values(emp._ratePeriods || {});
                    const hasMultipleRates = ratePeriods.length > 1;
                    const fmtShort = (d) =>
                      new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      });

                    if (hasMultipleRates) {
                      return (
                        <Fragment key={idx}>
                          {ratePeriods.map((rp, rpIdx) => {
                            const totalH =
                              Math.round((rp.regularMinutes / 60) * 100) / 100;
                            const otH =
                              Math.round((rp.otMinutes / 60) * 100) / 100;
                            return (
                              <tr
                                key={`${idx}-${rpIdx}`}
                                className="hover:bg-gray-50/50"
                              >
                                <td className="px-3 py-2 text-sm text-gray-900">
                                  {emp.firstName} {emp.lastName}
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-500">
                                  {fmtShort(rp.minDate)} -{" "}
                                  {fmtShort(rp.maxDate)}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {emp.client}
                                </td>
                                <td className="px-3 py-2 text-sm text-center">
                                  {rp.workDays}
                                </td>
                                <td className="px-3 py-2 text-sm text-center">
                                  {totalH}
                                </td>
                                <td className="px-3 py-2 text-sm text-center">
                                  {otH > 0 ? (
                                    <span className="text-orange-600">
                                      {otH}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-sm text-center font-medium">
                                  ${rp.rate}
                                </td>
                                <td className="px-3 py-2 text-sm text-right font-semibold">
                                  $
                                  {(
                                    Math.round(
                                      (rp.regularPay + rp.otPay) * 100,
                                    ) / 100
                                  ).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-50/80 border-b-2 border-gray-200">
                            <td
                              className="px-3 py-2 text-sm font-semibold text-gray-700"
                              colSpan={3}
                            >
                              {emp.firstName} {emp.lastName} — Total
                            </td>
                            <td className="px-3 py-2 text-sm text-center font-semibold">
                              {emp.workDays}
                            </td>
                            <td className="px-3 py-2 text-sm text-center font-semibold">
                              {formatHours(emp.totalHours)}
                            </td>
                            <td className="px-3 py-2 text-sm text-center font-semibold">
                              {emp.overtimeHours > 0 ? (
                                <span className="text-orange-600">
                                  {formatHours(emp.overtimeHours)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-sm text-right font-bold text-green-700">
                              ${emp.grossPay.toFixed(2)}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {emp.firstName} {emp.lastName}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400">—</td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {emp.client}
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          {emp.workDays}
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          {formatHours(emp.totalHours)}
                        </td>
                        <td className="px-3 py-2 text-sm text-center">
                          {emp.overtimeHours > 0 ? (
                            <span className="text-orange-600">
                              {formatHours(emp.overtimeHours)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-center font-medium">
                          ${emp.hourlyRate}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-green-700">
                          ${emp.grossPay.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td
                      className="px-3 py-2.5 text-sm font-bold text-gray-900"
                      colSpan={4}
                    >
                      GRAND TOTAL
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center font-bold">
                      {formatHours(reportData.totals?.totalHours)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center font-bold">
                      {reportData.totals?.overtimeHours > 0 ? (
                        <span className="text-orange-600">
                          {formatHours(reportData.totals.overtimeHours)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-sm text-right font-bold text-green-700">
                      ${(reportData.totals?.totalGrossPay || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Download button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={async () => {
                  try {
                    await payrollService.downloadCsv(
                      reportPeriod.start,
                      reportPeriod.end,
                    );
                  } catch (err) {
                    setError(err.message || "Failed to download");
                  }
                }}
              >
                Download CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No payroll data for this period</p>
          </div>
        )}
      </Modal>

      {/* Lock Modal */}
      <Modal
        isOpen={showLockModal}
        onClose={() => {
          setShowLockModal(false);
          setSelectedPeriod(null);
        }}
        title="Lock Payroll Period"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLockModal(false)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              icon={Lock}
              onClick={handleLockPeriod}
              disabled={actionLoading}
            >
              {actionLoading ? "Locking..." : "Lock Period"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Locking this payroll period will prevent any further changes to time
            records.
          </p>
          {selectedPeriod && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">
                {formatPeriodLabel(
                  selectedPeriod.periodStart,
                  selectedPeriod.periodEnd,
                )}
              </p>
            </div>
          )}
          <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              Make sure all time records have been approved before locking.
            </p>
          </div>
        </div>
      </Modal>

      {/* Unlock Modal */}
      <Modal
        isOpen={showUnlockModal}
        onClose={() => {
          setShowUnlockModal(false);
          setSelectedPeriod(null);
          setUnlockReason("");
        }}
        title="Unlock Payroll Period"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUnlockModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Unlock}
              onClick={handleUnlockPeriod}
              disabled={actionLoading || !unlockReason.trim()}
            >
              {actionLoading ? "Unlocking..." : "Unlock Period"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for unlocking this payroll period. This
            action will be logged.
          </p>
          <div>
            <label className="label">Reason for Unlocking *</label>
            <textarea
              className="input min-h-[100px] resize-none"
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Enter the reason for unlocking this period..."
            />
          </div>
        </div>
      </Modal>

      {/* Finalize Modal */}
      <Modal
        isOpen={showProcessModal}
        onClose={() => {
          setShowProcessModal(false);
          setSelectedPeriod(null);
          setConfirmFinalize(false);
        }}
        title="Finalize Payroll Period"
        size="md"
        footer={
          confirmFinalize ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setConfirmFinalize(false)}
                disabled={actionLoading}
              >
                Back
              </Button>
              <Button
                variant="danger"
                icon={CheckCircle}
                onClick={handleFinalizePeriod}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Yes, Finalize Payroll"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowProcessModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Send}
                onClick={() => setConfirmFinalize(true)}
              >
                Finalize Payroll
              </Button>
            </>
          )
        }
      >
        {confirmFinalize ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-red-800">
                Are you sure you want to finalize this payroll period?
              </p>
              <p className="text-lg font-bold text-red-900 mt-2">
                {formatPeriodLabel(periodStart, periodEnd)}
              </p>
              <div className="flex items-center justify-center gap-4 mt-3 text-sm">
                <span className="text-gray-600">{totals.totalEmployees || employees.length || 0} employees</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">{formatHours(totals.totalHours || summary.totalHours || 0)}</span>
                <span className="text-gray-400">|</span>
                <span className="font-semibold text-green-700">${Math.max(0, totals.totalGrossPay || 0).toLocaleString()}</span>
              </div>
              <p className="text-xs text-red-600 mt-3">
                This action will generate payslips and cannot be undone. Any unapproved overtime will be carried to the next period.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-primary-50 rounded-xl">
              <p className="text-sm text-primary-600 font-medium">Period</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatPeriodLabel(periodStart, periodEnd)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Employees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totals.totalEmployees || employees.length || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatHours(totals.totalHours || summary.totalHours || 0)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-sm text-green-600">Gross Pay</p>
                <p className="text-2xl font-bold text-green-700">
                  ${Math.max(0, totals.totalGrossPay || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {(summary.totalUnapproved > 0 || summary.totalDisputed > 0) && (
              <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Some items need attention
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {summary.totalUnapproved > 0 &&
                      `${summary.totalUnapproved} pending approval`}
                    {summary.totalUnapproved > 0 &&
                      summary.totalDisputed > 0 &&
                      ", "}
                    {summary.totalDisputed > 0 &&
                      `${summary.totalDisputed} disputed records`}
                    . These will be excluded from this payroll run.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Any pending OT approved after finalization will be adjusted in
                    the next payroll period as outstanding approved OT.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustmentModal}
        onClose={() => {
          setShowAdjustmentModal(false);
          setAdjustmentEmployee(null);
        }}
        title={`Add ${adjustmentType === "BONUS" ? "Bonus" : "Deduction"}`}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowAdjustmentModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant={adjustmentType === "BONUS" ? "primary" : "danger"}
              onClick={handleAddAdjustment}
              disabled={
                adjustmentLoading ||
                !adjustmentAmount ||
                !adjustmentReason.trim()
              }
            >
              {adjustmentLoading
                ? "Saving..."
                : `Add ${adjustmentType === "BONUS" ? "Bonus" : "Deduction"}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {adjustmentEmployee && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Avatar
                name={`${adjustmentEmployee.employee.firstName} ${adjustmentEmployee.employee.lastName}`}
                src={adjustmentEmployee.employee.profilePhoto}
                size="sm"
              />
              <div>
                <p className="font-medium text-gray-900">
                  {adjustmentEmployee.employee.firstName}{" "}
                  {adjustmentEmployee.employee.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  Period: {formatPeriodLabel(periodStart, periodEnd)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label">Type</label>
            <div className="relative">
              <select
                className="input appearance-none pr-9"
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
              >
                <option value="BONUS">Bonus</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="label">Amount ($) *</label>
            <input
              type="number"
              className="input"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
            />
          </div>

          <div>
            <label className="label">Reason *</label>
            <textarea
              className="input min-h-[80px] resize-none"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder={
                adjustmentType === "BONUS"
                  ? "e.g., Performance bonus, Holiday bonus..."
                  : "e.g., Advance recovery, Equipment damage..."
              }
            />
          </div>
        </div>
      </Modal>

      {/* Delete Adjustment Confirmation Modal */}
      <Modal
        isOpen={!!deleteAdjustmentId}
        onClose={() => setDeleteAdjustmentId(null)}
        title="Delete Adjustment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteAdjustmentId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAdjustment}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete this adjustment? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
};

export default Payroll;
