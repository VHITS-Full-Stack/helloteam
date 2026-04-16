import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  MapPin,
  Clock,
  Users,
  Calendar,
  Edit,
  Trash2,
  X,
  AlertCircle,
  FileText,
  Download,
  PenTool,
  CheckCircle,
  CreditCard,
  FolderOpen,
  Settings,
  Eye,
  Search,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Modal,
} from '../../../components/common';
import { useClientData } from '../../../hooks/useClientData';
import clientService from '../../../services/client.service';
import { useAuth } from '../../../context/AuthContext';

// Compact info row
const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="flex items-center gap-2 text-xs text-gray-500">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
    <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">{value || '—'}</span>
  </div>
);

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { impersonate, user: currentUser } = useAuth();
  const [impersonating, setImpersonating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const {
    client,
    clientEmployees,
    connectedGroups,
    loading,
    error,
    submitting,
    showDeleteModal,
    setError,
    setShowDeleteModal,
    handleDeleteClient,
    closeDeleteModal,
    refresh,
  } = useClientData({ mode: 'detail', id });

  const handleImpersonate = async () => {
    if (!client?.user?.id) return;
    setImpersonating(true);
    const result = await impersonate(client.user.id);
    if (!result.success) {
      setError(result.error || 'Failed to impersonate');
    }
    setImpersonating(false);
  };

  const [downloading, setDownloading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmt12 = (t) => {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const formatSchedule = (schedules) => {
    if (!schedules?.length) return null;
    return schedules
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map(s => ({
        day: DAY_ABBR[s.dayOfWeek],
        time: `${fmt12(s.startTime)} – ${fmt12(s.endTime)}`,
      }));
  };

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return clientEmployees;
    return clientEmployees.filter(emp =>
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q)
    );
  }, [clientEmployees, employeeSearch]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await clientService.downloadAgreementPdf(id);
    } catch (err) {
      setError(err.message || 'Failed to download agreement PDF');
    } finally {
      setDownloading(false);
    }
  };

  const onDeleteClient = async () => {
    const success = await handleDeleteClient();
    if (success) navigate('/admin/clients');
  };

  const agreementLabel = client?.agreementType === 'WEEKLY' ? 'Weekly' : client?.agreementType === 'BI_WEEKLY' ? 'Bi-Weekly' : client?.agreementType === 'MONTHLY' ? 'Monthly' : client?.agreementType || 'N/A';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Client Not Found</h3>
          <Button variant="primary" className="mt-3" onClick={() => navigate('/admin/clients')}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  const ag = client.agreement;
  const pol = client.clientPolicies;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/clients')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {client.logoUrl ? (
            <Avatar src={client.logoUrl} name={client.companyName} size="md" />
          ) : (
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <Building className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{client.companyName}</h2>
              <Badge variant={client.user?.status === 'ACTIVE' ? 'success' : 'default'}>
                {client.user?.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">{client.contacts?.[0]?.name || client.contactPerson} &middot; {client.user?.email}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && client.user?.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              icon={Eye}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={handleImpersonate}
              loading={impersonating}
            >
              Impersonate
            </Button>
          )}
          <Button variant="outline" size="sm" icon={Edit} onClick={() => navigate(`/admin/clients/${id}/edit`)}>
            Edit
          </Button>
          <Button variant="outline" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
            Delete
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Pending banner */}
      {client.onboardingStatus === 'PENDING_AGREEMENT' && (
        <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <p className="text-xs text-yellow-700">Client has not yet signed their service agreement.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { key: 'overview', label: 'Overview', icon: Building },
            { key: 'employees', label: 'Employees', icon: Users, count: clientEmployees.length },
            { key: 'policies', label: 'Policies', icon: Settings },
            { key: 'agreement', label: 'Agreement', icon: FileText },
            { key: 'payment', label: 'Payment', icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full leading-none">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Company Info */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Company Info</h3>
            <InfoRow label="Email" value={client.user?.email} icon={Mail} />
            <InfoRow label="Phone" value={client.phone || 'Not provided'} icon={Phone} />
            <InfoRow label="Address" value={client.address || 'Not provided'} icon={MapPin} />
            <InfoRow label="Timezone" value={client.timezone || 'UTC'} icon={Clock} />
            <InfoRow label="Member Since" value={new Date(client.createdAt).toLocaleDateString()} icon={Calendar} />
          </Card>

          {/* Contact Persons */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Contact Persons</h3>
            {client.contacts && client.contacts.length > 0 ? (
              <div className="space-y-2">
                {client.contacts.map((contact, idx) => (
                  <div key={contact.id || idx} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {contact.name}
                        {idx === 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Primary</span>}
                      </p>
                      {contact.position && <p className="text-xs text-gray-500">{contact.position}</p>}
                    </div>
                    <div className="text-right">
                      {contact.phone && <p className="text-xs text-gray-500">{contact.phone}</p>}
                      {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No contacts added</p>
            )}
          </Card>

          {/* Groups & Employees */}
          <Card>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">Groups</span>
                <span className="text-sm font-semibold text-gray-900">{connectedGroups.length}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/clients/${id}/groups`)}>Manage</Button>
            </div>
            <hr className="my-1 border-gray-100" />
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">Employees</span>
                <span className="text-sm font-semibold text-gray-900">{clientEmployees.length}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/clients/${id}/employees`)}>Manage</Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'policies' && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Client Policies</h3>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
              <span className="text-sm text-gray-600">Paid Leave</span>
              <div className="flex items-center gap-2">
                {pol?.allowPaidLeave && (
                  <span className="text-xs text-gray-400">{pol.annualPaidLeaveDays} days/yr</span>
                )}
                <Badge variant={pol?.allowPaidLeave ? 'success' : 'warning'} size="sm">
                  {pol?.allowPaidLeave ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
              <span className="text-sm text-gray-600">Unpaid Leave</span>
              <Badge variant={pol?.allowUnpaidLeave ? 'success' : 'warning'} size="sm">
                {pol?.allowUnpaidLeave ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
              <span className="text-sm text-gray-600">Overtime</span>
              <div className="flex items-center gap-2">
                {pol?.allowOvertime && (
                  <span className="text-xs text-gray-400">{pol.overtimeRequiresApproval ? 'Needs approval' : 'No approval'}</span>
                )}
                <Badge variant={pol?.allowOvertime ? 'success' : 'warning'} size="sm">
                  {pol?.allowOvertime ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
              <span className="text-sm text-gray-600">Notice Period</span>
              <Badge variant={pol?.requireTwoWeeksNotice ? 'info' : 'default'} size="sm">
                {pol?.requireTwoWeeksNotice ? '2 Weeks' : 'Flexible'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-600">Auto-Approve Timesheets</span>
              <div className="flex items-center gap-2">
                {pol?.autoApproveTimesheets && (
                  <span className="text-xs text-gray-400">{pol.autoApproveMinutes || 15} min</span>
                )}
                <Badge variant={pol?.autoApproveTimesheets ? 'success' : 'warning'} size="sm">
                  {pol?.autoApproveTimesheets ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'agreement' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Agreement Details</h3>
              {client.onboardingStatus === 'COMPLETED' ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                  <CheckCircle className="w-3.5 h-3.5" /> Signed
                </span>
              ) : (
                <Badge variant="warning" size="sm">Pending</Badge>
              )}
            </div>
            <InfoRow label="Type" value={agreementLabel} icon={FileText} />
            {ag?.signedByName && <InfoRow label="Signed By" value={ag.signedByName} icon={PenTool} />}
            {ag?.signedAt && (
              <InfoRow
                label="Signed Date"
                value={`${new Date(ag.signedAt).toLocaleDateString()} ${new Date(ag.signedAt).toLocaleTimeString()}`}
                icon={Calendar}
              />
            )}
            {ag?.signedByIP && <InfoRow label="IP" value={ag.signedByIP} icon={Settings} />}

            {ag?.signatureImage && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Signature</p>
                <div className="bg-gray-50 border border-gray-200 rounded p-1.5 inline-block">
                  <img src={ag.signatureImage} alt="Signature" className="h-10 object-contain" />
                </div>
              </div>
            )}

            <div className="mt-3">
              <Button variant="outline" size="sm" icon={Download} onClick={handleDownloadPdf} loading={downloading}>
                Download PDF
              </Button>
            </div>
          </Card>

          {ag?.businessName && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-gray-400" /> Business Info
              </h3>
              <InfoRow label="Entity Name" value={ag.businessName} />
              {ag.businessAddress && <InfoRow label="Address" value={ag.businessAddress} />}
              {ag.businessEIN && <InfoRow label="EIN" value={ag.businessEIN} />}
              {ag.signerName && <InfoRow label="Signer" value={ag.signerName} />}
              {ag.signerAddress && <InfoRow label="Signer Address" value={ag.signerAddress} />}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'payment' && (
        <Card>
          {ag?.paymentMethod ? (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" /> Payment Information
              </h3>
              <InfoRow
                label="Method"
                value={ag.paymentMethod === 'both' ? 'Credit Card & ACH' : ag.paymentMethod === 'credit_card' ? 'Credit Card' : 'ACH'}
              />

              {(ag.paymentMethod === 'credit_card' || ag.paymentMethod === 'both') && (
                <>
                  {ag.ccCardholderName && <InfoRow label="Cardholder" value={ag.ccCardholderName} />}
                  {ag.ccCardType && <InfoRow label="Card Type" value={ag.ccCardType} />}
                  {ag.ccCardNumber && <InfoRow label="Card Number" value={`****${ag.ccCardNumber.slice(-4)}`} />}
                </>
              )}

              {(ag.paymentMethod === 'ach' || ag.paymentMethod === 'both') && (
                <>
                  {ag.achAccountHolder && <InfoRow label="Account Holder" value={ag.achAccountHolder} />}
                  {ag.achBankName && <InfoRow label="Bank" value={ag.achBankName} />}
                  {ag.achAccountNumber && <InfoRow label="Account" value={`****${ag.achAccountNumber.slice(-4)}`} />}
                  {ag.achAccountType && <InfoRow label="Type" value={ag.achAccountType} />}
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No payment information on file</p>
          )}
        </Card>
      )}

      {activeTab === 'employees' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary w-56"
              />
            </div>
            <Button variant="outline" size="sm" icon={Users} onClick={() => navigate(`/admin/clients/${id}/employees`)}>
              Manage
            </Button>
          </div>

          <Card padding="none">
            {clientEmployees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No employees assigned to this client</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(`/admin/clients/${id}/employees`)}>
                  Assign Employees
                </Button>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No employees match your search</p>
            ) : (
              <>
              <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-xl">
                <div className="w-1 flex-shrink-0" />
                <div className="w-8 flex-shrink-0" />
                <div className="w-44 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</div>
                <div className="w-32 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</div>
                <div className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</div>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredEmployees.map((emp) => {
                  const scheduleGroups = formatSchedule(emp.schedules);
                  const group = emp.groupAssignments?.[0]?.group;
                  const isActive = emp.user?.status === 'ACTIVE';
                  return (
                    <div key={emp.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                      {/* Status bar */}
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                      {/* Avatar */}
                      <Avatar name={`${emp.firstName} ${emp.lastName}`} src={emp.profilePhoto} size="sm" />
                      {/* Name + email */}
                      <div className="w-44 flex-shrink-0">
                        <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                        {emp.user?.email && <p className="text-xs text-gray-400 truncate">{emp.user.email}</p>}
                      </div>
                      {/* Group */}
                      <div className="w-32 flex-shrink-0">
                        {group
                          ? <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">{group.name}</span>
                          : <span className="text-xs text-gray-400">No group</span>}
                      </div>
                      {/* Schedule */}
                      <div className="flex-1">
                        {scheduleGroups ? (
                          <div className="grid grid-cols-2 gap-2">
                            {scheduleGroups.map((sg, i) => (
                              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-700">
                                <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="w-7 font-semibold text-gray-800">{sg.day}</span>
                                <span className="text-gray-300">|</span>
                                <span>{sg.time}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No schedule set</span>
                        )}
                      </div>
                      {/* Status badge */}
                      <Badge variant={isActive ? 'success' : 'default'} size="sm">
                        {emp.user?.status || '—'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeDeleteModal} title="Delete Client" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{client.companyName}</strong>?
            This will deactivate the account and remove all employee assignments.
          </p>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closeDeleteModal}>Cancel</Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={onDeleteClient} loading={submitting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDetail;
