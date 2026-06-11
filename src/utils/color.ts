/** Tiny colour helpers for mixing solid emotion colour into the glass UI. */

/** A hex colour (#rgb or #rrggbb) at the given alpha, as an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** A two-stop vertical gradient from a single colour — a soft solid for hero shapes. */
export function tintPair(hex: string): [string, string] {
  return [withAlpha(hex, 0.95), withAlpha(hex, 0.78)];
}

/** Parse #rgb / #rrggbb into [r,g,b]. */
function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A darker shade of a colour (mixed toward black by `amount` 0..1) at an optional alpha. */
export function shade(hex: string, amount = 0.25, alpha = 1): string {
  const [r, g, b] = rgb(hex);
  const k = 1 - amount;
  return `rgba(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)}, ${alpha})`;
}
