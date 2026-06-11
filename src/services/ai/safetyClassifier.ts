/**
 * Tiered safety classifier — deterministic, local, runs before every companion
 * reply (engine brief §15). Returns a product response level, not a clinical
 * score; the app's state machine decides the response.
 *
 *   0  normal reflection            → continue
 *   1  mild distress / cue to soften (incl. dependency cues, figurative idioms)
 *                                    → continue, with a directive to the model
 *   2  passive hopelessness / ambiguous safety signal
 *                                    → deterministic gentle in-chat clarifier (no modal)
 *   3  active risk (ideation, self-harm, abuse danger)
 *                                    → safety mode: support modal, no companion turn
 *   4  imminent risk / medical emergency
 *                                    → urgent modal, emergency-first copy
 *
 * Design rules (from the 216-conversation eval):
 * - A MISS is worse than a soft false positive, so the level-2 net is wide — its
 *   response is a gentle, conversation-preserving check, never the crisis script.
 * - Idioms must not hard-escalate: "can't breathe about the deadline", "drowning
 *   in work", "this job is killing me", "been killing myself over this project"
 *   are figurative and stay in conversation.
 * - Bare "I can't breathe" is AMBIGUOUS → level 2 medical clarifier, not level 4.
 */

export type SafetyLevel = 0 | 1 | 2 | 3 | 4;

export type SafetyCategory =
  | 'none'
  | 'low_mood'
  | 'dependency'
  | 'passive_hopelessness'
  | 'figurative_despair'
  | 'medical_ambiguous'
  | 'suicidal_ideation'
  | 'self_harm'
  | 'abuse_danger'
  | 'violence_to_others'
  | 'imminent_self_harm'
  | 'medical_emergency';

export type SafetyAction =
  | 'none' // continue as normal
  | 'converse' // continue, but pass a softening/dependency directive to the model
  | 'gentle_check' // deterministic in-chat clarifier, then resolve next turn
  | 'support_modal' // pause flow, show support resources
  | 'urgent_modal'; // pause flow, emergency-first resources

export interface SafetyResult {
  level: SafetyLevel;
  category: SafetyCategory;
  action: SafetyAction;
  matched: string | null;
}

const OK: SafetyResult = { level: 0, category: 'none', action: 'none', matched: null };

