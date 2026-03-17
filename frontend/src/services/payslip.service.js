import api from './api';

const payslipService = {
  getMyPayslips: async () => {
    const response = await api.get('/payroll/payslips/my');
    return response;
  },

  getMyPayslipDetail: async (id) => {
    const response = await api.get(`/payroll/payslips/my/${id}`);
    return response;
  },
};

export default payslipService;
