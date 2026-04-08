import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useVendorStore } from '../../src/store/vendorStore';
import { COLORS } from '../../src/constants/theme';

export default function VendorLayout() {
  const { isLoading, isAuthenticated, loadVendor } = useVendorStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadVendor();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inLogin = segments.includes('login' as never);
    const inRegister = segments.includes('register' as never);
    if (!isAuthenticated && !inLogin && !inRegister) {
      router.replace('/vendor/login');
    } else if (isAuthenticated && (inLogin || inRegister)) {
      router.replace('/vendor/');
    }
  }, [isLoading, isAuthenticated, segments]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="index" />
      <Stack.Screen name="rewards" />
      <Stack.Screen name="redeem" />
      <Stack.Screen name="issue-points" />
      <Stack.Screen name="point-rules" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="branches" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
