import { useState } from 'react';
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

  const [downloading, setDownloading] = useState(false);

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

  const agreementLabel = client?.agreementType === 'WEEKLY_ACH' ? 'Weekly ACH' : client?.agreementType === 'MONTHLY_ACH' ? 'Monthly ACH' : client?.agreementType || 'N/A';

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
            <p className="text-xs text-gray-500">{client.contactPerson} &middot; {client.user?.email}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
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

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Contact + Policies */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Contact</h3>
            <InfoRow label="Email" value={client.user?.email} icon={Mail} />
            <InfoRow label="Phone" value={client.phone || 'Not provided'} icon={Phone} />
            <InfoRow label="Address" value={client.address || 'Not provided'} icon={MapPin} />
            <InfoRow label="Timezone" value={client.timezone || 'UTC'} icon={Clock} />
            <InfoRow label="Member Since" value={new Date(client.createdAt).toLocaleDateString()} icon={Calendar} />
          </Card>

          {/* Policies */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Policies</h3>
            <div className="space-y-0">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">Paid Leave</span>
                <div className="flex items-center gap-2">
                  {pol?.allowPaidLeave && (
                    <span className="text-xs text-gray-400">{pol.annualPaidLeaveDays} days/yr</span>
                  )}
                  <Badge variant={pol?.allowPaidLeave ? 'success' : 'warning'} size="sm">
                    {pol?.allowPaidLeave ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">Unpaid Leave</span>
                <Badge variant={pol?.allowUnpaidLeave ? 'success' : 'warning'} size="sm">
                  {pol?.allowUnpaidLeave ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">Overtime</span>
                <div className="flex items-center gap-2">
                  {pol?.allowOvertime && (
                    <span className="text-xs text-gray-400">{pol.overtimeRequiresApproval ? 'Needs approval' : 'No approval'}</span>
                  )}
                  <Badge variant={pol?.allowOvertime ? 'success' : 'warning'} size="sm">
                    {pol?.allowOvertime ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-gray-500">Notice Period</span>
                <Badge variant={pol?.requireTwoWeeksNotice ? 'info' : 'default'} size="sm">
                  {pol?.requireTwoWeeksNotice ? '2 Weeks' : 'Flexible'}
                </Badge>
              </div>
            </div>
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

        {/* RIGHT: Agreement + Business + Payment */}
        <div className="space-y-4">
          {/* Agreement */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Agreement</h3>
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

          {/* Business Info */}
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

          {/* Payment */}
          {ag?.paymentMethod && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" /> Payment
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
            </Card>
          )}
        </div>
      </div>

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
