import { useState, useEffect } from "react";
import {
  FileText,
  ChevronRight,
  Loader2,
  DollarSign,
  Clock,
  Calendar,
} from "lucide-react";
import { Card, Badge, Avatar, Button, ExportButton } from "../../components/common";
import payslipService from "../../services/payslip.service";
import { formatDate } from "../../utils/formatDateTime";

const Payslips = () => {
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  useEffect(() => {
    const fetchPayslips = async () => {
      try {
        setLoading(true);
        const response = await payslipService.getMyPayslips();
        if (response.success) {
          setPayslips(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch payslips:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayslips();
  }, []);

  const loadDetail = async (payslip) => {
    setSelectedPayslip(payslip);
    setDetailLoading(true);
    try {
      const response = await payslipService.getMyPayslipDetail(payslip.id);
      if (response.success) {
        setDetailData(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch payslip detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatPeriod = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatHours = (minutes) => {
    if (!minutes) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Detail view
  if (selectedPayslip && detailData) {
    const d = detailData;
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedPayslip(null);
              setDetailData(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 rotate-180" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payslip</h2>
            <p className="text-sm text-gray-500">
              {d.clientName} &middot; {formatPeriod(d.periodStart, d.periodEnd)}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-[10px] text-green-600 font-medium">
              Total Hours
            </p>
            <p className="text-xl font-bold text-green-700">{d.totalHours}h</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-[10px] text-blue-600 font-medium">Regular</p>
            <p className="text-xl font-bold text-blue-700">{d.regularHours}h</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
            <p className="text-[10px] text-orange-600 font-medium">Overtime</p>
            <p className="text-xl font-bold text-orange-700">
              {d.overtimeHours}h
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-[10px] text-gray-600 font-medium">Work Days</p>
            <p className="text-xl font-bold text-gray-900">{d.workDays}</p>
          </div>

          <div className="rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-teal-600 font-medium">Bonus</p>
                <p className="text-sm font-bold text-teal-700">
                  +${d.totalBonuses}
                </p>
              </div>
              <div className="w-px h-5 bg-gray-200" />
              <div>
                <p className="text-[10px] text-red-600 font-medium">Deduct</p>
                <p className="text-sm font-bold text-red-700">
                  -${d.totalDeductions}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            <p className="text-[10px] text-emerald-600 font-medium">
              Gross Pay
            </p>
            <p className="text-xl font-bold text-emerald-700">
              ${d.grossPay.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Daily Timesheet */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Daily Timesheet
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Clock In/Out
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Break
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Regular
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Rate
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    OT
                  </th>

                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    OT Rate
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.dailyRecords.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {formatDate(rec.date, {
                        timeZone: "UTC",
                        emptyValue: "—",
                        dateOnlyAsUTC: true,
                      })}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {rec.billingStart && rec.billingEnd ? (
                        <span>
                          {formatTime(rec.billingStart)}
                          <span className="text-gray-300 mx-1">–</span>
                          {rec.approvedOTMinutes > 0
                            ? formatTime(
                                new Date(
                                  new Date(rec.billingEnd).getTime() +
                                    rec.approvedOTMinutes * 60000,
                                ),
                              )
                            : formatTime(rec.billingEnd)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-500">
                      {rec.breakMinutes > 0
                        ? formatHours(rec.breakMinutes)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-gray-900">
                      {formatHours(rec.regularMinutes)}
                    </td>{" "}
                    <td className="px-3 py-2 text-center text-gray-700">
                      ${d.hourlyRate}/h
                    </td>
                    <td className="px-3 py-2 text-center">
                      {rec.approvedOTMinutes > 0 ? (
                        <span className="text-orange-600 font-medium">
                          {formatHours(rec.approvedOTMinutes)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">
                      {d.hourlyRate > 0
                        ? `${Math.round((d.overtimeRate / d.hourlyRate) * 100) / 100}x`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-blue-700">
                      {formatHours(rec.payableMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-3 py-2 font-bold text-gray-900">Total</td>
                  <td />
                  <td />
                  <td className="px-3 py-2 text-center font-bold text-gray-900">
                    {d.regularHours}h
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-orange-600">
                    {d.overtimeHours}h
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700">
                    {d.totalHours}h
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Pay Calculation */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Pay Calculation
              </h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase">Gross Pay</p>
              <p className="text-xl font-bold text-emerald-700">
                ${d.grossPay.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 px-3 py-2 bg-blue-50/50 rounded-lg">
              <div className="w-0.5 h-6 bg-blue-500 rounded-full" />
              <span className="text-sm text-gray-700 flex-1">Regular Pay</span>
              <span className="text-xs text-gray-400">
                {d.regularHours}h &times; ${d.hourlyRate}
              </span>
              <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                ${d.regularPay.toLocaleString()}
              </span>
            </div>
            {d.overtimeHours > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 bg-orange-50/50 rounded-lg">
                <div className="w-0.5 h-6 bg-orange-500 rounded-full" />
                <span className="text-sm text-orange-700 flex-1">Overtime</span>
                <span className="text-xs text-gray-400">
                  {d.overtimeHours}h &times; ${d.overtimeRate}
                </span>
                <span className="text-sm font-semibold text-orange-700 w-20 text-right">
                  +${d.overtimePay.toLocaleString()}
                </span>
              </div>
            )}
            {d.adjustments?.map((adj) => (
              <div
                key={adj.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${adj.type === "BONUS" ? "bg-green-50/50" : "bg-red-50/50"}`}
              >
                <div
                  className={`w-0.5 h-6 rounded-full ${adj.type === "BONUS" ? "bg-green-500" : "bg-red-500"}`}
                 />
                <span
                  className={`text-sm flex-1 ${adj.type === "BONUS" ? "text-green-700" : "text-red-700"}`}
                >
                  {adj.type === "BONUS" ? "Bonus" : "Deduction"}
                  <span className="text-xs text-gray-400 ml-1">
                    ({adj.reason})
                  </span>
                </span>
                <span
                  className={`text-sm font-semibold w-20 text-right ${adj.type === "BONUS" ? "text-green-700" : "text-red-700"}`}
                >
                  {adj.type === "BONUS" ? "+" : "-"}$
                  {adj.amount.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 mt-2 pt-2">
              <div className="flex items-center gap-3 px-3 py-2 bg-emerald-50 rounded-lg">
                <div className="w-0.5 h-6 bg-emerald-600 rounded-full" />
                <span className="text-sm font-bold text-gray-900 flex-1">
                  Gross Pay
                </span>
                <span className="text-lg font-bold text-emerald-700 w-20 text-right">
                  ${d.grossPay.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Detail loading
  if (selectedPayslip && detailLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleExportCSV = () => {
    if (!payslips.length) return;
    const headers = [
      "Period",
      "Client",
      "Work Days",
      "Total Hours",
      "Overtime Hours",
      "Gross Pay",
    ];
    const rows = payslips.map((slip) => [
      formatPeriod(slip.periodStart, slip.periodEnd),
      slip.clientName,
      slip.workDays,
      slip.totalHours,
      slip.overtimeHours || 0,
      `$${slip.grossPay.toLocaleString()}`,
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
    a.download = `payslips-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Payslip list
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payslips</h2>
          <p className="text-gray-500">View your pay history and breakdowns</p>
        </div>
        {payslips.length > 0 && (
          <ExportButton onClick={handleExportCSV} />
        )}
      </div>

      {payslips.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payslips yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Payslips will appear here after payroll is finalized
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Period
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Days
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Hours
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Rate
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    OT
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    OT Rate
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Gross Pay
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payslips.map((slip) => (
                  <tr
                    key={slip.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => loadDetail(slip)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {formatPeriod(slip.periodStart, slip.periodEnd)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {slip.clientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {slip.workDays}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-center">
                      {slip.totalHours}h
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-700">
                      ${slip.hourlyRate}/h
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {slip.overtimeHours > 0 ? (
                        <span className="text-orange-600 font-medium">
                          {slip.overtimeHours}h
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-700">
                      {slip.hourlyRate > 0
                        ? `${Math.round((slip.overtimeRate / slip.hourlyRate) * 100) / 100}x`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-emerald-700">
                        ${slip.grossPay.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Payslips;
