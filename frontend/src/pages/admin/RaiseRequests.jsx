import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  Gift,
  Loader2,
  Check,
  X,
  Filter,
  ChevronDown,
  Upload,
  FileText,
  AlertCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
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
  const [approvalNote, setApprovalNote] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [approveError, setApproveError] = useState("");
  const [confirmationType, setConfirmationType] = useState(null); // 'proof' | 'note' | null
  const proofInputRef = useRef(null);

  // Direct edit confirmation modal
  const [showConfirmDirectEdit, setShowConfirmDirectEdit] = useState(false);
  const [pendingDirectEdit, setPendingDirectEdit] = useState(null);

  // Give Bonus modal state
  const [showGiveBonusModal, setShowGiveBonusModal] = useState(false);
  const [giveBonusStep, setGiveBonusStep] = useState(1);
  const [pendingBonusId, setPendingBonusId] = useState(null);
  const [giveBonusForm, setGiveBonusForm] = useState({
    employeeId: "",
    clientId: "",
    amount: "",
    reason: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    coverageType: "FULL",
    clientCoveredAmount: "",
    internalNotes: "",
  });
  const [giveBonusLoading, setGiveBonusLoading] = useState(false);
  const [giveBonusError, setGiveBonusError] = useState("");

  // Give Raise modal state
  const [showGiveRaiseModal, setShowGiveRaiseModal] = useState(false);
  const [giveRaiseStep, setGiveRaiseStep] = useState(1); // 1 = form, 2 = confirm
  const [raiseCandidates, setRaiseCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [giveRaiseForm, setGiveRaiseForm] = useState({
    employeeId: "",
    clientId: "",
    coverageType: "FULL",
    employeeRaiseAmount: "",
    clientCoveredAmount: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    reason: "",
    internalNotes: "",
  });
  const [pendingRaiseId, setPendingRaiseId] = useState(null);
  const [giveRaiseLoading, setGiveRaiseLoading] = useState(false);
  const [giveRaiseError, setGiveRaiseError] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminPortalService.getRaiseRequests({
        status: "all",
      });
      if (response.success) {
        setAllRequests(response.data.requests || []);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Unique clients and employees for filters
  const uniqueClients = [
    ...new Map(
      allRequests.map((r) => [r.client.id, r.client.companyName]),
    ).entries(),
  ];
  const uniqueEmployees = [
    ...new Map(
      allRequests.map((r) => [
        r.employee.id,
        `${r.employee.firstName} ${r.employee.lastName}`,
      ]),
    ).entries(),
  ];

  const filtered = allRequests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (clientFilter !== "all" && r.client.id !== clientFilter) return false;
    if (employeeFilter !== "all" && r.employee.id !== employeeFilter)
      return false;
    return true;
  });

  const baseFiltered = allRequests.filter((r) => {
    if (clientFilter !== "all" && r.client.id !== clientFilter) return false;
    if (employeeFilter !== "all" && r.employee.id !== employeeFilter)
      return false;
    return true;
  });

  const typeCounts = {
    BONUS: baseFiltered.filter(
      (r) => r.type === "BONUS" && r.status === "PENDING",
    ).length,
    RAISE: baseFiltered.filter(
      (r) => r.type === "RAISE" && r.status === "PENDING",
    ).length,
    PAY_EDIT: baseFiltered.filter(
      (r) => r.type === "PAY_EDIT" && r.status === "PENDING",
    ).length,
    BILLING_EDIT: baseFiltered.filter(
      (r) => r.type === "BILLING_EDIT" && r.status === "PENDING",
    ).length,
  };

  const typeFiltered = baseFiltered.filter(
    (r) => typeFilter === "all" || r.type === typeFilter,
  );
  const statusCounts = {
    all: typeFiltered.length,
    PENDING: typeFiltered.filter((r) => r.status === "PENDING").length,
    APPROVED: typeFiltered.filter((r) => r.status === "APPROVED").length,
    REJECTED: typeFiltered.filter((r) => r.status === "REJECTED").length,
  };

  const openApproveModal = (request) => {
    setSelectedRequest(request);
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
      const payload = {
        approvalNote:
          confirmationType === "note" ? approvalNote.trim() : undefined,
      };
      if (confirmationType === "proof" && proofFile)
        payload.proofFile = proofFile;
      // For client-submitted raises: auto-calculate new pay rate from raise amount
      if (selectedRequest.type === "RAISE") {
        const raiseAmount = selectedRequest.billRate ?? 0;
        const autoNewPayRate =
          (selectedRequest.currentPayRate ?? 0) + raiseAmount;
        payload.newPayRate = autoNewPayRate;
      }
      const response = await adminPortalService.approveRaiseRequest(
        selectedRequest.id,
        payload,
      );
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
      const response = await adminPortalService.rejectRaiseRequest(
        selectedRequest.id,
        adminNotes,
      );
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

  // ── Give Bonus helpers ──────────────────────────────────────────────────

  const openGiveBonusModal = async () => {
    setGiveBonusStep(1);
    setPendingBonusId(null);
    setGiveBonusError("");
    setGiveBonusForm({
      employeeId: "",
      clientId: "",
      amount: "",
      reason: "",
      effectiveDate: new Date().toISOString().split("T")[0],
      coverageType: "FULL",
      clientCoveredAmount: "",
      internalNotes: "",
    });
    setShowGiveBonusModal(true);
    setCandidatesLoading(true);
    try {
      const res = await adminPortalService.getRaiseCandidates();
      if (res.success) setRaiseCandidates(res.data || []);
    } catch (e) {
      setGiveBonusError("Failed to load employee list.");
    } finally {
      setCandidatesLoading(false);
    }
  };

  // Step 1: create pending bonus → move to step 2
  const handleGiveBonusSubmit = async () => {
    setGiveBonusError("");
    const {
      employeeId,
      clientId,
      amount,
      effectiveDate,
      coverageType,
      clientCoveredAmount,
    } = giveBonusForm;
    if (!employeeId) return setGiveBonusError("Please select an employee.");
    if (!clientId) return setGiveBonusError("Please select a client.");
    if (!amount || parseFloat(amount) <= 0)
      return setGiveBonusError("Please enter a valid bonus amount.");
    if (!effectiveDate)
      return setGiveBonusError("Please select an effective payroll date.");
    if (coverageType === "PARTIAL") {
      const covered = parseFloat(clientCoveredAmount);
      if (
        !clientCoveredAmount ||
        isNaN(covered) ||
        covered <= 0 ||
        covered >= parseFloat(amount)
      ) {
        return setGiveBonusError(
          "Client-covered amount must be between 0 and the total bonus amount.",
        );
      }
    }
    try {
      setGiveBonusLoading(true);
      const res = await adminPortalService.giveBonus({
        employeeId,
        clientId,
        amount: parseFloat(amount),
        reason: giveBonusForm.reason?.trim() || undefined,
        effectiveDate,
        coverageType,
        clientCoveredAmount:
          coverageType === "FULL"
            ? parseFloat(amount)
            : coverageType === "NONE"
              ? 0
              : parseFloat(clientCoveredAmount),
        internalNotes: giveBonusForm.internalNotes?.trim() || undefined,
      });
      if (res.success) {
        setPendingBonusId(res.data.bonusRequest.id);
        setGiveBonusStep(2);
      } else {
        setGiveBonusError(res.error || "Failed to create bonus request.");
      }
    } catch (e) {
      setGiveBonusError(e.message || "Failed to create bonus request.");
    } finally {
      setGiveBonusLoading(false);
    }
  };

  // Step 2: confirm bonus → activate
  const handleConfirmBonus = async () => {
    if (!pendingBonusId) return;
    setGiveBonusLoading(true);
    setGiveBonusError("");
    try {
      const res = await adminPortalService.confirmAdminBonus(pendingBonusId);
      if (res.success) {
        setShowGiveBonusModal(false);
        setSuccessMessage(res.message || "Bonus applied successfully.");
        setTimeout(() => setSuccessMessage(""), 4000);
        fetchRequests();
      } else {
        setGiveBonusError(res.error || "Failed to confirm bonus.");
      }
    } catch (e) {
      setGiveBonusError(e.message || "Failed to confirm bonus.");
    } finally {
      setGiveBonusLoading(false);
    }
  };

  const handleCancelPendingBonus = async () => {
    if (pendingBonusId) {
      try {
        await adminPortalService.rejectRaiseRequest(
          pendingBonusId,
          "Cancelled before confirmation",
        );
      } catch (_) {
        /* ignore */
      }
    }
    setGiveBonusStep(1);
    setPendingBonusId(null);
    setGiveBonusError("");
  };

  // ── Give Raise helpers ──────────────────────────────────────────────────

  const openGiveRaiseModal = async () => {
    setGiveRaiseStep(1);
    setPendingRaiseId(null);
    setGiveRaiseError("");
    setGiveRaiseForm({
      employeeId: "",
      clientId: "",
      coverageType: "FULL",
      employeeRaiseAmount: "",
      clientCoveredAmount: "",
      effectiveDate: new Date().toISOString().split("T")[0],
      reason: "",
      internalNotes: "",
    });
    setShowGiveRaiseModal(true);
    setCandidatesLoading(true);
    try {
      const res = await adminPortalService.getRaiseCandidates();
      if (res.success) setRaiseCandidates(res.data || []);
    } catch (e) {
      setGiveRaiseError("Failed to load employee list.");
    } finally {
      setCandidatesLoading(false);
    }
  };

  // Employees deduped from candidates
  const uniqueCandidateEmployees = [
    ...new Map(
      raiseCandidates.map((c) => [
        c.employeeId,
        { id: c.employeeId, name: c.employeeName, payRate: c.currentPayRate },
      ]),
    ).entries(),
  ].map(([, v]) => v);

  // Clients for the selected employee
  const candidateClientsForEmployee = raiseCandidates.filter(
    (c) => c.employeeId === giveRaiseForm.employeeId,
  );

  const selectedCandidate =
    raiseCandidates.find((c) =>
      c.employeeId === giveRaiseForm.clientId
        ? false
        : c.employeeId === giveRaiseForm.employeeId &&
          c.clientId === giveRaiseForm.clientId,
    ) ||
    raiseCandidates.find(
      (c) =>
        c.employeeId === giveRaiseForm.employeeId &&
        c.clientId === giveRaiseForm.clientId,
    );

  const raiseAmt = parseFloat(giveRaiseForm.employeeRaiseAmount) || 0;
  const coveredAmt =
    giveRaiseForm.coverageType === "FULL"
      ? raiseAmt
      : giveRaiseForm.coverageType === "NONE"
        ? 0
        : parseFloat(giveRaiseForm.clientCoveredAmount) || 0;

  const handleGiveRaiseFormChange = (field, value) => {
    setGiveRaiseForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "employeeId") {
        const clients = raiseCandidates.filter((c) => c.employeeId === value);
        updated.clientId = clients.length === 1 ? clients[0].clientId : "";
      }
      return updated;
    });
    setGiveRaiseError("");
  };

  // Step 1: submit form → create pending raise
  const handleGiveRaiseSubmit = async () => {
    const {
      employeeId,
      clientId,
      coverageType,
      employeeRaiseAmount,
      clientCoveredAmount,
      effectiveDate,
    } = giveRaiseForm;
    if (!employeeId || !clientId) {
      setGiveRaiseError("Please select an employee and client.");
      return;
    }
    if (!employeeRaiseAmount || parseFloat(employeeRaiseAmount) <= 0) {
      setGiveRaiseError("Enter a valid raise amount.");
      return;
    }
    if (coverageType === "PARTIAL") {
      const covered = parseFloat(clientCoveredAmount);
      if (
        !covered ||
        covered <= 0 ||
        covered >= parseFloat(employeeRaiseAmount)
      ) {
        setGiveRaiseError(
          "Client covered amount must be between $0 and the employee raise amount.",
        );
        return;
      }
    }
    if (!effectiveDate) {
      setGiveRaiseError("Please select an effective date.");
      return;
    }

    setGiveRaiseLoading(true);
    setGiveRaiseError("");
    try {
      const res = await adminPortalService.giveRaise({
        employeeId,
        clientId,
        coverageType,
        employeeRaiseAmount: parseFloat(employeeRaiseAmount),
        clientCoveredAmount:
          coverageType === "FULL"
            ? parseFloat(employeeRaiseAmount)
            : coverageType === "NONE"
              ? 0
              : parseFloat(clientCoveredAmount),
        effectiveDate,
        reason: giveRaiseForm.reason?.trim() || undefined,
        internalNotes: giveRaiseForm.internalNotes?.trim() || undefined,
      });
      if (res.success) {
        setPendingRaiseId(res.data.raiseRequest.id);
        setGiveRaiseStep(2);
      } else {
        setGiveRaiseError(res.error || "Failed to create raise.");
      }
    } catch (e) {
      setGiveRaiseError(e.message || "Failed to create raise.");
    } finally {
      setGiveRaiseLoading(false);
    }
  };

  // Step 2: confirm raise → activate
  const handleConfirmRaise = async () => {
    if (!pendingRaiseId) return;
    setGiveRaiseLoading(true);
    setGiveRaiseError("");
    try {
      const res = await adminPortalService.confirmAdminRaise(pendingRaiseId);
      if (res.success) {
        setShowGiveRaiseModal(false);
        setSuccessMessage(res.message || "Raise applied successfully.");
        setTimeout(() => setSuccessMessage(""), 4000);
        fetchRequests();
      } else {
        setGiveRaiseError(res.error || "Failed to confirm raise.");
      }
    } catch (e) {
      setGiveRaiseError(e.message || "Failed to confirm raise.");
    } finally {
      setGiveRaiseLoading(false);
    }
  };

  // Cancel pending raise (step 2 back) — reject the pending record
  const handleCancelPendingRaise = async () => {
    if (pendingRaiseId) {
      try {
        await adminPortalService.rejectRaiseRequest(
          pendingRaiseId,
          "Cancelled before confirmation",
        );
      } catch (_) {
        /* ignore */
      }
    }
    setGiveRaiseStep(1);
    setPendingRaiseId(null);
    setGiveRaiseError("");
  };

  // ── Table helpers ───────────────────────────────────────────────────────

  const getStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    const map = {
      BONUS: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <Gift className="w-3 h-3" />
          Bonus
        </span>
      ),
      RAISE: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          <TrendingUp className="w-3 h-3" />
          Raise
        </span>
      ),
      PAY_EDIT: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          <TrendingUp className="w-3 h-3" />
          Pay Edit
        </span>
      ),
      BILLING_EDIT: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
          <TrendingUp className="w-3 h-3" />
          Bill Edit
        </span>
      ),
    };
    return (
      map[type] || (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          {type}
        </span>
      )
    );
  };

  const getCoverageBadge = (coverageType) => {
    if (!coverageType) return null;
    const map = {
      FULL: "bg-green-100 text-green-700",
      PARTIAL: "bg-yellow-100 text-yellow-700",
      NONE: "bg-gray-100 text-gray-600",
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[coverageType] || ""}`}
      >
        {coverageType}
      </span>
    );
  };

  const th =
    "text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3 whitespace-nowrap";

  const BonusTable = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/50 border-b border-gray-200">
          <th className={`text-left ${th} px-4`}>Employee</th>
          <th className={`text-left ${th}`}>Client</th>
          <th className={`text-center ${th}`}>Bonus Amount ($)</th>
          <th className={`text-left ${th}`}>Reason</th>
          <th className={`text-center ${th}`}>Created At</th>
          <th className={`text-center ${th}`}>Status</th>
          <th className={`text-right ${th} px-4`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((rr) => (
          <tr
            key={rr.id}
            className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
          >
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={`${rr.employee.firstName} ${rr.employee.lastName}`}
                  src={rr.employee.profilePhoto}
                  size="sm"
                />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  {rr.employee.firstName} {rr.employee.lastName}
                </p>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">
              {rr.client.companyName}
            </td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-amber-700">
              {rr.amount?.toFixed(2)}
            </td>
            <td className="py-3 px-3 text-sm text-gray-500 max-w-[200px] truncate">
              {rr.reason || "—"}
            </td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {new Date(rr.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </td>
            <td className="py-3 px-3 text-center">
              {getStatusBadge(rr.status)}
            </td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const RaiseTable = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/50 border-b border-gray-200">
          <th className={`text-left ${th} px-4`}>Employee</th>
          <th className={`text-left ${th}`}>Client</th>
          <th className={`text-center ${th}`}>Coverage</th>
          <th className={`text-center ${th}`}>Raise/hr ($)</th>
          <th className={`text-center ${th}`}>Current Pay ($)</th>
          <th className={`text-center ${th}`}>New Pay ($)</th>
          <th className={`text-center ${th}`}>Current Bill ($)</th>
          <th className={`text-center ${th}`}>New Bill ($)</th>
          <th className={`text-center ${th}`}>Effective</th>
          <th className={`text-center ${th}`}>Status</th>
          <th className={`text-right ${th} px-4`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((rr) => (
          <tr
            key={rr.id}
            className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
          >
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={`${rr.employee.firstName} ${rr.employee.lastName}`}
                  src={rr.employee.profilePhoto}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                    {rr.employee.firstName} {rr.employee.lastName}
                  </p>
                  {rr.raisedBy === "ADMIN" && (
                    <span className="text-[10px] text-primary-600 font-medium">
                      Admin raise
                    </span>
                  )}
                </div>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">
              {rr.client.companyName}
            </td>
            <td className="py-3 px-3 text-center">
              {getCoverageBadge(rr.coverageType)}
            </td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-green-700">
              {rr.employeeRaiseAmount !== null
                ? `+${rr.employeeRaiseAmount.toFixed(2)}`
                : "—"}
            </td>
            <td className="py-3 px-3 text-center text-sm text-gray-500">
              {rr.currentPayRate !== null && rr.currentPayRate !== undefined
                ? rr.currentPayRate.toFixed(2)
                : "—"}
            </td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-blue-700">
              {rr.payRate?.toFixed(2)}
            </td>
            <td className="py-3 px-3 text-center text-sm text-gray-500">
              {rr.currentBillRate !== null && rr.currentBillRate !== undefined
                ? rr.currentBillRate.toFixed(2)
                : "—"}
            </td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-primary-700">
              {rr.billRate?.toFixed(2)}
            </td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {rr.effectiveDate
                ? new Date(rr.effectiveDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </td>
            <td className="py-3 px-3 text-center">
              {getStatusBadge(rr.status)}
            </td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const DirectEditTable = () => (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/50 border-b border-gray-200">
          <th className={`text-left ${th} px-4`}>Employee</th>
          <th className={`text-left ${th}`}>Client</th>
          <th className={`text-center ${th}`}>Type</th>
          <th className={`text-center ${th}`}>New Rate ($)</th>
          <th className={`text-left ${th}`}>Reason</th>
          <th className={`text-center ${th}`}>Effective</th>
          <th className={`text-center ${th}`}>Created At</th>
          <th className={`text-center ${th}`}>Status</th>
          <th className={`text-right ${th} px-4`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((rr) => (
          <tr
            key={rr.id}
            className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
          >
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={`${rr.employee.firstName} ${rr.employee.lastName}`}
                  src={rr.employee.profilePhoto}
                  size="sm"
                />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  {rr.employee.firstName} {rr.employee.lastName}
                </p>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">
              {rr.client.companyName}
            </td>
            <td className="py-3 px-3 text-center">{getTypeBadge(rr.type)}</td>
            <td className="py-3 px-3 text-center text-sm font-semibold text-gray-900">
              {rr.type === "PAY_EDIT"
                ? rr.payRate?.toFixed(2)
                : rr.billRate?.toFixed(2)}
            </td>
            <td className="py-3 px-3 text-sm text-gray-500 max-w-[200px] truncate">
              {rr.reason || "—"}
            </td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {rr.effectiveDate
                ? new Date(rr.effectiveDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {new Date(rr.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </td>
            <td className="py-3 px-3 text-center">
              {getStatusBadge(rr.status)}
            </td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

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
          <tr
            key={rr.id}
            className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
          >
            <td className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={`${rr.employee.firstName} ${rr.employee.lastName}`}
                  src={rr.employee.profilePhoto}
                  size="sm"
                />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  {rr.employee.firstName} {rr.employee.lastName}
                </p>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">
              {rr.client.companyName}
            </td>
            <td className="py-3 px-3 text-center">{getTypeBadge(rr.type)}</td>
            <td className="py-3 px-3 text-center text-sm whitespace-nowrap">
              {rr.type === "BONUS" ? (
                <span className="font-semibold text-amber-700">
                  {rr.amount?.toFixed(2)}
                </span>
              ) : (
                <span className="font-semibold text-blue-700">
                  {rr.payRate?.toFixed(2)}{" "}
                  <span className="text-gray-300">/</span>{" "}
                  {rr.billRate?.toFixed(2)}
                </span>
              )}
            </td>
            <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
              {rr.type === "RAISE" && rr.effectiveDate
                ? new Date(rr.effectiveDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : new Date(rr.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
            </td>
            <td className="py-3 px-3 text-center">
              {getStatusBadge(rr.status)}
            </td>
            <td className="py-3 px-4 text-right">{renderActions(rr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const openConfirmDirectEditModal = (rr) => {
    setPendingDirectEdit(rr);
    setShowConfirmDirectEdit(true);
  };

  const handleConfirmDirectEdit = async () => {
    if (!pendingDirectEdit) return;
    setActionLoading(pendingDirectEdit.id);
    setShowConfirmDirectEdit(false);
    try {
      const res = await adminPortalService.confirmDirectEdit(
        pendingDirectEdit.id,
      );
      if (res.success) {
        setSuccessMessage(res.message || "Rate updated successfully");
        setTimeout(() => setSuccessMessage(""), 4000);
        fetchRequests();
      } else {
        setError(res.error || "Failed to confirm");
      }
    } catch (e) {
      setError(e.message || "Failed to confirm");
    } finally {
      setActionLoading(null);
      setPendingDirectEdit(null);
    }
  };

  const renderActions = (rr) => {
    if (rr.status !== "PENDING")
      return <span className="text-gray-300 text-sm">—</span>;

    // Direct rate edits: simple Confirm/Cancel
    if (rr.type === "PAY_EDIT" || rr.type === "BILLING_EDIT") {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openConfirmDirectEditModal(rr)}
            disabled={actionLoading === rr.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
          >
            {actionLoading === rr.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Apply
          </button>
          <button
            onClick={() => openRejectModal(rr)}
            disabled={actionLoading === rr.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      );
    }

    // Admin-initiated bonus: show Confirm button
    if (rr.raisedBy === "ADMIN" && rr.type === "BONUS") {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setPendingBonusId(rr.id);
              setGiveBonusStep(2);
              setGiveBonusError("");
              setGiveBonusForm((prev) => ({
                ...prev,
                employeeId: rr.employeeId || rr.employee.id,
                clientId: rr.clientId || rr.client.id,
                coverageType: rr.coverageType || "FULL",
                amount: rr.amount?.toString() || "",
                clientCoveredAmount: rr.clientCoveredAmount?.toString() || "",
                effectiveDate: rr.effectiveDate
                  ? rr.effectiveDate.split("T")[0]
                  : new Date().toISOString().split("T")[0],
                reason: rr.reason || "",
              }));
              setShowGiveBonusModal(true);
            }}
            disabled={actionLoading === rr.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {actionLoading === rr.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Confirm
          </button>
          <button
            onClick={() => openRejectModal(rr)}
            disabled={actionLoading === rr.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      );
    }

    // Admin-initiated raise: show Confirm button
    if (rr.raisedBy === "ADMIN") {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setPendingRaiseId(rr.id);
              setSelectedRequest(rr);
              setGiveRaiseStep(2);
              setGiveRaiseError("");
              setGiveRaiseForm((prev) => ({
                ...prev,
                employeeId: rr.employeeId || rr.employee.id,
                clientId: rr.clientId || rr.client.id,
                coverageType: rr.coverageType || "FULL",
                employeeRaiseAmount: rr.employeeRaiseAmount?.toString() || "",
                clientCoveredAmount: rr.clientCoveredAmount?.toString() || "",
                effectiveDate: rr.effectiveDate
                  ? rr.effectiveDate.split("T")[0]
                  : new Date().toISOString().split("T")[0],
                reason: rr.reason || "",
              }));
              setShowGiveRaiseModal(true);
            }}
            disabled={actionLoading === rr.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
          >
            {actionLoading === rr.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Confirm
          </button>
          <button
            onClick={() => openRejectModal(rr)}
            disabled={actionLoading === rr.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      );
    }

    // Client-submitted request: show Approve / Reject
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => openApproveModal(rr)}
          disabled={actionLoading === rr.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          {actionLoading === rr.id ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
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

  // ── Coverage type description ──────────────────────────────────────────
  const CoverageInfo = ({
    type,
    raiseAmt,
    coveredAmt,
    currentPay,
    currentBill,
  }) => {
    if (!type) return null;
    const newPay = (currentPay || 0) + (raiseAmt || 0);
    const newBill = (currentBill || 0) + (coveredAmt || 0);
    const descriptions = {
      FULL: "Client covers the full raise. Employee pay and client billing both increase.",
      PARTIAL:
        "Client covers part of the raise. Employee pay increases fully; client billing increases partially.",
      NONE: "Admin absorbs the raise. Employee pay increases but client billing stays the same. Client is not notified.",
    };
    return (
      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
        <p className="text-xs text-gray-600">{descriptions[type]}</p>
        {raiseAmt > 0 && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">
                Employee Pay Rate
              </p>
              <p className="text-gray-500">
                ${(currentPay || 0).toFixed(2)} →{" "}
                <span className="font-semibold text-blue-700">
                  ${newPay.toFixed(2)}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">
                Client Bill Rate
              </p>
              {type === "NONE" ? (
                <p className="text-gray-500">
                  No change (
                  <span className="font-semibold">
                    ${(currentBill || 0).toFixed(2)}
                  </span>
                  )
                </p>
              ) : (
                <p className="text-gray-500">
                  ${(currentBill || 0).toFixed(2)} →{" "}
                  <span className="font-semibold text-primary-700">
                    ${newBill.toFixed(2)}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Bonuses & Raises</h2>
        <div className="flex items-center gap-2">
          {typeFilter === "BONUS" && (
            <button
              onClick={openGiveBonusModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Give a Bonus
            </button>
          )}
          {typeFilter === "RAISE" && (
            <button
              onClick={openGiveRaiseModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Give a Raise
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-600 hover:text-red-800 font-medium text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5 text-green-500" />
          {successMessage}
        </div>
      )}

      {/* Type Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            {
              key: "BONUS",
              label: "Bonuses",
              icon: Gift,
              count: typeCounts.BONUS,
            },
            {
              key: "RAISE",
              label: "Raises",
              icon: TrendingUp,
              count: typeCounts.RAISE,
            },
            {
              key: "PAY_EDIT",
              label: "Pay Edits",
              icon: TrendingUp,
              count: typeCounts.PAY_EDIT,
            },
            {
              key: "BILLING_EDIT",
              label: "Bill Edits",
              icon: TrendingUp,
              count: typeCounts.BILLING_EDIT,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors inline-flex items-center gap-1.5
                ${
                  typeFilter === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`
                ml-1 py-0.5 px-2 rounded-full text-xs
                ${
                  typeFilter === tab.key
                    ? "bg-primary-100 text-primary"
                    : "bg-gray-100 text-gray-600"
                }
              `}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filters + Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              <span
                className={`ml-1 text-xs ${statusFilter === s.key ? "text-primary-500" : "text-gray-400"}`}
              >
                {statusCounts[s.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="relative">
            <select
              className="input w-44 appearance-none"
              style={{ padding: "0.5rem 2rem 0.5rem 0.75rem" }}
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">All Clients</option>
              {uniqueClients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="input w-44 appearance-none"
              style={{ padding: "0.5rem 2rem 0.5rem 0.75rem" }}
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="all">All Employees</option>
              {uniqueEmployees.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {(clientFilter !== "all" || employeeFilter !== "all") && (
            <button
              className="text-sm text-primary hover:text-primary-dark font-medium"
              onClick={() => {
                setClientFilter("all");
                setEmployeeFilter("all");
              }}
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
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No requests
            </h3>
            <p className="text-gray-500 text-sm">No matching requests found.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            {typeFilter === "BONUS" ? (
              <BonusTable />
            ) : typeFilter === "RAISE" ? (
              <RaiseTable />
            ) : typeFilter === "PAY_EDIT" || typeFilter === "BILLING_EDIT" ? (
              <DirectEditTable />
            ) : (
              <AllTable />
            )}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((rr) => (
              <div key={rr.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={`${rr.employee.firstName} ${rr.employee.lastName}`}
                      src={rr.employee.profilePhoto}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {rr.employee.firstName} {rr.employee.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rr.client.companyName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getTypeBadge(rr.type)}
                    {getStatusBadge(rr.status)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                  {rr.type === "BONUS" ? (
                    <span>
                      Amount:{" "}
                      <span className="font-semibold text-amber-700">
                        {rr.amount?.toFixed(2)}
                      </span>
                    </span>
                  ) : (
                    <span>
                      Pay:{" "}
                      <span className="font-semibold text-blue-700">
                        {rr.payRate?.toFixed(2)}
                      </span>{" "}
                      / Bill:{" "}
                      <span className="font-semibold text-primary-700">
                        {rr.billRate?.toFixed(2)}
                      </span>
                    </span>
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

      {/* ── Confirm Direct Edit Modal ───────────────────────────────────── */}
      {showConfirmDirectEdit && pendingDirectEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowConfirmDirectEdit(false)}
        >
<div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Confirm Rate Change
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              This will immediately update the employee's rate.
            </p>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee</span>
                <span className="font-medium text-gray-900">
                  {pendingDirectEdit.employee.firstName}{" "}
                  {pendingDirectEdit.employee.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium text-gray-900">
                  {pendingDirectEdit.client.companyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span>
                  {pendingDirectEdit.type === "PAY_EDIT"
                    ? "Pay Rate"
                    : "Billing Rate"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New Rate</span>
                <span className="font-semibold text-gray-900">
                  $
                  {(pendingDirectEdit.type === "PAY_EDIT"
                    ? pendingDirectEdit.payRate
                    : pendingDirectEdit.billRate
                  )?.toFixed(2)}
                  /hr
                </span>
              </div>
              {pendingDirectEdit.effectiveDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Effective</span>
                  <span className="text-gray-900">
                    {new Date(
                      pendingDirectEdit.effectiveDate,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {pendingDirectEdit.reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Reason</span>
                  <span className="text-gray-700 text-right">
                    {pendingDirectEdit.reason}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDirectEdit(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDirectEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors"
              >
                Confirm &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Give a Bonus Modal ───────────────────────────────────────────── */}
      {showGiveBonusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => {
            if (giveBonusStep === 1) setShowGiveBonusModal(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${giveBonusStep >= 1 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-400"}`}
              >
                1
              </div>
              <div
                className={`flex-1 h-0.5 ${giveBonusStep >= 2 ? "bg-amber-500" : "bg-gray-200"}`}
              />
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${giveBonusStep >= 2 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-400"}`}
              >
                2
              </div>
            </div>

            {/* ── Step 1: Form ── */}
            {giveBonusStep === 1 && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Give a Bonus
                </h3>

                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Employee */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Employee
                      </label>
                      <div className="relative">
                        <select
                          className="input w-full appearance-none"
                          value={giveBonusForm.employeeId}
                          onChange={(e) => {
                            const empId = e.target.value;
                            const clients = raiseCandidates.filter((c) => c.employeeId === empId);
                            setGiveBonusForm({
                              ...giveBonusForm,
                              employeeId: empId,
                              clientId: clients.length === 1 ? clients[0].clientId : "",
                            });
                          }}
                        >
                          <option value="">Select employee...</option>
                          {[
                            ...new Map(
                              raiseCandidates.map((c) => [
                                c.employeeId,
                                c.employeeName,
                              ]),
                            ).entries(),
                          ].map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Client */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Client
                      </label>
                      <div className="relative">
                        <select
                          className="input w-full appearance-none"
                          value={giveBonusForm.clientId}
                          onChange={(e) =>
                            setGiveBonusForm({
                              ...giveBonusForm,
                              clientId: e.target.value,
                            })
                          }
                          disabled={!giveBonusForm.employeeId}
                        >
                          <option value="">Select client...</option>
                          {raiseCandidates
                            .filter(
                              (c) => c.employeeId === giveBonusForm.employeeId,
                            )
                            .map((c) => (
                              <option key={c.clientId} value={c.clientId}>
                                {c.clientName}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Bonus Amount */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Bonus Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={giveBonusForm.amount}
                        onChange={(e) =>
                          setGiveBonusForm({
                            ...giveBonusForm,
                            amount: e.target.value,
                          })
                        }
                        placeholder="e.g. 500.00"
                        className="input w-full"
                      />
                    </div>

                    {/* Coverage Type */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Who covers the bonus?
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            key: "FULL",
                            label: "Full",
                            desc: "Client pays all",
                          },
                          {
                            key: "PARTIAL",
                            label: "Partial",
                            desc: "Client pays part",
                          },
                          { key: "NONE", label: "None", desc: "Admin absorbs" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() =>
                              setGiveBonusForm({
                                ...giveBonusForm,
                                coverageType: opt.key,
                              })
                            }
                            className={`p-2.5 rounded-lg border-2 text-left transition-colors ${
                              giveBonusForm.coverageType === opt.key
                                ? "border-amber-500 bg-amber-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <p
                              className={`text-sm font-semibold ${giveBonusForm.coverageType === opt.key ? "text-amber-700" : "text-gray-700"}`}
                            >
                              {opt.label}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {opt.desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Partial: client covered amount */}
                    {giveBonusForm.coverageType === "PARTIAL" && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Client covers ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={giveBonusForm.clientCoveredAmount}
                          onChange={(e) =>
                            setGiveBonusForm({
                              ...giveBonusForm,
                              clientCoveredAmount: e.target.value,
                            })
                          }
                          placeholder="e.g. 250.00"
                          className="input w-full"
                        />
                      </div>
                    )}

                    {/* Effective Payroll Date */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Effective Payroll Date
                      </label>
                      <input
                        type="date"
                        value={giveBonusForm.effectiveDate}
                        onChange={(e) =>
                          setGiveBonusForm({
                            ...giveBonusForm,
                            effectiveDate: e.target.value,
                          })
                        }
                        className="input w-full"
                      />
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Reason{" "}
                        <span className="text-gray-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        value={giveBonusForm.reason}
                        onChange={(e) =>
                          setGiveBonusForm({
                            ...giveBonusForm,
                            reason: e.target.value,
                          })
                        }
                        placeholder="Performance, milestone, appreciation..."
                        rows={2}
                        className="input w-full resize-none"
                      />
                    </div>

                    {/* Internal Notes */}
                    {/* <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Internal Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea
                        value={giveBonusForm.internalNotes}
                        onChange={(e) => setGiveBonusForm({ ...giveBonusForm, internalNotes: e.target.value })}
                        placeholder="Internal context, not visible to the client..."
                        rows={2}
                        className="input w-full resize-none"
                      />
                    </div> */}

                    {giveBonusError && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {giveBonusError}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    onClick={() => setShowGiveBonusModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGiveBonusSubmit}
                    disabled={giveBonusLoading || candidatesLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                  >
                    {giveBonusLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Review Bonus
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Confirmation ── */}
            {giveBonusStep === 2 &&
              (() => {
                const bonusCandidate = raiseCandidates.find(
                  (c) =>
                    c.employeeId === giveBonusForm.employeeId &&
                    c.clientId === giveBonusForm.clientId,
                );
                const bonusAmt = parseFloat(giveBonusForm.amount) || 0;
                const clientCovered =
                  giveBonusForm.coverageType === "FULL"
                    ? bonusAmt
                    : giveBonusForm.coverageType === "NONE"
                      ? 0
                      : parseFloat(giveBonusForm.clientCoveredAmount) || 0;
                const adminAbsorbed = bonusAmt - clientCovered;
                return (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Confirm Bonus
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Review the details before applying this bonus.
                    </p>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Employee</span>
                        <span className="font-medium text-gray-900">
                          {bonusCandidate?.employeeName ||
                            giveBonusForm.employeeId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Client</span>
                        <span className="font-medium text-gray-900">
                          {bonusCandidate?.clientName || giveBonusForm.clientId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bonus Amount</span>
                        <span className="font-semibold text-amber-700">
                          ${bonusAmt.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Coverage</span>
                        {getCoverageBadge(giveBonusForm.coverageType)}
                      </div>
                      {giveBonusForm.coverageType === "PARTIAL" && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Client covers</span>
                            <span className="font-medium text-gray-900">
                              ${clientCovered.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Admin absorbs</span>
                            <span className="font-medium text-gray-900">
                              ${adminAbsorbed.toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Effective Date</span>
                        <span className="text-gray-900">
                          {new Date(
                            giveBonusForm.effectiveDate,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      {giveBonusForm.reason && (
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500 shrink-0">Reason</span>
                          <span className="text-gray-700 text-right">
                            {giveBonusForm.reason}
                          </span>
                        </div>
                      )}
                    </div>

                    {giveBonusForm.coverageType !== "NONE" ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 mb-4">
                        Client will be notified of this bonus.
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 mb-4">
                        Client will not be notified (admin absorbs full amount).
                      </div>
                    )}

                    {giveBonusError && (
                      <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {giveBonusError}
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={handleCancelPendingBonus}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirmBonus}
                        disabled={giveBonusLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                      >
                        {giveBonusLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Gift className="w-4 h-4" />
                        )}
                        Confirm &amp; Apply Bonus
                      </button>
                    </div>
                  </>
                );
              })()}
          </div>
        </div>
      )}

      {/* ── Give a Raise Modal ───────────────────────────────────────────── */}
      {showGiveRaiseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowGiveRaiseModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${giveRaiseStep >= 1 ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}
              >
                1
              </div>
              <div
                className={`flex-1 h-0.5 ${giveRaiseStep >= 2 ? "bg-primary" : "bg-gray-200"}`}
              />
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${giveRaiseStep >= 2 ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}
              >
                2
              </div>
            </div>

            {/* ── Step 1: Form ── */}
            {giveRaiseStep === 1 && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Give a Raise
                </h3>

                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Employee */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Employee
                      </label>
                      <div className="relative">
                        <select
                          className="input w-full appearance-none"
                          value={giveRaiseForm.employeeId}
                          onChange={(e) =>
                            handleGiveRaiseFormChange(
                              "employeeId",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Select employee...</option>
                          {uniqueCandidateEmployees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Client */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Client
                      </label>
                      <div className="relative">
                        <select
                          className="input w-full appearance-none"
                          value={giveRaiseForm.clientId}
                          onChange={(e) =>
                            handleGiveRaiseFormChange(
                              "clientId",
                              e.target.value,
                            )
                          }
                          disabled={!giveRaiseForm.employeeId}
                        >
                          <option value="">Select client...</option>
                          {candidateClientsForEmployee.map((c) => (
                            <option key={c.clientId} value={c.clientId}>
                              {c.clientName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Coverage type */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Who covers the raise?
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            key: "FULL",
                            label: "Full",
                            desc: "Client pays all",
                          },
                          {
                            key: "PARTIAL",
                            label: "Partial",
                            desc: "Client pays part",
                          },
                          { key: "NONE", label: "None", desc: "Admin absorbs" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() =>
                              handleGiveRaiseFormChange("coverageType", opt.key)
                            }
                            className={`p-2.5 rounded-lg border-2 text-left transition-colors ${
                              giveRaiseForm.coverageType === opt.key
                                ? "border-primary bg-primary-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <p
                              className={`text-sm font-semibold ${giveRaiseForm.coverageType === opt.key ? "text-primary-700" : "text-gray-700"}`}
                            >
                              {opt.label}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {opt.desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Raise amounts */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Raise Amount($/hr)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={giveRaiseForm.employeeRaiseAmount}
                          onChange={(e) =>
                            handleGiveRaiseFormChange(
                              "employeeRaiseAmount",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. 2.00"
                          className="input w-full"
                        />
                        {(() => {
                          const currentRate = selectedCandidate?.currentPayRate != null ? Number(selectedCandidate.currentPayRate) : null;
                          const raise = parseFloat(giveRaiseForm.employeeRaiseAmount) || 0;
                          if (currentRate === null && raise === 0) return null;
                          const newRate = (currentRate ?? 0) + raise;
                          return (
                            <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 whitespace-nowrap">
                              {raise > 0
                                ? `Current Rate: $${(currentRate ?? 0).toFixed(2)}/hr + Raise: $${raise.toFixed(2)}/hr = New Rate: $${newRate.toFixed(2)}/hr`
                                : `Current Rate: $${(currentRate ?? 0).toFixed(2)}/hr`}
                            </div>
                          );
                        })()}
                      </div>
                      {giveRaiseForm.coverageType === "PARTIAL" && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">
                            Client covers ($/hr)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={giveRaiseForm.clientCoveredAmount}
                            onChange={(e) =>
                              handleGiveRaiseFormChange(
                                "clientCoveredAmount",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. 1.00"
                            className="input w-full"
                          />
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    {selectedCandidate && raiseAmt > 0 && (
                      <CoverageInfo
                        type={giveRaiseForm.coverageType}
                        raiseAmt={raiseAmt}
                        coveredAmt={coveredAmt}
                        currentPay={selectedCandidate.currentPayRate}
                        currentBill={selectedCandidate.currentBillRate}
                      />
                    )}

                    {/* Effective date */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Effective Date
                      </label>
                      <input
                        type="date"
                        value={giveRaiseForm.effectiveDate}
                        onChange={(e) =>
                          handleGiveRaiseFormChange(
                            "effectiveDate",
                            e.target.value,
                          )
                        }
                        className="input w-full"
                      />
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Reason{" "}
                        <span className="text-gray-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        value={giveRaiseForm.reason}
                        onChange={(e) =>
                          handleGiveRaiseFormChange("reason", e.target.value)
                        }
                        placeholder="Performance review, market adjustment..."
                        rows={2}
                        className="input w-full resize-none"
                      />
                    </div>

                    {/* Internal Notes */}
                    {/* <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Internal Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea
                        value={giveRaiseForm.internalNotes}
                        onChange={(e) => handleGiveRaiseFormChange("internalNotes", e.target.value)}
                        placeholder="Internal context, not visible to the client..."
                        rows={2}
                        className="input w-full resize-none"
                      />
                    </div> */}

                    {giveRaiseError && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {giveRaiseError}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    onClick={() => setShowGiveRaiseModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGiveRaiseSubmit}
                    disabled={giveRaiseLoading || candidatesLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                  >
                    {giveRaiseLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Review
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Confirm ── */}
            {giveRaiseStep === 2 && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Confirm Raise
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Review the details below before applying the raise.
                </p>

                {(() => {
                  const candidate =
                    selectedCandidate ||
                    raiseCandidates.find(
                      (c) =>
                        c.employeeId === giveRaiseForm.employeeId &&
                        c.clientId === giveRaiseForm.clientId,
                    );
                  const empName =
                    candidate?.employeeName || selectedRequest?.employee
                      ? `${selectedRequest?.employee?.firstName} ${selectedRequest?.employee?.lastName}`
                      : "—";
                  const clientName =
                    candidate?.clientName ||
                    selectedRequest?.client?.companyName ||
                    "—";
                  const coverage =
                    giveRaiseForm.coverageType ||
                    selectedRequest?.coverageType ||
                    "—";
                  const raiseAmtVal =
                    parseFloat(giveRaiseForm.employeeRaiseAmount) ||
                    selectedRequest?.employeeRaiseAmount ||
                    0;
                  const coveredAmtVal =
                    coverage === "FULL"
                      ? raiseAmtVal
                      : coverage === "NONE"
                        ? 0
                        : parseFloat(giveRaiseForm.clientCoveredAmount) ||
                          selectedRequest?.clientCoveredAmount ||
                          0;
                  const currentPay =
                    candidate?.currentPayRate ??
                    selectedRequest?.currentPayRate ??
                    0;
                  const currentBill =
                    candidate?.currentBillRate ??
                    selectedRequest?.currentBillRate ??
                    0;
                  const effDate =
                    giveRaiseForm.effectiveDate ||
                    selectedRequest?.effectiveDate?.split("T")[0] ||
                    "—";

                  return (
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Employee</span>
                          <span className="font-semibold text-gray-900">
                            {empName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Client</span>
                          <span className="font-semibold text-gray-900">
                            {clientName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Coverage</span>
                          {getCoverageBadge(coverage)}
                        </div>
                        <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-400 text-xs mb-1">
                              Pay Rate
                            </p>
                            <p className="text-gray-500">
                              ${currentPay.toFixed(2)} →{" "}
                              <span className="font-bold text-blue-700">
                                ${(currentPay + raiseAmtVal).toFixed(2)}
                              </span>
                            </p>
                            <p className="text-xs text-green-600 mt-0.5">
                              +${raiseAmtVal.toFixed(2)}/hr
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">
                              Bill Rate
                            </p>
                            {coverage === "NONE" ? (
                              <p className="text-gray-500">No change</p>
                            ) : (
                              <>
                                <p className="text-gray-500">
                                  ${currentBill.toFixed(2)} →{" "}
                                  <span className="font-bold text-primary-700">
                                    ${(currentBill + coveredAmtVal).toFixed(2)}
                                  </span>
                                </p>
                                <p className="text-xs text-green-600 mt-0.5">
                                  +${coveredAmtVal.toFixed(2)}/hr
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-3">
                          <span className="text-gray-500">Effective Date</span>
                          <span className="font-medium text-gray-900">
                            {effDate}
                          </span>
                        </div>
                        {coverage !== "NONE" && (
                          <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            Client will be notified of the billing rate change.
                          </div>
                        )}
                        {coverage === "NONE" && (
                          <div className="flex items-start gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            Client will not be notified (billing rate
                            unchanged).
                          </div>
                        )}
                      </div>

                      {giveRaiseError && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {giveRaiseError}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex justify-between gap-3 mt-5">
                  <button
                    onClick={handleCancelPendingRaise}
                    disabled={giveRaiseLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmRaise}
                    disabled={giveRaiseLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                  >
                    {giveRaiseLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Apply Raise
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Approve Modal (for client-submitted requests) */}
      {showApproveModal &&
        selectedRequest &&
        (() => {
          const isRaise = selectedRequest.type === "RAISE";
          // For client-submitted raises, billRate stores the raise AMOUNT (e.g. $2), not the final rate
          const raiseAmount = isRaise ? (selectedRequest.billRate ?? 0) : 0;
          const autoNewPayRate =
            (selectedRequest.currentPayRate ?? 0) + raiseAmount;
          const autoNewBillRate =
            (selectedRequest.currentBillRate ?? 0) + raiseAmount;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
              onClick={() => setShowApproveModal(false)}
            >
              <div
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Approve {isRaise ? "Raise" : "Bonus"}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isRaise ? (
                    <>
                      Approve pay raise of{" "}
                      <span className="font-semibold text-green-700">
                        +${raiseAmount.toFixed(2)}/hr
                      </span>{" "}
                      for{" "}
                      <span className="font-semibold">
                        {selectedRequest.employee.firstName}{" "}
                        {selectedRequest.employee.lastName}
                      </span>{" "}
                      from {selectedRequest.client.companyName}?
                    </>
                  ) : (
                    <>
                      Approve{" "}
                      <span className="font-semibold text-amber-700">
                        ${selectedRequest.amount?.toFixed(2)}
                      </span>{" "}
                      bonus for{" "}
                      <span className="font-semibold">
                        {selectedRequest.employee.firstName}{" "}
                        {selectedRequest.employee.lastName}
                      </span>{" "}
                      from {selectedRequest.client.companyName}?
                    </>
                  )}
                </p>

                {/* Raise rate breakdown */}
                {isRaise && (
                  <div className="mb-4 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-200">
                      <span className="text-gray-500">
                        Current employee pay rate
                      </span>
                      <span className="font-medium text-gray-700">
                        ${(selectedRequest.currentPayRate ?? 0).toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-200">
                      <span className="text-gray-500">Raise amount</span>
                      <span className="font-medium text-green-700">
                        +${raiseAmount.toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-blue-50 border-b border-blue-100">
                      <span className="font-semibold text-gray-700">
                        New employee pay rate
                      </span>
                      <span className="font-bold text-blue-700">
                        ${autoNewPayRate.toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-200">
                      <span className="text-gray-500">
                        Current client billing rate
                      </span>
                      <span className="font-medium text-gray-700">
                        ${(selectedRequest.currentBillRate ?? 0).toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-primary-50">
                      <span className="font-semibold text-gray-700">
                        New client billing rate
                      </span>
                      <span className="font-bold text-primary-700">
                        ${autoNewBillRate.toFixed(2)}/hr
                      </span>
                    </div>
                  </div>
                )}

                {isRaise ? null : (
                  <p className="text-xs text-gray-400 mb-4">
                    This will add a bonus to the employee's payroll.
                  </p>
                )}

                {/* Confirmation method */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700">
                    Confirm employee was notified{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <div
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${confirmationType === "proof" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                    onClick={() => {
                      setConfirmationType("proof");
                      setApproveError("");
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="confirmationType"
                        checked={confirmationType === "proof"}
                        onChange={() => {
                          setConfirmationType("proof");
                          setApproveError("");
                        }}
                        className="accent-green-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Upload proof of employee notification
                      </span>
                    </div>
                    {confirmationType === "proof" && (
                      <div className="mt-2 ml-5">
                        <input
                          ref={proofInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            setProofFile(e.target.files[0] || null);
                            setApproveError("");
                          }}
                        />
                        {proofFile ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-green-200 rounded-lg">
                            <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm text-green-700 flex-1 truncate">
                              {proofFile.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setProofFile(null);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              proofInputRef.current?.click();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-white transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Click to upload screenshot or document
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${confirmationType === "note" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                    onClick={() => {
                      setConfirmationType("note");
                      setApproveError("");
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="confirmationType"
                        checked={confirmationType === "note"}
                        onChange={() => {
                          setConfirmationType("note");
                          setApproveError("");
                        }}
                        className="accent-green-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Write confirmation note
                      </span>
                    </div>
                    {confirmationType === "note" && (
                      <div
                        className="mt-2 ml-5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          value={approvalNote}
                          onChange={(e) => {
                            setApprovalNote(e.target.value);
                            setApproveError("");
                          }}
                          placeholder="Confirm that the employee was notified of the bonus and reminded to thank the client."
                          rows={3}
                          maxLength={500}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none bg-white"
                        />
                        <p
                          className={`text-xs mt-1 text-right ${approvalNote.length >= 500 ? "text-red-500" : "text-gray-400"}`}
                        >
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

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading === selectedRequest.id}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                  >
                    {actionLoading === selectedRequest.id && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Approve
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedRequest.raisedBy === "ADMIN" ? "Cancel" : "Reject"}{" "}
              {selectedRequest.type === "BONUS" ? "Bonus" : "Raise"} Request
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedRequest.raisedBy === "ADMIN" ? "Cancel" : "Reject"} for{" "}
              <span className="font-semibold">
                {selectedRequest.employee.firstName}{" "}
                {selectedRequest.employee.lastName}
              </span>{" "}
              from {selectedRequest.client.companyName}.
            </p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Reason (optional)..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === selectedRequest.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {actionLoading === selectedRequest.id && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {selectedRequest.raisedBy === "ADMIN"
                  ? "Cancel Raise"
                  : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaiseRequests;
