import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Switch, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) {}

const ICON_OPTIONS = [
  'flash', 'water', 'call', 'wifi', 'car', 'home', 'tv', 'shield-checkmark',
  'school', 'medkit', 'card', 'cash', 'wallet', 'globe', 'phone-portrait',
];
const BG_COLORS = ['#FEF3C7', '#DBEAFE', '#F3E8FF', '#DCFCE7', '#FEE2E2', '#E0F2FE', '#FCE7F3', '#F0FDF4'];

export default function AdminBillTypes() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('flash');
  const [formImage, setFormImage] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formBgColor, setFormBgColor] = useState('#F3E8FF');
  const [formOrder, setFormOrder] = useState('0');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getBillTypes();
      setTypes(res.data.bill_types);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditId(null); setFormName(''); setFormIcon('flash');
    setFormImage(''); setFormProvider(''); setFormBgColor('#F3E8FF');
    setFormOrder('0'); setFormActive(true); setShowForm(false);
  };

  const openEdit = (bt: any) => {
    setEditId(bt.id); setFormName(bt.name);
    setFormIcon(bt.icon || 'flash'); setFormImage(bt.image || '');
    setFormProvider(bt.provider || ''); setFormBgColor(bt.bg_color || '#F3E8FF');
    setFormOrder(String(bt.sort_order || 0)); setFormActive(bt.is_active !== false);
    setShowForm(true);
  };

  const pickImage = async () => {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFormImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return Alert.alert('Error', 'Name is required');
    setSaving(true);
    try {
      const data = {
        name: formName.trim(), icon: formIcon, image: formImage || null,
        provider: formProvider, bg_color: formBgColor,
        sort_order: parseInt(formOrder) || 0, is_active: formActive,
      };
      if (editId) { await adminApi.updateBillType(editId, data); }
      else { await adminApi.createBillType(data); }
      resetForm(); load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await adminApi.deleteBillType(id); load(); } catch (e) { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  return (
    <AdminShell title="Bill Types">
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{types.length} bill type(s)</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add Bill Type</Text>
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} /> : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {types.map((bt) => (
              <View key={bt.id} style={[styles.card, !bt.is_active && { opacity: 0.5 }]}>
                <View style={[styles.iconBox, { backgroundColor: bt.bg_color || '#F3E8FF' }]}>
                  {bt.image ? (
                    <Image source={{ uri: bt.image }} style={styles.btImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name={(bt.icon || 'flash') as any} size={24} color={COLORS.textPrimary} />
                  )}
                </View>
                <View style={styles.btInfo}>
                  <Text style={styles.btName}>{bt.name}</Text>
                  <Text style={styles.btMeta}>{bt.provider} {bt.image ? '· Has image' : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(bt)} style={styles.actionBtn}>
                  <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(bt.id, bt.name)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <Modal visible={showForm} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editId ? 'Edit' : 'New'} Bill Type</Text>
                <TouchableOpacity onPress={resetForm}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="e.g. Electricity (TNB)" placeholderTextColor={COLORS.textMuted} />

                <Text style={styles.fieldLabel}>Provider</Text>
                <TextInput style={styles.input} value={formProvider} onChangeText={setFormProvider} placeholder="e.g. Tenaga Nasional" placeholderTextColor={COLORS.textMuted} />

                <Text style={styles.fieldLabel}>Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                  {formImage ? (
                    <Image source={{ uri: formImage }} style={styles.imagePreview} resizeMode="contain" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={28} color={COLORS.textMuted} />
                      <Text style={styles.imagePlaceholderText}>Tap to upload</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TextInput style={[styles.input, { marginTop: 4 }]} value={formImage} onChangeText={setFormImage}
                  placeholder="Or paste image URL" placeholderTextColor={COLORS.textMuted} />
                {formImage ? (
                  <TouchableOpacity onPress={() => setFormImage('')} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="close-circle" size={14} color={COLORS.error} />
                    <Text style={{ color: COLORS.error, fontSize: 12, marginLeft: 4 }}>Remove</Text>
                  </TouchableOpacity>
                ) : null}

                <Text style={styles.fieldLabel}>Background Color</Text>
                <View style={styles.colorGrid}>
                  {BG_COLORS.map((c) => (
                    <TouchableOpacity key={c} style={[styles.colorOption, { backgroundColor: c }, formBgColor === c && styles.colorSelected]}
                      onPress={() => setFormBgColor(c)} />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Fallback Icon</Text>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((ic) => (
                    <TouchableOpacity key={ic} style={[styles.iconOption, formIcon === ic && styles.iconSelectedStyle]}
                      onPress={() => setFormIcon(ic)}>
                      <Ionicons name={ic as any} size={18} color={formIcon === ic ? COLORS.white : COLORS.textPrimary} />
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Sort Order</Text>
                    <TextInput style={styles.input} value={formOrder} onChangeText={setFormOrder} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Active</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: SPACING.sm }}>
                      <Switch value={formActive} onValueChange={setFormActive} trackColor={{ true: COLORS.primary }} />
                      <Text>{formActive ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{editId ? 'Update' : 'Create'}</Text>}
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btImage: { width: 32, height: 32 },
  btInfo: { flex: 1, marginLeft: SPACING.md },
  btName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  btMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 2 },
  actionBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, width: '100%', maxWidth: 500, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  fieldLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  iconOption: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  iconSelectedStyle: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  colorOption: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: COLORS.primary, borderWidth: 3 },
  imagePickerBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginTop: 4 },
  imagePreview: { width: '100%', height: 80, backgroundColor: '#f5f5f5' },
  imagePlaceholder: { height: 70, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  imagePlaceholderText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 4 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.lg },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.md },
});
