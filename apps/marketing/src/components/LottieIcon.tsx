import { useEffect, useRef } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import type { CSSProperties } from 'react';

interface Props {
  src: string;
  width?: number;
  height?: number;
  loop?: boolean;
  autoplay?: boolean;
  style?: CSSProperties;
}

/**
 * Renders a Lottie animation from a JSON URL using lottie-web.
 * Renders to SVG so html-to-image can capture it for PNG export.
 */
export default function LottieIcon({
  src,
  width = 22,
  height = 22,
  loop = true,
  autoplay = true,
  style,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop,
      autoplay,
      path: src,
    });

    return () => {
      animRef.current?.destroy();
    };
  }, [src, loop, autoplay]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        flexShrink: 0,
        display: 'inline-flex',
        ...style,
      }}
    />
  );
}
