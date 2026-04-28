/**
 * TypingText — character-by-character type-in for HUD/terminal screens.
 *
 * Used on the System Boot, System Analysis, and Commitment screens to sell
 * the "system OS booting" metaphor. Calls `onComplete` after the last
 * character lands so callers can chain the next line.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface TypingTextProps {
  text: string;
  /** Milliseconds per character. Default: 40ms — feels punchy without lagging. */
  charDelay?: number;
  /** Milliseconds to wait before starting the type-in (used to chain lines). */
  startDelay?: number;
  /** Fired once after the final character is rendered. */
  onComplete?: () => void;
  style?: StyleProp<TextStyle>;
}

const TypingText: React.FC<TypingTextProps> = ({
  text,
  charDelay = 40,
  startDelay = 0,
  onComplete,
  style,
}) => {
  const [visible, setVisible] = useState('');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisible('');
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let i = 0;

    const startTimeoutId = setTimeout(() => {
      if (cancelled) return;
      intervalId = setInterval(() => {
        if (cancelled) return;
        i += 1;
        setVisible(text.slice(0, i));
        if (i >= text.length) {
          if (intervalId) clearInterval(intervalId);
          onCompleteRef.current?.();
        }
      }, charDelay);
    }, startDelay);

    return () => {
      cancelled = true;
      clearTimeout(startTimeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, charDelay, startDelay]);

  return <Text style={style}>{visible}</Text>;
};

export default React.memo(TypingText);
