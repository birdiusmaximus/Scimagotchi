/**
 * Mixed Emotion Engine (engine brief §9) — deterministic rules around the
 * model's strand extraction. The principle: never gate the user's ability to
 * FEEL mixed emotions (the model may propose strands freely); gate only the
 * companion's confidence in NAMING and REMEMBERING them (§9.3).
 */

import type { EmotionEvent, EmotionFamilyId, EmotionStrand } from '@/types/models';

const FAMILIES: EmotionFamilyId[] = ['joy', 'calm', 'fear', 'pressure', 'anger', 'sadness', 'hurt', 'shame', 'flat'];
const SALIENCES = ['foreground', 'background', 'equal', 'unclear'] as const;
const SOURCES = ['user_stated', 'user_confirmed', 'companion_hypothesis'] as const;

/** Validate + bound the model's strand output: known families only, deduped, max 3. */
export function sanitizeStrands(raw: unknown): EmotionStrand[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<EmotionFamilyId>();
  const out: EmotionStrand[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const s = r as Record<string, unknown>;
    const family = s.family as EmotionFamilyId;
    if (!FAMILIES.includes(family) || seen.has(family)) continue;
    seen.add(family);
    out.push({
      family,
      shade: typeof s.shade === 'string' && s.shade.trim() ? s.shade.trim() : null,
      salience: SALIENCES.includes(s.salience as (typeof SALIENCES)[number])
        ? (s.salience as EmotionStrand['salience'])
        : 'unclear',
      source: SOURCES.includes(s.source as (typeof SOURCES)[number])
        ? (s.source as EmotionStrand['source'])
        : 'companion_hypothesis',
    });
    if (out.length === 3) break;
  }
  return out;
}

/**
 * §9.3 save rule — a mixed structure is CONFIRMED (and may be saved/counted) only when:
 *  - both/all strands are user-owned (stated or explicitly confirmed), OR
 *  - the same strand families recurred from the previous turn AND the user
 *    affirmed the companion's phrasing this turn (user_confirmation === 'yes').
 * Otherwise it remains a proposal the companion holds tentatively.
 */
export function mixedConfirmed(ev: EmotionEvent, prev: EmotionEvent | null): boolean {
  const strands = ev.strands ?? [];
  if (strands.length < 2 || !ev.mixed_relation) return false;

  const allOwned = strands.every((s) => s.source === 'user_stated' || s.source === 'user_confirmed');
  if (allOwned) return true;

  const prevStrands = prev?.strands ?? [];
  if (prevStrands.length >= 2 && ev.user_confirmation === 'yes') {
    const a = new Set(strands.map((s) => s.family));
    const b = new Set(prevStrands.map((s) => s.family));
    if (a.size === b.size && [...a].every((f) => b.has(f))) return true;
  }

  return false;
}
