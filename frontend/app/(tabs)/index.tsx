import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  useWindowDimensions,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

// Cross-platform map component
const MiniMapView = ({ html, style }: { html: string; style: any }) => {
  if (Platform.OS === 'web') {
    // On web, use dangerouslySetInnerHTML with a div
    return React.createElement('iframe', {
      srcDoc: html,
      style: { width: '100%', height: '100%', border: 'none' },
    });
  }
  const { WebView } = require('react-native-webview');
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      scrollEnabled={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
};

interface Transaction {
  id: string;
  type: string;
  points: number;
  description: string;
  partner_name?: string;
  created_at: string;
}

const CAT_STYLE = { color: '#D61F26', bg: '#FDEAEA' };

const MINI_MAP_HTML = `
<!DOCTYPE html>
<html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }
    .marker-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    .user-dot { width: 12px; height: 12px; background: #3B82F6; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 3px rgba(59,130,246,0.3); }
  </style>
</head><body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false }).setView([3.1390, 101.6869], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var userIcon = L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    L.marker([3.1390, 101.6869], { icon: userIcon }).addTo(map);
    var colors = { 'Dining': '#EF4444', 'Coffee': '#92400E', 'Grocery': '#22C55E', 'Fuel': '#F59E0B', 'Health & Beauty': '#EC4899', 'Travel': '#3B82F6', 'Transport': '#8B5CF6' };
    var pts = [[3.1488,101.713,'Dining'],[3.1180,101.6775,'Dining'],[3.1310,101.6698,'Dining'],[3.1578,101.7119,'Dining'],[3.1504,101.6155,'Dining'],[3.0731,101.6072,'Dining'],[3.1363,101.630,'Dining'],[3.1465,101.7105,'Coffee'],[3.1580,101.712,'Coffee'],[3.1490,101.7137,'Coffee'],[3.1185,101.677,'Coffee'],[3.1113,101.666,'Coffee'],[3.1525,101.7115,'Coffee'],[3.1340,101.6862,'Coffee'],[3.1420,101.699,'Coffee'],[3.0733,101.5185,'Grocery'],[3.1301,101.6717,'Grocery'],[3.1565,101.614,'Grocery'],[3.159,101.7228,'Fuel'],[3.1516,101.7068,'Fuel'],[3.16,101.718,'Fuel'],[3.1575,101.7117,'Health & Beauty'],[3.4236,101.7933,'Travel'],[3.139,101.6869,'Transport']];
    pts.forEach(function(p) {
      var c = colors[p[2]] || '#D61F26';
      var icon = L.divIcon({ className: '', html: '<div class="marker-dot" style="background:'+c+'"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
      L.marker([p[0], p[1]], { icon: icon }).addTo(map);
    });
  </script>
</body></html>`;

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  const fetchData = async () => {
    try {
      // Fetch categories independently (public endpoint)
      const catRes = await api.get('/categories/public').catch(() => ({ data: { categories: [] } }));
      setCategories(catRes.data.categories || []);
    } catch (e) {
      console.log('Category fetch error:', e);
    }
    try {
      const txnRes = await api.get('/wallet/transactions?limit=5');
      setTransactions(txnRes.data.transactions || []);
    } catch (e) {
      console.log('Transaction fetch error (may not be logged in):', e);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshUser()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDemoEarn = async () => {
    try {
      await api.post('/earn/demo');
      await onRefresh();
      Alert.alert('Success!', 'You earned 50 demo points!');
    } catch (error) {
      Alert.alert('Error', 'Failed to earn demo points');
    }
  };

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
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.headerLogoContainer}>
            <Image
              source={require('../../assets/images/3a-red-logo.jpeg')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Map Preview */}
        <TouchableOpacity
          style={styles.mapPreview}
          activeOpacity={0.9}
          onPress={() => router.push('/map')}
        >
          <View style={styles.mapContainer}>
            <MiniMapView html={MINI_MAP_HTML} style={styles.miniMap} />
            <View style={styles.mapOverlay}>
              <View style={styles.mapOverlayContent}>
                <Ionicons name="map" size={18} color={COLORS.white} />
                <Text style={styles.mapOverlayText}>Explore nearby partners</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Points Balance Card */}
        <View style={styles.balanceCardWrapper}>
                                  <ImageBackground
                          source={require('../../assets/images/blankcard.png')}
                          style={styles.balanceCardBg}
                          imageStyle={styles.balanceCardBgImage}
                          resizeMode="cover"
                        >
                        
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
                        
                        </ImageBackground>
                                </View>

        {/* Explore Neighborhood */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explore member benefits</Text>
            <TouchableOpacity onPress={() => router.push('/map')}>
              <Text style={styles.seeAll}>View Map</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>in your neighborhood</Text>

          <View style={styles.categoryGrid}>
            {categories.map((cat) => {
              const catName = cat.name || cat;
              const catIcon = cat.icon || 'pricetag';
              return (
                <TouchableOpacity
                  key={cat.id || catName}
                  style={styles.categoryItem}
                  onPress={() => router.push({ pathname: '/map', params: { category: catName } })}
                >
                  <View style={[styles.categoryIcon]}>
                    {cat.image ? (
                      <Image source={{ uri: cat.image }} style={{ width: 60, height: 60 }} resizeMode="contain" />
                    ) : (
                      <Ionicons name={catIcon as any} size={26} color={CAT_STYLE.color} />
                    )}
                  </View>
                  <Text style={styles.categoryLabel}>{catName.length > 10 ? catName.slice(0, 9) + '...' : catName}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.categoryItem}
              onPress={() => router.push({ pathname: '/(tabs)/partners' })}
            >
              <View style={[styles.categoryIcon, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="ellipsis-horizontal" size={26} color="#6B7280" />
              </View>
              <Text style={styles.categoryLabel}>More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length > 0 ? (
            transactions.map((txn) => (
              <Card key={txn.id} style={styles.transactionCard}>
                <View style={styles.transactionRow}>
                  <View style={[
                    styles.transactionIcon,
                    { backgroundColor: txn.type === 'earn' ? COLORS.success + '20' : COLORS.error + '20' }
                  ]}>
                    <Ionicons
                      name={txn.type === 'earn' ? 'arrow-up' : 'arrow-down'}
                      size={20}
                      color={txn.type === 'earn' ? COLORS.success : COLORS.error}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>{txn.description}</Text>
                    <Text style={styles.transactionDate}>{formatDate(txn.created_at)}</Text>
                  </View>
                  <Text style={[
                    styles.transactionPoints,
                    { color: txn.type === 'earn' ? COLORS.success : COLORS.error }
                  ]}>
                    {txn.type === 'earn' ? '+' : '-'}{txn.points}
                  </Text>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Start earning points at partner stores!</Text>
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  greeting: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerLogoContainer: {
  justifyContent: 'center',
  alignItems: 'center',
},
  headerLogo: {
    width: 45,
    height: 45,
    borderRadius: 19,
  },
  // Map Preview
  mapPreview: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  mapContainer: {
    height: 170,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  miniMap: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xl,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  mapOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapOverlayText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    fontWeight: '600',
  },
  // Balance Card
  balanceCardWrapper: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  balanceCardBg: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCardBgImage: {
    borderRadius: BORDER_RADIUS.xl,
  },
  cardContent: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    justifyContent: 'space-between',
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
  // Explore Section
  buyPointsBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.medium,
  },
  buyPointsBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  seeAll: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryItem: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  actionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  // Transactions
  transactionCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  transactionDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  transactionPoints: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
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

  topRightLogo: {
  position: 'absolute',
  top: -130,
  right: -210,
  width: 230,
  height: 230,
  zIndex: 10,
},
});