/**
 * Scimagotchi design tokens.
 *
 * The visual language is "dreamy glass": soft pastel gradient washes, floating
 * blurred colour blobs, frosted-glass surfaces, and a glowing gradient companion
 * orb. Derived from the v0.1 visual reference and moodboard.
 */

import { Platform } from 'react-native';

export const palette = {
  // Background wash — a richer lavender → orchid → periwinkle → soft blue, closer
  // to the glassmorphic reference field (still airy; blur + blobs do the rest).
  bgTop: '#E7E0FF',
  bgUpperMid: '#EFE2FB',
  bgLowerMid: '#E3E8FF',
  bgBottom: '#DEE8FF',

  // Floating background blobs — more saturated pinks/violets/blues for the
  // vivid dreamy wash of the references.
  blobPink: '#FFA8D8',
  blobMagenta: '#FB7FC6',
  blobViolet: '#B196FF',
  blobPeriwinkle: '#98B4FF',
  blobMint: '#CCEAFF',

  // Companion orb gradient stops
  orbViolet: '#7C5CF2',
  orbIndigo: '#5667F2',
  orbBlue: '#5C92F1',
  orbMagenta: '#B884F2',
  orbHighlight: '#EEF3FF',

  // Ink / text
  ink: '#3C3A6B', // headings, muted indigo-navy
  inkSoft: '#6E6C9B', // secondary text
  inkOnGlass: '#46447A', // text on frosted glass

  // Glass surfaces
  glassFill: 'rgba(255,255,255,0.42)',
  glassFillStrong: 'rgba(255,255,255,0.58)',
  glassFillSoft: 'rgba(255,255,255,0.30)',
  glassBorder: 'rgba(255,255,255,0.65)',
  glassBorderSoft: 'rgba(255,255,255,0.45)',

  // Accent (interactive bits, active states) — a vivid violet that ties the
  // glass UI to the companion's own hue.
  accent: '#8E78EE',
  accentDeep: '#6B57E8',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/**
 * The signature reference gradient: pink → violet → periwinkle-blue. Used on
 * primary CTAs, the user's chat bubbles, and hero surfaces across the app.
 */
const BRAND_GRADIENT = ['#FB7BC4', '#9E6CF1', '#6A88F3'] as const;

/** LinearGradient colour arrays */
export const gradients = {
  background: [palette.bgTop, palette.bgUpperMid, palette.bgLowerMid, palette.bgBottom],
  // Calm default orb: violet (top) → indigo → vivid blue (bottom). DO NOT CHANGE —
  // the companion avatar stays exactly as designed.
  orbCalm: ['#9A6CF2', '#6E5BF2', '#5566F2', '#4F8BF5'],
  // Warmer orb for Anger & Protest (used later by the emotion system)
  orbAnger: ['#F2A26B', '#F0686B', '#E0566B', '#C0506B'],
  // Vivid pink→violet→blue for CTAs, user bubbles, hero cards.
  brand: BRAND_GRADIENT,
  brandSoft: ['#FBA8D8', '#B79BF4', '#93AEF6'] as const,
  accentButton: BRAND_GRADIENT,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
  full: 9999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 44,
} as const;

/**
 * Rounded, friendly system font. On the web preview this resolves to SF Pro
 * Rounded (via the --font-rounded CSS variable defined in global.css); on iOS it
 * falls back to the system face. Keeps copy soft and non-clinical.
 */
export const fontFamily = Platform.select({
  web: 'var(--font-rounded)',
  default: undefined,
}) as string | undefined;

/**
 * Display face for headings/branding — the Eixample family from the Typekit kit
 * (web). On native it falls back to the system face until the licensed font files
 * are bundled (Typekit delivers web fonts only).
 */
export const fontFamilyDisplay = Platform.select({
  web: 'var(--font-display)',
  default: undefined,
}) as string | undefined;

export const type = {
  h1: { fontSize: 24, fontWeight: '600' as const, lineHeight: 30 },
  subtitle: { fontSize: 21, fontWeight: '500' as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '500' as const, lineHeight: 18 },
  chip: { fontSize: 14, fontWeight: '500' as const, lineHeight: 18 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
} as const;
