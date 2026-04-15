import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';
import { COLORS, FONT_SIZES, SPACING } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuthStore();
  const [status, setStatus] = React.useState<'checking' | 'success' | 'failed'>('checking');
  const [pointsAwarded, setPointsAwarded] = React.useState(0);

  useEffect(() => {
    const sessionId = params.session_id as string;
    if (sessionId) {
      pollStatus(sessionId);
    } else {
      setStatus('failed');
    }
  }, []);

  const pollStatus = async (sessionId: string, attempt = 0) => {
    if (attempt >= 10) {
      setStatus('failed');
      return;
    }
    try {
      const res = await api.get(`/stripe/checkout-status/${sessionId}`);
      if (res.data.payment_status === 'paid') {
        setPointsAwarded(res.data.points_awarded);
        setStatus('success');
        await refreshUser();
        setTimeout(() => router.replace('/(tabs)'), 3000);
        return;
      }
      setTimeout(() => pollStatus(sessionId, attempt + 1), 2000);
    } catch {
      setTimeout(() => pollStatus(sessionId, attempt + 1), 2000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'checking' && (
          <>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.title}>Verifying Payment...</Text>
            <Text style={styles.subtitle}>Please wait</Text>
          </>
        )}
        {status === 'success' && (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
            </View>
            <Text style={styles.title}>Payment Successful!</Text>
            <Text style={styles.points}>+{pointsAwarded.toLocaleString()} Points</Text>
            <Text style={styles.subtitle}>Redirecting to home...</Text>
          </>
        )}
        {status === 'failed' && (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="close-circle" size={64} color={COLORS.error} />
            </View>
            <Text style={styles.title}>Payment Issue</Text>
            <Text style={styles.subtitle}>Check your transactions for details</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  iconCircle: { marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.md },
  points: { fontSize: 36, fontWeight: '800', color: COLORS.success, marginTop: SPACING.sm },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, marginTop: SPACING.sm },
});
