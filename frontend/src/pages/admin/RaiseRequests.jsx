import { useState, useEffect, useRef } from "react";
import { TrendingUp, Gift, Loader2, Check, X, Filter, ChevronDown, Upload, FileText, AlertCircle } from "lucide-react";
import { Card, Badge, Avatar } from "../../components/common";
import adminPortalService from "../../services/adminPortal.service";

const RaiseRequests = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("BONUS");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [clientFilter, setClientFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [changePayRate, setChangePayRate] = useState(false);
  const [newPayRate, setNewPayRate] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [approveError, setApproveError] = useState("");
  const [confirmationType, setConfirmationType] = useState(null); // 'proof' | 'note' | null
  const proofInputRef = useRef(null);

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

  // Unique clients and employees for filters
  const uniqueClients = [...new Map(allRequests.map((r) => [r.client.id, r.client.companyName])).entries()];
  const uniqueEmployees = [...new Map(allRequests.map((r) => [r.employee.id, `${r.employee.firstName} ${r.employee.lastName}`])).entries()];

  const filtered = allRequests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (clientFilter !== "all" && r.client.id !== clientFilter) return false;
    if (employeeFilter !== "all" && r.employee.id !== employeeFilter) return false;
    return true;
  });

  // Helper: apply client + employee filters only
  const baseFiltered = allRequests.filter((r) => {
    if (clientFilter !== "all" && r.client.id !== clientFilter) return false;
    if (employeeFilter !== "all" && r.employee.id !== employeeFilter) return false;
    return true;
  });

  // Type tab counts: show pending count only
  const typeCounts = {
    BONUS: baseFiltered.filter((r) => r.type === "BONUS" && r.status === "PENDING").length,
    RAISE: baseFiltered.filter((r) => r.type === "RAISE" && r.status === "PENDING").length,
  };

  // Status counts: filtered by client/employee AND type
  const typeFiltered = baseFiltered.filter((r) => typeFilter === "all" || r.type === typeFilter);
  const statusCounts = {
    all: typeFiltered.length,
    PENDING: typeFiltered.filter((r) => r.status === "PENDING").length,
    APPROVED: typeFiltered.filter((r) => r.status === "APPROVED").length,
    REJECTED: typeFiltered.filter((r) => r.status === "REJECTED").length,
  };

  const openApproveModal = (request) => {
    setSelectedRequest(request);
    setChangePayRate(false);
    setNewPayRate("");
    setApprovalNote("");
    setProofFile(null);
    setApproveError("");
    setConfirmationType(null);
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!confirmationType) {
      setApproveError("Please choose a confirmation method before approving.");
      return;
    }
    if (confirmationType === "note" && !approvalNote.trim()) {
      setApproveError("Please write a confirmation note before approving.");
      return;
    }
    if (confirmationType === "proof" && !proofFile) {
      setApproveError("Please upload proof before approving.");
      return;
    }
    setApproveError("");
    try {
      setActionLoading(selectedRequest.id);
      const payload = { approvalNote: confirmationType === "note" ? approvalNote.trim() : undefined };
      if (confirmationType === "proof" && proofFile) payload.proofFile = proofFile;
      if (selectedRequest.type === "RAISE" && changePayRate && newPayRate !== "") {
        payload.newPayRate = parseFloat(newPayRate);
      }
      const response = await adminPortalService.approveRaiseRequest(selectedRequest.id, payload);
      if (response.success) {
        setShowApproveModal(false);
        setSelectedRequest(null);
        setSuccessMessage(response.message || "Approved successfully");
        setTimeout(() => setSuccessMessage(""), 4000);
        fetchRequests();
      } else {
        setApproveError(response.error || "Failed to approve");
      }
    } catch (err) {
      setApproveError(err.message || "Failed to approve");
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
            <td className="py-3 px-3 text-center text-sm text-gray-500">{rr.currentPayRate !== null && rr.currentPayRate !== undefined ? rr.currentPayRate.toFixed(2) : "—"}</td>
            <td className="py-3 px-3 text-center text-sm text-gray-500">{rr.currentBillRate !== null && rr.currentBillRate !== undefined ? rr.currentBillRate.toFixed(2) : "—"}</td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-blue-700">{rr.payRate?.toFixed(2)}</td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-primary-700">{rr.billRate?.toFixed(2)}</td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {rr.effectiveDate ? new Date(rr.effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </td>
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
          onClick={() => openApproveModal(rr)}
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

      {/* Type Tabs (Bonuses / Raises) */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { key: "BONUS", label: "Bonuses", icon: Gift, count: typeCounts.BONUS },
            { key: "RAISE", label: "Raises", icon: TrendingUp, count: typeCounts.RAISE },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors inline-flex items-center gap-1.5
                ${typeFilter === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`
                ml-1 py-0.5 px-2 rounded-full text-xs
                ${typeFilter === tab.key
                  ? 'bg-primary-100 text-primary'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filters + Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status pills */}
        <div className="flex items-center gap-1">
          {[
            { key: "all", label: "All" },
            { key: "PENDING", label: "Pending" },
            { key: "APPROVED", label: "Approved" },
            { key: "REJECTED", label: "Rejected" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === s.key
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s.label}
              <span className={`ml-1 text-xs ${statusFilter === s.key ? "text-primary-500" : "text-gray-400"}`}>{statusCounts[s.key]}</span>
            </button>
          ))}
        </div>

        {/* Client / Employee filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="relative">
            <select
              className="input w-44 appearance-none"
              style={{ padding: '0.5rem 2rem 0.5rem 0.75rem' }}
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">All Clients</option>
              {uniqueClients.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="input w-44 appearance-none"
              style={{ padding: '0.5rem 2rem 0.5rem 0.75rem' }}
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="all">All Employees</option>
              {uniqueEmployees.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {(clientFilter !== "all" || employeeFilter !== "all") && (
            <button
              className="text-sm text-primary hover:text-primary-dark font-medium"
              onClick={() => { setClientFilter("all"); setEmployeeFilter("all"); }}
            >
              Clear filters ×
            </button>
          )}
        </div>
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

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowApproveModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Approve {selectedRequest.type === "BONUS" ? "Bonus" : "Raise"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedRequest.type === "BONUS" ? (
                <>Approve <span className="font-semibold text-amber-700">${selectedRequest.amount?.toFixed(2)}</span> bonus for </>
              ) : (
                <>Approve bill rate change to <span className="font-semibold text-primary-700">${selectedRequest.billRate?.toFixed(2)}</span> for </>
              )}
              <span className="font-semibold">{selectedRequest.employee.firstName} {selectedRequest.employee.lastName}</span> from {selectedRequest.client.companyName}?
            </p>
            {selectedRequest.type === "BONUS" && (
              <p className="text-xs text-gray-400 mb-4">This will add a bonus to the employee's payroll.</p>
            )}
            {selectedRequest.type === "RAISE" && (
              <div className="mb-4 space-y-3">
                <p className="text-xs text-gray-400">This will update the employee's billing rate and create a rate change history entry.</p>
                <div>
                  <label className="text-sm font-medium text-gray-700">Do you want to change the pay rate?</label>
                  <div className="flex items-center gap-4 mt-1.5">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="changePayRate"
                        checked={!changePayRate}
                        onChange={() => { setChangePayRate(false); setNewPayRate(""); }}
                        className="accent-primary"
                      />
                      <span className="text-sm text-gray-600">No</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="changePayRate"
                        checked={changePayRate}
                        onChange={() => setChangePayRate(true)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-gray-600">Yes</span>
                    </label>
                  </div>
                </div>
                {changePayRate && (
                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Current Pay Rate:</span>
                      <span className="font-semibold text-gray-700">${selectedRequest.currentPayRate !== null && selectedRequest.currentPayRate !== undefined ? selectedRequest.currentPayRate.toFixed(2) : "0.00"}</span>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">New Pay Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newPayRate}
                        onChange={(e) => setNewPayRate(e.target.value)}
                        placeholder="Enter new pay rate"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Confirmation — choose one */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700">
                Choose confirmation method <span className="text-red-500">*</span>
              </p>

              {/* Option 1: Upload proof */}
              <div
                className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${confirmationType === "proof" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                onClick={() => { setConfirmationType("proof"); setApproveError(""); }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="confirmationType"
                    checked={confirmationType === "proof"}
                    onChange={() => { setConfirmationType("proof"); setApproveError(""); }}
                    className="accent-green-600"
                  />
                  <span className="text-sm font-medium text-gray-800">Upload proof of employee notification</span>
                </div>
                {confirmationType === "proof" && (
                  <div className="mt-2 ml-5">
                    <input
                      ref={proofInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => { setProofFile(e.target.files[0] || null); setApproveError(""); }}
                    />
                    {proofFile ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-green-200 rounded-lg">
                        <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-green-700 flex-1 truncate">{proofFile.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setProofFile(null); }} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); proofInputRef.current?.click(); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-white transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Click to upload screenshot or document
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Option 2: Write note */}
              <div
                className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${confirmationType === "note" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                onClick={() => { setConfirmationType("note"); setApproveError(""); }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="confirmationType"
                    checked={confirmationType === "note"}
                    onChange={() => { setConfirmationType("note"); setApproveError(""); }}
                    className="accent-green-600"
                  />
                  <span className="text-sm font-medium text-gray-800">Write confirmation note</span>
                </div>
                {confirmationType === "note" && (
                  <div className="mt-2 ml-5" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      value={approvalNote}
                      onChange={(e) => { setApprovalNote(e.target.value); setApproveError(""); }}
                      placeholder="Confirm that the employee was notified of the bonus and was reminded to thank the client."
                      rows={3}
                      maxLength={500}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none bg-white"
                    />
                    <p className={`text-xs mt-1 text-right ${approvalNote.length >= 500 ? "text-red-500" : "text-gray-400"}`}>
                      {approvalNote.length}/500
                    </p>
                  </div>
                )}
              </div>

              {approveError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {approveError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowApproveModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                onClick={handleApprove}
                disabled={actionLoading === selectedRequest.id}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {actionLoading === selectedRequest.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
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
