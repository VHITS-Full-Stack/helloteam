import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Users,
  Shield,
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  X,
  Check,
} from "lucide-react";
import { PhoneInput } from "../../components/common";
import employeeOnboardingService from "../../services/employeeOnboarding.service";
import documentTypeService from "../../services/documentType.service";
import authService from "../../services/auth.service";
import api from "../../services/api";
import ImpersonationBanner from "../../components/layout/ImpersonationBanner";

const STEPS = [
  { label: "Personal Info", icon: User },
  { label: "Identity Documents", icon: Shield },
  { label: "Emergency Contacts", icon: Users },
];

const RELATIONSHIPS = ["Parent", "Spouse", "Sibling", "Friend", "Other"];

// Fallback document types in case API fails
const FALLBACK_GOV_ID_TYPES = [
  { id: "passport", name: "Passport" },
  { id: "driving-license", name: "Driving License" },
  { id: "identity-card", name: "Identity Card" },
];
const FALLBACK_PROOF_TYPES = [
  { id: "utility-bill", name: "Utility Bill" },
  { id: "bank-statement", name: "Bank Statement" },
  { id: "phone-bill", name: "Phone Bill" },
  { id: "internet-bill", name: "Internet Bill" },
  { id: "tax-document", name: "Tax Document" },
  { id: "other", name: "Other Official Document" },
];

const emptyContact = () => ({
  name: "",
  countryCode: "+1",
  phone: "",
  relationship: "",
  customRelationship: "",
});

