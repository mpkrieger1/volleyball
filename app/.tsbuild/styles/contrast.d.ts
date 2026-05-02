/** Parse a hex color "#RRGGBB" or "#RGB" to {r,g,b} channels 0..255. */
export declare function parseHex(hex: string): {
    r: number;
    g: number;
    b: number;
};
/** WCAG relative luminance for sRGB. */
export declare function relativeLuminance(hex: string): number;
/** Contrast ratio between two hex colors. Returns ≥1.0. */
export declare function wcagContrast(fg: string, bg: string): number;
/** Round contrast to 2 decimals for human-readable assertion errors. */
export declare function roundContrast(c: number): number;
//# sourceMappingURL=contrast.d.ts.map