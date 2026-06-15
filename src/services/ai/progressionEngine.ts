/**
 * Progression Engine (engine brief §13) — per-family emotional progression
 * across sessions, replacing the simple unlock walk at the progress level.
 *
 *   unseen → noticed → named → first_shape → rooted → distinguished → returning → deepened
 *
 * Principles encoded here:
 * - Progress is evidence-based and USER-owned: hypotheses never advance naming.
 * - User correction counts as progress (a rejection is differentiating work).
 * - Uncertainty counts as progress ("something is off" + a body word is noticing).
 * - Stages are monotonic and never advance during safety-sensitive turns.
 * - Nothing here is a grade — stage names are internal mechanics; UI copy stays kind.
 *
 * Pure module (no React/RN) so the eval harness can bundle and test it.
 */

import type { CompanionTurn } from '@/services/ai/companionEngine';
import type { EmotionalCapability, EmotionProgress, EmotionProgressStage } from '@/types/models';
import { nowIso } from '@/utils/date';
import { genId } from '@/utils/ids';

export const PROGRESS_RANK: Record<EmotionProgressStage, number> = {
  unseen: 0,
  noticed: 1,
  named: 2,
  first_shape: 3,
  rooted: 4,
  distinguished: 5,
  returning: 6,
  deepened: 7,
};

/** Map legacy 5-stage rows (and unknown values) onto the 8-stage model. */
export function migrateStage(stage: string | undefined | null): EmotionProgressStage {
  switch (stage) {
    case 'noticed':
    case 'named':
    case 'first_shape':
    case 'rooted':
    case 'distinguished':
    case 'returning':
    case 'deepened':
      return stage;
    case 'shaped':
      return 'named'; // a felt shape existed but was never user-confirmed
    case 'understood':
      return 'first_shape';
    default:
      return 'unseen';
  }
}

export function emptyProgress(family: EmotionProgress['emotion_family']): EmotionProgress {
  return {
    id: family,
    emotion_family: family,
    current_stage: 'unseen',
    introduced_at: nowIso(),
    first_shape_at: null,
    rooted_at: null,
    distinguished_at: null,
    returning_at: null,
    deepened_at: null,
    return_count: 0,
    last_conversation_id: null,
    confirmed_shades: [],
    common_triggers: [],
    common_body_cues: [],
    common_user_phrases: [],
    facets: [],
    memory_summary: null,
    updated_at: nowIso(),
  };
}

// A vague/not-located word is never a facet form (mirrors stage.VAGUE_SHADE).
const VAGUE_FORM = /^(foggy|fog|blurry|blurred|hazy|fuzzy|murky|cloudy|unclear|undefined|vague|off|weird|strange|odd|funny|something|blank|numbish)$/i;

/** The user-owned word for this turn's FORM of the emotion (owned shade, else a short
 *  owned phrase), or null when nothing the user owns names a form. */
function facetForm(ev: CompanionTurn['event']): string | null {
  const ownedShade = ev.emotion_shade && (ev.shade_source === 'user_stated' || ev.shade_source === 'user_confirmed');
  if (ownedShade && !VAGUE_FORM.test(ev.emotion_shade!.trim())) return ev.emotion_shade!.toLowerCase().trim();
  const phrase = (ev.user_phrase ?? '').trim();
  if (phrase && phrase.split(/\s+/).filter(Boolean).length >= 2 && !VAGUE_FORM.test(phrase)) return phrase.toLowerCase().slice(0, 60);
  return null;
}

/**
 * Grow the emotion's constellation (review #9/#10) from a user-owned turn. Vertical:
 * a form already known gains more detail (body cue, domain, meaning) + a count. Horizontal:
 * a new form becomes a new facet, never replacing the earlier ones. Only user-owned forms
 * are recorded — companion hypotheses and echoes never become a facet. Pure; returns a new array.
 */
