import { useState, useEffect } from "react";
import {
  Gift,
  TrendingUp,
  Loader2,
  ChevronDown,
  X,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { Card } from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";

const StatusBadge = ({ status }) => {
  if (status === "PENDING")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  if (status === "APPROVED")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
};

const BonusesRaises = () => {
  const [view, setView] = useState("list"); // "list" | "add"
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [raiseNotifications, setRaiseNotifications] = useState([]);
  const [requests, setRequests] = useState([]);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalType, setSuccessModalType] = useState("");

  const [bonusForm, setBonusForm] = useState({ employeeId: "", amount: "", reason: "" });
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [bonusError, setBonusError] = useState("");

  const [raiseForm, setRaiseForm] = useState({ employeeId: "", billRate: "", effectiveDate: "" });
  const [raiseSubmitting, setRaiseSubmitting] = useState(false);
  const [raiseError, setRaiseError] = useState("");

  const refreshRequests = () =>
    clientPortalService.getRequests().then((r) => {
      if (r.success) setRequests(r.data.requests || []);
    });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, notifRes, reqRes] = await Promise.all([
          clientPortalService.getEmployeesWithRates(),
          clientPortalService.getAdminRaiseNotifications(),
          clientPortalService.getRequests(),
        ]);
        if (empRes.success) setEmployees(empRes.data.employees || []);
        if (notifRes.success) setRaiseNotifications(notifRes.data.notifications || []);
        if (reqRes.success) setRequests(reqRes.data.requests || []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (filterType !== "ALL" && r.type !== filterType) return false;
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (filterEmployee && r.employeeId !== filterEmployee) return false;
    return true;
  });

  const selectedRaiseEmployee = employees.find((e) => e.id === raiseForm.employeeId);
  const billRateNum = parseFloat(raiseForm.billRate) || 0;

  const handleSendBonus = async (e) => {
    e.preventDefault();
    setBonusError("");
    if (!bonusForm.employeeId) return setBonusError("Please select an employee");
    if (!bonusForm.amount || parseFloat(bonusForm.amount) <= 0)
      return setBonusError("Please enter a valid amount");

    try {
      setBonusSubmitting(true);
      const response = await clientPortalService.sendBonus({
        employeeId: bonusForm.employeeId,
        amount: parseFloat(bonusForm.amount),
        reason: bonusForm.reason,
      });
      if (response.success) {
        setBonusForm({ employeeId: "", amount: "", reason: "" });
        setSuccessModalType("bonus");
        setShowSuccessModal(true);
        refreshRequests();
      } else {
        setBonusError(response.error || "Failed to send bonus");
      }
    } catch (err) {
      setBonusError(err.data?.error || err.message || "Failed to send bonus");
    } finally {
      setBonusSubmitting(false);
    }
  };

  const handleSubmitRaise = async (e) => {
    e.preventDefault();
    setRaiseError("");
    if (!raiseForm.employeeId) return setRaiseError("Please select an employee");
    if (!raiseForm.billRate || parseFloat(raiseForm.billRate) <= 0)
      return setRaiseError("Please enter a valid raise amount");
    if (!raiseForm.effectiveDate) return setRaiseError("Please select an effective start date");

    try {
      setRaiseSubmitting(true);
      const response = await clientPortalService.submitRaiseRequest({
        employeeId: raiseForm.employeeId,
        billRate: parseFloat(raiseForm.billRate),
        effectiveDate: raiseForm.effectiveDate,
      });
      if (response.success) {
        setRaiseForm({ employeeId: "", billRate: "", effectiveDate: "" });
        setSuccessModalType("raise");
        setShowSuccessModal(true);
        refreshRequests();
      } else {
        setRaiseError(response.error || "Failed to submit raise request");
      }
    } catch (err) {
      setRaiseError(err.data?.error || err.message || "Failed to submit raise request");
    } finally {
      setRaiseSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Add page ──────────────────────────────────────────────────────────────
  if (view === "add") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">Add Bonus & Raise</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Give a Bonus */}
          <Card>
            <form onSubmit={handleSendBonus} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Give a Bonus</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <div className="relative">
                  <select
                    value={bonusForm.employeeId}
                    onChange={(e) => setBonusForm({ ...bonusForm, employeeId: e.target.value })}
                    className="input w-full appearance-none pr-9"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-600 mb-1">
                  Bonus Amount ($)
                </label>
                <input
                  type="number"
                  step="0"
                  min="0"
                  value={bonusForm.amount}
                  onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })}
                  placeholder="0"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={bonusForm.reason}
                  onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
                  placeholder="e.g. Outstanding performance this quarter..."
                  rows={3}
                  className="input w-full resize-none"
                />
              </div>
              {bonusError && <p className="text-sm text-red-600">{bonusError}</p>}
              <button
                type="submit"
                disabled={bonusSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {bonusSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4" />
                )}
                Send Bonus
              </button>
            </form>
          </Card>

          {/* Give a Raise */}
          <Card>
            <form onSubmit={handleSubmitRaise} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Give a Raise</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <div className="relative">
                  <select
                    value={raiseForm.employeeId}
                    onChange={(e) => setRaiseForm({ ...raiseForm, employeeId: e.target.value })}
                    className="input w-full appearance-none pr-9"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raise Amount ($ per hour)
                </label>
                <input
                  type="number"
                  step="0"
                  min="0"
                  value={raiseForm.billRate}
                  onChange={(e) => setRaiseForm({ ...raiseForm, billRate: e.target.value })}
                  placeholder="0"
                  className="input w-full"
                />
                {selectedRaiseEmployee && billRateNum > 0 && (
                  <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    Current Rate:{" "}
                    <span className="font-semibold">
                      ${selectedRaiseEmployee.hourlyRate.toFixed(2)}/hr
                    </span>{" "}
                    + Raise:{" "}
                    <span className="font-semibold">${billRateNum.toFixed(2)}/hr</span> = New Rate:{" "}
                    <span className="font-bold text-green-700">
                      ${(selectedRaiseEmployee.hourlyRate + billRateNum).toFixed(2)}/hr
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Start Date
                </label>
                <input
                  type="date"
                  value={raiseForm.effectiveDate}
                  onChange={(e) => setRaiseForm({ ...raiseForm, effectiveDate: e.target.value })}
                  className="input w-full"
                />
              </div>
              {raiseError && <p className="text-sm text-red-600">{raiseError}</p>}
              <button
                type="submit"
                disabled={raiseSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {raiseSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                Submit Raise Request
              </button>
            </form>
          </Card>
        </div>

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {successModalType === "bonus" ? "Bonus Confirmed!" : "Raise Request Submitted!"}
                </h3>
                <button
                  onClick={() => { setShowSuccessModal(false); setView("list"); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                {successModalType === "bonus"
                  ? "Thank you for giving your employee a bonus! We will notify your employee of the bonus and deliver it at the earliest convenience. Please note bonuses may be delivered alongside regular payroll, but the employee will be notified as soon as the status shows Approved. You're a great employer!"
                  : "Your request to give a raise to this employee has been submitted and is now pending approval. Once approved, the employee will be notified and the raise will take effect from the effective start date you selected."}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => { setShowSuccessModal(false); setView("list"); }}
                  className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List page (default) ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Bonuses & Raises</h2>
        <button
          onClick={() => setView("add")}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Bonus & Raise
        </button>
      </div>

      {/* Requests List */}
      <Card>
        <h3 className="text-base font-bold text-gray-900 mb-4">My Requests</h3>

        {/* Filters */}
        {requests.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input w-36 appearance-none pr-9"
              >
                <option value="ALL">All Types</option>
                <option value="BONUS">Bonus</option>
                <option value="RAISE">Raise</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input w-36 appearance-none pr-9"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="input w-44 appearance-none pr-9"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {(filterType !== "ALL" || filterStatus !== "ALL" || filterEmployee !== "") && (
              <button
                onClick={() => { setFilterType("ALL"); setFilterStatus("ALL"); setFilterEmployee(""); }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        )}

        {requests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">No requests submitted yet.</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">No requests match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Type</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Employee</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Amount</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Effective Date</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Created At</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Status</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Action By</th>
                  <th className="text-left py-2 font-medium text-gray-500 whitespace-nowrap">Approval Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50">
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          req.type === "BONUS"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {req.type === "BONUS" ? (
                          <Gift className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {req.type === "BONUS" ? "Bonus" : "Raise"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{req.employeeName}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {req.type === "BONUS"
                        ? req.amount !== null ? `$${req.amount.toFixed(2)}` : "—"
                        : req.billRate !== null ? `+$${req.billRate.toFixed(2)}/hr` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {req.effectiveDate
                        ? new Date(req.effectiveDate).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {new Date(req.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-700">
                      {req.status === "APPROVED" ? (req.reviewedBy || <span className="text-gray-300">—</span>) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 text-sm text-gray-500 max-w-[200px]">
                      {req.status === "APPROVED"
                        ? (req.approvalNote || req.adminNotes || <span className="text-gray-300">—</span>)
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Billing Rate Updates */}
      {raiseNotifications.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary-600" />
            <h3 className="text-base font-bold text-gray-900">Billing Rate Updates</h3>
            <span className="ml-auto text-xs text-gray-400">
              {raiseNotifications.length} update{raiseNotifications.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {raiseNotifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-4 p-3 bg-blue-50 border border-blue-100 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.employeeName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Billing rate updated
                    {n.effectiveDate &&
                      ` effective ${new Date(n.effectiveDate).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}`}
                    {n.clientCoveredAmount !== null && (
                      <span className="ml-1 text-blue-700 font-medium">
                        +${n.clientCoveredAmount.toFixed(2)}/hr
                      </span>
                    )}
                  </p>
                  {n.reason && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{n.reason}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {n.newBillRate !== null && (
                    <p className="text-sm font-bold text-primary-700">
                      ${n.newBillRate.toFixed(2)}/hr
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {n.appliedAt
                      ? new Date(n.appliedAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default BonusesRaises;
