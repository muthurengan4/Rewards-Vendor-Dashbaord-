import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { useAdminStore } from '../../src/store/adminStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

interface DashboardData {
  total_users: number;
  total_vendors: number;
  total_categories: number;
  total_rewards: number;
  total_orders: number;
  pending_redemptions: number;
  pending_vendors: number;
  points_issued: number;
  points_redeemed: number;
  points_balance: number;
  activity_feed: any[];
  top_vendors: any[];
}

export default function AdminDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAdminStore();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/admin/login');
    }
  }, [authLoading, isAuthenticated]);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getDashboard();
      setData(res.data);
    } catch (e) {
      console.log('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const StatCard = ({ icon, label, value, color, sub }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );

  return (
    <AdminShell title="Dashboard">
      {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : data && (
        <View>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard icon="people" label="Total Users" value={data.total_users} color="#3B82F6" />
            <StatCard icon="storefront" label="Total Vendors" value={data.total_vendors} color="#8B5CF6" sub={data.pending_vendors > 0 ? `${data.pending_vendors} pending` : undefined} />
            <StatCard icon="layers" label="Categories" value={data.total_categories} color="#F59E0B" />
            <StatCard icon="gift" label="Total Rewards" value={data.total_rewards} color="#EC4899" />
            <StatCard icon="receipt" label="Total Orders" value={data.total_orders} color="#14B8A6" />
            <StatCard icon="hourglass" label="Pending Redemptions" value={data.pending_redemptions} color="#EF4444" />
          </View>

          {/* Points Overview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Points Overview</Text>
            <View style={styles.pointsRow}>
              <View style={[styles.pointsCard, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="arrow-up-circle" size={28} color="#3B82F6" />
                <Text style={[styles.pointsValue, { color: '#3B82F6' }]}>{data.points_issued.toLocaleString()}</Text>
                <Text style={styles.pointsLabel}>Points Issued</Text>
              </View>
              <View style={[styles.pointsCard, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="arrow-down-circle" size={28} color="#EF4444" />
                <Text style={[styles.pointsValue, { color: '#EF4444' }]}>{data.points_redeemed.toLocaleString()}</Text>
                <Text style={styles.pointsLabel}>Points Redeemed</Text>
              </View>
              <View style={[styles.pointsCard, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="wallet" size={28} color="#22C55E" />
                <Text style={[styles.pointsValue, { color: '#22C55E' }]}>{data.points_balance.toLocaleString()}</Text>
                <Text style={styles.pointsLabel}>Active Balance</Text>
              </View>
            </View>
          </View>

          {/* Top Vendors */}
          {data.top_vendors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Vendors</Text>
              {data.top_vendors.map((v: any, i: number) => (
                <View key={i} style={styles.vendorRow}>
                  <View style={styles.vendorRank}><Text style={styles.rankText}>#{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vendorName}>{v.name}</Text>
                    <Text style={styles.vendorCat}>{v.category}</Text>
                  </View>
                  <Text style={styles.vendorPts}>{v.points_issued.toLocaleString()} pts</Text>
                </View>
              ))}
            </View>
          )}

          {/* Activity Feed */}
          {data.activity_feed.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {data.activity_feed.map((a: any, i: number) => (
                <View key={i} style={styles.activityRow}>
                  <View style={[styles.activityDot, { backgroundColor: a.type === 'purchase' ? '#22C55E' : '#3B82F6' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityDesc}>{a.description}</Text>
                    <Text style={styles.activityTime}>{a.time ? new Date(a.time).toLocaleString() : ''}</Text>
                  </View>
                  <Text style={[styles.activityPts, { color: a.type === 'purchase' ? '#22C55E' : '#3B82F6' }]}>
                    {a.type === 'purchase' ? '+' : '-'}{a.points} pts
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg,
    minWidth: 150, flex: 1, ...SHADOWS.small,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  statSub: { fontSize: 11, color: COLORS.error, fontWeight: '600', marginTop: 4 },
  section: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.small },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  pointsRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  pointsCard: { flex: 1, minWidth: 140, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  pointsValue: { fontSize: 22, fontWeight: '800', marginVertical: 4 },
  pointsLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  vendorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  vendorRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FCE8EB', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  rankText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  vendorName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  vendorCat: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  vendorPts: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.primary },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, gap: SPACING.sm },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  activityTime: { fontSize: 11, color: COLORS.textMuted },
  activityPts: { fontSize: FONT_SIZES.sm, fontWeight: '700' },
});
