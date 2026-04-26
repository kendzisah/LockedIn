/**
 * Tiny color utilities for the HUD/streak system. Pure functions —
 * no React Native imports.
 */

/** Parse a #rrggbb hex string into [r, g, b]. Returns null on bad input. */
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Lighten a hex color by `amount` (0-1). 0.3 = 30 % toward white. */
export function lightenHex(hex: string, amount = 0.3): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const lr = r + (255 - r) * amount;
  const lg = g + (255 - g) * amount;
  const lb = b + (255 - b) * amount;
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
}
