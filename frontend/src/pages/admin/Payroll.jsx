import { useState, useEffect, useCallback } from 'react';
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
  TrendingUp,
  FileDown,
  Eye,
  Plus,
  Minus,
  Trash2,
  X,
} from 'lucide-react';
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
  TableCell
} from '../../components/common';
import payrollService from '../../services/payroll.service';

const Payroll = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Period selection
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [employeeSummary, setEmployeeSummary] = useState(null);
  const [unapprovedRecords, setUnapprovedRecords] = useState([]);
  const [disputedRecords, setDisputedRecords] = useState([]);
  const [periods, setPeriods] = useState([]);

  // Modals
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Adjustment modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState('BONUS');
  const [adjustmentEmployee, setAdjustmentEmployee] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteAdjustmentId, setDeleteAdjustmentId] = useState(null);

  // Set default period to current biweekly
  useEffect(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (dayOfMonth <= 15) {
      setPeriodStart(new Date(year, month, 1).toISOString().split('T')[0]);
      setPeriodEnd(new Date(year, month, 15).toISOString().split('T')[0]);
    } else {
      const lastDay = new Date(year, month + 1, 0).getDate();
      setPeriodStart(new Date(year, month, 16).toISOString().split('T')[0]);
      setPeriodEnd(new Date(year, month, lastDay).toISOString().split('T')[0]);
    }
  }, []);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!periodStart || !periodEnd) return;

    try {
      setLoading(true);
      setError('');

      const [dashboardRes, employeeSummaryRes, periodsRes] = await Promise.all([
        payrollService.getDashboard(periodStart, periodEnd),
        payrollService.getEmployeeSummary(periodStart, periodEnd, selectedClient || undefined),
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
      console.error('Error fetching payroll data:', err);
      setError(err.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd, selectedClient]);

  // Fetch unapproved records when tab changes
  const fetchUnapproved = useCallback(async () => {
    if (!periodStart || !periodEnd) return;

    try {
      const response = await payrollService.getUnapprovedRecords({
        periodStart,
        periodEnd,
        clientId: selectedClient || undefined,
      });

      if (response.success) {
        setUnapprovedRecords(response.data?.records || []);
      }
    } catch (err) {
      console.error('Error fetching unapproved records:', err);
    }
  }, [periodStart, periodEnd, selectedClient]);

  // Fetch disputed records
  const fetchDisputed = useCallback(async () => {
    try {
      const response = await payrollService.getDisputedRecords({
        clientId: selectedClient || undefined,
      });

      if (response.success) {
        setDisputedRecords(response.data?.records || []);
      }
    } catch (err) {
      console.error('Error fetching disputed records:', err);
    }
  }, [selectedClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'unapproved') {
      fetchUnapproved();
    } else if (activeTab === 'disputed') {
      fetchDisputed();
    }
  }, [activeTab, fetchUnapproved, fetchDisputed]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPeriodLabel = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const month = startDate.toLocaleDateString('en-US', { month: 'short' });
    return `${month} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`;
  };

  const getReadinessBadge = (readiness) => {
    switch (readiness) {
      case 'ready':
        return <Badge variant="success">Ready</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'critical':
        return <Badge variant="danger">Critical</Badge>;
      default:
        return <Badge variant="default">{readiness}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <Badge variant="success">Ready</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'flagged':
        return <Badge variant="danger">Flagged</Badge>;
      case 'OPEN':
        return <Badge variant="default">Open</Badge>;
      case 'LOCKED':
        return <Badge variant="warning">Locked</Badge>;
      case 'FINALIZED':
        return <Badge variant="success">Finalized</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleExport = async (format) => {
    try {
      setActionLoading(true);
      if (format === 'csv') {
        await payrollService.downloadCsv(periodStart, periodEnd, selectedClient || undefined);
      } else {
        const response = await payrollService.exportData(periodStart, periodEnd, selectedClient || undefined, format);
        if (response.success) {
          // Download JSON as file
          const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
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
      console.error('Export error:', err);
      setError('Failed to export data');
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
        setError(response.error || 'Failed to lock period');
      }
    } catch (err) {
      setError(err.message || 'Failed to lock period');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockPeriod = async () => {
    if (!selectedPeriod || !unlockReason.trim()) return;

    try {
      setActionLoading(true);
      const response = await payrollService.unlockPeriod(selectedPeriod.id, unlockReason);
      if (response.success) {
        setShowUnlockModal(false);
        setSelectedPeriod(null);
        setUnlockReason('');
        fetchData();
      } else {
        setError(response.error || 'Failed to unlock period');
      }
    } catch (err) {
      setError(err.message || 'Failed to unlock period');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizePeriod = async () => {
    if (!selectedPeriod) return;

    try {
      setActionLoading(true);
      const response = await payrollService.finalizePeriod(selectedPeriod.id);
      if (response.success) {
        setShowProcessModal(false);
        setSelectedPeriod(null);
        fetchData();
      } else {
        setError(response.error || 'Failed to finalize period');
      }
    } catch (err) {
      setError(err.message || 'Failed to finalize period');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const openAdjustmentModal = (employee, type) => {
    setAdjustmentEmployee(employee);
    setAdjustmentType(type);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setShowAdjustmentModal(true);
  };

  const handleAddAdjustment = async () => {
    if (!adjustmentEmployee || !adjustmentAmount || !adjustmentReason.trim()) return;

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
        setAdjustmentAmount('');
        setAdjustmentReason('');
        setError('');
        setSuccessMsg(response.message || `${adjustmentType === 'BONUS' ? 'Bonus' : 'Deduction'} added successfully`);
        fetchData();
      } else {
        setError(response.error || 'Failed to add adjustment');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to add adjustment');
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const handleDeleteAdjustment = async () => {
    if (!deleteAdjustmentId) return;
    try {
      const response = await payrollService.deleteAdjustment(deleteAdjustmentId);
      if (response.success) {
        setDeleteAdjustmentId(null);
        setSuccessMsg('Adjustment deleted successfully');
        fetchData();
      } else {
        setError(response.error || 'Failed to delete adjustment');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete adjustment');
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
          <Button variant="ghost" icon={RefreshCw} onClick={fetchData} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outline" icon={Download} onClick={() => setShowExportModal(true)}>
            Export
          </Button>
          <Button variant="primary" icon={Send} onClick={() => setShowProcessModal(true)}>
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-600">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Period Selector */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-primary-200 text-sm">Payroll Period</p>
            <div className="flex items-center gap-3 mt-2">
              <Calendar className="w-5 h-5" />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-medium"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <span>to</span>
                <input
                  type="date"
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-medium"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-primary-200 text-sm">Employees</p>
              <p className="text-2xl font-bold">{summary.totalEmployees || 0}</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Total Hours</p>
              <p className="text-2xl font-bold">{summary.totalHours || 0}h</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Overtime</p>
              <p className="text-2xl font-bold">{summary.overtimeHours || 0}h</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Approved</p>
              <p className="text-2xl font-bold">{summary.approvedHours || 0}h</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Readiness Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.readyClients || 0}</p>
              <p className="text-sm text-gray-500">Ready Clients</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.warningClients || 0}</p>
              <p className="text-sm text-gray-500">Warning</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.criticalClients || 0}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.totalUnapproved || 0}</p>
              <p className="text-sm text-gray-500">Pending Approval</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Client Overview', icon: Building2 },
            { id: 'employees', label: 'Employees', icon: Users },
            { id: 'unapproved', label: 'Pending Approval', icon: Clock, count: summary.totalUnapproved },
            { id: 'disputed', label: 'Disputed', icon: AlertTriangle, count: summary.totalDisputed },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
      {activeTab === 'overview' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Payroll Status</h3>
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
                        <span className="font-medium text-gray-900">{client.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{client.employeeCount}</TableCell>
                    <TableCell className="text-right font-medium">{client.totalHours}h</TableCell>
                    <TableCell className="text-right text-green-600">{client.approvedHours}h</TableCell>
                    <TableCell className="text-right text-yellow-600">{client.pendingHours}h</TableCell>
                    <TableCell className="text-right text-orange-600">{client.overtimeHours}h</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getReadinessBadge(client.readiness)}
                        <span className="text-xs text-gray-500">{client.approvedPercentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.isLocked ? (
                        <Badge variant="warning" className="flex items-center gap-1">
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
                          setActiveTab('employees');
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

      {activeTab === 'employees' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Employee Payroll Details</h3>
            <div className="flex items-center gap-2">
              <select
                className="input text-sm py-1.5"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Ready</p>
              <p className="text-xl font-bold text-green-600">{totals.readyCount || 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold text-yellow-600">{totals.pendingCount || 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Flagged</p>
              <p className="text-xl font-bold text-red-600">{totals.flaggedCount || 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-xl font-bold text-gray-900">{totals.totalHours || 0}h</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Gross Pay</p>
              <p className="text-xl font-bold text-green-700">${(totals.totalGrossPay || 0).toLocaleString()}</p>
            </div>
          </div>

          {employees.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader className="text-right">Regular Hours</TableHeader>
                  <TableHeader className="text-right">Overtime</TableHeader>
                  <TableHeader className="text-right">Rate</TableHeader>
                  <TableHeader className="text-right">Adjustments</TableHeader>
                  <TableHeader className="text-right">Gross Pay</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Action</TableHeader>
                  <TableHeader className="w-24"></TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.employee.id}>
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
                      <span className="text-gray-600">{emp.client?.companyName || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right">{emp.regularHours}h</TableCell>
                    <TableCell className="text-right">
                      {emp.overtimeHours > 0 ? (
                        <span className="text-orange-600 font-medium">{emp.overtimeHours}h</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {emp.hourlyRate > 0 ? (
                        <span className="text-gray-600">${emp.hourlyRate}/hr</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(emp.totalBonuses > 0 || emp.totalDeductions > 0) ? (
                        <div className="space-y-1">
                          {emp.totalBonuses > 0 && (
                            <p className="text-xs text-green-600">+${emp.totalBonuses.toLocaleString()}</p>
                          )}
                          {emp.totalDeductions > 0 && (
                            <p className="text-xs text-red-600">-${emp.totalDeductions.toLocaleString()}</p>
                          )}
                          {emp.adjustments?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {emp.adjustments.map((adj) => (
                                <div key={adj.id} className="flex items-center gap-1 text-xs text-gray-400">
                                  <span className="truncate max-w-[80px]" title={adj.reason}>{adj.reason}</span>
                                  <button
                                    onClick={() => setDeleteAdjustmentId(adj.id)}
                                    className="p-0.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-500"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {emp.grossPay > 0 ? `$${emp.grossPay.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        {getStatusBadge(emp.status)}
                        {emp.note && (
                          <p className="text-xs text-gray-500 mt-1">{emp.note}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openAdjustmentModal(emp, 'BONUS')}
                        className="px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                      >
                        Adjustment
                      </button>
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

      {activeTab === 'unapproved' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Time Approvals</h3>
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
                          {record.employee?.firstName} {record.employee?.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{record.client?.companyName || '-'}</TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round(record.totalMinutes / 60 * 100) / 100}h
                    </TableCell>
                    <TableCell className="text-right">
                      {record.overtimeMinutes > 0 ? (
                        <span className="text-orange-600">
                          {Math.round(record.overtimeMinutes / 60 * 100) / 100}h
                        </span>
                      ) : '-'}
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
      )}

      {activeTab === 'disputed' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Disputed Time Records</h3>
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
                          {record.employee?.firstName} {record.employee?.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{record.client?.companyName || '-'}</TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round(record.totalMinutes / 60 * 100) / 100}h
                    </TableCell>
                    <TableCell>
                      {record.adjustments?.[0] && (
                        <div className="text-xs">
                          <p className="text-gray-500">{record.adjustments[0].reason}</p>
                          <p className="text-gray-400">
                            {record.adjustments[0].oldValue} → {record.adjustments[0].newValue}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.adjustments?.[0]?.adjuster && (
                        <span className="text-sm text-gray-600">
                          {record.adjustments[0].adjuster.admin?.firstName} {record.adjustments[0].adjuster.admin?.lastName}
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
      )}

      {/* Payroll History */}
      {periods.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Periods</h3>
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
                      <p className="font-semibold text-gray-900">{period.totalHours}h</p>
                      <p className="text-xs text-gray-500">Total Hours</p>
                    </div>
                  )}
                  {getStatusBadge(period.status)}
                  <div className="flex items-center gap-1">
                    {period.status === 'OPEN' && (
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
                    {period.status === 'LOCKED' && (
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
              onClick={() => handleExport('csv')}
              disabled={actionLoading}
            >
              Download as CSV
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              icon={FileDown}
              onClick={() => handleExport('json')}
              disabled={actionLoading}
            >
              Download as JSON
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
              {actionLoading ? 'Locking...' : 'Lock Period'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Locking this payroll period will prevent any further changes to time records.
          </p>
          {selectedPeriod && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">
                {formatPeriodLabel(selectedPeriod.periodStart, selectedPeriod.periodEnd)}
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
          setUnlockReason('');
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
              {actionLoading ? 'Unlocking...' : 'Unlock Period'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for unlocking this payroll period. This action will be logged.
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
              {actionLoading ? 'Processing...' : 'Finalize Payroll'}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalEmployees || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalHours || 0}h</p>
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
                  {summary.totalUnapproved > 0 && `${summary.totalUnapproved} pending approval`}
                  {summary.totalUnapproved > 0 && summary.totalDisputed > 0 && ', '}
                  {summary.totalDisputed > 0 && `${summary.totalDisputed} disputed records`}
                  . These will be excluded from this payroll run.
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
        title={`Add ${adjustmentType === 'BONUS' ? 'Bonus' : 'Deduction'}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdjustmentModal(false)}>
              Cancel
            </Button>
            <Button
              variant={adjustmentType === 'BONUS' ? 'primary' : 'danger'}
              onClick={handleAddAdjustment}
              disabled={adjustmentLoading || !adjustmentAmount || !adjustmentReason.trim()}
            >
              {adjustmentLoading ? 'Saving...' : `Add ${adjustmentType === 'BONUS' ? 'Bonus' : 'Deduction'}`}
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
                  {adjustmentEmployee.employee.firstName} {adjustmentEmployee.employee.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  Period: {formatPeriodLabel(periodStart, periodEnd)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
            >
              <option value="BONUS">Bonus</option>
              <option value="DEDUCTION">Deduction</option>
            </select>
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
              placeholder={adjustmentType === 'BONUS' ? 'e.g., Performance bonus, Holiday bonus...' : 'e.g., Advance recovery, Equipment damage...'}
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
          Are you sure you want to delete this adjustment? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default Payroll;
