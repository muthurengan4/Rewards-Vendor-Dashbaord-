import { useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Alert } from 'react-native';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

interface OAuthConfig {
  social_login_enabled: boolean;
  google: { enabled: boolean; client_id: string };
  facebook: { enabled: boolean; app_id: string };
  apple: { enabled: boolean; service_id: string };
}

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export function useOAuth() {
  const [config, setConfig] = useState<OAuthConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  // Fetch OAuth config from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/auth/oauth-config');
        setConfig(res.data);
      } catch (e) {
        console.log('OAuth config fetch error:', e);
      }
    };
    fetchConfig();
  }, []);

  const handleOAuthSuccess = useCallback(async (data: any) => {
    try {
      // Store auth data
      setAuth(data.token, data.user);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to complete login');
    }
  }, [setAuth, router]);

  // Google Sign-In
  const signInWithGoogle = useCallback(async () => {
    if (!config?.google?.enabled || !config.google.client_id) {
      Alert.alert('Not Available', 'Google Sign-In is not configured yet. Ask admin to add Google OAuth credentials in Settings.');
      return;
    }

    setLoading(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'rewardshub',
        path: 'auth/callback',
      });

      const request = new AuthSession.AuthRequest({
        clientId: config.google.client_id,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Token,
        usePKCE: false,
      });

      const result = await request.promptAsync(GOOGLE_DISCOVERY);

      if (result.type === 'success' && result.authentication?.accessToken) {
        const res = await api.post('/auth/google', {
          access_token: result.authentication.accessToken,
        });
        await handleOAuthSuccess(res.data);
      } else if (result.type === 'error') {
        Alert.alert('Error', result.error?.message || 'Google Sign-In failed');
      }
    } catch (e: any) {
      console.error('Google sign-in error:', e);
      Alert.alert('Error', e?.response?.data?.detail || e.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  }, [config, handleOAuthSuccess]);

  // Facebook Sign-In
  const signInWithFacebook = useCallback(async () => {
    if (!config?.facebook?.enabled || !config.facebook.app_id) {
      Alert.alert('Not Available', 'Facebook Sign-In is not configured yet. Ask admin to add Facebook OAuth credentials in Settings.');
      return;
    }

    setLoading(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'rewardshub',
        path: 'auth/callback',
      });

      const request = new AuthSession.AuthRequest({
        clientId: config.facebook.app_id,
        redirectUri,
        scopes: ['public_profile', 'email'],
        responseType: AuthSession.ResponseType.Token,
        usePKCE: false,
        extraParams: {
          display: 'popup',
        },
      });

      const discovery = {
        authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
      };

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.authentication?.accessToken) {
        const res = await api.post('/auth/facebook', {
          access_token: result.authentication.accessToken,
        });
        await handleOAuthSuccess(res.data);
      } else if (result.type === 'error') {
        Alert.alert('Error', result.error?.message || 'Facebook Sign-In failed');
      }
    } catch (e: any) {
      console.error('Facebook sign-in error:', e);
      Alert.alert('Error', e?.response?.data?.detail || e.message || 'Facebook Sign-In failed');
    } finally {
      setLoading(false);
    }
  }, [config, handleOAuthSuccess]);

  // Apple Sign-In
  const signInWithApple = useCallback(async () => {
    if (!config?.apple?.enabled) {
      Alert.alert('Not Available', 'Apple Sign-In is not configured yet. Ask admin to add Apple OAuth credentials in Settings.');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices.');
      return;
    }

    setLoading(true);
    try {
      // Dynamic import for Apple Authentication (iOS only)
      const AppleAuthentication = require('expo-apple-authentication');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const fullName = credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : '';

        const res = await api.post('/auth/apple', {
          identity_token: credential.identityToken,
          email: credential.email,
          full_name: fullName || undefined,
        });
        await handleOAuthSuccess(res.data);
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        console.error('Apple sign-in error:', e);
        Alert.alert('Error', e?.response?.data?.detail || e.message || 'Apple Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  }, [config, handleOAuthSuccess]);

  return {
    config,
    loading,
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
  };
}
