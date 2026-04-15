import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

const ICON_OPTIONS = [
  'star-outline', 'star-half', 'star', 'diamond', 'trophy', 'medal',
  'ribbon', 'gift', 'flash', 'rocket', 'flame', 'sparkles',
  'crown-outline', 'shield-checkmark', 'wallet', 'card',
];

export default function AdminPackages() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('myr');
  const [formLabel, setFormLabel] = useState('');
  const [formIcon, setFormIcon] = useState('star');
  const [formOrder, setFormOrder] = useState('0');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPackages();
      setPackages(res.data.packages);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditId(null); setFormName(''); setFormPoints(''); setFormAmount('');
    setFormCurrency('myr'); setFormLabel(''); setFormIcon('star');
    setFormOrder('0'); setFormActive(true); setShowForm(false);
  };

  const openEdit = (pkg: any) => {
    setEditId(pkg.id);
    setFormName(pkg.name || '');
    setFormPoints(String(pkg.points || ''));
    setFormAmount(String(pkg.amount || ''));
    setFormCurrency(pkg.currency || 'myr');
    setFormLabel(pkg.label || '');
    setFormIcon(pkg.icon || 'star');
    setFormOrder(String(pkg.sort_order || 0));
    setFormActive(pkg.is_active !== false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPoints || !formAmount) {
      Alert.alert('Error', 'Name, points, and amount are required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: formName.trim(),
        points: parseInt(formPoints),
        amount: parseFloat(formAmount),
        currency: formCurrency,
        label: formLabel.trim() || `${parseInt(formPoints).toLocaleString()} Points`,
        icon: formIcon,
        sort_order: parseInt(formOrder) || 0,
        is_active: formActive,
      };
      if (editId) {
        await adminApi.updatePackage(editId, data);
      } else {
        await adminApi.createPackage(data);
      }
      resetForm();
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Package', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await adminApi.deletePackage(id); load(); }
        catch (e) { Alert.alert('Error', 'Delete failed'); }
      }},
    ]);
  };

  return (
    <AdminShell title="Points Packages">
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{packages.length} package(s)</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add Package</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {packages.map((pkg) => (
              <View key={pkg.id} style={[styles.pkgCard, !pkg.is_active && styles.pkgInactive]}>
                <View style={styles.pkgIconBox}>
                  <Ionicons name={(pkg.icon || 'star') as any} size={28} color={COLORS.primary} />
                </View>
                <View style={styles.pkgInfo}>
                  <Text style={styles.pkgName}>{pkg.name}</Text>
                  <Text style={styles.pkgDetails}>{pkg.label} — RM {pkg.amount?.toFixed(2)}</Text>
                  <Text style={styles.pkgMeta}>
                    {pkg.is_active ? 'Active' : 'Inactive'} · Order: {pkg.sort_order}
                  </Text>
                </View>
                <View style={styles.pkgActions}>
                  <TouchableOpacity onPress={() => openEdit(pkg)} style={styles.actionBtn}>
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(pkg.id, pkg.name)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Form Modal */}
        <Modal visible={showForm} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editId ? 'Edit' : 'New'} Package</Text>
                <TouchableOpacity onPress={resetForm}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Package Name *</Text>
                <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="e.g. Gold, Platinum" placeholderTextColor={COLORS.textMuted} />

                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Points *</Text>
                    <TextInput style={styles.input} value={formPoints} onChangeText={setFormPoints} placeholder="e.g. 3000" keyboardType="numeric" placeholderTextColor={COLORS.textMuted} />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Price (RM) *</Text>
                    <TextInput style={styles.input} value={formAmount} onChangeText={setFormAmount} placeholder="e.g. 20.00" keyboardType="decimal-pad" placeholderTextColor={COLORS.textMuted} />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Display Label</Text>
                <TextInput style={styles.input} value={formLabel} onChangeText={setFormLabel} placeholder="e.g. 3,000 Points (auto-generated if empty)" placeholderTextColor={COLORS.textMuted} />

                <Text style={styles.fieldLabel}>Icon</Text>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((ic) => (
                    <TouchableOpacity key={ic} style={[styles.iconOption, formIcon === ic && styles.iconSelected]} onPress={() => setFormIcon(ic)}>
                      <Ionicons name={ic as any} size={22} color={formIcon === ic ? COLORS.white : COLORS.textPrimary} />
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Sort Order</Text>
                    <TextInput style={styles.input} value={formOrder} onChangeText={setFormOrder} keyboardType="numeric" placeholderTextColor={COLORS.textMuted} />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Active</Text>
                    <View style={styles.switchRow}>
                      <Switch value={formActive} onValueChange={setFormActive} trackColor={{ true: COLORS.primary }} />
                      <Text style={styles.switchLabel}>{formActive ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{editId ? 'Update' : 'Create'} Package</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, gap: 6 },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
  list: { flex: 1 },
  pkgCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small },
  pkgInactive: { opacity: 0.5 },
  pkgIconBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' },
  pkgInfo: { flex: 1, marginLeft: SPACING.md },
  pkgName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  pkgDetails: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  pkgMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 2 },
  pkgActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { padding: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, width: '100%', maxWidth: 500, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  formScroll: { maxHeight: 500 },
  fieldLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', gap: SPACING.sm },
  halfField: { flex: 1 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  iconOption: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  iconSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  switchLabel: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.md },
});
