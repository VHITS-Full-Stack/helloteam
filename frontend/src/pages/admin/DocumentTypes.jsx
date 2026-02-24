import { useState, useEffect } from 'react';
import {
  FileText, Plus, Pencil, Trash2, Loader2, AlertCircle, Search,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import documentTypeService from '../../services/documentType.service';

const CATEGORIES = [
  { key: 'GOVERNMENT_ID', label: 'Government ID' },
  { key: 'PROOF_OF_ADDRESS', label: 'Proof of Address' },
];

const DocumentTypes = () => {
  const [activeTab, setActiveTab] = useState('GOVERNMENT_ID');
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingType, setEditingType] = useState(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingType, setDeletingType] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      const response = await documentTypeService.getAll();
      if (response.success) {
        setDocumentTypes(response.data);
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch document types');
    } finally {
      setLoading(false);
    }
  };

  const filteredTypes = documentTypes.filter((dt) => dt.category === activeTab);

  const openAddModal = () => {
    setModalMode('add');
    setEditingType(null);
    setFormName('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (docType) => {
    setModalMode('edit');
    setEditingType(docType);
    setFormName(docType.name);
    setFormError('');
    setShowModal(true);
  };

  const handleSubmitForm = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'add') {
        const response = await documentTypeService.create({
          name: formName.trim(),
          category: activeTab,
        });
        if (response.success) {
          setShowModal(false);
          setFormName('');
          setFormError('');
          fetchDocumentTypes();
        } else {
          setFormError(response.error || 'Failed to create document type');
        }
      } else {
        const response = await documentTypeService.update(editingType.id, {
          name: formName.trim(),
        });
        if (response.success) {
          setShowModal(false);
          setFormName('');
          setFormError('');
          fetchDocumentTypes();
        } else {
          setFormError(response.error || 'Failed to update document type');
        }
      }
    } catch (err) {
      setFormError(err.error || err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (docType) => {
    try {
      const response = await documentTypeService.update(docType.id, {
        isActive: !docType.isActive,
      });
      if (response.success) {
        fetchDocumentTypes();
      }
    } catch (err) {
      setError(err.error || 'Failed to update status');
    }
  };

  const openDeleteModal = (docType) => {
    setDeletingType(docType);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    setDeleting(true);
    try {
      const response = await documentTypeService.delete(deletingType.id);
      if (response.success) {
        setShowDeleteModal(false);
        setDeletingType(null);
        fetchDocumentTypes();
      } else {
        setError(response.error || 'Failed to delete document type');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete document type');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" />
            Document Types
          </h1>
          <p className="text-gray-500 mt-1">
            Manage government ID and proof of address types for employee onboarding
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Type
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {CATEGORIES.map((cat) => {
              const count = documentTypes.filter((dt) => dt.category === cat.key).length;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveTab(cat.key)}
                  className={`
                    flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === cat.key
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {cat.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === cat.key
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No document types found</p>
                    <p className="text-gray-400 text-sm mt-1">Click "Add Type" to create one</p>
                  </td>
                </tr>
              ) : (
                filteredTypes.map((docType) => (
                  <tr key={docType.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">{docType.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(docType)}
                        className={`
                          inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
                          ${docType.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }
                        `}
                      >
                        {docType.isActive ? (
                          <ToggleRight className="w-3.5 h-3.5" />
                        ) : (
                          <ToggleLeft className="w-3.5 h-3.5" />
                        )}
                        {docType.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(docType)}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(docType)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'Add Document Type' : 'Edit Document Type'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitForm}
              disabled={submitting}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {modalMode === 'add' ? 'Add' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              {CATEGORIES.find((c) => c.key === activeTab)?.label}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Passport, Utility Bill"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting) handleSubmitForm();
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Document Type"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{deletingType?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default DocumentTypes;
