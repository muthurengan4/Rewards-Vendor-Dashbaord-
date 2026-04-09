import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminShell from '../../src/components/AdminShell';
import { adminApi } from '../../src/services/adminApi';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function AdminVendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (filter) params.status = filter;
      const res = await adminApi.getVendors(params);
      setVendors(res.data.vendors);
      setTotal(res.data.total);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  }, [search, filter]);

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 500); return () => clearTimeout(t); }, [search, filter]);

  const viewVendor = async (id: string) => {
    try {
      const res = await adminApi.getVendor(id);
      setSelectedVendor(res.data);
      setShowModal(true);
    } catch (e) { Alert.alert('Error', 'Failed to load vendor'); }
  };

  const handleAction = async (action: string, id: string) => {
    try {
      if (action === 'approve') await adminApi.approveVendor(id);
      else if (action === 'reject') await adminApi.rejectVendor(id);
      else if (action === 'suspend') await adminApi.suspendVendor(id);
      else if (action === 'activate') await adminApi.activateVendor(id);
      else if (action === 'delete') {
        Alert.alert('Delete Vendor', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => {
            await adminApi.deleteVendor(id); setShowModal(false); load();
          }},
        ]); return;
      }
      Alert.alert('Success', `Vendor ${action}d`);
      load();
      if (showModal && selectedVendor) viewVendor(id);
    } catch (e) { Alert.alert('Error', 'Action failed'); }
  };

  const getStatusColor = (s: string) => {
    switch(s) {
      case 'approved': return '#22C55E';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EF4444';
      case 'suspended': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const FilterBtn = ({ label, value }: { label: string; value: string }) => (
    <TouchableOpacity
      style={[styles.filterBtn, filter === value && styles.filterBtnActive]}
      onPress={() => setFilter(filter === value ? '' : value)}
    >
      <Text style={[styles.filterBtnText, filter === value && styles.filterBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <AdminShell title="Vendor Management">
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search vendors..."
            placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <View style={styles.countBadge}><Text style={styles.countText}>{total} vendors</Text></View>
      </View>

      <View style={styles.filterRow}>
        <FilterBtn label="All" value="" />
        <FilterBtn label="Pending" value="pending" />
        <FilterBtn label="Approved" value="approved" />
        <FilterBtn label="Rejected" value="rejected" />
        <FilterBtn label="Suspended" value="suspended" />
      </View>

      {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : (
        <View style={styles.grid}>
          {vendors.map((v) => (
            <TouchableOpacity key={v.id} style={styles.vendorCard} onPress={() => viewVendor(v.id)}>
              <View style={styles.vendorHeader}>
                <View style={styles.vendorAvatar}>
                  <Ionicons name="storefront" size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vendorName} numberOfLines={1}>{v.store_name}</Text>
                  <Text style={styles.vendorEmail} numberOfLines={1}>{v.email}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(v.status) }]} />
              </View>
              <View style={styles.vendorMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="layers" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metaText}>{v.category}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="flash" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metaText}>{v.total_points_issued || 0} pts issued</Text>
                </View>
              </View>
              <View style={styles.vendorActions}>
                {v.status === 'pending' && (
                  <>
                    <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#22C55E' }]} onPress={() => handleAction('approve', v.id)}>
                      <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      <Text style={styles.actBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleAction('reject', v.id)}>
                      <Ionicons name="close" size={16} color={COLORS.white} />
                      <Text style={styles.actBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
                {v.status === 'approved' && (
                  <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleAction('suspend', v.id)}>
                    <Ionicons name="pause" size={16} color={COLORS.white} />
                    <Text style={styles.actBtnText}>Suspend</Text>
                  </TouchableOpacity>
                )}
                {(v.status === 'suspended' || v.status === 'rejected') && (
                  <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#22C55E' }]} onPress={() => handleAction('activate', v.id)}>
                    <Ionicons name="play" size={16} color={COLORS.white} />
                    <Text style={styles.actBtnText}>Activate</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
          {vendors.length === 0 && <Text style={styles.empty}>No vendors found</Text>}
        </View>
      )}

      {/* Vendor Detail Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedVendor?.store_name || 'Vendor'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {selectedVendor && (
              <View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Email</Text><Text style={styles.detailValue}>{selectedVendor.email}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Category</Text><Text style={styles.detailValue}>{selectedVendor.category}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={[styles.detailValue, { color: getStatusColor(selectedVendor.status) }]}>{selectedVendor.status}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Address</Text><Text style={styles.detailValue}>{selectedVendor.address || '-'}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Phone</Text><Text style={styles.detailValue}>{selectedVendor.phone || '-'}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Points Issued</Text><Text style={[styles.detailValue, { color: COLORS.primary }]}>{(selectedVendor.total_points_issued || 0).toLocaleString()}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Redemptions</Text><Text style={styles.detailValue}>{selectedVendor.total_redemptions || 0}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Wallet</Text><Text style={styles.detailValue}>{selectedVendor.wallet_id}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Joined</Text><Text style={styles.detailValue}>{selectedVendor.created_at ? new Date(selectedVendor.created_at).toLocaleDateString() : '-'}</Text></View>

                {selectedVendor.rewards?.length > 0 && (
                  <View style={{ marginTop: SPACING.md }}>
                    <Text style={styles.subTitle}>Rewards ({selectedVendor.rewards.length})</Text>
                    {selectedVendor.rewards.slice(0, 5).map((r: any, i: number) => (
                      <Text key={i} style={styles.listItem}>  {r.name} - {r.points_required} pts</Text>
                    ))}
                  </View>
                )}

                <View style={[styles.modalActions, { marginTop: SPACING.lg }]}>
                  {selectedVendor.status === 'pending' && (
                    <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#22C55E' }]} onPress={() => { handleAction('approve', selectedVendor.id); setShowModal(false); }}>
                      <Text style={styles.actBtnText}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleAction('delete', selectedVendor.id)}>
                    <Ionicons name="trash" size={16} color={COLORS.white} />
                    <Text style={styles.actBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 44 },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  countBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.lg },
  countText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBtnText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterBtnTextActive: { color: COLORS.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  vendorCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, minWidth: 280, flex: 1, ...SHADOWS.small },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  vendorAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FCE8EB', justifyContent: 'center', alignItems: 'center' },
  vendorName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
  vendorEmail: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  vendorMeta: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  vendorActions: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BORDER_RADIUS.md },
  actBtnText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  empty: { textAlign: 'center', padding: SPACING.xl, color: COLORS.textMuted, fontSize: FONT_SIZES.md, width: '100%' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xxl, padding: SPACING.xl, width: '100%', maxWidth: 500, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  detailValue: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  subTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  listItem: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, paddingVertical: 2 },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
});
