/**
 * SettingsSheetShell — Bottom sheet wrapper used by every settings
 * sheet (GoalPicker, WeaknessPicker, DailyCommitment, ReminderTime,
 * ChangePassword, DeleteAccount, ResetData). HUD-themed: dark panel
 * background, cyan handle, monospace `// TITLE` header with gradient
 * rule, corner brackets at the top edge.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HUDCornerBrackets from '../../home/components/HUDCornerBrackets';
import { FontFamily } from '../../../design/typography';
import { SectionLabelStyle, SystemTokens } from '../../home/systemTokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const SettingsSheetShell: React.FC<Props> = ({ visible, onClose, title, children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <HUDCornerBrackets color={SystemTokens.bracketColor} />
        <View style={styles.handle} />

        {title ? (
          <View style={styles.header}>
            <Text style={styles.headerLabel}>// {title.toUpperCase()}</Text>
            <LinearGradient
              colors={[SystemTokens.bracketColor, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerRule}
            />
          </View>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollPad}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

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
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 3,
    backgroundColor: 'rgba(58,102,255,0.3)',
    marginBottom: 14,
  },
  header: {
    marginBottom: 14,
  },
  headerLabel: {
    ...SectionLabelStyle,
    fontSize: 12,
    marginBottom: 6,
  },
  headerRule: {
    height: 1,
    width: '100%',
  },
  scrollPad: {
    paddingBottom: 12,
  },
  // Kept for compat; some sheets reference unused tokens.
  _unused: {
    fontFamily: FontFamily.body,
  },
});

export default SettingsSheetShell;
