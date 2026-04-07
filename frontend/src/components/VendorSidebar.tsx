import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../store/vendorStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

const NAV_ITEMS = [
  { path: '/vendor/', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { path: '/vendor/rewards', label: 'Rewards', icon: 'gift-outline', activeIcon: 'gift' },
  { path: '/vendor/redeem', label: 'Scan & Redeem', icon: 'qr-code-outline', activeIcon: 'qr-code' },
  { path: '/vendor/issue-points', label: 'Issue Points', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { path: '/vendor/analytics', label: 'Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { path: '/vendor/branches', label: 'Branches', icon: 'business-outline', activeIcon: 'business' },
  { path: '/vendor/settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

export default function VendorSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { vendor, logout } = useVendorStore();

  const isActive = (path: string) => {
    if (path === '/vendor/') return pathname === '/vendor' || pathname === '/vendor/';
    return pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/vendor/login');
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <Ionicons name="storefront" size={24} color={COLORS.white} />
        </View>
        <View style={styles.brandInfo}>
          <Text style={styles.brandName} numberOfLines={1}>{vendor?.store_name || 'Vendor'}</Text>
          <Text style={styles.brandStatus}>
            {vendor?.status === 'approved' ? 'Active' : vendor?.status === 'pending' ? 'Pending Approval' : vendor?.status || 'Unknown'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <TouchableOpacity
              key={item.path}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.path as any)}
            >
              <Ionicons
                name={(active ? item.activeIcon : item.icon) as any}
                size={22}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  brandInfo: { flex: 1 },
  brandName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  brandStatus: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 2 },
  nav: { flex: 1, paddingHorizontal: SPACING.sm },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 4,
    gap: 12,
  },
  navItemActive: {
    backgroundColor: '#FCE8EB',
  },
  navLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, fontWeight: '500' },
  navLabelActive: { color: COLORS.primary, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    gap: 12,
  },
  logoutText: { fontSize: FONT_SIZES.md, color: COLORS.error, fontWeight: '600' },
});
