import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES, SPACING } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentSuccessScreen() {
  // This page loads inside the in-app browser after Stripe payment.
  // The actual status check & point crediting happens in the app
  // when the user closes this browser window.
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
        </View>
        <Text style={styles.title}>Payment Complete!</Text>
        <Text style={styles.subtitle}>
          Close this window to return to the app.{'\n'}Your points will be credited automatically.
        </Text>
        <View style={styles.hint}>
          <Ionicons name="arrow-up" size={20} color={COLORS.textMuted} />
          <Text style={styles.hintText}>Tap the X button above to close</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  iconCircle: { marginBottom: SPACING.lg },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
  hint: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xxl, gap: 8 },
  hintText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
});
