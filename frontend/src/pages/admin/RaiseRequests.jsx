import { useState, useEffect } from "react";
import { TrendingUp, Gift, Loader2, Check, X } from "lucide-react";
import { Card, Badge, Avatar } from "../../components/common";
import adminPortalService from "../../services/adminPortal.service";

const RaiseRequests = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("BONUS");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminPortalService.getRaiseRequests({ status: "all" });
      if (response.success) {
        setAllRequests(response.data.requests || []);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = allRequests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  const statusCounts = {
    all: allRequests.filter((r) => typeFilter === "all" || r.type === typeFilter).length,
    PENDING: allRequests.filter((r) => r.status === "PENDING" && (typeFilter === "all" || r.type === typeFilter)).length,
    APPROVED: allRequests.filter((r) => r.status === "APPROVED" && (typeFilter === "all" || r.type === typeFilter)).length,
    REJECTED: allRequests.filter((r) => r.status === "REJECTED" && (typeFilter === "all" || r.type === typeFilter)).length,
  };

  const typeCounts = {
    all: allRequests.length,
    BONUS: allRequests.filter((r) => r.type === "BONUS").length,
    RAISE: allRequests.filter((r) => r.type === "RAISE").length,
  };

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      const response = await adminPortalService.approveRaiseRequest(id);
      if (response.success) {
        setSuccessMessage(response.message || "Approved successfully");
        setTimeout(() => setSuccessMessage(""), 4000);
        fetchRequests();
      } else {
        setError(response.error || "Failed to approve");
      }
    } catch (err) {
      setError(err.message || "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setAdminNotes("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    try {
      setActionLoading(selectedRequest.id);
      const response = await adminPortalService.rejectRaiseRequest(selectedRequest.id, adminNotes);
      if (response.success) {
        setShowRejectModal(false);
        setSelectedRequest(null);
        setAdminNotes("");
        setSuccessMessage(response.message || "Rejected");
        setTimeout(() => setSuccessMessage(""), 4000);
        fetchRequests();
      }
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PENDING": return <Badge variant="warning">Pending</Badge>;
      case "APPROVED": return <Badge variant="success">Approved</Badge>;
      case "REJECTED": return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    return type === "BONUS"
      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Gift className="w-3 h-3" />Bonus</span>
      : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><TrendingUp className="w-3 h-3" />Raise</span>;
  };

  const th = "text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3 whitespace-nowrap";

  // Bonus table
  const BonusTable = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/50 border-b border-gray-200">
          <th className={`text-left ${th} px-4`}>Employee</th>
          <th className={`text-left ${th}`}>Client</th>
          <th className={`text-center ${th}`}>Bonus Amount ($)</th>
          <th className={`text-left ${th}`}>Reason</th>
          <th className={`text-center ${th}`}>Submitted</th>
          <th className={`text-center ${th}`}>Status</th>
          <th className={`text-right ${th} px-4`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((rr) => (
          <tr key={rr.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50">
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={`${rr.employee.firstName} ${rr.employee.lastName}`} src={rr.employee.profilePhoto} size="sm" />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{rr.employee.firstName} {rr.employee.lastName}</p>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">{rr.client.companyName}</td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-amber-700">{rr.amount?.toFixed(2)}</td>
            <td className="py-3 px-3 text-sm text-gray-500 max-w-[200px] truncate">{rr.reason || "—"}</td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {new Date(rr.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </td>
            <td className="py-3 px-3 text-center">{getStatusBadge(rr.status)}</td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Raise table
  const RaiseTable = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/50 border-b border-gray-200">
          <th className={`text-left ${th} px-4`}>Employee</th>
          <th className={`text-left ${th}`}>Client</th>
          <th className={`text-center ${th}`}>Current Pay ($)</th>
          <th className={`text-center ${th}`}>Current Bill ($)</th>
          <th className={`text-center ${th}`}>New Pay ($)</th>
          <th className={`text-center ${th}`}>New Bill ($)</th>
          <th className={`text-center ${th}`}>Effective Date</th>
          <th className={`text-center ${th}`}>Status</th>
          <th className={`text-right ${th} px-4`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((rr) => (
          <tr key={rr.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50">
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={`${rr.employee.firstName} ${rr.employee.lastName}`} src={rr.employee.profilePhoto} size="sm" />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{rr.employee.firstName} {rr.employee.lastName}</p>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">{rr.client.companyName}</td>
            <td className="py-3 px-3 text-center text-sm text-gray-500">{rr.currentPayRate != null ? rr.currentPayRate.toFixed(2) : "—"}</td>
            <td className="py-3 px-3 text-center text-sm text-gray-500">{rr.currentBillRate != null ? rr.currentBillRate.toFixed(2) : "—"}</td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-blue-700">{rr.payRate?.toFixed(2)}</td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-primary-700">{rr.billRate?.toFixed(2)}</td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {rr.effectiveDate ? new Date(rr.effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </td>
            <td className="py-3 px-3 text-center">{getStatusBadge(rr.status)}</td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // All table (both types)
  const AllTable = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/50 border-b border-gray-200">
          <th className={`text-left ${th} px-4`}>Employee</th>
          <th className={`text-left ${th}`}>Client</th>
          <th className={`text-center ${th}`}>Type</th>
          <th className={`text-center ${th}`}>Amount / Rate ($)</th>
          <th className={`text-center ${th}`}>Date</th>
          <th className={`text-center ${th}`}>Status</th>
          <th className={`text-right ${th} px-4`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((rr) => (
          <tr key={rr.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50">
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={`${rr.employee.firstName} ${rr.employee.lastName}`} src={rr.employee.profilePhoto} size="sm" />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{rr.employee.firstName} {rr.employee.lastName}</p>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">{rr.client.companyName}</td>
            <td className="py-3 px-3 text-center">{getTypeBadge(rr.type)}</td>
            <td className="py-3 px-3 text-center text-sm whitespace-nowrap">
              {rr.type === "BONUS"
                ? <span className="font-semibold text-amber-700">{rr.amount?.toFixed(2)}</span>
                : <span className="font-semibold text-blue-700">{rr.payRate?.toFixed(2)} <span className="text-gray-300">/</span> {rr.billRate?.toFixed(2)}</span>
              }
            </td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {rr.type === "RAISE" && rr.effectiveDate
                ? new Date(rr.effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : new Date(rr.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            </td>
            <td className="py-3 px-3 text-center">{getStatusBadge(rr.status)}</td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderActions = (rr) => {
    if (rr.status !== "PENDING") return <span className="text-gray-300 text-sm">—</span>;
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => handleApprove(rr.id)}
          disabled={actionLoading === rr.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          {actionLoading === rr.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Approve
        </button>
        <button
          onClick={() => openRejectModal(rr)}
          disabled={actionLoading === rr.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Reject
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900">Bonuses & Raises</h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-800 font-medium text-xs">Dismiss</button>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5 text-green-500" />{successMessage}
        </div>
      )}

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        {[
          { key: "BONUS", label: "Bonuses", icon: Gift },
          { key: "RAISE", label: "Raises", icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              typeFilter === t.key
                ? "bg-primary-50 text-primary-700 border border-primary-200"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
            <span className={`ml-1 text-xs ${typeFilter === t.key ? "text-primary-500" : "text-gray-400"}`}>{typeCounts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { key: "all", label: "All" },
            { key: "PENDING", label: "Pending" },
            { key: "APPROVED", label: "Approved" },
            { key: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                statusFilter === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                statusFilter === tab.key ? "bg-primary-100 text-primary" : "bg-gray-100 text-gray-600"
              }`}>{statusCounts[tab.key]}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No requests</h3>
            <p className="text-gray-500 text-sm">No matching requests found.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            {typeFilter === "BONUS" ? <BonusTable /> : typeFilter === "RAISE" ? <RaiseTable /> : <AllTable />}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((rr) => (
              <div key={rr.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={`${rr.employee.firstName} ${rr.employee.lastName}`} src={rr.employee.profilePhoto} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{rr.employee.firstName} {rr.employee.lastName}</p>
                      <p className="text-xs text-gray-500">{rr.client.companyName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getTypeBadge(rr.type)}
                    {getStatusBadge(rr.status)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                  {rr.type === "BONUS" ? (
                    <span>Amount: <span className="font-semibold text-amber-700">{rr.amount?.toFixed(2)}</span></span>
                  ) : (
                    <span>Pay: <span className="font-semibold text-blue-700">{rr.payRate?.toFixed(2)}</span> / Bill: <span className="font-semibold text-primary-700">{rr.billRate?.toFixed(2)}</span></span>
                  )}
                </div>
                {rr.status === "PENDING" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {renderActions(rr)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Reject {selectedRequest.type === "BONUS" ? "Bonus" : "Raise"} Request
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Reject for <span className="font-semibold">{selectedRequest.employee.firstName} {selectedRequest.employee.lastName}</span> from {selectedRequest.client.companyName}.
            </p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                onClick={handleReject}
                disabled={actionLoading === selectedRequest.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {actionLoading === selectedRequest.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaiseRequests;
