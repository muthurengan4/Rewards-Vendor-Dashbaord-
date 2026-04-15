import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentCancelScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="close-circle" size={64} color={COLORS.textMuted} />
        </View>
        <Text style={styles.title}>Payment Cancelled</Text>
        <Text style={styles.subtitle}>No charges were made to your card</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/buy-points')}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.linkText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  iconCircle: { marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, marginTop: SPACING.sm, marginBottom: SPACING.xl },
  btn: { backgroundColor: COLORS.primary, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: BORDER_RADIUS.xl },
  btnText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.white },
  linkBtn: { marginTop: SPACING.md },
  linkText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600' },
});
