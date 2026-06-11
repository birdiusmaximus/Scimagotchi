/**
 * Memory Ledger (engine brief §12) — the companion's emotional memory.
 *
 * The companion LEARNS automatically when something settled lands (a first
 * shape, a confirmed mixed structure, a correction worth not repeating, an
 * explicit "remember this"). These are saved on their own as `auto_learned`
 * cards — no Save / Edit / Not this prompt, since being asked every time felt
 * repetitive. Sensitive content is still never stored (memoryBlocked), and the
 * user can delete any memory. Retrieval feeds only active (auto-learned or
 * user-confirmed), un-muted, un-expired cards back into the prompt, phrased for
 * tentative callbacks ("last time you called this…"), never as facts.
 *
 * Pure module (no React/RN imports) so the eval harness can bundle and test it.
 */

import { classifySafety } from '@/services/ai/safetyClassifier';
import type { CompanionTurn } from '@/services/ai/companionEngine';
import type { EmotionEvent, EmotionFamilyId, MemoryCard } from '@/types/models';
import { nowIso } from '@/utils/date';
import { genId } from '@/utils/ids';

// ── Sensitivity blocking (§12.4 "avoid by default") ─────────────────────────

const SENSITIVE_CONTENT =
  /(diagnos|medication|antidepressant|prescri|therapist said|psychiatr|abuse|assault|rape|overdose|relapse|\bssri\b|\bptsd\b|\bocd\b|\badhd\b|bipolar|borderline|(hurt|harm|kill)(ing)? (myself|themselves|himself|herself)|self.?harm|suicid)/i;

/** True when this text must not become durable memory. */
export function memoryBlocked(text: string): boolean {
  if (!text.trim()) return true;
  if (classifySafety(text).level >= 2) return true; // crisis/hopeless content never becomes memory
  return SENSITIVE_CONTENT.test(text);
}

// ── Drafting rules (§12.3) ───────────────────────────────────────────────────

const REMEMBER_REQUEST = /(remember (this|that)|save (this|that)|keep (this|that)( one)?|dont forget (this|that))/;

function baseCard(over: Partial<MemoryCard>): MemoryCard {
  return {
    id: genId('mem'),
    created_at: nowIso(),
    updated_at: nowIso(),
    source_conversation_id: null,
    type: 'emotional_pattern',
    summary: '',
    user_words: [],
    emotion_family: null,
    confirmation_status: 'draft',
    sensitivity: 'low',
    retention: 'persistent_until_deleted',
    expires_at: null,
    muted: 0,
    ...over,
  };
}

/**
 * Decide whether this turn produces a memory-card DRAFT. Deterministic — the
 * model never writes memory; it only supplies the language (memory_note).
 * Returns null when nothing memory-worthy (or safe) landed.
 */
export function draftFromTurn(turn: CompanionTurn, userText: string, conversationId: string): MemoryCard | null {
  const ev = turn.event;
  if (ev.do_not_store === 1 || ev.safety_flag !== 'none') return null;

  const askedToRemember = REMEMBER_REQUEST.test(` ${userText.toLowerCase().replace(/[’']/g, '')} `);

  // 1) An explicit "remember this" — honour it with whatever is in play.
  if (askedToRemember) {
    const summary = ev.memory_note ?? (ev.user_words_raw ? `“${ev.user_words_raw}” felt worth keeping.` : null);
    if (!summary || memoryBlocked(summary) || memoryBlocked(userText)) return null;
    return baseCard({
      source_conversation_id: conversationId,
      type: ev.mixed_confirmed === 1 ? 'mixed_pattern' : 'emotional_pattern',
      summary,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family,
    });
  }

  // 2) A first shape just landed (unlock) with a model-written learning note.
  if (turn.unlocked && ev.memory_note && !memoryBlocked(ev.memory_note)) {
    return baseCard({
      source_conversation_id: conversationId,
      type: ev.mixed_confirmed === 1 ? 'mixed_pattern' : 'emotional_pattern',
      summary: ev.memory_note,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family,
    });
  }

  // 3) A confirmed mixed structure (even without unlock) is a distinction worth offering.
  if (ev.mixed_confirmed === 1 && ev.mixed_relation && ev.strands.length >= 2 && ev.memory_note && !memoryBlocked(ev.memory_note)) {
    return baseCard({
      source_conversation_id: conversationId,
      type: 'mixed_pattern',
      summary: ev.memory_note,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family,
    });
  }

  return null;
}

/**
 * A correction worth not repeating (§12.3): when the user rejects a label, the
 * rejection itself may be offered as memory ("'anxious' isn't their word for this").
 * Drafted only when the rejection is NEW this turn.
 */
export function draftFromRejection(
  newlyRejected: string[],
  family: EmotionFamilyId | null,
  conversationId: string,
): MemoryCard | null {
  const shade = newlyRejected[0];
  if (!shade || memoryBlocked(shade)) return null;
  return baseCard({
    source_conversation_id: conversationId,
    type: 'repair_instruction',
    summary: `“${shade}” isn’t the right word for this feeling — don’t offer it again.`,
    user_words: [],
    emotion_family: family,
    sensitivity: 'low',
  });
}

// ── Retrieval (§12.5) ────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  'the a an and or but so of to in on at for with about from is are was were be been im i me my it its this that just really very feel feels feeling felt like dont cant'.split(' '),
);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Active (auto-learned or user-confirmed), un-muted, un-expired cards — the only memory the companion may use. */
export function activeCards(all: MemoryCard[]): MemoryCard[] {
  const now = nowIso();
  return all.filter(
    (c) =>
      (c.confirmation_status === 'auto_learned' ||
        c.confirmation_status === 'user_confirmed' ||
        c.confirmation_status === 'user_edited') &&
      c.muted !== 1 &&
      (c.retention !== 'expires' || !c.expires_at || c.expires_at > now),
  );
}

/**
 * Pick the most relevant confirmed memories for this turn (max 3): same family
 * first, then word overlap with the user's message. Returns the prompt section
 * (with the tentative-callback rules) or null when nothing relevant exists.
 */
export function relevantMemory(all: MemoryCard[], userText: string, family: EmotionFamilyId | null): string | null {
  const cards = activeCards(all);
  if (!cards.length) return null;

  const t = tokens(userText);
  const scored = cards
    .map((c) => {
      let score = 0;
      if (family && c.emotion_family === family) score += 2;
      const ct = tokens(`${c.summary} ${c.user_words.join(' ')}`);
      for (const w of ct) if (t.has(w)) score += 1;
      if (c.type === 'repair_instruction' || c.type === 'do_not_suggest') score += 1; // corrections always matter
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!scored.length) return null;
  return scored
    .map(({ c }) => `- ${c.summary}${c.user_words.length ? ` (their words: “${c.user_words[0]}”)` : ''}`)
    .join('\n');
}
