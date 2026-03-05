import api from './api';

const employeeOnboardingService = {
  getStatus() {
    return api.get('/employee-onboarding/status');
  },

  savePersonalInfo(data) {
    return api.post('/employee-onboarding/personal-info', data);
  },

  saveEmergencyContacts(contacts) {
    return api.post('/employee-onboarding/emergency-contacts', { contacts });
  },

  uploadGovernmentId(file, governmentIdType) {
    const url = `${api.baseUrl}/employee-onboarding/government-id`;
    const token = api.getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (governmentIdType) formData.append('governmentIdType', governmentIdType);

    return fetch(url, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },

  saveGovernmentIdType(governmentIdType) {
    return api.post('/employee-onboarding/government-id-type', { governmentIdType });
  },

  uploadGovernmentId2(file, governmentId2Type) {
    const url = `${api.baseUrl}/employee-onboarding/government-id-2`;
    const token = api.getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (governmentId2Type) formData.append('governmentId2Type', governmentId2Type);

    return fetch(url, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },

  uploadProofOfAddress(file, proofOfAddressType) {
    const url = `${api.baseUrl}/employee-onboarding/proof-of-address`;
    const token = api.getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (proofOfAddressType) formData.append('proofOfAddressType', proofOfAddressType);

    return fetch(url, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },

  complete() {
    return api.post('/employee-onboarding/complete');
  },

  resubmitKyc() {
    return api.post('/employee-onboarding/resubmit-kyc');
  },
};

export default employeeOnboardingService;