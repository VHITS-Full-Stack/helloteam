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
  RefreshCw,
  Settings,
  DollarSign,
  FolderOpen,
  FileText,
  Download,
  PenTool,
  CheckCircle,
  CreditCard,
  Landmark,
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

  const getOnboardingBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'PENDING_AGREEMENT':
        return <Badge variant="warning">Pending Agreement</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getAgreementTypeLabel = (type) => {
    switch (type) {
      case 'WEEKLY_ACH':
        return 'Weekly ACH';
      case 'MONTHLY_ACH':
        return 'Monthly ACH';
      default:
        return type || 'N/A';
    }
  };

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="default">Inactive</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const onDeleteClient = async () => {
    const success = await handleDeleteClient();
    if (success) {
      navigate('/admin/clients');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-500">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Client Not Found</h3>
          <p className="text-gray-500 mb-4">The client you're looking for doesn't exist.</p>
          <Button variant="primary" onClick={() => navigate('/admin/clients')}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/admin/clients')}>
            Back
          </Button>
          <div className="flex items-center gap-4">
            {client.logoUrl ? (
              <Avatar src={client.logoUrl} name={client.companyName} size="xl" />
            ) : (
              <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building className="w-8 h-8 text-primary" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{client.companyName}</h2>
              <p className="text-gray-500">{client.contactPerson}</p>
            </div>
            {getStatusBadge(client.user?.status)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
          <Button variant="outline" icon={Edit} onClick={() => navigate(`/admin/clients/${id}/edit`)}>
            Edit
          </Button>
          <Button variant="outline" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
            Delete
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Client Information */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{client.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{client.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">{client.address || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Timezone</p>
                  <p className="font-medium text-gray-900">{client.timezone || 'UTC'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-medium text-gray-900">
                    {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Employees</p>
                  <p className="font-medium text-gray-900">{clientEmployees.length} assigned</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Agreement Status */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Agreement Status</h3>
              <FileText className="w-5 h-5 text-gray-400" />
            </div>

            {client.onboardingStatus === 'PENDING_AGREEMENT' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm text-yellow-700">
                    This client has not yet signed their service agreement.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Agreement Type</p>
                  <p className="font-medium text-gray-900">{getAgreementTypeLabel(client.agreementType)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                {client.onboardingStatus === 'COMPLETED' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-sm text-gray-500">Onboarding Status</p>
                  {getOnboardingBadge(client.onboardingStatus)}
                </div>
              </div>

              {client.agreement?.signedByName && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <PenTool className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Signed By</p>
                    <p className="font-medium text-gray-900">{client.agreement.signedByName}</p>
                  </div>
                </div>
              )}

              {client.agreement?.signedAt && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Signed Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(client.agreement.signedAt).toLocaleDateString()} at{' '}
                      {new Date(client.agreement.signedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}

              {client.agreement?.signedByIP && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Settings className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">IP Address</p>
                    <p className="font-medium text-gray-900">{client.agreement.signedByIP}</p>
                  </div>
                </div>
              )}
            </div>

            {client.agreement?.signatureImage && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Signature</p>
                <div className="bg-white border border-gray-200 rounded-lg p-2 inline-block">
                  <img
                    src={client.agreement.signatureImage}
                    alt="Client Signature"
                    className="h-16 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Business Information */}
            {client.agreement?.businessName && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400" />
                  Business Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Entity Name</p>
                    <p className="text-sm font-medium text-gray-900">{client.agreement.businessName}</p>
                  </div>
                  {client.agreement.businessAddress && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="text-sm font-medium text-gray-900">{client.agreement.businessAddress}</p>
                    </div>
                  )}
                  {client.agreement.businessEIN && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">EIN</p>
                      <p className="text-sm font-medium text-gray-900">{client.agreement.businessEIN}</p>
                    </div>
                  )}
                  {client.agreement.signerName && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Authorized Signer</p>
                      <p className="text-sm font-medium text-gray-900">{client.agreement.signerName}</p>
                    </div>
                  )}
                  {client.agreement.signerAddress && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Signer Address</p>
                      <p className="text-sm font-medium text-gray-900">{client.agreement.signerAddress}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Authorization */}
            {client.agreement?.paymentMethod && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  Payment Authorization
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Payment Method</p>
                    <p className="text-sm font-medium text-gray-900">
                      {client.agreement.paymentMethod === 'both'
                        ? 'Credit Card & ACH'
                        : client.agreement.paymentMethod === 'credit_card'
                        ? 'Credit Card'
                        : 'ACH Bank Transfer'}
                    </p>
                  </div>

                  {(client.agreement.paymentMethod === 'credit_card' || client.agreement.paymentMethod === 'both') && (
                    <>
                      {client.agreement.ccCardholderName && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Cardholder</p>
                          <p className="text-sm font-medium text-gray-900">{client.agreement.ccCardholderName}</p>
                        </div>
                      )}
                      {client.agreement.ccCardType && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Card Type</p>
                          <p className="text-sm font-medium text-gray-900">{client.agreement.ccCardType}</p>
                        </div>
                      )}
                      {client.agreement.ccCardNumber && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Card Number</p>
                          <p className="text-sm font-medium text-gray-900">
                            ****{client.agreement.ccCardNumber.slice(-4)}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {(client.agreement.paymentMethod === 'ach' || client.agreement.paymentMethod === 'both') && (
                    <>
                      {client.agreement.achAccountHolder && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Account Holder</p>
                          <p className="text-sm font-medium text-gray-900">{client.agreement.achAccountHolder}</p>
                        </div>
                      )}
                      {client.agreement.achBankName && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Bank</p>
                          <p className="text-sm font-medium text-gray-900">{client.agreement.achBankName}</p>
                        </div>
                      )}
                      {client.agreement.achAccountNumber && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Account Number</p>
                          <p className="text-sm font-medium text-gray-900">
                            ****{client.agreement.achAccountNumber.slice(-4)}
                          </p>
                        </div>
                      )}
                      {client.agreement.achAccountType && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Account Type</p>
                          <p className="text-sm font-medium text-gray-900">{client.agreement.achAccountType}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                variant="outline"
                icon={Download}
                onClick={handleDownloadPdf}
                loading={downloading}
              >
                Download Agreement PDF
              </Button>
            </div>
          </Card>

          {/* Policies */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Policies</h3>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Paid Leave</span>
                  <Badge variant={client.clientPolicies?.allowPaidLeave ? 'success' : 'warning'}>
                    {client.clientPolicies?.allowPaidLeave ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
                {client.clientPolicies?.allowPaidLeave && (
                  <p className="text-sm text-gray-500">
                    {client.clientPolicies.annualPaidLeaveDays} days/year ({client.clientPolicies.paidLeaveType})
                  </p>
                )}
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Unpaid Leave</span>
                  <Badge variant={client.clientPolicies?.allowUnpaidLeave ? 'success' : 'warning'}>
                    {client.clientPolicies?.allowUnpaidLeave ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Overtime</span>
                  <Badge variant={client.clientPolicies?.allowOvertime ? 'success' : 'warning'}>
                    {client.clientPolicies?.allowOvertime ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
                {client.clientPolicies?.allowOvertime && (
                  <p className="text-sm text-gray-500">
                    {client.clientPolicies.overtimeRequiresApproval ? 'Requires approval' : 'No approval needed'}
                  </p>
                )}
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Notice Period</span>
                  <Badge variant={client.clientPolicies?.requireTwoWeeksNotice ? 'info' : 'default'}>
                    {client.clientPolicies?.requireTwoWeeksNotice ? '2 Weeks Required' : 'Flexible'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Billing Rates */}
          {/* <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Billing Rates</h3>
              <DollarSign className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">Default Hourly Rate</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  ${Number(client.clientPolicies?.defaultHourlyRate || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Per hour</p>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-gray-600">Overtime Rate</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">
                  ${Number(client.clientPolicies?.defaultOvertimeRate || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Number(client.clientPolicies?.defaultOvertimeRate || 0) === 0
                    ? 'Uses 1.5x hourly rate'
                    : 'Per overtime hour'}
                </p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-600">Currency</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {client.clientPolicies?.currency || 'USD'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Billing currency</p>
              </div>
            </div>
            {Number(client.clientPolicies?.defaultHourlyRate || 0) === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm text-yellow-700">
                    No billing rates configured. Click Edit to set up rates for payroll calculations.
                  </p>
                </div>
              </div>
            )}
          </Card> */}

          {/* Connected Groups */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Connected Groups</h3>
              <Button variant="outline" size="sm" icon={FolderOpen} onClick={() => navigate(`/admin/clients/${id}/groups`)}>
                Manage
              </Button>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FolderOpen className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Total Connected</p>
                <p className="font-medium text-gray-900">{connectedGroups.length} groups</p>
              </div>
            </div>
          </Card>

          {/* Assigned Employees */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Employees</h3>
              <Button variant="outline" size="sm" icon={Users} onClick={() => navigate(`/admin/clients/${id}/employees`)}>
                Manage
              </Button>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Users className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Total Assigned</p>
                <p className="font-medium text-gray-900">{clientEmployees.length} employees</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{client.companyName}</strong>?
            This will deactivate the client account and remove all employee assignments.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={onDeleteClient} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ClientDetail;
