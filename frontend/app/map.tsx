import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../src/services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  'All': { icon: 'apps', color: '#6B7280' },
  'Dining': { icon: 'restaurant', color: '#EF4444' },
  'Coffee': { icon: 'cafe', color: '#92400E' },
  'Grocery': { icon: 'cart', color: '#22C55E' },
  'Fuel': { icon: 'car', color: '#F59E0B' },
  'Health & Beauty': { icon: 'heart', color: '#EC4899' },
  'Travel': { icon: 'airplane', color: '#3B82F6' },
  'Transport': { icon: 'bus', color: '#8B5CF6' },
  'Fitness': { icon: 'fitness', color: '#14B8A6' },
};

// Cross-platform map component
const MapWebView = ({ html, style }: { html: string; style: any }) => {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      srcDoc: html,
      style: { width: '100%', height: '100%', border: 'none', borderRadius: 0 },
    });
  }
  const { WebView } = require('react-native-webview');
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      scrollEnabled={false}
    />
  );
};

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [partners, setPartners] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [userLocation, setUserLocation] = useState({ lat: 3.1390, lng: 101.6869 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocation();
    if (params.category && typeof params.category === 'string') {
      setSelectedCategory(params.category);
    }
  }, []);

  useEffect(() => {
    loadPartners(selectedCategory);
  }, [selectedCategory]);

  const loadLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch (e) {
      console.log('Location error:', e);
    }
  };

  const loadPartners = async (category?: string) => {
    try {
      const queryParams: any = {};
      if (category && category !== 'All') queryParams.category = category;
      const res = await api.get('/partners/map', { params: queryParams });
      setPartners(res.data.partners || []);
      if (res.data.categories) setCategories(res.data.categories);
    } catch (e) {
      console.log('Partners error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getCatColor = (cat: string) => CATEGORY_CONFIG[cat]?.color || COLORS.primary;

  const getMapHTML = () => {
    const markers = partners.map((p) => {
      const color = getCatColor(p.category);
      const imageUrl = p.store_image || p.logo || '';
      return `{
        lat: ${p.latitude},
        lng: ${p.longitude},
        name: ${JSON.stringify(p.name)},
        category: ${JSON.stringify(p.category || 'Other')},
        address: ${JSON.stringify(p.address || '')},
        multiplier: ${p.points_multiplier || 1},
        color: '${color}',
        id: ${JSON.stringify(p.id)},
        image: ${JSON.stringify(imageUrl)}
      }`;
    }).join(',');

    return `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .marker-pin {
          width: 34px; height: 34px; border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg); display: flex;
          align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2.5px solid white;
        }
        .marker-pin span { transform: rotate(45deg); color: white; font-size: 15px; font-weight: bold; }
        .popup-content { min-width: 180px; }
        .popup-img { width: 100%; height: 90px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; display: block; }
        .popup-name { font-size: 14px; font-weight: 700; margin-bottom: 3px; color: #1F2937; }
        .popup-cat { font-size: 11px; color: #6B7280; margin-bottom: 4px; display: inline-block; background: #F3F4F6; padding: 2px 8px; border-radius: 10px; }
        .popup-addr { font-size: 11px; color: #9CA3AF; margin-bottom: 5px; }
        .popup-points { font-size: 12px; color: #CB4154; font-weight: 700; }
        .leaflet-popup-content-wrapper { border-radius: 14px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; padding: 0 !important; overflow: hidden; }
        .leaflet-popup-content { margin: 10px !important; min-width: 180px; }
        .leaflet-popup-tip { box-shadow: none !important; }
        .user-marker { width: 16px; height: 16px; background: #3B82F6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(59,130,246,0.25), 0 2px 6px rgba(0,0,0,0.2); }
      </style>
    </head><body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${userLocation.lat}, ${userLocation.lng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '',
          maxZoom: 19
        }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        var userIcon = L.divIcon({ className: '', html: '<div class="user-marker"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
        L.marker([${userLocation.lat}, ${userLocation.lng}], { icon: userIcon }).addTo(map).bindPopup('<div style="text-align:center"><b>You are here</b></div>');

        var markers = [${markers}];
        var iconMap = {
          'Dining': '🍽️', 'Coffee': '☕', 'Grocery': '🛒',
          'Fuel': '⛽', 'Health & Beauty': '💊', 'Travel': '✈️',
          'Transport': '🚌', 'Fitness': '🏋️'
        };
        markers.forEach(function(m) {
          var emoji = iconMap[m.category] || '📍';
          var icon = L.divIcon({
            className: '',
            html: '<div class="marker-pin" style="background:' + m.color + '"><span>' + emoji + '</span></div>',
            iconSize: [34, 42], iconAnchor: [17, 42], popupAnchor: [0, -42]
          });
          L.marker([m.lat, m.lng], { icon: icon }).addTo(map).bindPopup(
            '<div class="popup-content">' +
            (m.image ? '<img class="popup-img" src="' + m.image + '" onerror="this.style.display=\\'none\\'" />' : '') +
            '<div class="popup-name">' + m.name + '</div>' +
            '<div class="popup-cat">' + m.category + '</div>' +
            '<div class="popup-addr">' + m.address + '</div>' +
            '<div class="popup-points">' + m.multiplier + 'x Points Multiplier</div>' +
            '</div>'
          );
        });
      </script>
    </body></html>`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Explore Nearby</Text>
        <TouchableOpacity style={styles.locateBtn} onPress={loadLocation}>
          <Ionicons name="locate" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, active && { backgroundColor: cfg?.color || COLORS.primary, borderColor: cfg?.color || COLORS.primary }]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Ionicons
                  name={(cfg?.icon || 'pricetag') as any}
                  size={16}
                  color={active ? '#fff' : cfg?.color || COLORS.textSecondary}
                />
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Map */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <MapWebView html={getMapHTML()} style={styles.map} />
          {/* Partner count overlay */}
          <View style={styles.countOverlay}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.countText}>{partners.length} locations found</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  locateBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  filterWrap: {
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  filterScroll: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.surfaceLight,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, marginTop: SPACING.md },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  countOverlay: {
    position: 'absolute', bottom: SPACING.lg, left: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, ...SHADOWS.medium,
  },
  countText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary },
});
