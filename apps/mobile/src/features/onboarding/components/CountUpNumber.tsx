/**
 * CountUpNumber — animated integer count-up.
 *
 * Used on the Wake-Up Call screen (years lost) and the Stat Reveal (OVR
 * count-up from 0). Resets and re-runs whenever the target `value` changes.
 */

import React, { useEffect, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface CountUpNumberProps {
  /** Target integer to count up to. */
  value: number;
  /** Total animation duration in ms. Default 1200. */
  duration?: number;
  /** Optional fixed decimal places (default: 0 — pure integer). */
  decimals?: number;
  /** Delay before the count-up starts (e.g. wait for fade-in). */
  startDelay?: number;
  /** Optional formatter override (e.g. add a trailing unit). */
  format?: (value: number) => string;
  style?: StyleProp<TextStyle>;
}

const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  duration = 1200,
  decimals = 0,
  startDelay = 0,
  format,
  style,
}) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number | null = null;
    let cancelled = false;

    const start = Date.now() + startDelay;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      if (now < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic — fast start, soft landing
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    setDisplay(0);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [value, duration, startDelay]);

  const text = format
    ? format(display)
    : decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toString();

  return <Text style={style}>{text}</Text>;
};

export default React.memo(CountUpNumber);
