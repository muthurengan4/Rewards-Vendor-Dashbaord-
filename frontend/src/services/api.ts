import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get the backend URL from environment or constants
const getBackendUrl = () => {
  // Try multiple sources for the backend URL
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  const constantsUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  
  // For Expo Go, use the packager hostname
  const packagerHostname = process.env.EXPO_PACKAGER_HOSTNAME;
  
  const url = envUrl || constantsUrl || packagerHostname || '';
  
  console.log('Backend URL:', url);
  return url;
};

const BACKEND_URL = getBackendUrl();

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.log('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    console.log('API Response Error:', error.response?.status, error.message);
    if (error.response?.status === 401) {
      // Clear storage on unauthorized
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);
