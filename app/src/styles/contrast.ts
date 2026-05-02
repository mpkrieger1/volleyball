// Sprint 21: WCAG 2.1 contrast helpers. Pure utilities for unit-testing the
// design tokens. WCAG AA requires:
//   • 4.5:1 for normal text
//   • 3:1 for large text (>= 18pt or 14pt bold) and UI components

/** Parse a hex color "#RRGGBB" or "#RGB" to {r,g,b} channels 0..255. */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** WCAG relative luminance for sRGB. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (c: number): number => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two hex colors. Returns ≥1.0. */
export function wcagContrast(fg: string, bg: string): number {
  const lf = relativeLuminance(fg);
  const lb = relativeLuminance(bg);
  const [hi, lo] = lf > lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

/** Round contrast to 2 decimals for human-readable assertion errors. */
export function roundContrast(c: number): number {
  return Math.round(c * 100) / 100;
}