export function updateFacets(facets: EmotionProgress['facets'], ev: CompanionTurn['event'], stamp = nowIso()): EmotionProgress['facets'] {
  const form = facetForm(ev);
  if (!form) return facets;
  const out = facets.map((f) => ({ ...f, domains: [...f.domains], body_cues: [...f.body_cues], meanings: [...f.meanings] }));
  const add = (arr: string[], v: string | null | undefined) => {
    const s = (v ?? '').trim();
    if (s && !arr.some((x) => x.toLowerCase() === s.toLowerCase())) arr.push(s);
  };
  const existing = out.find((f) => f.form === form);
  if (existing) {
    existing.count += 1;
    existing.last_seen = stamp;
    add(existing.domains, ev.trigger_event);
    (ev.body_cue ?? []).forEach((b) => add(existing.body_cues, b));
    add(existing.meanings, ev.appraisal_thought);
  } else {
    out.push({
      id: genId('facet'),
      form,
      domains: ev.trigger_event ? [ev.trigger_event] : [],
      body_cues: [...(ev.body_cue ?? [])],
      meanings: ev.appraisal_thought ? [ev.appraisal_thought] : [],
      count: 1,
      first_seen: stamp,
      last_seen: stamp,
    });
  }
  return out;
}

function pushUnique(arr: string[], value: string | null | undefined) {
  const v = (value ?? '').trim();
  if (v && !arr.includes(v)) arr.push(v);
}

export interface AdvanceResult {
  progress: EmotionProgress;
  /** Stage actually moved forward this turn. */
  advanced: boolean;
  from: EmotionProgressStage;
  to: EmotionProgressStage;
  /** Capability evidence observed this turn (counter increments). */
  capabilities: Partial<Record<EmotionalCapability, number>>;
}

/**
 * Advance one family's progression from this turn's evidence. Deterministic;
 * the caller persists the returned row. `suppress` (safety-sensitive turn)
 * still records arrival of the family but never advances the stage.
 */
