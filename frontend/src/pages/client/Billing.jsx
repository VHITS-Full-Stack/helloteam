import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Download,
  FileText,
  DollarSign,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Card, Button, Badge, ExportButton } from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";
import { formatDate, formatHours } from "../../utils/formatDateTime";

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [invoiceTab, setInvoiceTab] = useState("pending");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [payConfirmInvoice, setPayConfirmInvoice] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: "credit_card",
    ccCardholderName: "",
    ccBillingAddress: "",
    ccCity: "",
    ccState: "",
    ccZip: "",
    ccCardType: "",
    ccCardNumber: "",
    ccExpiration: "",
    ccCVV: "",
    achAccountHolder: "",
    achBankName: "",
    achRoutingNumber: "",
    achAccountNumber: "",
    achAccountType: "Checking",
  });

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientPortalService.getBilling();
      if (response.success) {
        setBillingData(response.data);
      } else {
        setError(response.error || "Failed to load billing data");
      }
    } catch (err) {
      console.error("Error fetching billing:", err);
      setError("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const [payingId, setPayingId] = useState(null);

  const handlePayInvoice = async (invoiceId) => {
    setPayingId(invoiceId);
    setError(null);
    setPaymentResult(null);
    try {
      const response = await clientPortalService.payInvoice(invoiceId);
      if (response.success) {
        setPaymentResult({ success: true, data: response.data });
        setPayConfirmInvoice(null);
        fetchBilling();
      } else {
        setPaymentResult({ success: false, error: response.error || "Payment was declined" });
      }
    } catch (err) {
      setPaymentResult({ success: false, error: err.error || err.message || "Payment failed. Please try again." });
    } finally {
      setPayingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
            Paid
          </span>
        );
      case "CLIENT_PAID":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
            Paid
          </span>
        );
      case "SENT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
            Sent
          </span>
        );
      case "OVERDUE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
            Overdue
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
            Declined
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
            Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const handleExportStatement = () => {
    if (!billingData?.invoices) return;
    const headers = [
      "Invoice #",
      "Period",
      "Hours",
      "Overtime Hours",
      "Amount",
      "Due Date",
      "Status",
    ];
    const rows = billingData.invoices.map((inv) => [
      inv.invoiceNumber,
      formatDate(inv.periodStart),
      Number(inv.totalHours || 0).toFixed(1),
      Number(inv.overtimeHours || 0).toFixed(1),
      formatCurrency(inv.total, inv.currency),
      formatDate(inv.dueDate),
      inv.status,
    ]);
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-statement-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (invoiceId, invoiceNumber) => {
    setDownloadingId(invoiceId);
    try {
      await clientPortalService.downloadInvoicePdf(invoiceId, invoiceNumber);
    } catch (err) {
      setError(err.error || "Failed to download PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPeriod = billingData?.currentPeriod || {
    period: "Loading...",
    hoursWorked: 0,
    estimatedAmount: 0,
    daysRemaining: 0,
    employees: 0,
    hourlyRate: 0,
  };

  const billingStats = billingData?.stats || {
    ytdTotal: 0,
    avgMonthly: 0,
    totalHours: 0,
  };
  const invoices = billingData?.invoices || [];
  const billingInfo = billingData?.billingInfo || {};
  const paymentMethod = billingData?.paymentMethod || null;

  // Calculate breakdown for upcoming invoice
  const regularHours = Math.max(0, currentPeriod.hoursWorked);
  const regularAmount = regularHours * (currentPeriod.hourlyRate || 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Billing & Invoices</h2>
        <ExportButton onClick={handleExportStatement} />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button
            onClick={fetchBilling}
            className="text-sm text-red-500 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Row: Payment Method + Upcoming Invoice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment Method Card */}
        <Card>
          <h3 className="text-base font-bold text-gray-900 mb-4">
            Payment Methods
          </h3>
          <div className="space-y-3">
            {paymentMethod?.creditCard &&
              (paymentMethod.method === "credit_card" ||
                paymentMethod.method === "both") && (
                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {paymentMethod.creditCard.cardType || "Card"} ending in{" "}
                        {paymentMethod.creditCard.lastFour}
                      </p>
                      <p className="text-xs text-gray-400">
                        {paymentMethod.creditCard.expiration
                          ? `Expires ${paymentMethod.creditCard.expiration}`
                          : ""}
                        {paymentMethod.creditCard.expiration &&
                        paymentMethod.method !== "ach"
                          ? " · "
                          : ""}
                        {paymentMethod.method !== "ach"
                          ? "Primary"
                          : "Backup method"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${paymentMethod.method !== "ach" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}
                  >
                    {paymentMethod.method !== "ach" ? "Active" : "Backup"}
                  </span>
                </div>
              )}
            {paymentMethod?.ach &&
              (paymentMethod.method === "ach" ||
                paymentMethod.method === "both") && (
                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        ACH — {paymentMethod.ach.bankName || "Bank"}{" "}
                        {paymentMethod.ach.accountType || "Checking"} ···
                        {paymentMethod.ach.lastFour}
                      </p>
                      <p className="text-xs text-gray-400">
                        {paymentMethod.method !== "credit_card"
                          ? "Primary"
                          : "Backup method"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${paymentMethod.method !== "credit_card" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}
                  >
                    {paymentMethod.method !== "credit_card"
                      ? "Active"
                      : "Backup"}
                  </span>
                </div>
              )}
            {(!paymentMethod ||
              (!paymentMethod.creditCard && !paymentMethod.ach)) && (
              <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      No payment method
                    </p>
                    <p className="text-xs text-gray-400">
                      Contact support to add a payment method
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {!(paymentMethod?.creditCard && paymentMethod?.ach) && (
            <button
              onClick={() => {
                // Auto-select the missing method
                const missing = !paymentMethod?.creditCard
                  ? "credit_card"
                  : "ach";
                setPaymentForm((prev) => ({ ...prev, paymentMethod: missing }));
                setShowPaymentModal(true);
              }}
              className="mt-3 px-4 py-2 text-sm font-medium text-primary border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
            >
              + Add Payment Method
            </button>
          )}
        </Card>

        {/* Upcoming Invoice Card */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-gray-900">
              Current Period
            </h3>
            <span className="text-xs text-gray-400">
              {currentPeriod.period}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {currentPeriod.daysRemaining} days remaining
          </p>

          <p className="text-3xl font-bold text-gray-900 mb-4">
            {formatCurrency(currentPeriod.estimatedAmount)}
          </p>

          <div className="space-y-2.5">
            {currentPeriod.hourlyRate > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Regular Hours ({regularHours}h x ${currentPeriod.hourlyRate}
                  )
                </span>
                <span className="text-sm text-gray-900">
                  {formatCurrency(regularAmount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Active Employees</span>
              <span className="text-sm text-gray-900">
                {currentPeriod.employees}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                Estimated Total
              </span>
              <span className="text-sm font-bold text-primary-600">
                {formatCurrency(currentPeriod.estimatedAmount)}
              </span>
            </div>
          </div>

          {/* YTD stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6">
            <div>
              <p className="text-xs text-gray-400">This Year</p>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(billingStats.ytdTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg/Month</p>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(billingStats.avgMonthly)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Hours</p>
              <p className="text-sm font-bold text-gray-900">
                {billingStats.totalHours.toLocaleString()}h
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Invoice History */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            Invoice History
          </h3>
          <div className="flex gap-1">
            {[
              { key: "all", label: "All", count: invoices.length },
              {
                key: "pending",
                label: "Pending",
                count: invoices.filter((i) =>
                  ["SENT", "OVERDUE"].includes(i.status),
                ).length,
              },
              {
                key: "completed",
                label: "Completed",
                count: invoices.filter((i) =>
                  ["PAID", "CLIENT_PAID"].includes(i.status),
                ).length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setInvoiceTab(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  invoiceTab === tab.key
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1 text-xs ${invoiceTab === tab.key ? "text-primary-500" : "text-gray-400"}`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const filteredInvoices =
            invoiceTab === "pending"
              ? invoices.filter((i) => ["SENT", "OVERDUE"].includes(i.status))
              : invoiceTab === "completed"
                ? invoices.filter((i) =>
                    ["PAID", "CLIENT_PAID"].includes(i.status),
                  )
                : [...invoices].sort((a, b) => {
                    const priority = {
                      SENT: 0,
                      OVERDUE: 0,
                      DRAFT: 1,
                      CLIENT_PAID: 2,
                      PAID: 2,
                      CANCELLED: 3,
                    };
                    return (
                      (priority[a.status] ?? 4) - (priority[b.status] ?? 4)
                    );
                  });

          return filteredInvoices.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id}>
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                    {/* Left: Invoice info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm font-semibold text-primary-600">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(invoice.periodStart)}
                        </p>
                      </div>
                      {invoice.status === "PAID" ||
                      invoice.status === "CLIENT_PAID" ? (
                        getStatusBadge(invoice.status)
                      ) : invoice.status === "CANCELLED" ? (
                        getStatusBadge("CANCELLED")
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Right: Amount + Actions */}
                    <div className="flex items-center gap-4">
                      <p
                        className={`text-sm font-bold ${invoice.status === "CANCELLED" ? "text-red-500" : "text-gray-900"}`}
                      >
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                      <div className="flex items-center gap-2">
                        {(invoice.status === "SENT" ||
                          invoice.status === "OVERDUE") && (
                          <button
                            onClick={() => setPayConfirmInvoice(invoice)}
                            disabled={payingId === invoice.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {payingId === invoice.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <DollarSign className="w-3.5 h-3.5" />
                            )}
                            {payingId === invoice.id
                              ? "Processing..."
                              : "Pay Now"}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleDownloadPdf(invoice.id, invoice.invoiceNumber)
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          disabled={downloadingId === invoice.id}
                        >
                          {downloadingId === invoice.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </>
                          )}
                        </button>
                        {invoice.lineItems && invoice.lineItems.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedInvoice(
                                expandedInvoice === invoice.id
                                  ? null
                                  : invoice.id,
                              )
                            }
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                          >
                            {expandedInvoice === invoice.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded line items */}
                  {expandedInvoice === invoice.id && invoice.lineItems && (
                    <div className="px-5 pb-4">
                      <div className="ml-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">
                                Employee
                              </th>
                              <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">
                                Regular Hours
                              </th>
                              <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">
                                OT
                              </th>
                              <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">
                                Rate
                              </th>
                              <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">
                                OT Rate
                              </th>
                              <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {invoice.lineItems.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 text-sm text-gray-900">
                                  {item.employeeName}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                  {formatHours(Number(item.hours))}
                                </td>
                                <td className="px-3 py-2 text-sm text-right">
                                  {Number(item.overtimeHours) > 0 ? (
                                    <span className="text-orange-600">
                                      {formatHours(Number(item.overtimeHours))}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                  {formatCurrency(item.rate)}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                  {Number(item.overtimeHours) > 0 && Number(item.overtimeRate) > 0
                                    ? formatCurrency(item.overtimeRate)
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                                  {formatCurrency(item.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {invoiceTab === "pending"
                  ? "No pending invoices"
                  : invoiceTab === "completed"
                    ? "No completed invoices"
                    : "No invoices yet"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {invoiceTab === "pending"
                  ? "All invoices have been paid."
                  : invoiceTab === "completed"
                    ? "Paid invoices will appear here."
                    : "Invoice history will appear here once generated."}
              </p>
            </div>
          );
        })()}
      </Card>

      {/* Add Payment Method Modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Add Payment Method
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {paymentMethod?.creditCard && !paymentMethod?.ach
                ? "Add ACH bank transfer as a backup payment method."
                : !paymentMethod?.creditCard && paymentMethod?.ach
                  ? "Add a credit card as a backup payment method."
                  : "Select a payment method and enter the details."}
            </p>

            {/* Payment Type Selection — only show if neither method exists yet */}
            {!paymentMethod?.creditCard && !paymentMethod?.ach && (
              <div className="flex gap-4 mb-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="addPaymentMethod"
                    checked={paymentForm.paymentMethod === "credit_card"}
                    onChange={() =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentMethod: "credit_card",
                      }))
                    }
                    className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Credit Card
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="addPaymentMethod"
                    checked={paymentForm.paymentMethod === "ach"}
                    onChange={() =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentMethod: "ach",
                      }))
                    }
                    className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    ACH Bank Transfer
                  </span>
                </label>
              </div>
            )}

            {/* Credit Card Form */}
            {paymentForm.paymentMethod === "credit_card" && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Credit Card Details
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cardholder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentForm.ccCardholderName}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        ccCardholderName: e.target.value,
                      }))
                    }
                    placeholder="Name as it appears on card"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    value={paymentForm.ccBillingAddress}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        ccBillingAddress: e.target.value,
                      }))
                    }
                    placeholder="Billing address"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={paymentForm.ccCity}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        ccCity: e.target.value,
                      }))
                    }
                    placeholder="City"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <input
                    type="text"
                    value={paymentForm.ccState}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        ccState: e.target.value,
                      }))
                    }
                    placeholder="State"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <input
                    type="text"
                    value={paymentForm.ccZip}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        ccZip: e.target.value,
                      }))
                    }
                    placeholder="Zip"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {["Visa", "MasterCard", "American Express", "Discover"].map(
                      (type) => (
                        <label
                          key={type}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="addCcCardType"
                            value={type}
                            checked={paymentForm.ccCardType === type}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                ccCardType: e.target.value,
                              }))
                            }
                            className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Card Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.ccCardNumber}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          ccCardNumber: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 16),
                        }))
                      }
                      placeholder="Card number"
                      maxLength={16}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiration <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.ccExpiration}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "");
                        if (v.length > 2)
                          v = v.slice(0, 2) + "/" + v.slice(2, 4);
                        setPaymentForm((prev) => ({
                          ...prev,
                          ccExpiration: v,
                        }));
                      }}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CVV <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.ccCVV}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          ccCVV: e.target.value.replace(/\D/g, "").slice(0, 4),
                        }))
                      }
                      placeholder="CVV"
                      maxLength={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ACH Form */}
            {paymentForm.paymentMethod === "ach" && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> ACH Bank Transfer Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.achAccountHolder}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          achAccountHolder: e.target.value,
                        }))
                      }
                      placeholder="Name on bank account"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.achBankName}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          achBankName: e.target.value,
                        }))
                      }
                      placeholder="Bank name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Routing Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={paymentForm.achRoutingNumber}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            achRoutingNumber: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 9),
                          }))
                        }
                        placeholder="9-digit routing number"
                        maxLength={9}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={paymentForm.achAccountNumber}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            achAccountNumber: e.target.value,
                          }))
                        }
                        placeholder="Account number"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      {["Checking", "Savings"].map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="addAchAccountType"
                            value={type}
                            checked={paymentForm.achAccountType === type}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                achAccountType: e.target.value,
                              }))
                            }
                            className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSavingPayment(true);
                  setError(null);
                  try {
                    const response =
                      await clientPortalService.addPaymentMethod(paymentForm);
                    if (response.success) {
                      setShowPaymentModal(false);
                      setPaymentForm({
                        paymentMethod: "credit_card",
                        ccCardholderName: "",
                        ccBillingAddress: "",
                        ccCity: "",
                        ccState: "",
                        ccZip: "",
                        ccCardType: "",
                        ccCardNumber: "",
                        ccExpiration: "",
                        ccCVV: "",
                        achAccountHolder: "",
                        achBankName: "",
                        achRoutingNumber: "",
                        achAccountNumber: "",
                        achAccountType: "Checking",
                      });
                      fetchBilling();
                    } else {
                      setError(
                        response.error || "Failed to add payment method",
                      );
                    }
                  } catch (err) {
                    setError(err.message || "Failed to add payment method");
                  } finally {
                    setSavingPayment(false);
                  }
                }}
                disabled={savingPayment}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {savingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {payConfirmInvoice && !payingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setPayConfirmInvoice(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Confirm Payment
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              You are about to pay invoice{" "}
              <span className="font-semibold text-gray-700">
                {payConfirmInvoice.invoiceNumber}
              </span>
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Period</span>
                <span className="text-gray-900">
                  {formatDate(payConfirmInvoice.periodStart)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(payConfirmInvoice.total, payConfirmInvoice.currency)}
                </span>
              </div>
              {paymentMethod && (
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="text-gray-900">
                    {paymentMethod.method === "ach" && paymentMethod.ach
                      ? `ACH ···${paymentMethod.ach.lastFour}`
                      : paymentMethod.creditCard
                        ? `${paymentMethod.creditCard.cardType || "Card"} ····${paymentMethod.creditCard.lastFour}`
                        : "On file"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPayConfirmInvoice(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = payConfirmInvoice.id;
                  setPayConfirmInvoice(null);
                  handlePayInvoice(id);
                }}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Pay {formatCurrency(payConfirmInvoice.total, payConfirmInvoice.currency)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Processing Overlay */}
      {payingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Processing Payment
            </h3>
            <p className="text-sm text-gray-500">
              Please wait while we process your payment...
            </p>
          </div>
        </div>
      )}

      {/* Payment Result Modal */}
      {paymentResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setPaymentResult(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {paymentResult.success ? (
              <>
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Payment Successful
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  Your payment has been processed successfully.
                </p>
                {paymentResult.data?.refNum && (
                  <p className="text-xs text-gray-400 mb-4">
                    Reference: {paymentResult.data.refNum}
                  </p>
                )}
                {paymentResult.data?.maskedCard && (
                  <p className="text-xs text-gray-400 mb-4">
                    Charged to: {paymentResult.data.maskedCard}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Payment Failed
                </h3>
                <p className="text-sm text-red-600 mb-4">
                  {paymentResult.error}
                </p>
              </>
            )}
            <button
              onClick={() => setPaymentResult(null)}
              className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
            >
              {paymentResult.success ? "Done" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
