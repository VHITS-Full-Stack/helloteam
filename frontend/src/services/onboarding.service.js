import api from './api';

const onboardingService = {
  /**
   * Get agreement details and status
   */
  getAgreement: () => api.get('/onboarding/agreement'),

  /**
   * Get agreement PDF as blob (for iframe display)
   */
  getAgreementPdf: async () => {
    const url = `${api.baseUrl}/onboarding/agreement/pdf`;
    const token = api.getToken();

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch agreement PDF');
    }

    return response.blob();
  },

  /**
   * Save business + payment details (draft)
   * @param {Object} data - All business and payment fields
   */
  saveDetails: (data) => api.post('/onboarding/agreement/details', data),

  /**
   * Get pre-filled agreement PDF preview as blob
   */
  getPreviewPdf: async () => {
    const url = `${api.baseUrl}/onboarding/agreement/preview`;
    const token = api.getToken();

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch agreement preview');
    }

    return response.blob();
  },

  /**
   * Sign the agreement
   * @param {string} signedByName - Full name of the signer
   * @param {string} [signatureImage] - Base64 data URL of signature image
   */
  signAgreement: (signedByName, signatureImage) =>
    api.post('/onboarding/agreement/sign', { signedByName, ...(signatureImage && { signatureImage }) }),
};

export default onboardingService;
