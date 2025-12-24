import { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Clock,
  Activity,
  MoreVertical
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from '../../components/common';

const Workforce = () => {
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [searchQuery, setSearchQuery] = useState('');

  const employees = [
    {
      id: 1,
      name: 'John Doe',
      role: 'Senior Developer',
      email: 'john.doe@email.com',
      status: 'working',
      todayHours: '6h 32m',
      weeklyHours: '32h 15m',
      productivity: 94,
      avatar: null,
    },
    {
      id: 2,
      name: 'Jane Smith',
      role: 'UI/UX Designer',
      email: 'jane.smith@email.com',
      status: 'working',
      todayHours: '5h 15m',
      weeklyHours: '28h 45m',
      productivity: 88,
      avatar: null,
    },
    {
      id: 3,
      name: 'Mike Johnson',
      role: 'Full Stack Developer',
      email: 'mike.johnson@email.com',
      status: 'break',
      todayHours: '4h 10m',
      weeklyHours: '35h 00m',
      productivity: 92,
      avatar: null,
    },
    {
      id: 4,
      name: 'Sarah Williams',
      role: 'QA Engineer',
      email: 'sarah.williams@email.com',
      status: 'offline',
      todayHours: '0h 00m',
      weeklyHours: '40h 00m',
      productivity: 96,
      avatar: null,
    },
    {
      id: 5,
      name: 'David Brown',
      role: 'Backend Developer',
      email: 'david.brown@email.com',
      status: 'working',
      todayHours: '7h 00m',
      weeklyHours: '38h 30m',
      productivity: 91,
      avatar: null,
    },
    {
      id: 6,
      name: 'Emily Davis',
      role: 'Project Manager',
      email: 'emily.davis@email.com',
      status: 'working',
      todayHours: '5h 45m',
      weeklyHours: '36h 15m',
      productivity: 89,
      avatar: null,
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'working':
        return <Badge variant="success" dot>Working</Badge>;
      case 'break':
        return <Badge variant="warning" dot>On Break</Badge>;
      case 'offline':
        return <Badge variant="default" dot>Offline</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workforce</h2>
          <p className="text-gray-500">Monitor your team's activity and productivity</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>
            Filter
          </Button>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {employees.filter(e => e.status === 'working').length}
              </p>
              <p className="text-sm text-gray-500">Working Now</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {employees.filter(e => e.status === 'break').length}
              </p>
              <p className="text-sm text-gray-500">On Break</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Activity className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {employees.filter(e => e.status === 'offline').length}
              </p>
              <p className="text-sm text-gray-500">Offline</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">91%</p>
              <p className="text-sm text-gray-500">Avg Productivity</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="hover:border-primary-200 border border-transparent">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={employee.name}
                    src={employee.avatar}
                    size="lg"
                    status={
                      employee.status === 'working' ? 'online' :
                      employee.status === 'break' ? 'away' : 'offline'
                    }
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{employee.name}</p>
                    <p className="text-sm text-gray-500">{employee.role}</p>
                  </div>
                </div>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Status</span>
                  {getStatusBadge(employee.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Today</span>
                  <span className="font-semibold text-gray-900">{employee.todayHours}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">This Week</span>
                  <span className="font-semibold text-gray-900">{employee.weeklyHours}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Productivity</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          employee.productivity >= 90 ? 'bg-green-500' :
                          employee.productivity >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${employee.productivity}%` }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900">{employee.productivity}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <Button variant="outline" size="sm" fullWidth icon={Eye}>
                  View Details
                </Button>
                <Button variant="ghost" size="sm" fullWidth icon={Activity}>
                  Activity
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Today</TableHeader>
                <TableHeader>This Week</TableHeader>
                <TableHeader>Productivity</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={employee.name}
                        size="sm"
                        status={
                          employee.status === 'working' ? 'online' :
                          employee.status === 'break' ? 'away' : 'offline'
                        }
                      />
                      <div>
                        <p className="font-medium text-gray-900">{employee.name}</p>
                        <p className="text-sm text-gray-500">{employee.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                  <TableCell>{employee.todayHours}</TableCell>
                  <TableCell>{employee.weeklyHours}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            employee.productivity >= 90 ? 'bg-green-500' :
                            employee.productivity >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${employee.productivity}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{employee.productivity}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" icon={Eye}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Workforce;
