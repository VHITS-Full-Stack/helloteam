import { useState, useEffect } from 'react';
import employeeService from '../services/employee.service';
import clientService from '../services/client.service';

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
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    hireDate: '',
    status: 'ACTIVE',
    clientId: '',
    payableRate: '',
    billingRate: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) setLoading(true);

        const clientsRes = await clientService.getClients({ limit: 100 });
        if (clientsRes.success) {
          setClients(clientsRes.data.clients);
        }

        if (isEdit) {
          const response = await employeeService.getEmployee(id);
          if (response.success) {
            const emp = response.data;
            setFormData({
              email: emp.user?.email || '',
              password: '',
              firstName: emp.firstName,
              lastName: emp.lastName,
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

    try {
      let response;
      if (isEdit) {
        const { password, clientId, ...updateData } = formData;
        response = await employeeService.updateEmployee(id, updateData);
      } else {
        response = await employeeService.createEmployee(formData);
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
    isEdit,
    loading,
    error,
    setError,
    submitting,
    handleSubmit,
  };
};

export default useEmployeeForm;
