import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface Partner {
  id: string;
  name: string;
  logo?: string;
  description: string;
  category: string;
  address: string;
  points_multiplier: number;
  lat?: number | null;
  lng?: number | null;
}

// Component to handle partner image with fallback
const PartnerImage = ({ 
  logo, 
  category, 
  getCategoryIcon, 
  getCategoryColor 
}: { 
  logo?: string; 
  category: string;
  getCategoryIcon: (cat: string) => string;
  getCategoryColor: (cat: string) => string;
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  if (!logo || imageError) {
    return (
      <View
        style={[
          styles.partnerIcon,
          { backgroundColor: getCategoryColor(category) + '20' },
        ]}
      >
        <Ionicons
          name={getCategoryIcon(category) as any}
          size={24}
          color={getCategoryColor(category)}
        />
      </View>
    );
  }
  
  return (
    <View style={styles.partnerImageContainer}>
      {imageLoading && (
        <View style={[styles.partnerIcon, { position: 'absolute', backgroundColor: getCategoryColor(category) + '20' }]}>
          <Ionicons
            name={getCategoryIcon(category) as any}
            size={24}
            color={getCategoryColor(category)}
          />
        </View>
      )}
      <Image
        source={{ uri: logo }}
        style={styles.partnerImage}
        contentFit="cover"
        transition={300}
        onError={() => setImageError(true)}
        onLoad={() => setImageLoading(false)}
        cachePolicy="memory-disk"
      />
    </View>
  );
};

export default function PartnersScreen() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (e) {
      console.log('Location error:', e);
    }
  };

  const calculateDistance = (partnerLat: number, partnerLng: number): string => {
    if (!userLocation) return '';
    const R = 6371;
    const dLat = ((partnerLat - userLocation.lat) * Math.PI) / 180;
    const dLon = ((partnerLng - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((partnerLat * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  const openNavigation = (partner: Partner) => {
    if (!partner.lat || !partner.lng) {
      Alert.alert('Navigation', `Navigate to ${partner.name} at ${partner.address}`);
      return;
    }
    const lat = partner.lat;
    const lng = partner.lng;
    const label = encodeURIComponent(partner.name);
    const scheme = Platform.select({
      ios: `maps:0,0?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`,
    });
    Linking.openURL(scheme as string).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const fetchPartners = async () => {
    try {
      setError(null);
      const res = await api.get('/partners');
      setPartners(res.data.partners || []);
      setCategories(['All', ...(res.data.categories || [])]);
    } catch (err: any) {
      console.error('Error fetching partners:', err);
      setError(err.message || 'Failed to load partners. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    try {
      await api.post('/seed');
      await fetchPartners();
    } catch (error) {
      console.error('Error seeding data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPartners();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPartners();
    getUserLocation();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & beverage': return 'restaurant';
      case 'malaysian food': return 'restaurant';
      case 'coffee': return 'cafe';
      case 'shopping': return 'bag';
      case 'fuel': return 'car';
      case 'grocery': return 'cart';
      case 'travel': return 'airplane';
      case 'transport': return 'car-sport';
      case 'health & beauty': return 'medkit';
      default: return 'storefront';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & beverage': return '#F59E0B';
      case 'malaysian food': return '#DC2626';
      case 'coffee': return '#7C3AED';
      case 'shopping': return '#EC4899';
      case 'fuel': return '#10B981';
      case 'grocery': return '#8B5CF6';
      case 'travel': return '#3B82F6';
      case 'transport': return '#06B6D4';
      case 'health & beauty': return '#F472B6';
      default: return COLORS.primary;
    }
  };

  const filteredPartners = partners.filter((partner) => {
    const matchesCategory = selectedCategory === 'All' || partner.category === selectedCategory;
    const matchesSearch = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Partner Stores</Text>
          <Text style={styles.subtitle}>Earn points at {partners.length}+ locations</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search partners..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              {cat !== 'All' && (
                <Ionicons
                  name={getCategoryIcon(cat) as any}
                  size={16}
                  color={selectedCategory === cat ? COLORS.blueDark : COLORS.textSecondary}
                />
              )}
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Error State */}
        {error && !loading && (
          <Card style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.primary} />
            <Text style={styles.emptyText}>Connection Error</Text>
            <Text style={styles.emptySubtext}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchPartners(); }}>
              <Ionicons name="refresh" size={18} color={COLORS.white} />
              <Text style={styles.retryText}>Tap to Retry</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Seed Data Button (if no partners) */}
        {partners.length === 0 && !loading && !error && (
          <TouchableOpacity style={styles.seedButton} onPress={seedData}>
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.seedText}>Load Sample Partners</Text>
          </TouchableOpacity>
        )}

        {/* Partners List */}
        <View style={styles.partnersContainer}>
          {filteredPartners.length > 0 ? (
            filteredPartners.map((partner) => (
              <Card key={partner.id} style={styles.partnerCard}>
                <View style={styles.partnerRow}>
                  <PartnerImage
                    logo={partner.logo}
                    category={partner.category}
                    getCategoryIcon={getCategoryIcon}
                    getCategoryColor={getCategoryColor}
                  />
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>{partner.name}</Text>
                    <Text style={styles.partnerCategory}>{partner.category}</Text>
                    <View style={styles.partnerMeta}>
                      <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                      <Text style={styles.partnerAddress} numberOfLines={1}>
                        {partner.address}
                      </Text>
                    </View>
                  </View>
                  {partner.points_multiplier > 1 && (
                    <View style={styles.multiplierBadge}>
                      <Text style={styles.multiplierText}>
                        {partner.points_multiplier}x
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.partnerDesc} numberOfLines={2}>
                  {partner.description}
                </Text>
                {/* Navigation Row */}
                <View style={styles.navRow}>
                  {userLocation && partner.lat && partner.lng ? (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.distanceText}>{calculateDistance(partner.lat, partner.lng)} away</Text>
                    </View>
                  ) : (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                      <Text style={[styles.distanceText, { color: COLORS.textMuted }]}>{partner.address}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.navigateBtn} onPress={() => openNavigation(partner)}>
                    <Ionicons name="navigate" size={16} color={COLORS.white} />
                    <Text style={styles.navigateBtnText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="storefront-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No partners found' : 'No partners available'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term' : 'Check back soon for new partners!'}
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    paddingVertical: SPACING.md,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
    gap: SPACING.xs,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  seedText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  partnersContainer: {
    paddingHorizontal: SPACING.md,
  },
  partnerCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  partnerIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerImageContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  partnerImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceDark,
  },
  partnerInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  partnerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  partnerCategory: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerAddress: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    flex: 1,
  },
  multiplierBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  multiplierText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  partnerDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  distanceText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
  },
  navigateBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xxl,
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
});
