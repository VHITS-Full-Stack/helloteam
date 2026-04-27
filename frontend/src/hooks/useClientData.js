import { useState, useEffect, useCallback, useRef } from 'react';
import clientService from '../services/client.service';
import employeeService from '../services/employee.service';
import groupService from '../services/group.service';
import leavePolicyService from '../services/leavePolicy.service';

/**
 * Custom hook for client data fetching and state management
 * Supports two modes: 'list' for client listing and 'detail' for client detail view
 * @param {Object} params
 * @param {'list'|'detail'} params.mode - Hook operating mode
 * @param {string} params.id - Client ID (required for detail mode)
 */
export const useClientData = ({ mode = 'list', id } = {}) => {
  const list = useClientList();
  const detail = useClientDetail(id);
  return mode === 'detail' ? detail : list;
};

// ── List Mode ──────────────────────────────────────────────

function useClientList() {
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const prevSearchRef = useRef(searchQuery);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const prevFiltersRef = useRef({ status: '', startDate: '', endDate: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [groupsModalClient, setGroupsModalClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalAssignedEmployees: 0,
    activeAssignedEmployees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const fetchingClientsRef = useRef(false);
  const fetchingStatsRef = useRef(false);
  const isFirstFetchRef = useRef(true);

  const fetchClients = useCallback(async () => {
    if (fetchingClientsRef.current) return;
    fetchingClientsRef.current = true;
    try {
      if (isFirstFetchRef.current) setLoading(true);
      else setFetching(true);
      const response = await clientService.getClients({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQueryRef.current,
        status: filtersRef.current.status,
        startDate: filtersRef.current.startDate,
        endDate: filtersRef.current.endDate,
      });

      if (response.success) {
        setClients(response.data.clients);
        const p = response.data.pagination;
        setPagination(prev => ({
          ...prev,
          total: p.total ?? prev.total,
          totalPages: p.totalPages ?? prev.totalPages,
        }));
        isFirstFetchRef.current = false;
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch clients');
    } finally {
      setLoading(false);
      setFetching(false);
      fetchingClientsRef.current = false;
    }
  }, [pagination.page, pagination.limit]);
  const fetchClientsRef = useRef(fetchClients);
  fetchClientsRef.current = fetchClients;

  const fetchStats = async () => {
    if (fetchingStatsRef.current) return;
    fetchingStatsRef.current = true;
    try {
      const response = await clientService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      fetchingStatsRef.current = false;
    }
  };

  // Fetch clients on mount and pagination change
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Fetch stats only on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Debounce search - skip if search hasn't actually changed
  useEffect(() => {
    if (prevSearchRef.current === searchQuery) return undefined;
    prevSearchRef.current = searchQuery;
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchClientsRef.current();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Re-fetch when filters change (not when pagination/fetchClients changes)
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed =
      prev.status !== filters.status ||
      prev.startDate !== filters.startDate ||
      prev.endDate !== filters.endDate;
    if (!changed) return;
    prevFiltersRef.current = { status: filters.status, startDate: filters.startDate, endDate: filters.endDate };
    if (pagination.page === 1) {
      fetchClientsRef.current();
    } else {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.startDate, filters.endDate]);

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.deleteClient(selectedClient.id);
      if (response.success) {
        setShowDeleteModal(false);
        setSelectedClient(null);
        setError('');
        fetchClients();
        fetchStats();
      } else {
        setError(response.error || 'Failed to delete client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete client');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (client) => {
    setSelectedClient(client);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedClient(null);
    setError('');
  };

  const openGroupsModal = (client) => {
    setGroupsModalClient(client);
    setShowGroupsModal(true);
  };

  const closeGroupsModal = () => {
    setShowGroupsModal(false);
    setGroupsModalClient(null);
  };

  const refresh = () => {
    fetchClients();
    fetchStats();
  };

  return {
    clients,
    stats,
    pagination,
    searchQuery,
    filters,
    selectedClient,
    groupsModalClient,
    loading,
    fetching,
    error,
    submitting,
    showDeleteModal,
    showGroupsModal,
    setSearchQuery,
    setFilters,
    setError,
    setPagination,
    openDeleteModal,
    closeDeleteModal,
    openGroupsModal,
    closeGroupsModal,
    handleDeleteClient,
    refresh,
  };
}

// ── Detail Mode ────────────────────────────────────────────

function useClientDetail(id) {
  const [client, setClient] = useState(null);
  const [clientEmployees, setClientEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [connectedGroups, setConnectedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showPtoModal, setShowPtoModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedPtoEmployee, setSelectedPtoEmployee] = useState(null);
  const [rateFormData, setRateFormData] = useState({
    hourlyRate: '',
    overtimeRate: '',
    // UI-driven overtime multiplier. If user doesn't touch it, we keep submitting overtimeRate=0
    // so backend can apply its default rule (overtimeRate=0 => 1x hourly).
    overtimeMultiplier: '1',
    isOvertimeMultiplierDirty: false,
    employeeBillingRate: null,
    clientGroupBillingRate: null,
    groupBillingRate: null,
    groupName: null,
    defaultHourlyRate: 0,
    defaultOvertimeRate: 0,
  });
  const [ptoFormData, setPtoFormData] = useState({
    ptoAllowPaidLeave: '',
    ptoEntitlementType: '',
    ptoAnnualDays: '',
    ptoAccrualRatePerMonth: '',
    ptoMaxCarryoverDays: '',
    ptoCarryoverExpiryMonths: '',
    ptoAllowUnpaidLeave: '',
    ptoAllowPaidHolidays: '',
    ptoAllowUnpaidHolidays: '',
    clientDefaults: null,
  });

  // Bulk holiday config state
  const [showHolidayConfigModal, setShowHolidayConfigModal] = useState(false);
  const [holidayConfigForm, setHolidayConfigForm] = useState({
    allowPaidHolidays: false,
    allowUnpaidHolidays: false,
  });
  const [savingHolidayConfig, setSavingHolidayConfig] = useState(false);

  const fetchClient = async () => {
    try {
      setLoading(true);
      const response = await clientService.getClient(id);
      if (response.success) {
        setClient(response.data);
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch client');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientEmployees = async () => {
    try {
      const response = await clientService.getClientEmployees(id);
      if (response.success) {
        setClientEmployees(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch client employees:', err);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 500 });
      if (response.success) {
        setAllEmployees(response.data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const fetchConnectedGroups = async () => {
    try {
      const response = await groupService.getGroups({ limit: 100 });
      if (response.success) {
        // Sort groups by createdAt to prioritize the oldest one
        const sortedGroups = [...response.data.groups].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });

        let hasDefaultGroup = false;
        const filteredGroups = sortedGroups.filter((group) => {
          // Check if group is assigned to this client
          const isAssigned = group.clients?.some((cg) => {
            const cid = cg.client?.id || cg.clientId;
            return cid === id;
          });

          if (!isAssigned) return false;

          // Deduplicate 'Default' groups
          if (group.name?.trim() === 'Default') {
            if (hasDefaultGroup) return false;
            hasDefaultGroup = true;
          }

          return true;
        });

        const groupsWithData = filteredGroups.map((group) => {
          const assignedCount = group.employees?.filter((ge) =>
            ge.employee?.clientAssignments?.some((ca) => {
              const cid = ca.client?.id || ca.clientId;
              return cid === id;
            })
          ).length || 0;
          const clientGroup = group.clients?.find((cg) => {
            const cid = cg.client?.id || cg.clientId;
            return cid === id;
          });
          return {
            ...group,
            assignedToClientCount: assignedCount,
            assignedAt: clientGroup?.assignedAt || group.createdAt,
          };
        });

        setConnectedGroups(groupsWithData);
      }
    } catch (err) {
      console.error('Failed to fetch connected groups:', err);
    }
  };

  useEffect(() => {
    fetchClient();
    fetchClientEmployees();
    fetchAllEmployees();
    fetchConnectedGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resolveEffectiveHourlyRate = (rf) => {
    const hrOverride = rf?.hourlyRate !== '' && rf?.hourlyRate !== null ? Number(rf.hourlyRate) : 0;
    if (hrOverride > 0) return hrOverride;

    const employeeBilling =
      rf?.employeeBillingRate !== null && rf?.employeeBillingRate !== undefined
        ? Number(rf.employeeBillingRate)
        : 0;
    if (employeeBilling > 0) return employeeBilling;

    const clientGroupBilling =
      rf?.clientGroupBillingRate !== null && rf?.clientGroupBillingRate !== undefined
        ? Number(rf.clientGroupBillingRate)
        : 0;
    if (clientGroupBilling > 0) return clientGroupBilling;

    const groupBilling =
      rf?.groupBillingRate !== null && rf?.groupBillingRate !== undefined
        ? Number(rf.groupBillingRate)
        : 0;
    if (groupBilling > 0) return groupBilling;

    const defaultHourly =
      rf?.defaultHourlyRate !== null && rf?.defaultHourlyRate !== undefined
        ? Number(rf.defaultHourlyRate)
        : 0;
    return defaultHourly > 0 ? defaultHourly : 0;
  };

  const handleDeleteClient = async () => {
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.deleteClient(id);
      if (response.success) {
        return true; // Signal success so the page can navigate
      } else {
        setError(response.error || 'Failed to delete client');
        return false;
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete client');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignEmployee = async (employeeId) => {
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.assignEmployees(id, [employeeId]);
      if (response.success) {
        fetchClientEmployees();
        setError('');
      } else {
        setError(response.error || 'Failed to assign employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to assign employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveEmployee = async (employeeId) => {
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.removeEmployee(id, employeeId);
      if (response.success) {
        fetchClientEmployees();
        setError('');
      } else {
        setError(response.error || 'Failed to remove employee');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRateModal = async (employee) => {
    setSelectedEmployee(employee);
    setError('');
    try {
      const response = await clientService.getEmployeeRate(id, employee.id);
      if (response.success) {
        const originalHourlyRate = response.data.hourlyRate !== null ? response.data.hourlyRate : '';
        const originalOvertimeRate = response.data.overtimeRate !== null ? response.data.overtimeRate : '';
        const draft = {
          hourlyRate: originalHourlyRate,
          overtimeRate: originalOvertimeRate,
          employeeBillingRate: response.data.employeeBillingRate || null,
          clientGroupBillingRate: response.data.clientGroupBillingRate || null,
          groupBillingRate: response.data.groupBillingRate || null,
          groupName: response.data.groupName || null,
          defaultHourlyRate: response.data.defaultHourlyRate,
          defaultOvertimeRate: response.data.defaultOvertimeRate,
        };

        const effectiveHourly = resolveEffectiveHourlyRate(draft);
        const storedOvertimeNum =
          draft.overtimeRate === '' || draft.overtimeRate === null ? 0 : Number(draft.overtimeRate);

        const computedMultiplier =
          storedOvertimeNum > 0 && effectiveHourly > 0
            ? (storedOvertimeNum / effectiveHourly).toFixed(3)
            : '1';

        setRateFormData({
          ...draft,
          overtimeMultiplier: computedMultiplier,
          isOvertimeMultiplierDirty: false,
        });
      }
    } catch {
      setRateFormData({
        hourlyRate: '',
        overtimeRate: '',
        overtimeMultiplier: '1',
        isOvertimeMultiplierDirty: false,
        employeeBillingRate: null,
        clientGroupBillingRate: null,
        groupBillingRate: null,
        groupName: null,
        defaultHourlyRate: Number(client?.clientPolicies?.defaultHourlyRate || 0),
        defaultOvertimeRate: Number(client?.clientPolicies?.defaultOvertimeRate || 0),
      });
    }
    setShowRateModal(true);
  };

  const handleUpdateEmployeeRate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const effectiveHourly = resolveEffectiveHourlyRate(rateFormData);
      const overtimeMultiplierNum = Number(rateFormData.overtimeMultiplier || 0);

      // Backend expects overtimeRate in $/hour.
      // - If user didn't touch the multiplier, submit 0 so backend uses its default rule.
      // - If user touched the multiplier, submit (effectiveHourlyRate * multiplier).
      const overtimeRateToSend = rateFormData.isOvertimeMultiplierDirty
        ? Math.round(effectiveHourly * overtimeMultiplierNum * 100) / 100
        : rateFormData.overtimeRate === '' || rateFormData.overtimeRate === null
          ? 0
          : Number(rateFormData.overtimeRate);

      const response = await clientService.updateEmployeeRate(id, selectedEmployee.id, {
        hourlyRate: rateFormData.hourlyRate,
        overtimeRate: overtimeRateToSend,
      });

      if (response.success) {
        setShowRateModal(false);
        setSelectedEmployee(null);
        setRateFormData({
          hourlyRate: '',
          overtimeRate: '',
          overtimeMultiplier: '1',
          isOvertimeMultiplierDirty: false,
          employeeBillingRate: null,
          clientGroupBillingRate: null,
          groupBillingRate: null,
          groupName: null,
          defaultHourlyRate: 0,
          defaultOvertimeRate: 0,
        });
        setError('');
      } else {
        setError(response.error || 'Failed to update employee rate');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update employee rate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPtoModal = async (employee) => {
    setSelectedPtoEmployee(employee);
    setError('');
    try {
      const response = await clientService.getEmployeePtoConfig(id, employee.id);
      if (response.success) {
        const { override, clientDefaults } = response.data;
        setPtoFormData({
          ptoAllowPaidLeave: override.ptoAllowPaidLeave !== null ? String(override.ptoAllowPaidLeave) : '',
          ptoEntitlementType: override.ptoEntitlementType || '',
          ptoAnnualDays: override.ptoAnnualDays !== null ? String(override.ptoAnnualDays) : '',
          ptoAccrualRatePerMonth: override.ptoAccrualRatePerMonth !== null ? String(override.ptoAccrualRatePerMonth) : '',
          ptoMaxCarryoverDays: override.ptoMaxCarryoverDays !== null ? String(override.ptoMaxCarryoverDays) : '',
          ptoCarryoverExpiryMonths: override.ptoCarryoverExpiryMonths !== null ? String(override.ptoCarryoverExpiryMonths) : '',
          ptoAllowUnpaidLeave: override.ptoAllowUnpaidLeave !== null ? String(override.ptoAllowUnpaidLeave) : '',
          ptoAllowPaidHolidays: override.ptoAllowPaidHolidays !== null ? String(override.ptoAllowPaidHolidays) : '',
          ptoAllowUnpaidHolidays: override.ptoAllowUnpaidHolidays !== null ? String(override.ptoAllowUnpaidHolidays) : '',
          clientDefaults,
        });
      }
    } catch {
      setPtoFormData({
        ptoAllowPaidLeave: '',
        ptoEntitlementType: '',
        ptoAnnualDays: '',
        ptoAccrualRatePerMonth: '',
        ptoMaxCarryoverDays: '',
        ptoCarryoverExpiryMonths: '',
        ptoAllowUnpaidLeave: '',
        ptoAllowPaidHolidays: '',
        ptoAllowUnpaidHolidays: '',
        clientDefaults: null,
      });
    }
    setShowPtoModal(true);
  };

  const handleUpdateEmployeePtoConfig = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await clientService.updateEmployeePtoConfig(id, selectedPtoEmployee.id, {
        ptoAllowPaidLeave: ptoFormData.ptoAllowPaidLeave,
        ptoEntitlementType: ptoFormData.ptoEntitlementType,
        ptoAnnualDays: ptoFormData.ptoAnnualDays,
        ptoAccrualRatePerMonth: ptoFormData.ptoAccrualRatePerMonth,
        ptoMaxCarryoverDays: ptoFormData.ptoMaxCarryoverDays,
        ptoCarryoverExpiryMonths: ptoFormData.ptoCarryoverExpiryMonths,
        ptoAllowUnpaidLeave: ptoFormData.ptoAllowUnpaidLeave,
        ptoAllowPaidHolidays: ptoFormData.ptoAllowPaidHolidays,
        ptoAllowUnpaidHolidays: ptoFormData.ptoAllowUnpaidHolidays,
      });

      if (response.success) {
        setShowPtoModal(false);
        setSelectedPtoEmployee(null);
        setPtoFormData({
          ptoAllowPaidLeave: '', ptoEntitlementType: '', ptoAnnualDays: '',
          ptoAccrualRatePerMonth: '', ptoMaxCarryoverDays: '', ptoCarryoverExpiryMonths: '',
          ptoAllowUnpaidLeave: '', ptoAllowPaidHolidays: '', ptoAllowUnpaidHolidays: '',
          clientDefaults: null,
        });
        setError('');
      } else {
        setError(response.error || 'Failed to update employee PTO config');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update employee PTO config');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearPtoOverrides = () => {
    setPtoFormData(prev => ({
      ...prev,
      ptoAllowPaidLeave: '',
      ptoEntitlementType: '',
      ptoAnnualDays: '',
      ptoAccrualRatePerMonth: '',
      ptoMaxCarryoverDays: '',
      ptoCarryoverExpiryMonths: '',
      ptoAllowUnpaidLeave: '',
      ptoAllowPaidHolidays: '',
      ptoAllowUnpaidHolidays: '',
    }));
  };

  const closePtoModal = () => {
    setShowPtoModal(false);
    setSelectedPtoEmployee(null);
    setError('');
  };

  // Bulk holiday config handlers
  const handleOpenHolidayConfig = () => {
    const policy = client?.clientPolicies;
    setHolidayConfigForm({
      allowPaidHolidays: policy?.allowPaidHolidays ?? false,
      allowUnpaidHolidays: policy?.allowUnpaidHolidays ?? false,
    });
    setShowHolidayConfigModal(true);
  };

  const handleSaveHolidayConfig = async () => {
    setSavingHolidayConfig(true);
    setError('');
    try {
      const response = await leavePolicyService.updateClientPolicy(id, {
        allowPaidHolidays: holidayConfigForm.allowPaidHolidays,
        allowUnpaidHolidays: holidayConfigForm.allowUnpaidHolidays,
      });
      if (response.success) {
        setShowHolidayConfigModal(false);
        fetchClient();
      } else {
        setError(response.error || 'Failed to update holiday config');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update holiday config');
    } finally {
      setSavingHolidayConfig(false);
    }
  };

  const closeHolidayConfigModal = () => {
    setShowHolidayConfigModal(false);
    setError('');
  };

  const getUnassignedEmployees = () => {
    const assignedIds = clientEmployees.map(e => e.id);
    return allEmployees.filter(e => !assignedIds.includes(e.id) && e.user?.status === 'ACTIVE');
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setError('');
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setError('');
  };

  const closeRateModal = () => {
    setShowRateModal(false);
    setSelectedEmployee(null);
    setError('');
  };

  const refresh = () => {
    fetchClient();
    fetchClientEmployees();
    fetchConnectedGroups();
  };

  return {
    client,
    clientEmployees,
    connectedGroups,
    loading,
    error,
    submitting,
    showDeleteModal,
    showAssignModal,
    showRateModal,
    showPtoModal,
    showGroupsModal,
    selectedEmployee,
    selectedPtoEmployee,
    rateFormData,
    ptoFormData,
    setError,
    setRateFormData,
    setPtoFormData,
    setShowDeleteModal,
    setShowAssignModal,
    setShowGroupsModal,
    handleDeleteClient,
    handleAssignEmployee,
    handleRemoveEmployee,
    handleOpenRateModal,
    handleUpdateEmployeeRate,
    handleOpenPtoModal,
    handleUpdateEmployeePtoConfig,
    handleClearPtoOverrides,
    getUnassignedEmployees,
    closeDeleteModal,
    closeAssignModal,
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
  };
}

export default useClientData;
