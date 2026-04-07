import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function VendorBranches() {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBranches(); }, []);

  const loadBranches = async () => {
    try {
      const res = await vendorApi.getBranches();
      setBranches(res.data.branches || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', address: '', phone: '' });
    setModalVisible(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
    setForm({ name: b.name || '', address: b.address || '', phone: b.phone || '' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.address) {
      Alert.alert('Error', 'Name and address are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await vendorApi.updateBranch(editingId, { ...form, is_active: true });
      } else {
        await vendorApi.createBranch({ ...form, is_active: true });
      }
      setModalVisible(false);
      loadBranches();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vendorApi.deleteBranch(id);
      loadBranches();
    } catch (e) { console.log(e); }
  };

  return (
    <VendorShell title="Branch Management">
      <View style={styles.topBar}>
        <Text style={styles.count}>{branches.length} Branches</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Branch</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : branches.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No branches yet</Text>
          <Text style={styles.emptySubtext}>Add your first branch location</Text>
        </View>
      ) : (
        branches.map((b) => (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="business" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{b.name}</Text>
                <Text style={styles.cardAddress}>{b.address}</Text>
                {b.phone ? <Text style={styles.cardPhone}>{b.phone}</Text> : null}
              </View>
            </View>
            <View style={styles.cardStats}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{b.total_points_issued || 0}</Text>
                <Text style={styles.statLbl}>Points Issued</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{b.total_redemptions || 0}</Text>
                <Text style={styles.statLbl}>Redemptions</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(b)}>
                <Ionicons name="create-outline" size={18} color={COLORS.info} />
                <Text style={[styles.actionText, { color: COLORS.info }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(b.id)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Branch' : 'Add Branch'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {[
              { key: 'name', label: 'Branch Name *', placeholder: 'e.g. Bangsar Outlet', icon: 'business-outline' },
              { key: 'address', label: 'Address *', placeholder: 'Full address', icon: 'location-outline' },
              { key: 'phone', label: 'Phone', placeholder: '+60123456789', icon: 'call-outline' },
            ].map((field) => (
              <View key={field.key} style={styles.formGroup}>
                <Text style={styles.formLabel}>{field.label}</Text>
                <View style={styles.formInputWrap}>
                  <Ionicons name={field.icon as any} size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.formInput}
                    value={(form as any)[field.key]}
                    onChangeText={(v) => setForm(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Add Branch'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </VendorShell>
  );
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.small,
  },
  cardHeader: { flexDirection: 'row', marginBottom: SPACING.md },
  cardIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#FCE8EB', justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  cardAddress: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  cardPhone: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: 2 },
  cardStats: {
    flexDirection: 'row', gap: SPACING.lg,
    paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  statItem: {},
  statVal: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  statLbl: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', gap: SPACING.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: FONT_SIZES.sm, fontWeight: '600' },
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
  formLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  formInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 46,
  },
  formInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 50, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
