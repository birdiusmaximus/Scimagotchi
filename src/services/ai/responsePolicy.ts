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
}

const MENU_RX = /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i;

/** Derive variety pressure from the companion's recent replies. */
export function varietySignals(companionReplies: string[]): VarietySignals {
  const recent = companionReplies.slice(-4);
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

  return { lastOpeners, overusedOpener, questionStreak, menuStreak };
}

/** Compose the per-turn variety directive (empty string when no pressure). */
export function varietyDirective(v: VarietySignals): string {
  const parts: string[] = [];
  if (v.overusedOpener)
    parts.push(`Your recent replies opened with "${v.overusedOpener}…" — open this one a different way (echo their exact phrase, a plain statement, or a soft hypothesis).`);
  else if (v.lastOpeners.length)
    parts.push(`Do not open with "${v.lastOpeners.join('…" or "')}…" again.`);
  if (v.questionStreak >= 2)
    parts.push(
      `You have asked a question ${v.questionStreak} turns in a row — make this a NO-QUESTION turn: reflect, hold, or name what you are learning, and let them lead.`,
    );
  if (v.menuStreak >= 1)
    parts.push('Do not use the "more X, Y, or Z?" menu shape this turn; reserve menus for when they are genuinely stuck.');
  return parts.join(' ');
}

/** True when the model's reply verbatim-repeats a recent companion message. */
export function isDuplicateReply(reply: string, companionReplies: string[]): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const r = n(reply);
  return r.length > 0 && companionReplies.slice(-3).some((p) => n(p) === r);
}
