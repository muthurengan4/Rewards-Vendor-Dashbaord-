import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getVendorHeaders = async () => {
  const token = await AsyncStorage.getItem('vendor_token');
  return { Authorization: `Bearer ${token}` };
};

export const vendorApi = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/vendor/login', { email, password }),
  register: (data: any) => api.post('/vendor/register', data),
  getProfile: async () => {
    const headers = await getVendorHeaders();
    return api.get('/vendor/me', { headers });
  },
  updateProfile: async (data: any) => {
    const headers = await getVendorHeaders();
    return api.put('/vendor/profile', data, { headers });
  },

  // Branches
  getBranches: async () => {
    const headers = await getVendorHeaders();
    return api.get('/vendor/branches', { headers });
  },
  createBranch: async (data: any) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/branches', data, { headers });
  },
  updateBranch: async (id: string, data: any) => {
    const headers = await getVendorHeaders();
    return api.put(`/vendor/branches/${id}`, data, { headers });
  },
  deleteBranch: async (id: string) => {
    const headers = await getVendorHeaders();
    return api.delete(`/vendor/branches/${id}`, { headers });
  },

  // Rewards
  getRewards: async () => {
    const headers = await getVendorHeaders();
    return api.get('/vendor/rewards', { headers });
  },
  createReward: async (data: any) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/rewards', data, { headers });
  },
  updateReward: async (id: string, data: any) => {
    const headers = await getVendorHeaders();
    return api.put(`/vendor/rewards/${id}`, data, { headers });
  },
  deleteReward: async (id: string) => {
    const headers = await getVendorHeaders();
    return api.delete(`/vendor/rewards/${id}`, { headers });
  },
  toggleReward: async (id: string) => {
    const headers = await getVendorHeaders();
    return api.put(`/vendor/rewards/${id}/toggle`, {}, { headers });
  },

  // Redemptions
  getRedemptions: async (status?: string) => {
    const headers = await getVendorHeaders();
    const params = status ? { status } : {};
    return api.get('/vendor/redemptions', { headers, params });
  },
  getTodayRedemptions: async () => {
    const headers = await getVendorHeaders();
    return api.get('/vendor/redemptions/today', { headers });
  },
  validateRedemption: async (code: string) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/validate-redemption', { redemption_code: code }, { headers });
  },
  confirmRedemption: async (code: string) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/confirm-redemption', { redemption_code: code }, { headers });
  },

  // Issue Points
  issuePoints: async (data: any) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/issue-points', data, { headers });
  },

  // Point Rules
  getPointRules: async () => {
    const headers = await getVendorHeaders();
    return api.get('/vendor/point-rules', { headers });
  },
  createPointRule: async (data: any) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/point-rules', data, { headers });
  },
  updatePointRule: async (id: string, data: any) => {
    const headers = await getVendorHeaders();
    return api.put(`/vendor/point-rules/${id}`, data, { headers });
  },
  deletePointRule: async (id: string) => {
    const headers = await getVendorHeaders();
    return api.delete(`/vendor/point-rules/${id}`, { headers });
  },
  calculatePoints: async (billAmount: number) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/calculate-points', { bill_amount: billAmount }, { headers });
  },

  // Purchase QR
  generatePurchaseQR: async (data: any) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/generate-purchase-qr', data, { headers });
  },
  getPurchases: async (status?: string) => {
    const headers = await getVendorHeaders();
    const params = status ? { status } : {};
    return api.get('/vendor/purchases', { headers, params });
  },

  // Store Image Upload
  uploadStoreImage: async (imageBase64: string) => {
    const headers = await getVendorHeaders();
    return api.post('/vendor/upload-store-image', { image: imageBase64 }, { headers });
  },

  // Analytics
  getAnalytics: async () => {
    const headers = await getVendorHeaders();
    return api.get('/vendor/analytics', { headers });
  },
  getDailyAnalytics: async (days: number = 7) => {
    const headers = await getVendorHeaders();
    return api.get(`/vendor/analytics/daily?days=${days}`, { headers });
  },
};
