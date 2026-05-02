// Deterministic monogram placeholder for any team missing a real logo.
// Pure function — takes a team abbreviation + primary color, returns an SVG string.

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function placeholderSvg(abbr: string, primaryColor: string): string {
  if (!HEX_RE.test(primaryColor)) {
    throw new Error(`placeholderSvg: primaryColor must be "#RRGGBB", got "${primaryColor}"`);
  }
  const label = abbr.trim().toUpperCase().slice(0, 4);
  if (!label) throw new Error('placeholderSvg: abbr is required');

  // Font size scales down as label gets longer so 2–4 chars all fit.
  const fontSize = label.length <= 2 ? 64 : label.length === 3 ? 52 : 42;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="',
    label,
    ' logo placeholder">',
    '<rect width="128" height="128" rx="12" fill="',
    primaryColor,
    '"/>',
    '<text x="64" y="64" text-anchor="middle" dominant-baseline="central" ',
    'font-family="system-ui, sans-serif" font-weight="700" font-size="',
    String(fontSize),
    '" fill="#ffffff">',
    label,
    '</text>',
    '</svg>',
  ].join('');
}

export function placeholderDataUri(abbr: string, primaryColor: string): string {
  const svg = placeholderSvg(abbr, primaryColor);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