export function advanceProgress(
  existing: EmotionProgress | null,
  turn: CompanionTurn,
  conversationId: string,
  opts: { suppress?: boolean } = {},
): AdvanceResult {
  const ev = turn.event;
  const family = ev.emotion_family;
  if (!family) {
    // No family in play — still capability evidence if they noticed *something*.
    const caps: AdvanceResult['capabilities'] = {};
    if (ev.body_cue.length > 0 || ev.user_words_raw) caps.noticing = 1;
    const p = existing ?? null;
    return {
      progress: p ?? emptyProgress('flat'), // unused by caller when family is null
      advanced: false,
      from: p?.current_stage ?? 'unseen',
      to: p?.current_stage ?? 'unseen',
      capabilities: caps,
    };
  }

  const p: EmotionProgress = existing
    ? {
        ...existing,
        confirmed_shades: [...existing.confirmed_shades],
        common_triggers: [...existing.common_triggers],
        common_body_cues: [...existing.common_body_cues],
        common_user_phrases: [...existing.common_user_phrases],
        facets: existing.facets ? [...existing.facets] : [], // migration-safe for rows saved before facets existed
      }
    : emptyProgress(family);
  const from = migrateStage(p.current_stage);
  p.current_stage = from;

  const owned = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';
  const confirmedNow = ev.label_source === 'user_confirmed' || ev.user_confirmation === 'yes';
  const hasContext = !!ev.trigger_event || !!ev.appraisal_thought;
  const rejectedSomething = (ev.user_rejected_shades ?? []).length > 0;
  const mixedNow = ev.mixed_confirmed === 1;

  // ── Returning bookkeeping: count distinct conversations once each ──────────
  const newConversation = p.last_conversation_id !== null && p.last_conversation_id !== conversationId;
  if (p.last_conversation_id !== conversationId) {
    if (newConversation) p.return_count += 1;
    p.last_conversation_id = conversationId;
  }

  // ── Capability evidence (§13.1) — counted even when the stage can't move ───
  const caps: AdvanceResult['capabilities'] = {};
  caps.noticing = 1; // the feeling is on the table at all
  if (owned) caps.naming = 1;
  if (rejectedSomething || (ev.strands ?? []).length >= 2) caps.differentiating = 1;
  if (hasContext && owned) caps.contextualising = 1;
  if (mixedNow) caps.integrating = 1;

  // ── Stage ladder (§13.3) — monotonic; each stage carries its own
  // prerequisites, so a turn may legitimately skip intermediates (e.g. a
  // first-shaped feeling that re-appears owned in a new conversation goes
  // straight to Returning). Suppressed (safety-sensitive) turns never advance.
  let to = from;
  if (!opts.suppress) {
    const firstShapeNow = turn.unlocked || ev.unlock_stage === 'understood';
    // Deepening (rooted+) requires a first shape that was ALREADY established on a
    // prior turn — never the same turn it first shapes. This makes progression
    // evidence-led: a feeling can first-shape from a rich message, but it cannot
    // also jump to distinguished/deepened in one turn (benchmark §14.7). The
    // legitimate cross-conversation first_shape→returning leap is preserved because
    // those turns start from an already-stored first_shape.
    const alreadyShaped = PROGRESS_RANK[from] >= PROGRESS_RANK.first_shape;
    const returningNow = alreadyShaped && p.return_count >= 1 && owned;
    const reachedReturning = PROGRESS_RANK[from] >= PROGRESS_RANK.returning || returningNow;

    // Deep stages additionally require a USER-OWNED label (user_stated/user_confirmed):
    // a companion hypothesis or a bare "yes" can guide questions but must never
    // drive durable deepening (recommendations brief §3).
    const candidates: [EmotionProgressStage, boolean][] = [
      ['noticed', true], // family appeared (even as hypothesis)
      ['named', owned],
      ['first_shape', firstShapeNow],
      ['rooted', alreadyShaped && owned && hasContext && confirmedNow],
      ['distinguished', alreadyShaped && owned && (rejectedSomething || mixedNow)], // "not X, more Y" / confirmed mix
      ['returning', returningNow],
      // §13.5: a returned feeling plus integrative, user-owned evidence — mixed
      // structure, need/value, a fresh distinction, or confirmed similarity.
      ['deepened', reachedReturning && owned && (mixedNow || ev.need_value.length > 0 || rejectedSomething || confirmedNow)],
    ];
    for (const [stage, met] of candidates) {
      if (met && PROGRESS_RANK[stage] > PROGRESS_RANK[to]) to = stage;
    }
  }

  if (PROGRESS_RANK[to] > PROGRESS_RANK[from]) {
    p.current_stage = to;
    const stamp = nowIso();
    if (to === 'first_shape' && !p.first_shape_at) p.first_shape_at = stamp;
    if (to === 'rooted' && !p.rooted_at) p.rooted_at = stamp;
    if (to === 'distinguished' && !p.distinguished_at) p.distinguished_at = stamp;
    if (to === 'returning' && !p.returning_at) p.returning_at = stamp;
    if (to === 'deepened' && !p.deepened_at) p.deepened_at = stamp;
  }

  // ── Accumulate the family's vocabulary on meaningful (unlocked) turns ──────
  if (turn.unlocked) {
    // §6.3: only a USER-OWNED shade is stored as confirmed; a companion hypothesis
    // is never written to the record as the user's truth.
    const shadeOwned = ev.shade_source === 'user_stated' || ev.shade_source === 'user_confirmed';
    if (shadeOwned) pushUnique(p.confirmed_shades, ev.emotion_shade);
    pushUnique(p.common_triggers, ev.trigger_event);
    ev.body_cue.forEach((b) => pushUnique(p.common_body_cues, b));
    // §6.3: the user's exact phrase is the primary memory, preferred over taxonomy.
    pushUnique(p.common_user_phrases, ev.user_phrase ?? ev.user_words_raw);
    if (ev.memory_note) p.memory_summary = ev.memory_note;
  }

  // Grow the constellation (review #9/#10): a user-owned turn adds/enriches a form of
  // this emotion. self-gated to owned shade/phrase, so echoes/hypotheses never create one.
  if (!opts.suppress) p.facets = updateFacets(p.facets, ev);

  p.updated_at = nowIso();
  return { progress: p, advanced: PROGRESS_RANK[to] > PROGRESS_RANK[from], from, to, capabilities: caps };
}

