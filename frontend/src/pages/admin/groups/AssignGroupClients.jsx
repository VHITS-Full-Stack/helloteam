import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, AlertCircle, X, Loader2, Users } from 'lucide-react';
import { Card, Button } from '../../../components/common';
import groupService from '../../../services/group.service';
import clientService from '../../../services/client.service';

const AssignGroupClients = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null); // clientId being processed
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupRes, clientsRes] = await Promise.all([
        groupService.getGroup(groupId),
        clientService.getClients({ limit: 200 }),
      ]);
      if (groupRes.success) setGroup(groupRes.data);
      if (clientsRes.success) setClients(clientsRes.data.clients || []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isAssigned = (clientId) => {
    if (!group?.employees) return false;
    return group.employees.some((ge) =>
      ge.employee?.clientAssignments?.some((ca) => (ca.client?.id || ca.clientId) === clientId)
    );
  };

  const handleAssign = async (clientId) => {
    setSubmitting(clientId);
    setError('');
    try {
      const employeeIds = group.employees?.map((ge) => ge.employee?.id || ge.employeeId).filter(Boolean);
      if (!employeeIds?.length) { setError('No employees in this group to assign'); return; }
      const response = await clientService.assignEmployees(clientId, employeeIds);
      if (response.success) {
        await fetchData();
      } else {
        setError(response.error || 'Failed to assign group to client');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to assign group to client');
    } finally {
      setSubmitting(null);
    }
  };

  const handleUnassign = async (clientId) => {
    setSubmitting(clientId);
    setError('');
    try {
      const employeeIds = group.employees?.map((ge) => ge.employee?.id || ge.employeeId).filter(Boolean);
      if (!employeeIds?.length) { setError('No employees in this group to unassign'); return; }
      for (const employeeId of employeeIds) {
        await clientService.removeEmployee(clientId, employeeId);
      }
      await fetchData();
    } catch (err) {
      setError(err.error || err.message || 'Failed to unassign group from client');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/groups')}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Group to Client</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {group?.name} &middot; {group?.employees?.length || 0} employee{group?.employees?.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* No employees warning */}
      {!group?.employees?.length && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 text-yellow-800 text-sm">
          <Users className="w-4 h-4 flex-shrink-0" />
          This group has no employees. Add employees to the group before assigning to a client.
        </div>
      )}

      {/* Clients List */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Select Clients</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No clients found.</p>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => {
              const assigned = isAssigned(client.id);
              const busy = submitting === client.id;
              return (
                <div
                  key={client.id}
                  className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${
                    assigned ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${assigned ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Building className={`w-4 h-4 ${assigned ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{client.companyName}</p>
                      {client.contactPerson && <p className="text-sm text-gray-500">{client.contactPerson}</p>}
                    </div>
                  </div>
                  <Button
                    variant={assigned ? 'ghost' : 'primary'}
                    size="sm"
                    loading={busy}
                    onClick={() => assigned ? handleUnassign(client.id) : handleAssign(client.id)}
                    disabled={!group?.employees?.length || submitting !== null}
                    className={assigned ? 'text-red-600 hover:bg-red-50 border-red-200' : ''}
                  >
                    {assigned ? 'Unassign' : 'Assign'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AssignGroupClients;
