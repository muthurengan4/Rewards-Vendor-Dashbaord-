import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const getAdminHeaders = async () => {
  const token = await AsyncStorage.getItem('admin_token');
  return { Authorization: `Bearer ${token}` };
};

export const adminApi = {
  // Dashboard
  getDashboard: async () => {
    const headers = await getAdminHeaders();
    return api.get('/admin/dashboard', { headers });
  },

  // Users
  getUsers: async (params?: any) => {
    const headers = await getAdminHeaders();
    return api.get('/admin/users', { headers, params });
  },
  getUser: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.get(`/admin/users/${id}`, { headers });
  },
  blockUser: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/users/${id}/block`, {}, { headers });
  },
  unblockUser: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/users/${id}/unblock`, {}, { headers });
  },
  adjustPoints: async (id: string, amount: number, reason: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/users/${id}/adjust-points`, { amount, reason }, { headers });
  },
  deleteUser: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.delete(`/admin/users/${id}`, { headers });
  },

  // Vendors
  getVendors: async (params?: any) => {
    const headers = await getAdminHeaders();
    return api.get('/admin/vendors', { headers, params });
  },
  getVendor: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.get(`/admin/vendors/${id}`, { headers });
  },
  approveVendor: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/vendors/${id}/approve`, {}, { headers });
  },
  rejectVendor: async (id: string, reason?: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/vendors/${id}/reject`, { reason }, { headers });
  },
  suspendVendor: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/vendors/${id}/suspend`, {}, { headers });
  },
  activateVendor: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.post(`/admin/vendors/${id}/activate`, {}, { headers });
  },
  deleteVendor: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.delete(`/admin/vendors/${id}`, { headers });
  },
  updateVendor: async (id: string, data: any) => {
    const headers = await getAdminHeaders();
    return api.put(`/admin/vendors/${id}/update`, data, { headers });
  },

  // Categories
  getCategories: async () => {
    const headers = await getAdminHeaders();
    return api.get('/admin/categories', { headers });
  },
  createCategory: async (data: any) => {
    const headers = await getAdminHeaders();
    return api.post('/admin/categories', data, { headers });
  },
  updateCategory: async (id: string, data: any) => {
    const headers = await getAdminHeaders();
    return api.put(`/admin/categories/${id}`, data, { headers });
  },
  deleteCategory: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.delete(`/admin/categories/${id}`, { headers });
  },

  // Settings
  getSettings: async () => {
    const headers = await getAdminHeaders();
    return api.get('/admin/settings', { headers });
  },
  updateSettings: async (data: any) => {
    const headers = await getAdminHeaders();
    return api.put('/admin/settings', data, { headers });
  },
  uploadLogo: async (logoBase64: string) => {
    const headers = await getAdminHeaders();
    return api.post('/admin/settings/logo', { logo: logoBase64 }, { headers });
  },
  testEmail: async (toEmail?: string) => {
    const headers = await getAdminHeaders();
    return api.post('/admin/settings/test-email', { to_email: toEmail }, { headers });
  },

  // Packages
  getPackages: async () => {
    const headers = await getAdminHeaders();
    return api.get('/admin/packages', { headers });
  },
  createPackage: async (data: any) => {
    const headers = await getAdminHeaders();
    return api.post('/admin/packages', data, { headers });
  },
  updatePackage: async (id: string, data: any) => {
    const headers = await getAdminHeaders();
    return api.put(`/admin/packages/${id}`, data, { headers });
  },
  deletePackage: async (id: string) => {
    const headers = await getAdminHeaders();
    return api.delete(`/admin/packages/${id}`, { headers });
  },
};
