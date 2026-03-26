import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Users, Clock, DollarSign, Loader2, FileText } from 'lucide-react';
import { Card, Button } from '../../components/common';
import payrollService from '../../services/payroll.service';
import { formatHours } from '../../utils/formatTime';

const PayrollReport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const periodStart = searchParams.get('periodStart');
  const periodEnd = searchParams.get('periodEnd');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);

  const formatPeriodLabel = (start, end) => {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(end);
    const month = s.toLocaleDateString('en-US', { month: 'short' });
    return `${month} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`;
  };

  const fmtShort = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  useEffect(() => {
    if (!periodStart || !periodEnd) return;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await payrollService.exportData(periodStart, periodEnd);
        if (res.success) {
          setReportData(res.data);
        } else {
          setError(res.error || 'Failed to load report');
        }
      } catch (err) {
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [periodStart, periodEnd]);

  if (!periodStart || !periodEnd) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/admin/payroll')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Payroll
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">Missing period parameters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/payroll')}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payroll Report</h2>
            <p className="text-sm text-gray-500">{formatPeriodLabel(periodStart, periodEnd)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={Download}
          onClick={async () => {
            try {
              await payrollService.downloadCsv(periodStart, periodEnd);
            } catch (err) {
              setError(err.message || 'Failed to download');
            }
          }}
        >
          Download CSV
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : reportData?.employees?.length > 0 ? (
        <>
          {/* Summary stats */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-700 font-semibold">{reportData.totals?.totalEmployees || 0} Employees</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
              <Clock className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700 font-semibold">{formatHours(reportData.totals?.totalHours || 0)} Total</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-purple-700 font-semibold">${(reportData.totals?.totalGrossPay || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Employee table */}
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Employee</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Period</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Client</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Days</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Total Hours</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">OT Hours</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Rate</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">Gross Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.employees.map((emp, idx) => {
                    const ratePeriods = Object.values(emp._ratePeriods || {});
                    const hasMultipleRates = ratePeriods.length > 1;

                    if (hasMultipleRates) {
                      return (
                        <Fragment key={idx}>
                          {ratePeriods.map((rp, rpIdx) => {
                            const totalH = Math.round((rp.regularMinutes / 60) * 100) / 100;
                            const otH = Math.round((rp.otMinutes / 60) * 100) / 100;
                            return (
                              <tr key={`${idx}-${rpIdx}`} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 text-sm text-gray-900">{emp.firstName} {emp.lastName}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-500">{fmtShort(rp.minDate)} - {fmtShort(rp.maxDate)}</td>
                                <td className="px-4 py-2.5 text-sm text-gray-600">{emp.client}</td>
                                <td className="px-4 py-2.5 text-sm text-center">{rp.workDays}</td>
                                <td className="px-4 py-2.5 text-sm text-center">{totalH}</td>
                                <td className="px-4 py-2.5 text-sm text-center">{otH > 0 ? <span className="text-orange-600">{otH}</span> : <span className="text-gray-300">-</span>}</td>
                                <td className="px-4 py-2.5 text-sm text-center font-medium">${rp.rate}/hr</td>
                                <td className="px-4 py-2.5 text-sm text-right font-semibold">${(Math.round((rp.regularPay + rp.otPay) * 100) / 100).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-50/80 border-b-2 border-gray-200">
                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-700" colSpan={3}>{emp.firstName} {emp.lastName} — Total</td>
                            <td className="px-4 py-2.5 text-sm text-center font-semibold">{emp.workDays}</td>
                            <td className="px-4 py-2.5 text-sm text-center font-semibold">{formatHours(emp.totalHours)}</td>
                            <td className="px-4 py-2.5 text-sm text-center font-semibold">{emp.overtimeHours > 0 ? <span className="text-orange-600">{formatHours(emp.overtimeHours)}</span> : '-'}</td>
                            <td className="px-4 py-2.5"></td>
                            <td className="px-4 py-2.5 text-sm text-right font-bold text-green-700">${emp.grossPay.toFixed(2)}</td>
                          </tr>
                        </Fragment>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-sm text-gray-900">{emp.firstName} {emp.lastName}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">—</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{emp.client}</td>
                        <td className="px-4 py-2.5 text-sm text-center">{emp.workDays}</td>
                        <td className="px-4 py-2.5 text-sm text-center">{formatHours(emp.totalHours)}</td>
                        <td className="px-4 py-2.5 text-sm text-center">{emp.overtimeHours > 0 ? <span className="text-orange-600">{formatHours(emp.overtimeHours)}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-4 py-2.5 text-sm text-center font-medium">${emp.hourlyRate}/hr</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-green-700">${emp.grossPay.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900" colSpan={4}>GRAND TOTAL</td>
                    <td className="px-4 py-3 text-sm text-center font-bold">{formatHours(reportData.totals?.totalHours)}</td>
                    <td className="px-4 py-3 text-sm text-center font-bold">{reportData.totals?.overtimeHours > 0 ? <span className="text-orange-600">{formatHours(reportData.totals.overtimeHours)}</span> : '-'}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-700">${(reportData.totals?.totalGrossPay || 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No payroll data for this period</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PayrollReport;
