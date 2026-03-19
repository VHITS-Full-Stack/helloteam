import { useState, useEffect } from "react";
import { TrendingUp, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, Badge } from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";

const RateHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await clientPortalService.getRateHistory();
        if (response.success) {
          setHistory(response.data.history || []);
        }
      } catch (err) {
        console.error("Failed to fetch rate history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const getTypeBadge = (type) => {
    switch (type) {
      case "BILLING_RATE": return <Badge variant="info">Billing Rate</Badge>;
      case "PAYABLE_RATE": return <Badge variant="default">Pay Rate</Badge>;
      case "HOURLY_RATE": return <Badge variant="warning">Hourly Rate</Badge>;
      default: return <Badge variant="default">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900">Rate History</h2>

      {history.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No rate changes</h3>
            <p className="text-gray-500 text-sm">No rate change history found for your employees.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-200">
                  <th className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-4">Employee</th>
                  <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3">Type</th>
                  <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3">Old Rate ($)</th>
                  <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3">New Rate ($)</th>
                  <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3">Change</th>
                  <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3">Date</th>
                  <th className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider py-3 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((h) => {
                  const diff = h.newValue - h.oldValue;
                  const isIncrease = diff > 0;
                  return (
                    <tr key={h.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 whitespace-nowrap">{h.employeeName}</td>
                      <td className="py-3 px-3 text-center">{getTypeBadge(h.rateType)}</td>
                      <td className="py-3 px-3 text-center text-sm text-gray-500">{h.oldValue.toFixed(2)}</td>
                      <td className="py-3 px-3 text-center text-sm font-semibold text-gray-900">{h.newValue.toFixed(2)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isIncrease ? "text-green-600" : "text-red-600"}`}>
                          {isIncrease ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isIncrease ? "+" : ""}{diff.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-gray-600 whitespace-nowrap">
                        {new Date(h.changeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-500 max-w-[200px] truncate">{h.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default RateHistory;
