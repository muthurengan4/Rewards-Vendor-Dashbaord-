import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { COLORS, FONT_SIZES, SPACING } from '../src/constants/theme';
import { Button } from '../src/components/Button';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="gift" size={60} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>RewardsHub</Text>
        <Text style={styles.subtitle}>Earn. Redeem. Enjoy.</Text>
        <Text style={styles.location}>Malaysia</Text>
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="qr-code" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Scan & Earn</Text>
            <Text style={styles.featureDescription}>Earn points at partner stores across Malaysia</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Pay Bills</Text>
            <Text style={styles.featureDescription}>Pay TNB, water, phone bills with points</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="gift-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Redeem Rewards</Text>
            <Text style={styles.featureDescription}>Exchange points for amazing rewards</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="send-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Send Money</Text>
            <Text style={styles.featureDescription}>Transfer to friends and family instantly</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Get Started"
          onPress={() => router.push('/(auth)/register')}
          variant="primary"
          size="large"
          style={styles.button}
        />
        <Button
          title="I already have an account"
          onPress={() => router.push('/(auth)/login')}
          variant="ghost"
          size="medium"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },
  location: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  features: {
    marginBottom: SPACING.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingBottom: SPACING.xxl,
  },
  button: {
    marginBottom: SPACING.md,
  },
});
