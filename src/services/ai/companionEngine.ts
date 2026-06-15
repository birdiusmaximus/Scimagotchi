/**
 * Local companion engine — the deterministic v0.1 implementation of the
 * conversation loop. It walks one stage per turn (Noticed → Named → Shaped →
 * Understood), reflecting the user's own words and asking a single question, per
 * the brief's rhythm (§5.2). It runs with no network, so the app demonstrates the
 * full loop offline; a cloud LLM can later implement the same `AiService` shape.
 *
 * The app — not the model — owns the state machine, unlock criteria and length.
 */

import { DETECTION_ORDER, EMOTION_MAPS, type EmotionMap, type TriggerRule } from '@/data/emotionMaps';
import type { EmotionEvent, EmotionFamilyId, OrbTone, UnlockStage } from '@/types/models';
import { nowIso } from '@/utils/date';
import { genId } from '@/utils/ids';

export interface CompanionTurn {
  reply: string;
  event: EmotionEvent;
  /** true on the turn the emotion reaches Understood (first shape) */
  unlocked: boolean;
  tone: OrbTone;
  stage: UnlockStage;
}

export interface CompanionInput {
  userText: string;
  prevEvent: EmotionEvent | null;
  conversationId: string;
  /** recent prior messages (excluding the current userText), for the cloud model */
  history?: { role: 'user' | 'companion'; content: string }[];
  /** compact digest of what the companion remembers about this person */
  memory?: string | null;
  userName?: string | null;
  /** safety-layer directive for this turn (post-check resume, dependency boundary) */
  safetyNote?: string | null;
  /** stance chosen at the door (home chip) — biases the first turn's conversation mode */
  entryHint?: import('@/services/ai/modeRouter').ConversationMode | null;
  /** a continuation chip the user tapped this turn ("stay with it" / "not quite" / "done") */
  intent?: import('@/services/ai/modeRouter').ChipIntent | null;
  /** true on the turn right after a "Not quite" correction — a one-turn No-Learning Zone
   *  that blocks unlock/deepen/memory so a correction can't be used as a learning shortcut */
  repairActive?: boolean | null;
  /** The user-owned FORMS the active family has taken before (the constellation, capped),
   *  so the cloud model can speak facet-aware ("different from the sports-shaped joy"). */
  activeFacets?: { form: string; domains: string[] }[] | null;
}

export function emptyEvent(conversationId: string): EmotionEvent {
  return {
    id: genId('evt'),
    conversation_id: conversationId,
    timestamp: nowIso(),
    user_words_raw: '',
    emotion_status: 'none',
    emotion_family: null,
    emotion_shade: null,
    secondary_emotions: [],
    valence: 'neutral',
    activation: 'medium',
    control_power: 'unknown',
    intensity: null,
    trigger_event: null,
    appraisal_thought: null,
    body_cue: [],
    behaviour_action: [],
    coping_response: [],
    outcome: null,
    social_context: [],
    need_value: [],
    confidence_level: 'low',
    evidence_basis: [],
    user_confirmation: 'unknown',
    label_source: null,
    shade_source: null,
    user_phrase: null,
    candidate_shade: null,
    user_rejected_shades: [],
    mixed_relation: null,
    strands: [],
    mixed_confirmed: 0,
    unlock_stage: 'noticed',
    memory_note: null,
    do_not_store: 0,
    safety_flag: 'none',
  };
}

const pad = (s: string) => ` ${s.toLowerCase()} `;

export function detectFamily(text: string): EmotionFamilyId | null {
  const t = pad(text);
  // Low-access flat idioms ("the volume is turned down", "behind glass", "going through the
  // motions") are multi-word + specific; let them win FIRST so a bare single word inside them
  // (e.g. sadness's "down" in "turned down") can't rush a flat state to a darker family (#3).
  const flatPhrases = EMOTION_MAPS.flat.familyKeywords.filter((k) => k.includes(' '));
  if (flatPhrases.some((k) => t.includes(k))) return 'flat';
  for (const id of DETECTION_ORDER) {
    if (EMOTION_MAPS[id].familyKeywords.some((k) => t.includes(k))) return id;
  }
  return null;
}

function matchShapeWord(map: EmotionMap, text: string): string | null {
  const t = pad(text);
  return map.shapeWords.find((w) => t.includes(w)) ?? null;
}

function matchTrigger(map: EmotionMap, text: string): TriggerRule | null {
  const t = pad(text);
  return map.triggerRules.find((r) => r.match.some((m) => t.includes(m))) ?? null;
}

function clone(ev: EmotionEvent): EmotionEvent {
  return {
    ...ev,
    secondary_emotions: [...ev.secondary_emotions],
    body_cue: [...ev.body_cue],
    behaviour_action: [...ev.behaviour_action],
    coping_response: [...ev.coping_response],
    social_context: [...ev.social_context],
    need_value: [...ev.need_value],
    evidence_basis: [...ev.evidence_basis],
    user_rejected_shades: [...(ev.user_rejected_shades ?? [])],
    strands: (ev.strands ?? []).map((s) => ({ ...s })),
  };
}

