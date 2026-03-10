import { useState, useEffect } from 'react';
import employeeService from '../services/employee.service';
import clientService from '../services/client.service';
import groupService from '../services/group.service';

/**
 * Custom hook for employee add/edit form logic
 * Manages form state, data fetching, and submission
 * @param {Object} params
 * @param {string} params.id - Employee ID (undefined for create mode)
 * @param {Function} params.onSuccess - Callback after successful create/update
 */
export const useEmployeeForm = ({ id, onSuccess } = {}) => {
  const isEdit = Boolean(id);

  const [clients, setClients] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    countryCode: '+1',
    phone: '',
    address: '',
    hireDate: '',
    status: 'ACTIVE',
    clientId: '',
    groupId: '',
    payableRate: '',
    billingRate: '',
  });

  const filterGroupsByClient = (groups, clientId) => {
    if (!clientId) {
      setClientGroups([]);
      return;
    }
    const filtered = groups.filter((group) =>
      group.clients?.some((cg) => {
        const cid = cg.client?.id || cg.clientId;
        return cid === clientId;
      })
    );
    setClientGroups(filtered);
  };

  const handleClientChange = (clientId) => {
    const filtered = allGroups.filter((group) =>
      group.clients?.some((cg) => {
        const cid = cg.client?.id || cg.clientId;
        return cid === clientId;
      })
    );
    const defaultGroup = filtered.find((g) => g.name.toLowerCase() === 'default');
    setFormData((prev) => ({ ...prev, clientId, groupId: defaultGroup?.id || '' }));
    filterGroupsByClient(allGroups, clientId);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) setLoading(true);

        const [clientsRes, groupsRes] = await Promise.all([
          clientService.getClients({ limit: 100 }),
          groupService.getGroups({ limit: 100 }),
        ]);

        if (clientsRes.success) {
          setClients(clientsRes.data.clients);
        }

        if (groupsRes.success) {
          setAllGroups(groupsRes.data.groups);
        }

        if (isEdit) {
          const response = await employeeService.getEmployee(id);
          if (response.success) {
            const emp = response.data;
            setFormData({
              email: emp.user?.email || '',
              firstName: emp.firstName,
              lastName: emp.lastName,
              countryCode: emp.countryCode || '+1',
              phone: emp.phone || '',
              address: emp.address || '',
              hireDate: emp.hireDate ? emp.hireDate.split('T')[0] : '',
              status: emp.user?.status || 'ACTIVE',
              clientId: '',
              payableRate: emp.payableRate ?? '',
              billingRate: emp.billingRate ?? '',
            });
          } else {
            setError('Employee not found');
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

    if (!formData.hireDate) {
      setError('Start date is required.');
      setSubmitting(false);
      return;
    }
    if (!formData.payableRate) {
      setError('Payable rate is required');
      setSubmitting(false);
      return;
    }
    if (!formData.billingRate) {
      setError('Billing rate is required');
      setSubmitting(false);
      return;
    }

    try {
      let response;
      if (isEdit) {
        const { clientId, groupId, ...updateData } = formData;
        response = await employeeService.updateEmployee(id, updateData);
      } else {
        const { groupId, ...createData } = formData;
        response = await employeeService.createEmployee(createData);

        // Add to group if selected
        if (response.success && groupId && response.data?.id) {
          try {
            await groupService.addEmployees(groupId, [response.data.id]);
          } catch (groupErr) {
            console.error('Failed to add employee to group:', groupErr);
          }
        }
      }

      if (response.success) {
        onSuccess?.();
      } else {
        setError(response.error || `Failed to ${isEdit ? 'update' : 'create'} employee`);
      }
    } catch (err) {
      setError(err.error || err.message || `Failed to ${isEdit ? 'update' : 'create'} employee`);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    clients,
    clientGroups,
    isEdit,
    loading,
    error,
    setError,
    submitting,
    handleSubmit,
    handleClientChange,
  };
};

export default useEmployeeForm;
