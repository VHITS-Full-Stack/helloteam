import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Shield,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Avatar,
} from '../../../components/common';
import { useEmployeeDetail } from '../../../hooks/useEmployeeData';

const EmployeeDocuments = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [rejectingDoc, setRejectingDoc] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewingDoc, setReviewingDoc] = useState(null);
  const [confirmApproveDoc, setConfirmApproveDoc] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);

  const [bulkRejectReason, setBulkRejectReason] = useState('');

  const {
    employee,
    loading,
    error,
    reviewDocument,
    finalizeKycReview,
    approveKyc,
    rejectKyc,
  } = useEmployeeDetail(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-gray-600">{error || 'Employee not found'}</p>
        <Button variant="outline" onClick={() => navigate(`/admin/employees/${id}`)}>
          Go Back
        </Button>
      </div>
    );
  }

  const kycStatus = employee.kycStatus || 'PENDING';
  const fullName = `${employee.firstName} ${employee.lastName}`;

  // When overall kycStatus is RESUBMITTED, show per-document PENDING as RESUBMITTED
  const getDocStatus = (rawStatus) => {
    if (kycStatus === 'RESUBMITTED' && (rawStatus === 'PENDING' || !rawStatus)) return 'RESUBMITTED';
    return rawStatus || 'PENDING';
  };

  const documents = [
    { key: 'governmentId', label: 'Government ID #1', type: employee.governmentIdType, url: employee.governmentIdUrl, status: getDocStatus(employee.governmentIdStatus), rejectNote: employee.governmentIdRejectNote },
    { key: 'governmentId2', label: 'Government ID #2', type: employee.governmentId2Type, url: employee.governmentId2Url, status: getDocStatus(employee.governmentId2Status), rejectNote: employee.governmentId2RejectNote },
    { key: 'proofOfAddress', label: 'Proof of Address', type: employee.proofOfAddressType, url: employee.proofOfAddressUrl, status: getDocStatus(employee.proofOfAddressStatus), rejectNote: employee.proofOfAddressRejectNote },
  ];

  const hasPending = documents.some(d => d.status === 'PENDING' || d.status === 'RESUBMITTED');
  const allReviewed = !hasPending;

  const getStatusColor = (status) => {
    if (status === 'APPROVED') return 'success';
    if (status === 'REJECTED') return 'error';
    if (status === 'RESUBMITTED') return 'info';
    return 'warning';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/employees/${id}`)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Avatar name={fullName} size="md" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">KYC Document Review</h2>
              <p className="text-sm text-gray-500">{fullName}</p>
            </div>
          </div>
        </div>
        <Badge variant={getStatusColor(kycStatus)} size="lg">
          <Shield className="w-3.5 h-3.5 mr-1" />
          KYC: {kycStatus}
        </Badge>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
        kycStatus === 'APPROVED' ? 'bg-green-50 border border-green-200 text-green-700' :
        kycStatus === 'REJECTED' ? 'bg-red-50 border border-red-200 text-red-700' :
        kycStatus === 'RESUBMITTED' ? 'bg-blue-50 border border-blue-200 text-blue-700' :
        'bg-amber-50 border border-amber-200 text-amber-700'
      }`}>
        {kycStatus === 'APPROVED' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
        {kycStatus === 'REJECTED' && <XCircle className="w-5 h-5 flex-shrink-0" />}
        {kycStatus === 'RESUBMITTED' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
        {kycStatus === 'PENDING' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
        <p>
          {kycStatus === 'APPROVED' && 'All identity documents have been verified and approved.'}
          {kycStatus === 'PENDING' && 'Review each document below and approve or reject individually, then submit your review.'}
          {kycStatus === 'REJECTED' && 'KYC was rejected. Employee has been notified to re-upload documents.'}
          {kycStatus === 'RESUBMITTED' && 'Employee has resubmitted their documents. Please review the updated documents below.'}
        </p>
      </div>

      {/* Overall Approve / Reject */}
      {(kycStatus === 'PENDING' || kycStatus === 'RESUBMITTED') && (
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Quick Action</h3>
              <p className="text-xs text-gray-500 mt-0.5">Approve or reject all documents at once</p>
            </div>
            {bulkAction === 'rejecting' ? (
              <div className="flex items-center gap-3 flex-1 ml-6">
                <input
                  type="text"
                  placeholder="Rejection reason..."
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setBulkAction(null); setBulkRejectReason(''); }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!bulkRejectReason.trim()}
                  loading={bulkAction === 'rejectingAll'}
                  onClick={async () => {
                    setBulkAction('rejectingAll');
                    await rejectKyc(bulkRejectReason);
                    setBulkAction(null);
                    setBulkRejectReason('');
                    navigate(`/admin/employees/${id}`);
                  }}
                >
                  Confirm Reject All
                </Button>
              </div>
            ) : bulkAction === 'confirmApprove' ? (
              <div className="flex items-center gap-3 flex-1 ml-6">
                <p className="text-sm text-green-700 flex-1">Are you sure you want to approve all documents?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  loading={bulkAction === 'approvingAll'}
                  onClick={async () => {
                    setBulkAction('approvingAll');
                    await approveKyc();
                    setBulkAction(null);
                    navigate(`/admin/employees/${id}`);
                  }}
                >
                  Yes, Approve All
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={XCircle}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => setBulkAction('rejecting')}
                  disabled={!!bulkAction}
                >
                  Reject All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={CheckCircle}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  disabled={!!bulkAction}
                  onClick={() => setBulkAction('confirmApprove')}
                >
                  Approve All
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Document Cards - Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {documents.map((doc) => (
          <Card key={doc.key} padding="none" className="overflow-hidden flex flex-col">
            {/* Card Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              doc.status === 'APPROVED' ? 'bg-green-50 border-green-200' :
              doc.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">{doc.label}</span>
              </div>
              <Badge variant={getStatusColor(doc.status)} size="sm">
                {doc.status}
              </Badge>
            </div>

            {/* Document Type */}
            {doc.type && (
              <div className="px-4 pt-3">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{doc.type}</span>
              </div>
            )}

            {/* Preview */}
            <div className="p-4 flex-1 flex items-center justify-center min-h-[220px]">
              {doc.url ? (
                (() => {
                  const urlPath = doc.url.split('?')[0].toLowerCase();
                  const isPdf = urlPath.endsWith('.pdf');
                  return isPdf ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <FileText className="w-12 h-12 text-red-500" />
                      <span className="text-sm text-gray-600">PDF Document</span>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 underline"
                      >
                        View PDF <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="w-full bg-gray-50 rounded-lg p-2">
                      <img
                        src={doc.url}
                        alt={doc.label}
                        className="w-full max-h-[280px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        role="button"
                        tabIndex="0"
                        onClick={() => window.open(doc.url, '_blank')}
                        onKeyDown={(evt) => {
                          if (evt.key === 'Enter' || evt.key === ' ') {
                            evt.preventDefault();
                            window.open(doc.url, '_blank');
                          }
                        }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<div class="flex flex-col items-center gap-2 py-8 text-gray-400"><span class="text-sm">Failed to load image</span></div>';
                        }}
                      />
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <FileText className="w-10 h-10" />
                  <span className="text-sm">Not uploaded</span>
                </div>
              )}
            </div>

            {/* Open in new tab link */}
            {doc.url && (
              <div className="px-4 pb-2 text-center">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
                >
                  Open full size <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Rejection note */}
            {doc.status === 'REJECTED' && doc.rejectNote && rejectingDoc !== doc.key && (
              <div className="px-4 pb-3">
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <span className="font-medium">Rejection reason:</span> {doc.rejectNote}
                </p>
              </div>
            )}

            {/* Actions */}
            {doc.url && kycStatus !== 'APPROVED' && doc.status !== 'APPROVED' && (
              <div className="px-4 pb-4 mt-auto">
                {rejectingDoc === doc.key ? (
                  <div className="space-y-2 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700 font-medium">Reason for rejecting:</p>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                      placeholder="e.g. Document is expired, image is blurry..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setRejectingDoc(null); setRejectReason(''); }}
                        disabled={reviewingDoc === doc.key}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={async () => {
                          setReviewingDoc(doc.key);
                          const result = await reviewDocument(doc.key, 'reject', rejectReason);
                          setReviewingDoc(null);
                          if (result?.success) {
                            setRejectingDoc(null);
                            setRejectReason('');
                          }
                        }}
                        loading={reviewingDoc === doc.key}
                        disabled={!rejectReason.trim()}
                      >
                        Confirm Reject
                      </Button>
                    </div>
                  </div>
                ) : confirmApproveDoc === doc.key ? (
                  <div className="space-y-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700 font-medium">Are you sure you want to approve {doc.label}?</p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmApproveDoc(null)}
                        disabled={reviewingDoc === doc.key}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          setReviewingDoc(doc.key);
                          await reviewDocument(doc.key, 'approve');
                          setReviewingDoc(null);
                          setConfirmApproveDoc(null);
                        }}
                        loading={reviewingDoc === doc.key}
                      >
                        Confirm Approve
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={XCircle}
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => { setRejectingDoc(doc.key); setRejectReason(''); }}
                      disabled={!!reviewingDoc}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={CheckCircle}
                      className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                      onClick={() => setConfirmApproveDoc(doc.key)}
                      disabled={!!reviewingDoc}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Submit Review */}
      {kycStatus !== 'APPROVED' && (
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              {hasPending ? (
                <p className="text-sm text-amber-600">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Please review all documents before submitting.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  All documents have been reviewed. Click submit to finalize the KYC review.
                </p>
              )}
            </div>
            <Button
              variant="primary"
              onClick={async () => {
                setBulkAction('finalizing');
                await finalizeKycReview();
                setBulkAction(null);
                navigate(`/admin/employees/${id}`);
              }}
              loading={bulkAction === 'finalizing'}
              disabled={!allReviewed || !!reviewingDoc || !!bulkAction}
            >
              Submit Review
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default EmployeeDocuments;
