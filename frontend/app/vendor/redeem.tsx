import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function VendorRedeem() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleValidate = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a redemption code');
      return;
    }
    setLoading(true);
    setValidationResult(null);
    setConfirmed(false);
    try {
      const res = await vendorApi.validateRedemption(code.trim());
      setValidationResult(res.data);
    } catch (e: any) {
      Alert.alert('Invalid', e.response?.data?.detail || 'Invalid redemption code');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await vendorApi.confirmRedemption(code.trim());
      setConfirmed(true);
      Alert.alert('Success', 'Redemption confirmed!');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to confirm');
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setCode('');
    setValidationResult(null);
    setConfirmed(false);
  };

  return (
    <VendorShell title="Scan & Redeem">
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="qr-code" size={28} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Validate Redemption</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Enter the customer's redemption code to validate and confirm their reward.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={setCode}
            placeholder="Enter redemption code (e.g. RDM-XXXXXXXX)"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.validateBtn} onPress={handleValidate} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
              <>
                <Ionicons name="search" size={18} color={COLORS.white} />
                <Text style={styles.validateBtnText}>Validate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {validationResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Ionicons
              name={confirmed ? 'checkmark-circle' : 'shield-checkmark'}
              size={32}
              color={confirmed ? COLORS.success : COLORS.info}
            />
            <Text style={styles.resultTitle}>
              {confirmed ? 'Redemption Confirmed!' : 'Valid Redemption'}
            </Text>
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Customer</Text>
              <Text style={styles.resultValue}>{validationResult.user?.name || 'N/A'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Phone</Text>
              <Text style={styles.resultValue}>{validationResult.user?.phone || 'N/A'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Reward</Text>
              <Text style={styles.resultValue}>{validationResult.redemption?.reward_name || 'N/A'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Points Used</Text>
              <Text style={styles.resultValue}>{validationResult.redemption?.points_used || 0} pts</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Code</Text>
              <Text style={styles.resultValue}>{validationResult.redemption?.redemption_code || code}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Status</Text>
              <View style={[styles.statusBadge, confirmed ? styles.statusUsed : styles.statusActive]}>
                <Text style={styles.statusText}>{confirmed ? 'Used' : 'Active'}</Text>
              </View>
            </View>
          </View>

          {!confirmed && (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={confirming}>
              {confirming ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="checkmark-done" size={20} color={COLORS.white} />
                  <Text style={styles.confirmBtnText}>Confirm Redemption</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Validate Another</Text>
          </TouchableOpacity>
        </View>
      )}
    </VendorShell>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.small,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  sectionDesc: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  inputRow: { flexDirection: 'row', gap: SPACING.sm },
  codeInput: {
    flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 50,
    fontSize: FONT_SIZES.md, color: COLORS.textPrimary,
  },
  validateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS.lg, height: 50,
  },
  validateBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
  resultCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, ...SHADOWS.medium,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.lg },
  resultTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  resultGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  resultItem: {
    minWidth: 150, flex: 1, backgroundColor: COLORS.surfaceLight,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
  },
  resultLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginBottom: 4 },
  resultValue: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusUsed: { backgroundColor: '#DBEAFE' },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textPrimary },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.success, borderRadius: BORDER_RADIUS.lg,
    height: 52, marginBottom: SPACING.sm,
  },
  confirmBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
  resetBtn: {
    alignItems: 'center', paddingVertical: SPACING.sm,
  },
  resetBtnText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '600' },
});
