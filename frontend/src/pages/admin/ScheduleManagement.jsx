import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Calendar,
  Clock,
  Save,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
} from '../../components/common';
import scheduleService from '../../services/schedule.service';
import api from '../../services/api';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const DEFAULT_SCHEDULE = {
  startTime: '09:00',
  endTime: '17:00',
  isWorking: false,
};

const ScheduleManagement = () => {
  const [searchParams] = useSearchParams();
  const employeeIdFromUrl = searchParams.get('employee');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copyMenuOpen, setCopyMenuOpen] = useState(null);
  const copyMenuRef = useRef(null);

  // Employee selection
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Schedule state
  const [weeklySchedule, setWeeklySchedule] = useState(
    DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day.value,
      ...DEFAULT_SCHEDULE,
    }))
  );
  const [existingSchedules, setExistingSchedules] = useState([]);
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyToEmployees, setCopyToEmployees] = useState([]);

  const fetchingEmployeesRef = useRef(false);
  const fetchingScheduleRef = useRef(false);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    if (fetchingEmployeesRef.current) return;
    fetchingEmployeesRef.current = true;
    try {
      const response = await api.get('/employees?limit=500');
      if (response.success) {
        // Handle different response structures
        const employeeData = response.data?.employees || response.data || [];
        setEmployees(Array.isArray(employeeData) ? employeeData : []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
      fetchingEmployeesRef.current = false;
    }
  }, []);

  // Fetch employee schedule
  const fetchEmployeeSchedule = useCallback(async (employeeId) => {
    if (!employeeId) return;
    if (fetchingScheduleRef.current) return;
    fetchingScheduleRef.current = true;

    setLoading(true);
    try {
      const response = await scheduleService.getEmployeeSchedule(employeeId);
      if (response.success) {
        const schedules = response.schedules || [];
        setExistingSchedules(schedules);

        // Map existing schedules to weekly view
        const newWeeklySchedule = DAYS_OF_WEEK.map(day => {
          const existing = schedules.find(s => s.dayOfWeek === day.value);
          if (existing) {
            return {
              id: existing.id,
              dayOfWeek: day.value,
              startTime: existing.startTime,
              endTime: existing.endTime,
              isWorking: true,
            };
          }
          return {
            dayOfWeek: day.value,
            ...DEFAULT_SCHEDULE,
          };
        });
        setWeeklySchedule(newWeeklySchedule);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Failed to load employee schedule');
    } finally {
      setLoading(false);
      fetchingScheduleRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Pre-select employee from URL parameter
  useEffect(() => {
    if (employeeIdFromUrl && employees.length > 0 && !selectedEmployee) {
      const employee = employees.find(emp => emp.id === employeeIdFromUrl);
      if (employee) {
        setSelectedEmployee(employee);
      }
    }
  }, [employeeIdFromUrl, employees, selectedEmployee]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeSchedule(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchEmployeeSchedule]);

  // Handle employee selection
  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDropdown(false);
    setEmployeeSearch('');
    setError(null);
    setSuccess(null);
  };

  // Handle schedule change
  const handleScheduleChange = (dayIndex, field, value) => {
    setWeeklySchedule(prev => {
      const newSchedule = [...prev];
      newSchedule[dayIndex] = {
        ...newSchedule[dayIndex],
        [field]: value,
      };
      return newSchedule;
    });
  };

  // Toggle working day
  const toggleWorkingDay = (dayIndex) => {
    setWeeklySchedule(prev => {
      const newSchedule = [...prev];
      newSchedule[dayIndex] = {
        ...newSchedule[dayIndex],
        isWorking: !newSchedule[dayIndex].isWorking,
      };
      return newSchedule;
    });
  };

  // Close copy menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target)) {
        setCopyMenuOpen(null);
      }
    };
    if (copyMenuOpen !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [copyMenuOpen]);

  // Copy a day's schedule to another day or all days
  const copyDayTo = (fromIndex, toIndex) => {
    const source = weeklySchedule[fromIndex];
    setWeeklySchedule(prev => {
      if (toIndex === 'all') {
        return prev.map((day, i) =>
          i === fromIndex ? day : { ...day, startTime: source.startTime, endTime: source.endTime, isWorking: source.isWorking }
        );
      }
      const newSchedule = [...prev];
      newSchedule[toIndex] = { ...newSchedule[toIndex], startTime: source.startTime, endTime: source.endTime, isWorking: source.isWorking };
      return newSchedule;
    });
    setCopyMenuOpen(null);
  };

  // Apply template (e.g., standard 9-5)
  const applyTemplate = (template) => {
    setWeeklySchedule(prev => {
      return prev.map((day, index) => {
        if (template === 'weekdays') {
          // Monday-Friday 9-5
          const isWorkday = index >= 1 && index <= 5;
          return {
            ...day,
            startTime: '09:00',
            endTime: '17:00',
            isWorking: isWorkday,
          };
        } else if (template === 'fullweek') {
          // All days
          return {
            ...day,
            startTime: '09:00',
            endTime: '17:00',
            isWorking: true,
          };
        } else if (template === 'clear') {
          return {
            ...day,
            ...DEFAULT_SCHEDULE,
          };
        }
        return day;
      });
    });
  };

  // Save schedule
  const handleSaveSchedule = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee first');
      return;
    }

    const schedulesToSave = weeklySchedule
      .filter(day => day.isWorking)
      .map(day => ({
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
      }));

    if (schedulesToSave.length === 0) {
      setError('Please set at least one working day');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await scheduleService.bulkUpdateSchedule(
        selectedEmployee.id,
        schedulesToSave,
        effectiveFrom
      );

      if (response.success) {
        setSuccess(`Schedule saved successfully! ${response.schedules?.length || 0} entries created.`);
        fetchEmployeeSchedule(selectedEmployee.id);
      } else {
        setError(response.error || 'Failed to save schedule');
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
      setError(err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // Copy schedule to other employees
  const handleCopySchedule = async () => {
    if (copyToEmployees.length === 0) {
      setError('Please select at least one employee to copy to');
      return;
    }

    const schedulesToSave = weeklySchedule
      .filter(day => day.isWorking)
      .map(day => ({
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
      }));

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      for (const empId of copyToEmployees) {
        const response = await scheduleService.bulkUpdateSchedule(
          empId,
          schedulesToSave,
          effectiveFrom
        );
        if (response.success) {
          successCount++;
        }
      }

      setSuccess(`Schedule copied to ${successCount} employees!`);
      setShowCopyModal(false);
      setCopyToEmployees([]);
    } catch (err) {
      console.error('Error copying schedule:', err);
      setError(err.message || 'Failed to copy schedule');
    } finally {
      setSaving(false);
    }
  };

  // Calculate total hours
  const calculateTotalHours = () => {
    let totalMinutes = 0;
    weeklySchedule.forEach(day => {
      if (day.isWorking && day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (endMinutes > startMinutes) {
          totalMinutes += endMinutes - startMinutes;
        }
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Filter employees for dropdown
  const filteredEmployees = Array.isArray(employees)
    ? employees.filter(emp =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(employeeSearch.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Schedule Management</h2>
          <p className="text-gray-500">Set up and manage employee work schedules</p>
        </div>
      </div>

      {/* Employee Selection */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[250px] relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
              <input
                type="text"
                placeholder="Search employees..."
                value={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setSelectedEmployee(null);
                  setShowEmployeeDropdown(true);
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                className={`input pl-11 w-full ${selectedEmployee ? 'pr-10' : ''}`}
              />
              {selectedEmployee && (
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setEmployeeSearch('');
                    setWeeklySchedule(DAYS_OF_WEEK.map(day => ({
                      dayOfWeek: day.value,
                      ...DEFAULT_SCHEDULE,
                    })));
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Employee Dropdown */}
            {showEmployeeDropdown && !selectedEmployee && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                    >
                      <Avatar name={`${emp.firstName} ${emp.lastName}`} src={emp.profilePhoto} size="sm" />
                      <div>
                        <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-500 text-center">
                    No employees found
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective From
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input"
            />
          </div>

          {selectedEmployee && (
            <Button
              variant="secondary"
              icon={Copy}
              onClick={() => setShowCopyModal(true)}
            >
              Copy to Others
            </Button>
          )}
        </div>
      </Card>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Schedule Editor */}
      {selectedEmployee && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                src={selectedEmployee.profilePhoto}
                size="md"
              />
              <div>
                <h3 className="font-medium text-gray-900">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h3>
                <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Weekly Hours</p>
              <p className="text-xl font-bold text-primary">{calculateTotalHours()}</p>
            </div>
          </div>

          {/* Quick Templates */}
          <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b">
            <span className="text-sm text-gray-500 mr-2">Quick Templates:</span>
            <Button variant="ghost" size="sm" onClick={() => applyTemplate('weekdays')}>
              Mon-Fri 9-5
            </Button>
            <Button variant="ghost" size="sm" onClick={() => applyTemplate('fullweek')}>
              Full Week 9-5
            </Button>
            <Button variant="ghost" size="sm" onClick={() => applyTemplate('clear')}>
              Clear All
            </Button>
          </div>

          {/* Schedule Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day, index) => (
                <div
                  key={day.value}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    weeklySchedule[index].isWorking
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleWorkingDay(index)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      weeklySchedule[index].isWorking ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        weeklySchedule[index].isWorking ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>

                  {/* Day Name */}
                  <div className="w-28">
                    <p className="font-medium text-gray-900">{day.label}</p>
                    <p className="text-xs text-gray-500">
                      {weeklySchedule[index].isWorking ? 'Working' : 'Day Off'}
                    </p>
                  </div>

                  {/* Time Inputs */}
                  {weeklySchedule[index].isWorking && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-500">Start:</label>
                        <input
                          type="time"
                          value={weeklySchedule[index].startTime}
                          onChange={(e) => handleScheduleChange(index, 'startTime', e.target.value)}
                          className="input py-1 px-2"
                        />
                        <span className="text-xs text-gray-400">
                          {(() => {
                            const [h, m] = weeklySchedule[index].startTime.split(':').map(Number);
                            const period = h >= 12 ? 'PM' : 'AM';
                            const h12 = h % 12 || 12;
                            return `${h12}:${String(m).padStart(2, '0')} ${period}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-500">End:</label>
                        <input
                          type="time"
                          value={weeklySchedule[index].endTime}
                          onChange={(e) => handleScheduleChange(index, 'endTime', e.target.value)}
                          className="input py-1 px-2"
                        />
                        <span className="text-xs text-gray-400">
                          {(() => {
                            const [h, m] = weeklySchedule[index].endTime.split(':').map(Number);
                            const period = h >= 12 ? 'PM' : 'AM';
                            const h12 = h % 12 || 12;
                            return `${h12}:${String(m).padStart(2, '0')} ${period}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex-1 text-right">
                        <Badge variant="default">
                          {(() => {
                            const [startH, startM] = weeklySchedule[index].startTime.split(':').map(Number);
                            const [endH, endM] = weeklySchedule[index].endTime.split(':').map(Number);
                            const mins = (endH * 60 + endM) - (startH * 60 + startM);
                            if (mins <= 0) return '0h';
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            return m > 0 ? `${h}h ${m}m` : `${h}h`;
                          })()}
                        </Badge>
                      </div>
                    </>
                  )}

                  {/* Copy Day Button */}
                  {weeklySchedule[index].isWorking && (
                    <div className="relative ml-auto">
                      <button
                        onClick={() => setCopyMenuOpen(copyMenuOpen === index ? null : index)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-white rounded-lg transition-colors"
                        title={`Copy ${day.short} to...`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {copyMenuOpen === index && (
                        <div
                          ref={copyMenuRef}
                          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-44"
                        >
                          <button
                            onClick={() => copyDayTo(index, 'all')}
                            className="w-full px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                          >
                            Copy to All Days
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          {DAYS_OF_WEEK.filter(d => d.value !== day.value).map(targetDay => (
                            <button
                              key={targetDay.value}
                              onClick={() => copyDayTo(index, targetDay.value)}
                              className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Copy to {targetDay.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end mt-6 pt-4 border-t">
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSaveSchedule}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!selectedEmployee && !loading && (
        <Card padding="lg">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Employee</h3>
            <p className="text-gray-500">
              Search and select an employee above to view and manage their work schedule
            </p>
          </div>
        </Card>
      )}

      {/* Copy to Others Modal */}
      <Modal
        isOpen={showCopyModal}
        onClose={() => {
          setShowCopyModal(false);
          setCopyToEmployees([]);
        }}
        title="Copy Schedule to Other Employees"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setShowCopyModal(false);
              setCopyToEmployees([]);
            }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Copy}
              onClick={handleCopySchedule}
              disabled={saving || copyToEmployees.length === 0}
            >
              {saving ? 'Copying...' : `Copy to ${copyToEmployees.length} Employee${copyToEmployees.length !== 1 ? 's' : ''}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Select employees to copy the current schedule to. This will replace their existing schedules.
          </p>

          <div className="max-h-60 overflow-auto border rounded-lg divide-y">
            {employees
              .filter(emp => emp.id !== selectedEmployee?.id)
              .map(emp => (
                <label
                  key={emp.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={copyToEmployees.includes(emp.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCopyToEmployees([...copyToEmployees, emp.id]);
                      } else {
                        setCopyToEmployees(copyToEmployees.filter(id => id !== emp.id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <Avatar name={`${emp.firstName} ${emp.lastName}`} src={emp.profilePhoto} size="sm" />
                  <div>
                    <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                </label>
              ))}
          </div>

          {copyToEmployees.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              This will replace the existing schedules for {copyToEmployees.length} employee(s) effective from {effectiveFrom}.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ScheduleManagement;
