import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function PointRules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ min_amount: '', max_amount: '', points_reward: '', label: '' });
  const [saving, setSaving] = useState(false);
  const [testAmount, setTestAmount] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    try {
      const res = await vendorApi.getPointRules();
      setRules(res.data.rules || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ min_amount: '', max_amount: '', points_reward: '', label: '' });
    setModalVisible(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      min_amount: String(r.min_amount),
      max_amount: String(r.max_amount),
      points_reward: String(r.points_reward),
      label: r.label || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.min_amount || !form.points_reward) {
      Alert.alert('Error', 'Min amount and points reward are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        min_amount: parseFloat(form.min_amount),
        max_amount: form.max_amount ? parseFloat(form.max_amount) : -1,
        points_reward: parseInt(form.points_reward),
        label: form.label || undefined,
      };
      if (editingId) {
        await vendorApi.updatePointRule(editingId, payload);
      } else {
        await vendorApi.createPointRule(payload);
      }
      setModalVisible(false);
      loadRules();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vendorApi.deletePointRule(id);
      loadRules();
    } catch (e) { console.log(e); }
  };

  const handleTest = async () => {
    if (!testAmount) return;
    setTesting(true);
    try {
      const res = await vendorApi.calculatePoints(parseFloat(testAmount));
      setTestResult(res.data);
    } catch (e: any) {
      setTestResult({ error: e.response?.data?.detail || 'Error' });
    } finally {
      setTesting(false);
    }
  };

  const getTierColor = (index: number) => {
    const colors = ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF'];
    return colors[index % colors.length];
  };

  return (
    <VendorShell title="Points Rules">
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#1D4ED8" />
        <Text style={styles.infoText}>
          Set up spending tiers to automatically calculate reward points. When you generate a purchase QR, points are calculated based on these rules.
        </Text>
      </View>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.count}>{rules.length} Spending Tiers</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Tier</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : rules.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No spending tiers yet</Text>
          <Text style={styles.emptySubtext}>Add tiers to auto-calculate reward points</Text>
        </View>
      ) : (
        <>
          {/* Visual Tier Ladder */}
          <View style={styles.tierLadder}>
            {rules.map((r, i) => (
              <View key={r.id} style={styles.tierCard}>
                <View style={[styles.tierBadge, { backgroundColor: getTierColor(i) }]}>
                  <Ionicons name="trophy" size={20} color={COLORS.white} />
                </View>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierLabel}>{r.label}</Text>
                  <Text style={styles.tierRange}>
                    RM{r.min_amount.toFixed(0)} {r.max_amount === -1 ? '& above' : `- RM${r.max_amount.toFixed(0)}`}
                  </Text>
                </View>
                <View style={styles.tierPoints}>
                  <Text style={styles.tierPointsValue}>{r.points_reward}</Text>
                  <Text style={styles.tierPointsLabel}>pts</Text>
                </View>
                <View style={styles.tierActions}>
                  <TouchableOpacity onPress={() => openEdit(r)} style={styles.tierActionBtn}>
                    <Ionicons name="create-outline" size={18} color={COLORS.info} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(r.id)} style={styles.tierActionBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Test Calculator */}
          <View style={styles.testSection}>
            <Text style={styles.testTitle}>Test Calculator</Text>
            <Text style={styles.testDesc}>Enter a bill amount to preview points calculation</Text>
            <View style={styles.testRow}>
              <View style={styles.testInputWrap}>
                <Text style={styles.rmPrefix}>RM</Text>
                <TextInput
                  style={styles.testInput}
                  value={testAmount}
                  onChangeText={setTestAmount}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
                {testing ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                  <Text style={styles.testBtnText}>Calculate</Text>
                )}
              </TouchableOpacity>
            </View>
            {testResult && !testResult.error && (
              <View style={styles.testResultCard}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                <View style={styles.testResultInfo}>
                  <Text style={styles.testResultPoints}>{testResult.points_calculated} points</Text>
                  <Text style={styles.testResultMeta}>
                    {testResult.rule_matched ? `Matched: ${testResult.rule_matched.label}` : 'No rule matched'}
                  </Text>
                </View>
              </View>
            )}
            {testResult?.error && (
              <View style={[styles.testResultCard, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={24} color={COLORS.error} />
                <Text style={styles.testResultMeta}>{testResult.error}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Tier' : 'Add Spending Tier'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Label (e.g. Bronze, Silver, Gold)</Text>
              <TextInput
                style={styles.formInput}
                value={form.label}
                onChangeText={(v) => setForm(p => ({ ...p, label: v }))}
                placeholder="Tier name"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Min Amount (RM) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.min_amount}
                  onChangeText={(v) => setForm(p => ({ ...p, min_amount: v }))}
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Max Amount (RM)</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.max_amount}
                  onChangeText={(v) => setForm(p => ({ ...p, max_amount: v }))}
                  placeholder="-1 = unlimited"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Points Reward *</Text>
              <TextInput
                style={styles.formInput}
                value={form.points_reward}
                onChangeText={(v) => setForm(p => ({ ...p, points_reward: v }))}
                placeholder="e.g. 10"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.saveBtnText}>{editingId ? 'Update Tier' : 'Create Tier'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </VendorShell>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#DBEAFE', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.lg,
  },
  infoText: { fontSize: FONT_SIZES.sm, color: '#1D4ED8', flex: 1, lineHeight: 20 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  count: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textSecondary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
  },
  addBtnText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.md },
  emptySubtext: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, marginTop: 4 },
  // Tier Ladder
  tierLadder: { marginBottom: SPACING.lg },
  tierCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small,
  },
  tierBadge: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  tierInfo: { flex: 1 },
  tierLabel: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  tierRange: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  tierPoints: { alignItems: 'center', marginRight: SPACING.md },
  tierPointsValue: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  tierPointsLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  tierActions: { gap: 8 },
  tierActionBtn: { padding: 6 },
  // Test Calculator
  testSection: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, ...SHADOWS.small,
  },
  testTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  testDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },
  testRow: { flexDirection: 'row', gap: SPACING.sm },
  testInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 48,
  },
  rmPrefix: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  testInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  testBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS.lg, height: 48, justifyContent: 'center',
  },
  testBtnText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  testResultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#DCFCE7', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, marginTop: SPACING.md,
  },
  testResultInfo: { flex: 1 },
  testResultPoints: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  testResultMeta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, width: '100%', maxWidth: 450,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  formGroup: { marginBottom: SPACING.md },
  formRow: { flexDirection: 'row', gap: SPACING.md },
  formLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  formInput: {
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 46,
    fontSize: FONT_SIZES.md, color: COLORS.textPrimary,
  },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 50, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
