/**
 * AppGuideSheet — Reusable first-time guide popup for any screen.
 *
 * HUD-styled bottom sheet: sharp 4px corners, SVG corner brackets,
 * `// SECTION` mono header, dim left-border tip rows, HUD primary
 * button. Persists dismissal in AsyncStorage so each guide only
 * appears once.
 *
 * Usage:
 *   const guide = useAppGuide('home');
 *   ...
 *   <AppGuideSheet {...guide} title="Welcome to Home" tips={[...]} />
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../colors';
import { FontFamily } from '../typography';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const HUD_PANEL_BG = 'rgba(10,22,40,0.95)';
const HUD_PANEL_BORDER = 'rgba(58,102,255,0.18)';
const HUD_ACCENT = '#3A66FF';
const HUD_BRACKET = 'rgba(58,102,255,0.6)';
const HUD_TEXT_MUTED = '#6B7280';

// ── Storage key helper ──────────────────────────────────────────────
const guideKey = (id: string) => `@lockedin/guide_${id}_shown`;

// ── Hook: manages visibility + AsyncStorage for a named guide ───────
export function useAppGuide(guideId: string) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(guideKey(guideId)).then((v) => {
      if (!v) setVisible(true);
    });
  }, [guideId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(guideKey(guideId), 'true').catch(() => {});
  }, [guideId]);

  return { visible, onDismiss: dismiss };
}

// ── Tip item type ───────────────────────────────────────────────────
export interface GuideTip {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  text: string;
}

/** A page in a multi-step guide. Title/subtitle override top-level props. */
export interface GuidePage {
  title?: string;
  subtitle?: string;
  tips: GuideTip[];
}

// ── Local SVG corner brackets ───────────────────────────────────────
// Inlined here so the design-folder component stays free of deeper
// feature-folder imports. Renders four L-shapes at the panel corners.
const CornerBrackets: React.FC = () => {
  const size = 14;
  const stroke = 1.5;
  const color = HUD_BRACKET;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* top-left */}
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path d={`M 0 ${size} L 0 0 L ${size} 0`} stroke={color} strokeWidth={stroke} fill="none" />
      </Svg>
      {/* top-right */}
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, right: 0 }}>
        <Path d={`M 0 0 L ${size} 0 L ${size} ${size}`} stroke={color} strokeWidth={stroke} fill="none" />
      </Svg>
      {/* bottom-left */}
      <Svg width={size} height={size} style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <Path d={`M 0 0 L 0 ${size} L ${size} ${size}`} stroke={color} strokeWidth={stroke} fill="none" />
      </Svg>
      {/* bottom-right */}
      <Svg width={size} height={size} style={{ position: 'absolute', bottom: 0, right: 0 }}>
        <Path d={`M 0 ${size} L ${size} ${size} L ${size} 0`} stroke={color} strokeWidth={stroke} fill="none" />
      </Svg>
    </View>
  );
};

// ── Component ───────────────────────────────────────────────────────
interface AppGuideSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  /** Single-page guide. Ignored when `pages` is provided. */
  tips?: GuideTip[];
  /** Multi-page guide. Last page's CTA dismisses; all earlier pages advance. */
  pages?: GuidePage[];
}

const AppGuideSheet: React.FC<AppGuideSheetProps> = ({
  visible,
  onDismiss,
  title,
  subtitle,
  tips,
  pages,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [pageIndex, setPageIndex] = useState(0);

  // Resolve effective pages so the rest of the render is page-driven.
  const effectivePages: GuidePage[] = pages ?? [{ tips: tips ?? [] }];
  const totalPages = effectivePages.length;
  const safeIndex = Math.min(pageIndex, totalPages - 1);
  const currentPage = effectivePages[safeIndex];
  const isLastPage = safeIndex >= totalPages - 1;
  const currentTitle = currentPage.title ?? title;
  const currentSubtitle = currentPage.subtitle ?? (safeIndex === 0 ? subtitle : undefined);

  useEffect(() => {
    if (visible) {
      setPageIndex(0);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [slideAnim, onDismiss]);

  const handlePrimary = useCallback(() => {
    if (isLastPage) {
      handleDismiss();
    } else {
      setPageIndex((i) => i + 1);
    }
  }, [isLastPage, handleDismiss]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={handleDismiss}>
        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <CornerBrackets />

            {/* Handle bar */}
            <View style={s.handle} />

            {/* HUD section header */}
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>// SYSTEM ONLINE</Text>
              {totalPages > 1 ? (
                <Text style={s.pageIndicator}>
                  {String(safeIndex + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
                </Text>
              ) : null}
            </View>
            <LinearGradient
              colors={[HUD_ACCENT, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.sectionRule}
            />

            {/* Title */}
            <Text style={s.title}>{currentTitle}</Text>
            {currentSubtitle ? <Text style={s.subtitle}>{currentSubtitle}</Text> : null}

            {/* Tips */}
            <View style={s.tipsContainer}>
              {currentPage.tips.map((tip, i) => {
                const accent = tip.iconColor ?? HUD_ACCENT;
                return (
                  <View
                    key={`${safeIndex}-${i}`}
                    style={[s.tipRow, { borderLeftColor: accent }]}
                  >
                    <View
                      style={[
                        s.tipIconWrap,
                        {
                          backgroundColor: `${accent}1F`,
                          borderColor: `${accent}55`,
                        },
                      ]}
                    >
                      <Ionicons name={tip.icon} size={16} color={accent} />
                    </View>
                    <Text style={s.tipText}>{tip.text}</Text>
                  </View>
                );
              })}
            </View>

            {/* HUD primary button */}
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handlePrimary}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>
                {isLastPage ? '> GOT IT' : '> NEXT'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: HUD_PANEL_BG,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: HUD_PANEL_BORDER,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: HUD_ACCENT,
  },
  pageIndicator: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: HUD_TEXT_MUTED,
  },
  sectionRule: {
    height: 1,
    width: '100%',
    marginTop: 6,
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: HUD_TEXT_MUTED,
    marginTop: 6,
    lineHeight: 20,
  },
  tipsContainer: {
    marginTop: 20,
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    borderLeftColor: HUD_ACCENT,
  },
  tipIconWrap: {
    width: 30,
    height: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: 'rgba(58,102,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    color: HUD_ACCENT,
    letterSpacing: 1.6,
  },
});

export default AppGuideSheet;
