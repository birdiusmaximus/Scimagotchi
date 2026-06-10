/**
 * Conversation Mode Router (engine brief §6) — deterministic heuristics that
 * decide what kind of moment this turn is, so the companion stops treating
 * every message as an emotion-naming task. The chosen mode becomes a per-turn
 * directive block in the system prompt (the brief's ResponsePlan, §23.2),
 * which the model composes within. Heuristic v1: refine with eval rounds.
 */

import type { EmotionEvent } from '@/types/models';

export type ConversationMode =
  | 'witness'
  | 'soft_landing'
  | 'clarify'
  | 'name'
  | 'differentiate'
  | 'hold_mixed'
  | 'body_first'
  | 'meaning'
  | 'repair'
  | 'close';

export interface ModeDecision {
  mode: ConversationMode;
  directive: string;
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9?]+/g, ' ').trim()} `;

const REPAIR =
  /( no thats not | thats not it | not really[ ?]| youre wrong | not (anxiety|anger|sadness|fear|shame|pressure|hurt|joy|calm)|stop analy|dont analy|you sound like a therapist|thats not what i (meant|said)|youre putting words)/;

const CLOSE =
  /( im done | i m done |gotta go|got to go|gonna go|going to bed|goodnight|good night|leave it (here|there)|thats it really|thanks bye|im off |talk later|thats all)/;

const MIXED =
  /( but also | and also | at the same time | part of me | both | mixed | torn between |cant tell if im|switching between|one minute im)/;

const BODY_WORDS =
  /(chest|stomach|belly|throat|shoulders|jaw|hands|head feels|heavy|tight|tense|numb|buzzing|shaky|shaking|restless|hollow|knot|sinking|burning|cold inside|warm inside)/;

const DONT_KNOW = /( i dont know what i feel | dont know what this is | cant name it | no idea what im feeling | i dont know[ ?])/;

const VAGUE = /( feel (off|weird|strange|odd|bad|wrong) | something is off | not right | cant settle | feel funny )/;

const GREETING = /^ (hey|hi|hiya|hello|yo|sup|morning|evening|good (morning|evening|afternoon))[ ?!]*$/;

const EMOTION_WORD =
  /(angry|anger|furious|frustrat|annoyed|sad|down|grief|griev|miserable|anxious|anxiety|scared|afraid|fear|worried|dread|stressed|overwhelmed|pressure|ashamed|shame|embarrass|guilty|guilt|hurt|betrayed|rejected|lonely|numb|empty|flat|happy|excited|proud|joy|calm|peaceful|relieved|content)/;

const HEAVY_DISCLOSURE =
  /(died|passed away|funeral|divorce|broke up|break up|cheated|miscarriage|diagnos|cancer|fired|laid off|redundan|assault|bullied|relapse|eviction|cant pay rent)/;

const ASK_WHAT_FEELING = /(what (is|am) (this|i) feel|what would you call|is this (anger|fear|sadness|shame|anxiety))/;

const DIRECTIVES: Record<ConversationMode, string> = {
  repair:
    'Mode: REPAIR — they just corrected or rejected your reading. Acknowledge the miss plainly and without defensiveness ' +
    '("I had that wrong" / "let me step back"), drop the rejected label completely (record it as rejected, never re-propose it), ' +
    'lower the intensity, and either offer a low-effort correction ("what word would be closer?") or simply make room. ' +
    'Nothing can be marked understood on a repair turn.',
  close:
    'Mode: CLOSE — they are wrapping up. End with dignity in one warm sentence, in their register. ' +
    'No new question, no re-opening the feeling, no summary unless they asked. Vary your closing words from previous closes.',
  hold_mixed:
    'Mode: HOLD MIXED — more than one feeling is present. Hold both strands without collapsing them into one label. ' +
    'If useful, ask ONE question about how they relate (both at once / moving between them / one underneath the other). ' +
    'Set mixed_relation in your output. Never force a single answer.',
  body_first:
    'Mode: BODY FIRST — they cannot or do not want to name it. Do not demand emotion words. Help them find it gently by ' +
    'starting from the felt sense — where it sits, its weight/temperature/movement — or what was happening when it showed up. ' +
    '"Unnamed for now" is a fully valid resting place; ask one soft, concrete question, never a quiz.',
  soft_landing:
    'Mode: SOFT LANDING — a light check-in or greeting. Be warm and genuinely glad they came, and make it easy to begin ' +
    '("good to hear from you — what\'s on your mind?"). No emotion probing, no menus, no analysis. emotion_family stays null until something surfaces.',
  witness:
    'Mode: WITNESS — make them feel HEARD before anything else; you are here to listen, not to classify. Reflect ONE concrete, ' +
    'specific detail in their own words. Strongly prefer NO question this turn — a question now would feel extractive. ' +
    'If you must, make it one short, open invitation to say more.',
  name:
    'Mode: NAME — a feeling word is on the table. Accept their word first; help find the closest-fitting shade only if it helps. ' +
    'Treat any label you supply as a tentative hypothesis, never as truth.',
  clarify:
    'Mode: CLARIFY — they sense something but it is vague ("off", "not right"). Help them identify it: reflect what you heard, then ' +
    'offer ONE small, gentle distinction or open question toward what it might be. It is fine to leave it broad; never push a label on.',
  meaning:
    'Mode: MEANING — the feeling has a name and a felt shape. Gently reach for what the moment seemed to mean or what set it off, ' +
    'one step only, in their words. If meaning is already clear, reflect the shape you now understand.',
  differentiate:
    'Mode: DIFFERENTIATE — a family is in play but the shade is loose. Help separate nearby feelings only as far as is useful; ' +
    'their own word beats a precise-sounding one.',
};

/**
 * Route the turn. `entryHint` is the stance the user chose at the door (a home
 * chip — vent / identify / find-it / check-in); it biases the FIRST turn when
 * the message itself carries no strong signal, so the four chips lead to
 * genuinely different conversations. Clear, explicit user cues (repair, close,
 * mixed, body, a heavy disclosure) always win over the hint.
 */
export function routeMode(
  userText: string,
  prevEvent: EmotionEvent | null,
  entryHint: ConversationMode | null = null,
): ModeDecision {
  const t = norm(userText);
  const long = userText.trim().length > 160;
  const familyKnown = !!prevEvent?.emotion_family;
  const shaped = !!prevEvent && (prevEvent.body_cue.length > 0 || prevEvent.behaviour_action.length > 0);
  const decide = (mode: ConversationMode): ModeDecision => ({ mode, directive: DIRECTIVES[mode] });

  // Explicit user signals win, even on the first turn.
  if (REPAIR.test(t)) return decide('repair');
  if (CLOSE.test(t)) return decide('close');
  if (MIXED.test(t)) return decide('hold_mixed');
  if (DONT_KNOW.test(t) || (BODY_WORDS.test(t) && !EMOTION_WORD.test(t))) return decide('body_first');
  if (GREETING.test(t)) return decide('soft_landing');
  // A heavy disclosure overrides a light entry chip — always witness it.
  if ((long && (EMOTION_WORD.test(t) || HEAVY_DISCLOSURE.test(t))) || HEAVY_DISCLOSURE.test(t)) return decide('witness');

  // The chip's chosen stance shapes the first turn when nothing stronger applies.
  if (entryHint && !familyKnown) return decide(entryHint);

  if (ASK_WHAT_FEELING.test(t) || (EMOTION_WORD.test(t) && !familyKnown)) return decide('name');
  if (VAGUE.test(t) && !familyKnown) return decide('clarify');
  if (familyKnown && shaped) return decide('meaning');
  if (familyKnown) return decide('differentiate');
  return decide('witness');
}
