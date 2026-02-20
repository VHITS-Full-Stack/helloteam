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

  complete() {
    return api.post('/employee-onboarding/complete');
  },
};

export default employeeOnboardingService;
