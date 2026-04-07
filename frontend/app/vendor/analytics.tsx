import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function VendorAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsRes, dailyRes] = await Promise.all([
        vendorApi.getAnalytics(),
        vendorApi.getDailyAnalytics(7),
      ]);
      setAnalytics(analyticsRes.data);
      setDaily(dailyRes.data.daily_stats || []);
    } catch (e) {
      console.log('Analytics error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <VendorShell title="Analytics">
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </VendorShell>
    );
  }

  const stats = [
    { label: 'Total Points Issued', value: analytics?.total_points_issued || 0, icon: 'trending-up', color: '#22C55E' },
    { label: 'Total Redemptions', value: analytics?.total_redemptions || 0, icon: 'checkmark-circle', color: '#3B82F6' },
    { label: 'Pending Redemptions', value: analytics?.pending_redemptions || 0, icon: 'time', color: '#F59E0B' },
    { label: 'Total Customers', value: analytics?.total_customers || 0, icon: 'people', color: '#8B5CF6' },
  ];

  const maxPoints = Math.max(...daily.map(d => d.points_issued), 1);

  return (
    <VendorShell title="Analytics">
      <View style={styles.statsGrid}>
        {stats.map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
              <Ionicons name={stat.icon as any} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 7 Days - Points Issued</Text>
        <View style={styles.chart}>
          {daily.map((day, i) => (
            <View key={i} style={styles.chartCol}>
              <Text style={styles.chartValue}>{day.points_issued}</Text>
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max((day.points_issued / maxPoints) * 120, 4),
                      backgroundColor: COLORS.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{day.date.slice(5)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 7 Days - Redemptions</Text>
        <View style={styles.chart}>
          {daily.map((day, i) => {
            const maxR = Math.max(...daily.map(d => d.redemptions), 1);
            return (
              <View key={i} style={styles.chartCol}>
                <Text style={styles.chartValue}>{day.redemptions}</Text>
                <View style={styles.barWrap}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max((day.redemptions / maxR) * 120, 4),
                        backgroundColor: '#3B82F6',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{day.date.slice(5)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.todayGrid}>
          <View style={styles.todayCard}>
            <Ionicons name="flash" size={28} color={COLORS.primary} />
            <Text style={styles.todayValue}>{analytics?.today_points_issued || 0}</Text>
            <Text style={styles.todayLabel}>Points Issued</Text>
          </View>
          <View style={styles.todayCard}>
            <Ionicons name="receipt" size={28} color="#3B82F6" />
            <Text style={styles.todayValue}>{analytics?.today_redemptions || 0}</Text>
            <Text style={styles.todayLabel}>Redemptions</Text>
          </View>
        </View>
      </View>
    </VendorShell>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl,
  },
  statCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, minWidth: 160, flex: 1, ...SHADOWS.small,
  },
  statIcon: {
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
    marginBottom: SPACING.lg,
  },
  chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  chartCol: { alignItems: 'center', flex: 1 },
  chartValue: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginBottom: 4 },
  barWrap: { width: 24, justifyContent: 'flex-end' },
  bar: { width: 24, borderRadius: 4 },
  chartLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
  todayGrid: { flexDirection: 'row', gap: SPACING.md },
  todayCard: {
    flex: 1, backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, alignItems: 'center',
  },
  todayValue: { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, marginVertical: 4 },
  todayLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
});
