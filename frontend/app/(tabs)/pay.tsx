import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, CURRENCY } from '../../src/constants/theme';

interface BillType {
  id: string;
  name: string;
  icon: string;
  provider: string;
}

export default function PayScreen() {
  const { user, refreshUser } = useAuthStore();
  const [billTypes, setBillTypes] = useState<BillType[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillType | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBillTypes();
  }, []);

  const fetchBillTypes = async () => {
    try {
      const res = await api.get('/bills/types');
      setBillTypes(res.data.bill_types);
    } catch (error) {
      console.error('Error fetching bill types:', error);
      // Use default bill types if API fails
      setBillTypes([
        { id: 'electricity', name: 'Electricity (TNB)', icon: 'flash', provider: 'Tenaga Nasional Berhad' },
        { id: 'water', name: 'Water Bill', icon: 'water', provider: 'Air Selangor / SYABAS' },
        { id: 'phone', name: 'Phone Bill', icon: 'call', provider: 'Maxis / Digi / Celcom / U Mobile' },
        { id: 'internet', name: 'Internet / WiFi', icon: 'wifi', provider: 'TM / Maxis / Time' },
        { id: 'fuel', name: 'Fuel (Petrol)', icon: 'car', provider: 'Petronas / Shell / Petron' },
        { id: 'rent', name: 'House Rent', icon: 'home', provider: 'Property Owner' },
        { id: 'astro', name: 'Astro TV', icon: 'tv', provider: 'Astro Malaysia' },
        { id: 'insurance', name: 'Insurance', icon: 'shield-checkmark', provider: 'Various Providers' },
      ]);
    }
  };

  const handleBillSelect = (bill: BillType) => {
    setSelectedBill(bill);
    setAccountNumber('');
    setAmount('');
    setShowBillModal(true);
  };

  const handlePayBill = async () => {
    if (!selectedBill || !accountNumber || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const pointsRequired = Math.ceil(amountNum * 100);
    if (!user || user.points_balance < pointsRequired) {
      Alert.alert('Insufficient Points', `You need ${pointsRequired} points to pay RM${amountNum}. You have ${user?.points_balance || 0} points.`);
      return;
    }

    Alert.alert(
      'Confirm Payment',
      `Pay ${selectedBill.name}\nAccount: ${accountNumber}\nAmount: RM${amountNum}\nPoints: ${pointsRequired}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay',
          onPress: async () => {
            setLoading(true);
            try {
              await api.post('/bills/pay', {
                bill_type: selectedBill.id,
                account_number: accountNumber,
                amount: amountNum,
                provider: selectedBill.provider,
              });
              await refreshUser();
              Alert.alert('Success!', `${selectedBill.name} paid successfully!`);
              setShowBillModal(false);
              setAccountNumber('');
              setAmount('');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Payment failed');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleTransfer = async () => {
    if (!recipientPhone || !recipientName || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const pointsRequired = Math.ceil(amountNum * 100);
    if (!user || user.points_balance < pointsRequired) {
      Alert.alert('Insufficient Points', `You need ${pointsRequired} points to transfer RM${amountNum}. You have ${user?.points_balance || 0} points.`);
      return;
    }

    Alert.alert(
      'Confirm Transfer',
      `Send RM${amountNum} to ${recipientName} (${recipientPhone})?\nPoints: ${pointsRequired}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            setLoading(true);
            try {
              await api.post('/transfer', {
                recipient_phone: recipientPhone,
                recipient_name: recipientName,
                amount: amountNum,
                note: transferNote || undefined,
              });
              await refreshUser();
              Alert.alert('Success!', `RM${amountNum} sent to ${recipientName}!`);
              setShowTransferModal(false);
              setRecipientPhone('');
              setRecipientName('');
              setAmount('');
              setTransferNote('');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Transfer failed');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getIconColor = (billId: string) => {
    switch (billId) {
      case 'electricity': return '#F59E0B';
      case 'water': return '#3B82F6';
      case 'phone': return '#10B981';
      case 'internet': return '#8B5CF6';
      case 'fuel': return '#EF4444';
      case 'rent': return '#EC4899';
      case 'astro': return '#6366F1';
      case 'insurance': return '#14B8A6';
      default: return COLORS.primary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pay & Transfer</Text>
          <Text style={styles.subtitle}>Use your points to pay bills or send money</Text>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <ImageBackground
            source={require('../../assets/images/blankcard.png')}
            style={styles.balanceCardBg}
            imageStyle={styles.balanceCardBgImage}
            resizeMode="cover"
          >
            <View style={styles.balanceRow}>
              {/* ✅ LOGO (TOP RIGHT) */}
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../../assets/images/applogo.png')}
                  style={styles.topRightLogo}
                  resizeMode="contain"
                />
              </View>
              {/* ✅ LOGO (TOP RIGHT) */}
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../../assets/images/applogo.png')}
                  style={styles.topRightLogo}
                  resizeMode="contain"
                />
              </View>
              {/* ✅ CONTENT */}
              <View style={styles.cardContent}>
                <Text style={styles.balanceLabel}>Total Points</Text>

                <Text style={styles.balanceAmount}>
                  {user?.points_balance?.toLocaleString() || '0'}
                </Text>

                <View style={styles.balanceStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="arrow-up-circle" size={14} color="#fff" />
                    <Text style={styles.statText}>
                      {user?.total_earned?.toLocaleString() || '0'} earned
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Ionicons name="arrow-down-circle" size={14} color="#fff" />
                    <Text style={styles.statText}>
                      {user?.total_redeemed?.toLocaleString() || '0'} redeemed
                    </Text>
                  </View>
                </View>
              </View>
              {/* <View style={styles.conversionInfo}>
                <Text style={styles.conversionText}>100 pts = RM1</Text>
              </View> */}
            </View>
          </ImageBackground>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              setAmount('');
              setShowTransferModal(true);
            }}
          >
            <View style={[styles.quickActionIcon]}>
              <Image source={require('../../assets/images/sendmoney.png')} style={{ width: 90, height: 90 }} resizeMode="contain" />
            </View>
            <Text style={styles.quickActionText}>Send Money</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon]}>
              <Image source={require('../../assets/images/requests.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
            </View>
            <Text style={styles.quickActionText}>Request</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon]}>
              <Image source={require('../../assets/images/scanlogo.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
            </View>
            <Text style={styles.quickActionText}>Scan & Pay</Text>
          </TouchableOpacity>
        </View>

        {/* Bill Payment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pay Bills</Text>
          <View style={styles.billGrid}>
            {billTypes.map((bill) => (
              <TouchableOpacity
                key={bill.id}
                style={styles.billItem}
                onPress={() => handleBillSelect(bill)}
              >
                <View style={[styles.billIcon]}>
                  {bill.image ? (
                    <Image source={{ uri: bill.image }} style={{ width: 60, height: 60 }} resizeMode="contain" />
                  ) : (
                    <Ionicons name={bill.icon as any} size={24} color={getIconColor(bill.id)} />
                  )}
                </View>
                <Text style={styles.billName} numberOfLines={2}>{bill.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Payments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <Card style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No recent payments</Text>
            <Text style={styles.emptySubtext}>Your payment history will appear here</Text>
          </Card>
        </View>
      </ScrollView>

      {/* Bill Payment Modal */}
      <Modal
        visible={showBillModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBillModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedBill?.name}</Text>
              <TouchableOpacity onPress={() => setShowBillModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>{selectedBill?.provider}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                placeholderTextColor={COLORS.textMuted}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="default"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (RM)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              {amount && !isNaN(parseFloat(amount)) && (
                <Text style={styles.pointsPreview}>
                  Points required: {Math.ceil(parseFloat(amount) * 100).toLocaleString()}
                </Text>
              )}
            </View>

            <Button
              title={loading ? "Processing..." : "Pay Now"}
              onPress={handlePayBill}
              loading={loading}
              size="large"
              style={styles.modalButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        visible={showTransferModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTransferModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Money</Text>
              <TouchableOpacity onPress={() => setShowTransferModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Recipient Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+60 12-345 6789"
                placeholderTextColor={COLORS.textMuted}
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Recipient Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter recipient name"
                placeholderTextColor={COLORS.textMuted}
                value={recipientName}
                onChangeText={setRecipientName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (RM)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              {amount && !isNaN(parseFloat(amount)) && (
                <Text style={styles.pointsPreview}>
                  Points required: {Math.ceil(parseFloat(amount) * 100).toLocaleString()}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Add a note"
                placeholderTextColor={COLORS.textMuted}
                value={transferNote}
                onChangeText={setTransferNote}
              />
            </View>

            <Button
              title={loading ? "Processing..." : "Send Money"}
              onPress={handleTransfer}
              loading={loading}
              size="large"
              style={styles.modalButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  header: {
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  balanceCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    // backgroundColor: COLORS.primary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 40,
    alignItems: 'center',
  },
  // balanceLabel: {
  //   fontSize: FONT_SIZES.sm,
  //   color: COLORS.white,
  //   opacity: 0.8,
  // },

  // balanceAmount: {
  //   fontSize: FONT_SIZES.xxxl,
  //   fontWeight: 'bold',
  //   color: COLORS.white,
  // },
  balanceEquiv: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    opacity: 0.9,
  },
  conversionInfo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  conversionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.lg,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    // borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  quickActionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  billGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  billItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: SPACING.md, //
  },
  billIcon: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  billName: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pointsPreview: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  modalButton: {
    marginTop: SPACING.md,
  },
  balanceCardBgImage: {
    borderRadius: BORDER_RADIUS.xl,
  },
  balanceCardBg: {
    width: '107%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -20,
  },
  topRightLogo: {
    position: 'absolute',
    top: -190,
    right: -318,
    width: 230,
    height: 230,
    zIndex: 10,
  },
  cardContent: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  balanceLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
balanceAmount: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  balanceStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  statText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
});
