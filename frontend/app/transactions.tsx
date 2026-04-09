import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../src/constants/theme';

interface Transaction {
  id: string;
  type: string;
  points: number;
  description: string;
  partner_name?: string;
  created_at: string;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'earn' | 'redeem'>('all');

  const fetchTransactions = useCallback(async () => {
    try {
      const params: any = { limit: 100 };
      if (filter !== 'all') params.type = filter;
      const res = await api.get('/wallet/transactions', { params });
      setTransactions(res.data.transactions || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.txnCard}>
      <View style={[
        styles.txnIcon,
        { backgroundColor: item.type === 'earn' ? COLORS.success + '20' : COLORS.error + '20' }
      ]}>
        <Ionicons
          name={item.type === 'earn' ? 'arrow-up' : 'arrow-down'}
          size={20}
          color={item.type === 'earn' ? COLORS.success : COLORS.error}
        />
      </View>
      <View style={styles.txnInfo}>
        <Text style={styles.txnDesc}>{item.description}</Text>
        {item.partner_name && <Text style={styles.txnPartner}>{item.partner_name}</Text>}
        <Text style={styles.txnDate}>{formatDate(item.created_at)} at {formatTime(item.created_at)}</Text>
      </View>
      <Text style={[
        styles.txnPoints,
        { color: item.type === 'earn' ? COLORS.success : COLORS.error }
      ]}>
        {item.type === 'earn' ? '+' : '-'}{item.points}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filters}>
        {(['all', 'earn', 'redeem'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => { setFilter(f); setLoading(true); }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'earn' ? 'Earned' : 'Redeemed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTransactions(); }} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No transactions found</Text>
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
  filters: { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  txnCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
  txnIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txnInfo: { flex: 1, marginLeft: SPACING.md },
  txnDesc: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginBottom: 2 },
  txnPartner: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '500', marginBottom: 2 },
  txnDate: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  txnPoints: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textMuted },
});