/**
 * A natural, open reply when no feeling is present (greeting / small talk). The
 * offline fallback can't truly converse, but it should sound present and not
 * fabricate an emotion out of a "hey". (Online, the LLM handles this richly.)
 */
function openingLine(text: string): string {
  const t = ` ${text.trim().toLowerCase()} `;
  const isGreeting = [' hi ', ' hey ', ' hello ', ' yo ', ' hiya ', ' heya ', ' morning ', ' evening ', ' sup '].some(
    (g) => t.includes(g),
  );
  if (isGreeting) return "Hey — it's good to see you. What's been going on for you today?";
  return "I'm here, and I'm listening. Tell me a little about what's on your mind.";
}

/**
 * Advance the conversation by one turn given the user's latest message and the
 * working emotion event so far. Returns the companion's reply and the updated
 * event. Pure and synchronous.
 */
export function nextTurn(userText: string, prev: EmotionEvent | null, conversationId: string): CompanionTurn {
  const ev = prev ? clone(prev) : emptyEvent(conversationId);
  ev.timestamp = nowIso();

  // ── Stage: family not yet known ────────────────────────────────────────────
  if (!ev.emotion_family) {
    const fam = detectFamily(userText);

    // No feeling in the message yet — just talk, naturally. Don't invent one.
    if (!fam) {
      ev.emotion_family = null;
      ev.emotion_status = 'none';
      ev.unlock_stage = 'noticed';
      ev.user_words_raw = userText.trim();
      return { reply: openingLine(userText), event: ev, unlocked: false, tone: 'calm', stage: 'noticed' };
    }

    // Genuine flatness/numbness was named — it's okay to gently ask about its shape.
    if (fam === 'flat') {
      const map = EMOTION_MAPS.flat;
      ev.emotion_family = 'flat';
      ev.emotion_status = 'unclear';
      ev.unlock_stage = 'noticed';
      ev.valence = map.valence;
      ev.activation = map.activation;
      ev.user_words_raw = userText.trim();
      ev.evidence_basis.push('sentiment');
      return { reply: map.shapeQuestion, event: ev, unlocked: false, tone: 'calm', stage: 'noticed' };
    }

    const map = EMOTION_MAPS[fam];
    ev.emotion_family = fam;
    ev.emotion_status = 'candidate';
    ev.unlock_stage = 'named';
    ev.valence = map.valence;
    ev.activation = map.activation;
    ev.user_words_raw = userText.trim();
    ev.label_source = 'user_stated'; // keyword detection literally matched their own word
    ev.evidence_basis.push('self_report');
    return { reply: map.shapeQuestion, event: ev, unlocked: false, tone: map.tone, stage: 'named' };
  }

  const map = EMOTION_MAPS[ev.emotion_family];
  const understood = ev.unlock_stage === 'understood' || ev.unlock_stage === 'deepened';

  // ── Stage: felt shape / body cue ───────────────────────────────────────────
  if (!understood && ev.body_cue.length === 0 && !ev.trigger_event) {
    const w = matchShapeWord(map, userText) ?? 'particular';
    ev.body_cue.push(w);
    ev.emotion_shade = ev.emotion_shade ?? map.defaultShade;
    ev.unlock_stage = 'shaped';
    ev.confidence_level = 'medium';
    ev.user_words_raw = userText.trim(); // the evocative felt-shape phrase
    if (!ev.evidence_basis.includes('body')) ev.evidence_basis.push('body');
    return {
      reply: `${map.shapeReflect(w)} ${map.triggerQuestion}`,
      event: ev,
      unlocked: false,
      tone: map.tone,
      stage: 'shaped',
    };
  }

  // ── Stage: trigger / meaning → Understood (first shape) ─────────────────────
  if (!understood && !ev.trigger_event) {
    const rule = matchTrigger(map, userText);
    const phrase = rule?.phrase ?? 'the situation you described';
    ev.trigger_event = userText.trim();
    ev.appraisal_thought = rule?.appraisal ?? 'Something here felt important to me.';
    if (rule?.shade) ev.emotion_shade = rule.shade;
    ev.emotion_shade = ev.emotion_shade ?? map.defaultShade;
    ev.need_value = [...map.needValue];
    ev.unlock_stage = 'understood';
    ev.emotion_status = 'confirmed';
    ev.user_confirmation = 'partial'; // confirmed implicitly by continued engagement
    ev.confidence_level = 'medium';
    if (!ev.evidence_basis.includes('appraisal')) ev.evidence_basis.push('appraisal');

    const familyWord = map.label.split(' ')[0].toLowerCase();
    const bodyWord = ev.body_cue[0] ?? 'particular';
    const shortTrig = rule?.short ?? 'this kind of moment';
    ev.memory_note = `This ${familyWord} can take a ${bodyWord} shape when you feel ${shortTrig}.`;

    return {
      reply: map.understood(ev.emotion_shade, phrase),
      event: ev,
      unlocked: true,
      tone: map.tone,
      stage: 'understood',
    };
  }

  // ── Already understood — gentle continue (never rushes the user) ───────────
  return {
    reply: 'Thank you for staying with this. We can keep exploring it, or leave it here for now — both are okay.',
    event: ev,
    unlocked: false,
    tone: map.tone,
    stage: ev.unlock_stage,
  };
}
