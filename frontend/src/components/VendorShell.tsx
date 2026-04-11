import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, ScrollView, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../store/vendorStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

const NAV_ITEMS = [
  { path: '/vendor', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { path: '/vendor/rewards', label: 'Rewards', icon: 'gift-outline', activeIcon: 'gift' },
  { path: '/vendor/redeem', label: 'Scan & Redeem', icon: 'qr-code-outline', activeIcon: 'qr-code' },
  { path: '/vendor/issue-points', label: 'Issue Points', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { path: '/vendor/point-rules', label: 'Points Rules', icon: 'layers-outline', activeIcon: 'layers' },
  { path: '/vendor/analytics', label: 'Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { path: '/vendor/branches', label: 'Branches', icon: 'business-outline', activeIcon: 'business' },
  { path: '/vendor/settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

interface Props {
  children: ReactNode;
  title: string;
}

export default function VendorShell({ children, title }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { vendor, logout } = useVendorStore();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const isActive = (path: string) => {
    if (path === '/vendor') return pathname === '/vendor' || pathname === '/vendor/';
    return pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/vendor/login');
  };

  const sidebar = (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          {vendor?.store_image || vendor?.logo ? (
            <Image source={{ uri: vendor.store_image || vendor.logo }} style={{ width: 36, height: 36, borderRadius: 8 }} resizeMode="cover" />
          ) : (
            <Ionicons name="storefront" size={22} color={COLORS.primary} />
          )}
        </View>
        <View style={styles.brandInfo}>
          <Text style={styles.brandName} numberOfLines={1}>{vendor?.store_name || 'Vendor'}</Text>
          <View style={[styles.statusBadge, vendor?.status === 'approved' ? styles.statusApproved : styles.statusPending]}>
            <Text style={styles.statusText}>{vendor?.status === 'approved' ? 'Active' : 'Pending'}</Text>
          </View>
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
                size={20}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // Mobile bottom navigation for narrow screens
  const bottomNav = (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const active = isActive(item.path);
        return (
          <TouchableOpacity
            key={item.path}
            style={styles.bottomNavItem}
            onPress={() => router.push(item.path as any)}
          >
            <Ionicons
              name={(active ? item.activeIcon : item.icon) as any}
              size={22}
              color={active ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>
              {item.label.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      {isWide && sidebar}
      <View style={styles.main}>
        <View style={styles.header}>
          {!isWide && (
            <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/vendor/settings' as any)}>
              <Ionicons name="menu" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerRight}>
            <View style={styles.vendorChip}>
              {vendor?.store_image || vendor?.logo ? (
                <Image source={{ uri: vendor.store_image || vendor.logo }} style={{ width: 20, height: 20, borderRadius: 10 }} resizeMode="cover" />
              ) : (
                <Ionicons name="storefront" size={16} color={COLORS.primary} />
              )}
              <Text style={styles.vendorChipText} numberOfLines={1}>{vendor?.store_name || ''}</Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {!isWide && bottomNav}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.background },
  sidebar: {
    width: 240,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  brandIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  brandInfo: { flex: 1 },
  brandName: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 3,
    alignSelf: 'flex-start',
  },
  statusApproved: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 10, fontWeight: '600', color: COLORS.textPrimary },
  nav: { flex: 1, paddingHorizontal: SPACING.sm },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md, marginBottom: 2, gap: 10,
  },
  navItemActive: { backgroundColor: '#FCE8EB' },
  navLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '500' },
  navLabelActive: { color: COLORS.primary, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    marginTop: SPACING.xs, gap: 10,
  },
  logoutText: { fontSize: FONT_SIZES.sm, color: COLORS.error, fontWeight: '600' },
  main: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    minHeight: 56,
  },
  menuBtn: { marginRight: SPACING.md },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  vendorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FCE8EB', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  vendorChipText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600', maxWidth: 120 },
  content: { flex: 1 },
  contentInner: { padding: SPACING.lg, paddingBottom: 100 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  bottomNavItem: { flex: 1, alignItems: 'center', gap: 2 },
  bottomNavLabel: { fontSize: 10, color: COLORS.textMuted },
  bottomNavLabelActive: { color: COLORS.primary, fontWeight: '600' },
});
