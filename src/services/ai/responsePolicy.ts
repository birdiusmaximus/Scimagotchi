/**
 * Response Composer policy helpers (engine brief §7). Deterministic, derived
 * from conversation history — no extra state to thread through the store.
 * The signals feed the per-turn directive block; the model composes within it.
 */

export const RESPONSE_SHAPES = [
  'direct_mirror',
  'specific_phrase_echo',
  'tentative_hypothesis',
  'contrastive_reflection',
  'no_question_witnessing',
  'open_follow_up',
  'two_option_distinction',
  'mixed_emotion_holding',
  'body_invitation',
  'repair_acknowledgement',
  'learning_statement',
  'gentle_close',
] as const;

export type ResponseShape = (typeof RESPONSE_SHAPES)[number];

/** Stems that must never dominate (brief §7.5). */
export const OVERUSED_STEMS = ['that sounds', 'it sounds', 'that feels', 'it makes sense', 'that makes sense', 'i hear that'];

/** First few words of a reply, normalised — used to detect repeated openers. */
export function openingStem(reply: string, words = 3): string {
  return reply
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, words)
    .join(' ');
}

export interface VarietySignals {
  lastOpeners: string[]; // opening stems of the last two companion replies
  overusedOpener: string | null; // a stem both recent replies share / an overused stem just used
  questionStreak: number; // consecutive most-recent companion replies that asked a question
  menuStreak: number; // consecutive most-recent replies shaped "more X, Y, or Z?"
  quoteFirstInLast3: number; // replies in the last 3 that opened by quoting the user back
  eitherOrInLast3: number; // "is it more X or Y?" two-option questions in the last 3
  centrePhrasesInConvo: number; // scaffold phrases ("centre of this", "packed into that") used so far
}

const MENU_RX = /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i;
// Two-option "is it more X or Y?" question (the either/or scaffold, §5.2).
const EITHER_OR_RX = /\bis it (more |closer to |really )?[\w'’\s]+\bor\b[\w'’\s]+\?/i;
// The recognisable "centre of this" scaffold family (§5.2 banned phrases).
const CENTRE_RX =
  /(centre of (this|it)|center of (this|it)|sits at the centre|at the (centre|heart) of (this|it)|shape of this|(theres|there'?s|there is) a lot packed into)/i;
/** A reply that opens by quoting the user (starts with a quote mark). */
const quoteFirst = (reply: string) => /^\s*["'“‘]/.test(reply);

/** Derive variety pressure from the companion's recent replies. */
export function varietySignals(companionReplies: string[]): VarietySignals {
  const recent = companionReplies.slice(-4);
  const last3 = companionReplies.slice(-3);
  const lastTwo = recent.slice(-2);
  const lastOpeners = lastTwo.map((r) => openingStem(r));

  let overusedOpener: string | null = null;
  if (lastOpeners.length === 2 && lastOpeners[0] && lastOpeners[0] === lastOpeners[1]) overusedOpener = lastOpeners[0];
  const last = lastTwo[lastTwo.length - 1];
  if (!overusedOpener && last) {
    const stem = OVERUSED_STEMS.find((s) => last.toLowerCase().startsWith(s));
    if (stem && lastTwo.length === 2 && lastTwo[0].toLowerCase().startsWith(stem)) overusedOpener = stem;
  }

  let questionStreak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].includes('?')) questionStreak++;
    else break;
  }

  let menuStreak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (MENU_RX.test(recent[i])) menuStreak++;
    else break;
  }

  return {
    lastOpeners,
    overusedOpener,
    questionStreak,
    menuStreak,
    quoteFirstInLast3: last3.filter(quoteFirst).length,
    eitherOrInLast3: last3.filter((r) => EITHER_OR_RX.test(r)).length,
    centrePhrasesInConvo: companionReplies.filter((r) => CENTRE_RX.test(r)).length,
  };
}

/** Compose the per-turn variety directive (empty string when no pressure). */
export function varietyDirective(v: VarietySignals): string {
  const parts: string[] = [];
  if (v.overusedOpener)
    parts.push(`Your recent replies opened with "${v.overusedOpener}…" — open this one a different way (a plain statement, a soft hypothesis, or simple witnessing).`);
  else if (v.lastOpeners.length)
    parts.push(`Do not open with "${v.lastOpeners.join('…" or "')}…" again.`);
  if (v.quoteFirstInLast3 >= 1)
    parts.push('Do NOT open this reply by quoting the person back; you did that recently. Begin with a plain observation, a soft hypothesis, or simple witnessing.');
  if (v.questionStreak >= 2)
    parts.push(
      `You have asked a question ${v.questionStreak} turns in a row — make this a NO-QUESTION turn: reflect, hold, or name what you are learning, and let them lead.`,
    );
  if (v.eitherOrInLast3 >= 1)
    parts.push('Do NOT ask an "is it more X or Y?" question this turn; you used that shape recently. Reflect or witness instead.');
  if (v.menuStreak >= 1)
    parts.push('Do not use the "more X, Y, or Z?" menu shape this turn; reserve menus for when they are genuinely stuck.');
  if (v.centrePhrasesInConvo >= 1)
    parts.push('Do NOT use "centre of this", "the heart of this", "the shape of this", or "a lot packed into that" again in this conversation.');
  return parts.join(' ');
}

/**
 * Guarantee a first-shape / resting reply does not end on a question (§5.3). Drops
 * a trailing question sentence when there's a preceding statement to land on.
 */
export function dropTrailingQuestion(reply: string): string {
  const trimmed = reply.trim();
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  if (parts.length > 1 && /\?\s*["'”’]?\s*$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(' ').trim();
  }
  return trimmed;
}

/** True when the model's reply verbatim-repeats a recent companion message. */
export function isDuplicateReply(reply: string, companionReplies: string[]): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const r = n(reply);
  return r.length > 0 && companionReplies.slice(-3).some((p) => n(p) === r);
}
