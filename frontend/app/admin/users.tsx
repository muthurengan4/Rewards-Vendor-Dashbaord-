import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      const res = await adminApi.getUsers(params);
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 500); return () => clearTimeout(t); }, [search]);

  const viewUser = async (userId: string) => {
    try {
      const res = await adminApi.getUser(userId);
      setSelectedUser(res.data);
      setShowModal(true);
    } catch (e) { Alert.alert('Error', 'Failed to load user'); }
  };

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    try {
      if (isBlocked) await adminApi.unblockUser(userId);
      else await adminApi.blockUser(userId);
      load();
      if (selectedUser) viewUser(userId);
      Alert.alert('Success', isBlocked ? 'User unblocked' : 'User blocked');
    } catch (e) { Alert.alert('Error', 'Action failed'); }
  };

  const deleteUser = (userId: string) => {
    Alert.alert('Delete User', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await adminApi.deleteUser(userId); setShowModal(false); load(); } catch (e) { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const handleAdjustPoints = async () => {
    if (!adjustAmount || !selectedUser) return;
    try {
      await adminApi.adjustPoints(selectedUser.id, parseInt(adjustAmount), adjustReason || 'Admin adjustment');
      setShowAdjust(false); setAdjustAmount(''); setAdjustReason('');
      viewUser(selectedUser.id); load();
      Alert.alert('Success', 'Points adjusted');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  return (
    <AdminShell title="User Management">
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search users by name or email..."
            placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <View style={styles.countBadge}><Text style={styles.countText}>{total} users</Text></View>
      </View>

      {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : (
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>User</Text>
            <Text style={[styles.th, { flex: 1 }]}>Points</Text>
            <Text style={[styles.th, { flex: 1 }]}>Status</Text>
            <Text style={[styles.th, { flex: 1 }]}>Actions</Text>
          </View>
          {users.map((u) => (
            <View key={u.id} style={styles.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </View>
              <Text style={[styles.td, { flex: 1, fontWeight: '700', color: COLORS.primary }]}>{(u.points_balance || 0).toLocaleString()}</Text>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, u.is_blocked ? styles.statusBlocked : styles.statusActive]}>
                  <Text style={styles.statusText}>{u.is_blocked ? 'Blocked' : 'Active'}</Text>
                </View>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => viewUser(u.id)} style={styles.actionBtn}>
                  <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleBlock(u.id, u.is_blocked)} style={styles.actionBtn}>
                  <Ionicons name={u.is_blocked ? 'lock-open-outline' : 'ban-outline'} size={18} color={u.is_blocked ? '#22C55E' : '#EF4444'} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {users.length === 0 && <Text style={styles.empty}>No users found</Text>}
        </View>
      )}

      {/* User Detail Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedUser?.name || 'User'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {selectedUser && (
              <View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Email</Text><Text style={styles.detailValue}>{selectedUser.email}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Points</Text><Text style={[styles.detailValue, { color: COLORS.primary, fontWeight: '800' }]}>{(selectedUser.points_balance || 0).toLocaleString()}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Total Earned</Text><Text style={styles.detailValue}>{(selectedUser.total_points_earned || 0).toLocaleString()}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>QR Code</Text><Text style={styles.detailValue}>{selectedUser.qr_code}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={styles.detailValue}>{selectedUser.is_blocked ? 'Blocked' : 'Active'}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Joined</Text><Text style={styles.detailValue}>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : '-'}</Text></View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#3B82F6' }]} onPress={() => setShowAdjust(!showAdjust)}>
                    <Ionicons name="add-circle" size={18} color={COLORS.white} />
                    <Text style={styles.modalBtnText}>Adjust Points</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: selectedUser.is_blocked ? '#22C55E' : '#F59E0B' }]} onPress={() => toggleBlock(selectedUser.id, selectedUser.is_blocked)}>
                    <Ionicons name={selectedUser.is_blocked ? 'lock-open' : 'ban'} size={18} color={COLORS.white} />
                    <Text style={styles.modalBtnText}>{selectedUser.is_blocked ? 'Unblock' : 'Block'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#EF4444' }]} onPress={() => deleteUser(selectedUser.id)}>
                    <Ionicons name="trash" size={18} color={COLORS.white} />
                    <Text style={styles.modalBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>

                {showAdjust && (
                  <View style={styles.adjustBox}>
                    <TextInput style={styles.adjustInput} placeholder="Amount (+ or -)" placeholderTextColor={COLORS.textMuted}
                      value={adjustAmount} onChangeText={setAdjustAmount} keyboardType="numeric" />
                    <TextInput style={styles.adjustInput} placeholder="Reason" placeholderTextColor={COLORS.textMuted}
                      value={adjustReason} onChangeText={setAdjustReason} />
                    <TouchableOpacity style={styles.adjustBtn} onPress={handleAdjustPoints}>
                      <Text style={styles.adjustBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Transaction history */}
                {selectedUser.transactions?.length > 0 && (
                  <View style={styles.historySection}>
                    <Text style={styles.historyTitle}>Recent Transactions</Text>
                    {selectedUser.transactions.slice(0, 5).map((t: any, i: number) => (
                      <View key={i} style={styles.historyRow}>
                        <Text style={styles.historyDesc}>{t.description || t.type}</Text>
                        <Text style={[styles.historyPts, { color: t.amount > 0 ? '#22C55E' : '#EF4444' }]}>{t.amount > 0 ? '+' : ''}{t.amount}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  countBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.lg },
  countText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  table: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.small, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F9FAFB', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  th: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  td: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  userName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  userEmail: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusBlocked: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  actionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', padding: SPACING.xl, color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xxl, padding: SPACING.xl, width: '100%', maxWidth: 500, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  detailValue: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg, flexWrap: 'wrap' },
  modalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: BORDER_RADIUS.lg },
  modalBtnText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  adjustBox: { marginTop: SPACING.md, gap: SPACING.sm, backgroundColor: '#F9FAFB', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg },
  adjustInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  adjustBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
  adjustBtnText: { color: COLORS.white, fontWeight: '700' },
  historySection: { marginTop: SPACING.lg },
  historyTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  historyDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1 },
  historyPts: { fontSize: FONT_SIZES.sm, fontWeight: '700' },
});
