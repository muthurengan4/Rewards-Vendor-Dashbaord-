import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../src/constants/theme';

export default function MyRedemptionsScreen() {
  const router = useRouter();
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRedemptions = async () => {
    try {
      const res = await api.get('/redemptions');
      setRedemptions(res.data.redemptions || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRedemptions(); }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return COLORS.success;
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      default: return COLORS.textMuted;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="gift" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.reward_name || 'Reward'}</Text>
          <Text style={styles.cardVendor}>{item.vendor_name || 'Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardPoints}>{item.points_cost} pts</Text>
        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>
      {item.redemption_code && (
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Code:</Text>
          <Text style={styles.codeValue}>{item.redemption_code}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Redemptions</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={redemptions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRedemptions(); }} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No redemptions yet</Text>
              <Text style={styles.emptySubtext}>Redeem your points for exciting rewards!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  cardVendor: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  cardPoints: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.primary },
  cardDate: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, backgroundColor: COLORS.surfaceLight, padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm },
  codeLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginRight: SPACING.sm },
  codeValue: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  emptySubtext: { marginTop: SPACING.xs, fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
});
