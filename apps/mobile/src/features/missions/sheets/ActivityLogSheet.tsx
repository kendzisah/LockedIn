/**
 * ActivityLogSheet — Quick-log bottom sheet for the daily activity
 * check-in. Two fields: a short summary (required) and an optional
 * note. On submit:
 *   - bumps total_missions_completed via StatsService
 *   - awards mission_complete XP via XPService
 *   - calls the parent's onLogged callback (which writes the per-day
 *     completion flag in DailyActivityCard)
 *
 * Self-contained: doesn't touch MissionsProvider state. The provider's
 * daily mission rotation is unaffected.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import HUDCornerBrackets from '../../home/components/HUDCornerBrackets';
import type { MissionTemplate } from '../MissionData';
import { FontFamily } from '../../../design/typography';
import { SectionLabelStyle, SystemTokens } from '../../home/systemTokens';
import { StatsService } from '../../../services/StatsService';
import { XPService } from '../../../services/XPService';
import { AchievementService } from '../../../services/AchievementService';

interface Props {
  visible: boolean;
  template: MissionTemplate;
  onClose: () => void;
  onLogged: () => void;
}

const ActivityLogSheet: React.FC<Props> = ({ visible, template, onClose, onLogged }) => {
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSummary('');
    setNote('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting || summary.trim().length === 0) return;
    setSubmitting(true);
    try {
      await StatsService.bumpCounter('total_missions_completed', 1);
      await XPService.award({
        type: 'mission_complete',
        data: {
          missionId: `daily_activity_${template.title.replace(/\s+/g, '_').toLowerCase()}`,
          missionXP: template.xp.medium,
        },
      });
      await StatsService.recompute();
      await AchievementService.evaluate(StatsService.getCached());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogged();
      reset();
    } catch {
      setSubmitting(false);
    }
  };

  const canSubmit = summary.trim().length > 0 && !submitting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <HUDCornerBrackets color={SystemTokens.bracketColor} />
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerLabel}>// {template.title.toUpperCase()}</Text>
            <Text style={styles.headerXp}>+{template.xp.medium} XP</Text>
          </View>
          <Text style={styles.desc}>{template.description}</Text>

          <Text style={styles.fieldLabel}>WHAT DID YOU DO?</Text>
          <TextInput
            style={styles.input}
            placeholder="One-line summary"
            placeholderTextColor={SystemTokens.textMuted}
            value={summary}
            onChangeText={setSummary}
            maxLength={120}
            editable={!submitting}
          />

          <Text style={styles.fieldLabel}>NOTE  (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Anything worth remembering"
            placeholderTextColor={SystemTokens.textMuted}
            value={note}
            onChangeText={setNote}
            maxLength={300}
            multiline
            editable={!submitting}
          />

          <TouchableOpacity
            style={[styles.submit, !canSubmit && styles.submitOff]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              {submitting ? 'LOGGING…' : '⟐  LOG ACTIVITY'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} style={styles.cancel} disabled={submitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: SystemTokens.panelBg,
    borderTopWidth: 1,
    borderColor: SystemTokens.panelBorder,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 3,
    backgroundColor: 'rgba(58,102,255,0.3)',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLabel: {
    ...SectionLabelStyle,
    fontSize: 12,
    flex: 1,
  },
  headerXp: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    color: SystemTokens.cyan,
    letterSpacing: 0.6,
  },
  desc: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: SystemTokens.textMuted,
    lineHeight: 18,
    marginBottom: 18,
  },
  fieldLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: SystemTokens.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(58,102,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    alignItems: 'center',
  },
  submitOff: {
    opacity: 0.4,
  },
  submitText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
  cancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: SystemTokens.textMuted,
  },
});

export default ActivityLogSheet;
