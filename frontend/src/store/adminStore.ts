import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminState {
  admin: Admin | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAdmin: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  admin: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const response = await api.post('/admin/login', { email, password });
    const { token, admin } = response.data;
    await AsyncStorage.setItem('admin_token', token);
    await AsyncStorage.setItem('admin', JSON.stringify(admin));
    set({ token, admin, isAuthenticated: true, isLoading: false });
  },

  setup: async (email: string, password: string, name: string) => {
    const response = await api.post('/admin/setup', { email, password, name });
    const { token, admin } = response.data;
    await AsyncStorage.setItem('admin_token', token);
    await AsyncStorage.setItem('admin', JSON.stringify(admin));
    set({ token, admin, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await AsyncStorage.removeItem('admin_token');
    await AsyncStorage.removeItem('admin');
    set({ token: null, admin: null, isAuthenticated: false });
  },

  loadAdmin: async () => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const adminStr = await AsyncStorage.getItem('admin');
      if (token && adminStr) {
        set({ token, admin: JSON.parse(adminStr), isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
