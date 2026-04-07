import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface Vendor {
  id: string;
  email: string;
  store_name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  logo?: string;
  points_per_rm: number;
  wallet_id: string;
  status: string;
  is_active: boolean;
  total_points_issued: number;
  total_redemptions: number;
  created_at: string;
}

interface VendorState {
  vendor: Vendor | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  loadVendor: () => Promise<void>;
  refreshVendor: () => Promise<void>;
}

export const useVendorStore = create<VendorState>((set, get) => ({
  vendor: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/vendor/login', { email, password });
      const { token, vendor } = response.data;
      await AsyncStorage.setItem('vendor_token', token);
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      set({ token, vendor, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },

  register: async (data: any) => {
    try {
      const response = await api.post('/vendor/register', data);
      const { token, vendor } = response.data;
      await AsyncStorage.setItem('vendor_token', token);
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      set({ token, vendor, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('vendor_token');
    await AsyncStorage.removeItem('vendor');
    set({ token: null, vendor: null, isAuthenticated: false });
  },

  loadVendor: async () => {
    try {
      const token = await AsyncStorage.getItem('vendor_token');
      const vendorStr = await AsyncStorage.getItem('vendor');
      if (token && vendorStr) {
        const vendor = JSON.parse(vendorStr);
        set({ token, vendor, isAuthenticated: true, isLoading: false });
        get().refreshVendor();
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  refreshVendor: async () => {
    try {
      const token = get().token;
      if (!token) return;
      const response = await api.get('/vendor/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vendor = response.data;
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      set({ vendor });
    } catch (error) {
      get().logout();
    }
  },
}));
