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
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, onLeave: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const fetchingEmployeesRef = useRef(false);
  const fetchingStatsRef = useRef(false);

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

  const refresh = () => {
    fetchEmployees();
    fetchStats();
  };

  return {
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
  const [employeePtoConfig, setEmployeePtoConfig] = useState(null); // includes holidays
  const [activeClientHolidays, setActiveClientHolidays] = useState([]);

  // Modal states
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [terminationDate, setTerminationDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [clients, setClients] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchEmployeeDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employee info
      const empResponse = await api.get(`/employees/${id}`);
      if (empResponse.success) {
        setEmployee(empResponse.data);

        // if the employee is actively assigned to a client, pull their PTO config
        const activeAssignment = empResponse.data.clientAssignments?.find(a => a.isActive);
        if (activeAssignment && activeAssignment.client) {
          try {
            const ptoResp = await clientService.getEmployeePtoConfig(activeAssignment.client.id, id);
            if (ptoResp.success) {
              setEmployeePtoConfig(ptoResp.data);
            }
          } catch (ptErr) {
            console.error('Failed to fetch PTO config:', ptErr);
          }

          // also grab holidays defined for the client
          try {
            const clientResp = await clientService.getClient(activeAssignment.client.id);
            if (clientResp.success) {
              setActiveClientHolidays(clientResp.data.holidays || []);
            }
          } catch (cErr) {
            console.error('Failed to fetch client holidays:', cErr);
          }
        }
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

          if (records.length > 0) {
            const totalMinutes = records.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
            const overtimeMinutes = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
            const workDays = records.length;
            const avgMinutesPerDay = Math.round(totalMinutes / workDays);

            setTimeStats({
              totalMinutes,
              overtimeMinutes,
              totalHours: Math.round(totalMinutes / 60 * 100) / 100,
              overtimeHours: Math.round(overtimeMinutes / 60 * 100) / 100,
              workDays,
              avgMinutesPerDay,
              avgHoursPerDay: Math.round(avgMinutesPerDay / 60 * 100) / 100,
            });
          } else {
            setTimeStats(null);
          }
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

  // ── Terminate ──
  const openTerminateModal = () => {
    setTerminationDate(new Date().toISOString().split('T')[0]);
    setModalError('');
    setShowTerminateModal(true);
  };

  const closeTerminateModal = () => {
    setShowTerminateModal(false);
    setTerminationDate('');
    setModalError('');
  };

  const handleTerminate = async () => {
    if (!terminationDate) {
      setModalError('Please select a termination date');
      return;
    }
    setSubmitting(true);
    setModalError('');
    try {
      const response = await employeeService.terminateEmployee(id, terminationDate);
      if (response.success) {
        setShowTerminateModal(false);
        setTerminationDate('');
        setModalError('');
        fetchEmployeeDetails();
      } else {
        setModalError(response.error || 'Failed to terminate employee');
      }
    } catch (err) {
      setModalError(err.error || err.message || 'Failed to terminate employee');
    } finally {
      setSubmitting(false);
    }
  };

  // ── KYC Review ──
  const approveKyc = async () => {
    try {
      setSubmitting(true);
      const response = await employeeService.approveKyc(id);
      if (response.success) {
        await fetchEmployeeDetails();
      }
    } catch (err) {
      console.error('Approve KYC error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const rejectKyc = async (reason) => {
    try {
      setSubmitting(true);
      const response = await employeeService.rejectKyc(id, reason);
      if (response.success) {
        await fetchEmployeeDetails();
      }
    } catch (err) {
      console.error('Reject KYC error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const reviewDocument = async (document, action, reason, sendEmail = false) => {
    try {
      setSubmitting(true);
      const response = await employeeService.reviewDocument(id, document, action, reason, sendEmail);
      if (response.success) {
        await fetchEmployeeDetails();
      }
      return response;
    } catch (err) {
      console.error('Review document error:', err);
      return { success: false, error: err.error || 'Failed to review document' };
    } finally {
      setSubmitting(false);
    }
  };

  const finalizeKycReview = async () => {
    try {
      setSubmitting(true);
      const response = await employeeService.finalizeKycReview(id);
      if (response.success) {
        await fetchEmployeeDetails();
      }
      return response;
    } catch (err) {
      console.error('Finalize KYC review error:', err);
      return { success: false, error: err.error || 'Failed to finalize review' };
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reactivate ──
  const handleReactivate = async () => {
    setSubmitting(true);
    setModalError('');
    try {
      const response = await employeeService.reactivateEmployee(id);
      if (response.success) {
        fetchEmployeeDetails();
      } else {
        setModalError(response.error || 'Failed to reactivate employee');
      }
    } catch (err) {
      setModalError(err.error || err.message || 'Failed to reactivate employee');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──
  const openDeleteModal = () => {
    setModalError('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setModalError('');
  };

  const handleDelete = async () => {
    setSubmitting(true);
    setModalError('');
    try {
      const response = await employeeService.deleteEmployee(id);
      if (response.success) {
        setShowDeleteModal(false);
        setModalError('');
        // Navigate will be handled by the component
        return true;
      } else {
        setModalError(response.error || 'Failed to delete employee');
        return false;
      }
    } catch (err) {
      setModalError(err.error || err.message || 'Failed to delete employee');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ── Assign to Client ──
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

        // Auto-select the "Default" group if one exists
        const defaultGroup = filtered.find((g) => g.name.toLowerCase() === 'default');
        if (defaultGroup) {
          setSelectedGroupId(defaultGroup.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch client groups:', err);
      setClientGroups([]);
    }
  };

  const openAssignModal = () => {
    setSelectedClientId('');
    setSelectedGroupId('');
    setClientGroups([]);
    setModalError('');
    setShowAssignModal(true);
    if (clients.length === 0) fetchClients();
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedClientId('');
    setSelectedGroupId('');
    setClientGroups([]);
    setModalError('');
  };

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedGroupId('');
    fetchClientGroups(clientId);
  };

  const handleAssignToClient = async () => {
    if (!selectedClientId) return;
    setSubmitting(true);
    setModalError('');
    try {
      const response = await employeeService.assignToClient(id, selectedClientId);
      if (response.success) {
        if (selectedGroupId) {
          try {
            await groupService.addEmployees(selectedGroupId, [id]);
          } catch (groupErr) {
            console.error('Failed to add employee to group:', groupErr);
          }
        }
        setShowAssignModal(false);
        setSelectedClientId('');
        setSelectedGroupId('');
        setClientGroups([]);
        setModalError('');
        fetchEmployeeDetails();
      } else {
        setModalError(response.error || 'Failed to assign employee');
      }
    } catch (err) {
      setModalError(err.error || err.message || 'Failed to assign employee');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Utilities ──
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
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
    employeePtoConfig,
    activeClientHolidays,
    schedules,
    timeStats,
    recentRecords,
    loading,
    error,
    formatDate,
    formatTime,
    refresh,
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
    // Shared modal state
    submitting,
    modalError,
    approveKyc,
    rejectKyc,
    reviewDocument,
    finalizeKycReview,
  };
}

export default useEmployeeData;
