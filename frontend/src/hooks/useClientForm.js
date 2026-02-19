import { useState, useEffect, useCallback } from 'react';
import clientService from '../services/client.service';
import groupService from '../services/group.service';
import employeeService from '../services/employee.service';

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
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    contacts: [{ name: '', position: '', phone: '', email: '' }],
    phone: '',
    address: '',
    timezone: 'UTC',
    status: 'ACTIVE',
    groupId: '',
    employeeIds: [],
    agreementType: 'WEEKLY',
    allowPaidLeave: false,
    paidLeaveType: 'fixed',
    annualPaidLeaveDays: 0,
    allowUnpaidLeave: true,
    requireTwoWeeksNotice: true,
    requireTwoWeeksNoticePaidLeave: true,
    requireTwoWeeksNoticeUnpaidLeave: true,
    allowPaidHolidays: false,
    paidHolidayType: 'federal',
    numberOfPaidHolidays: 0,
    allowUnpaidHolidays: false,
    unpaidHolidayType: 'federal',
    numberOfUnpaidHolidays: 0,
    allowOvertime: true,
    overtimeRequiresApproval: true,
    autoApproveTimesheets: false,
    autoApproveMinutes: 1440,
    defaultHourlyRate: 0,
    defaultOvertimeRate: 0,
    currency: 'USD',
  });

  // Contact person helpers
  const addContact = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', position: '', phone: '', email: '' }],
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
                  email: c.email || '',
                }))
              : [{ name: client.contactPerson || '', position: '', phone: '', email: '' }];

            setFormData({
              email: client.user?.email || '',
              companyName: client.companyName,
              contacts: clientContacts,
              phone: client.phone || '',
              address: client.address || '',
              timezone: client.timezone || 'UTC',
              status: client.user?.status || 'ACTIVE',
              groupId: '',
              employeeIds: [],
              allowPaidLeave: client.clientPolicies?.allowPaidLeave || false,
              paidLeaveType: client.clientPolicies?.paidLeaveType || 'fixed',
              annualPaidLeaveDays: client.clientPolicies?.annualPaidLeaveDays || 0,
              allowUnpaidLeave: client.clientPolicies?.allowUnpaidLeave ?? true,
              requireTwoWeeksNotice: client.clientPolicies?.requireTwoWeeksNotice ?? true,
              requireTwoWeeksNoticePaidLeave: client.clientPolicies?.requireTwoWeeksNoticePaidLeave ?? true,
              requireTwoWeeksNoticeUnpaidLeave: client.clientPolicies?.requireTwoWeeksNoticeUnpaidLeave ?? true,
              allowOvertime: client.clientPolicies?.allowOvertime ?? true,
              overtimeRequiresApproval: client.clientPolicies?.overtimeRequiresApproval ?? true,
              autoApproveTimesheets: client.clientPolicies?.autoApproveTimesheets ?? false,
              autoApproveMinutes: client.clientPolicies?.autoApproveMinutes ?? 1440,
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

    // Validate at least one contact with a name
    const validContacts = formData.contacts.filter((c) => c.name.trim());
    if (validContacts.length === 0) {
      setError('At least one contact person is required');
      setSubmitting(false);
      return;
    }

    // Validate at least one employee is assigned (create only)
    if (!isEdit && formData.employeeIds.length === 0) {
      setError('At least one employee must be assigned to the client');
      setSubmitting(false);
      return;
    }

    try {
      let response;
      if (isEdit) {
        response = await clientService.updateClient(id, {
          ...formData,
          contacts: validContacts,
          annualPaidLeaveDays: parseInt(formData.annualPaidLeaveDays),
          autoApproveMinutes: parseInt(formData.autoApproveMinutes) || 1440,
          defaultHourlyRate: parseFloat(formData.defaultHourlyRate) || 0,
          defaultOvertimeRate: parseFloat(formData.defaultOvertimeRate) || 0,
        });
      } else {
        response = await clientService.createClient({
          ...formData,
          contacts: validContacts,
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
    employees,
    isEdit,
    loading,
    error,
    setError,
    submitting,
    handleSubmit,
    addContact,
    removeContact,
    updateContact,
  };
};

export default useClientForm;
