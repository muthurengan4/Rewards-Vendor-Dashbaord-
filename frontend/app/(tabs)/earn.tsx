import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import { api } from '../../src/services/api';

export default function EarnScreen() {
  const { user, refreshUser } = useAuthStore();
  const router = useRouter();

  const handleDemoEarn = async () => {
    try {
      await api.post('/earn/demo');
      await refreshUser();
      Alert.alert('Success!', 'You earned 50 demo points!');
    } catch (error) {
      Alert.alert('Error', 'Failed to earn demo points');
    }
  };

  const handleScanQR = () => {
    router.push('/scan');
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
          <Text style={styles.subtitle}>Scan or show QR at partner stores</Text>
        </View>

        {/* Scan QR Button - Primary CTA */}
        <TouchableOpacity style={styles.scanButton} onPress={handleScanQR} activeOpacity={0.85}>
          <View style={styles.scanButtonInner}>
            <View style={styles.scanIconWrap}>
              <Ionicons name="scan" size={32} color={COLORS.white} />
            </View>
            <View style={styles.scanTextWrap}>
              <Text style={styles.scanButtonTitle}>Scan to Earn</Text>
              <Text style={styles.scanButtonSubtitle}>Scan vendor QR code to collect points</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
          </View>
        </TouchableOpacity>

        {/* QR Code Card - Member QR */}
        <Card style={styles.qrCard}>
          <Text style={styles.qrSectionLabel}>Your Member QR</Text>
          <View style={styles.qrContainer}>
            {user?.qr_code ? (
              <QRCode
                value={user.qr_code}
                size={180}
                color={COLORS.blueDark}
                backgroundColor={COLORS.white}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={80} color={COLORS.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.qrInfo}>
            <Text style={styles.qrLabel}>Member ID</Text>
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
              <Text style={styles.stepDesc}>Make purchases at any AI Rewards System partner</Text>
            </View>
          </Card>

          <Card style={styles.stepCard}>
            <View style={[styles.stepNumber, { backgroundColor: COLORS.success }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Scan the Vendor QR</Text>
              <Text style={styles.stepDesc}>Tap "Scan to Earn" and scan the purchase QR</Text>
            </View>
          </Card>

          <Card style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Points Added Instantly</Text>
              <Text style={styles.stepDesc}>Points credited to your wallet right away</Text>
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
  // Scan Button
  scanButton: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    ...SHADOWS.medium,
  },
  scanButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  scanIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  scanTextWrap: {
    flex: 1,
  },
  scanButtonTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 2,
  },
  scanButtonSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  // QR Card
  qrCard: {
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  qrSectionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  qrContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
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
