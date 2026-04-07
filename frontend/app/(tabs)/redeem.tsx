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
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface Reward {
  id: string;
  name: string;
  description: string;
  image?: string;
  points_required: number;
  category: string;
  quantity: number;
  vendor_id?: string;
  vendor_name?: string;
  reward_type?: string;
  value?: number;
}

export default function RedeemScreen() {
  const { user, refreshUser } = useAuthStore();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const fetchRewards = async () => {
    try {
      const res = await api.get('/rewards');
      setRewards(res.data.rewards);
      setCategories(['All', ...res.data.categories]);
    } catch (error) {
      console.error('Error fetching rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRewards(), refreshUser()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const handleRedeem = async (reward: Reward) => {
    if (!user || user.points_balance < reward.points_required) {
      Alert.alert('Insufficient Points', 'You don\'t have enough points for this reward.');
      return;
    }

    Alert.alert(
      'Confirm Redemption',
      `Redeem ${reward.name} for ${reward.points_required} points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setRedeemingId(reward.id);
            try {
              const res = await api.post('/redeem', { reward_id: reward.id });
              Alert.alert(
                'Success!',
                `You've redeemed ${reward.name}!\n\nRedemption Code: ${res.data.redemption.redemption_code}`,
              );
              await onRefresh();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to redeem reward');
            } finally {
              setRedeemingId(null);
            }
          },
        },
      ],
    );
  };

  const filteredRewards = selectedCategory === 'All'
    ? rewards
    : rewards.filter(r => r.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'cash': return 'cash-outline';
      case 'food & beverage': return 'restaurant-outline';
      case 'malaysian food': return 'restaurant-outline';
      case 'shopping': return 'bag-outline';
      case 'fuel': return 'car-outline';
      case 'travel': return 'airplane-outline';
      case 'coffee': return 'cafe-outline';
      case 'grocery': return 'cart-outline';
      case 'health & beauty': return 'heart-outline';
      case 'transport': return 'bus-outline';
      case 'e-wallet': return 'wallet-outline';
      default: return 'gift-outline';
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
          <Text style={styles.title}>Redeem Rewards</Text>
          <View style={styles.balanceChip}>
            <Ionicons name="wallet" size={16} color={COLORS.gold} />
            <Text style={styles.balanceText}>
              {user?.points_balance?.toLocaleString() || 0} pts
            </Text>
          </View>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Rewards Grid */}
        <View style={styles.rewardsContainer}>
          {filteredRewards.length > 0 ? (
            filteredRewards.map((reward) => (
              <Card key={reward.id} style={styles.rewardCard}>
                <View style={styles.rewardIconContainer}>
                  <Ionicons
                    name={getCategoryIcon(reward.category) as any}
                    size={32}
                    color={COLORS.gold}
                  />
                </View>
                {reward.vendor_name ? (
                  <View style={styles.vendorBadge}>
                    <Ionicons name="storefront" size={12} color={COLORS.primary} />
                    <Text style={styles.vendorBadgeText}>{reward.vendor_name}</Text>
                  </View>
                ) : null}
                <Text style={styles.rewardName}>{reward.name}</Text>
                <Text style={styles.rewardDesc} numberOfLines={2}>
                  {reward.description}
                </Text>
                {reward.value ? (
                  <Text style={styles.rewardValue}>Worth RM{reward.value}</Text>
                ) : null}
                <View style={styles.rewardFooter}>
                  <View style={styles.pointsBadge}>
                    <Ionicons name="star" size={14} color={COLORS.gold} />
                    <Text style={styles.pointsText}>
                      {reward.points_required.toLocaleString()}
                    </Text>
                  </View>
                  <Button
                    title="Redeem"
                    onPress={() => handleRedeem(reward)}
                    size="small"
                    variant={user && user.points_balance >= reward.points_required ? 'primary' : 'outline'}
                    disabled={!user || user.points_balance < reward.points_required}
                    loading={redeemingId === reward.id}
                  />
                </View>
                {reward.quantity !== -1 && (
                  <Text style={styles.stockText}>
                    {reward.quantity} remaining
                  </Text>
                )}
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="gift-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No rewards available</Text>
              <Text style={styles.emptySubtext}>Check back soon for new rewards!</Text>
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
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  balanceText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
  },
  categoryChipActive: {
    backgroundColor: COLORS.gold,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: COLORS.blueDark,
    fontWeight: '600',
  },
  rewardsContainer: {
    paddingHorizontal: SPACING.md,
  },
  rewardCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  rewardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  rewardName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  rewardDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  rewardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  pointsText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold,
  },
  stockText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  vendorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE8EB',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: SPACING.xs,
    gap: 4,
  },
  vendorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  rewardValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xxl,
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
