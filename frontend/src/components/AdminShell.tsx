import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, ScrollView, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdminStore } from '../store/adminStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { path: '/admin/users', label: 'Users', icon: 'people-outline', activeIcon: 'people' },
  { path: '/admin/vendors', label: 'Vendors', icon: 'storefront-outline', activeIcon: 'storefront' },
  { path: '/admin/categories', label: 'Categories', icon: 'layers-outline', activeIcon: 'layers' },
  { path: '/admin/bill-types', label: 'Bill Types', icon: 'receipt-outline', activeIcon: 'receipt' },
  { path: '/admin/packages', label: 'Packages', icon: 'pricetag-outline', activeIcon: 'pricetag' },
  { path: '/admin/settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

interface Props {
  children: ReactNode;
  title: string;
}

export default function AdminShell({ children, title }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, logout } = useAdminStore();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/admin/login');
  };

  const sidebar = (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <Image source={require('../../assets/images/3a-logo-gold.jpeg')} style={{ width: 32, height: 32, borderRadius: 6 }} resizeMode="contain" />
        </View>
        <View style={styles.brandInfo}>
          <Text style={styles.brandName}>3ARewards</Text>
          <Text style={styles.brandEmail} numberOfLines={1}>{admin?.email || ''}</Text>
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

  const bottomNav = (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => {
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
              {item.label}
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
            <TouchableOpacity style={styles.menuBtn} onPress={() => {}}>
              <Ionicons name="menu" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerRight}>
            <View style={styles.adminChip}>
              <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
              <Text style={styles.adminChipText}>{admin?.name || 'Admin'}</Text>
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
    width: 240, backgroundColor: COLORS.white,
    borderRightWidth: 1, borderRightColor: COLORS.border,
    paddingTop: SPACING.lg, paddingBottom: SPACING.sm,
  },
  brand: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.sm,
  },
  brandIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  brandInfo: { flex: 1 },
  brandName: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textPrimary },
  brandEmail: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
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
    borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.xs, gap: 10,
  },
  logoutText: { fontSize: FONT_SIZES.sm, color: COLORS.error, fontWeight: '600' },
  main: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, minHeight: 56,
  },
  menuBtn: { marginRight: SPACING.md },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  adminChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FCE8EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  adminChipText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600', maxWidth: 120 },
  content: { flex: 1 },
  contentInner: { padding: SPACING.lg, paddingBottom: 100 },
  bottomNav: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8,
  },
  bottomNavItem: { flex: 1, alignItems: 'center', gap: 2 },
  bottomNavLabel: { fontSize: 10, color: COLORS.textMuted },
  bottomNavLabelActive: { color: COLORS.primary, fontWeight: '600' },
});
