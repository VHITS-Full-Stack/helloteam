import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Eye,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../../components/common';
import { useEmployeeData } from '../../../hooks/useEmployeeData';

const Employees = () => {
  const navigate = useNavigate();

  const {
    employees,
    stats,
    pagination,
    searchQuery,
    loading,
    error,
    setSearchQuery,
    setError,
    setPagination,
    refresh,
  } = useEmployeeData({ mode: 'list' });

  const getStatusBadge = (employee) => {
    if (employee.terminationDate) {
      return <Badge variant="error">Terminated</Badge>;
    }
    if (employee.onboardingStatus !== 'COMPLETED') {
      return <Badge variant="default">Inactive</Badge>;
    }
    const status = employee.user?.status;
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="default">Inactive</Badge>;
      case 'SUSPENDED':
        return <Badge variant="error">Suspended</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getClientAndGroup = (employee) => {
    const client = employee.clientAssignments?.[0]?.client?.companyName;
    const group = employee.groupAssignments?.[0]?.group?.name;
    if (!client && !group) return <span className="text-gray-400">Unassigned</span>;
    return (
      <div>
        <p className="text-sm text-gray-900">{client || 'Unassigned'}</p>
        {group && <p className="text-xs text-gray-400">{group}</p>}
      </div>
    );
  };

  const getRates = (employee) => {
    const pay = employee.payableRate != null ? `$${Number(employee.payableRate).toFixed(2)}` : '—';
    let bill = '—';
    if (employee.billingRate) {
      bill = `$${Number(employee.billingRate).toFixed(2)}`;
    } else if (employee.clientGroupBillingRate) {
      bill = `$${Number(employee.clientGroupBillingRate).toFixed(2)}`;
    } else if (employee.groupAssignments?.[0]?.group?.billingRate) {
      bill = `$${Number(employee.groupAssignments[0].group.billingRate).toFixed(2)}`;
    }
    return (
      <div className="text-sm">
        <span className="text-gray-700">{pay}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-gray-700">{bill}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
          <p className="text-gray-500">Manage employee profiles and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/admin/employees/add')}>
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
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">On Leave</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.onLeave}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
        </div>
      </Card>

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
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => navigate('/admin/employees/add')}>
              Add First Employee
            </Button>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Client / Group</TableHeader>
                <TableHeader>Rates (Pay / Bill)</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Hired</TableHeader>
                <TableHeader className="w-16"></TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={employee.profilePhoto} name={`${employee.firstName} ${employee.lastName}`} size="md" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{employee.user?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getClientAndGroup(employee)}</TableCell>
                  <TableCell>{getRates(employee)}</TableCell>
                  <TableCell>{getStatusBadge(employee)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {employee.hireDate
                        ? new Date(employee.hireDate).toLocaleDateString()
                        : '—'
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/employees/${employee.id}`}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4 text-primary" />
                    </Link>
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
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Employees;
