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
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
} from '../../../components/common';
import { useEmployeeData } from '../../../hooks/useEmployeeData';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    employee,
    schedules,
    timeStats,
    recentRecords,
    loading,
    error,
    formatDate,
    formatTime,
  } = useEmployeeData({ mode: 'detail', id });

  const getStatusBadge = (status) => {
    const variants = {
      ACTIVE: 'success',
      INACTIVE: 'danger',
      SUSPENDED: 'warning',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/admin/employees')}>
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Employee Details</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={Edit} onClick={() => navigate(`/admin/employees/${id}/edit`)}>
            Edit Employee
          </Button>
          <Link to={`/admin/schedules?employee=${id}`}>
            <Button variant="secondary" icon={Calendar}>
              Edit Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* Employee Info Card */}
      <Card padding="lg">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar & Basic Info */}
          <div className="flex items-start gap-4">
            <Avatar
              name={`${employee.firstName} ${employee.lastName}`}
              src={employee.profilePhoto}
              size="xl"
            />
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {employee.firstName} {employee.lastName}
              </h3>
              <p className="text-gray-500">{employee.user?.email}</p>
              <div className="mt-2">
                {getStatusBadge(employee.user?.status || 'ACTIVE')}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-gray-600">
              <Mail className="w-5 h-5 text-gray-400" />
              <span>{employee.user?.email || '-'}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Phone className="w-5 h-5 text-gray-400" />
              <span>{employee.phone || '-'}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span>{employee.address || '-'}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span>Hired: {formatDate(employee.hireDate)}</span>
            </div>
            </div>
        </div>
      </Card>

      {/* Client Assignments Card */}
      {employee.clientAssignments && employee.clientAssignments.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Assigned Clients
            </h3>
            <Badge variant="default">{employee.clientAssignments.length} Client{employee.clientAssignments.length !== 1 ? 's' : ''}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employee.clientAssignments.map((assignment, index) => {
              const client = assignment.client || assignment;
              return (
                <Link
                  key={index}
                  to={`/admin/clients/${client.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {client.companyName || 'Unknown Client'}
                    </p>
                    {client.contactPerson && (
                      <p className="text-sm text-gray-500 truncate">{client.contactPerson}</p>
                    )}
                    {assignment.assignedAt && (
                      <p className="text-xs text-gray-400">
                        Since {formatDate(assignment.assignedAt)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Work Schedule
            </h3>
            <Link to={`/admin/schedules?employee=${id}`}>
              <Button variant="ghost" size="sm" icon={Edit}>
                Edit
              </Button>
            </Link>
          </div>

          {schedules.length > 0 ? (
            <div className="space-y-2">
              {DAYS_OF_WEEK.map((day, index) => {
                const schedule = schedules.find(s => s.dayOfWeek === index);
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      schedule ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <span className={`font-medium ${schedule ? 'text-green-800' : 'text-gray-500'}`}>
                      {day}
                    </span>
                    {schedule ? (
                      <span className="text-green-700">
                        {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Day Off</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No schedule configured</p>
              <Link to={`/admin/schedules?employee=${id}`} className="text-primary hover:underline text-sm">
                Set up schedule
              </Link>
            </div>
          )}
        </Card>

        {/* Time Analytics Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              This Month's Analytics
            </h3>
          </div>

          {timeStats ? (
            <div className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 mb-1">Total Hours</p>
                  <p className="text-2xl font-bold text-blue-700">{timeStats.totalHours}h</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-orange-600 mb-1">Overtime</p>
                  <p className="text-2xl font-bold text-orange-700">{timeStats.overtimeHours}h</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 mb-1">Work Days</p>
                  <p className="text-2xl font-bold text-green-700">{timeStats.workDays}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-600 mb-1">Avg/Day</p>
                  <p className="text-2xl font-bold text-purple-700">{timeStats.avgHoursPerDay}h</p>
                </div>
              </div>

              {/* Recent Records */}
              {recentRecords.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Time Records</h4>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {recentRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                      >
                        <span className="text-gray-600">{formatDate(record.date)}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">
                            {Math.round(record.totalMinutes / 60 * 10) / 10}h
                          </span>
                          <Badge
                            variant={
                              record.status === 'APPROVED' ? 'success' :
                              record.status === 'REJECTED' ? 'danger' : 'warning'
                            }
                            size="sm"
                          >
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No time records this month</p>
            </div>
          )}
        </Card>
      </div>

      {/* Emergency Contact */}
      {employee.emergencyContact && (
        <Card padding="md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{employee.emergencyContact.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Relationship</p>
              <p className="font-medium">{employee.emergencyContact.relationship || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{employee.emergencyContact.phone || '-'}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default EmployeeDetail;
