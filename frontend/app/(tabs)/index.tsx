import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface Transaction {
  id: string;
  type: string;
  points: number;
  description: string;
  partner_name?: string;
  created_at: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [txnRes] = await Promise.all([
        api.get('/wallet/transactions?limit=5'),
      ]);
      setTransactions(txnRes.data.transactions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshUser()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDemoEarn = async () => {
    try {
      await api.post('/earn/demo');
      await onRefresh();
      Alert.alert('Success!', 'You earned 50 demo points!');
    } catch (error) {
      Alert.alert('Error', 'Failed to earn demo points');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Points Balance Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={24} color={COLORS.white} />
            <Text style={styles.balanceLabel}>Total Points</Text>
          </View>
          <Text style={styles.balanceAmount}>
            {user?.points_balance?.toLocaleString() || '0'}
          </Text>
          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={16} color={COLORS.white} />
              <Text style={styles.statText}>
                {user?.total_earned?.toLocaleString() || '0'} earned
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={16} color={COLORS.white} />
              <Text style={styles.statText}>
                {user?.total_redeemed?.toLocaleString() || '0'} redeemed
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/earn')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.gold + '20' }]}>
              <Ionicons name="qr-code" size={24} color={COLORS.gold} />
            </View>
            <Text style={styles.actionText}>Scan QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/redeem')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.blueLight + '20' }]}>
              <Ionicons name="gift" size={24} color={COLORS.blueLight} />
            </View>
            <Text style={styles.actionText}>Redeem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/partners')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="storefront" size={24} color={COLORS.success} />
            </View>
            <Text style={styles.actionText}>Partners</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDemoEarn}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning + '20' }]}>
              <Ionicons name="flash" size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.actionText}>Demo +50</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length > 0 ? (
            transactions.map((txn) => (
              <Card key={txn.id} style={styles.transactionCard}>
                <View style={styles.transactionRow}>
                  <View style={[
                    styles.transactionIcon,
                    { backgroundColor: txn.type === 'earn' ? COLORS.success + '20' : COLORS.error + '20' }
                  ]}>
                    <Ionicons
                      name={txn.type === 'earn' ? 'arrow-up' : 'arrow-down'}
                      size={20}
                      color={txn.type === 'earn' ? COLORS.success : COLORS.error}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>{txn.description}</Text>
                    <Text style={styles.transactionDate}>{formatDate(txn.created_at)}</Text>
                  </View>
                  <Text style={[
                    styles.transactionPoints,
                    { color: txn.type === 'earn' ? COLORS.success : COLORS.error }
                  ]}>
                    {txn.type === 'earn' ? '+' : '-'}{txn.points}
                  </Text>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Start earning points at partner stores!</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  greeting: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  balanceLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    marginLeft: SPACING.sm,
    opacity: 0.9,
  },
  balanceAmount: {
    fontSize: FONT_SIZES.display,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  balanceStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  actionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold,
  },
  transactionCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  transactionDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  transactionPoints: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});
