import { useState, useEffect } from "react";
import {
  Gift,
  TrendingUp,
  Loader2,
  Heart,
  AlertTriangle,
  Info,
  ChevronDown,
  X,
} from "lucide-react";
import { Card } from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";

const BonusesRaises = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bonus form
  const [bonusForm, setBonusForm] = useState({
    employeeId: "",
    amount: "",
    reason: "",
  });
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [bonusError, setBonusError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalType, setSuccessModalType] = useState(""); // "bonus" or "raise"

  // Raise form
  const [raiseForm, setRaiseForm] = useState({
    employeeId: "",
    billRate: "",
    effectiveDate: "",
  });
  const [raiseSubmitting, setRaiseSubmitting] = useState(false);
  const [raiseError, setRaiseError] = useState("");

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await clientPortalService.getEmployeesWithRates();
        if (response.success) {
          setEmployees(response.data.employees || []);
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const selectedRaiseEmployee = employees.find(
    (e) => e.id === raiseForm.employeeId,
  );
  const billRateNum = parseFloat(raiseForm.billRate) || 0;
  const weeklyBillImpact = billRateNum * 40;

  const handleSendBonus = async (e) => {
    e.preventDefault();
    setBonusError("");
    if (!bonusForm.employeeId) {
      setBonusError("Please select an employee");
      return;
    }
    if (!bonusForm.amount || parseFloat(bonusForm.amount) <= 0) {
      setBonusError("Please enter a valid amount");
      return;
    }

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
    if (!raiseForm.employeeId) {
      setRaiseError("Please select an employee");
      return;
    }
    if (!raiseForm.billRate || parseFloat(raiseForm.billRate) <= 0) {
      setRaiseError("Please enter a valid bill rate");
      return;
    }
    if (!raiseForm.effectiveDate) {
      setRaiseError("Please select an effective date");
      return;
    }

    try {
      setRaiseSubmitting(true);
      const response = await clientPortalService.submitRaiseRequest({
        employeeId: raiseForm.employeeId,
        billRate: parseFloat(raiseForm.billRate),
        effectiveDate: raiseForm.effectiveDate,
      });
      if (response.success) {
        setRaiseForm({
          employeeId: "",
          billRate: "",
          effectiveDate: "",
        });
        setSuccessModalType("raise");
        setShowSuccessModal(true);
      } else {
        setRaiseError(response.error || "Failed to submit raise request");
      }
    } catch (err) {
      setRaiseError(
        err.data?.error || err.message || "Failed to submit raise request",
      );
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <h2 className="text-xl font-bold text-gray-900">Bonuses & Raises</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Give a Bonus */}
        <Card>
          <form onSubmit={handleSendBonus} className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Give a Bonus</h3>

            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <div className="relative">
                <select
                  value={bonusForm.employeeId}
                  onChange={(e) =>
                    setBonusForm({ ...bonusForm, employeeId: e.target.value })
                  }
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

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-amber-600 mb-1">
                Bonus Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bonusForm.amount}
                onChange={(e) =>
                  setBonusForm({ ...bonusForm, amount: e.target.value })
                }
                placeholder="0.00"
                className="input w-full"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={bonusForm.reason}
                onChange={(e) =>
                  setBonusForm({ ...bonusForm, reason: e.target.value })
                }
                placeholder="e.g. Outstanding performance this quarter..."
                rows={3}
                className="input w-full resize-none"
              />
            </div>

            {/* Error/Success */}
            {bonusError && <p className="text-sm text-red-600">{bonusError}</p>}

            {/* Submit */}
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

            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <div className="relative">
                <select
                  value={raiseForm.employeeId}
                  onChange={(e) =>
                    setRaiseForm({ ...raiseForm, employeeId: e.target.value })
                  }
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

            {/* Bill Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bill Rate
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={raiseForm.billRate}
                onChange={(e) =>
                  setRaiseForm({ ...raiseForm, billRate: e.target.value })
                }
                placeholder="0.00"
                className="input w-full"
              />
            </div>

            {/* Effective Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Start Date
              </label>
              <input
                type="date"
                value={raiseForm.effectiveDate}
                onChange={(e) =>
                  setRaiseForm({ ...raiseForm, effectiveDate: e.target.value })
                }
                className="input w-full"
              />
            </div>

         

            

            {/* Error/Success */}
            {raiseError && <p className="text-sm text-red-600">{raiseError}</p>}

            {/* Submit */}
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
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 text-center">
            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-5xl mb-4">
              {successModalType === "bonus" ? "🎉" : "🎉"}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {successModalType === "bonus"
                ? "Bonus Confirmed!"
                : "Raise Request Submitted!"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {successModalType === "bonus"
                ? "Thank you for the bonus! We'll deliver your bonus to your employee as soon as possible. They will be notified. You're a wonderful employer!"
                : "Your raise request has been submitted. Our team will review and process it. The employee will be notified once approved."}
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BonusesRaises;
