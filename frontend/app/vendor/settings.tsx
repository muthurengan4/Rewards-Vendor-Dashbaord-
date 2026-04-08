import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import VendorShell from '../../src/components/VendorShell';
import { vendorApi } from '../../src/services/vendorApi';
import { useVendorStore } from '../../src/store/vendorStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function VendorSettings() {
  const { vendor, refreshVendor, logout } = useVendorStore();
  const router = useRouter();
  const [form, setForm] = useState({
    store_name: '', description: '', address: '', phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeImage, setStoreImage] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setForm({
        store_name: vendor.store_name || '',
        description: vendor.description || '',
        address: vendor.address || '',
        phone: vendor.phone || '',
      });
      setStoreImage(vendor.store_image || vendor.logo || null);
    }
  }, [vendor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await vendorApi.updateProfile(form);
      await refreshVendor();
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a store image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        setUploading(true);
        try {
          await vendorApi.uploadStoreImage(base64Data);
          setStoreImage(base64Data);
          await refreshVendor();
          Alert.alert('Success', 'Store image uploaded successfully!');
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || 'Failed to upload image');
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      console.log('Image picker error:', e);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveImage = async () => {
    Alert.alert('Remove Image', 'Are you sure you want to remove the store image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setUploading(true);
          try {
            await vendorApi.uploadStoreImage('');
            setStoreImage(null);
            await refreshVendor();
            Alert.alert('Success', 'Store image removed');
          } catch (e: any) {
            Alert.alert('Error', 'Failed to remove image');
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/vendor/login');
  };

  return (
    <VendorShell title="Settings">
      {/* Store Image Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Image</Text>
        <Text style={styles.sectionSubtext}>This image appears on the map and your store profile</Text>

        <View style={styles.imageContainer}>
          {storeImage ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: storeImage }}
                style={styles.imagePreview}
                contentFit="cover"
              />
              <View style={styles.imageActions}>
                <TouchableOpacity
                  style={styles.imageActionBtn}
                  onPress={handlePickImage}
                  disabled={uploading}
                >
                  <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.imageActionText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageActionBtn, styles.imageActionBtnDanger]}
                  onPress={handleRemoveImage}
                  disabled={uploading}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={[styles.imageActionText, { color: COLORS.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.imagePlaceholder}
              onPress={handlePickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : (
                <>
                  <View style={styles.uploadIconWrap}>
                    <Ionicons name="cloud-upload-outline" size={32} color={COLORS.primary} />
                  </View>
                  <Text style={styles.uploadTitle}>Upload Store Image</Text>
                  <Text style={styles.uploadSubtext}>Tap to select from gallery</Text>
                  <Text style={styles.uploadHint}>Recommended: 16:9 ratio, max 5MB</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {uploading && storeImage && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Store Profile Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Profile</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{vendor?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Wallet ID</Text>
          <Text style={styles.infoValue}>{vendor?.wallet_id}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>{vendor?.category}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <View style={[styles.statusBadge, vendor?.status === 'approved' ? styles.statusApproved : styles.statusPending]}>
            <Text style={styles.statusText}>{vendor?.status}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Points per RM</Text>
          <Text style={styles.infoValue}>{vendor?.points_per_rm || 1}</Text>
        </View>
      </View>

      {/* Edit Profile Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>

        {[
          { key: 'store_name', label: 'Store Name', icon: 'storefront-outline' },
          { key: 'description', label: 'Description', icon: 'document-text-outline' },
          { key: 'address', label: 'Address', icon: 'location-outline' },
          { key: 'phone', label: 'Phone', icon: 'call-outline' },
        ].map((field) => (
          <View key={field.key} style={styles.formGroup}>
            <Text style={styles.formLabel}>{field.label}</Text>
            <View style={styles.formInputWrap}>
              <Ionicons name={field.icon as any} size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.formInput}
                value={(form as any)[field.key]}
                onChangeText={(v) => setForm(prev => ({ ...prev, [field.key]: v }))}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flash" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{vendor?.total_points_issued || 0}</Text>
            <Text style={styles.statLabel}>Total Points Issued</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{vendor?.total_redemptions || 0}</Text>
            <Text style={styles.statLabel}>Total Redemptions</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </VendorShell>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.small,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  sectionSubtext: {
    fontSize: FONT_SIZES.sm, color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  // Image upload
  imageContainer: {
    position: 'relative',
  },
  imagePreviewWrap: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  imageActionBtnDanger: {
    borderColor: COLORS.error,
    backgroundColor: '#FEE2E2',
  },
  imageActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  imagePlaceholder: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  uploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  uploadTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  uploadSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  uploadHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  infoValue: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusApproved: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'capitalize' },
  // Form
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
    height: 50, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
  // Stats
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginVertical: 4 },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, textAlign: 'center' },
  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: BORDER_RADIUS.lg,
    height: 50, marginBottom: SPACING.xl,
  },
  logoutText: { fontSize: FONT_SIZES.md, color: COLORS.error, fontWeight: '700' },
});
