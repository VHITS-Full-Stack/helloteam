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

  uploadGovernmentId(file) {
    return api.uploadFile('/employee-onboarding/government-id', file, 'file');
  },

  complete() {
    return api.post('/employee-onboarding/complete');
  },
};

export default employeeOnboardingService;
