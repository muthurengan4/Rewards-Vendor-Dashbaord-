import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { useVendorStore } from '../../src/store/vendorStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function IssuePoints() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { vendor } = useVendorStore();

  const handleIssue = async () => {
    if (!phone.trim() || !amount.trim()) {
      Alert.alert('Error', 'Phone number and bill amount are required');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await vendorApi.issuePoints({
        user_phone: phone.trim(),
        bill_amount: parseFloat(amount),
        description: description || undefined,
      });
      setResult(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to issue points');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhone('');
    setAmount('');
    setDescription('');
    setResult(null);
  };

  return (
    <VendorShell title="Issue Points">
      {vendor?.status !== 'approved' && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#92400E" />
          <Text style={styles.warningText}>Your store must be approved by admin to issue points.</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Issue Points to Customer</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Enter the customer's phone number and bill amount. Points are calculated at {vendor?.points_per_rm || 1} point(s) per RM.
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Customer Phone Number *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+60123456789"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Bill Amount (RM) *</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.rmPrefix}>RM</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          {amount ? (
            <Text style={styles.pointsPreview}>
              Customer will earn: {Math.floor(parseFloat(amount || '0') * (vendor?.points_per_rm || 1))} points
            </Text>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (optional)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Lunch order #123"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.issueBtn} onPress={handleIssue} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : (
            <>
              <Ionicons name="flash" size={20} color={COLORS.white} />
              <Text style={styles.issueBtnText}>Issue Points</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          </View>
          <Text style={styles.resultTitle}>Points Issued Successfully!</Text>
          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Customer</Text>
              <Text style={styles.resultValue}>{result.user_name}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Points Issued</Text>
              <Text style={[styles.resultValue, { color: COLORS.success }]}>+{result.points_issued}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>New Balance</Text>
              <Text style={styles.resultValue}>{result.new_balance} pts</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Issue More Points</Text>
          </TouchableOpacity>
        </View>
      )}
    </VendorShell>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.lg,
  },
  warningText: { fontSize: FONT_SIZES.sm, color: '#92400E', flex: 1 },
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.small,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  sectionDesc: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  formGroup: { marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 50,
  },
  rmPrefix: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  input: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  pointsPreview: {
    fontSize: FONT_SIZES.sm, color: COLORS.success, fontWeight: '600',
    marginTop: 6, marginLeft: 4,
  },
  issueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 52, marginTop: SPACING.sm,
  },
  issueBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  resultCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, alignItems: 'center', ...SHADOWS.medium,
  },
  successIcon: { marginBottom: SPACING.md },
  resultTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  resultGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg, width: '100%' },
  resultItem: {
    flex: 1, backgroundColor: COLORS.surfaceLight,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center',
  },
  resultLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginBottom: 4 },
  resultValue: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  resetBtn: {
    paddingVertical: SPACING.sm,
  },
  resetBtnText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '600' },
});
