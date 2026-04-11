import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdminStore } from '../../src/store/adminStore';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function AdminLogin() {
  const router = useRouter();
  const { login, setup } = useAdminStore();
  const [isSetup, setIsSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return Alert.alert('Error', 'Fill all fields');
    if (isSetup && !name) return Alert.alert('Error', 'Enter admin name');
    setLoading(true);
    try {
      if (isSetup) {
        await setup(email, password, name);
      } else {
        await login(email, password);
      }
      router.replace('/admin');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inner}>
          <View style={styles.iconWrap}>
            <Image source={require('../../assets/images/3a-icon.jpeg')} style={{ width: 64, height: 64, borderRadius: 32 }} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>{isSetup ? 'Create Super Admin Account' : 'Sign in to continue'}</Text>

          <View style={styles.card}>
            {isSetup && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
                  <TextInput style={styles.input} placeholder="Admin Name" placeholderTextColor={COLORS.textMuted}
                    value={name} onChangeText={setName} />
                </View>
              </View>
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
                <TextInput style={styles.input} placeholder="admin@rewardshub.com" placeholderTextColor={COLORS.textMuted}
                  value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />
                <TextInput style={styles.input} placeholder="Enter password" placeholderTextColor={COLORS.textMuted}
                  value={password} onChangeText={setPassword} secureTextEntry />
              </View>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.btnText}>{isSetup ? 'Create Admin' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => setIsSetup(!isSetup)}>
              <Text style={styles.linkText}>{isSetup ? 'Already have an account? Sign In' : 'First time? Setup Admin Account'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FCE8EB',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.medium,
  },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surfaceLight, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 48,
  },
  input: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
    height: 50, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md,
  },
  btnText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: SPACING.lg },
  linkText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: '500' },
});
