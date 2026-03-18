import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  TrendingUp,
  FileDown,
  Eye,
  Plus,
  Minus,
  Trash2,
  X,
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

const Payroll = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("employees");

  // Period selection
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [employeeSummary, setEmployeeSummary] = useState(null);
  // const [unapprovedRecords, setUnapprovedRecords] = useState([]);
  // const [disputedRecords, setDisputedRecords] = useState([]);
  const [periods, setPeriods] = useState([]);

  // Modals
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
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

      const [dashboardRes, employeeSummaryRes, periodsRes] = await Promise.all([
        payrollService.getDashboard(periodStart, periodEnd),
        payrollService.getEmployeeSummary(
          periodStart,
          periodEnd,
          selectedClient || undefined,
        ),
        payrollService.getPeriods({ limit: 10 }),
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
    } catch (err) {
      console.error("Error fetching payroll data:", err);
      setError(err.message || "Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd, selectedClient]);

  // // Fetch unapproved records when tab changes
  // const fetchUnapproved = useCallback(async () => {
  //   if (!periodStart || !periodEnd) return;
  //   try {
  //     const response = await payrollService.getUnapprovedRecords({
  //       periodStart,
  //       periodEnd,
  //       clientId: selectedClient || undefined,
  //     });
  //     if (response.success) {
  //       setUnapprovedRecords(response.data?.records || []);
  //     }
  //   } catch (err) {
  //     console.error("Error fetching unapproved records:", err);
  //   }
  // }, [periodStart, periodEnd, selectedClient]);

  // // Fetch disputed records
  // const fetchDisputed = useCallback(async () => {
  //   try {
  //     const response = await payrollService.getDisputedRecords({
  //       clientId: selectedClient || undefined,
  //     });
  //     if (response.success) {
  //       setDisputedRecords(response.data?.records || []);
  //     }
  //   } catch (err) {
  //     console.error("Error fetching disputed records:", err);
  //   }
  // }, [selectedClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // useEffect(() => {
  //   if (activeTab === "unapproved") {
  //     fetchUnapproved();
  //   } else if (activeTab === "disputed") {
  //     fetchDisputed();
  //   }
  // }, [activeTab, fetchUnapproved, fetchDisputed]);

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

      // If a specific period is selected (from Clients tab), finalize that
      if (selectedPeriod) {
        const response = await payrollService.finalizePeriod(selectedPeriod.id);
        if (response.success) {
          const msgs = [];
          if (response.payslips?.generated > 0) {
            msgs.push(
              `Payroll finalized. ${response.payslips.generated} payslip(s) generated.`,
            );
          } else {
            msgs.push("Payroll period finalized.");
          }
          if (response.warnings?.length > 0) {
            msgs.push(...response.warnings);
          }
          setSuccessMsg(msgs.join(" "));
          setShowProcessModal(false);
          setSelectedPeriod(null);
          fetchData();
        } else {
          setError(response.error || "Failed to finalize period");
        }
        return;
      }

      // Otherwise, generate payslips for the current period dates
      const response = await payrollService.generatePayslips(
        periodStart,
        periodEnd,
      );
      if (response.success) {
        const msgs = [];
        if (response.data?.generated > 0) {
          msgs.push(
            `${response.data.generated} payslip(s) generated for employees.`,
          );
        } else {
          msgs.push("No payslips to generate (no approved records found).");
        }
        if (response.data?.warnings?.length > 0) {
          msgs.push(...response.data.warnings);
        }
        setSuccessMsg(msgs.join(" "));
        setShowProcessModal(false);
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll</h2>
          <p className="text-gray-500">Process and manage employee payroll</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            icon={RefreshCw}
            onClick={fetchData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            icon={Download}
            onClick={() => setShowExportModal(true)}
          >
            Export
          </Button>
          <Button
            variant={totals.payrollProcessed ? "outline" : "primary"}
            icon={totals.payrollProcessed ? CheckCircle : Send}
            onClick={() =>
              !totals.payrollProcessed && setShowProcessModal(true)
            }
            disabled={totals.payrollProcessed}
          >
            {totals.payrollProcessed ? "Payroll Processed" : "Process Payroll"}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-600">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-green-400 hover:text-green-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Period Selector */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">
              Report Dates:
            </span>
            <div className="relative">
              <select
                className="appearance-none border border-gray-300 rounded-lg pl-4 pr-9 py-2 text-sm font-medium text-gray-800 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={selectedPeriodIdx}
                onChange={handlePeriodChange}
              >
                {payPeriods.map((period, idx) => (
                  <option key={idx} value={idx}>
                    {period.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Summary Stats Grid */}
        {(() => {
          const totalBonuses = employees.reduce(
            (sum, e) => sum + (e.totalBonuses || 0),
            0,
          );
          const totalDeductions = employees.reduce(
            (sum, e) => sum + (e.totalDeductions || 0),
            0,
          );
          return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-2xl font-bold text-green-700">
                  {(
                    totals.totalHours ||
                    summary.totalHours ||
                    0
                  ).toLocaleString()}
                </p>
                <p className="text-xs text-green-600 font-medium mt-1">
                  Total Hours
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <p className="text-2xl font-bold text-orange-700">
                  {(
                    totals.overtimeHours ||
                    summary.overtimeHours ||
                    0
                  ).toLocaleString()}
                </p>
                <p className="text-xs text-orange-600 font-medium mt-1">
                  Overtime
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-2xl font-bold text-blue-700">
                  {(
                    totals.approvedHours ||
                    summary.approvedHours ||
                    0
                  ).toLocaleString()}
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1">
                  Approved
                </p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <p className="text-2xl font-bold text-yellow-700">
                  {(
                    totals.pendingHours ||
                    summary.pendingHours ||
                    0
                  ).toLocaleString()}
                </p>
                <p className="text-xs text-yellow-600 font-medium mt-1">
                  Pending
                </p>
              </div>
              <div className="rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-teal-700">
                      +$
                      {Math.round((totalBonuses * 100) / 100).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-teal-600 font-medium">
                      Bonuses
                    </p>
                  </div>
                  <div className="w-px h-8 bg-gray-200"></div>
                  <div>
                    <p className="text-lg font-bold text-red-700">
                      -$
                      {Math.round(
                        (totalDeductions * 100) / 100,
                      ).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-red-600 font-medium">
                      Deductions
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <p className="text-2xl font-bold text-emerald-700">
                  ${(totals.totalGrossPay || 0).toLocaleString()}
                </p>
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  Gross Pay
                </p>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            // { id: 'overview', label: 'Client Overview', icon: Building2 },
            { id: "employees", label: "Employees", icon: Users },
            // {
            //   id: "unapproved",
            //   label: "Pending Approval",
            //   icon: Clock,
            //   count: summary.totalUnapproved,
            // },
            // { id: 'disputed', label: 'Disputed', icon: AlertTriangle, count: summary.totalDisputed },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Client Payroll Status
          </h3>
          {clients.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Client</TableHeader>
                  <TableHeader className="text-right">Employees</TableHeader>
                  <TableHeader className="text-right">Total Hours</TableHeader>
                  <TableHeader className="text-right">Approved</TableHeader>
                  <TableHeader className="text-right">Pending</TableHeader>
                  <TableHeader className="text-right">Overtime</TableHeader>
                  <TableHeader>Readiness</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.clientId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {client.companyName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {client.employeeCount}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {client.totalHours}h
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {client.approvedHours}h
                    </TableCell>
                    <TableCell className="text-right text-yellow-600">
                      {client.pendingHours}h
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {client.overtimeHours}h
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getReadinessBadge(client.readiness)}
                        <span className="text-xs text-gray-500">
                          {client.approvedPercentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.isLocked ? (
                        <Badge
                          variant="warning"
                          className="flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" /> Locked
                        </Badge>
                      ) : (
                        <Badge variant="default">Open</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client.clientId);
                          setActiveTab("employees");
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No client data for this period</p>
            </div>
          )}
        </Card>
      )}

      {activeTab === "employees" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Employee Payroll Details
            </h3>
            <input
              type="text"
              placeholder="Search employee..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {employees.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader className="text-center whitespace-nowrap">
                    Regular Hours
                  </TableHeader>
                  <TableHeader className="text-center whitespace-nowrap">
                    Overtime
                  </TableHeader>
                  <TableHeader className="text-center whitespace-nowrap">
                    Rate
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap">
                    Adjustments
                  </TableHeader>
                  <TableHeader className="text-center whitespace-nowrap">
                    Gross Pay
                  </TableHeader>
                  <TableHeader className="text-center">Status</TableHeader>
                  <TableHeader className="text-center">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees
                  .filter((emp) => {
                    if (!employeeSearch.trim()) return true;
                    const name =
                      `${emp.employee.firstName} ${emp.employee.lastName}`.toLowerCase();
                    return name.includes(employeeSearch.toLowerCase().trim());
                  })
                  .map((emp) => (
                    <TableRow
                      key={emp.employee.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        navigate(
                          `/admin/payroll/employee/${emp.employee.id}?periodStart=${periodStart}&periodEnd=${periodEnd}`,
                        )
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${emp.employee.firstName} ${emp.employee.lastName}`}
                            src={emp.employee.profilePhoto}
                            size="sm"
                          />
                          <span className="font-medium text-gray-900">
                            {emp.employee.firstName} {emp.employee.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {emp.client?.companyName || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {emp.regularHours}h
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.overtimeHours > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {emp.overtimeHours}h
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.hourlyRate > 0 ? (
                          <span className="text-gray-600">
                            ${emp.hourlyRate}/hr
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {emp.adjustments?.length > 0 ? (
                          <div className="space-y-1.5">
                            {emp.adjustments.map((adj) => (
                              <div
                                key={adj.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-semibold ${adj.type === "BONUS" ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {adj.type === "BONUS" ? "+" : "-"}$
                                    {adj.amount.toLocaleString()}
                                  </span>
                                  <span
                                    className="text-xs text-gray-400 truncate max-w-[100px]"
                                    title={adj.reason}
                                  >
                                    {adj.reason}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteAdjustmentId(adj.id);
                                  }}
                                  className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 flex-shrink-0"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-green-600 whitespace-nowrap">
                        {emp.grossPay > 0
                          ? `$${emp.grossPay.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div>
                          {getStatusBadge(emp.status)}
                          {emp.note && (
                            <p className="text-xs text-gray-500 mt-1">
                              {emp.note}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.status !== "completed" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAdjustmentModal(emp, "BONUS");
                            }}
                            className="px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                          >
                            Adjustment
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No employee data for this period</p>
            </div>
          )}
        </Card>
      )}

      {/* {activeTab === "unapproved" && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Time Approvals
          </h3>
          {unapprovedRecords.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader className="text-right">Hours</TableHeader>
                  <TableHeader className="text-right">Overtime</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {unapprovedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${record.employee?.firstName} ${record.employee?.lastName}`}
                          src={record.employee?.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium text-gray-900">
                          {record.employee?.firstName}{" "}
                          {record.employee?.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{record.client?.companyName || "-"}</TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round((record.totalMinutes / 60) * 100) / 100}h
                    </TableCell>
                    <TableCell className="text-right">
                      {record.overtimeMinutes > 0 ? (
                        <span className="text-orange-600">
                          {Math.round((record.overtimeMinutes / 60) * 100) /
                            100}
                          h
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p>All time records have been approved!</p>
            </div>
          )}
        </Card>
      )} */}

      {/* {activeTab === "disputed" && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Disputed Time Records
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Time records that have been adjusted and require client re-approval
          </p>
          {disputedRecords.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader className="text-right">Hours</TableHeader>
                  <TableHeader>Adjustment</TableHeader>
                  <TableHeader>Adjusted By</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {disputedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${record.employee?.firstName} ${record.employee?.lastName}`}
                          src={record.employee?.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium text-gray-900">
                          {record.employee?.firstName}{" "}
                          {record.employee?.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{record.client?.companyName || "-"}</TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round((record.totalMinutes / 60) * 100) / 100}h
                    </TableCell>
                    <TableCell>
                      {record.adjustments?.[0] && (
                        <div className="text-xs">
                          <p className="text-gray-500">
                            {record.adjustments[0].reason}
                          </p>
                          <p className="text-gray-400">
                            {record.adjustments[0].oldValue} →{" "}
                            {record.adjustments[0].newValue}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.adjustments?.[0]?.adjuster && (
                        <span className="text-sm text-gray-600">
                          {record.adjustments[0].adjuster.admin?.firstName}{" "}
                          {record.adjustments[0].adjuster.admin?.lastName}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p>No disputed time records</p>
            </div>
          )}
        </Card>
      )} */}

      {/* Payroll History */}
      {periods.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Payroll Periods
          </h3>
          <div className="space-y-3">
            {periods.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatPeriodLabel(period.periodStart, period.periodEnd)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Cutoff: {formatDate(period.cutoffDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {period.totalHours && (
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {period.totalHours}h
                      </p>
                      <p className="text-xs text-gray-500">Total Hours</p>
                    </div>
                  )}
                  {getStatusBadge(period.status)}
                  <div className="flex items-center gap-1">
                    {period.status === "OPEN" && (
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
                    <Button variant="ghost" size="sm" icon={Download}>
                      Report
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        }}
        title="Finalize Payroll Period"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowProcessModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Send}
              onClick={handleFinalizePeriod}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Finalize Payroll"}
            </Button>
          </>
        }
      >
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
                {totals.totalHours || summary.totalHours || 0}h
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <p className="text-sm text-green-600">Gross Pay</p>
              <p className="text-2xl font-bold text-green-700">
                ${(totals.totalGrossPay || 0).toLocaleString()}
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
                  the next payroll period.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Add any notes for this payroll run..."
            />
          </div>
        </div>
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
