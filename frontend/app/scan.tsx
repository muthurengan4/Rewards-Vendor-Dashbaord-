import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

// Conditionally import CameraView - only on native
let CameraViewComponent: any = null;
let requestCameraPermission: (() => Promise<{ granted: boolean }>) | null = null;

if (Platform.OS !== 'web') {
  try {
    const camModule = require('expo-camera');
    CameraViewComponent = camModule.CameraView;
    requestCameraPermission = async () => {
      return camModule.Camera.requestCameraPermissionsAsync();
    };
  } catch (e) {
    console.log('expo-camera not available');
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

type ScanState = 'scanning' | 'processing' | 'success' | 'error';

interface ClaimResult {
  points_earned: number;
  vendor_name: string;
  bill_amount: number;
  new_balance: number;
}

export default function ScanScreen() {
  const router = useRouter();
  const { refreshUser } = useAuthStore();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Animations
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  // Request camera permissions on mount (native only)
  useEffect(() => {
    if (Platform.OS !== 'web' && requestCameraPermission) {
      requestCameraPermission().then((result) => {
        setPermissionGranted(result.granted);
      });
    }
  }, []);

  // Scan line animation
  useEffect(() => {
    if (scanState === 'scanning') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [scanState]);

  // Result animation
  const animateResult = () => {
    resultScale.setValue(0);
    resultOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(resultScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    processQRData(data);
  };

  const processQRData = async (qrData: string) => {
    setScanState('processing');

    // Validate QR format - accept both "PURCHASE:PUR-xxx" and raw "PUR-xxx"
    let formattedData = qrData.trim();
    if (formattedData.startsWith('PUR-') && !formattedData.startsWith('PURCHASE:')) {
      formattedData = `PURCHASE:${formattedData}`;
    }

    if (!formattedData.startsWith('PURCHASE:PUR-')) {
      setScanState('error');
      setErrorMessage('This is not a valid purchase QR code. Please scan a vendor purchase QR.');
      return;
    }

    try {
      const response = await api.post('/claim-purchase', { qr_data: formattedData });
      const result = response.data;

      setClaimResult({
        points_earned: result.points_earned,
        vendor_name: result.vendor_name,
        bill_amount: result.bill_amount,
        new_balance: result.new_balance,
      });
      setScanState('success');
      animateResult();

      // Refresh user data in background
      refreshUser();
    } catch (error: any) {
      setScanState('error');
      const detail = error.response?.data?.detail || 'Failed to claim points. Please try again.';
      setErrorMessage(detail);
    }
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    processQRData(code);
  };

  const handleScanAgain = () => {
    setScanned(false);
    setScanState('scanning');
    setClaimResult(null);
    setErrorMessage('');
    setManualCode('');
  };

  const handleGoBack = () => {
    router.back();
  };

  // ====== RENDER: Processing state ======
  const renderProcessing = () => (
    <View style={styles.resultOverlay}>
      <View style={styles.resultCard}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.processingText}>Claiming your points...</Text>
      </View>
    </View>
  );

  // ====== RENDER: Success state ======
  const renderSuccess = () => (
    <View style={styles.resultOverlay}>
      <Animated.View
        style={[
          styles.resultCard,
          {
            transform: [{ scale: resultScale }],
            opacity: resultOpacity,
          },
        ]}
      >
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
        </View>
        <Text style={styles.successTitle}>Points Earned!</Text>

        <View style={styles.pointsBadge}>
          <Text style={styles.pointsAmount}>+{claimResult?.points_earned}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="storefront-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{claimResult?.vendor_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>Bill: RM{claimResult?.bill_amount?.toFixed(2)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.detailText, { color: COLORS.primary, fontWeight: '600' }]}>
              New Balance: {claimResult?.new_balance?.toLocaleString()} pts
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.doneButton} onPress={handleGoBack}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.scanAgainLink} onPress={handleScanAgain}>
          <Text style={styles.scanAgainText}>Scan Another</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // ====== RENDER: Error state ======
  const renderError = () => (
    <View style={styles.resultOverlay}>
      <View style={styles.resultCard}>
        <View style={styles.errorIcon}>
          <Ionicons name="close-circle" size={64} color={COLORS.error} />
        </View>
        <Text style={styles.errorTitle}>Scan Failed</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>

        <TouchableOpacity style={styles.retryButton} onPress={handleScanAgain}>
          <Ionicons name="refresh" size={20} color={COLORS.white} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.scanAgainLink} onPress={handleGoBack}>
          <Text style={styles.scanAgainText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ====== WEB FALLBACK (manual code entry) ======
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.webHeader}>
            <TouchableOpacity style={styles.webBackButton} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.webTitle}>Claim Points</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.webContent}>
            {scanState === 'scanning' && (
              <>
                <View style={styles.webIconContainer}>
                  <Ionicons name="qr-code" size={80} color={COLORS.primary} />
                </View>
                <Text style={styles.webInstructions}>
                  Camera scanning is available on the mobile app.{'\n'}Enter the purchase code below:
                </Text>
                <View style={styles.webInputContainer}>
                  <TextInput
                    style={styles.webInput}
                    placeholder="e.g. PUR-4F9B6F35"
                    placeholderTextColor={COLORS.textMuted}
                    value={manualCode}
                    onChangeText={setManualCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onSubmitEditing={handleManualSubmit}
                    returnKeyType="go"
                  />
                  <TouchableOpacity
                    style={[styles.webSubmitButton, !manualCode.trim() && styles.webSubmitDisabled]}
                    onPress={handleManualSubmit}
                    disabled={!manualCode.trim()}
                  >
                    <Ionicons name="arrow-forward" size={24} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.webHint}>
                  The code is on the vendor's receipt or their screen.
                </Text>
              </>
            )}

            {scanState === 'processing' && (
              <View style={styles.webResultArea}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.processingText}>Claiming your points...</Text>
              </View>
            )}

            {scanState === 'success' && claimResult && (
              <View style={styles.webResultArea}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
                </View>
                <Text style={styles.successTitle}>Points Earned!</Text>
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsAmount}>+{claimResult.points_earned}</Text>
                  <Text style={styles.pointsLabel}>points</Text>
                </View>
                <View style={styles.detailsContainer}>
                  <View style={styles.detailRow}>
                    <Ionicons name="storefront-outline" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>{claimResult.vendor_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="receipt-outline" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>Bill: RM{claimResult.bill_amount?.toFixed(2)}</Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
                    <Text style={[styles.detailText, { color: COLORS.primary, fontWeight: '600' }]}>
                      New Balance: {claimResult.new_balance?.toLocaleString()} pts
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.doneButton} onPress={handleGoBack}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scanAgainLink} onPress={handleScanAgain}>
                  <Text style={styles.scanAgainText}>Enter Another Code</Text>
                </TouchableOpacity>
              </View>
            )}

            {scanState === 'error' && (
              <View style={styles.webResultArea}>
                <View style={styles.errorIcon}>
                  <Ionicons name="close-circle" size={64} color={COLORS.error} />
                </View>
                <Text style={styles.errorTitle}>Claim Failed</Text>
                <Text style={styles.errorMessage}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleScanAgain}>
                  <Ionicons name="refresh" size={20} color={COLORS.white} />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ====== NATIVE: Loading permissions ======
  if (permissionGranted === null) {
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.processingText, { marginTop: SPACING.md }]}>Requesting camera access...</Text>
      </View>
    );
  }

  // ====== NATIVE: Permission denied ======
  if (!permissionGranted) {
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan vendor QR codes and earn your points instantly.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              if (requestCameraPermission) {
                const result = await requestCameraPermission();
                setPermissionGranted(result.granted);
              }
            }}
          >
            <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
          </TouchableOpacity>

          {/* Manual fallback */}
          <Text style={[styles.permissionText, { marginTop: SPACING.lg, marginBottom: SPACING.sm }]}>
            Or enter the code manually:
          </Text>
          <View style={styles.webInputContainer}>
            <TextInput
              style={styles.webInput}
              placeholder="e.g. PUR-4F9B6F35"
              placeholderTextColor={COLORS.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.webSubmitButton, !manualCode.trim() && styles.webSubmitDisabled]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim()}
            >
              <Ionicons name="arrow-forward" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.linkButton} onPress={handleGoBack}>
            <Text style={styles.linkButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ====== NATIVE: Camera Scanner ======
  return (
    <View style={styles.container}>
      {CameraViewComponent && (
        <CameraViewComponent
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
      )}

      {/* Scanner overlay */}
      {scanState === 'scanning' && (
        <View style={styles.overlay}>
          {/* Top dark section */}
          <View style={styles.overlayTop}>
            <SafeAreaView edges={['top']}>
              <View style={styles.scanHeader}>
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                  <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.scanTitle}>Scan QR Code</Text>
                <View style={{ width: 40 }} />
              </View>
            </SafeAreaView>
          </View>

          {/* Middle with transparent scan window */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlayLeft} />
            <View style={styles.scanWindow}>
              {/* Corner decorations */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Animated scan line */}
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanLineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, SCAN_AREA_SIZE - 4],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            <View style={styles.overlayRight} />
          </View>

          {/* Bottom dark section */}
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>
              Point camera at vendor purchase QR code
            </Text>
            <Text style={styles.instructionSubtext}>
              The code will be scanned automatically
            </Text>
          </View>
        </View>
      )}

      {scanState === 'processing' && renderProcessing()}
      {scanState === 'success' && renderSuccess()}
      {scanState === 'error' && renderError()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  // Permission
  permissionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    margin: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.large,
  },
  permissionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  permissionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  linkButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },

  // Scanner Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.white,
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlayLeft: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayRight: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanWindow: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    overflow: 'hidden',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  instructionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  instructionSubtext: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.7)',
  },

  // Corners
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: COLORS.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },

  // Scan line
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // Result Overlay
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...SHADOWS.large,
  },
  processingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  // Success
  successIcon: {
    marginBottom: SPACING.md,
  },
  successTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  pointsBadge: {
    backgroundColor: COLORS.success + '15',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.lg,
  },
  pointsAmount: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  pointsLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.success,
    marginLeft: SPACING.xs,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  detailText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  scanAgainLink: {
    paddingVertical: SPACING.sm,
  },
  scanAgainText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },

  // Error
  errorIcon: {
    marginBottom: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },

  // Web styles
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  webBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  webContent: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  webIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  webInstructions: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
    maxWidth: 320,
  },
  webInputContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 400,
    marginBottom: SPACING.md,
  },
  webInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  webSubmitButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 52,
  },
  webSubmitDisabled: {
    opacity: 0.5,
  },
  webHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  webResultArea: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
});
