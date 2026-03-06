import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle, FileText, AlertCircle, Loader2, Pen, Upload, X, RotateCcw,
  Building, CreditCard, Eye, ArrowRight, ArrowLeft, Check,
} from 'lucide-react';
import onboardingService from '../../services/onboarding.service';
import ImpersonationBanner from '../../components/layout/ImpersonationBanner';

const STEPS = [
  { label: 'Business Information', icon: Building },
  { label: 'Payment Authorization', icon: CreditCard },
  { label: 'Review & Sign', icon: Eye },
];

const Onboarding = () => {
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Pre-filled PDF preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Form data across all steps
  const [formData, setFormData] = useState({
    // Step 1: Business info
    businessName: '',
    businessAddress: '',
    businessCity: '',
    businessState: '',
    businessZip: '',
    ccCity: '',
    ccState: '',
    ccZip: '',
    businessEIN: '',
    signerName: '',
    signerAddress: '',
    // Step 2: Payment
    paymentMethod: '', // 'credit_card', 'ach', 'both'
    useCreditCard: false,
    useACH: false,
    ccCardholderName: '',
    ccBillingAddress: '',
    ccCityStateZip: '',
    ccCardType: '',
    ccCardNumber: '',
    ccExpiration: '',
    ccCVV: '',
    achAccountHolder: '',
    achBankName: '',
    achRoutingNumber: '',
    achAccountNumber: '',
    achAccountType: '',
    // Step 3: Signature
    signedByName: '',
  });

  // Signature state
  const [signatureTab, setSignatureTab] = useState('draw');
  const [signatureImage, setSignatureImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    try {
      const response = await onboardingService.getAgreement();
      if (response.success) {
        setAgreement(response.data);

        if (response.data.onboardingStatus === 'COMPLETED') {
          setSigned(true);
        } else if (response.data.agreement) {
          // Pre-populate form if client returns mid-flow
          const a = response.data.agreement;
          setFormData((prev) => ({
            ...prev,
            businessName: a.businessName || response.data.companyName || '',
            businessAddress: a.businessAddress || response.data.address || '',
            businessCity: a.businessCity || '',
            businessState: a.businessState || '',
            businessZip: a.businessZip || '',
            businessEIN: a.businessEIN || '',
            signerName: a.signerName || '',
            signerAddress: a.signerAddress || '',
            paymentMethod: a.paymentMethod || '',
            useCreditCard: a.paymentMethod === 'credit_card',
            useACH: a.paymentMethod === 'ach',
            ccCardholderName: a.ccCardholderName || '',
            ccBillingAddress: a.ccBillingAddress || '',
            ccCityStateZip: a.ccCityStateZip || '',
            ccCity: a.ccCity || '',
            ccState: a.ccState || '',
            ccZip: a.ccZip || '',
            ccCardType: a.ccCardType || '',
            ccCardNumber: a.ccCardNumber || '',
            ccExpiration: a.ccExpiration || '',
            achAccountHolder: a.achAccountHolder || '',
            achBankName: a.achBankName || '',
            achRoutingNumber: a.achRoutingNumber || '',
            achAccountNumber: a.achAccountNumber || '',
            achAccountType: a.achAccountType || '',
          }));
        } else {
          // No agreement yet — pre-fill from client profile data
          setFormData((prev) => ({
            ...prev,
            businessName: response.data.companyName || '',
            businessAddress: response.data.address || '',
          }));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load agreement');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-format credit card number: XXXX XXXX XXXX XXXX
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    updateField('ccCardNumber', formatted);
  };

  // Auto-format expiration: MM/YY
  const handleExpirationChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    updateField('ccExpiration', raw);
  };

  // Auto-format EIN: XX-XXXXXXX
  const handleEINChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    let formatted = raw;
    if (raw.length > 2) {
      formatted = raw.slice(0, 2) + '-' + raw.slice(2);
    }
    updateField('businessEIN', formatted);
  };

  const getPaymentMethod = () => formData.paymentMethod || '';

  // Step 1 validation
  const validateStep1 = () => {
    if (!formData.businessName.trim()) return 'Business name is required';
    if (!formData.businessAddress.trim()) return 'Business street address is required';
    if (!formData.businessEIN.trim()) return 'Business EIN is required';
    if (!formData.signerName.trim()) return 'Signer name is required';
    if (!formData.signerAddress.trim()) return 'Signer address is required';
    return null;
  };

  // Step 2 validation
  const validateStep2 = () => {
    const pm = getPaymentMethod();
    if (!pm) return 'Please select a payment method';

    if (pm === 'credit_card') {
      if (!formData.ccCardholderName.trim()) return 'Cardholder name is required';
      if (!formData.ccBillingAddress.trim()) return 'Billing address is required';
      if (!formData.ccCity.trim()) return 'City is required';
      if (!formData.ccState.trim()) return 'State is required';
      if (!formData.ccZip.trim()) return 'Zip code is required';
      if (!formData.ccCardType) return 'Please select a card type';
      if (!formData.ccCardNumber.trim()) return 'Card number is required';
      if (!formData.ccExpiration.trim()) return 'Expiration date is required';
      if (!formData.ccCVV.trim()) return 'CVV is required';
    }

    if (pm === 'ach') {
      if (!formData.achAccountHolder.trim()) return 'Account holder name is required';
      if (!formData.achBankName.trim()) return 'Bank name is required';
      if (!formData.achRoutingNumber.trim()) return 'Routing number is required';
      if (!formData.achAccountNumber.trim()) return 'Account number is required';
      if (!formData.achAccountType) return 'Please select an account type';
    }

    return null;
  };

  // Save details to backend
  const saveDetails = async (includePayment = false) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        businessName: formData.businessName,
        businessAddress: formData.businessAddress,
        businessCity: formData.businessCity,
        businessState: formData.businessState,
        businessZip: formData.businessZip,
        businessEIN: formData.businessEIN,
        signerName: formData.signerName,
        signerAddress: formData.signerAddress,
      };

      if (includePayment) {
        const pm = getPaymentMethod();
        Object.assign(payload, {
          paymentMethod: pm,
          ccCardholderName: formData.ccCardholderName,
          ccBillingAddress: formData.ccBillingAddress,
          ccCityStateZip: formData.ccCityStateZip,
          ccCity: formData.ccCity,
          ccState: formData.ccState,
          ccZip: formData.ccZip,
          ccCardType: formData.ccCardType,
          ccCardNumber: formData.ccCardNumber,
          ccExpiration: formData.ccExpiration,
          ccCVV: formData.ccCVV,
          achAccountHolder: formData.achAccountHolder,
          achBankName: formData.achBankName,
          achRoutingNumber: formData.achRoutingNumber,
          achAccountNumber: formData.achAccountNumber,
          achAccountType: formData.achAccountType,
        });
      }

      const response = await onboardingService.saveDetails(payload);
      if (!response.success) {
        setError(response.error || 'Failed to save details');
        return false;
      }
      return true;
    } catch (err) {
      setError(err.message || 'Failed to save details');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Step navigation
  const handleNext = async () => {
    setError('');

    if (currentStep === 0) {
      const err = validateStep1();
      if (err) { setError(err); return; }
      const saved = await saveDetails(false);
      if (saved) setCurrentStep(1);
    } else if (currentStep === 1) {
      const err = validateStep2();
      if (err) { setError(err); return; }
      const saved = await saveDetails(true);
      if (saved) {
        setCurrentStep(2);
        loadPreviewPdf();
      }
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  // Load pre-filled PDF preview for step 3
  const loadPreviewPdf = async () => {
    setLoadingPreview(true);
    try {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
      const blob = await onboardingService.getPreviewPdf();
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (err) {
      setError(err.message || 'Failed to load agreement preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Canvas setup for retina scaling
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (currentStep === 2 && signatureTab === 'draw') {
      initCanvas();
    }
  }, [currentStep, signatureTab, initCanvas]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureImage(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    setSignatureImage(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/png') && !file.type.startsWith('image/jpeg')) {
      setError('Please upload a PNG or JPG image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSignatureImage(event.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedImage = () => {
    setSignatureImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTabSwitch = (tab) => {
    setSignatureTab(tab);
    setSignatureImage(null);
    setHasDrawn(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSign = async (e) => {
    e.preventDefault();
    if (!formData.signedByName.trim() || formData.signedByName.trim().length < 2) {
      setError('Please enter your full name');
      return;
    }

    if (!signatureImage) {
      setError('Please draw or upload your signature');
      return;
    }

    setSigning(true);
    setError('');

    try {
      const response = await onboardingService.signAgreement(formData.signedByName.trim(), signatureImage);
      if (response.success) {
        setSigned(true);
        setTimeout(() => {
          window.location.href = '/client/dashboard';
        }, 2000);
      } else {
        setError(response.error || 'Failed to sign agreement');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign agreement');
    } finally {
      setSigning(false);
    }
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading agreement...</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Agreement Signed!</h2>
          <p className="text-gray-600 mb-4">
            Thank you for signing the service agreement. Your client portal is now being unlocked.
          </p>
          <div className="flex items-center justify-center gap-2 text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Redirecting to your dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  const agreementLabel = agreement?.agreementType === 'WEEKLY' ? 'Weekly' : agreement?.agreementType === 'BI_WEEKLY' ? 'Bi-Weekly' : 'Monthly';

  return (
    <div className="min-h-screen bg-gray-50">
      <ImpersonationBanner />
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Hello Team</h1>
                <p className="text-xs text-gray-500">Client Onboarding</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{agreement?.companyName}</p>
              <p className="text-xs text-gray-500">{agreement?.contactPerson}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-5xl mx-auto px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const StepIcon = step.icon;

            return (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1.5 font-medium text-center whitespace-nowrap ${
                      isCompleted
                        ? 'text-green-600'
                        : isCurrent
                        ? 'text-primary'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 ${
                      index < currentStep ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-sm">
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Business Information */}
        {currentStep === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Business Entity Information</h3>
            <p className="text-sm text-gray-500 mb-6">
              Please provide the business entity details for the {agreementLabel} Service Agreement.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Entity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  placeholder="e.g., Acme Corporation LLC"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessAddress}
                  onChange={(e) => updateField('businessAddress', e.target.value)}
                  placeholder="Street address"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business EIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessEIN}
                  onChange={handleEINChange}
                  placeholder="XX-XXXXXXX"
                  maxLength={10}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <hr className="my-2" />

              <h4 className="text-md font-semibold text-gray-800">Authorized Signer</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.signerName}
                  onChange={(e) => updateField('signerName', e.target.value)}
                  placeholder="Full legal name of signer"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.signerAddress}
                  onChange={(e) => updateField('signerAddress', e.target.value)}
                  placeholder="Full address"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleNext}
                disabled={saving}
                className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <>Next <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Payment Authorization */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Payment Authorization</h3>
            <p className="text-sm text-gray-500 mb-6">
              Select your preferred payment method(s). At least one is required.
            </p>

            {/* Payment method radio buttons */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={formData.paymentMethod === 'credit_card'}
                  onChange={() => { updateField('paymentMethod', 'credit_card'); updateField('useCreditCard', true); updateField('useACH', false); }}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">Credit Card</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={formData.paymentMethod === 'ach'}
                  onChange={() => { updateField('paymentMethod', 'ach'); updateField('useCreditCard', false); updateField('useACH', true); }}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">ACH Bank Transfer</span>
              </label>
            </div>

            {/* Credit Card Section */}
            {formData.paymentMethod === 'credit_card' && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Credit Card Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cardholder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.ccCardholderName}
                      onChange={(e) => updateField('ccCardholderName', e.target.value)}
                      placeholder="Name as it appears on card"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Billing Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.ccBillingAddress}
                      onChange={(e) => updateField('ccBillingAddress', e.target.value)}
                      placeholder="Billing address"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ccCity}
                        onChange={(e) => updateField('ccCity', e.target.value)}
                        placeholder="City"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ccState}
                        onChange={(e) => updateField('ccState', e.target.value)}
                        placeholder="State"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zip Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ccZip}
                        onChange={(e) => updateField('ccZip', e.target.value)}
                        placeholder="Zip"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                  </div>

                  {/* Card Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['Visa', 'MasterCard', 'American Express', 'Discover'].map((type) => (
                        <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="ccCardType"
                            value={type}
                            checked={formData.ccCardType === type}
                            onChange={(e) => updateField('ccCardType', e.target.value)}
                            className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ccCardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="XXXX XXXX XXXX XXXX"
                        maxLength={19}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expiration <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ccExpiration}
                        onChange={handleExpirationChange}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CVV <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ccCVV}
                        onChange={(e) => updateField('ccCVV', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="XXX"
                        maxLength={4}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACH Section */}
            {formData.paymentMethod === 'ach' && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building className="w-4 h-4" /> ACH Bank Transfer Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.achAccountHolder}
                      onChange={(e) => updateField('achAccountHolder', e.target.value)}
                      placeholder="Name on bank account"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.achBankName}
                      onChange={(e) => updateField('achBankName', e.target.value)}
                      placeholder="Bank name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Routing Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.achRoutingNumber}
                        onChange={(e) => updateField('achRoutingNumber', e.target.value)}
                        placeholder="9-digit routing number"
                        maxLength={9}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.achAccountNumber}
                        onChange={(e) => updateField('achAccountNumber', e.target.value)}
                        placeholder="Account number"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      />
                    </div>
                  </div>

                  {/* Account Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      {['Checking', 'Savings'].map((type) => (
                        <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="achAccountType"
                            value={type}
                            checked={formData.achAccountType === type}
                            onChange={(e) => updateField('achAccountType', e.target.value)}
                            className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleNext}
                disabled={saving}
                className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <>Next <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Sign */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Pre-filled PDF Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">
                  {agreementLabel} Service Agreement &mdash; Preview
                </h3>
              </div>
              {loadingPreview ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-gray-500">Generating preview...</p>
                  </div>
                </div>
              ) : previewPdfUrl ? (
                <iframe
                  src={previewPdfUrl}
                  className="w-full border-0"
                  style={{ height: '600px' }}
                  title="Agreement Preview PDF"
                />
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-400">
                  <p>Unable to load agreement preview</p>
                </div>
              )}
            </div>

            {/* Signature Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Digital Signature</h3>
              <p className="text-sm text-gray-500 mb-4">
                By typing your full name and providing your signature below, you acknowledge that you have read, understood, and agree to the terms of the {agreementLabel} Service Agreement.
              </p>

              <form onSubmit={handleSign}>
                {/* Full Name Input */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Type your full name"
                    value={formData.signedByName}
                    onChange={(e) => updateField('signedByName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-lg"
                    required
                    minLength={2}
                    disabled={signing}
                  />
                </div>

                {/* Signature Tabs */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                  <div className="flex border-b border-gray-200 mb-4">
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('draw')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        signatureTab === 'draw'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Pen className="w-4 h-4" />
                      Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('upload')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        signatureTab === 'upload'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                  </div>

                  {/* Draw Tab */}
                  {signatureTab === 'draw' && (
                    <div>
                      <div className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
                        {!hasDrawn && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-gray-300 text-lg select-none">Draw your signature here</p>
                          </div>
                        )}
                        <canvas
                          ref={canvasRef}
                          className="w-full cursor-crosshair touch-none"
                          style={{ height: '160px' }}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload Tab */}
                  {signatureTab === 'upload' && (
                    <div>
                      {signatureImage ? (
                        <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-600">Signature Preview</p>
                            <button
                              type="button"
                              onClick={removeUploadedImage}
                              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-center">
                            <img
                              src={signatureImage}
                              alt="Signature preview"
                              className="max-h-32 object-contain"
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-gray-700">Click to upload signature</p>
                          <p className="text-xs text-gray-500 mt-1">PNG or JPG, max 2MB</p>
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={signing || !formData.signedByName.trim() || formData.signedByName.trim().length < 2 || !signatureImage}
                    className="px-8 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {signing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</>
                    ) : (
                      'I Accept & Sign'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
