import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { api } from '../../src/services/api';
import { Alert } from 'react-native';

export default function EarnScreen() {
  const { user, refreshUser } = useAuthStore();

  const handleDemoEarn = async () => {
    try {
      await api.post('/earn/demo');
      await refreshUser();
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
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earn Points</Text>
          <Text style={styles.subtitle}>Show this QR code at partner stores</Text>
        </View>

        {/* QR Code Card */}
        <Card style={styles.qrCard}>
          <View style={styles.qrContainer}>
            {user?.qr_code ? (
              <QRCode
                value={user.qr_code}
                size={200}
                color={COLORS.blueDark}
                backgroundColor={COLORS.white}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={100} color={COLORS.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.qrInfo}>
            <Text style={styles.qrLabel}>Your Member ID</Text>
            <Text style={styles.qrCode}>{user?.qr_code || 'Loading...'}</Text>
          </View>
        </Card>

        {/* Points Balance */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceAmount}>
                {user?.points_balance?.toLocaleString() || '0'} pts
              </Text>
            </View>
            <View style={styles.balanceIcon}>
              <Ionicons name="wallet" size={32} color={COLORS.white} />
            </View>
          </View>
        </Card>

        {/* How to Earn */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Earn</Text>
          
          <Card style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Shop at Partner Stores</Text>
              <Text style={styles.stepDesc}>Make purchases at any RewardsHub partner</Text>
            </View>
          </Card>

          <Card style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Show Your QR Code</Text>
              <Text style={styles.stepDesc}>Let the cashier scan your member QR</Text>
            </View>
          </Card>

          <Card style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Earn Points Instantly</Text>
              <Text style={styles.stepDesc}>Points are added to your wallet immediately</Text>
            </View>
          </Card>
        </View>

        {/* Demo Button */}
        <View style={styles.demoSection}>
          <Text style={styles.demoText}>Want to test? Earn demo points!</Text>
          <Button
            title="Earn 50 Demo Points"
            onPress={handleDemoEarn}
            variant="outline"
            size="medium"
          />
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
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  qrCard: {
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  qrContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
  },
  qrInfo: {
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  qrCode: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  balanceCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceInfo: {},
  balanceLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: SPACING.xs,
  },
  balanceAmount: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  balanceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  stepNumberText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  demoSection: {
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  demoText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
});
