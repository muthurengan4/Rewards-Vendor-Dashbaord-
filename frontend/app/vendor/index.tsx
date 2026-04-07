import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import { useVendorStore } from '../../src/store/vendorStore';

export default function VendorDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { vendor } = useVendorStore();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await vendorApi.getAnalytics();
      setAnalytics(res.data);
    } catch (e) {
      console.log('Analytics error:', e);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Total Points Issued', value: analytics?.total_points_issued || 0, icon: 'trending-up', color: '#22C55E', bg: '#DCFCE7' },
    { label: 'Total Redemptions', value: analytics?.total_redemptions || 0, icon: 'checkmark-circle', color: '#3B82F6', bg: '#DBEAFE' },
    { label: 'Pending Redemptions', value: analytics?.pending_redemptions || 0, icon: 'time', color: '#F59E0B', bg: '#FEF3C7' },
    { label: 'Total Customers', value: analytics?.total_customers || 0, icon: 'people', color: '#8B5CF6', bg: '#EDE9FE' },
    { label: 'Today\'s Points', value: analytics?.today_points_issued || 0, icon: 'flash', color: COLORS.primary, bg: '#FCE8EB' },
    { label: 'Today\'s Redemptions', value: analytics?.today_redemptions || 0, icon: 'receipt', color: '#06B6D4', bg: '#CFFAFE' },
  ];

  return (
    <VendorShell title="Dashboard">
      {vendor?.status === 'pending' && (
        <View style={styles.pendingBanner}>
          <Ionicons name="information-circle" size={20} color="#92400E" />
          <Text style={styles.pendingText}>Your store is pending admin approval. Some features are limited.</Text>
        </View>
      )}

      <Text style={styles.welcomeText}>Welcome back, {vendor?.store_name}!</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            {stats.map((stat, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                  <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value.toLocaleString()}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {analytics?.top_rewards?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Rewards</Text>
              {analytics.top_rewards.map((r: any, i: number) => (
                <View key={i} style={styles.rewardRow}>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardName}>{r.name}</Text>
                    <Text style={styles.rewardMeta}>{r.points_required} pts | Redeemed {r.total_redeemed || 0}x</Text>
                  </View>
                  <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#FEF3C7' : '#F3F4F6' }]}>
                    <Text style={styles.rankText}>#{i + 1}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {[
                { label: 'Create Reward', icon: 'add-circle', path: '/vendor/rewards', color: '#22C55E' },
                { label: 'Scan & Redeem', icon: 'qr-code', path: '/vendor/redeem', color: '#3B82F6' },
                { label: 'Issue Points', icon: 'cash', path: '/vendor/issue-points', color: COLORS.primary },
                { label: 'View Analytics', icon: 'bar-chart', path: '/vendor/analytics', color: '#8B5CF6' },
              ].map((action, i) => (
                <TouchableOpacity key={i} style={styles.actionCard}>
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <Ionicons name={action.icon as any} size={28} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </VendorShell>
  );
}

const styles = StyleSheet.create({
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.lg,
  },
  pendingText: { fontSize: FONT_SIZES.sm, color: '#92400E', flex: 1 },
  welcomeText: {
    fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl,
  },
  statCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, minWidth: 160, flex: 1,
    ...SHADOWS.small,
  },
  statIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.small,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rewardInfo: { flex: 1 },
  rewardName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  rewardMeta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  rankBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  rankText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textPrimary },
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
  },
  actionCard: {
    alignItems: 'center', minWidth: 100, flex: 1,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  actionIcon: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  actionLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
});
