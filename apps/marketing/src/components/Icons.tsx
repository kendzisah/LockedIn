import type { CSSProperties } from 'react';

/**
 * MaterialIcon — renders a Google Material Icons font glyph.
 * Matches the @expo/vector-icons MaterialIcons used in the mobile app.
 */
export function MaterialIcon({
  name,
  size = 20,
  color = '#9CA3AF',
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="material-icons"
      style={{
        fontSize: size,
        color,
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      }}
    >
      {name}
    </span>
  );
}

/**
 * Ionicon SVG icons — only the ones actually used in the app templates.
 */

interface SvgProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function IonShield({ size = 16, color = '#9CA3AF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill={color} style={style}>
      <path d="M256 0c4.6 0 9.2 1 13.4 2.8L457.7 82c8.3 3.7 13.7 11.8 14.2 20.8 3.8 71.6-13.7 176.3-78.4 251.1C334.4 426.8 268 480 256 480s-78.4-53.2-137.5-126.1C53.8 279.1 36.3 174.4 40.1 102.8c.5-9 5.9-17.1 14.2-20.8L242.6 2.8C246.8 1 251.4 0 256 0z" />
    </svg>
  );
}

export function IonFlash({ size = 16, color = '#00C2FF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill={color} style={style}>
      <path d="M315.27 33L96 304h128l-31.51 173.23a2.36 2.36 0 002.33 2.77 2.36 2.36 0 001.89-.95L416 208H288l31.66-173.25a2.45 2.45 0 00-2.44-2.75 2.42 2.42 0 00-1.95 1z" />
    </svg>
  );
}

export function IonCalendarOutline({ size = 16, color = '#00C2FF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="48" y="80" width="416" height="384" rx="48" />
      <line x1="128" y1="48" x2="128" y2="80" />
      <line x1="384" y1="48" x2="384" y2="80" />
      <line x1="464" y1="160" x2="48" y2="160" />
    </svg>
  );
}

export function IonCheckmark({ size = 10, color = '#fff', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="64" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="416,128 192,384 96,288" />
    </svg>
  );
}

export function IonClose({ size = 10, color = '#FF4757', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="64" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="368" y1="368" x2="144" y2="144" />
      <line x1="368" y1="144" x2="144" y2="368" />
    </svg>
  );
}

export function IonTimerOutline({ size = 18, color = '#3A66FF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M256 80C161.63 80 85 156.63 85 251c0 94.37 76.63 171 171 171s171-76.63 171-171c0-94.37-76.63-171-171-171z" />
      <path d="M256 131v120h120" />
      <line x1="256" y1="48" x2="256" y2="80" />
      <line x1="192" y1="64" x2="192" y2="80" />
      <line x1="320" y1="64" x2="320" y2="80" />
    </svg>
  );
}

export function IonShieldCheckmarkOutline({ size = 18, color = '#B0A0FF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M256 48C196.4 48 157.7 67.5 136.2 79.6c-5.7 3.2-13 7.4-17.3 10.2l-.5.3C106.3 97.8 96 110.7 96 128v138.8c0 71.4 60.9 161.3 160 197.2 99.1-35.9 160-125.8 160-197.2V128c0-17.3-10.3-30.2-22.4-37.9l-.5-.3c-4.3-2.8-11.6-7-17.3-10.2C354.3 67.5 315.6 48 256 48z" />
      <polyline points="352 176 232 304 160 240" />
    </svg>
  );
}

export function IonHeartOutline({ size = 18, color = '#FF6B81', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M352.92 80C288 80 256 144 256 144s-32-64-96.92-64c-52.76 0-94.54 44.14-95.08 96.81-1.1 109.33 86.73 187.08 183 252.42a16 16 0 0018 0c96.26-65.34 184.09-143.09 183-252.42-.54-52.67-42.32-96.81-95.08-96.81z" />
    </svg>
  );
}

export function IonPeopleOutline({ size = 12, color = '#6B7280', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M402 168c-2.93 40.67-33.1 72-66 72s-63.12-31.32-66-72c-3-42.31 26.37-72 66-72s69 30.46 66 72z" />
      <path d="M336 304c-65.17 0-127.84 32.37-143.54 95.41-2.08 8.34 3.15 16.59 11.72 16.59h263.65c8.57 0 13.77-8.25 11.72-16.59C463.85 336.36 401.18 304 336 304z" />
      <path d="M200 185.94c-2.34 32.48-26.72 58.06-53 58.06s-50.7-25.57-53-58.06C91.61 152.15 115.34 128 147 128s55.39 24.77 53 57.94z" />
      <path d="M206 306c-18.05-8.27-37.93-11.45-59-11.45-52 0-102.1 25.85-114.65 76.2C30.7 377.41 35.88 384 44.14 384H152" />
    </svg>
  );
}

export function IonAdd({ size = 22, color = '#3A66FF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="256" y1="112" x2="256" y2="400" />
      <line x1="400" y1="256" x2="112" y2="256" />
    </svg>
  );
}

export function IonEnterOutline({ size = 18, color = '#00C2FF', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M176 176v-40a40 40 0 0140-40h208a40 40 0 0140 40v240a40 40 0 01-40 40H216a40 40 0 01-40-40v-40" />
      <polyline points="272 336 352 256 272 176" />
      <line x1="48" y1="256" x2="336" y2="256" />
    </svg>
  );
}

export function IonBarbellOutline({ size = 18, color = '#00D68F', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="48" y1="256" x2="464" y2="256" />
      <rect x="384" y="128" width="32" height="256" rx="16" />
      <rect x="96" y="128" width="32" height="256" rx="16" />
      <rect x="432" y="176" width="32" height="160" rx="16" />
      <rect x="48" y="176" width="32" height="160" rx="16" />
    </svg>
  );
}

export function IonFlameIcon({ size = 12, color = '#00D68F', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill={color} style={style}>
      <path d="M256 32c-8 128-112 176-112 272a112 112 0 00224 0c0-96-104-144-112-272z" />
    </svg>
  );
}

export function IonCheckmarkCircle({ size = 18, color = '#fff', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill={color} style={style}>
      <path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29l-134.4 160a16 16 0 01-12 5.71h-.27a16 16 0 01-11.89-5.3l-57.6-64a16 16 0 1123.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0124.5 20.58z" />
    </svg>
  );
}

export function IonFitnessOutline({ size = 18, color = '#00D68F', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M352.92 80C288 80 256 144 256 144s-32-64-96.92-64c-52.76 0-94.54 44.14-95.08 96.81-1.1 109.33 86.73 187.08 183 252.42a16 16 0 0018 0c96.26-65.34 184.09-143.09 183-252.42-.54-52.67-42.32-96.81-95.08-96.81z" />
      <path d="M256 192v128" />
      <path d="M192 256h128" />
    </svg>
  );
}

export function IonChevronForward({ size = 18, color = '#6B7280', style }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="184 112 328 256 184 400" />
    </svg>
  );
}