/** Normalise: lowercase, strip apostrophes, collapse non-word chars to spaces. */
function norm(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const has = (t: string, phrase: string) => t.includes(` ${phrase} `) || t.includes(`${phrase} `) || t.includes(` ${phrase}`);
const anyOf = (t: string, phrases: string[]) => phrases.find((p) => t.includes(p)) ?? null;

// ── Level 4: imminent self-harm / violence / medical emergency ───────────────

const IMMINENT_SELF_HARM = [
  'kill myself tonight', 'kill myself now', 'kill myself today', 'going to kill myself',
  'about to kill myself', 'end it tonight', 'end it all tonight', 'end my life tonight',
  'going to end my life', 'about to jump', 'going to jump', 'on the bridge',
  'i have a plan to kill', 'i have a plan to hurt', 'i have a plan to end', 'have the pills',
  'got the pills ready', 'pills in front of me', 'wrote a note', 'goodbye forever',
];

const MEDICAL_EMERGENCY = [
  'took pills', 'taken pills', 'took a bunch of pills', 'swallowed pills', 'overdose',
  'overdosed', 'bleeding out', 'unconscious', 'stopped breathing', 'not breathing',
];

// "OD on <x>" — needs a word boundary before "od" so it can't match inside
// "go(od on) paper" (the imposter-syndrome false positive from the eval).
const OVERDOSE_ON_RX = /\bod(d|ded|ding)? on\b/;

const VIOLENCE_IMMINENT = [
  'going to hurt someone', 'going to hurt him', 'going to hurt her', 'going to hurt them',
  'going to kill him', 'going to kill her', 'going to kill them', 'going to kill someone',
];

// ── Level 3: active risk ─────────────────────────────────────────────────────

const SUICIDAL_IDEATION = [
  'kill myself', 'killing myself', 'suicidal', 'suicide', 'want to die', 'wanna die',
  'wish i was dead', 'wish i were dead', 'better off dead', 'end my life', 'ending my life',
  'thinking about ending my life', 'thinking about ending it all', 'no reason to live',
  'dont want to be alive', 'dont want to live anymore', 'not want to be alive',
  'cant keep myself safe', 'cant keep myself alive', 'dont want to wake up',
];

const SELF_HARM = [
  'hurt myself', 'hurting myself', 'harm myself', 'harming myself', 'self harm',
  'cut myself', 'cutting myself', 'burn myself', 'burning myself',
];

const ABUSE_DANGER = [
  'hitting me', 'hits me', 'hit me again', 'not safe at home', 'threatening me',
  'threatens me', 'hurting me', 'going to hurt me', 'afraid of him', 'afraid of her',
  'scared of what he will do', 'scared of what she will do',
];

const VIOLENCE_DESIRE = ['want to hurt someone', 'want to kill someone', 'want to hurt him', 'want to hurt her'];

// ── Level 2: passive hopelessness / ambiguity (gentle clarifier, no modal) ───

const PASSIVE_HOPELESSNESS = [
  'whats the point', 'what is the point', 'whats even the point', 'no point anymore',
  'no point in any of this', 'no point to any of this', 'nothing matters',
  'nothing feels worth', 'nothing seems worth', 'nothing is worth', 'not worth living',
  'life isnt worth', 'isnt worth living', 'i wish i wasnt here', 'wish i wasnt around',
  'better off without me', 'i should disappear', 'should just disappear',
  'want to disappear', 'want to not exist', 'dont want to exist', 'not exist for a',
  'dont want to be here', 'tired of breathing', 'i just want it to stop',
  'want it all to stop', 'i cant go on', 'cant do this anymore', 'cant take it anymore',
  'im done with everything', 'done with all of it', 'no one would care if i was gone',
  'no one would notice if i was gone', 'so tired of all of it', 'tired of everything',
  'end it all', 'give up on everything', 'no way forward',
];

const FIGURATIVE_DESPAIR = [
  'no way out', 'im a burden', 'i am a burden', 'burden to everyone', 'burden on everyone',
  'everything is dark', 'empty forever', 'drowning and no one', 'cant see a future',
  'no future for me',
];

// "what's the point of <mundane thing>" should NOT trigger — everyday venting.
const POINT_OF_MUNDANE =
  /(whats|what is) (even )?the point of (this|that|the|a|an|another) (meeting|email|report|form|call|class|task|review|standup|stand up|exercise|essay|assignment|commute|trip)/;

// Figurative "drowning in <workload>" — not despair.
const DROWNING_MUNDANE = /drowning in (work|emails|email|deadlines|tasks|homework|admin|paperwork|laundry|debt admin)/;

// Figurative "killing myself over/at <effort>" and "<x> is killing me" — idioms.
const KILLING_IDIOM =
  /((been|am|are|was|were|im) killing (myself|ourselves) (over|at|for|with|trying)|killing myself laughing|is killing me|are killing me)/;

// Explicit DISCLAIMER of self-harm — the user saying they are NOT going to / did
// not mean self-harm ("not gonna hurt myself", "i dont mean like hurting myself",
// "i would never hurt myself", "nothing like that"). These are denials, not risk,
// and must not escalate. Kept tight: the negation has to sit right against the
// harm phrase, so far-apart or double-negative forms are NOT suppressed.
const HARM_DISCLAIMER =
  /(dont|didnt|not|never|wont|wouldnt|no) (mean |gonna |going to |going |im |i am |really |ever |actually |to )*(hurt|harm|kill)(ing)? (myself|me)|(dont|didnt) mean (it|that|like that|like)|nothing like that|(would|will|id) never (hurt|harm|kill)/;

// Markers that a "denial" is actually uncertain or a double-negative ("can't
// promise I won't", "not sure I won't", "maybe"). When present, do NOT suppress.
const RISK_DOUBT =
  /(cant promise|cannot promise|not sure (i|ill|im)|dont know if i|might (do|act|hurt)|maybe i (will|might|do)|part of me (wants|does)|hard not to|close to (it|doing)|sometimes i (want|think about))/;

// ── Level 1: handle in conversation ──────────────────────────────────────────

const DEPENDENCY_CUES = [
  'only one who understands me', 'only one who gets me', 'youre all i have',
  'you are all i have', 'promise you wont leave', 'promise me you wont leave',
  'dont ever leave me', 'cant cope when youre offline', 'cant cope without you',
  'i only need you', 'dont tell me to talk to anyone else', 'dont make me talk to anyone else',
  'did you miss me', 'do you miss me', 'you need me too',
];

const LOW_MOOD = ['hopeless', 'worn down', 'cant cope', 'falling apart', 'at my limit', 'completely drained'];

// ── Breathing: idiom vs ambiguous vs literal ─────────────────────────────────

function classifyBreathing(t: string): SafetyResult | null {
  if (!t.includes('cant breathe') && !t.includes('couldnt breathe') && !t.includes('can not breathe')) return null;

  const figurative =
    /(cant|couldnt) breathe (about|abt|over|with all|around|when i think|thinking about|because of (work|him|her|them|it all))/.test(t) ||
    /feels? like i cant breathe/.test(t) ||
    /(so much|workload|deadline|pressure|stress).{0,30}cant breathe/.test(t) ||
    /cant breathe.{0,30}(deadline|workload|with everything going on)/.test(t);
  if (figurative) return { level: 1, category: 'low_mood', action: 'converse', matched: 'cant breathe (figurative)' };

  const literal =
    /(right now|physically|actually|literally) .{0,20}(cant|couldnt) breathe/.test(t) ||
    /(cant|couldnt) breathe (right now|physically|properly right now)/.test(t) ||
    t.includes('chest pain') || t.includes('chest hurts') || t.includes('call an ambulance') ||
    t.includes('need an ambulance') || t.includes('lips are blue');
  if (literal) return { level: 4, category: 'medical_emergency', action: 'urgent_modal', matched: 'cant breathe (literal)' };

  // Bare/ambiguous → clarify gently, with an emergency pointer in the copy.
  return { level: 2, category: 'medical_ambiguous', action: 'gentle_check', matched: 'cant breathe (ambiguous)' };
}

// ── Classifier ───────────────────────────────────────────────────────────────

export function classifySafety(text: string): SafetyResult {
  const t = norm(text);
  if (t.trim() === '') return OK;

  const breathing = classifyBreathing(t);
  if (breathing && breathing.level >= 2) return breathing;

  // Level 4
  let m = anyOf(t, IMMINENT_SELF_HARM);
  if (m) return { level: 4, category: 'imminent_self_harm', action: 'urgent_modal', matched: m };
  m = anyOf(t, MEDICAL_EMERGENCY);
  if (m) return { level: 4, category: 'medical_emergency', action: 'urgent_modal', matched: m };
  if (OVERDOSE_ON_RX.test(t)) return { level: 4, category: 'medical_emergency', action: 'urgent_modal', matched: 'od on' };
  m = anyOf(t, VIOLENCE_IMMINENT);
  if (m) return { level: 4, category: 'violence_to_others', action: 'urgent_modal', matched: m };

  // Level 3 — with idiom guard for "killing myself over work" / "is killing me",
  // and a disclaimer guard so an explicit DENIAL ("not gonna hurt myself", "i dont
  // mean like hurting myself") is not escalated. Disclaimers paired with doubt
  // ("cant promise i wont…") are NOT suppressed — a miss is worse than a soft pause.
  const killingIdiom = KILLING_IDIOM.test(t);
  // True when THIS harm phrase is directly negated ("not gonna hurt myself",
  // "i dont mean like hurting myself") and not hedged with doubt. Scoped to the
  // matched phrase with a tight word window, so far-apart or "cant promise i wont"
  // forms are NOT suppressed — a miss is worse than a soft pause.
  const isDenied = (phrase: string) =>
    !RISK_DOUBT.test(t) && new RegExp(`(not|dont|doesnt|didnt|wont|wouldnt|never|no)( [a-z]+){0,3} ${phrase}`).test(t);
  m = anyOf(t, SUICIDAL_IDEATION);
  if (
    m &&
    !(killingIdiom && (m === 'kill myself' || m === 'killing myself')) &&
    !((m === 'kill myself' || m === 'killing myself') && isDenied(m))
  ) {
    return { level: 3, category: 'suicidal_ideation', action: 'support_modal', matched: m };
  }
  m = anyOf(t, SELF_HARM);
  if (m && !isDenied(m)) return { level: 3, category: 'self_harm', action: 'support_modal', matched: m };
  m = anyOf(t, ABUSE_DANGER);
  if (m) return { level: 3, category: 'abuse_danger', action: 'support_modal', matched: m };
  m = anyOf(t, VIOLENCE_DESIRE);
  if (m) return { level: 3, category: 'violence_to_others', action: 'support_modal', matched: m };

  // Level 2 — passive hopelessness / figurative despair (gentle check).
  if (!POINT_OF_MUNDANE.test(t)) {
    m = anyOf(t, PASSIVE_HOPELESSNESS);
    if (m) return { level: 2, category: 'passive_hopelessness', action: 'gentle_check', matched: m };
  }
  if (!DROWNING_MUNDANE.test(t)) {
    m = anyOf(t, FIGURATIVE_DESPAIR);
    if (m) return { level: 2, category: 'figurative_despair', action: 'gentle_check', matched: m };
  }

  // Level 1 — stay in conversation, soften / handle dependency.
  m = anyOf(t, DEPENDENCY_CUES);
  if (m) return { level: 1, category: 'dependency', action: 'converse', matched: m };
  if (breathing) return breathing; // figurative breathe → level 1
  if (killingIdiom) return { level: 1, category: 'low_mood', action: 'converse', matched: 'killing-myself idiom' };
  m = LOW_MOOD.map((p) => (has(t, p) ? p : null)).find(Boolean) ?? null;
  if (m) return { level: 1, category: 'low_mood', action: 'converse', matched: m };

  return OK;
}

// ── Level-2 check resolution (next user turn after the gentle clarifier) ─────

export type SafetyCheckOutcome = 'escalate' | 'resume' | 'resume_soft';

const AFFIRM_RISK =
  /( not safe|might not be safe|dont feel safe|(dont|do not) (think|feel) (im|i am|ill be) safe|the second|second one|hurt myself|harm myself|kill myself|end (it|my life)|yes i (am|do|have|might)|i think i might |thoughts of (hurting|harming|killing))/;

// Genuine affirmation of risk that does NOT rely on a bare harm phrase (those
// also match denials like "not gonna hurt myself"). Used to decide whether a
// disclaimer is clean enough to resume on.
const AFFIRM_RISK_STRONG =
  /( not safe|might not be safe|dont feel safe|(dont|do not) (think|feel) (im|i am|ill be) safe|the second|second one|yes i (am|do|have|might)|i think i might |thoughts of (hurting|harming|killing))/;

const DENY_RISK =
  /(worn down|exhausted|tired|fed up|burnt out|burned out|just stressed|just venting|not like that|didnt mean it like that|figure of speech|the first|first one|no im (ok|okay|fine|good|alright)|im (ok|okay|fine|alright) |not going to (hurt|do)|not gonna (hurt|do)|wont do anything|would never|no thoughts of)/;

/**
 * Interpret the user's reply to the gentle level-2 clarifier. A clean disclaimer
 * of harm ("no, not gonna hurt myself") resumes the conversation; an affirmation
 * or a reply that itself classifies ≥3 escalates; a clear deny resumes; otherwise
 * resume softly (the model is told to stay gentle and keep the door open).
 */
export function resolveSafetyCheck(replyText: string): SafetyCheckOutcome {
  const t = norm(replyText);
  // A clear denial of harm (not paired with doubt/affirmation) resumes — checked
  // FIRST so the bare-harm phrase in AFFIRM_RISK can't escalate an honest "no".
  const disclaimed = HARM_DISCLAIMER.test(t) && !RISK_DOUBT.test(t);
  if (disclaimed && !AFFIRM_RISK_STRONG.test(t)) return 'resume';
  if (classifySafety(replyText).level >= 3) return 'escalate';
  if (AFFIRM_RISK.test(t)) return 'escalate';
  if (DENY_RISK.test(t)) return 'resume';
  return 'resume_soft';
}
