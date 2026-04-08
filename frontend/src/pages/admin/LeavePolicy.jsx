import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Building2,
  Users,
  Calendar,
  Settings,
  Edit3,
  Minus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  Loader2,
  RefreshCw,
  FileText,
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
  AddButton,
} from "../../components/common";
import leavePolicyService from "../../services/leavePolicy.service";
import { formatDate } from "../../utils/formatDateTime";

const LeavePolicy = () => {
  const [activeTab, setActiveTab] = useState("policies");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Policies tab state
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState({});
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Balances tab state
  const [employees, setEmployees] = useState([]);
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceClientFilter, setBalanceClientFilter] = useState("all");
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    adjustmentType: "ADD",
    days: "",
    reason: "",
  });
  const [adjusting, setAdjusting] = useState(false);

  // Approvals tab state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [approvalStats, setApprovalStats] = useState({});
  const [approvalSearch, setApprovalSearch] = useState("");
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("all");
  const [approvalClientFilter, setApprovalClientFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processingApproval, setProcessingApproval] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState([]);

  // Run accrual state
  const [runningAccrual, setRunningAccrual] = useState(false);

  // ============================================
  // POLICIES TAB
  // ============================================

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await leavePolicyService.getClientsWithPolicies({
        search: clientSearch || undefined,
      });
      if (response.success) {
        setClients(response.data.clients || []);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [clientSearch]);

  const handleEditPolicy = (client) => {
    setSelectedClient(client);
    setPolicyForm(
      client.policy || {
        allowPaidLeave: false,
        paidLeaveEntitlementType: "NONE",
        annualPaidLeaveDays: 0,
        accrualRatePerMonth: null,
        milestoneYearsRequired: null,
        milestoneBonusDays: null,
        maxCarryoverDays: 0,
        carryoverExpiryMonths: null,
        allowUnpaidLeave: true,
        requireTwoWeeksNotice: true,
        allowPaidHolidays: false,
        numberOfPaidHolidays: 0,
        allowUnpaidHolidays: false,
        numberOfUnpaidHolidays: 0,
        allowOvertime: true,
        overtimeRequiresApproval: true,
        overtimeThreshold: 40,
      },
    );
    setShowPolicyModal(true);
  };

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      const response = await leavePolicyService.updateClientPolicy(
        selectedClient.id,
        policyForm,
      );
      if (response.success) {
        setShowPolicyModal(false);
        fetchClients();
      } else {
        alert(response.error || "Failed to save policy");
      }
    } catch (err) {
      console.error("Error saving policy:", err);
      alert("Failed to save policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  // ============================================
  // BALANCES TAB
  // ============================================

  const fetchEmployeeBalances = useCallback(async () => {
    setLoading(true);
    try {
      const response = await leavePolicyService.getEmployeeBalances({
        clientId:
          balanceClientFilter !== "all" ? balanceClientFilter : undefined,
        search: balanceSearch || undefined,
        year: balanceYear,
      });
      if (response.success) {
        setEmployees(response.data.employees || []);
      }
    } catch (err) {
      console.error("Error fetching balances:", err);
      setError("Failed to load employee balances");
    } finally {
      setLoading(false);
    }
  }, [balanceClientFilter, balanceSearch, balanceYear]);

  const handleAdjustBalance = (employee) => {
    setSelectedEmployee(employee);
    setAdjustForm({
      adjustmentType: "ADD",
      days: "",
      reason: "",
    });
    setShowAdjustModal(true);
  };

  const submitAdjustment = async () => {
    if (!adjustForm.days || adjustForm.days <= 0) {
      alert("Please enter a valid number of days");
      return;
    }
    if (!adjustForm.reason || adjustForm.reason.trim().length < 10) {
      alert("Please provide a reason (minimum 10 characters)");
      return;
    }

    setAdjusting(true);
    try {
      const response = await leavePolicyService.adjustEmployeeBalance(
        selectedEmployee.id,
        {
          clientId: selectedEmployee.clientId,
          year: balanceYear,
          adjustmentType: adjustForm.adjustmentType,
          days: parseFloat(adjustForm.days),
          reason: adjustForm.reason.trim(),
        },
      );
      if (response.success) {
        setShowAdjustModal(false);
        fetchEmployeeBalances();
      } else {
        alert(response.error || "Failed to adjust balance");
      }
    } catch (err) {
      console.error("Error adjusting balance:", err);
      alert("Failed to adjust balance");
    } finally {
      setAdjusting(false);
    }
  };

  // ============================================
  // APPROVALS TAB
  // ============================================

  const fetchLeaveRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await leavePolicyService.getAllLeaveRequests({
        status:
          approvalStatusFilter !== "all" ? approvalStatusFilter : undefined,
        clientId:
          approvalClientFilter !== "all" ? approvalClientFilter : undefined,
        search: approvalSearch || undefined,
      });
      if (response.success) {
        setLeaveRequests(response.data.requests || []);
        setApprovalStats(response.data.stats || {});
      }
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setError("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [approvalStatusFilter, approvalClientFilter, approvalSearch]);

  const handleApprove = async (request) => {
    setProcessingApproval(true);
    try {
      const response = await leavePolicyService.approveLeaveRequest(request.id);
      if (response.success) {
        fetchLeaveRequests();
      } else {
        alert(response.error || "Failed to approve request");
      }
    } catch (err) {
      console.error("Error approving request:", err);
      alert("Failed to approve request");
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      alert("Please provide a rejection reason (minimum 10 characters)");
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await leavePolicyService.rejectLeaveRequest(
        selectedRequest.id,
        rejectReason.trim(),
      );
      if (response.success) {
        setShowRejectModal(false);
        fetchLeaveRequests();
      } else {
        alert(response.error || "Failed to reject request");
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
      alert("Failed to reject request");
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) {
      alert("Please select requests to approve");
      return;
    }

    setProcessingApproval(true);
    try {
      const response =
        await leavePolicyService.bulkApproveLeaveRequests(selectedRequests);
      if (response.success) {
        setSelectedRequests([]);
        fetchLeaveRequests();
      } else {
        alert(response.error || "Failed to bulk approve");
      }
    } catch (err) {
      console.error("Error bulk approving:", err);
      alert("Failed to bulk approve");
    } finally {
      setProcessingApproval(false);
    }
  };

  // ============================================
  // ACCRUAL
  // ============================================

  const handleRunAccrual = async () => {
    if (
      !confirm(
        "Run monthly accrual calculation for all employees with ACCRUED leave policy?",
      )
    ) {
      return;
    }

    setRunningAccrual(true);
    try {
      const response = await leavePolicyService.runAccrualCalculation();
      if (response.success) {
        alert(
          `Accrual complete! Processed: ${response.data.processed}, Updated: ${response.data.updated}`,
        );
        if (activeTab === "balances") {
          fetchEmployeeBalances();
        }
      } else {
        alert(response.error || "Failed to run accrual");
      }
    } catch (err) {
      console.error("Error running accrual:", err);
      alert("Failed to run accrual calculation");
    } finally {
      setRunningAccrual(false);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (activeTab === "policies") {
      fetchClients();
    } else if (activeTab === "balances") {
      fetchEmployeeBalances();
    } else if (activeTab === "approvals") {
      fetchLeaveRequests();
    }
  }, [activeTab, fetchClients, fetchEmployeeBalances, fetchLeaveRequests]);

  // ============================================
  // HELPERS
  // ============================================

  const getEntitlementLabel = (type) => {
    switch (type) {
      case "NONE":
        return "No Paid Leave";
      case "FIXED":
        return "Fixed Yearly";
      case "FIXED_HALF_YEARLY":
        return "Fixed Half-Yearly";
      case "ACCRUED":
        return "Monthly Accrual";
      case "MILESTONE":
        return "Milestone Based";
      default:
        return type;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "APPROVED_BY_CLIENT":
        return <Badge variant="info">Client Approved</Badge>;
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Leave Policy Management
          </h2>
          <p className="text-gray-500">
            Configure leave policies, manage balances, and approve requests
          </p>
        </div>
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={handleRunAccrual}
          disabled={runningAccrual}
        >
          {runningAccrual ? "Running..." : "Run Accrual"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("policies")}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "policies"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Settings className="w-4 h-4" />
            Policy Config
          </button>
          <button
            onClick={() => setActiveTab("balances")}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "balances"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Leave Balances
          </button>
          <button
            onClick={() => setActiveTab("approvals")}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "approvals"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <FileText className="w-4 h-4" />
            Approvals
            {approvalStats.pending > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                {approvalStats.pending}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* POLICIES TAB */}
      {activeTab === "policies" && (
        <Card padding="md">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="input pl-10 w-full max-w-md"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Employees</TableHeader>
                  <TableHeader>Paid Leave</TableHeader>
                  <TableHeader>Entitlement Type</TableHeader>
                  <TableHeader>Annual Days</TableHeader>
                  <TableHeader>Unpaid Leave</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {client.companyName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>{client.employeeCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.policy?.allowPaidLeave ? (
                        <Badge variant="success">Enabled</Badge>
                      ) : (
                        <Badge variant="default">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.policy
                        ? getEntitlementLabel(
                            client.policy.paidLeaveEntitlementType,
                          )
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {client.policy?.annualPaidLeaveDays || 0} days
                    </TableCell>
                    <TableCell>
                      {client.policy?.allowUnpaidLeave !== false ? (
                        <Badge variant="success">Enabled</Badge>
                      ) : (
                        <Badge variant="default">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit3}
                        onClick={() => handleEditPolicy(client)}
                      >
                        Configure
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* BALANCES TAB */}
      {activeTab === "balances" && (
        <Card padding="md">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search employees..."
                value={balanceSearch}
                onChange={(e) => setBalanceSearch(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <div className="relative">
              <select
                value={balanceClientFilter}
                onChange={(e) => setBalanceClientFilter(e.target.value)}
                className="input appearance-none pr-9"
              >
                <option value="all">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={balanceYear}
                onChange={(e) => setBalanceYear(parseInt(e.target.value, 10))}
                className="input appearance-none pr-9"
              >
                {[2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Entitled</TableHeader>
                  <TableHeader>Carryover</TableHeader>
                  <TableHeader>Used</TableHeader>
                  <TableHeader>Pending</TableHeader>
                  <TableHeader>Available</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={`${emp.id}-${emp.clientId}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={emp.name}
                          src={emp.profilePhoto}
                          size="sm"
                        />
                        <span className="font-medium">{emp.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{emp.clientName}</TableCell>
                    <TableCell>{emp.balance.entitled} days</TableCell>
                    <TableCell>{emp.balance.carryover} days</TableCell>
                    <TableCell>{emp.balance.used} days</TableCell>
                    <TableCell>
                      {emp.balance.pending > 0 ? (
                        <span className="text-yellow-600">
                          {emp.balance.pending} days
                        </span>
                      ) : (
                        "0 days"
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${emp.balance.available < 0 ? "text-red-600" : emp.balance.available < 3 ? "text-yellow-600" : "text-green-600"}`}
                      >
                        {emp.balance.available} days
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit3}
                        onClick={() => handleAdjustBalance(emp)}
                      >
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* APPROVALS TAB */}
      {activeTab === "approvals" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold">
                    {approvalStats.pending || 0}
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Client Approved</p>
                  <p className="text-xl font-bold">
                    {approvalStats.clientApproved || 0}
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-xl font-bold">
                    {approvalStats.approved || 0}
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-xl font-bold">
                    {approvalStats.rejected || 0}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card padding="md">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={approvalSearch}
                  onChange={(e) => setApprovalSearch(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
              <div className="relative">
                <select
                  value={approvalStatusFilter}
                  onChange={(e) => setApprovalStatusFilter(e.target.value)}
                  className="input appearance-none pr-9"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="client-approved">Client Approved</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={approvalClientFilter}
                  onChange={(e) => setApprovalClientFilter(e.target.value)}
                  className="input appearance-none pr-9"
                >
                  <option value="all">All Clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {selectedRequests.length > 0 && (
                <Button
                  variant="primary"
                  icon={CheckCircle}
                  onClick={handleBulkApprove}
                  disabled={processingApproval}
                >
                  Approve Selected ({selectedRequests.length})
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : leaveRequests.length > 0 ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>
                      <input
                        type="checkbox"
                        checked={
                          selectedRequests.length ===
                          leaveRequests.filter(
                            (r) =>
                              r.status !== "APPROVED" &&
                              r.status !== "REJECTED",
                          ).length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRequests(
                              leaveRequests
                                .filter(
                                  (r) =>
                                    r.status !== "APPROVED" &&
                                    r.status !== "REJECTED",
                                )
                                .map((r) => r.id),
                            );
                          } else {
                            setSelectedRequests([]);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </TableHeader>
                    <TableHeader>Employee</TableHeader>
                    <TableHeader>Client</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>Dates</TableHeader>
                    <TableHeader>Days</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRequests.includes(request.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRequests([
                                ...selectedRequests,
                                request.id,
                              ]);
                            } else {
                              setSelectedRequests(
                                selectedRequests.filter(
                                  (id) => id !== request.id,
                                ),
                              );
                            }
                          }}
                          disabled={
                            request.status === "APPROVED" ||
                            request.status === "REJECTED"
                          }
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={request.employee.name}
                            src={request.employee.profilePhoto}
                            size="sm"
                          />
                          <div>
                            <span className="font-medium">
                              {request.employee.name}
                            </span>
                            {request.isShortNotice && (
                              <div className="flex items-center gap-1 text-xs text-yellow-600">
                                <AlertTriangle className="w-3 h-3" />
                                Short notice
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{request.client.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.leaveType === "PAID" ? "success" : "default"
                          }
                        >
                          {request.leaveType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(request.startDate)}</div>
                          {request.startDate !== request.endDate && (
                            <div className="text-gray-500">
                              to {formatDate(request.endDate)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{request.days} days</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {(request.status === "PENDING" ||
                          request.status === "APPROVED_BY_CLIENT") && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={CheckCircle}
                              onClick={() => handleApprove(request)}
                              disabled={processingApproval}
                              className="text-green-600 hover:text-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={XCircle}
                              onClick={() => handleReject(request)}
                              disabled={processingApproval}
                              className="text-red-600 hover:text-red-700"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No leave requests found
              </div>
            )}
          </Card>
        </>
      )}

      {/* Policy Edit Modal */}
      <Modal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        title={`Configure Leave Policy - ${selectedClient?.companyName}`}
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowPolicyModal(false)}
              disabled={savingPolicy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePolicy}
              disabled={savingPolicy}
            >
              {savingPolicy ? "Saving..." : "Save Policy"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Paid Leave Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 border-b pb-2">
              Paid Leave Settings
            </h4>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.allowPaidLeave || false}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    allowPaidLeave: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <span>Enable Paid Leave</span>
            </label>

            {policyForm.allowPaidLeave && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entitlement Type
                  </label>
                  <div className="relative">
                    <select
                      value={policyForm.paidLeaveEntitlementType || "NONE"}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          paidLeaveEntitlementType: e.target.value,
                        })
                      }
                      className="input w-full appearance-none pr-9"
                    >
                      <option value="NONE">None</option>
                      <option value="FIXED">Fixed Yearly Allocation</option>
                      <option value="FIXED_HALF_YEARLY">
                        Fixed Half-Yearly Allocation
                      </option>
                      <option value="ACCRUED">Monthly Accrual</option>
                      <option value="MILESTONE">Milestone Based</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {policyForm.paidLeaveEntitlementType === "FIXED" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Annual Paid Leave Days
                    </label>
                    <input
                      type="number"
                      value={policyForm.annualPaidLeaveDays || 0}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          annualPaidLeaveDays:
                            parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="input w-full"
                      min="0"
                    />
                  </div>
                )}

                {policyForm.paidLeaveEntitlementType === "ACCRUED" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Accrual Rate (days/month)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={policyForm.accrualRatePerMonth || ""}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            accrualRatePerMonth:
                              parseFloat(e.target.value) || null,
                          })
                        }
                        className="input w-full"
                        placeholder="e.g., 1.25"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Annual Days
                      </label>
                      <input
                        type="number"
                        value={policyForm.annualPaidLeaveDays || 0}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            annualPaidLeaveDays:
                              parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="input w-full"
                        min="0"
                      />
                    </div>
                  </div>
                )}

                {policyForm.paidLeaveEntitlementType === "MILESTONE" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Years Required
                      </label>
                      <input
                        type="number"
                        value={policyForm.milestoneYearsRequired || ""}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            milestoneYearsRequired:
                              parseInt(e.target.value, 10) || null,
                          })
                        }
                        className="input w-full"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bonus Days After Milestone
                      </label>
                      <input
                        type="number"
                        value={policyForm.milestoneBonusDays || ""}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            milestoneBonusDays:
                              parseInt(e.target.value, 10) || null,
                          })
                        }
                        className="input w-full"
                        min="0"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Carryover Days
                    </label>
                    <input
                      type="number"
                      value={policyForm.maxCarryoverDays || 0}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          maxCarryoverDays: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="input w-full"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carryover Expiry (months)
                    </label>
                    <input
                      type="number"
                      value={policyForm.carryoverExpiryMonths || ""}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          carryoverExpiryMonths:
                            parseInt(e.target.value, 10) || null,
                        })
                      }
                      className="input w-full"
                      placeholder="e.g., 3"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Unpaid Leave Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 border-b pb-2">
              Unpaid Leave Settings
            </h4>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.allowUnpaidLeave !== false}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    allowUnpaidLeave: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <span>Allow Unpaid Leave</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.requireTwoWeeksNotice !== false}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    requireTwoWeeksNotice: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <span>
                Require 2 Weeks Notice (warn for short notice requests)
              </span>
            </label>
          </div>

          {/* Holiday Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 border-b pb-2">
              Holiday Settings
            </h4>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.allowPaidHolidays || false}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    allowPaidHolidays: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <span>Allow Paid Holidays</span>
            </label>

            {policyForm.allowPaidHolidays && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Holiday Type
                  </label>
                  <div className="relative">
                    <select
                      value={policyForm.paidHolidayType || "federal"}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          paidHolidayType: e.target.value,
                        })
                      }
                      className="input w-full appearance-none pr-9"
                    >
                      <option value="federal">Federal Holidays</option>
                      <option value="state">State Holidays</option>
                      <option value="company">Company Specific</option>
                      <option value="custom">Custom</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {policyForm.paidHolidayType === "federal"
                      ? "Federal Holidays"
                      : policyForm.paidHolidayType === "state"
                        ? "State Holidays"
                        : policyForm.paidHolidayType === "company"
                          ? "Company Holidays"
                          : "Custom Holidays"}{" "}
                    Per Year
                  </label>
                  <input
                    type="number"
                    value={policyForm.numberOfPaidHolidays || 0}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        numberOfPaidHolidays: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="input w-full"
                    min="0"
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.allowUnpaidHolidays || false}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    allowUnpaidHolidays: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <span>Allow Unpaid Holidays</span>
            </label>
          </div>

          {/* Overtime Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 border-b pb-2">
              Overtime Settings
            </h4>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.allowOvertime !== false}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    allowOvertime: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <span>Allow Overtime</span>
            </label>

            {policyForm.allowOvertime !== false && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policyForm.overtimeRequiresApproval !== false}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        overtimeRequiresApproval: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  <span>Overtime Requires Approval</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overtime Threshold (weekly hours)
                  </label>
                  <input
                    type="number"
                    value={policyForm.overtimeThreshold || 40}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        overtimeThreshold: parseInt(e.target.value, 10) || 40,
                      })
                    }
                    className="input w-full"
                    min="0"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`Adjust Leave Balance - ${selectedEmployee?.name}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowAdjustModal(false)}
              disabled={adjusting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitAdjustment}
              disabled={adjusting}
            >
              {adjusting ? "Saving..." : "Save Adjustment"}
            </Button>
          </>
        }
      >
        {selectedEmployee && (
          <div className="space-y-4">
            {/* Current Balance Info */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">
                  {selectedEmployee.clientName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Year</span>
                <span className="font-medium">{balanceYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Entitled</span>
                <span className="font-medium">
                  {selectedEmployee.balance.entitled} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Available</span>
                <span
                  className={`font-medium ${selectedEmployee.balance.available < 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {selectedEmployee.balance.available} days
                </span>
              </div>
            </div>

            {/* Adjustment Form */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustment Type
              </label>
              <div className="relative">
                <select
                  value={adjustForm.adjustmentType}
                  onChange={(e) =>
                    setAdjustForm({
                      ...adjustForm,
                      adjustmentType: e.target.value,
                    })
                  }
                  className="input w-full appearance-none pr-9"
                >
                  <option value="ADD">Add Days</option>
                  <option value="DEDUCT">Deduct Days</option>
                  <option value="CARRYOVER">Add Carryover</option>
                  <option value="RESET">Reset Balance</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Days
              </label>
              <input
                type="number"
                step="0.5"
                value={adjustForm.days}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, days: e.target.value })
                }
                className="input w-full"
                placeholder="e.g., 5"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adjustForm.reason}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, reason: e.target.value })
                }
                className="input w-full"
                rows={3}
                placeholder="Explain why this adjustment is being made (min 10 characters)..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {adjustForm.reason.length}/10 characters minimum
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* HOLIDAYS TAB */}
      {/* Holidays UI removed (was unreachable and referenced undefined state/handlers) */}

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Leave Request"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowRejectModal(false)}
              disabled={processingApproval}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={submitReject}
              disabled={processingApproval}
            >
              {processingApproval ? "Rejecting..." : "Reject Request"}
            </Button>
          </>
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium">
                  {selectedRequest.employee.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Leave Type</span>
                <span className="font-medium">{selectedRequest.leaveType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dates</span>
                <span className="font-medium">
                  {formatDate(selectedRequest.startDate)} -{" "}
                  {formatDate(selectedRequest.endDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Days</span>
                <span className="font-medium">{selectedRequest.days} days</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Explain why this request is being rejected (min 10 characters)..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {rejectReason.length}/10 characters minimum
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LeavePolicy;
