import { useState, useEffect } from 'react';
import clientService from '../services/client.service';
import groupService from '../services/group.service';

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
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    address: '',
    timezone: 'UTC',
    status: 'ACTIVE',
    groupId: '',
    agreementType: 'WEEKLY_ACH',
    allowPaidLeave: false,
    paidLeaveType: 'fixed',
    annualPaidLeaveDays: 0,
    allowUnpaidLeave: true,
    requireTwoWeeksNotice: true,
    allowOvertime: true,
    overtimeRequiresApproval: true,
    autoApproveTimesheets: false,
    autoApproveMinutes: 15,
    defaultHourlyRate: 0,
    defaultOvertimeRate: 0,
    currency: 'USD',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) setLoading(true);

        const groupsRes = await groupService.getGroups({ limit: 100 });
        if (groupsRes.success) {
          setGroups(groupsRes.data.groups);
          if (!isEdit) {
            const defaultGroup = groupsRes.data.groups.find((g) => g.name === 'Default');
            if (defaultGroup) {
              setFormData((prev) => ({ ...prev, groupId: defaultGroup.id }));
            }
          }
        }

        if (isEdit) {
          const clientRes = await clientService.getClient(id);
          if (clientRes.success) {
            const client = clientRes.data;
            setFormData({
              email: client.user?.email || '',
              password: '',
              companyName: client.companyName,
              contactPerson: client.contactPerson,
              phone: client.phone || '',
              address: client.address || '',
              timezone: client.timezone || 'UTC',
              status: client.user?.status || 'ACTIVE',
              groupId: '',
              allowPaidLeave: client.clientPolicies?.allowPaidLeave || false,
              paidLeaveType: client.clientPolicies?.paidLeaveType || 'fixed',
              annualPaidLeaveDays: client.clientPolicies?.annualPaidLeaveDays || 0,
              allowUnpaidLeave: client.clientPolicies?.allowUnpaidLeave ?? true,
              requireTwoWeeksNotice: client.clientPolicies?.requireTwoWeeksNotice ?? true,
              allowOvertime: client.clientPolicies?.allowOvertime ?? true,
              overtimeRequiresApproval: client.clientPolicies?.overtimeRequiresApproval ?? true,
              autoApproveTimesheets: client.clientPolicies?.autoApproveTimesheets ?? false,
              autoApproveMinutes: client.clientPolicies?.autoApproveMinutes ?? 15,
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

    try {
      let response;
      if (isEdit) {
        const { password, ...updateData } = formData;
        response = await clientService.updateClient(id, {
          ...updateData,
          annualPaidLeaveDays: parseInt(updateData.annualPaidLeaveDays),
          autoApproveMinutes: parseInt(updateData.autoApproveMinutes) || 15,
          defaultHourlyRate: parseFloat(updateData.defaultHourlyRate) || 0,
          defaultOvertimeRate: parseFloat(updateData.defaultOvertimeRate) || 0,
        });
      } else {
        response = await clientService.createClient(formData);
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
    isEdit,
    loading,
    error,
    setError,
    submitting,
    handleSubmit,
  };
};

export default useClientForm;
