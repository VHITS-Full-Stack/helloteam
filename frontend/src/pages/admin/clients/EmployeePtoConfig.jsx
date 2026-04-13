import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { Card, Button, Avatar } from "../../../components/common";
import clientService from "../../../services/client.service";

const EmployeePtoConfig = () => {
  const { id: clientId, employeeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [client, setClient] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [ptoFormData, setPtoFormData] = useState({
    ptoAllowPaidLeave: "",
    ptoEntitlementType: "",
    ptoAnnualDays: "",
    ptoAccrualRatePerMonth: "",
    ptoMaxCarryoverDays: "",
    ptoCarryoverExpiryMonths: "",
    ptoAllowUnpaidLeave: "",
    ptoAllowPaidHolidays: "",
    ptoAllowUnpaidHolidays: "",
    clientDefaults: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clientRes, employeesRes, ptoRes] = await Promise.all([
          clientService.getClient(clientId),
          clientService.getClientEmployees(clientId),
          clientService.getEmployeePtoConfig(clientId, employeeId),
        ]);

        if (clientRes.success) setClient(clientRes.data);

        if (employeesRes.success) {
          const emp = employeesRes.data.find((e) => e.id === employeeId);
          setEmployee(emp || null);
        }

        if (ptoRes.success) {
          const { override, clientDefaults, effective } = ptoRes.data;
          setPtoFormData({
            ptoAllowPaidLeave: String(override.ptoAllowPaidLeave ?? clientDefaults.allowPaidLeave),
            ptoEntitlementType: override.ptoEntitlementType || clientDefaults.paidLeaveEntitlementType || '',
            ptoAnnualDays: String(override.ptoAnnualDays ?? clientDefaults.annualPaidLeaveDays ?? ''),
            ptoAccrualRatePerMonth: String(override.ptoAccrualRatePerMonth ?? clientDefaults.accrualRatePerMonth ?? ''),
            ptoMaxCarryoverDays: String(override.ptoMaxCarryoverDays ?? clientDefaults.maxCarryoverDays ?? ''),
            ptoCarryoverExpiryMonths: String(override.ptoCarryoverExpiryMonths ?? clientDefaults.carryoverExpiryMonths ?? ''),
            ptoAllowUnpaidLeave: String(override.ptoAllowUnpaidLeave ?? clientDefaults.allowUnpaidLeave),
            ptoAllowPaidHolidays: String(override.ptoAllowPaidHolidays ?? clientDefaults.allowPaidHolidays),
            ptoAllowUnpaidHolidays: String(override.ptoAllowUnpaidHolidays ?? clientDefaults.allowUnpaidHolidays),
            clientDefaults,
          });
        }
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId, employeeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await clientService.updateEmployeePtoConfig(
        clientId,
        employeeId,
        {
          ptoAllowPaidLeave: ptoFormData.ptoAllowPaidLeave,
          ptoEntitlementType: ptoFormData.ptoEntitlementType,
          ptoAnnualDays: ptoFormData.ptoAnnualDays,
          ptoAccrualRatePerMonth: ptoFormData.ptoAccrualRatePerMonth,
          ptoMaxCarryoverDays: ptoFormData.ptoMaxCarryoverDays,
          ptoCarryoverExpiryMonths: ptoFormData.ptoCarryoverExpiryMonths,
          ptoAllowUnpaidLeave: ptoFormData.ptoAllowUnpaidLeave,
          ptoAllowPaidHolidays: ptoFormData.ptoAllowPaidHolidays,
          ptoAllowUnpaidHolidays: ptoFormData.ptoAllowUnpaidHolidays,
        }
      );
      if (response.success) {
        navigate(`/admin/clients/${clientId}/employees`);
      } else {
        setError(response.error || "Failed to save PTO config");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to save PTO config");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearOverrides = () => {
    const cd = ptoFormData.clientDefaults;
    if (!cd) return;
    setPtoFormData((prev) => ({
      ...prev,
      ptoAllowPaidLeave: String(cd.allowPaidLeave),
      ptoEntitlementType: cd.paidLeaveEntitlementType || 'NONE',
      ptoAnnualDays: String(cd.annualPaidLeaveDays ?? ''),
      ptoAccrualRatePerMonth: String(cd.accrualRatePerMonth ?? ''),
      ptoMaxCarryoverDays: String(cd.maxCarryoverDays ?? ''),
      ptoCarryoverExpiryMonths: String(cd.carryoverExpiryMonths ?? ''),
      ptoAllowUnpaidLeave: String(cd.allowUnpaidLeave),
      ptoAllowPaidHolidays: String(cd.allowPaidHolidays),
      ptoAllowUnpaidHolidays: String(cd.allowUnpaidHolidays),
    }));
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/admin/clients/${clientId}/employees`)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Configure Employee PTO
          </h2>
          <p className="text-sm text-gray-500">{client?.companyName}</p>
        </div>
      </div>

      {/* Employee Info */}
      {employee && (
        <Card>
          <div className="flex items-center gap-3">
            <Avatar
              src={employee.profilePhoto}
              name={`${employee.firstName} ${employee.lastName}`}
              size="md"
            />
            <div>
              <p className="font-semibold text-gray-900">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-sm text-gray-500">{employee.user?.email}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Client Default PTO Info */}
      {ptoFormData.clientDefaults && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800 font-medium mb-1">
            Client Default PTO
          </p>
          <p className="text-sm text-blue-600">
            {ptoFormData.clientDefaults.allowPaidLeave
              ? `${ptoFormData.clientDefaults.paidLeaveEntitlementType.replace(/_/g, " ")} — ${ptoFormData.clientDefaults.annualPaidLeaveDays} days`
              : "Paid leave disabled"}
            {" | "}
            Unpaid:{" "}
            {ptoFormData.clientDefaults.allowUnpaidLeave
              ? "Allowed"
              : "Disabled"}
          </p>
          <p className="text-sm text-blue-600">
            Paid Holidays:{" "}
            {ptoFormData.clientDefaults.allowPaidHolidays
              ? "Allowed"
              : "Disabled"}
            {" | "}
            Unpaid Holidays:{" "}
            {ptoFormData.clientDefaults.allowUnpaidHolidays
              ? "Allowed"
              : "Disabled"}
          </p>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* PTO Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Configure PTO for this employee. Values are pre-filled from client policy. Changes will override the client defaults.
        </p>

        {/* Paid Leave */}
        <div
          className={`p-4 rounded-xl border ${ptoFormData.ptoAllowPaidLeave === "true" || (ptoFormData.ptoAllowPaidLeave === "" && ptoFormData.clientDefaults?.allowPaidLeave) ? "bg-green-50/50 border-green-100" : "bg-gray-50 border-gray-100"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Paid Leave
            </span>
            <div className="relative">
              <select
                value={ptoFormData.ptoAllowPaidLeave}
                onChange={(e) =>
                  setPtoFormData({
                    ...ptoFormData,
                    ptoAllowPaidLeave: e.target.value,
                  })
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-8"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {(ptoFormData.ptoAllowPaidLeave === "true" || (ptoFormData.ptoAllowPaidLeave === "" && ptoFormData.clientDefaults?.allowPaidLeave)) && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leave Type
                </label>
                <div className="relative">
                  <select
                    value={ptoFormData.ptoEntitlementType}
                    onChange={(e) =>
                      setPtoFormData({
                        ...ptoFormData,
                        ptoEntitlementType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-9"
                  >
                    <option value="NONE">None</option>
                    <option value="FIXED">Fixed Annual</option>
                    <option value="FIXED_HALF_YEARLY">Fixed Half-Yearly</option>
                    <option value="ACCRUED">Accrued</option>
                    <option value="MILESTONE">Milestone Based</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {(ptoFormData.ptoEntitlementType === "FIXED" ||
                ptoFormData.ptoEntitlementType === "FIXED_HALF_YEARLY") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {ptoFormData.ptoEntitlementType === "FIXED_HALF_YEARLY"
                      ? "Half-Yearly Days"
                      : "Annual Days"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Client default"
                    value={ptoFormData.ptoAnnualDays}
                    onChange={(e) =>
                      setPtoFormData({
                        ...ptoFormData,
                        ptoAnnualDays: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              )}

              {ptoFormData.ptoEntitlementType === "ACCRUED" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accrual (days/month)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Client default"
                    value={ptoFormData.ptoAccrualRatePerMonth}
                    onChange={(e) =>
                      setPtoFormData({
                        ...ptoFormData,
                        ptoAccrualRatePerMonth: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              )}

              {(ptoFormData.ptoEntitlementType === "" ||
                ptoFormData.ptoEntitlementType === "FIXED" ||
                ptoFormData.ptoEntitlementType === "FIXED_HALF_YEARLY" ||
                ptoFormData.ptoEntitlementType === "ACCRUED") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Carryover Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Client default"
                      value={ptoFormData.ptoMaxCarryoverDays}
                      onChange={(e) =>
                        setPtoFormData({
                          ...ptoFormData,
                          ptoMaxCarryoverDays: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carryover Expiry (months)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Client default"
                      value={ptoFormData.ptoCarryoverExpiryMonths}
                      onChange={(e) =>
                        setPtoFormData({
                          ...ptoFormData,
                          ptoCarryoverExpiryMonths: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Unpaid Leave */}
        <div
          className={`p-4 rounded-xl border ${ptoFormData.ptoAllowUnpaidLeave === "true" || (ptoFormData.ptoAllowUnpaidLeave === "" && ptoFormData.clientDefaults?.allowUnpaidLeave) ? "bg-amber-50/50 border-amber-100" : "bg-gray-50 border-gray-100"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Unpaid Leave
            </span>
            <div className="relative">
              <select
                value={ptoFormData.ptoAllowUnpaidLeave}
                onChange={(e) =>
                  setPtoFormData({
                    ...ptoFormData,
                    ptoAllowUnpaidLeave: e.target.value,
                  })
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-8"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Paid Holidays */}
        <div
          className={`p-4 rounded-xl border ${ptoFormData.ptoAllowPaidHolidays === "true" || (ptoFormData.ptoAllowPaidHolidays === "" && ptoFormData.clientDefaults?.allowPaidHolidays) ? "bg-blue-50/50 border-blue-100" : "bg-gray-50 border-gray-100"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Paid Holidays
            </span>
            <div className="relative">
              <select
                value={ptoFormData.ptoAllowPaidHolidays}
                onChange={(e) =>
                  setPtoFormData({
                    ...ptoFormData,
                    ptoAllowPaidHolidays: e.target.value,
                  })
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-8"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Unpaid Holidays */}
        <div
          className={`p-4 rounded-xl border ${ptoFormData.ptoAllowUnpaidHolidays === "true" || (ptoFormData.ptoAllowUnpaidHolidays === "" && ptoFormData.clientDefaults?.allowUnpaidHolidays) ? "bg-purple-50/50 border-purple-100" : "bg-gray-50 border-gray-100"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Unpaid Holidays
            </span>
            <div className="relative">
              <select
                value={ptoFormData.ptoAllowUnpaidHolidays}
                onChange={(e) =>
                  setPtoFormData({
                    ...ptoFormData,
                    ptoAllowUnpaidHolidays: e.target.value,
                  })
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none pr-8"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleClearOverrides}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear all overrides
          </button>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                navigate(`/admin/clients/${clientId}/employees`)
              }
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save PTO Config
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmployeePtoConfig;
