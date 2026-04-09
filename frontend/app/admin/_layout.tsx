import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAdminStore } from '../../src/store/adminStore';

export default function AdminLayout() {
  const { loadAdmin } = useAdminStore();

  useEffect(() => {
    loadAdmin();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="vendors" />
      <Stack.Screen name="categories" />
    </Stack>
  );
}
