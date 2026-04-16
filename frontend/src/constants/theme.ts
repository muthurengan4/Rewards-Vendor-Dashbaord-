// 3ARewards Theme - Custom Red & Warm White
export const COLORS = {
  // Primary Colors
  primary: '#D61F26',      // Custom Red
  primaryLight: '#E84C52',
  primaryDark: '#B0191F',
  
  // Secondary Colors
  secondary: '#A01520',    // Dark Red
  secondaryLight: '#E06366',
  
  // Background Colors
  background: '#FFFFFF',   // White
  surface: '#FFFFFF',
  surfaceLight: '#F9F8F5',
  surfaceDark: '#E8E6E1',
  
  // Text Colors
  textPrimary: '#2D2D2D',
  textSecondary: '#666666',
  textMuted: '#999999',
  textOnPrimary: '#FFFFFF',
  
  // Status Colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Other
  border: '#E0DED9',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  
  // Legacy aliases for compatibility
  gold: '#D61F26',
  blue: '#D61F26',
  blueDark: '#2D2D2D',
  blueLight: '#E84C52',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
  display: 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Malaysia specific
export const CURRENCY = {
  symbol: 'RM',
  code: 'MYR',
  name: 'Malaysian Ringgit',
};
