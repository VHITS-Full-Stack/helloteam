import { useState, useEffect, useCallback } from 'react';
import clientService from '../services/client.service';
import groupService from '../services/group.service';
import employeeService from '../services/employee.service';
import { validateClientForm } from '../utils/clientValidation';

/**
 * Custom hook for client add/edit form logic
 * Manages form state, data fetching, and submission
 * @param {Object} params
 * @param {string} params.id - Client ID (undefined for create mode)
 * @param {Function} params.onSuccess - Callback after successful create/update
 */
export const useClientForm = ({ id, onSuccess } = {}) => {
  const isEdit = Boolean(id);

  const [groups, setGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    contacts: [{ name: '', position: '', phone: '', countryCode: '+1', email: '' }],
    countryCode: '+1',
    phone: '',
    address: '',
    timezone: 'UTC',
    status: 'ACTIVE',
    groupId: '',
    employeeAssignments: [],
    allowOvertime: true,
    overtimeRequiresApproval: true,
    autoApproveTimesheets: false,
    autoApproveMinutes: 1440,
    invoiceByGroup: false,
    allowPaidHolidays: false,
    paidHolidayType: 'federal',
    numberOfPaidHolidays: 0,
    selectedFederalHolidays: [],
    customHolidays: [],
    allowUnpaidHolidays: false,
    defaultHourlyRate: 0,
    defaultOvertimeRate: 0,
    currency: 'USD',
  });

  const refreshEmployees = useCallback(async () => {
    try {
      const employeesRes = await employeeService.getEmployees({ limit: 200 });
      if (employeesRes.success) {
        setEmployees(employeesRes.data.employees || []);
      }
    } catch (err) {
      console.error('Failed to refresh employees:', err);
    }
  }, []);

  // Contact person helpers
  const addContact = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', position: '', phone: '', countryCode: '+1', email: '' }],
    }));
  }, []);

  const removeContact = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  }, []);

  const updateContact = useCallback((index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) setLoading(true);

        const [groupsRes, employeesRes] = await Promise.all([
          groupService.getGroups({ limit: 100 }),
          !isEdit ? employeeService.getEmployees({ limit: 200 }) : Promise.resolve(null),
        ]);

        if (groupsRes.success) {
          setGroups(groupsRes.data.groups);
          if (!isEdit) {
            const defaultGroup = groupsRes.data.groups.find((g) => g.name === 'Default');
            if (defaultGroup) {
              setFormData((prev) => ({ ...prev, groupId: defaultGroup.id }));
            }
          }
        }

        if (employeesRes?.success) {
          setEmployees(employeesRes.data.employees || []);
        }

        if (isEdit) {
          const clientRes = await clientService.getClient(id);
          if (clientRes.success) {
            const client = clientRes.data;
            const clientContacts = client.contacts && client.contacts.length > 0
              ? client.contacts.map((c) => ({
                  name: c.name || '',
                  position: c.position || '',
                  phone: c.phone || '',
                  countryCode: c.countryCode || '+1',
                  email: c.email || '',
                }))
              : [{ name: client.contactPerson || '', position: '', phone: '', countryCode: '+1', email: '' }];

            setFormData({
              email: client.user?.email || '',
              companyName: client.companyName,
              contacts: clientContacts,
              countryCode: client.countryCode || '+1',
              phone: client.phone || '',
              address: client.address || '',
              timezone: client.timezone || 'UTC',
              status: client.user?.status || 'ACTIVE',
              groupId: '',
              employeeAssignments: [],
              allowOvertime: client.clientPolicies?.allowOvertime ?? true,
              overtimeRequiresApproval: client.clientPolicies?.overtimeRequiresApproval ?? true,
              autoApproveTimesheets: client.clientPolicies?.autoApproveTimesheets ?? false,
              autoApproveMinutes: client.clientPolicies?.autoApproveMinutes ?? 1440,
              invoiceByGroup: client.clientPolicies?.invoiceByGroup ?? false,
              allowPaidHolidays: client.clientPolicies?.allowPaidHolidays ?? false,
              paidHolidayType: client.clientPolicies?.paidHolidayType || 'federal',
              numberOfPaidHolidays: client.clientPolicies?.numberOfPaidHolidays || 0,
              selectedFederalHolidays: (() => {
                try {
                  const raw = client.clientPolicies?.selectedFederalHolidays;
                  if (!raw) return [];
                  return typeof raw === 'string' ? JSON.parse(raw) : raw;
                } catch { return []; }
              })(),
              customHolidays: (client.holidays || []).filter(h => !h.isAutoGenerated).map((h) => ({
                date: h.date ? h.date.split('T')[0] : '',
                name: h.name || '',
              })),
              allowUnpaidHolidays: client.clientPolicies?.allowUnpaidHolidays ?? false,
              defaultHourlyRate: client.clientPolicies?.defaultHourlyRate || 0,
              defaultOvertimeRate: client.clientPolicies?.defaultOvertimeRate || 0,
              currency: client.clientPolicies?.currency || 'USD',
            });
          } else {
            setError(clientRes.error || 'Failed to fetch client');
          }
        }
      } catch (err) {
        setError(err.error || err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    // Run validation
    const errors = validateClientForm(formData, isEdit);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = errors.companyName || errors.email || errors.contacts || errors.phone || errors.employees || Object.values(errors)[0];
      setError(typeof firstError === 'string' ? firstError : 'Please fix the errors below');
      setSubmitting(false);
      return;
    }

    const validContacts = formData.contacts.filter((c) => c.name.trim());

    try {
      let response;
      if (isEdit) {
        response = await clientService.updateClient(id, {
          ...formData,
          contacts: validContacts,
          autoApproveMinutes: parseInt(formData.autoApproveMinutes) || 1440,
          defaultHourlyRate: parseFloat(formData.defaultHourlyRate) || 0,
          defaultOvertimeRate: parseFloat(formData.defaultOvertimeRate) || 0,
        });
      } else {
        // Map frontend leave type to Prisma enum
        const toEntitlementType = (type) => {
          const map = { fixed: 'FIXED', 'fixed-half-yearly': 'FIXED_HALF_YEARLY', accrued: 'ACCRUED', milestone: 'MILESTONE' };
          return map[type] || 'NONE';
        };

        const employeeIds = formData.employeeAssignments.map((a) => a.employeeId);
        // Holiday fields (ptoAllowPaidHolidays, ptoAllowUnpaidHolidays) are NOT sent
        // as per-employee overrides — they inherit from client policy via ptoResolver.
        // Per-employee holiday overrides can be set from PTO config.
        const employeePtoOverrides = formData.employeeAssignments.map((a) => ({
          employeeId: a.employeeId,
          ptoAllowPaidLeave: a.allowPaidLeave,
          ptoAllowUnpaidLeave: a.allowUnpaidLeave,
          ptoEntitlementType: a.allowPaidLeave ? toEntitlementType(a.paidLeaveType) : null,
          ptoAnnualDays: a.allowPaidLeave ? parseInt(a.annualPaidLeaveDays) || 0 : null,
          requireTwoWeeksNoticePaidLeave: a.requireTwoWeeksNoticePaidLeave,
          requireTwoWeeksNoticeUnpaidLeave: a.requireTwoWeeksNoticeUnpaidLeave,
        }));
        // Derive client-level policy defaults from employee settings
        const anyPaidLeave = formData.employeeAssignments.some((a) => a.allowPaidLeave);
        const anyUnpaidLeave = formData.employeeAssignments.some((a) => a.allowUnpaidLeave);
        // Use first paid-leave employee's type as the client-level default
        const firstPaidLeaveEmp = formData.employeeAssignments.find((a) => a.allowPaidLeave);
        response = await clientService.createClient({
          ...formData,
          employeeIds,
          employeePtoOverrides,
          contacts: validContacts,
          allowPaidLeave: anyPaidLeave,
          paidLeaveEntitlementType: firstPaidLeaveEmp ? toEntitlementType(firstPaidLeaveEmp.paidLeaveType) : 'NONE',
          annualPaidLeaveDays: firstPaidLeaveEmp ? parseInt(firstPaidLeaveEmp.annualPaidLeaveDays) || 0 : 0,
          allowUnpaidLeave: anyUnpaidLeave,
          allowPaidHolidays: formData.allowPaidHolidays,
          paidHolidayType: formData.allowPaidHolidays ? formData.paidHolidayType : 'federal',
          numberOfPaidHolidays: formData.allowPaidHolidays ? parseInt(formData.numberOfPaidHolidays) || 0 : 0,
          selectedFederalHolidays: formData.allowPaidHolidays && formData.paidHolidayType === 'federal' ? formData.selectedFederalHolidays : [],
          customHolidays: formData.allowPaidHolidays && formData.paidHolidayType === 'custom' ? formData.customHolidays : [],
          allowUnpaidHolidays: formData.allowUnpaidHolidays,
        });
      }

      if (response.success) {
        onSuccess?.();
      } else {
        setError(response.error || `Failed to ${isEdit ? 'update' : 'create'} client`);
      }
    } catch (err) {
      setError(err.error || err.message || `Failed to ${isEdit ? 'update' : 'create'} client`);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    groups,
    setGroups,
    employees,
    setEmployees,
    refreshEmployees,
    isEdit,
    loading,
    error,
    setError,
    fieldErrors,
    submitting,
    handleSubmit,
    addContact,
    removeContact,
    updateContact,
  };
};

export default useClientForm;
