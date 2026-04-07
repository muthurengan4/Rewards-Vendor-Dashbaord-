import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../../src/store/vendorStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

const CATEGORIES = ['Malaysian Food', 'Coffee', 'Grocery', 'Fuel', 'Health & Beauty', 'Travel', 'Transport', 'Other'];

export default function VendorRegister() {
  const [form, setForm] = useState({
    email: '', password: '', store_name: '', category: 'Malaysian Food',
    description: '', address: '', phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useVendorStore();
  const router = useRouter();

  const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.store_name || !form.address || !form.phone) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(form);
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Register Your Store</Text>
            <Text style={styles.subtitle}>Join RewardsHub partner network</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {[
            { key: 'store_name', label: 'Store Name *', icon: 'storefront-outline', placeholder: 'Your store name' },
            { key: 'email', label: 'Email *', icon: 'mail-outline', placeholder: 'vendor@store.com', keyboard: 'email-address' },
            { key: 'password', label: 'Password *', icon: 'lock-closed-outline', placeholder: 'Min 6 characters', secure: true },
            { key: 'phone', label: 'Phone *', icon: 'call-outline', placeholder: '+60123456789', keyboard: 'phone-pad' },
            { key: 'address', label: 'Address *', icon: 'location-outline', placeholder: 'Store address' },
            { key: 'description', label: 'Description', icon: 'document-text-outline', placeholder: 'Tell us about your store' },
          ].map((field) => (
            <View key={field.key} style={styles.inputGroup}>
              <Text style={styles.label}>{field.label}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name={field.icon as any} size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={(form as any)[field.key]}
                  onChangeText={(v) => updateField(field.key, v)}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={(field as any).keyboard || 'default'}
                  secureTextEntry={(field as any).secure || false}
                  autoCapitalize={field.key === 'email' ? 'none' : 'sentences'}
                />
              </View>
            </View>
          ))}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.catWrap}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, form.category === cat && styles.catChipActive]}
                  onPress={() => updateField('category', cat)}
                >
                  <Text style={[styles.catText, form.category === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.registerBtnText}>Register Store</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/vendor/login')}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  card: {
    width: '100%', maxWidth: 500, backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.large,
  },
  header: { marginBottom: SPACING.lg },
  backBtn: { marginBottom: SPACING.sm },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2',
    padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md, gap: 8,
  },
  errorText: { color: COLORS.error, fontSize: FONT_SIZES.sm, flex: 1 },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  catTextActive: { color: COLORS.white, fontWeight: '600' },
  registerBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 52, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md,
  },
  registerBtnText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: SPACING.lg },
  loginLinkText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  loginBold: { color: COLORS.primary, fontWeight: '700' },
});
