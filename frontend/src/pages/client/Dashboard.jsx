import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Activity,
  Eye,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  Card,
  StatCard,
  Badge,
  Button,
  Avatar,
  Modal,
} from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeNow: 0,
    workingNow: 0,
    onBreakNow: 0,
    pendingApprovals: 0,
    weeklyHours: 0,
    monthlyBilling: 0,
  });
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [pendingOT, setPendingOT] = useState(null);
  const [error, setError] = useState(null);

  // Action modals
  const [rejectModal, setRejectModal] = useState({ show: false, item: null });
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchingRef = useRef(false);

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [statsRes, activeRes, pendingRes, weeklyRes, pendingOTRes] =
        await Promise.allSettled([
          clientPortalService.getDashboardStats(),
          clientPortalService.getActiveEmployees(),
          clientPortalService.getPendingApprovals(5),
          clientPortalService.getWeeklyHoursOverview(),
          clientPortalService.getPendingOvertimeSummary(),
        ]);

      if (statsRes.status === "fulfilled" && statsRes.value.success) {
        setStats(statsRes.value.data);
      }

      if (activeRes.status === "fulfilled" && activeRes.value.success) {
        setActiveEmployees(activeRes.value.data || []);
      }

      if (pendingRes.status === "fulfilled" && pendingRes.value.success) {
        setPendingItems(pendingRes.value.data || []);
      }

      if (weeklyRes.status === "fulfilled" && weeklyRes.value.success) {
        setWeeklyData(weeklyRes.value.data || []);
      }

      if (pendingOTRes.status === "fulfilled" && pendingOTRes.value.success) {
        setPendingOT(pendingOTRes.value.data.count > 0 ? pendingOTRes.value.data : null);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds for live data
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleApprove = async (item) => {
    try {
      setActionLoading(true);
      if (item.type === "time-entry" || item.type === "overtime") {
        await clientPortalService.approveTimeRecord(item.id);
      }
      // Refresh data after approval
      fetchDashboardData(true);
    } catch (err) {
      console.error("Error approving:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      const item = rejectModal.item;
      if (item.type === "time-entry" || item.type === "overtime") {
        await clientPortalService.rejectTimeRecord(item.id, rejectReason);
      }
      setRejectModal({ show: false, item: null });
      setRejectReason("");
      // Refresh data after rejection
      fetchDashboardData(true);
    } catch (err) {
      console.error("Error rejecting:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.client?.contactPerson?.split(' ')[0] || 'there'}!</h2>
          <p className="text-gray-500">
            Here's what's happening with your team today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className={refreshing ? "animate-spin" : ""}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="outline"
            icon={Eye}
            onClick={() => navigate("/client/analytics")}
          >
            View Reports
          </Button>
          <Button
            variant="primary"
            icon={CheckCircle}
            onClick={() => navigate("/client/approvals")}
          >
            View Approvals
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Pending Actions — Unapproved Overtime Alert */}
      {pendingOT && pendingOT.count > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-full flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-red-800">
                Pending Actions: {pendingOT.count} Unapproved Overtime{pendingOT.count !== 1 ? ' Entries' : ' Entry'}
              </h3>
              <p className="text-red-700 mt-1">
                Your employees have worked <strong>{pendingOT.totalHours}</strong> of unapproved overtime.
                We cannot pay your employees for these hours until you approve or deny.
              </p>
              {pendingOT.employees && pendingOT.employees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {pendingOT.employees.map((emp, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                      {emp.name} — {emp.hours} ({emp.entries} {emp.entries === 1 ? 'entry' : 'entries'})
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button
                  variant="danger"
                  icon={AlertCircle}
                  onClick={() => navigate("/client/time-records")}
                >
                  Review & Approve Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-5 gap-4 min-w-[700px]">
          <StatCard
            title="Total Employees"
            value={stats.totalEmployees}
            icon={Users}
          />
          <StatCard
            title="Active Now"
            value={stats.activeNow}
            icon={Activity}
            description={`${stats.workingNow} working, ${stats.onBreakNow} on break`}
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon={AlertCircle}
            description="Action required"
          />
          <StatCard
            title="Weekly Hours"
            value={stats.weeklyHours}
            icon={Clock}
            description="Total logged"
          />
          <StatCard
            title="Monthly Billing"
            value={formatCurrency(stats.monthlyBilling)}
            icon={DollarSign}
            description="Estimated"
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Workforce */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Active Workforce
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/client/workforce")}
              >
                View All
              </Button>
            </div>
            {activeEmployees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No employees are currently working</p>
                <p className="text-sm mt-1">
                  Active employees will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeEmployees.slice(0, 5).map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar
                        name={employee.name}
                        src={employee.profilePhoto}
                        status={
                          employee.status === "working" ? "online" : "away"
                        }
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.name}
                        </p>
                        <p className="text-sm text-gray-500">{employee.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Started</p>
                        <p className="font-semibold text-gray-900">
                          {employee.startTime
                            ? new Date(employee.startTime).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "-"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Duration</p>
                        <p className="font-semibold text-gray-900">
                          {employee.duration}
                        </p>
                      </div>
                      <Badge
                        variant={
                          employee.status === "working" ? "success" : "warning"
                        }
                        dot
                      >
                        {employee.status === "working" ? "Working" : "On Break"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Pending Actions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Pending Actions
            </h3>
            {pendingItems.length > 0 && (
              <Badge variant="danger">{pendingItems.length}</Badge>
            )}
          </div>
          {pendingItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p>All caught up!</p>
              <p className="text-sm mt-1">No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-4 border border-gray-100 rounded-lg hover:border-primary-200 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge
                        variant={
                          item.type === "overtime"
                            ? "warning"
                            : item.type === "leave"
                              ? "info"
                              : "default"
                        }
                        size="sm"
                      >
                        {item.type === "overtime"
                          ? "Overtime"
                          : item.type === "leave"
                            ? "Leave Request"
                            : "Time Entry"}
                      </Badge>
                    </div>
                  </div>
                  <p className="font-medium text-gray-900">{item.employee}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {item.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {typeof item.date === "string"
                      ? item.date
                      : new Date(item.date).toLocaleDateString()}
                  </p>
                  {item.type !== "leave" && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => handleApprove(item)}
                        disabled={actionLoading}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => setRejectModal({ show: true, item })}
                        disabled={actionLoading}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Weekly Overview */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Weekly Hours Overview
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-gray-500">Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-gray-500">Pending</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-4">
          {(weeklyData.length > 0
            ? weeklyData
            : [
                { day: "Sun", approved: 0, pending: 0, total: 0 },
                { day: "Mon", approved: 0, pending: 0, total: 0 },
                { day: "Tue", approved: 0, pending: 0, total: 0 },
                { day: "Wed", approved: 0, pending: 0, total: 0 },
                { day: "Thu", approved: 0, pending: 0, total: 0 },
                { day: "Fri", approved: 0, pending: 0, total: 0 },
                { day: "Sat", approved: 0, pending: 0, total: 0 },
              ]
          ).map((data) => {
            const maxHours = Math.max(
              ...weeklyData.map((d) => d.total || 0),
              stats.totalEmployees * 8 || 40,
            );

            return (
              <div key={data.day} className="text-center">
                <p className="text-sm text-gray-500 mb-2">{data.day}</p>
                <div className="h-32 bg-gray-100 rounded-lg relative overflow-hidden">
                  {data.total > 0 && (
                    <>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary transition-all"
                        style={{
                          height: `${Math.min((data.approved / maxHours) * 100, 100)}%`,
                        }}
                      />
                      <div
                        className="absolute left-0 right-0 bg-yellow-400 transition-all"
                        style={{
                          bottom: `${Math.min((data.approved / maxHours) * 100, 100)}%`,
                          height: `${Math.min((data.pending / maxHours) * 100, 100)}%`,
                        }}
                      />
                    </>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 mt-2">
                  {data.total}h
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.show}
        onClose={() => {
          setRejectModal({ show: false, item: null });
          setRejectReason("");
        }}
        title="Reject Time Entry"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to reject this time entry from{" "}
            <span className="font-semibold">{rejectModal.item?.employee}</span>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              placeholder="Enter rejection reason..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setRejectModal({ show: false, item: null });
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={handleReject}
              disabled={actionLoading}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDashboard;
