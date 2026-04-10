import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Switch, Image, Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

interface SettingsData {
  [key: string]: any;
}

type SectionKey = 'app' | 'branding' | 'email' | 'stripe' | 'commission' | 'notifications' | 'social' | 'legal';

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    app: true, branding: true, email: false, stripe: false,
    commission: false, notifications: false, social: false, legal: false,
  });
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSettings();
      setSettings(res.data.settings);
      setDirty({});
    } catch (e) {
      console.log('Settings load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const updateField = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(prev => ({ ...prev, [key]: true }));
  };

  const saveSection = async (sectionKey: string, fields: string[]) => {
    const updates: Record<string, any> = {};
    fields.forEach(f => {
      if (dirty[f]) {
        updates[f] = settings[f];
      }
    });

    if (Object.keys(updates).length === 0) {
      Alert.alert('Info', 'No changes to save. Edit a field first.');
      return;
    }

    setSaving(sectionKey);
    try {
      const res = await adminApi.updateSettings(updates);
      setSettings(res.data.settings);
      const clearedDirty = { ...dirty };
      fields.forEach(f => delete clearedDirty[f]);
      setDirty(clearedDirty);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSaving('logo');
        try {
          const res = await adminApi.uploadLogo(base64);
          updateField('brand_logo', res.data.brand_logo);
          Alert.alert('Success', 'Logo uploaded');
        } catch (e) {
          Alert.alert('Error', 'Failed to upload logo');
        } finally {
          setSaving(null);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const testEmail = async () => {
    setSaving('test_email');
    try {
      const res = await adminApi.testEmail();
      Alert.alert('Success', res.data.message);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Email test failed');
    } finally {
      setSaving(null);
    }
  };

  const InputField = ({ label, field, placeholder, secure, keyboardType, multiline }: {
    label: string; field: string; placeholder?: string; secure?: boolean;
    keyboardType?: any; multiline?: boolean;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={String(settings[field] ?? '')}
        onChangeText={(v) => updateField(field, v)}
        placeholder={placeholder || label}
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );

  const NumberField = ({ label, field, placeholder }: {
    label: string; field: string; placeholder?: string;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={String(settings[field] ?? '')}
        onChangeText={(v) => updateField(field, parseFloat(v) || 0)}
        placeholder={placeholder || '0'}
        placeholderTextColor={COLORS.textMuted}
        keyboardType="numeric"
      />
    </View>
  );

  const SwitchField = ({ label, field, description }: {
    label: string; field: string; description?: string;
  }) => (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {description && <Text style={styles.fieldDesc}>{description}</Text>}
      </View>
      <Switch
        value={!!settings[field]}
        onValueChange={(v) => updateField(field, v)}
        trackColor={{ false: '#D1D5DB', true: COLORS.primaryLight }}
        thumbColor={settings[field] ? COLORS.primary : '#F3F4F6'}
      />
    </View>
  );

  const SectionCard = ({ title, icon, sectionKey, children, fields, color }: {
    title: string; icon: string; sectionKey: SectionKey;
    children: React.ReactNode; fields: string[]; color?: string;
  }) => {
    const expanded = expandedSections[sectionKey];
    const hasDirty = fields.some(f => dirty[f]);
    return (
      <View style={styles.sectionCard}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(sectionKey)}>
          <View style={[styles.sectionIconWrap, { backgroundColor: (color || COLORS.primary) + '15' }]}>
            <Ionicons name={icon as any} size={20} color={color || COLORS.primary} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {hasDirty && <View style={styles.dirtyDot} />}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
        {expanded && (
          <View style={styles.sectionBody}>
            {children}
            <TouchableOpacity
              style={[styles.saveBtn, !hasDirty && styles.saveBtnDisabled]}
              onPress={() => saveSection(sectionKey, fields)}
              disabled={saving === sectionKey || !hasDirty}
            >
              {saving === sectionKey ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                  <Text style={styles.saveBtnText}>Save {title}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <AdminShell title="Settings">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Settings">
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>App Configuration</Text>
          <Text style={styles.pageSubtitle}>Manage your application settings, integrations, and branding</Text>
        </View>
      </View>

      {/* App Settings */}
      <SectionCard
        title="App Settings"
        icon="phone-portrait"
        sectionKey="app"
        color="#3B82F6"
        fields={['app_name', 'app_tagline', 'currency_symbol', 'currency_code', 'points_conversion_rate', 'welcome_bonus_points', 'maintenance_mode']}
      >
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="App Name" field="app_name" placeholder="RewardsHub" />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="Tagline" field="app_tagline" placeholder="Your Loyalty, Your Rewards" />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="Currency Symbol" field="currency_symbol" placeholder="RM" />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="Currency Code" field="currency_code" placeholder="MYR" />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <NumberField label="Points per 1 Currency Unit" field="points_conversion_rate" placeholder="100" />
          </View>
          <View style={styles.fieldHalf}>
            <NumberField label="Welcome Bonus Points" field="welcome_bonus_points" placeholder="100" />
          </View>
        </View>
        <SwitchField label="Maintenance Mode" field="maintenance_mode" description="When enabled, the app shows a maintenance page to all users" />
      </SectionCard>

      {/* Branding */}
      <SectionCard
        title="Branding"
        icon="color-palette"
        sectionKey="branding"
        color="#8B5CF6"
        fields={['primary_color', 'secondary_color', 'background_color']}
      >
        <View style={styles.logoSection}>
          <Text style={styles.fieldLabel}>Brand Logo</Text>
          <View style={styles.logoRow}>
            <View style={styles.logoPreview}>
              {settings.brand_logo ? (
                <Image source={{ uri: settings.brand_logo }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.logoPlaceholderText}>No Logo</Text>
                </View>
              )}
            </View>
            <View style={styles.logoActions}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickLogo} disabled={saving === 'logo'}>
                {saving === 'logo' ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color={COLORS.white} />
                    <Text style={styles.uploadBtnText}>Upload Logo</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.uploadHint}>Recommended: 512x512px, PNG or JPG</Text>
            </View>
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldThird}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Primary Color</Text>
              <View style={styles.colorRow}>
                <View style={[styles.colorSwatch, { backgroundColor: settings.primary_color || '#CB4154' }]} />
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={settings.primary_color || ''}
                  onChangeText={(v) => updateField('primary_color', v)}
                  placeholder="#CB4154"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
          </View>
          <View style={styles.fieldThird}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Secondary Color</Text>
              <View style={styles.colorRow}>
                <View style={[styles.colorSwatch, { backgroundColor: settings.secondary_color || '#8B0000' }]} />
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={settings.secondary_color || ''}
                  onChangeText={(v) => updateField('secondary_color', v)}
                  placeholder="#8B0000"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
          </View>
          <View style={styles.fieldThird}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Background Color</Text>
              <View style={styles.colorRow}>
                <View style={[styles.colorSwatch, { backgroundColor: settings.background_color || '#FAF0E6' }]} />
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={settings.background_color || ''}
                  onChangeText={(v) => updateField('background_color', v)}
                  placeholder="#FAF0E6"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
          </View>
        </View>
      </SectionCard>

      {/* Email Configuration */}
      <SectionCard
        title="Email Configuration"
        icon="mail"
        sectionKey="email"
        color="#22C55E"
        fields={['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_use_tls']}
      >
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="SMTP Host" field="smtp_host" placeholder="smtp.gmail.com" />
          </View>
          <View style={styles.fieldHalf}>
            <NumberField label="SMTP Port" field="smtp_port" placeholder="587" />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="SMTP Username" field="smtp_username" placeholder="your@email.com" />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="SMTP Password" field="smtp_password" placeholder="App password" secure />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="From Email" field="smtp_from_email" placeholder="noreply@rewardshub.com" />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="From Name" field="smtp_from_name" placeholder="RewardsHub" />
          </View>
        </View>
        <SwitchField label="Use TLS" field="smtp_use_tls" description="Enable TLS encryption for email delivery" />
        <TouchableOpacity style={styles.testBtn} onPress={testEmail} disabled={saving === 'test_email'}>
          {saving === 'test_email' ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <Ionicons name="send" size={16} color={COLORS.primary} />
              <Text style={styles.testBtnText}>Send Test Email</Text>
            </>
          )}
        </TouchableOpacity>
      </SectionCard>

      {/* Stripe Configuration */}
      <SectionCard
        title="Stripe Integration"
        icon="card"
        sectionKey="stripe"
        color="#6366F1"
        fields={['stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret', 'stripe_currency']}
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color="#6366F1" />
          <Text style={styles.infoText}>
            Get your Stripe API keys from{' '}
            <Text style={styles.infoLink}>dashboard.stripe.com/apikeys</Text>
          </Text>
        </View>
        <InputField label="Publishable Key" field="stripe_publishable_key" placeholder="pk_live_..." />
        <InputField label="Secret Key" field="stripe_secret_key" placeholder="sk_live_..." secure />
        <InputField label="Webhook Secret" field="stripe_webhook_secret" placeholder="whsec_..." secure />
        <InputField label="Currency" field="stripe_currency" placeholder="myr" />
      </SectionCard>

      {/* Commission Settings */}
      <SectionCard
        title="Commission Settings"
        icon="cash"
        sectionKey="commission"
        color="#F59E0B"
        fields={['default_commission_percent', 'min_payout_threshold', 'payout_frequency']}
      >
        <View style={styles.fieldRow}>
          <View style={styles.fieldThird}>
            <NumberField label="Default Commission (%)" field="default_commission_percent" placeholder="10" />
          </View>
          <View style={styles.fieldThird}>
            <NumberField label="Min Payout Threshold (RM)" field="min_payout_threshold" placeholder="100" />
          </View>
          <View style={styles.fieldThird}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Payout Frequency</Text>
              <View style={styles.selectRow}>
                {['weekly', 'biweekly', 'monthly'].map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.selectChip, settings.payout_frequency === freq && styles.selectChipActive]}
                    onPress={() => updateField('payout_frequency', freq)}
                  >
                    <Text style={[styles.selectChipText, settings.payout_frequency === freq && styles.selectChipTextActive]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </SectionCard>

      {/* Notifications */}
      <SectionCard
        title="Notifications"
        icon="notifications"
        sectionKey="notifications"
        color="#EC4899"
        fields={['push_notifications_enabled', 'email_notifications_enabled', 'sms_notifications_enabled']}
      >
        <SwitchField label="Push Notifications" field="push_notifications_enabled" description="Send push notifications to mobile users" />
        <SwitchField label="Email Notifications" field="email_notifications_enabled" description="Send transactional emails (requires email configuration)" />
        <SwitchField label="SMS Notifications" field="sms_notifications_enabled" description="Send SMS alerts (requires SMS provider)" />
      </SectionCard>

      {/* Social Links */}
      <SectionCard
        title="Social & Contact"
        icon="globe"
        sectionKey="social"
        color="#14B8A6"
        fields={['social_facebook', 'social_instagram', 'social_twitter', 'social_website', 'support_email', 'support_phone']}
      >
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="Facebook" field="social_facebook" placeholder="https://facebook.com/..." />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="Instagram" field="social_instagram" placeholder="https://instagram.com/..." />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="Twitter / X" field="social_twitter" placeholder="https://x.com/..." />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="Website" field="social_website" placeholder="https://rewardshub.com" />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <InputField label="Support Email" field="support_email" placeholder="support@rewardshub.com" keyboardType="email-address" />
          </View>
          <View style={styles.fieldHalf}>
            <InputField label="Support Phone" field="support_phone" placeholder="+60 12-345 6789" keyboardType="phone-pad" />
          </View>
        </View>
      </SectionCard>

      {/* Legal */}
      <SectionCard
        title="Legal & Policies"
        icon="document-text"
        sectionKey="legal"
        color="#6B7280"
        fields={['terms_url', 'privacy_url']}
      >
        <InputField label="Terms & Conditions URL" field="terms_url" placeholder="https://rewardshub.com/terms" />
        <InputField label="Privacy Policy URL" field="privacy_url" placeholder="https://rewardshub.com/privacy" />
      </SectionCard>

      <View style={{ height: 40 }} />
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.md, color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  pageHeader: { marginBottom: SPACING.lg },
  pageTitle: { fontSize: FONT_SIZES.xxl, fontWeight: '800', color: COLORS.textPrimary },
  pageSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: 4 },

  // Section Card
  sectionCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md, ...SHADOWS.small, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.sm,
  },
  sectionIconWrap: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { flex: 1, fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 4 },
  sectionBody: {
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING.lg,
  },

  // Fields
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: -2, marginBottom: 4 },
  fieldInput: {
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 44, fontSize: FONT_SIZES.md, color: COLORS.textPrimary,
  },
  fieldRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  fieldHalf: { flex: 1, minWidth: 220 },
  fieldThird: { flex: 1, minWidth: 180 },

  // Switch
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, marginBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  // Logo
  logoSection: { marginBottom: SPACING.md },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, flexWrap: 'wrap' },
  logoPreview: {
    width: 100, height: 100, borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  logoImage: { width: 100, height: 100, borderRadius: BORDER_RADIUS.xl },
  logoPlaceholder: { alignItems: 'center', gap: 4 },
  logoPlaceholderText: { fontSize: 10, color: COLORS.textMuted },
  logoActions: { gap: SPACING.sm },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BORDER_RADIUS.lg,
  },
  uploadBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
  uploadHint: { fontSize: 11, color: COLORS.textMuted },

  // Color
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  colorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },

  // Select chips
  selectRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  selectChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  selectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  selectChipText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '500' },
  selectChipTextActive: { color: COLORS.white },

  // Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#EEF2FF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoText: { fontSize: FONT_SIZES.sm, color: '#4338CA', flex: 1 },
  infoLink: { fontWeight: '700', textDecorationLine: 'underline' },

  // Buttons
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 44, marginTop: SPACING.md,
  },
  saveBtnDisabled: { backgroundColor: '#D1D5DB' },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 40, marginTop: SPACING.sm,
  },
  testBtnText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: '600' },
});