const Onboarding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tokenVerified, setTokenVerified] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [kycStatus, setKycStatus] = useState(null);
  const [kycRejectionNote, setKycRejectionNote] = useState(null);
  const [docStatuses, setDocStatuses] = useState({});

  // Dynamic document types from API
  const [govIdTypes, setGovIdTypes] = useState(FALLBACK_GOV_ID_TYPES);
  const [proofOfAddressTypes, setProofOfAddressTypes] =
    useState(FALLBACK_PROOF_TYPES);

  // Step 1: Personal Info
  const [personalInfo, setPersonalInfo] = useState({
    countryCode: "+1",
    phone: "",
    address: "",
    personalEmail: "",
  });

  // Step 2: Emergency Contacts
  const [contacts, setContacts] = useState([
    emptyContact(),
    emptyContact(),
    emptyContact(),
  ]);

  // Step 3: Government ID 1
  const [idType, setIdType] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [existingIdUrl, setExistingIdUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Step 3: Government ID 2
  const [id2Type, setId2Type] = useState("");
  const [id2File, setId2File] = useState(null);
  const [id2Preview, setId2Preview] = useState(null);
  const [existingId2Url, setExistingId2Url] = useState(null);
  const fileInput2Ref = useRef(null);

  // Step 3: Proof of Address
  const [proofType, setProofType] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [existingProofUrl, setExistingProofUrl] = useState(null);
  const proofFileInputRef = useRef(null);

  // Handle token-based access (from rejection email link) or check existing auth
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const token = searchParams.get('token');

      if (token) {
        // Clear any existing session (e.g. admin logged in) before verifying the email token
        api.removeToken();

        // Verify the token from the email link
        try {
          const response = await api.post('/auth/verify-token', { token });
          if (cancelled) return;
          if (response.success && response.data?.token) {
            api.setToken(response.data.token);
            setTokenVerified(true);
            // Remove the token from URL so refreshing doesn't re-verify
            window.history.replaceState({}, '', window.location.pathname);
            fetchStatus();
            fetchDocumentTypes();
          } else {
            // Token expired or invalid — show error on page
            setError(response.error || 'This link has expired. Please log in with your credentials.');
            setLoading(false);
          }
        } catch (err) {
          if (cancelled) return;
          console.error('Token verification failed:', err);
          setError(err.data?.error || err.message || 'Unable to verify link. Please log in with your credentials.');
          setLoading(false);
        }
      } else if (authService.isAuthenticated()) {
        // Already logged in — proceed normally
        setTokenVerified(true);
        fetchStatus();
        fetchDocumentTypes();
      } else {
        // No token and not logged in — redirect to login
        navigate('/login');
        return;
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      const response = await documentTypeService.getAll({ active: "true" });
      if (response.success && response.data) {
        const govIds = response.data.filter(
          (dt) => dt.category === "GOVERNMENT_ID",
        );
        const proofs = response.data.filter(
          (dt) => dt.category === "PROOF_OF_ADDRESS",
        );
        if (govIds.length > 0) setGovIdTypes(govIds);
        if (proofs.length > 0) setProofOfAddressTypes(proofs);
      }
    } catch (err) {
      // Silently fail — fallback types are already set
      console.warn("Failed to fetch document types, using defaults:", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await employeeOnboardingService.getStatus();
      if (response.success) {
        const d = response.data;
        setKycStatus(d.kycStatus || null);
        setKycRejectionNote(d.kycRejectionNote || null);
        setDocStatuses({
          governmentId: { status: d.governmentIdStatus, rejectNote: d.governmentIdRejectNote },
          governmentId2: { status: d.governmentId2Status, rejectNote: d.governmentId2RejectNote },
          proofOfAddress: { status: d.proofOfAddressStatus, rejectNote: d.proofOfAddressRejectNote },
        });

        if (d.onboardingStatus === "COMPLETED" && d.kycStatus !== "REJECTED") {
          setCompleted(true);
          setLoading(false);
          return;
        }

        // If KYC was rejected, start on documents step so employee can re-upload
        if (d.kycStatus === "REJECTED") {
          setCurrentStep(1);
        }

        // Pre-populate from existing data
        setPersonalInfo({
          countryCode: d.countryCode || "+1",
          phone: d.phone || "",
          address: d.address || "",
          personalEmail: d.personalEmail || d.email || "",
        });

        if (d.emergencyContacts && d.emergencyContacts.length > 0) {
          const filled = d.emergencyContacts.map((c) => {
            const isCustom =
              c.relationship && !RELATIONSHIPS.includes(c.relationship);
            return {
              name: c.name,
              countryCode: c.countryCode || "+1",
              phone: c.phone,
              relationship: isCustom ? "Other" : c.relationship,
              customRelationship: isCustom ? c.relationship : "",
            };
          });
          // Pad to 2 if fewer
          while (filled.length < 2) filled.push(emptyContact());
          setContacts(filled);
        }

        if (d.governmentIdType) setIdType(d.governmentIdType);
        if (d.governmentIdUrl) setExistingIdUrl(d.governmentIdUrl);
        if (d.governmentId2Type) setId2Type(d.governmentId2Type);
        if (d.governmentId2Url) setExistingId2Url(d.governmentId2Url);
        if (d.proofOfAddressType) setProofType(d.proofOfAddressType);
        if (d.proofOfAddressUrl) setExistingProofUrl(d.proofOfAddressUrl);
      }
    } catch (err) {
      console.error("Failed to fetch onboarding status:", err);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Validate & Save
  const handleSavePersonalInfo = async () => {
    setError("");
    if (
      !personalInfo.phone ||
      !personalInfo.address ||
      !personalInfo.personalEmail
    ) {
      setError("All fields are required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(personalInfo.personalEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setSaving(true);
    try {
      const response =
        await employeeOnboardingService.savePersonalInfo(personalInfo);
      if (response.success) {
        setCurrentStep(1);
      } else {
        setError(response.error || "Failed to save personal info");
      }
    } catch (err) {
      setError(err.message || "Failed to save personal info");
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Validate & Save
  const handleSaveContacts = async () => {
    setError("");
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (!c.name || !c.phone || !c.relationship) {
        setError(`Contact ${i + 1}: all fields are required`);
        return;
      }
      if (c.relationship === "Other" && !c.customRelationship?.trim()) {
        setError(`Contact ${i + 1}: please specify the relationship`);
        return;
      }
    }

    // Map "Other" to the custom value before sending
    const payload = contacts.map((c) => ({
      name: c.name,
      countryCode: c.countryCode || "+1",
      phone: c.phone,
      relationship:
        c.relationship === "Other"
          ? c.customRelationship.trim()
          : c.relationship,
    }));

    setSaving(true);
    try {
      const response =
        await employeeOnboardingService.saveEmergencyContacts(payload);
      if (response.success) {
        // Emergency contacts is now the final step — complete onboarding
        const completeRes = await employeeOnboardingService.complete();
        if (completeRes.success) {
          setCompleted(true);
          setKycStatus("PENDING");
        } else {
          setError(completeRes.error || "Failed to complete onboarding");
        }
      } else {
        setError(response.error || "Failed to save emergency contacts");
      }
    } catch (err) {
      setError(err.message || "Failed to save emergency contacts");
    } finally {
      setSaving(false);
    }
  };

  // Step 3: File handling helpers
  const validateFile = (file) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!allowed.includes(file.type)) {
      setError("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB");
      return false;
    }
    return true;
  };

  const createFileHandler = (setFile, setPreview, setExistingUrl) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateFile(file)) return;
    setError("");
    setFile(file);
    setExistingUrl(null);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleFileSelect = createFileHandler(
    setIdFile,
    setIdPreview,
    setExistingIdUrl,
  );
  const handleFile2Select = createFileHandler(
    setId2File,
    setId2Preview,
    setExistingId2Url,
  );
  const handleProofFileSelect = createFileHandler(
    setProofFile,
    setProofPreview,
    setExistingProofUrl,
  );

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect({ target: { files: [file] } });
  };
  const handleDrop2 = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile2Select({ target: { files: [file] } });
  };
  const handleProofDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleProofFileSelect({ target: { files: [file] } });
  };

  const handleSubmit = async () => {
    setError("");

    // Validate: all 3 documents are required (2 government IDs + 1 proof of address)
    const hasDoc1 = !!(idFile || existingIdUrl);
    const hasDoc2 = !!(id2File || existingId2Url);
    const hasProof = !!(proofFile || existingProofUrl);

    // Government ID #1 is required
    if (!idType) {
      setError("Please select the type of first government ID");
      return;
    }
    if (!hasDoc1) {
      setError("Please upload your first government-issued ID");
      return;
    }

    // Government ID #2 is required
    if (!id2Type) {
      setError("Please select the type of second government ID");
      return;
    }
    if (!hasDoc2) {
      setError("Please upload your second government-issued ID");
      return;
    }

    // Proof of Address is required
    if (!proofType) {
      setError("Please select the type of proof of address");
      return;
    }
    if (!hasProof) {
      setError("Please upload your proof of address document");
      return;
    }

    setSaving(true);
    try {
      // Upload first government ID (if provided)
      if (idFile) {
        const uploadRes = await employeeOnboardingService.uploadGovernmentId(
          idFile,
          idType,
        );
        if (!uploadRes.success) {
          setError(uploadRes.error || "Failed to upload first government ID");
          setSaving(false);
          return;
        }
      } else if (idType && existingIdUrl) {
        await employeeOnboardingService.saveGovernmentIdType(idType);
      }

      // Upload second government ID (if provided)
      if (id2File) {
        const uploadRes = await employeeOnboardingService.uploadGovernmentId2(
          id2File,
          id2Type,
        );
        if (!uploadRes.success) {
          setError(uploadRes.error || "Failed to upload second government ID");
          setSaving(false);
          return;
        }
      }

      // Upload proof of address (if provided)
      if (proofFile) {
        const uploadRes = await employeeOnboardingService.uploadProofOfAddress(
          proofFile,
          proofType,
        );
        if (!uploadRes.success) {
          setError(uploadRes.error || "Failed to upload proof of address");
          setSaving(false);
          return;
        }
      }

      // If KYC was rejected, resubmit for review instead of going to next step
      if (kycStatus === "REJECTED") {
        const resubmitRes = await employeeOnboardingService.resubmitKyc();
        if (resubmitRes.success) {
          setKycStatus("PENDING");
          setKycRejectionNote(null);
          setCompleted(true);
        } else {
          setError(resubmitRes.error || "Failed to resubmit documents");
        }
      } else {
        // Move to Emergency Contacts step
        setCurrentStep(2);
      }
    } catch (err) {
      setError(err.message || "Failed to complete onboarding");
    } finally {
      setSaving(false);
    }
  };

  // Update a contact field
  const updateContact = (index, field, value) => {
    setContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  if (loading || (!tokenVerified && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  // Token verification failed — show error with link to login
  if (!tokenVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Verify Link</h2>
          <p className="text-gray-600 mb-4">{error || 'This link is invalid or has expired.'}</p>
          <p className="text-sm text-gray-500">Please contact your administrator to get a new onboarding link.</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Onboarding Complete!
          </h2>
          <p className="text-gray-600 mb-4">
            Thank you for completing your onboarding. Your identity documents
            are now under review by our team.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
            <p className="text-sm text-yellow-800 font-medium mb-1">
              What happens next?
            </p>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>Our team will review your submitted documents</li>
              <li>You will receive an email once your KYC is approved</li>
              <li>After approval, you can log in and access the portal</li>
            </ul>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            You can safely close this page. We'll notify you by email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ImpersonationBanner />
      <div className="py-4 px-4">
        <div className={`${currentStep === 2 ? 'max-w-4xl' : 'max-w-2xl'} mx-auto`}>
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Employee Onboarding
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Complete the following steps to set up your profile
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isDone
                          ? "bg-green-500 border-green-500 text-white"
                          : isActive
                            ? "bg-primary-600 border-primary-600 text-white"
                            : "bg-white border-gray-300 text-gray-400"
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1 font-medium ${
                        isActive
                          ? "text-primary-600"
                          : isDone
                            ? "text-green-600"
                            : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 ${
                        i < currentStep ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* KYC Rejection Banner */}
          {kycStatus === "REJECTED" && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 text-sm font-medium">Some of your KYC documents were not approved</p>
                  <p className="text-red-600 text-sm mt-1">
                    Please re-upload the rejected documents below.
                  </p>
                </div>
              </div>
              {/* Per-document rejection details */}
              {[
                { key: 'governmentId', label: 'Government ID #1' },
                { key: 'governmentId2', label: 'Government ID #2' },
                { key: 'proofOfAddress', label: 'Proof of Address' },
              ].filter(d => docStatuses[d.key]?.status === 'REJECTED').map(d => (
                <div key={d.key} className="ml-8 bg-white border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-red-700">{d.label} — Rejected</p>
                  {docStatuses[d.key]?.rejectNote && (
                    <p className="text-sm text-red-600 mt-0.5">{docStatuses[d.key].rejectNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Step Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
            {/* Step 1: Personal Info */}
            {currentStep === 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Personal Information
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Please provide your contact details
                </p>

                <div className="space-y-5">
                  <PhoneInput
                    phone={personalInfo.phone}
                    countryCode={personalInfo.countryCode}
                    onPhoneChange={(val) => setPersonalInfo({ ...personalInfo, phone: val })}
                    onCountryCodeChange={(code) => setPersonalInfo({ ...personalInfo, countryCode: code })}
                    label="Phone Number"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <textarea
                        autoComplete="street-address"
                        value={personalInfo.address}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            address: e.target.value,
                          })
                        }
                        placeholder="Enter your full address"
                        rows={3}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        autoComplete="email"
                        value={personalInfo.personalEmail}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            personalEmail: e.target.value,
                          })
                        }
                        placeholder="your.email@example.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button
                    onClick={handleSavePersonalInfo}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Emergency Contacts (Step 3) */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Emergency Contacts
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Please provide 3 emergency contacts
                </p>

                <div className="space-y-6">
                  {contacts.map((contact, i) => (
                    <div
                      key={i}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                          Contact {i + 1}{" "}
                          <span className="text-red-500">*</span>
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) =>
                              updateContact(i, "name", e.target.value)
                            }
                            placeholder="Full name"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                          />
                        </div>
                        <PhoneInput
                          phone={contact.phone}
                          countryCode={contact.countryCode || "+1"}
                          onPhoneChange={(val) => updateContact(i, "phone", val)}
                          onCountryCodeChange={(code) => updateContact(i, "countryCode", code)}
                          label="Phone"
                          required
                          showValidation={false}
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Relationship <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={contact.relationship}
                            onChange={(e) => {
                              updateContact(i, "relationship", e.target.value);
                              if (e.target.value !== "Other")
                                updateContact(i, "customRelationship", "");
                            }}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                          >
                            <option value="">Select...</option>
                            {RELATIONSHIPS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          {contact.relationship === "Other" && (
                            <input
                              type="text"
                              value={contact.customRelationship}
                              onChange={(e) =>
                                updateContact(
                                  i,
                                  "customRelationship",
                                  e.target.value,
                                )
                              }
                              placeholder="Please specify relationship"
                              className="w-full mt-2 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    onClick={() => {
                      setError("");
                      setCurrentStep(1);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={handleSaveContacts}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Complete Onboarding
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Identity Documents (Step 2) */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Identity Documents
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Upload 2 government-issued IDs and 1 proof of address
                </p>

                {/* --- Government ID 1 --- */}
                {(() => {
                  const isDocApproved = kycStatus === 'REJECTED' && docStatuses.governmentId?.status === 'APPROVED';
                  return (
                <div className={`mb-6 p-4 border rounded-xl ${
                  docStatuses.governmentId?.status === 'REJECTED' ? 'border-red-300 bg-red-50/30' :
                  docStatuses.governmentId?.status === 'APPROVED' ? 'border-green-300 bg-green-50/30' :
                  'border-gray-200'
                } ${isDocApproved ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      Government ID #1
                    </h3>
                    {docStatuses.governmentId?.status === 'REJECTED' && (
                      <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Rejected — please re-upload</span>
                    )}
                    {docStatuses.governmentId?.status === 'APPROVED' && (
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Approved</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      disabled={isDocApproved}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select ID type...</option>
                      {govIdTypes.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!idFile && !existingIdUrl ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-700 text-sm font-medium">
                        Drop file or click to browse
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        JPEG, PNG, WebP, GIF, or PDF (max 10MB)
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4">
                      {idPreview ? (
                        <img
                          src={idPreview}
                          alt="ID 1 preview"
                          className="max-h-40 mx-auto rounded-lg object-contain"
                        />
                      ) : existingIdUrl ? (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-gray-700 text-sm font-medium">
                            Uploaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <FileText className="w-6 h-6 text-red-500" />
                          <span className="text-gray-700 text-sm">
                            {idFile?.name}
                          </span>
                        </div>
                      )}
                      {!isDocApproved && (
                      <button
                        onClick={() => {
                          setIdFile(null);
                          setIdPreview(null);
                          setExistingIdUrl(null);
                        }}
                        className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                      )}
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* --- Government ID 2 --- */}
                {(() => {
                  const isDocApproved = kycStatus === 'REJECTED' && docStatuses.governmentId2?.status === 'APPROVED';
                  return (
                <div className={`mb-6 p-4 border rounded-xl ${
                  docStatuses.governmentId2?.status === 'REJECTED' ? 'border-red-300 bg-red-50/30' :
                  docStatuses.governmentId2?.status === 'APPROVED' ? 'border-green-300 bg-green-50/30' :
                  'border-gray-200'
                } ${isDocApproved ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      Government ID #2
                    </h3>
                    {docStatuses.governmentId2?.status === 'REJECTED' && (
                      <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Rejected — please re-upload</span>
                    )}
                    {docStatuses.governmentId2?.status === 'APPROVED' && (
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Approved</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <select
                      value={id2Type}
                      onChange={(e) => setId2Type(e.target.value)}
                      disabled={isDocApproved}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select ID type...</option>
                      {govIdTypes.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!id2File && !existingId2Url ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop2}
                      onClick={() => fileInput2Ref.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-700 text-sm font-medium">
                        Drop file or click to browse
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        JPEG, PNG, WebP, GIF, or PDF (max 10MB)
                      </p>
                      <input
                        ref={fileInput2Ref}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFile2Select}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4">
                      {id2Preview ? (
                        <img
                          src={id2Preview}
                          alt="ID 2 preview"
                          className="max-h-40 mx-auto rounded-lg object-contain"
                        />
                      ) : existingId2Url ? (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-gray-700 text-sm font-medium">
                            Uploaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <FileText className="w-6 h-6 text-red-500" />
                          <span className="text-gray-700 text-sm">
                            {id2File?.name}
                          </span>
                        </div>
                      )}
                      {!isDocApproved && (
                      <button
                        onClick={() => {
                          setId2File(null);
                          setId2Preview(null);
                          setExistingId2Url(null);
                        }}
                        className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                      )}
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* --- Proof of Address --- */}
                {(() => {
                  const isDocApproved = kycStatus === 'REJECTED' && docStatuses.proofOfAddress?.status === 'APPROVED';
                  return (
                <div className={`mb-6 p-4 border rounded-xl ${
                  docStatuses.proofOfAddress?.status === 'REJECTED' ? 'border-red-300 bg-red-50/30' :
                  docStatuses.proofOfAddress?.status === 'APPROVED' ? 'border-green-300 bg-green-50/30' :
                  'border-gray-200'
                } ${isDocApproved ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-800">
                      Proof of Address
                    </h3>
                    {docStatuses.proofOfAddress?.status === 'REJECTED' && (
                      <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Rejected — please re-upload</span>
                    )}
                    {docStatuses.proofOfAddress?.status === 'APPROVED' && (
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Approved</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Utility bill, bank statement, phone bill, or any official
                    document with your address
                  </p>
                  <div className="mb-3">
                    <select
                      value={proofType}
                      onChange={(e) => setProofType(e.target.value)}
                      disabled={isDocApproved}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select document type...</option>
                      {proofOfAddressTypes.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!proofFile && !existingProofUrl ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleProofDrop}
                      onClick={() => proofFileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-700 text-sm font-medium">
                        Drop file or click to browse
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        JPEG, PNG, WebP, GIF, or PDF (max 10MB)
                      </p>
                      <input
                        ref={proofFileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleProofFileSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4">
                      {proofPreview ? (
                        <img
                          src={proofPreview}
                          alt="Proof preview"
                          className="max-h-40 mx-auto rounded-lg object-contain"
                        />
                      ) : existingProofUrl ? (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-gray-700 text-sm font-medium">
                            Uploaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <FileText className="w-6 h-6 text-red-500" />
                          <span className="text-gray-700 text-sm">
                            {proofFile?.name}
                          </span>
                        </div>
                      )}
                      {!isDocApproved && (
                      <button
                        onClick={() => {
                          setProofFile(null);
                          setProofPreview(null);
                          setExistingProofUrl(null);
                        }}
                        className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                      )}
                    </div>
                  )}
                </div>
                  );
                })()}

                <div className="flex justify-between mt-8">
                  {kycStatus !== "REJECTED" ? (
                    <button
                      onClick={() => {
                        setError("");
                        setCurrentStep(0);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                      kycStatus === "REJECTED"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-primary-600 hover:bg-primary-700"
                    }`}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : kycStatus === "REJECTED" ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Resubmit for Review
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
