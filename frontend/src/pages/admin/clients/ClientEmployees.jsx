import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  UserPlus,
  X,
  Plus,
  AlertCircle,
  DollarSign,
  Calendar,
  Search,
  Sun,
  ChevronDown,
} from "lucide-react";
import { Card, Button, Badge, Avatar, Modal, RefreshButton } from "../../../components/common";
import { useClientData } from "../../../hooks/useClientData";

const ClientEmployees = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showAssignSection, setShowAssignSection] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [removeModal, setRemoveModal] = useState({ open: false, employee: null });

  const {
    client,
    clientEmployees,
    loading,
    error,
    submitting,
    showRateModal,
    showPtoModal,
    selectedEmployee,
    selectedPtoEmployee,
    rateFormData,
    ptoFormData,
    setError,
    setRateFormData,
    setPtoFormData,
    handleAssignEmployee,
    handleRemoveEmployee,
    handleOpenRateModal,
    handleUpdateEmployeeRate,
    handleOpenPtoModal,
    handleUpdateEmployeePtoConfig,
    handleClearPtoOverrides,
    getUnassignedEmployees,
    closeRateModal,
    closePtoModal,
    showHolidayConfigModal,
    holidayConfigForm,
    savingHolidayConfig,
    setHolidayConfigForm,
    handleOpenHolidayConfig,
    handleSaveHolidayConfig,
    closeHolidayConfigModal,
    refresh,
  } = useClientData({ mode: "detail", id });

  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "INACTIVE":
        return <Badge variant="default">Inactive</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const filteredUnassigned = getUnassignedEmployees().filter((emp) => {
    if (!searchFilter) return true;
    const query = searchFilter.toLowerCase();
    return (
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||
      emp.user?.email?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Loading employees...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Client Not Found</h3>
          <p className="text-gray-500 mb-4">
            The client you're looking for doesn't exist.
          </p>
          <Button variant="primary" onClick={() => navigate("/admin/clients")}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/clients/${id}`)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Assigned Employees
            </h2>
            <p className="text-xs text-gray-500">{client.companyName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={refresh} />
          <Button
            variant="outline"
            icon={Sun}
            onClick={handleOpenHolidayConfig}
          >
            Holiday Config
          </Button>
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => setShowAssignSection(!showAssignSection)}
          >
            Assign Employee
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Assign Employee Section */}
      {showAssignSection && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Available Employees
            </h3>
            <button
              onClick={() => setShowAssignSection(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {filteredUnassigned.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">
                {searchFilter
                  ? "No employees match your search"
                  : "No available employees to assign"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredUnassigned.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={employee.profilePhoto}
                      name={`${employee.firstName} ${employee.lastName}`}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {employee.user?.email}
                      </p>
                      {employee.clientAssignments?.length > 0 && (
                        <p className="text-xs text-yellow-600">
                          Currently:{" "}
                          {employee.clientAssignments[0]?.client?.companyName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => handleAssignEmployee(employee.id)}
                    disabled={submitting}
                  >
                    {employee.clientAssignments?.length > 0
                      ? "Reassign"
                      : "Assign"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Assigned Employees List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Currently Assigned ({clientEmployees.length})
          </h3>
        </div>

        {clientEmployees.length === 0 ? (
          <div className="text-center py-4">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No employees assigned</p>
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              className="mt-4"
              onClick={() => setShowAssignSection(true)}
            >
              Assign Employee
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {clientEmployees.map((employee) => {
              // Determine effective billing rate: assignment override > employee rate > client-group rate > group rate
              const assignmentRate = employee.assignmentHourlyRate;
              const employeeRate = employee.billingRate
                ? Number(employee.billingRate)
                : null;
              const clientGroupRate = employee.clientGroupBillingRate
                ? Number(employee.clientGroupBillingRate)
                : null;
              const groupRate = employee.groupAssignments?.[0]?.group
                ?.billingRate
                ? Number(employee.groupAssignments[0].group.billingRate)
                : null;
              const groupName = employee.groupAssignments?.[0]?.group?.name;

              let effectiveRate = null;
              let rateSource = "";
              if (assignmentRate) {
                effectiveRate = assignmentRate;
                rateSource = "custom";
              } else if (employeeRate) {
                effectiveRate = employeeRate;
                rateSource = "employee";
              } else if (clientGroupRate) {
                effectiveRate = clientGroupRate;
                rateSource = "group";
              } else if (groupRate) {
                effectiveRate = groupRate;
                rateSource = "group";
              }

              return (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={employee.profilePhoto}
                      name={`${employee.firstName} ${employee.lastName}`}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {employee.user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Billing Rate Display */}
                    <div className="text-right">
                      {effectiveRate ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">
                            ${Number(effectiveRate).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {rateSource === "custom" && "Custom rate"}
                            {rateSource === "employee" && "Employee rate"}
                            {rateSource === "group" &&
                              `${groupName || "Group"} rate`}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">No rate</p>
                      )}
                    </div>
                    {getStatusBadge(employee.user?.status)}
                    <button
                      onClick={() => handleOpenRateModal(employee)}
                      className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                      disabled={submitting}
                      title="Set custom rate"
                    >
                      <DollarSign className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/clients/${id}/employees/${employee.id}/pto`)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="Configure PTO"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRemoveModal({ open: true, employee })}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      disabled={submitting}
                      title="Remove from client"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Remove Employee Confirmation Modal */}
      <Modal
        isOpen={removeModal.open}
        onClose={() => setRemoveModal({ open: false, employee: null })}
        title="Remove Employee"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to remove{' '}
            <span className="font-semibold text-gray-900">
              {removeModal.employee?.firstName} {removeModal.employee?.lastName}
            </span>{' '}
            from this client?
          </p>
          <p className="text-sm text-gray-500">
            This will unassign the employee from this client. Their account and records will not be deleted.
          </p>
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => setRemoveModal({ open: false, employee: null })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              loading={submitting}
              onClick={async () => {
                await handleRemoveEmployee(removeModal.employee.id);
                setRemoveModal({ open: false, employee: null });
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      {/* Employee Rate Modal */}
      <Modal
        isOpen={showRateModal}
        onClose={closeRateModal}
        title="Set Employee Rate"
        size="sm"
      >
        {selectedEmployee && (
          <form onSubmit={handleUpdateEmployeeRate} className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Avatar
                src={selectedEmployee.profilePhoto}
                name={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                size="sm"
              />
              <div>
                <p className="font-medium text-gray-900">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedEmployee.user?.email}
                </p>
              </div>
            </div>

            {/* Rate Hierarchy Info */}
            <div className="space-y-2">
              {rateFormData.employeeBillingRate > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    Employee Billing Rate
                  </p>
                  <p className="text-sm text-green-600">
                    ${Number(rateFormData.employeeBillingRate).toFixed(2)}
                  </p>
                </div>
              )}
              {rateFormData.clientGroupBillingRate > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium mb-1">
                    Client Group Rate
                    {rateFormData.groupName
                      ? ` (${rateFormData.groupName})`
                      : ""}
                  </p>
                  <p className="text-sm text-purple-600">
                    ${Number(rateFormData.clientGroupBillingRate).toFixed(2)}
                  </p>
                </div>
              )}
              {rateFormData.groupBillingRate > 0 &&
                !rateFormData.clientGroupBillingRate && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-800 font-medium mb-1">
                      Group Default Rate
                      {rateFormData.groupName
                        ? ` (${rateFormData.groupName})`
                        : ""}
                    </p>
                    <p className="text-sm text-purple-600">
                      ${Number(rateFormData.groupBillingRate).toFixed(2)}
                    </p>
                  </div>
                )}
              {(Number(rateFormData.defaultHourlyRate) > 0 ||
                Number(rateFormData.defaultOvertimeRate) > 0) && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    Client Default Rates
                  </p>
                  <p className="text-sm text-blue-600">
                    Billing: $
                    {Number(rateFormData.defaultHourlyRate || 0).toFixed(2)} |
                    Overtime: $
                    {Number(rateFormData.defaultOvertimeRate || 0).toFixed(2) ||
                      "1x"}
                  </p>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Set a custom rate for this employee on this client. Leave blank to use the fallback rates (employee rate &gt; group rate &gt; client default).
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Use default"
                  value={rateFormData.hourlyRate}
                  onChange={(e) => setRateFormData({ ...rateFormData, hourlyRate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overtime Multiplier (x)
                </label>
                <input
                  type="number"
                  step="0"
                  min="1"
                  placeholder="1"
                  value={rateFormData.overtimeMultiplier ?? '1'}
                  onChange={(e) =>
                    setRateFormData({
                      ...rateFormData,
                      overtimeMultiplier: e.target.value,
                      isOvertimeMultiplierDirty: true,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" type="button" onClick={closeRateModal}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Save Rate
              </Button>
            </div>
          </form>
        )}
      </Modal>


      {/* Bulk Holiday Config Modal */}
      <Modal
        isOpen={showHolidayConfigModal}
        onClose={closeHolidayConfigModal}
        title="Holiday Config — All Employees"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              This applies to all employees of{" "}
              <strong>{client?.companyName}</strong>. Use per-employee PTO
              config (Calendar icon) to override for individual employees.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={holidayConfigForm.allowPaidHolidays}
                onChange={(e) =>
                  setHolidayConfigForm({
                    ...holidayConfigForm,
                    allowPaidHolidays: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Allow Paid Holidays
                </span>
                <p className="text-xs text-gray-500">
                  Employees will be paid for designated holidays
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={holidayConfigForm.allowUnpaidHolidays}
                onChange={(e) =>
                  setHolidayConfigForm({
                    ...holidayConfigForm,
                    allowUnpaidHolidays: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Allow Unpaid Holidays
                </span>
                <p className="text-xs text-gray-500">
                  Employees can take unpaid days off on holidays
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={closeHolidayConfigModal}
              disabled={savingHolidayConfig}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveHolidayConfig}
              loading={savingHolidayConfig}
            >
              Save for All Employees
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientEmployees;
