import { useState, useEffect, useCallback, useRef } from 'react';
import employeeService from '../services/employee.service';
import clientService from '../services/client.service';
import api from '../services/api';
import scheduleService from '../services/schedule.service';

/**
 * Custom hook for employee data fetching and state management
 * Supports two modes: 'list' for employee listing and 'detail' for employee detail view
 * @param {Object} params
 * @param {'list'|'detail'} params.mode - Hook operating mode
 * @param {string} params.id - Employee ID (required for detail mode)
 */
export const useEmployeeData = ({ mode = 'list', id } = {}) => {
  if (mode === 'detail') {
    return useEmployeeDetail(id);
  }
  return useEmployeeList();
};

// ── List Mode ──────────────────────────────────────────────

function useEmployeeList() {
  const [searchQuery, setSearchQuery] = useState('');
  const isInitialMount = useRef(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, onLeave: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await employeeService.getEmployees({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });

      if (response.success) {
        setEmployees(response.data.employees);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination,
        }));
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery]);

  const fetchStats = async () => {
    try {
      const response = await employeeService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await clientService.getClients({ limit: 100 });
      if (response.success) {
        setClients(response.data.clients);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchStats();
    fetchClients();
  }, [fetchEmployees]);

  // Debounce search - skip initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchEmployees();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.deleteEmployee(selectedEmployee.id);
      if (response.success) {
        setShowDeleteModal(false);
        setSelectedEmployee(null);
        setError('');
        fetchEmployees();
        fetchStats();
      } else {
        setError(response.error || 'Failed to delete employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToClient = async (clientId) => {
    if (!selectedEmployee || !clientId) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.assignToClient(selectedEmployee.id, clientId);
      if (response.success) {
        setShowAssignModal(false);
        setSelectedEmployee(null);
        setError('');
        fetchEmployees();
      } else {
        setError(response.error || 'Failed to assign employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to assign employee');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedEmployee(null);
    setError('');
  };

  const openAssignModal = (employee) => {
    setSelectedEmployee(employee);
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedEmployee(null);
    setError('');
  };

  const refresh = () => {
    fetchEmployees();
    fetchStats();
  };

  return {
    employees,
    clients,
    stats,
    pagination,
    searchQuery,
    selectedEmployee,
    loading,
    error,
    submitting,
    showDeleteModal,
    showAssignModal,
    setSearchQuery,
    setError,
    setPagination,
    openDeleteModal,
    closeDeleteModal,
    openAssignModal,
    closeAssignModal,
    handleDeleteEmployee,
    handleAssignToClient,
    refresh,
  };
}

// ── Detail Mode ────────────────────────────────────────────

function useEmployeeDetail(id) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [timeStats, setTimeStats] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);

  const fetchEmployeeDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employee info
      const empResponse = await api.get(`/employees/${id}`);
      if (empResponse.success) {
        setEmployee(empResponse.data);
      }

      // Fetch employee schedule (non-fatal)
      try {
        const scheduleResponse = await scheduleService.getEmployeeSchedule(id);
        if (scheduleResponse.success) {
          setSchedules(scheduleResponse.schedules || []);
        }
      } catch (scheduleErr) {
        console.error('Error fetching schedule:', scheduleErr);
      }

      // Fetch time records for analytics (non-fatal)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      try {
        const timeResponse = await api.get(`/admin-portal/time-records?employeeId=${id}&startDate=${startOfMonth}&endDate=${endOfMonth}`);
        if (timeResponse.success) {
          const records = timeResponse.data?.records || timeResponse.records || [];
          setRecentRecords(records.slice(0, 10));

          const totalMinutes = records.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
          const overtimeMinutes = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
          const workDays = records.length;
          const avgMinutesPerDay = workDays > 0 ? Math.round(totalMinutes / workDays) : 0;

          setTimeStats({
            totalHours: Math.round(totalMinutes / 60 * 10) / 10,
            overtimeHours: Math.round(overtimeMinutes / 60 * 10) / 10,
            workDays,
            avgHoursPerDay: Math.round(avgMinutesPerDay / 60 * 10) / 10,
          });
        }
      } catch (timeErr) {
        console.error('Error fetching time records:', timeErr);
      }
    } catch (err) {
      console.error('Error fetching employee details:', err);
      setError(err.message || 'Failed to load employee details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployeeDetails();
  }, [fetchEmployeeDetails]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const refresh = () => {
    fetchEmployeeDetails();
  };

  return {
    employee,
    schedules,
    timeStats,
    recentRecords,
    loading,
    error,
    formatDate,
    formatTime,
    refresh,
  };
}

export default useEmployeeData;
