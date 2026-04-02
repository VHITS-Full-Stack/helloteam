import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Mail,
  ChevronDown,
  Users,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Avatar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "../../../components/common";
import { useEmployeeList } from "../../../hooks/useEmployeeData";
import employeeService from "../../../services/employee.service";
import clientService from "../../../services/client.service";

const Employees = () => {
  const navigate = useNavigate();
  const [resendingId, setResendingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMsg]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await clientService.getClients({ limit: 100 });
        if (res.success) setClients(res.data.clients || []);
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      }
    };
    fetchClients();
  }, []);

  const {
    employees,
    stats,
    pagination,
    searchQuery,
    filters,
    loading,
    error,
    setSearchQuery,
    setFilters,
    setError,
    setPagination,
    refresh,
  } = useEmployeeList();

  const getStatusBadge = (employee) => {
    if (employee.terminationDate) {
      return <Badge variant="error">Terminated</Badge>;
    }
    if (employee.onboardingStatus !== "COMPLETED") {
      return <Badge variant="default">Inactive</Badge>;
    }
    const status = employee.user?.status;
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "INACTIVE":
        return <Badge variant="default">Inactive</Badge>;
      case "SUSPENDED":
        return <Badge variant="error">Suspended</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getClientAndGroup = (employee) => {
    const client = employee.clientAssignments?.[0]?.client?.companyName;
    const group = employee.groupAssignments?.[0]?.group?.name;
    if (!client && !group)
      return <span className="text-gray-400">Unassigned</span>;
    return (
      <div>
        <p className="text-sm text-gray-900">{client || "Unassigned"}</p>
        {group && <p className="text-xs text-gray-400">{group}</p>}
      </div>
    );
  };

  const getRates = (employee) => {
    const pay =
      employee.payableRate !== null
        ? `$${Number(employee.payableRate).toFixed(2)}`
        : "—";
    let bill = "—";
    if (employee.billingRate) {
      bill = `$${Number(employee.billingRate).toFixed(2)}`;
    } else if (employee.clientGroupBillingRate) {
      bill = `$${Number(employee.clientGroupBillingRate).toFixed(2)}`;
    } else if (employee.groupAssignments?.[0]?.group?.billingRate) {
      bill = `$${Number(employee.groupAssignments[0].group.billingRate).toFixed(2)}`;
    }
    const otMultiplier =
      employee.overtimeRate !== null && Number(employee.overtimeRate) > 0
        ? `${Number(employee.overtimeRate)}x`
        : "1x";
    return (
      <div className="text-sm">
        <span className="text-gray-700">{pay}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-gray-700">{bill}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-gray-500">{otMultiplier}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Employee Management
          </h2>
          <p className="text-gray-500">
            Manage employee profiles and assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate("/admin/employees/add")}
          >
            Add Employee
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
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

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-600">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-green-400 hover:text-green-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-700">{stats.total}</p>
            <p className="text-xs text-blue-600">Total Employees</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-700">{stats.active}</p>
            <p className="text-xs text-green-600">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700">{stats.onLeave}</p>
            <p className="text-xs text-amber-600">On Leave</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-xl">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-500">{stats.inactive}</p>
            <p className="text-xs text-gray-500">Inactive</p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="appearance-none pl-4 pr-9 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filters.clientId}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, clientId: e.target.value }))
            }
            className="appearance-none pl-4 pr-9 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div>
          <input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            title="From date"
          />
        </div>
        <div>
          <input
            type="date"
            value={filters.endDate || ""}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            title="To date"
          />
        </div>
        {(filters.status || filters.clientId || filters.startDate || filters.endDate) && (
          <button
            onClick={() =>
              setFilters({
                status: "",
                clientId: "",
                startDate: "",
                endDate: "",
              })
            }
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Employees Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-gray-500">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No employees found</p>
            <Button
              variant="primary"
              icon={Plus}
              className="mt-4"
              onClick={() => navigate("/admin/employees/add")}
            >
              Add First Employee
            </Button>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader className="whitespace-nowrap">
                  Client / Group
                </TableHeader>
                <TableHeader className="whitespace-nowrap">
                  Rates (Pay / Bill / OT)
                </TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>KYC</TableHeader>
                <TableHeader>Hired</TableHeader>
                <TableHeader>Created</TableHeader>
                <TableHeader className="w-16" />
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/admin/employees/${employee.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={employee.profilePhoto}
                        name={`${employee.firstName} ${employee.lastName}`}
                        size="md"
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
                  </TableCell>
                  <TableCell>{getClientAndGroup(employee)}</TableCell>
                  <TableCell>{getRates(employee)}</TableCell>
                  <TableCell>{getStatusBadge(employee)}</TableCell>
                  <TableCell>
                    {(() => {
                      const kyc = employee.kycStatus || "PENDING";
                      const variant =
                        kyc === "APPROVED"
                          ? "success"
                          : kyc === "REJECTED"
                            ? "danger"
                            : kyc === "RESUBMITTED"
                              ? "info"
                              : "warning";
                      return (
                        <Badge variant={variant} size="sm">
                          {kyc}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {employee.hireDate
                        ? new Date(employee.hireDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {employee.createdAt
                        ? new Date(employee.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {employee.onboardingStatus !== "COMPLETED" && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              setResendingId(employee.id);
                              const res =
                                await employeeService.resendOnboardingEmail(
                                  employee.id,
                                );
                              if (res.success) {
                                setError("");
                                setSuccessMsg(
                                  "Onboarding email sent successfully",
                                );
                              } else {
                                setError(res.error || "Failed to send email");
                              }
                            } catch (err) {
                              setError(err.error || "Failed to send email");
                            } finally {
                              setResendingId(null);
                            }
                          }}
                          disabled={resendingId === employee.id}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                          title="Resend Onboarding Email"
                        >
                          <Mail
                            className={`w-4 h-4 text-blue-600 ${resendingId === employee.id ? "animate-pulse" : ""}`}
                          />
                        </button>
                      )}
                      <Link
                        to={`/admin/employees/${employee.id}`}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {(() => {
                const pages = [];
                const total = pagination.totalPages;
                const current = pagination.page;

                const addPage = (p) => {
                  pages.push(
                    <button
                      key={p}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: p }))
                      }
                      className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                        p === current
                          ? "bg-primary text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>,
                  );
                };

                const addEllipsis = (key) => {
                  pages.push(
                    <span
                      key={key}
                      className="w-9 h-9 flex items-center justify-center text-sm text-gray-400"
                    >
                      ...
                    </span>,
                  );
                };

                if (total <= 7) {
                  for (let i = 1; i <= total; i++) addPage(i);
                } else {
                  addPage(1);
                  if (current > 3) addEllipsis("start");
                  for (
                    let i = Math.max(2, current - 1);
                    i <= Math.min(total - 1, current + 1);
                    i++
                  ) {
                    addPage(i);
                  }
                  if (current < total - 2) addEllipsis("end");
                  addPage(total);
                }
                return pages;
              })()}
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Employees;
