/**
 * TerminalLine — single `> ...` line for the System Analysis screen.
 *
 * Types in via TypingText, then pops a green checkmark in once the text
 * lands. Use the `delay` prop to stagger lines.
 */

import React, { useState } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TypingText from './TypingText';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

interface TerminalLineProps {
  text: string;
  /** Wait this long before starting to type the line. */
  delay?: number;
  /** Per-character speed (ms). */
  charDelay?: number;
  /** Show the trailing checkmark when complete. Default true. */
  showCheck?: boolean;
  /** Override colour (e.g. cyan glow on the final SYSTEM READY line). */
  color?: string;
  /** Fired after typing + check land. */
  onComplete?: () => void;
  style?: StyleProp<ViewStyle>;
}

const TerminalLine: React.FC<TerminalLineProps> = ({
  text,
  delay = 0,
  charDelay = 30,
  showCheck = true,
  color,
  onComplete,
  style,
}) => {
  const [done, setDone] = useState(false);

  return (
    <View style={[styles.row, style]}>
      <TypingText
        text={text}
        startDelay={delay}
        charDelay={charDelay}
        onComplete={() => {
          setDone(true);
          onComplete?.();
        }}
        style={[styles.text, color ? { color } : null]}
      />
      {showCheck && done ? (
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={SystemTokens.green}
          style={styles.check}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize: 13,
    color: SystemTokens.glowAccent,
    lineHeight: 18,
  },
  check: {
    marginLeft: 2,
  },
});

export default React.memo(TerminalLine);
