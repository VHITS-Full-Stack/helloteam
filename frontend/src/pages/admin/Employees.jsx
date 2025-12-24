import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Mail,
  Phone,
  Building,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../components/common';

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const employees = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@email.com',
      phone: '+1 234 567 8900',
      role: 'Senior Developer',
      client: 'ABC Corporation',
      status: 'active',
      joinedDate: '2024-01-15',
      weeklyHours: 40,
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@email.com',
      phone: '+1 234 567 8901',
      role: 'UI/UX Designer',
      client: 'XYZ Tech',
      status: 'active',
      joinedDate: '2024-02-20',
      weeklyHours: 40,
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike.johnson@email.com',
      phone: '+1 234 567 8902',
      role: 'Full Stack Developer',
      client: 'ABC Corporation',
      status: 'active',
      joinedDate: '2024-03-10',
      weeklyHours: 40,
    },
    {
      id: 4,
      name: 'Sarah Williams',
      email: 'sarah.williams@email.com',
      phone: '+1 234 567 8903',
      role: 'QA Engineer',
      client: 'Global Services',
      status: 'on-leave',
      joinedDate: '2024-04-05',
      weeklyHours: 40,
    },
    {
      id: 5,
      name: 'David Brown',
      email: 'david.brown@email.com',
      phone: '+1 234 567 8904',
      role: 'Backend Developer',
      client: 'XYZ Tech',
      status: 'inactive',
      joinedDate: '2024-05-12',
      weeklyHours: 0,
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'on-leave':
        return <Badge variant="warning">On Leave</Badge>;
      case 'inactive':
        return <Badge variant="default">Inactive</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
          <p className="text-gray-500">Manage employee profiles and assignments</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {employees.filter(e => e.status === 'active').length}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">On Leave</p>
          <p className="text-2xl font-bold text-yellow-600">
            {employees.filter(e => e.status === 'on-leave').length}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-400">
            {employees.filter(e => e.status === 'inactive').length}
          </p>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name, email, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
        </div>
      </Card>

      {/* Employees Table */}
      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Employee</TableHeader>
              <TableHeader>Contact</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Weekly Hours</TableHeader>
              <TableHeader>Joined</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEmployees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={employee.name} size="md" />
                    <div>
                      <p className="font-medium text-gray-900">{employee.name}</p>
                      <p className="text-sm text-gray-500">{employee.role}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail className="w-4 h-4" />
                      {employee.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="w-4 h-4" />
                      {employee.phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span>{employee.client}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(employee.status)}</TableCell>
                <TableCell>
                  <span className="font-medium">{employee.weeklyHours}h</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-500">{employee.joinedDate}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Employee"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowAddModal(false)}>
              Add Employee
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" placeholder="Enter first name" />
            <Input label="Last Name" placeholder="Enter last name" />
          </div>
          <Input label="Email" type="email" placeholder="Enter email address" />
          <Input label="Phone" placeholder="Enter phone number" />
          <Input label="Role" placeholder="Enter job role" />
          <div>
            <label className="label">Assign to Client</label>
            <select className="input">
              <option value="">Select a client</option>
              <option value="abc">ABC Corporation</option>
              <option value="xyz">XYZ Tech</option>
              <option value="global">Global Services</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Weekly Hours" type="number" placeholder="40" />
            <Input label="Start Date" type="date" />
          </div>
        </div>
      </Modal>

      {/* Employee Detail Modal */}
      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title="Employee Details"
        size="lg"
      >
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={selectedEmployee.name} size="xl" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedEmployee.name}</h3>
                <p className="text-gray-500">{selectedEmployee.role}</p>
                {getStatusBadge(selectedEmployee.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{selectedEmployee.email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{selectedEmployee.phone}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Assigned Client</p>
                <p className="font-medium text-gray-900">{selectedEmployee.client}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Weekly Hours</p>
                <p className="font-medium text-gray-900">{selectedEmployee.weeklyHours}h</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" fullWidth icon={Edit}>
                Edit Profile
              </Button>
              <Button variant="primary" fullWidth icon={Eye}>
                View Activity
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Employees;
