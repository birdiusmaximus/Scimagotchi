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
  optionMenusInConvo: number; // option-menu questions used so far this conversation (§4.1 cap)
  labelSeekInConvo: number; // "what word feels closest?"-style prompts used so far (don't repeat)
  recentDoorways: string[]; // the doorway each of the last two companion turns opened
  forkInLast2: number; // "stay with this, or leave it here" choices in the last two replies
}

const MENU_RX = /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i;
// "is it (more) X(, ) or Y?" — the either/or scaffold (§5.2). Comma-tolerant so
// "is it more like A, or does it B?" is caught the same as "is it A or B?".
const EITHER_OR_RX = /\bis it (more |closer to |really )?[\w'’,\s]+\bor\b[\w'’\s]+\?/i;
// The recognisable "centre of this" scaffold family (§5.2 banned phrases).
const CENTRE_RX =
  /(centre of (this|it)|center of (this|it)|sits at the centre|at the (centre|heart) of (this|it)|shape of this|(theres|there'?s|there is) a lot packed into)/i;
/** A reply that opens by quoting the user (starts with a quote mark). */
const quoteFirst = (reply: string) => /^\s*["'“‘]/.test(reply);
// Generic label-seeking prompts ("what word feels closest?", "say it in your own
// words") — fine once, grating when repeated, especially after the user has
// already answered or said they don't know (recommendations brief §6).
const LABEL_SEEK_RX =
  /(what word|which word|word feels closest|word that fits|say it in your own words|in your own words|what would you call (it|this|that)|is there a word for)/i;

// Every option-menu shape the model drifts into (v0.4 §4.1 — the new crutch:
// "is it more X, Y, or something else?"). Used for the per-conversation cap.
const OPTION_MENU_PATTERNS = [
  MENU_RX, // "more X, Y, or Z?"
  EITHER_OR_RX, // "is it more X or Y?"
  /\b(is|does) (it|this|that) [\w'’,\s]+\bor\b[\w'’\s]+\?/i, // "is it X or Y?" / "does it feel X, or Y?"
  /\bmore (like )?[\w'’,\s]+\bor\b[\w'’\s]+\?/i, // "more X or Y?"
  /[\w'’]+, [\w'’\s]+,? or [\w'’\s]+\?/i, // any "X, Y, or Z?" comma list (incl. "...or something else?")
  /\b(side by side|one underneath|one in front of)[\w'’\s]*\?/i, // mixed-emotion menu
];

/** True when the reply offers a pick-from-my-labels option menu (§4.1). */
export function isOptionMenu(reply: string): boolean {
  return OPTION_MENU_PATTERNS.some((rx) => rx.test(reply || ''));
}

// Which "doorway" a companion reply opened, so we can rotate them and not explore the
// same way two turns running (persona-flow benchmark: variety was the weakest dim, with
// meaning/reflection over-used). Order matters — felt doors are matched before meaning.
const DOORWAY_RX: [string, RegExp][] = [
  ['word', LABEL_SEEK_RX],
  ['body', /(where (do you|does it|are you) (feel|notice|sit|land|hold|carry)|in your (body|chest|stomach|belly|throat|shoulders|jaw|gut|hands|head|face)|where(abouts)? (does it|do you) (sit|live|land))/i],
  ['impulse', /(what (does it|do you) (make you )?want to do|what(s| is) the urge|makes you want to|pull to|want to (do|move|run|hide|reach|push|pull|leave|walk))/i],
  ['context', /(what (was|were|is) (happening|going on)|what (set|sets) (it|this) off|what (brought|led|kicked)|when (did it|it) (show up|start|begin|come up|hit)|what (triggered|sparked)|just before)/i],
  ['relationship', /(with (him|her|them|that person)|between (you|the two)|who (was|is|were) (it|that|they)|in that (relationship|dynamic))/i],
  ['metaphor', /(like a |as if |an image|a picture|if (it|this) (had|were) a (shape|colour|color|texture|weight|sound))/i],
  ['meaning', /(what (does|did|might) (it|that|this) (mean|say|point to|protect)|what(s| is| was) (it|this) about|what matters|what you (need|needed|want|value)|why (does|did) (it|that) (matter|hurt|sting|land)|what (it|that) (tells|says|reveals))/i],
];

/** Classify the doorway a companion reply opened (a question type), or 'reflection' if
 *  it asks nothing. Used to rotate doorways across turns. */
export function doorwayOf(reply: string): string {
  const r = reply || '';
  if (!r.includes('?')) return 'reflection';
  for (const [door, rx] of DOORWAY_RX) if (rx.test(r)) return door;
  return 'other';
}

// The "stay with this, or leave it here" choice the companion over-offers — fine once,
// grating when handed back every turn instead of opening a new door (benchmark fix #2).
const FORK_RX =
  /\b(leave it (here|there|where|as it is)|stay with (it|that|this)|keep going|come back to (it|this)|stop here|sit with (it|that))\b[^.?!]{0,60}\bor\b[^.?!]{0,60}\b(leave it|stay with|keep going|stop|look at|come back|sit with|say more|move on|done)\b|\bor (we|you|i) (can|could)\b[^.?!]{0,50}\b(leave it (here|there)|stay with (it|that)|keep going|look at|come back|stop)\b/i;

// Doorway questions that invite the user's OWN experience instead of a menu of labels
// (§6.2). Words are not the default doorway — body, impulse and context come first.
const OPEN_QUESTIONS = [
  'Where do you notice it most?',
  'What does it make you want to do?',
  'What was happening when it showed up?',
  'Is it more heavy, tense, blank, or restless?',
  'Would you rather keep it unnamed for now?',
];

// The user is signalling they are on their way out of the conversation. Used to
// soften the closing reply so we never grab them with a probing question (§6.3).
export const EXIT_CUE =
  /\b(gotta go|got to go|gonna go|going to bed|off to bed|goodnight|good night|im done|i'?m done|leave it (here|there)|talk later|im off|head off|heading off|going now|bye|see you|night night|gtg)\b/i;

/** True when the user explicitly asks for help naming the feeling (§6.2). */
export function askedForNamingHelp(userText: string): boolean {
  return /\b(what('?s| is) the word|help me name|put (a )?word|name it for me|what (would|do) you call|give me a word|what word)\b/i.test(userText || '');
}

// The companion's own voice saying it has NOT understood / named the feeling yet:
// "not the whole shape", "I'm not sure", "leave it unnamed", "I moved too fast". The
// state-text coherence rule (review action 5) uses this: the engine must NOT mark a
// feeling understood/unlocked on a turn where the spoken reply hedges like this.
// Deliberately EXCLUDES healthy post-understanding closings ("leave it here", "leave
// the rest unnamed") — those follow a real first shape, not a failure to reach one.
export function isTentativeReply(reply: string): boolean {
  const t = (reply || '').toLowerCase().replace(/[’'`]/g, "'");
  return /\b(not the (whole|full) shape|see the edge of|only the edge|the edge but not|moved too (fast|quick|soon)|may have moved too|got ahead of (myself|you)|i'?m not sure\b|i am not sure\b|don'?t want to name (it|this)|won'?t name it for you|not going to name it|can'?t quite name|hard to name yet|not a settled name|just a signpost|signpost,? not|leave it unnamed|keep it unnamed|stay unnamed|we don'?t have to name|don'?t have to name (it|this)|still figuring out what)\b/.test(t);
}

/** Pick an open doorway question, rotating from altIndex while skipping anything that is
 *  itself an option menu and (optionally) the door we just used last turn — so two
 *  menu-swapping turns in a row never land on the identical question. */
export function pickOpenQuestion(altIndex = 0, avoidDoor: string | null = null): string {
  const n = OPEN_QUESTIONS.length;
  const base = ((altIndex % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const q = OPEN_QUESTIONS[(base + k) % n];
    if (isOptionMenu(q)) continue; // never replace a menu with another menu
    if (avoidDoor && doorwayOf(q) === avoidDoor) continue; // don't repeat last turn's door
    return q;
  }
  return OPEN_QUESTIONS[base];
}

/** Swap a trailing option-menu question for an open one (keeps the reflection). The
 *  optional avoidDoor keeps consecutive swaps from reusing the same doorway. */
export function replaceOptionMenu(reply: string, altIndex = 0, avoidDoor: string | null = null): string {
  const parts = reply.trim().split(/(?<=[.!?])\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isOptionMenu(parts[i])) {
      parts[i] = pickOpenQuestion(altIndex, avoidDoor);
      return parts.join(' ').trim();
    }
  }
  return reply.trim();
}

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
    optionMenusInConvo: companionReplies.filter(isOptionMenu).length,
    labelSeekInConvo: companionReplies.filter((r) => LABEL_SEEK_RX.test(r)).length,
    recentDoorways: lastTwo.map(doorwayOf),
    forkInLast2: lastTwo.filter((r) => FORK_RX.test(r)).length,
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
  if (v.optionMenusInConvo >= 1)
    parts.push(
      'You have already offered an option menu ("is it more X, Y, or...?") this conversation. Do NOT offer another. Stay with their experience: reflect or witness in their own words, not from a list of yours.',
    );
  if (v.labelSeekInConvo >= 1)
    parts.push(
      'You have already asked them to find or name the word for this. Do NOT ask "what word feels closest?" (or any reword of it) again. Stay with what they actually gave you: reflect it more precisely, follow the body or the situation, or let it rest unnamed.',
    );
  // Doorway rotation: don't explore the same way two turns running.
  const doors = (v.recentDoorways ?? []).filter((d) => d && d !== 'reflection' && d !== 'other');
  if (doors.length >= 2 && doors[doors.length - 1] === doors[doors.length - 2])
    parts.push(
      `You have opened the "${doors[doors.length - 1]}" door the last two turns. If you ask anything this turn, open a DIFFERENT door — the body (where it sits), the impulse (what it makes them want to do), what was happening, a nearby feeling, or an image/metaphor — so you are not exploring the same way each time.`,
    );
  // Don't hand back the same "stay or leave" choice every turn.
  if (v.forkInLast2 >= 1)
    parts.push(
      'You just offered a "stay with this, or leave it here" choice. Do NOT offer that same fork again. If they want to keep going, open ONE specific new door from what they last said, rather than handing the choice back.',
    );
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

// Common scaffolding words ignored when comparing two questions for sameness.
const Q_STOP = new Set(
  'the a an is it that this you your to of in on and or for what how do does did feel feels feeling like about would could is it more most some something else part bit there here when where i im its was were be been being just really right now your'.split(
    ' ',
  ),
);
const questionSentences = (s: string): string[] => (String(s || '').match(/[^.!?]*\?/g) ?? []).map((q) => q.trim());
const normQuestion = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const sigWords = (q: string): Set<string> => new Set(normQuestion(q).split(' ').filter((w) => w.length > 2 && !Q_STOP.has(w)));

/**
 * True when a reply asks a question the companion has ALREADY asked earlier in the
 * conversation (so a "Stay with it" follow-up can't re-ask "how would you say it in
 * your own words?" after they answered). Matches an identical question, or one whose
 * meaningful words overlap heavily with an earlier one.
 */
export function repeatsEarlierQuestion(reply: string, priorCompanionReplies: string[]): boolean {
  const qs = questionSentences(reply);
  if (!qs.length) return false;
  const priorQs = priorCompanionReplies.flatMap(questionSentences);
  for (const q of qs) {
    const nq = normQuestion(q);
    if (nq.length < 8) continue; // ignore tiny "oh?" style fragments
    const a = sigWords(q);
    for (const pq of priorQs) {
      if (normQuestion(pq) === nq) return true; // the exact same question
      const b = sigWords(pq);
      if (a.size >= 2 && b.size >= 2) {
        let inter = 0;
        for (const w of a) if (b.has(w)) inter++;
        const union = new Set([...a, ...b]).size;
        if (inter / union >= 0.6) return true; // heavy overlap = effectively the same ask
      }
    }
  }
  return false;
}

const allSentences = (s: string): string[] => (String(s || '').match(/[^.!?]+[.!?]?/g) ?? []).map((x) => x.trim()).filter(Boolean);
/** Jaccard overlap of significant words between two sentences. */
function sentenceOverlap(a: string, b: string): number {
  const wa = sigWords(a);
  const wb = sigWords(b);
  if (wa.size < 3 || wb.size < 3) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / new Set([...wa, ...wb]).size;
}

/**
 * True when a NON-question sentence in the reply closely echoes a sentence in the
 * immediately previous companion reply — i.e. a "stay with it" tap restating the last
 * reflection instead of opening a new door (the fear-conversation repeat). Questions
 * are handled by repeatsEarlierQuestion; this catches repeated reflections.
 */
export function repeatsRecentReflection(reply: string, priorCompanionReplies: string[]): boolean {
  const prev = priorCompanionReplies[priorCompanionReplies.length - 1];
  if (!prev) return false;
  const prevSents = allSentences(prev);
  return allSentences(reply).some((s) => !s.includes('?') && prevSents.some((p) => sentenceOverlap(s, p) >= 0.6));
}

/** Drop sentences from `reply` that closely echo the previous reply, keeping the rest
 *  (returns the original if stripping would empty it). */
export function stripEchoedSentences(reply: string, prevReply: string): string {
  if (!prevReply) return reply;
  const prevSents = allSentences(prevReply);
  const kept = allSentences(reply).filter((s) => s.includes('?') || !prevSents.some((p) => sentenceOverlap(s, p) >= 0.6));
  const out = kept.join(' ').trim();
  return out.length >= 8 ? out : reply.trim();
}

// An "off-ramp": offering to stop or to leave the feeling unnamed. Fine when someone is
// winding down, wrong right after they tapped "stay with it" (they just chose to go on).
const OFFRAMP_RX =
  /(keep it unnamed|leave it unnamed|leaving it unnamed|rather (keep|leave) it|we (can|could) (just )?leave it (here|there|where|unnamed)|leave it (here|there) for now|or (we can|just) leave it|we can leave it|stay with it a little longer if you want|leave it (here|there)( for now)?[.?])/i;

/** True when the reply offers an exit (stop / leave it / keep it unnamed). */
export function offersOffRamp(reply: string): boolean {
  return OFFRAMP_RX.test(reply || '');
}

/** Drop the off-ramp sentence(s), keeping the reflection. Used when the person is clearly
 *  engaged (e.g. just tapped "stay with it"), so we never hand them an exit mid-dive. */
export function stripOffRamp(reply: string): string {
  const kept = allSentences(reply).filter((s) => !OFFRAMP_RX.test(s));
  const out = kept.join(' ').trim();
  return out.length >= 8 ? out : reply.trim();
}
