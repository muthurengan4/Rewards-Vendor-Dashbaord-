import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) {}

const REWARD_TYPES = ['free_item', 'discount', 'cashback', 'coupon'];

export default function VendorRewards() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', points_required: '',
    reward_type: 'free_item', value: '', quantity: '-1',
    terms_conditions: '', image: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadRewards(); }, []);

  const loadRewards = async () => {
    try {
      const res = await vendorApi.getRewards();
      setRewards(res.data.rewards || []);
    } catch (e) { console.log('Load rewards error:', e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', points_required: '', reward_type: 'free_item', value: '', quantity: '-1', terms_conditions: '', image: '' });
    setModalVisible(true);
  };

  const openEdit = (reward: any) => {
    setEditingId(reward.id);
    setForm({
      name: reward.name || '',
      description: reward.description || '',
      points_required: String(reward.points_required || ''),
      reward_type: reward.reward_type || 'free_item',
      value: String(reward.value || ''),
      quantity: String(reward.quantity ?? -1),
      terms_conditions: reward.terms_conditions || '',
      image: reward.image || '',
    });
    setModalVisible(true);
  };

  const pickImage = async () => {
    try {
      if (!ImagePicker) {
        Alert.alert('Info', 'Image picker not available. Enter image URL below.');
        return;
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to photo library');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setForm(prev => ({ ...prev, image: base64 }));
      }
    } catch (e) {
      console.log('Image pick error:', e);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.points_required || !form.value) {
      Alert.alert('Error', 'Please fill required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        points_required: parseInt(form.points_required),
        value: parseFloat(form.value),
        quantity: parseInt(form.quantity),
        image: form.image || null,
      };
      if (editingId) {
        await vendorApi.updateReward(editingId, payload);
      } else {
        await vendorApi.createReward(payload);
      }
      setModalVisible(false);
      loadRewards();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await vendorApi.toggleReward(id);
      loadRewards();
    } catch (e) { console.log('Toggle error:', e); }
  };

  const handleDelete = async (id: string) => {
    try {
      await vendorApi.deleteReward(id);
      loadRewards();
    } catch (e) { console.log('Delete error:', e); }
  };

  return (
    <VendorShell title="Rewards Management">
      <View style={styles.topBar}>
        <Text style={styles.count}>{rewards.length} Rewards</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Create Reward</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : rewards.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="gift-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No rewards yet</Text>
          <Text style={styles.emptySubtext}>Create your first reward to get started</Text>
        </View>
      ) : (
        rewards.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{r.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>
              </View>
              <View style={[styles.badge, r.is_active ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, r.is_active ? styles.badgeActiveText : styles.badgeInactiveText]}>
                  {r.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="star" size={14} color={COLORS.primary} />
                <Text style={styles.metaText}>{r.points_required} pts</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="pricetag" size={14} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{r.reward_type}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="cash" size={14} color={COLORS.success} />
                <Text style={styles.metaText}>RM{r.value}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="layers" size={14} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{r.quantity === -1 ? 'Unlimited' : `${r.quantity} left`}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(r)}>
                <Ionicons name="create-outline" size={18} color={COLORS.info} />
                <Text style={[styles.actionText, { color: COLORS.info }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggle(r.id)}>
                <Ionicons name={r.is_active ? 'pause-circle-outline' : 'play-circle-outline'} size={18} color={COLORS.warning} />
                <Text style={[styles.actionText, { color: COLORS.warning }]}>{r.is_active ? 'Pause' : 'Activate'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(r.id)}>
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
              <Text style={styles.modalTitle}>{editingId ? 'Edit Reward' : 'Create Reward'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'name', label: 'Reward Name *', placeholder: 'e.g. Free Teh Tarik' },
                { key: 'description', label: 'Description', placeholder: 'Describe the reward', multiline: true },
                { key: 'points_required', label: 'Points Required *', placeholder: '100', keyboard: 'numeric' },
                { key: 'value', label: 'Value (RM) *', placeholder: '5.00', keyboard: 'numeric' },
                { key: 'quantity', label: 'Quantity (-1 for unlimited)', placeholder: '-1', keyboard: 'numeric' },
                { key: 'terms_conditions', label: 'Terms & Conditions', placeholder: 'T&C details', multiline: true },
              ].map((field) => (
                <View key={field.key} style={styles.formGroup}>
                  <Text style={styles.formLabel}>{field.label}</Text>
                  <TextInput
                    style={[styles.formInput, (field as any).multiline && styles.formTextarea]}
                    value={(form as any)[field.key]}
                    onChangeText={(v) => setForm(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={(field as any).keyboard || 'default'}
                    multiline={(field as any).multiline}
                    numberOfLines={(field as any).multiline ? 3 : 1}
                  />
                </View>
              ))}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reward Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                  {form.image ? (
                    <Image source={{ uri: form.image }} style={styles.imagePreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="camera-outline" size={32} color={COLORS.textMuted} />
                      <Text style={styles.imagePlaceholderText}>Tap to upload image</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {form.image ? (
                  <TouchableOpacity onPress={() => setForm(prev => ({ ...prev, image: '' }))} style={styles.removeImageBtn}>
                    <Ionicons name="close-circle" size={16} color={COLORS.error} />
                    <Text style={{ color: COLORS.error, fontSize: FONT_SIZES.xs, marginLeft: 4 }}>Remove image</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reward Type *</Text>
                <View style={styles.typeWrap}>
                  {REWARD_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, form.reward_type === t && styles.typeChipActive]}
                      onPress={() => setForm(prev => ({ ...prev, reward_type: t }))}
                    >
                      <Text style={[styles.typeText, form.reward_type === t && styles.typeTextActive]}>
                        {t.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : (
                  <Text style={styles.saveBtnText}>{editingId ? 'Update Reward' : 'Create Reward'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardInfo: { flex: 1, marginRight: SPACING.sm },
  cardName: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  cardDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeInactive: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeActiveText: { color: '#166534' },
  badgeInactiveText: { color: '#991B1B' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  cardActions: {
    flexDirection: 'row', gap: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: FONT_SIZES.sm, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, width: '100%', maxWidth: 500, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  formGroup: { marginBottom: SPACING.md },
  formLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  formInput: {
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 46,
    fontSize: FONT_SIZES.md, color: COLORS.textPrimary,
  },
  formTextarea: { height: 80, textAlignVertical: 'top', paddingTop: SPACING.sm },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textTransform: 'capitalize' },
  typeTextActive: { color: COLORS.white, fontWeight: '600' },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 50, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
  imagePickerBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden', marginTop: 4,
  },
  imagePreview: { width: '100%', height: 150, borderRadius: BORDER_RADIUS.lg },
  imagePlaceholder: {
    height: 120, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  imagePlaceholderText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: 6 },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
});
