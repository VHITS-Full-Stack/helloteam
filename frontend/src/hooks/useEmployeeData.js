import { useState, useEffect, useCallback, useRef } from 'react';
import employeeService from '../services/employee.service';
import clientService from '../services/client.service';
import groupService from '../services/group.service';
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
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const prevSearchRef = useRef(searchQuery);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [clientGroups, setClientGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, onLeave: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const fetchingEmployeesRef = useRef(false);
  const fetchingStatsRef = useRef(false);
  const fetchingClientsRef = useRef(false);

  const fetchEmployees = useCallback(async () => {
    if (fetchingEmployeesRef.current) return;
    fetchingEmployeesRef.current = true;
    try {
      setLoading(true);
      const response = await employeeService.getEmployees({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQueryRef.current,
      });

      if (response.success) {
        setEmployees(response.data.employees);
        const p = response.data.pagination;
        setPagination(prev => ({
          ...prev,
          total: p.total ?? prev.total,
          totalPages: p.totalPages ?? prev.totalPages,
        }));
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch employees');
    } finally {
      setLoading(false);
      fetchingEmployeesRef.current = false;
    }
  }, [pagination.page, pagination.limit]);

  const fetchStats = async () => {
    if (fetchingStatsRef.current) return;
    fetchingStatsRef.current = true;
    try {
      const response = await employeeService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      fetchingStatsRef.current = false;
    }
  };

  const fetchClients = async () => {
    if (fetchingClientsRef.current) return;
    fetchingClientsRef.current = true;
    try {
      const response = await clientService.getClients({ limit: 100 });
      if (response.success) {
        setClients(response.data.clients);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      fetchingClientsRef.current = false;
    }
  };

  // Fetch employees on mount and pagination change
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Fetch stats only on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Debounce search - skip if search hasn't actually changed
  useEffect(() => {
    if (prevSearchRef.current === searchQuery) return;
    prevSearchRef.current = searchQuery;
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

  const fetchClientGroups = async (clientId) => {
    if (!clientId) {
      setClientGroups([]);
      return;
    }
    try {
      const response = await groupService.getGroups({ limit: 100 });
      if (response.success) {
        const filtered = response.data.groups.filter((group) =>
          group.clients?.some((cg) => {
            const cid = cg.client?.id || cg.clientId;
            return cid === clientId;
          })
        );
        setClientGroups(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch client groups:', err);
      setClientGroups([]);
    }
  };

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedGroupId('');
    fetchClientGroups(clientId);
  };

  const handleAssignToClient = async () => {
    if (!selectedEmployee || !selectedClientId) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await employeeService.assignToClient(selectedEmployee.id, selectedClientId);
      if (response.success) {
        // Also add to group if selected
        if (selectedGroupId) {
          try {
            await groupService.addEmployees(selectedGroupId, [selectedEmployee.id]);
          } catch (groupErr) {
            console.error('Failed to add employee to group:', groupErr);
          }
        }
        setShowAssignModal(false);
        setSelectedEmployee(null);
        setSelectedClientId('');
        setSelectedGroupId('');
        setClientGroups([]);
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
    if (clients.length === 0) fetchClients();
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedEmployee(null);
    setSelectedClientId('');
    setSelectedGroupId('');
    setClientGroups([]);
    setError('');
  };

  const refresh = () => {
    fetchEmployees();
    fetchStats();
  };

  return {
    employees,
    clients,
    clientGroups,
    stats,
    pagination,
    searchQuery,
    selectedEmployee,
    selectedClientId,
    selectedGroupId,
    loading,
    error,
    submitting,
    showDeleteModal,
    showAssignModal,
    setSearchQuery,
    setError,
    setPagination,
    setSelectedGroupId,
    openDeleteModal,
    closeDeleteModal,
    openAssignModal,
    closeAssignModal,
    handleSelectClient,
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
