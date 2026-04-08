import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  DollarSign,
  Calendar,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, Badge, Avatar } from "../../components/common";
import payrollService from "../../services/payroll.service";
import { formatDate } from "../../utils/formatDateTime";

const PayrollEmployeeDetail = () => {
  const { employeeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const periodStart = searchParams.get("periodStart");
  const periodEnd = searchParams.get("periodEnd");
  const tab = searchParams.get("tab");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!employeeId || !periodStart || !periodEnd) return;
      try {
        setLoading(true);
        const response = await payrollService.getEmployeeDetail(
          employeeId,
          periodStart,
          periodEnd,
        );
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.error || "Failed to load employee detail");
        }
      } catch (err) {
        setError(err.message || "Failed to load employee detail");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [employeeId, periodStart, periodEnd]);

  const clientTimezone = data?.client?.timezone || 'America/New_York';
  const formatTime = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: clientTimezone,
    });
  };

  const formatHours = (minutes) => {
    if (!minutes) return "0m";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatDecimalHours = (hours) => {
    if (!hours) return "0m";
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
      case "AUTO_APPROVED":
        return (
          <Badge variant="success">
            {status === "AUTO_APPROVED" ? "Auto Approved" : "Approved"}
          </Badge>
        );
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(`/admin/payroll?tab=${tab || 'periods'}`)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Payroll
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(`/admin/payroll?tab=${tab || 'periods'}`)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Payroll
        </button>
        <Card>
          <p className="text-center text-gray-500 py-8">
            No data found for this employee in the selected period.
          </p>
        </Card>
      </div>
    );
  }

  const { employee, client, summary, rates, adjustments, dailyRecords } = data;
  const s = summary;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/admin/payroll?tab=${tab || 'periods'}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <Avatar
          name={`${employee.firstName} ${employee.lastName}`}
          src={employee.profilePhoto}
          size="lg"
        />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="text-sm text-gray-500">
            {client.companyName} &middot;{" "}
            {formatDate(periodStart, {
              emptyValue: "—",
              includeWeekday: true,
              includeYear: false,
              timeZone: "UTC",
              dateOnlyAsUTC: true,
            })}{" "}
            –{" "}
            {formatDate(periodEnd, {
              emptyValue: "—",
              includeWeekday: true,
              includeYear: false,
              timeZone: "UTC",
              dateOnlyAsUTC: true,
            })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <p className="text-[10px] text-green-600 font-medium">Total Hours</p>
          <p className="text-xl font-bold text-green-700">{formatDecimalHours(s.totalHours)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-[10px] text-blue-600 font-medium">Regular</p>
          <p className="text-xl font-bold text-blue-700">{formatDecimalHours(s.regularHours)}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
          <p className="text-[10px] text-orange-600 font-medium">Overtime</p>
          <p className="text-xl font-bold text-orange-700">
            {formatDecimalHours(s.overtimeHours)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-[10px] text-gray-600 font-medium">Work Days</p>
          <p className="text-xl font-bold text-gray-900">{s.workDays}</p>
        </div>

        <div className="rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-teal-600 font-medium">Bonus</p>
              <p className="text-lg font-bold text-teal-700">
                +${s.totalBonuses}
              </p>
            </div>
            <div className="w-px h-6 bg-gray-200"></div>
            <div>
              <p className="text-[10px] text-red-600 font-medium">Deduction</p>
              <p className="text-lg font-bold text-red-700">
                -${s.totalDeductions}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 col-span-2 md:col-span-1">
          <p className="text-[10px] text-emerald-600 font-medium">Gross Pay</p>
          <p className="text-xl font-bold text-emerald-700">
            ${s.grossPay.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Daily Timesheet */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">
            Daily Timesheet
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Billing In/Out
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Break
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Regular
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  OT
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Total
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dailyRecords.map((rec, idx) => {
                const isApproved =
                  rec.status === "APPROVED" || rec.status === "AUTO_APPROVED";
                return (
                  <tr
                    key={idx}
                    className={
                      !isApproved ? "bg-yellow-50/30" : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                      {formatDate(rec.date, {
                        emptyValue: "—",
                        includeWeekday: true,
                        includeYear: false,
                        timeZone: "UTC",
                        dateOnlyAsUTC: true,
                      })}
                      {rec.isLate && (
                        <span className="ml-1 text-[10px] text-red-500 font-semibold">
                          LATE
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-600">
                      {rec.billingStart && rec.billingEnd ? (
                        <span>
                          {formatTime(rec.billingStart)}
                          <span className="text-gray-300 mx-1">–</span>
                          {formatTime(rec.billingEnd)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-500">
                      {rec.breakMinutes > 0
                        ? formatHours(rec.breakMinutes)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center font-semibold text-gray-900">
                      {isApproved
                        ? formatHours(rec.regularMinutes)
                        : formatHours(rec.totalMinutes)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center">
                      {rec.approvedOTMinutes > 0 ? (
                        <span className="text-orange-600 font-medium">
                          {formatHours(rec.approvedOTMinutes)}
                          {rec.shiftExtensionStatus === "APPROVED" && (
                            <span className="text-[10px] text-gray-400 ml-1">
                              ext
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center font-bold text-blue-700">
                      {isApproved
                        ? formatHours(rec.payableMinutes)
                        : formatHours(rec.totalMinutes)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {getStatusBadge(rec.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  Total
                </td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-sm text-center font-bold text-gray-900">
                  {formatDecimalHours(s.regularHours)}
                </td>
                <td className="px-3 py-3 text-sm text-center font-bold text-orange-600">
                  {formatDecimalHours(s.overtimeHours)}
                </td>
                <td className="px-3 py-3 text-sm text-center font-bold text-blue-700">
                  {formatDecimalHours(s.totalHours)}
                </td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Pay Calculation */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">
              Pay Calculation
            </h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Gross Pay
            </p>
            <p className="text-2xl font-bold text-emerald-700">
              ${s.grossPay.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-3 px-3 py-2 bg-blue-50/50 rounded-lg">
            <div className="w-0.5 h-6 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-700 flex-1">Regular Pay</span>
            {/* <span className="text-xs text-gray-400">{formatDecimalHours(s.regularHours)} &times; ${rates.hourlyRate}</span> */}
            <span className="text-sm font-semibold text-gray-900 w-20 text-right">
              ${s.regularPay.toLocaleString()}
            </span>
          </div>
          {s.overtimeHours > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 bg-orange-50/50 rounded-lg">
              <div className="w-0.5 h-6 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-orange-700 flex-1">Overtime</span>
              <span className="text-xs text-gray-400">
                {formatDecimalHours(s.overtimeHours)} &times; ${rates.overtimeRate}
              </span>
              <span className="text-sm font-semibold text-orange-700 w-20 text-right">
                +${s.overtimePay.toLocaleString()}
              </span>
            </div>
          )}
          {adjustments.map((adj) => (
            <div
              key={adj.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${adj.type === "BONUS" ? "bg-green-50/50" : "bg-red-50/50"}`}
            >
              <div
                className={`w-0.5 h-6 rounded-full ${adj.type === "BONUS" ? "bg-green-500" : "bg-red-500"}`}
              ></div>
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
                {adj.type === "BONUS" ? "+" : "-"}${adj.amount.toLocaleString()}
              </span>
            </div>
          ))}
          {s.employeeDeduction > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-50/50">
              <div className="w-0.5 h-6 rounded-full bg-red-500"></div>
              <span className="text-sm text-red-700 flex-1">
                Fixed Deduction
                <span className="text-xs text-gray-400 ml-1">(per pay period)</span>
              </span>
              <span className="text-sm font-semibold w-20 text-right text-red-700">
                -${s.employeeDeduction.toLocaleString()}
              </span>
            </div>
          )}
          <div className="border-t border-dashed border-gray-300 mt-2 pt-2">
            <div className="flex items-center gap-3 px-3 py-2 bg-emerald-50 rounded-lg">
              <div className="w-0.5 h-6 bg-emerald-600 rounded-full"></div>
              <span className="text-sm font-bold text-gray-900 flex-1">
                Gross Pay (Regular Hours + Bonus - Deductions)
              </span>

              <span className="text-lg font-bold text-emerald-700 w-20 text-right">
                ${s.grossPay.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {s.pendingDays > 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">
            {s.pendingDays} day(s) still pending approval. Pending hours (
            {s.pendingHours}h) are not included in the gross pay calculation.
          </p>
        </div>
      )}
    </div>
  );
};

export default PayrollEmployeeDetail;
