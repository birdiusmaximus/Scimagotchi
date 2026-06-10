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

export function routeMode(userText: string, prevEvent: EmotionEvent | null): ModeDecision {
  const t = norm(userText);
  const long = userText.trim().length > 160;
  const familyKnown = !!prevEvent?.emotion_family;
  const shaped = !!prevEvent && (prevEvent.body_cue.length > 0 || prevEvent.behaviour_action.length > 0);

  if (REPAIR.test(t))
    return {
      mode: 'repair',
      directive:
        'Mode: REPAIR — they just corrected or rejected your reading. Acknowledge the miss plainly and without defensiveness ' +
        '("I had that wrong" / "let me step back"), drop the rejected label completely (record it as rejected, never re-propose it), ' +
        'lower the intensity, and either offer a low-effort correction ("what word would be closer?") or simply make room. ' +
        'Nothing can be marked understood on a repair turn.',
    };

  if (CLOSE.test(t))
    return {
      mode: 'close',
      directive:
        'Mode: CLOSE — they are wrapping up. End with dignity in one warm sentence, in their register. ' +
        'No new question, no re-opening the feeling, no summary unless they asked. Vary your closing words from previous closes.',
    };

  if (MIXED.test(t))
    return {
      mode: 'hold_mixed',
      directive:
        'Mode: HOLD MIXED — more than one feeling is present. Hold both strands without collapsing them into one label. ' +
        'If useful, ask ONE question about how they relate (both at once / moving between them / one underneath the other). ' +
        'Set mixed_relation in your output. Never force a single answer.',
    };

  if (DONT_KNOW.test(t) || (BODY_WORDS.test(t) && !EMOTION_WORD.test(t)))
    return {
      mode: 'body_first',
      directive:
        'Mode: BODY FIRST — they cannot or do not want to name it. Do not demand emotion words. ' +
        'Stay with the felt sense: where it sits, its weight/temperature/movement. "Unnamed for now" is a fully valid resting place.',
    };

  if (GREETING.test(t))
    return {
      mode: 'soft_landing',
      directive:
        'Mode: SOFT LANDING — a greeting/small talk. Just be warm and present; make it easy to begin. No emotion probing, no menus. ' +
        'emotion_family stays null.',
    };

  if ((long && (EMOTION_WORD.test(t) || HEAVY_DISCLOSURE.test(t))) || HEAVY_DISCLOSURE.test(t))
    return {
      mode: 'witness',
      directive:
        'Mode: WITNESS — they shared something heavy or rich. The job this turn is to make them feel HEARD, not to classify. ' +
        'Reflect ONE concrete, specific detail in their own words. Strongly prefer NO question this turn — a question now would feel ' +
        'extractive. If you must ask, make it one short, open invitation.',
    };

  if (ASK_WHAT_FEELING.test(t) || (EMOTION_WORD.test(t) && !familyKnown))
    return {
      mode: 'name',
      directive:
        'Mode: NAME — a feeling word is on the table. Accept their word first; help find the closest-fitting shade only if it helps. ' +
        'Treat any label you supply as a tentative hypothesis, never as truth.',
    };

  if (VAGUE.test(t) && !familyKnown)
    return {
      mode: 'clarify',
      directive:
        'Mode: CLARIFY — the signal is vague. Offer one small, gentle distinction (not a quiz). It is fine to leave it broad; ' +
        'do not push a label onto it.',
    };

  if (familyKnown && shaped)
    return {
      mode: 'meaning',
      directive:
        'Mode: MEANING — the feeling has a name and a felt shape. Gently reach for what the moment seemed to mean or what set it off, ' +
        'one step only, in their words. If meaning is already clear, reflect the shape you now understand.',
    };

  if (familyKnown)
    return {
      mode: 'differentiate',
      directive:
        'Mode: DIFFERENTIATE — a family is in play but the shade is loose. Help separate nearby feelings only as far as is useful; ' +
        'their own word beats a precise-sounding one.',
    };

  return {
    mode: 'witness',
    directive:
      'Mode: WITNESS (default) — reflect one specific thing you actually heard, in their words, before anything else. ' +
      'At most one short question, and only if it clearly helps.',
  };
}
