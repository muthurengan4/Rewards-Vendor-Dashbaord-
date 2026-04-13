import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../src/constants/theme';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  operating_hours: string;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  distance?: number;
  distanceText?: string;
}

interface PartnerInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  logo?: string;
  points_multiplier: number;
}

export default function PartnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const getUserLocation = async () => {
    try {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy?.Balanced || 3 });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      return coords;
    } catch (e) {
      console.log('Location not available:', e);
      return null;
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchData = async () => {
    try {
      const [branchRes, locCoords] = await Promise.all([
        api.get(`/partner-branches/${id}`),
        getUserLocation(),
      ]);

      setPartner(branchRes.data.partner);
      let branchList: Branch[] = branchRes.data.branches || [];

      // Calculate distances and sort
      const loc = locCoords || userLocation;
      if (loc) {
        branchList = branchList.map((b) => {
          if (b.lat && b.lng) {
            const dist = calculateDistance(loc.lat, loc.lng, b.lat, b.lng);
            return {
              ...b,
              distance: dist,
              distanceText: dist < 1 ? `${Math.round(dist * 1000)} M AWAY` : `${dist.toFixed(1)} KM AWAY`,
            };
          }
          return { ...b, distance: 9999, distanceText: '' };
        });
        branchList.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
      }

      setBranches(branchList);
    } catch (e: any) {
      console.error('Failed to fetch branches:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const openNavigation = async (branch: Branch) => {
    const destination = branch.lat && branch.lng
      ? `${branch.lat},${branch.lng}`
      : encodeURIComponent(branch.address || branch.name);
    const label = encodeURIComponent(branch.name);

    const googleMapsUrl = branch.lat && branch.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${branch.lat},${branch.lng}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    const googleMapsAppUrl = Platform.select({
      ios: branch.lat && branch.lng
        ? `comgooglemaps://?daddr=${branch.lat},${branch.lng}&directionsmode=driving`
        : `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
      android: branch.lat && branch.lng
        ? `google.navigation:q=${branch.lat},${branch.lng}`
        : `google.navigation:q=${destination}`,
      default: googleMapsUrl,
    });

    const appleMapsUrl = branch.lat && branch.lng
      ? `maps://app?daddr=${branch.lat},${branch.lng}&dirflg=d`
      : `maps://app?daddr=${destination}&dirflg=d`;

    try {
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsAppUrl as string);
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsAppUrl as string);
        return;
      }
      if (Platform.OS === 'ios') {
        const canOpenAppleMaps = await Linking.canOpenURL(appleMapsUrl);
        if (canOpenAppleMaps) {
          await Linking.openURL(appleMapsUrl);
          return;
        }
      }
      await Linking.openURL(googleMapsUrl);
    } catch {
      Linking.openURL(googleMapsUrl).catch(() => {
        Alert.alert('Error', 'Could not open maps.');
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading branches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{partner?.name || 'Branches'}</Text>
          <Text style={styles.headerSubtitle}>{branches.length} location{branches.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>LIST</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Partner Info Banner */}
      {partner && (
        <View style={styles.partnerBanner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="storefront" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerCategory}>{partner.category}</Text>
            {partner.points_multiplier > 1 && (
              <View style={styles.multiplierBadge}>
                <Text style={styles.multiplierText}>{partner.points_multiplier}x Points</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Branches List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[COLORS.primary]} />
        }
      >
        {branches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No branches found</Text>
          </View>
        ) : (
          branches.map((branch, index) => (
            <TouchableOpacity
              key={branch.id || index}
              style={styles.branchCard}
              onPress={() => openNavigation(branch)}
              activeOpacity={0.7}
            >
              <View style={styles.branchContent}>
                <View style={styles.branchHeader}>
                  <Text style={styles.branchName}>{branch.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                </View>
                <Text style={styles.branchAddress}>{branch.address}</Text>
                {branch.operating_hours ? (
                  <Text style={styles.branchHours}>
                    <Text style={styles.hoursLabel}>DAILY </Text>
                    {branch.operating_hours}
                  </Text>
                ) : null}
                {branch.phone ? (
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.branchPhone}>{branch.phone}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.branchActions}>
                {branch.distanceText ? (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>{branch.distanceText}</Text>
                    <Ionicons name="navigate" size={16} color={COLORS.primary} />
                  </View>
                ) : (
                  <TouchableOpacity style={styles.navButton} onPress={() => openNavigation(branch)}>
                    <Ionicons name="navigate" size={22} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
    marginRight: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  partnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '08',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bannerCategory: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  multiplierBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  multiplierText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  branchCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  branchContent: {
    flex: 1,
    padding: SPACING.md,
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  branchName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  branchAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  branchHours: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  hoursLabel: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  branchPhone: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  branchActions: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: SPACING.sm,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
  },
});
