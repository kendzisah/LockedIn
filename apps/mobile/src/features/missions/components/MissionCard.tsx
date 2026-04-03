/**
 * MissionCard — Glassmorphic mission card. Tapping opens a detail modal with
 * full info and a Complete / Close action bar.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import type { Mission, MissionType, CompletionType } from '../MissionEngine';

interface MissionCardProps {
  mission: Mission;
  onComplete: (missionId: string) => void;
}

// ─── Icon + color map ───────────────────────────────────

const MISSION_ICONS: Record<MissionType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  focus_session:  { name: 'timer-outline',            color: Colors.primary },
  no_social:      { name: 'phone-portrait-outline',   color: '#8B5CF6' },
  reflection:     { name: 'moon-outline',             color: '#FF6B35' },
  workout_check:  { name: 'barbell-outline',          color: Colors.success },
  journal:        { name: 'book-outline',             color: '#FFC857' },
  reading:        { name: 'reader-outline',           color: Colors.accent },
  planning:       { name: 'clipboard-outline',        color: '#00D68F' },
  discipline:     { name: 'shield-checkmark-outline', color: '#B0A0FF' },
  lifestyle:      { name: 'heart-outline',            color: '#FF6B81' },
  social:         { name: 'people-outline',           color: '#00C2FF' },
  custom:         { name: 'star-outline',             color: Colors.accent },
};

const SLOT_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  core:     { label: 'CORE',   color: Colors.primary, desc: 'Universal focus mission' },
  goal:     { label: 'GOAL',   color: Colors.accent,  desc: 'Based on your primary goal' },
  weakness: { label: 'GROWTH', color: '#B0A0FF',      desc: 'Targets your stated weakness' },
};

const COMPLETION_META: Record<CompletionType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  auto:          { label: 'Auto-complete',    icon: 'flash',             color: Colors.accent },
  'self-report': { label: 'Self-report',      icon: 'hand-left-outline', color: Colors.textSecondary },
  hybrid:        { label: 'Time-gated',       icon: 'time-outline',      color: '#FFC857' },
};

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy:   { label: 'Easy',   color: Colors.success },
  medium: { label: 'Medium', color: '#FFC857' },
  hard:   { label: 'Hard',   color: Colors.danger },
};

const isTimeGateUnlocked = (timeGate: string | undefined): boolean => {
  if (!timeGate) return true;
  const match = timeGate.match(/After (\d{1,2})\s*(AM|PM)/i);
  if (!match) return true;
  let hour = parseInt(match[1], 10);
  if (match[2].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (match[2].toUpperCase() === 'AM' && hour === 12) hour = 0;
  return new Date().getHours() >= hour;
};

// ─── Component ──────────────────────────────────────────

export const MissionCard: React.FC<MissionCardProps> = ({ mission, onComplete }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const done = mission.completed;
  const locked = !done && !isTimeGateUnlocked(mission.timeGate);
  const iconInfo = MISSION_ICONS[mission.type] ?? MISSION_ICONS.custom;
  const slotMeta = SLOT_LABELS[mission.slot] ?? SLOT_LABELS.core;

  const handleCardTap = () => {
    setModalVisible(true);
  };

  const handleComplete = async () => {
    if (done || locked) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(mission.id);
    setModalVisible(false);
  };

  const handleClose = () => {
    setModalVisible(false);
  };

  // ── Inline card (list item) ──

  const cardContent = (
    <TouchableOpacity
      onPress={handleCardTap}
      activeOpacity={0.8}
      style={[styles.card, done && styles.cardDone, locked && styles.cardLocked]}
    >
      <View style={[
        styles.iconBox,
        { backgroundColor: done ? 'rgba(0,214,143,0.1)' : `${iconInfo.color}12` },
        done && { borderColor: 'rgba(0,214,143,0.15)' },
        locked && { opacity: 0.5 },
      ]}>
        {done ? (
          <Ionicons name="checkmark" size={20} color={Colors.success} />
        ) : locked ? (
          <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
        ) : (
          <Ionicons name={iconInfo.name} size={18} color={iconInfo.color} />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, done && styles.titleDone, locked && styles.titleLocked]} numberOfLines={1}>
            {mission.title}
          </Text>
          <View style={[styles.slotBadge, { backgroundColor: `${slotMeta.color}15` }]}>
            <Text style={[styles.slotText, { color: slotMeta.color }]}>{slotMeta.label}</Text>
          </View>
        </View>
        <Text style={[styles.description, done && styles.descDone, locked && styles.titleLocked]} numberOfLines={1}>
          {locked ? mission.timeGate : mission.description}
        </Text>
        {!done && !locked && mission.completionType === 'auto' && (
          <View style={styles.autoRow}>
            <Ionicons name="flash" size={10} color={Colors.accent} />
            <Text style={styles.autoText}>Auto-complete</Text>
          </View>
        )}
      </View>

      <View style={[styles.xpBadge, done && styles.xpBadgeDone, locked && { opacity: 0.4 }]}>
        <Text style={[styles.xpValue, done && styles.xpDone]}>+{mission.xp}</Text>
        <Text style={[styles.xpLabel, done && styles.xpDone]}>XP</Text>
      </View>
    </TouchableOpacity>
  );

  // ── Detail modal ──

  const completionMeta = COMPLETION_META[mission.completionType] ?? COMPLETION_META['self-report'];
  const diffMeta = DIFFICULTY_META[mission.difficulty] ?? DIFFICULTY_META.easy;

  const detailModal = (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Hero icon */}
          <View style={[s.heroIcon, { backgroundColor: `${iconInfo.color}15` }]}>
            <Ionicons
              name={done ? 'checkmark-circle' : iconInfo.name}
              size={32}
              color={done ? Colors.success : iconInfo.color}
            />
          </View>

          {/* Title + slot */}
          <View style={s.headerRow}>
            <Text style={s.modalTitle}>{mission.title}</Text>
            <View style={[s.slotPill, { backgroundColor: `${slotMeta.color}15` }]}>
              <Text style={[s.slotPillText, { color: slotMeta.color }]}>{slotMeta.label}</Text>
            </View>
          </View>
          <Text style={s.slotDesc}>{slotMeta.desc}</Text>

          {/* Description */}
          <Text style={s.modalDesc}>{mission.description}</Text>

          {/* Meta pills row */}
          <View style={s.metaRow}>
            {/* Completion type */}
            <View style={s.metaPill}>
              <Ionicons name={completionMeta.icon} size={12} color={completionMeta.color} />
              <Text style={[s.metaText, { color: completionMeta.color }]}>{completionMeta.label}</Text>
            </View>
            {/* Difficulty */}
            <View style={s.metaPill}>
              <View style={[s.diffDot, { backgroundColor: diffMeta.color }]} />
              <Text style={[s.metaText, { color: diffMeta.color }]}>{diffMeta.label}</Text>
            </View>
            {/* XP */}
            <View style={s.metaPill}>
              <Ionicons name="star" size={12} color="#FFC857" />
              <Text style={[s.metaText, { color: '#FFC857' }]}>+{mission.xp} XP</Text>
            </View>
          </View>

          {/* Time gate notice */}
          {mission.timeGate && (
            <View style={[s.timeGateBar, locked && s.timeGateBarLocked]}>
              <Ionicons
                name={locked ? 'lock-closed' : 'lock-open'}
                size={14}
                color={locked ? Colors.textMuted : Colors.success}
              />
              <Text style={[s.timeGateText, locked && { color: Colors.textMuted }]}>
                {locked ? `Locked — available ${mission.timeGate.toLowerCase()}` : 'Unlocked — available now'}
              </Text>
            </View>
          )}

          {/* Completed state */}
          {done && (
            <View style={s.completedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={s.completedText}>Mission Complete</Text>
            </View>
          )}

          {/* Divider */}
          <View style={s.divider} />

          {/* Action buttons */}
          <View style={s.actions}>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.8}>
              <Text style={s.closeBtnText}>Close</Text>
            </TouchableOpacity>

            {!done && (
              <TouchableOpacity
                style={[s.completeBtn, locked && s.completeBtnDisabled]}
                onPress={handleComplete}
                activeOpacity={locked ? 1 : 0.8}
                disabled={locked}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={locked ? Colors.textMuted : '#FFFFFF'}
                />
                <Text style={[s.completeBtnText, locked && { color: Colors.textMuted }]}>
                  {locked ? 'Locked' : 'Complete'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <>
      {cardContent}
      {detailModal}
    </>
  );
};

// ─── Card styles (list item) ────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    gap: 12,
  },
  cardDone: {
    backgroundColor: 'rgba(21,26,33,0.35)',
    borderColor: 'rgba(0,214,143,0.08)',
  },
  cardLocked: {
    backgroundColor: 'rgba(21,26,33,0.3)',
    borderColor: 'rgba(255,255,255,0.03)',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  titleDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  titleLocked: {
    color: Colors.textMuted,
  },
  slotBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  description: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  descDone: {
    color: Colors.textMuted,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  autoText: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.accent,
  },
  xpBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,200,87,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.12)',
  },
  xpBadgeDone: {
    backgroundColor: 'rgba(44,52,64,0.2)',
    borderColor: 'rgba(255,255,255,0.03)',
  },
  xpValue: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: '#FFC857',
  },
  xpLabel: {
    fontFamily: FontFamily.body,
    fontSize: 9,
    color: '#FFC857',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  xpDone: {
    color: Colors.textMuted,
  },
});

// ─── Modal styles ───────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    backgroundColor: 'rgba(21,26,33,0.97)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.textPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },
  slotPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  slotPillText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  slotDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },

  modalDesc: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  metaText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },
  diffDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  timeGateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,214,143,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.1)',
    marginBottom: 16,
  },
  timeGateBarLocked: {
    backgroundColor: 'rgba(44,52,64,0.3)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  timeGateText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.success,
  },

  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.12)',
    marginBottom: 16,
  },
  completedText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.success,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 16,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  completeBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnDisabled: {
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  completeBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
