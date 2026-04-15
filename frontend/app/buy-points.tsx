import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/services/api';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';

let WebBrowser: any = null;
try { WebBrowser = require('expo-web-browser'); } catch (e) {}

interface PointsPackage {
  id: string;
  name: string;
  points: number;
  amount: number;
  currency: string;
  label: string;
  icon: string;
}

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding: string;
}

const BRAND_ICONS: Record<string, string> = {
  visa: 'card',
  mastercard: 'card',
  amex: 'card',
  discover: 'card',
};

export default function BuyPointsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshUser } = useAuthStore();

  const [packages, setPackages] = useState<PointsPackage[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Check if returning from Stripe
  useEffect(() => {
    const sessionId = params.session_id as string;
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [params.session_id]);

  const fetchData = async () => {
    try {
      const [pkgRes, cardsRes] = await Promise.all([
        api.get('/stripe/packages'),
        api.get('/stripe/cards').catch(() => ({ data: { cards: [] } })),
      ]);
      setPackages(pkgRes.data.packages || []);
      setSavedCards(cardsRes.data.cards || []);
    } catch (e) {
      console.log('Error fetching data:', e);
    }
    setLoading(false);
  };

  const pollPaymentStatus = async (sessionId: string, attempt = 0) => {
    setCheckingStatus(true);
    const maxAttempts = 8;
    const pollInterval = 2500;

    if (attempt >= maxAttempts) {
      setCheckingStatus(false);
      Alert.alert('Timeout', 'Payment status check timed out. Check your transactions for confirmation.');
      return;
    }

    try {
      const res = await api.get(`/stripe/checkout-status/${sessionId}`);
      const data = res.data;

      if (data.payment_status === 'paid') {
        setCheckingStatus(false);
        await refreshUser();
        Alert.alert(
          'Payment Successful!',
          `You earned ${data.points_awarded.toLocaleString()} points!`,
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      } else if (data.status === 'expired') {
        setCheckingStatus(false);
        Alert.alert('Expired', 'Payment session expired. Please try again.');
        return;
      }

      // Still pending, continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), pollInterval);
    } catch (error) {
      console.error('Status check error:', error);
      if (attempt < maxAttempts - 1) {
        setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), pollInterval);
      } else {
        setCheckingStatus(false);
        Alert.alert('Error', 'Could not verify payment. Check your transactions.');
      }
    }
  };

  const handleCheckout = async () => {
    if (!selectedPackage) {
      Alert.alert('Select Package', 'Please select a points package first.');
      return;
    }

    setPaying(true);
    try {
      const originUrl = Platform.OS === 'web'
        ? window.location.origin
        : 'https://point-vault.preview.emergentagent.com';

      const res = await api.post('/stripe/checkout', {
        package_id: selectedPackage,
        origin_url: originUrl,
      });

      const checkoutUrl = res.data.url;
      const sessionId = res.data.session_id;

      if (Platform.OS === 'web') {
        window.location.href = checkoutUrl;
      } else {
        // Open Stripe Checkout in in-app browser
        if (WebBrowser) {
          await WebBrowser.openBrowserAsync(checkoutUrl, {
            presentationStyle: 'fullScreen',
            dismissButtonStyle: 'close',
          });
          // Browser was closed - poll the payment status from within the app
          // (auth token is still available here)
          setPaying(false);
          pollPaymentStatus(sessionId);
        } else {
          // Fallback: open in external browser
          await Linking.openURL(checkoutUrl);
          setPaying(false);
          // Start polling after a delay
          setTimeout(() => pollPaymentStatus(sessionId), 3000);
        }
        return;
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to create payment session.');
    }
    setPaying(false);
  };

  const handlePayWithSavedCard = async (cardId: string) => {
    if (!selectedPackage) {
      Alert.alert('Select Package', 'Please select a points package first.');
      return;
    }

    Alert.alert(
      'Confirm Payment',
      `Pay with saved card ending in ****?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setPaying(true);
            try {
              const res = await api.post('/stripe/pay-saved-card', {
                payment_method_id: cardId,
                package_id: selectedPackage,
              });

              if (res.data.success && res.data.payment_status === 'succeeded') {
                await refreshUser();
                Alert.alert(
                  'Payment Successful!',
                  `You earned ${res.data.points_awarded.toLocaleString()} points!`,
                  [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
                );
              } else {
                Alert.alert('Payment Failed', 'Your payment could not be processed.');
              }
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.detail || 'Payment failed.');
            }
            setPaying(false);
          },
        },
      ]
    );
  };

  const handleDeleteCard = async (cardId: string) => {
    Alert.alert('Remove Card', 'Are you sure you want to remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/stripe/cards/${cardId}`);
            setSavedCards(savedCards.filter((c) => c.id !== cardId));
          } catch (e) {
            Alert.alert('Error', 'Could not remove card.');
          }
        },
      },
    ]);
  };

  const getPackageIcon = (id: string) => {
    switch (id) {
      case 'starter': return 'star-outline';
      case 'value': return 'star-half';
      case 'premium': return 'star';
      case 'elite': return 'diamond';
      default: return 'gift';
    }
  };

  if (checkingStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Verifying your payment...</Text>
          <Text style={styles.loadingSubtext}>Please wait while we confirm your transaction</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy Points</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Packages */}
        <Text style={styles.sectionTitle}>Select Package</Text>
        <View style={styles.packageGrid}>
          {packages.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={[
                styles.packageCard,
                selectedPackage === pkg.id && styles.packageCardSelected,
              ]}
              onPress={() => setSelectedPackage(pkg.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(pkg.icon || 'star') as any}
                size={28}
                color={selectedPackage === pkg.id ? COLORS.white : COLORS.primary}
              />
              <Text style={[styles.packageName, selectedPackage === pkg.id && styles.selectedText]}>
                {pkg.name}
              </Text>
              <Text style={[styles.packagePoints, selectedPackage === pkg.id && styles.selectedText]}>
                {pkg.label}
              </Text>
              <Text style={[styles.packagePrice, selectedPackage === pkg.id && styles.selectedText]}>
                RM {pkg.amount.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Saved Cards */}
        {savedCards.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pay with Saved Card</Text>
            {savedCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={styles.cardRow}
                onPress={() => handlePayWithSavedCard(card.id)}
                disabled={paying || !selectedPackage}
              >
                <Ionicons name="card" size={24} color={COLORS.primary} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardBrand}>
                    {card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} **** {card.last4}
                  </Text>
                  <Text style={styles.cardExpiry}>
                    Expires {card.exp_month}/{card.exp_year}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteCard(card.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Pay with New Card Button */}
        <TouchableOpacity
          style={[styles.checkoutBtn, (!selectedPackage || paying) && styles.checkoutBtnDisabled]}
          onPress={handleCheckout}
          disabled={!selectedPackage || paying}
          activeOpacity={0.8}
        >
          {paying ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="card-outline" size={22} color={COLORS.white} />
              <Text style={styles.checkoutBtnText}>
                {savedCards.length > 0 ? 'Pay with New Card' : 'Pay with Card'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.secureText}>
          <Ionicons name="lock-closed" size={12} color={COLORS.textMuted} /> Secured by Stripe
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  loadingSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  packageCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOWS.small,
  },
  packageCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  packageName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  packagePoints: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  packagePrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  selectedText: {
    color: COLORS.white,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  cardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  cardBrand: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cardExpiry: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  checkoutBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.medium,
  },
  checkoutBtnDisabled: {
    opacity: 0.5,
  },
  checkoutBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
  secureText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
