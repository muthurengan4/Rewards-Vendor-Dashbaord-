import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

const ICON_OPTIONS = [
  'apps', 'cafe', 'restaurant', 'cart', 'car', 'heart', 'airplane', 'bus',
  'fitness', 'bag', 'phone-portrait', 'card', 'game-controller', 'musical-notes',
  'book', 'home', 'paw', 'color-palette', 'construct', 'diamond',
];

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('apps');
  const [formDesc, setFormDesc] = useState('');
  const [formOrder, setFormOrder] = useState('0');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCategories();
      setCategories(res.data.categories);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditId(null); setFormName(''); setFormIcon('apps');
    setFormDesc(''); setFormOrder('0'); setFormActive(true);
    setShowForm(false);
  };

  const openEdit = (cat: any) => {
    setEditId(cat.id);
    setFormName(cat.name);
    setFormIcon(cat.icon || 'apps');
    setFormDesc(cat.description || '');
    setFormOrder(String(cat.sort_order || 0));
    setFormActive(cat.is_active !== false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return Alert.alert('Error', 'Category name required');
    setSaving(true);
    try {
      const data = { name: formName.trim(), icon: formIcon, description: formDesc, sort_order: parseInt(formOrder) || 0, is_active: formActive };
      if (editId) {
        await adminApi.updateCategory(editId, data);
        Alert.alert('Success', 'Category updated');
      } else {
        await adminApi.createCategory(data);
        Alert.alert('Success', 'Category created');
      }
      resetForm(); load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Category', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await adminApi.deleteCategory(id); load(); } catch (e) { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  return (
    <AdminShell title="Category Management">
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>{categories.length} categories</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Category</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : (
        <View style={styles.grid}>
          {categories.map((cat) => (
            <View key={cat.id} style={[styles.catCard, !cat.is_active && styles.catCardInactive]}>
              <View style={styles.catHeader}>
                <View style={[styles.catIconWrap, { backgroundColor: cat.is_active ? '#FCE8EB' : '#F3F4F6' }]}>
                  <Ionicons name={(cat.icon || 'apps') as any} size={24} color={cat.is_active ? COLORS.primary : COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  {cat.description ? <Text style={styles.catDesc} numberOfLines={1}>{cat.description}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDelete(cat.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.catMeta}>
                <Text style={styles.metaText}>{cat.vendor_count || 0} vendors</Text>
                <Text style={styles.metaText}>{cat.partner_count || 0} partners</Text>
                <View style={[styles.statusPill, cat.is_active ? styles.pillActive : styles.pillInactive]}>
                  <Text style={styles.pillText}>{cat.is_active ? 'Active' : 'Off'}</Text>
                </View>
                <Text style={styles.metaText}>Order: {cat.sort_order || 0}</Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(cat)}>
                <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))}
          {categories.length === 0 && <Text style={styles.empty}>No categories yet. Click Add to create one.</Text>}
        </View>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? 'Edit Category' : 'New Category'}</Text>
              <TouchableOpacity onPress={resetForm}><Ionicons name="close" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput style={styles.formInput} value={formName} onChangeText={setFormName} placeholder="Category name" placeholderTextColor={COLORS.textMuted} />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((ic) => (
                  <TouchableOpacity key={ic} style={[styles.iconBtn, formIcon === ic && styles.iconBtnActive]} onPress={() => setFormIcon(ic)}>
                    <Ionicons name={ic as any} size={22} color={formIcon === ic ? COLORS.primary : COLORS.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={styles.formInput} value={formDesc} onChangeText={setFormDesc} placeholder="Optional description" placeholderTextColor={COLORS.textMuted} />
            </View>

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Sort Order</Text>
                <TextInput style={styles.formInput} value={formOrder} onChangeText={setFormOrder} keyboardType="numeric" />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Status</Text>
                <TouchableOpacity style={[styles.toggleBtn, formActive && styles.toggleActive]} onPress={() => setFormActive(!formActive)}>
                  <Text style={[styles.toggleText, formActive && styles.toggleTextActive]}>{formActive ? 'Active' : 'Inactive'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{editId ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BORDER_RADIUS.lg },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  catCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, minWidth: 280, flex: 1, ...SHADOWS.small },
  catCardInactive: { opacity: 0.6 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  catIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  catDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: 2 },
  deleteBtn: { padding: 6 },
  catMeta: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm, flexWrap: 'wrap', alignItems: 'center' },
  metaText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pillActive: { backgroundColor: '#DCFCE7' },
  pillInactive: { backgroundColor: '#FEE2E2' },
  pillText: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: SPACING.sm },
  editBtnText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600' },
  empty: { textAlign: 'center', padding: SPACING.xl, color: COLORS.textMuted, width: '100%' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xxl, padding: SPACING.xl, width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  formGroup: { marginBottom: SPACING.md },
  formLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  formInput: { backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 44, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  iconBtnActive: { backgroundColor: '#FCE8EB', borderWidth: 2, borderColor: COLORS.primary },
  toggleBtn: { height: 44, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEE2E2' },
  toggleActive: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  toggleText: { fontWeight: '700', color: '#EF4444' },
  toggleTextActive: { color: '#22C55E' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
});