export interface StrandAdvance {
  /** Per-family advancement results — the primary first, then any secondary strands. */
  results: AdvanceResult[];
  /** The primary family's result (the one that fires unlock/deepening ceremonies). */
  primary: AdvanceResult | null;
  /** The deepest stage reached this turn across all strands (so a landing feeling on a
   *  new strand never reads as the conversation regressing). */
  deepest: EmotionProgressStage;
}

/** Families this turn touches: the primary plus any named strands (deduped, in order). */
export function turnStrandFamilies(ev: CompanionTurn['event']): EmotionProgress['emotion_family'][] {
  const out: EmotionProgress['emotion_family'][] = [];
  if (ev.emotion_family) out.push(ev.emotion_family);
  for (const s of ev.strands ?? []) if (s.family && !out.includes(s.family)) out.push(s.family);
  return out;
}

/**
 * Strand-aware progression (the "emotions move" model, §13 extension). A conversation
 * is rarely one feeling: pressure opens into shame, anger into hurt, joy into pride.
 * This advances EVERY strand the turn surfaces, not just the primary, so a feeling that
 * appears underneath another is recorded and never lost when the focus shifts:
 *  - the PRIMARY family gets the full evidence-based advancement (advanceProgress);
 *  - each additional strand is tracked at `noticed` (present) or `named` (when the user
 *    owns it), monotonically — a strand already carried deeper is never lowered, and a
 *    new landing feeling becomes its OWN strand instead of regressing the original one.
 * Secondary strands never first-shape here (that needs the turn's full felt evidence,
 * which belongs to the primary); they hold their own stage until they become primary.
 */
export function advanceStrands(
  existing: Partial<Record<EmotionProgress['emotion_family'], EmotionProgress | null>>,
  turn: CompanionTurn,
  conversationId: string,
  opts: { suppress?: boolean } = {},
): StrandAdvance {
  const ev = turn.event;
  const primaryFam = ev.emotion_family;
  const results: AdvanceResult[] = [];
  let primary: AdvanceResult | null = null;

  if (primaryFam) {
    primary = advanceProgress(existing[primaryFam] ?? null, turn, conversationId, opts);
    results.push(primary);
  }

  if (!opts.suppress) {
    const seen = new Set(primaryFam ? [primaryFam] : []);
    for (const s of ev.strands ?? []) {
      if (!s.family || seen.has(s.family)) continue;
      seen.add(s.family);
      const prev = existing[s.family] ?? emptyProgress(s.family);
      const from = migrateStage(prev.current_stage);
      const owned = s.source === 'user_stated' || s.source === 'user_confirmed';
      const cand: EmotionProgressStage = owned ? 'named' : 'noticed';
      const to = PROGRESS_RANK[cand] > PROGRESS_RANK[from] ? cand : from; // monotonic
      const p: EmotionProgress = {
        ...prev,
        confirmed_shades: [...prev.confirmed_shades],
        common_triggers: [...prev.common_triggers],
        common_body_cues: [...prev.common_body_cues],
        common_user_phrases: [...prev.common_user_phrases],
        facets: prev.facets ? [...prev.facets] : [], // secondary strands keep their constellation
        current_stage: to,
        last_conversation_id: conversationId,
        updated_at: nowIso(),
      };
      results.push({ progress: p, advanced: to !== from, from, to, capabilities: {} });
    }
  }

  const deepest = results.reduce<EmotionProgressStage>((d, r) => (PROGRESS_RANK[r.to] > PROGRESS_RANK[d] ? r.to : d), 'unseen');
  return { results, primary, deepest };
}
