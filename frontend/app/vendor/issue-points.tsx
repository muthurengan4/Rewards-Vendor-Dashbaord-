import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { useVendorStore } from '../../src/store/vendorStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

type Mode = 'choose' | 'manual' | 'automatic';

export default function IssuePoints() {
  const [mode, setMode] = useState<Mode>('choose');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualResult, setManualResult] = useState<any>(null);
  const [qrResult, setQrResult] = useState<any>(null);
  const [previewPoints, setPreviewPoints] = useState<number | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const { vendor } = useVendorStore();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const res = await vendorApi.getPointRules();
      setRules(res.data.rules || []);
    } catch (e) { console.log(e); }
  };

  // Auto-preview points when amount changes
  useEffect(() => {
    if (mode === 'automatic' && amount) {
      previewCalc();
    } else {
      setPreviewPoints(null);
    }
  }, [amount, mode]);

  const previewCalc = async () => {
    try {
      const res = await vendorApi.calculatePoints(parseFloat(amount));
      setPreviewPoints(res.data.points_calculated);
    } catch (e) {
      setPreviewPoints(0);
    }
  };

  // Manual issue
  const handleManualIssue = async () => {
    if (!phone.trim() || !amount.trim()) {
      Alert.alert('Error', 'Phone number and bill amount are required');
      return;
    }
    setLoading(true);
    try {
      const res = await vendorApi.issuePoints({
        user_phone: phone.trim(),
        bill_amount: parseFloat(amount),
        description: description || undefined,
      });
      setManualResult(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to issue points');
    } finally {
      setLoading(false);
    }
  };

  // Automatic QR generation
  const handleGenerateQR = async () => {
    if (!amount.trim()) {
      Alert.alert('Error', 'Bill amount is required');
      return;
    }
    setLoading(true);
    try {
      const res = await vendorApi.generatePurchaseQR({
        bill_amount: parseFloat(amount),
        description: description || undefined,
      });
      setQrResult(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to generate QR');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhone('');
    setAmount('');
    setDescription('');
    setManualResult(null);
    setQrResult(null);
    setPreviewPoints(null);
    setMode('choose');
  };

  // Mode chooser
  if (mode === 'choose') {
    return (
      <VendorShell title="Issue Points">
        {vendor?.status !== 'approved' && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#92400E" />
            <Text style={styles.warningText}>Your store must be approved to issue points.</Text>
          </View>
        )}

        <Text style={styles.pageTitle}>How would you like to issue points?</Text>

        <TouchableOpacity style={styles.modeCard} onPress={() => setMode('automatic')}>
          <View style={[styles.modeIcon, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="qr-code" size={32} color="#22C55E" />
          </View>
          <View style={styles.modeInfo}>
            <Text style={styles.modeTitle}>Automatic (QR Code)</Text>
            <Text style={styles.modeDesc}>
              Enter bill amount, points auto-calculated from your tiers. Customer scans QR to claim.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.modeCard} onPress={() => setMode('manual')}>
          <View style={[styles.modeIcon, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="keypad" size={32} color="#3B82F6" />
          </View>
          <View style={styles.modeInfo}>
            <Text style={styles.modeTitle}>Manual (Phone Number)</Text>
            <Text style={styles.modeDesc}>
              Enter customer's phone number and bill amount. Points credited directly.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>

        {rules.length > 0 && (
          <View style={styles.rulesPreview}>
            <Text style={styles.rulesTitle}>Your Spending Tiers</Text>
            {rules.map((r, i) => (
              <View key={r.id} style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>{r.label}</Text>
                <Text style={styles.ruleRange}>
                  RM{r.min_amount} - {r.max_amount === -1 ? '∞' : `RM${r.max_amount}`}
                </Text>
                <Text style={styles.rulePoints}>{r.points_reward} pts</Text>
              </View>
            ))}
          </View>
        )}
      </VendorShell>
    );
  }

  // QR Result screen
  if (qrResult) {
    return (
      <VendorShell title="Purchase QR Code">
        <View style={styles.qrResultCard}>
          <View style={styles.qrSuccessHeader}>
            <Ionicons name="checkmark-circle" size={32} color={COLORS.success} />
            <Text style={styles.qrSuccessTitle}>QR Code Generated!</Text>
          </View>
          <Text style={styles.qrInstructions}>
            Show this QR code to the customer. They scan it with their AI Rewards System app to claim points.
          </Text>

          <View style={styles.qrImageWrap}>
            <Image
              source={{ uri: qrResult.qr_code }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.qrDetails}>
            <View style={styles.qrDetailRow}>
              <Text style={styles.qrDetailLabel}>Code</Text>
              <Text style={styles.qrDetailValue}>{qrResult.purchase?.code}</Text>
            </View>
            <View style={styles.qrDetailRow}>
              <Text style={styles.qrDetailLabel}>Bill Amount</Text>
              <Text style={styles.qrDetailValue}>RM{qrResult.purchase?.bill_amount}</Text>
            </View>
            <View style={styles.qrDetailRow}>
              <Text style={styles.qrDetailLabel}>Points Reward</Text>
              <Text style={[styles.qrDetailValue, { color: COLORS.success, fontWeight: '800' }]}>
                +{qrResult.purchase?.points_reward} pts
              </Text>
            </View>
            <View style={styles.qrDetailRow}>
              <Text style={styles.qrDetailLabel}>Tier Matched</Text>
              <Text style={styles.qrDetailValue}>{qrResult.purchase?.rule_matched || 'N/A'}</Text>
            </View>
            <View style={styles.qrDetailRow}>
              <Text style={styles.qrDetailLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Pending Claim</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.newBtn} onPress={handleReset}>
            <Ionicons name="add-circle" size={20} color={COLORS.white} />
            <Text style={styles.newBtnText}>Generate Another</Text>
          </TouchableOpacity>
        </View>
      </VendorShell>
    );
  }

  // Manual result
  if (manualResult) {
    return (
      <VendorShell title="Points Issued">
        <View style={styles.resultCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          </View>
          <Text style={styles.resultTitle}>Points Issued Successfully!</Text>
          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Customer</Text>
              <Text style={styles.resultValue}>{manualResult.user_name}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Points Issued</Text>
              <Text style={[styles.resultValue, { color: COLORS.success }]}>+{manualResult.points_issued}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>New Balance</Text>
              <Text style={styles.resultValue}>{manualResult.new_balance} pts</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={handleReset}>
            <Text style={styles.newBtnText}>Issue More Points</Text>
          </TouchableOpacity>
        </View>
      </VendorShell>
    );
  }

  // Issue form (manual or automatic)
  return (
    <VendorShell title={mode === 'automatic' ? 'Generate Purchase QR' : 'Manual Issue Points'}>
      <TouchableOpacity style={styles.backMode} onPress={() => setMode('choose')}>
        <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        <Text style={styles.backModeText}>Change mode</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name={mode === 'automatic' ? 'qr-code' : 'keypad'}
            size={28}
            color={COLORS.primary}
          />
          <Text style={styles.sectionTitle}>
            {mode === 'automatic' ? 'Auto Points via QR' : 'Manual Point Entry'}
          </Text>
        </View>

        {mode === 'automatic' ? (
          <Text style={styles.sectionDesc}>
            Enter the bill amount. Points will be auto-calculated from your spending tiers and a QR code generated for the customer.
          </Text>
        ) : (
          <Text style={styles.sectionDesc}>
            Enter customer phone and bill amount. Points are calculated at {vendor?.points_per_rm || 1} point(s) per RM.
          </Text>
        )}

        {mode === 'manual' && (
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
        )}

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
          {mode === 'automatic' && previewPoints !== null && (
            <View style={styles.pointsPreviewCard}>
              <Ionicons name="flash" size={18} color={COLORS.primary} />
              <Text style={styles.pointsPreviewText}>
                Customer will earn: <Text style={styles.pointsPreviewBold}>{previewPoints} points</Text>
              </Text>
            </View>
          )}
          {mode === 'manual' && amount ? (
            <Text style={styles.pointsPreviewSimple}>
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

        <TouchableOpacity
          style={styles.issueBtn}
          onPress={mode === 'automatic' ? handleGenerateQR : handleManualIssue}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={COLORS.white} /> : (
            <>
              <Ionicons name={mode === 'automatic' ? 'qr-code' : 'flash'} size={20} color={COLORS.white} />
              <Text style={styles.issueBtnText}>
                {mode === 'automatic' ? 'Generate QR Code' : 'Issue Points'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  pageTitle: {
    fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  // Mode cards
  modeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.small,
  },
  modeIcon: {
    width: 64, height: 64, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  modeDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  // Rules preview
  rulesPreview: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginTop: SPACING.md, ...SHADOWS.small,
  },
  rulesTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  ruleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  ruleLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  ruleRange: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1.5, textAlign: 'center' },
  rulePoints: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.primary },
  // Back mode
  backMode: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md,
  },
  backModeText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600' },
  // Section
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, ...SHADOWS.small,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  sectionDesc: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 20 },
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
  pointsPreviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCE8EB', padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md, marginTop: 8,
  },
  pointsPreviewText: { fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  pointsPreviewBold: { fontWeight: '800', color: COLORS.primary },
  pointsPreviewSimple: {
    fontSize: FONT_SIZES.sm, color: COLORS.success, fontWeight: '600',
    marginTop: 6, marginLeft: 4,
  },
  issueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 52, marginTop: SPACING.sm,
  },
  issueBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  // QR Result
  qrResultCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, ...SHADOWS.medium,
  },
  qrSuccessHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  qrSuccessTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  qrInstructions: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 20 },
  qrImageWrap: {
    alignItems: 'center', padding: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2, borderColor: COLORS.border, marginBottom: SPACING.lg,
  },
  qrImage: { width: 240, height: 240 },
  qrDetails: { marginBottom: SPACING.lg },
  qrDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  qrDetailLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  qrDetailValue: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: '#92400E' },
  // Manual result
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
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 50, width: '100%',
  },
  newBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
