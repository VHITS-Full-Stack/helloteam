import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Edit,
  Loader2,
  AlertCircle,
  Building2,
  DollarSign,
  UserX,
  Trash2,
  UserPlus,
  UserCheck,
  Users,
  Heart,
  Eye,
  Sun,
  FileText,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
} from '../../../components/common';
import { useEmployeeData } from '../../../hooks/useEmployeeData';
import { useAuth } from '../../../context/AuthContext';
import adminPortalService from '../../../services/adminPortal.service';

import { formatDuration } from '../../../utils/formatTime';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="flex items-center gap-2 text-xs text-gray-500">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
    <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">{value || '—'}</span>
  </div>
);

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { impersonate, user: currentUser } = useAuth();
  const [impersonating, setImpersonating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const res = await adminPortalService.getRaiseRequests({ status: 'PENDING' });
        if (res.success) {
          setPendingRequests((res.data?.requests || []).filter((r) => r.employeeId === id));
        }
      } catch (e) { /* ignore */ }
    };
    if (id) fetchPendingRequests();
  }, [id]);

  const handleImpersonate = async () => {
    if (!employee?.user?.id) return;
    setImpersonating(true);
    const result = await impersonate(employee.user.id);
    if (!result.success) {
      alert(result.error || 'Failed to impersonate');
    }
    setImpersonating(false);
  };

  const {
    employee,
    employeePtoConfig,
    activeClientHolidays,
    schedules,
    timeStats,
    recentRecords,
    loading,
    error,
    formatDate,
    formatTime,
    // Terminate
    showTerminateModal,
    terminationDate,
    setTerminationDate,
    openTerminateModal,
    closeTerminateModal,
    handleTerminate,
    // Reactivate
    handleReactivate,
    // Delete
    showDeleteModal,
    openDeleteModal,
    closeDeleteModal,
    handleDelete,
    // Assign
    showAssignModal,
    clients,
    clientGroups,
    selectedClientId,
    selectedGroupId,
    setSelectedGroupId,
    openAssignModal,
    closeAssignModal,
    handleSelectClient,
    handleAssignToClient,
    // Shared
    submitting,
    modalError,
    approveKyc,
    rejectKyc,
    refresh,
  } = useEmployeeData({ mode: 'detail', id });

  const getStatusBadge = () => {
    if (employee?.terminationDate) {
      return <Badge variant="error">Terminated</Badge>;
    }
    const status = employee?.user?.status || 'ACTIVE';
    const variants = {
      ACTIVE: 'success',
      INACTIVE: 'default',
      SUSPENDED: 'warning',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const onDelete = async () => {
    const success = await handleDelete();
    if (success) {
      navigate('/admin/employees');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/admin/employees')}>
          Back to Employees
        </Button>
        <Card padding="lg">
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Employee</h3>
            <p className="text-gray-500">{error || 'Employee not found'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const activeClient = employee.clientAssignments?.find(a => a.isActive);
  const groupAssignment = employee.groupAssignments?.[0];
  const isTerminated = !!employee.terminationDate;
  const isPendingOnboarding = employee.onboardingStatus === 'PENDING_AGREEMENT';
  const kycStatus = employee.kycStatus || 'PENDING';

  // Billing rate resolution
  const billingRateDisplay = employee.billingRate
    ? `$${Number(employee.billingRate).toFixed(2)}`
    : '—';
  const groupBillingRate = groupAssignment?.group?.billingRate
    ? `$${Number(groupAssignment.group.billingRate).toFixed(2)}`
    : '—';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/employees')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <Avatar
          name={`${employee.firstName} ${employee.lastName}`}
          src={employee.profilePhoto}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {employee.firstName} {employee.lastName}
            </h2>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-500 truncate">{employee.user?.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && !isTerminated && employee.user?.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              icon={Eye}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={handleImpersonate}
              loading={impersonating}
            >
              Impersonate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            icon={Edit}
            onClick={() => navigate(`/admin/employees/${id}/edit`)}
          >
            Edit
          </Button>
          {isTerminated ? (
            <Button
              variant="outline"
              size="sm"
              icon={UserCheck}
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={handleReactivate}
              loading={submitting}
            >
              Reactivate
            </Button>
          ) : employee.user?.status === 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              icon={UserX}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={openTerminateModal}
            >
              Terminate
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            icon={Trash2}
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={openDeleteModal}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Banners */}
      {isPendingOnboarding && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700">Employee onboarding is pending — agreement not yet completed.</p>
        </div>
      )}
      {/* KYC Status */}
      <div className={`rounded-2xl p-4 ${
        kycStatus === 'APPROVED' ? 'bg-green-50 border border-green-200' :
        kycStatus === 'REJECTED' ? 'bg-red-50 border border-red-200' :
        kycStatus === 'RESUBMITTED' ? 'bg-blue-50 border border-blue-200' :
        'bg-amber-50 border border-amber-200'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">KYC Status</p>
            <p className="text-sm text-gray-700 mt-1">
              {kycStatus === 'APPROVED' && 'All identity documents have been approved. Employee can access the portal.'}
              {kycStatus === 'PENDING' && 'KYC review is pending. Employee cannot access the portal until KYC is approved.'}
              {kycStatus === 'REJECTED' && 'KYC was rejected. Employee has been emailed to re-upload documents.'}
              {kycStatus === 'RESUBMITTED' && 'Employee has resubmitted their documents. Please review the updated documents.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                kycStatus === 'APPROVED'
                  ? 'success'
                  : kycStatus === 'REJECTED'
                    ? 'error'
                    : kycStatus === 'RESUBMITTED'
                      ? 'info'
                      : 'warning'
              }
            >
              {kycStatus}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              icon={FileText}
              onClick={() => navigate(`/admin/employees/${id}/documents`)}
            >
              Review Documents
            </Button>
          </div>
        </div>
      </div>
      {isTerminated && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <UserX className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            This employee was terminated on <strong>{formatDate(employee.terminationDate)}</strong>.
          </p>
        </div>
      )}

      {/* Pending Bonus/Raise Requests */}
      {pendingRequests.length > 0 && (
        <div className="rounded-2xl p-4 bg-purple-50 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-semibold text-purple-700">
                {pendingRequests.length} Pending {pendingRequests.length === 1 ? 'Request' : 'Requests'}
              </p>
            </div>
            <Link to="/admin/raise-requests">
              <Button variant="ghost" size="sm">Review</Button>
            </Link>
          </div>
          <div className="space-y-1.5 ml-6">
            {pendingRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                {r.type === 'BONUS' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Bonus</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Raise</span>
                )}
                <span className="text-gray-700">
                  {r.type === 'BONUS' ? (
                    <><span className="font-semibold">${Number(r.amount).toFixed(2)}</span> from {r.client.companyName}</>
                  ) : (
                    <><span className="font-semibold">${Number(r.billRate).toFixed(2)}</span> from {r.client.companyName}</>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { key: 'overview', label: 'Overview', icon: Mail },
            { key: 'schedule', label: 'Schedule & Rates', icon: Calendar },
            { key: 'time', label: 'Time & Stats', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Contact Information</h3>
            <InfoRow label="Email" value={employee.user?.email} icon={Mail} />
            <InfoRow label="Phone" value={employee.phone ? `${employee.countryCode || '+1'} ${employee.phone}` : null} icon={Phone} />
            <InfoRow label="Personal Email" value={employee.personalEmail} icon={Mail} />
            <InfoRow label="Address" value={employee.address} icon={MapPin} />
            <InfoRow label="Hire Date" value={formatDate(employee.hireDate)} icon={Calendar} />
            {employee.terminationDate && (
              <InfoRow label="Termination Date" value={formatDate(employee.terminationDate)} icon={UserX} />
            )}
          </Card>

          <div className="space-y-4">
            {/* Assignment */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Assignment</h3>
                <Button variant="ghost" size="sm" icon={UserPlus} onClick={openAssignModal}>
                  {activeClient ? 'Reassign' : 'Assign'}
                </Button>
              </div>
              {activeClient ? (
                <div className="space-y-1">
                  <InfoRow
                    label="Client"
                    value={
                      <Link to={`/admin/clients/${activeClient.client?.id}`} className="text-primary hover:underline">
                        {activeClient.client?.companyName}
                      </Link>
                    }
                    icon={Building2}
                  />
                  <InfoRow label="Group" value={groupAssignment?.group?.name} icon={Users} />
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">Not assigned to any client</p>
              )}
            </Card>

            {/* Emergency Contacts */}
            {employee.emergencyContacts && employee.emergencyContacts.length > 0 && (
              <Card padding="md">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Emergency Contacts</h3>
                <div className="space-y-3">
                  {employee.emergencyContacts.map((contact, i) => (
                    <div key={contact.id || i} className="p-2.5 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {contact.countryCode || '+1'} {contact.phone}
                        </span>
                        <span className="text-xs text-gray-400">{contact.relationship}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Schedule & Rates Tab */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rates */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Rates</h3>
            <InfoRow
              label="Payable Rate"
              value={employee.payableRate ? `$${Number(employee.payableRate).toFixed(2)}/hr` : null}
              icon={DollarSign}
            />
            <InfoRow
              label="Billing Rate"
              value={billingRateDisplay !== '—' ? `${billingRateDisplay}/hr` : null}
              icon={DollarSign}
            />
            <InfoRow
              label="Group Billing Rate"
              value={groupBillingRate !== '—' ? `${groupBillingRate}/hr` : null}
              icon={Users}
            />
          </Card>

          {/* Work Schedule */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Work Schedule</h3>
              <Link to={`/admin/schedules?employee=${id}`}>
                <Button variant="ghost" size="sm" icon={Edit}>Edit</Button>
              </Link>
            </div>
            {schedules.length > 0 ? (
              <div className="space-y-1">
                {DAYS_OF_WEEK.map((day, index) => {
                  const schedule = schedules.find(s => s.dayOfWeek === index);
                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${schedule ? 'bg-green-50' : 'bg-gray-50'}`}
                    >
                      <span className={`text-xs font-medium ${schedule ? 'text-green-800' : 'text-gray-400'}`}>
                        {day.slice(0, 3)}
                      </span>
                      {schedule ? (
                        <span className="text-xs text-green-700">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</span>
                      ) : (
                        <span className="text-xs text-gray-300">Off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                <p className="text-xs">No schedule configured</p>
                <Link to={`/admin/schedules?employee=${id}`} className="text-primary hover:underline text-xs">Set up schedule</Link>
              </div>
            )}
          </Card>

          {/* Holiday Policy */}
          {(employeePtoConfig?.effective || (activeClientHolidays && activeClientHolidays.length > 0)) && (
            <Card padding="md">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Holiday Policy</h3>
              {employeePtoConfig?.effective && (
                <>
                  <InfoRow label="Paid Holidays" value={employeePtoConfig.effective.allowPaidHolidays ? 'Yes' : 'No'} icon={Calendar} />
                  <InfoRow label="Unpaid Holidays" value={employeePtoConfig.effective.allowUnpaidHolidays ? 'Yes' : 'No'} icon={Calendar} />
                  {employeePtoConfig.effective.source && (
                    <InfoRow label="Source" value={employeePtoConfig.effective.source === 'employee_override' ? 'Employee override' : 'Client policy'} icon={Edit} />
                  )}
                </>
              )}
              {activeClientHolidays && activeClientHolidays.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-gray-500 mt-3 mb-1">Upcoming Holidays</h4>
                  <ul className="text-sm space-y-1">
                    {activeClientHolidays.filter(h => new Date(h.date) >= new Date()).map((h) => (
                      <li key={h.id} className="flex justify-between">
                        <span>{formatDate(h.date)}</span>
                        <span className="text-gray-700 truncate ml-2">{h.name}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Time & Stats Tab */}
      {activeTab === 'time' && (
        <div className="space-y-4">
          {/* Monthly Stats */}
          {timeStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/60 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Total Hours</p>
                <p className="text-xl font-bold text-blue-700 mt-0.5">{formatDuration(timeStats.totalMinutes)}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/60 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider">Overtime</p>
                <p className="text-xl font-bold text-orange-700 mt-0.5">{formatDuration(timeStats.overtimeMinutes)}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200/60 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider">Work Days</p>
                <p className="text-xl font-bold text-green-700 mt-0.5">{timeStats.workDays}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/60 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Avg/Day</p>
                <p className="text-xl font-bold text-purple-700 mt-0.5">{formatDuration(timeStats.avgMinutesPerDay)}</p>
              </div>
            </div>
          ) : (
            <Card>
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                <p className="text-sm">No time records this month</p>
              </div>
            </Card>
          )}

          {/* Recent Records */}
          {recentRecords.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Recent Records</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-gray-200">
                    <th className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-4">Date</th>
                    <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Duration</th>
                    <th className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-4 text-sm text-gray-900">{formatDate(record.date)}</td>
                      <td className="py-2.5 px-3 text-center text-sm font-semibold text-gray-900">{formatDuration(record.totalMinutes || 0)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={record.status === 'APPROVED' ? 'success' : record.status === 'REJECTED' ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {record.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ── Terminate Modal ── */}
      <Modal
        isOpen={showTerminateModal}
        onClose={closeTerminateModal}
        title="Terminate Employee"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            This will set <strong>{employee.firstName} {employee.lastName}</strong>'s status to Inactive,
            record the termination date, and deactivate all client assignments.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Termination Date</label>
            <input
              type="date"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
            />
          </div>

          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{modalError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeTerminateModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleTerminate}
              loading={submitting}
              disabled={!terminationDate}
            >
              Terminate
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Employee"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete <strong>{employee.firstName} {employee.lastName}</strong>?
            This will deactivate their account.
          </p>

          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{modalError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700"
              onClick={onDelete}
              loading={submitting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Assign to Client Modal ── */}
      <Modal
        isOpen={showAssignModal}
        onClose={closeAssignModal}
        title="Assign to Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Assign <strong>{employee.firstName} {employee.lastName}</strong> to a client:
          </p>
          {activeClient && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                Currently assigned to <strong>{activeClient.client?.companyName}</strong>. Assigning to a new client will remove the existing assignment.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
            <select
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              value={selectedClientId}
              onChange={(e) => handleSelectClient(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
          </div>

          {selectedClientId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Group (Optional)</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">No group</option>
                {clientGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.employees?.length || 0} employees)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Optionally add to a group under the selected client</p>
            </div>
          )}

          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{modalError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeAssignModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignToClient}
              disabled={!selectedClientId}
              loading={submitting}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default EmployeeDetail;
