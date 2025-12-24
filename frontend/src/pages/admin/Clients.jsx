import { useState } from 'react';
import {
  Plus,
  Search,
  Building,
  Users,
  Clock,
  DollarSign,
  Settings,
  Eye,
  Edit
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Input,
  Modal
} from '../../components/common';

const Clients = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const clients = [
    {
      id: 1,
      name: 'ABC Corporation',
      contactPerson: 'Robert Smith',
      email: 'robert@abccorp.com',
      phone: '+1 234 567 8900',
      employees: 8,
      activeEmployees: 6,
      weeklyHours: 320,
      monthlyBilling: '$32,000',
      status: 'active',
      leavePolicy: 'paid',
      overtimePolicy: 'approval-required',
    },
    {
      id: 2,
      name: 'XYZ Tech',
      contactPerson: 'Alice Johnson',
      email: 'alice@xyztech.com',
      phone: '+1 234 567 8901',
      employees: 12,
      activeEmployees: 10,
      weeklyHours: 480,
      monthlyBilling: '$48,000',
      status: 'active',
      leavePolicy: 'paid',
      overtimePolicy: 'approval-required',
    },
    {
      id: 3,
      name: 'Global Services',
      contactPerson: 'Mark Davis',
      email: 'mark@globalservices.com',
      phone: '+1 234 567 8902',
      employees: 6,
      activeEmployees: 4,
      weeklyHours: 240,
      monthlyBilling: '$24,000',
      status: 'active',
      leavePolicy: 'unpaid-only',
      overtimePolicy: 'not-allowed',
    },
    {
      id: 4,
      name: 'Startup Inc',
      contactPerson: 'Emily White',
      email: 'emily@startupinc.com',
      phone: '+1 234 567 8903',
      employees: 4,
      activeEmployees: 3,
      weeklyHours: 160,
      monthlyBilling: '$16,000',
      status: 'active',
      leavePolicy: 'paid',
      overtimePolicy: 'flexible',
    },
  ];

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
          <p className="text-gray-500">Manage client accounts and configurations</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              <p className="text-sm text-gray-500">Total Clients</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {clients.reduce((sum, c) => sum + c.employees, 0)}
              </p>
              <p className="text-sm text-gray-500">Total Employees</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {clients.reduce((sum, c) => sum + c.weeklyHours, 0)}h
              </p>
              <p className="text-sm text-gray-500">Weekly Hours</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">$120K</p>
              <p className="text-sm text-gray-500">Monthly Revenue</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card padding="sm">
        <Input
          icon={Search}
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Card>

      {/* Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredClients.map((client) => (
          <Card key={client.id} className="hover:border-primary-200 border border-transparent">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.contactPerson}</p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Employees</span>
                </div>
                <p className="font-semibold text-gray-900">
                  {client.activeEmployees}/{client.employees} active
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Weekly Hours</span>
                </div>
                <p className="font-semibold text-gray-900">{client.weeklyHours}h</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Monthly Billing</span>
                </div>
                <p className="font-semibold text-gray-900">{client.monthlyBilling}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Leave Policy</span>
                </div>
                <Badge variant={client.leavePolicy === 'paid' ? 'success' : 'warning'} size="sm">
                  {client.leavePolicy === 'paid' ? 'Paid Leave' : 'Unpaid Only'}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                icon={Eye}
                onClick={() => setSelectedClient(client)}
              >
                View Details
              </Button>
              <Button variant="ghost" size="sm" fullWidth icon={Edit}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" fullWidth icon={Settings}>
                Settings
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Client"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowAddModal(false)}>
              Add Client
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Company Name" placeholder="Enter company name" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" placeholder="Primary contact name" />
            <Input label="Email" type="email" placeholder="Contact email" />
          </div>
          <Input label="Phone" placeholder="Contact phone number" />

          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-4">Policy Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Leave Policy</label>
                <select className="input">
                  <option value="paid">Paid Leave Allowed</option>
                  <option value="unpaid">Unpaid Leave Only</option>
                  <option value="none">No Leave Entitlement</option>
                </select>
              </div>
              <div>
                <label className="label">Overtime Policy</label>
                <select className="input">
                  <option value="approval-required">Approval Required</option>
                  <option value="flexible">Flexible</option>
                  <option value="not-allowed">Not Allowed</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Client Detail Modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title="Client Details"
        size="lg"
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedClient.name}</h3>
                <p className="text-gray-500">{selectedClient.contactPerson}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{selectedClient.email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{selectedClient.phone}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Employees</p>
                <p className="font-medium text-gray-900">{selectedClient.employees}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Monthly Billing</p>
                <p className="font-medium text-gray-900">{selectedClient.monthlyBilling}</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Policies</h4>
              <div className="flex gap-4">
                <Badge variant={selectedClient.leavePolicy === 'paid' ? 'success' : 'warning'}>
                  {selectedClient.leavePolicy === 'paid' ? 'Paid Leave' : 'Unpaid Only'}
                </Badge>
                <Badge variant="info">
                  Overtime: {selectedClient.overtimePolicy.replace('-', ' ')}
                </Badge>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" fullWidth icon={Users}>
                View Employees
              </Button>
              <Button variant="primary" fullWidth icon={Settings}>
                Manage Settings
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Clients;
