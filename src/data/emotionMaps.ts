/**
 * Emotion maps — the universal structure from the brief (§7.4) that drives the
 * companion's conversation. Each family knows how to: be detected from a user
 * message, ask for its felt shape, reflect that shape, ask for context, and
 * deliver an "understood" reflection. Anger & Protest is the fully worked
 * vertical slice; the other families are present so the system supports all nine.
 */

import type { Activation, EmotionFamilyId, OrbTone, Valence } from '@/types/models';

export interface TriggerRule {
  /** lowercase substrings that indicate this trigger */
  match: string[];
  /** how the companion phrases the trigger in its reflection */
  phrase: string;
  /** the appraisal/meaning stored with the event */
  appraisal: string;
  /** short summary used in the durable memory note */
  short: string;
  /** if present, refines the emotion shade when this trigger matches */
  shade?: string;
}

export interface EmotionMap {
  id: EmotionFamilyId;
  label: string;
  tone: OrbTone;
  valence: Valence;
  activation: Activation;
  /** words that detect this family in a free-text message */
  familyKeywords: string[];
  /** Stage 1 reflection */
  noticed: string;
  /** Stage 2→3 question: asks for the felt/body shape */
  shapeQuestion: string;
  /** felt-shape adjectives we capture as a body cue */
  shapeWords: string[];
  /** reflect the captured shape word back */
  shapeReflect: (word: string) => string;
  /** Stage 3→4 question: asks for the trigger/context */
  triggerQuestion: string;
  triggerRules: TriggerRule[];
  defaultShade: string;
  /** Stage 4 reflection — emotion understood / first shape */
  understood: (shade: string, triggerPhrase: string) => string;
  /** Stage 5 reflection — personal pattern */
  deepened: string;
  needValue: string[];
}

export const ANGER_MAP: EmotionMap = {
  id: 'anger',
  label: 'Anger & Protest',
  tone: 'anger',
  valence: 'negative',
  activation: 'high',
  familyKeywords: [
    'angry', 'anger', 'furious', 'fuming', 'frustrat', 'annoyed', 'annoying', 'irritat',
    'pissed', 'rage', 'raging', 'resent', 'indignant', 'mad', 'livid', 'wound up',
  ],
  noticed: 'I can feel something sharp or pushing back here. I think this may be near anger.',
  shapeQuestion:
    'I know the word anger, but not its shape in you yet. Is it more hot, sharp, blocked, or something else?',
  shapeWords: [
    'hot', 'sharp', 'blocked', 'tight', 'heated', 'burning', 'tense', 'cold', 'quiet',
    'rigid', 'heavy', 'stuck', 'boiling', 'simmer', 'simmering', 'fiery',
  ],
  shapeReflect: (w) => `I'm learning that this anger has a ${w} shape.`,
  triggerQuestion: 'Did something make you feel unheard or stopped?',
  triggerRules: [
    {
      match: [
        'interrupt', 'talked over', 'talk over', 'cut me off', 'cut off', 'spoke over',
        'speak over', "wouldn't let me", 'wouldnt let me', 'kept talking', 'kept interrupting',
        'over me', 'not let me finish',
      ],
      phrase: 'feeling interrupted before your point could land',
      appraisal: 'My point could not land — I was not heard.',
      short: 'interrupted or unheard',
      shade: 'frustration',
    },
    {
      match: [
        'ignored', 'dismiss', 'brushed off', 'not heard', 'unheard', 'overlooked',
        'talked down', 'not listened', 'wasn\'t heard', 'no one listens',
      ],
      phrase: 'feeling dismissed, like your point did not matter',
      appraisal: 'Like my point did not matter.',
      short: 'dismissed or unheard',
      shade: 'frustration',
    },
    {
      match: [
        'unfair', 'not fair', 'injustice', 'disrespect', 'rude', 'blamed', 'accused',
        'controlled', 'boundary', 'crossed a line', 'treated like',
      ],
      phrase: 'something that felt unfair or disrespectful',
      appraisal: 'This was not fair — it should not be happening.',
      short: 'treated unfairly',
      shade: 'unfairness',
    },
    {
      match: ['hurt', 'wounded', 'let down', 'betrayed', 'hurtful'],
      phrase: 'something that actually felt wounding underneath',
      appraisal: 'This hurt more than it first looked.',
      short: 'hurt underneath the anger',
      shade: 'hurt',
    },
  ],
  defaultShade: 'frustration',
  understood: (shade, phrase) =>
    `I think I understand the first shape of this now. This anger was closer to ${shade}, and it came from ${phrase}.`,
  deepened:
    "I'm starting to recognise this kind of anger in you. It often appears when you feel spoken over or not taken seriously.",
  needValue: ['fairness', 'respect', 'being heard', 'boundaries'],
};

const FLAT_MAP: EmotionMap = {
  id: 'flat',
  label: 'Flat & Unclear',
  tone: 'calm',
  valence: 'neutral',
  activation: 'low',
  familyKeywords: [
    'numb', 'blank', 'nothing', 'empty', 'foggy', 'disconnected', 'shut down', 'flat',
    'feel off', 'meh', "don't know", 'dont know', 'not sure', 'no idea', 'dunno', 'detached',
    'drained', 'unclear',
  ],
  noticed: 'I think this may be one of the hard-to-name feelings.',
  shapeQuestion:
    'That is allowed — we can leave it unnamed for now. Does it feel more heavy, tense, blank, or restless?',
  shapeWords: ['heavy', 'tense', 'blank', 'restless', 'numb', 'foggy', 'tired', 'empty', 'distant', 'flat'],
  shapeReflect: (w) => `I'm learning that this has a ${w} quality, even if it is hard to name.`,
  triggerQuestion: 'Did anything happen before you went flat?',
  triggerRules: [
    {
      match: ['too much', 'overwhelm', 'stress', 'busy', 'exhausted', 'tired', 'burnt out', 'burnout'],
      phrase: 'a stretch where too much had built up',
      appraisal: 'There may be too much underneath to feel all at once.',
      short: 'after pressure built up',
    },
  ],
  defaultShade: 'numb',
  understood: (shade, phrase) =>
    `I think I understand this a little better now. The ${shade} came after ${phrase}, and your system seemed to go quiet rather than keep reacting.`,
  deepened:
    "I'm starting to recognise this kind of numbness in you. It often appears after pressure or emotion has been high for a while.",
  needValue: ['rest', 'lower demand', 'permission not to know'],
};

const PRESSURE_MAP: EmotionMap = {
  id: 'pressure',
  label: 'Pressure & Overwhelm',
  tone: 'calm',
  valence: 'negative',
  activation: 'high',
  familyKeywords: [
    'stressed', 'stress', 'overwhelm', 'overwhelmed', 'too much', 'pressure', 'rushed',
    'flooded', 'stretched', 'trapped', 'burnt out', 'burnout', 'overloaded', 'no time',
  ],
  noticed: 'I think there is a lot pressing in at once.',
  shapeQuestion: 'Is this more like pressure, too much to do, or too much to feel? Does it feel rushed, heavy, or trapped?',
  shapeWords: ['rushed', 'heavy', 'flooded', 'trapped', 'tight', 'crowded', 'wired', 'racing'],
  shapeReflect: (w) => `I'm learning that this overwhelm feels ${w}.`,
  triggerQuestion: 'What is taking up the most space right now?',
  triggerRules: [
    {
      match: ['deadline', 'work', 'too many', 'everyone', 'tasks', 'responsib'],
      phrase: 'too many demands and not enough room to choose what mattered first',
      appraisal: 'I cannot hold all of this at once.',
      short: 'too many demands at once',
    },
  ],
  defaultShade: 'overwhelm',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The ${shade} came from ${phrase}.`,
  deepened:
    "I'm starting to recognise overwhelm in you. It often appears when responsibility piles up and you feel you cannot pause.",
  needValue: ['space', 'support', 'rest', 'permission to pause'],
};

const SADNESS_MAP: EmotionMap = {
  id: 'sadness',
  label: 'Sadness & Loss',
  tone: 'calm',
  valence: 'negative',
  activation: 'low',
  familyKeywords: [
    'sad', 'low', 'down', 'disappointed', 'grief', 'grieving', 'heavy', 'lonely', 'let down',
    'hopeless', 'tearful', 'crying', 'miss', 'heartbroken', 'discouraged',
  ],
  noticed: 'I think something here feels heavy or tender.',
  shapeQuestion: 'Does it feel more heavy, hollow, tender, or tired?',
  shapeWords: ['heavy', 'hollow', 'tender', 'tired', 'aching', 'empty', 'sinking'],
  shapeReflect: (w) => `I'm learning that this sadness feels ${w}.`,
  triggerQuestion: 'What feels missing right now?',
  triggerRules: [
    {
      match: ['lost', 'gone', 'ended', 'left', 'alone', 'rejected', 'no one'],
      phrase: 'something important feeling absent',
      appraisal: 'Something mattered and it hurts.',
      short: 'something important felt absent',
    },
  ],
  defaultShade: 'sadness',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The ${shade} came from ${phrase}.`,
  deepened:
    "I'm starting to recognise this kind of sadness in you. It often appears when something important feels absent.",
  needValue: ['comfort', 'connection', 'rest', 'gentleness'],
};

const FEAR_MAP: EmotionMap = {
  id: 'fear',
  label: 'Fear & Unease',
  tone: 'calm',
  valence: 'negative',
  activation: 'high',
  familyKeywords: [
    'anxious', 'anxiety', 'worried', 'worry', 'nervous', 'scared', 'afraid', 'uneasy',
    'dread', 'on edge', 'panic', 'insecure', 'terrified', 'fear',
  ],
  noticed: 'I think something here feels uncertain or unsafe.',
  shapeQuestion: 'Is your body more tense, shaky, frozen, or restless? Does it feel like worry, dread, or not knowing?',
  shapeWords: ['tense', 'shaky', 'frozen', 'restless', 'tight', 'sick', 'racing', 'jittery'],
  shapeReflect: (w) => `I'm learning that this worry feels ${w}.`,
  triggerQuestion: 'Does it feel like something bad might happen, or like you do not know what will happen?',
  triggerRules: [
    {
      match: ['waiting', 'news', "don't know", 'uncertain', 'might', 'what if', 'future'],
      phrase: 'not knowing what would happen, so your mind tried to prepare for every version',
      appraisal: 'Something bad might happen and I need to prepare.',
      short: 'uncertainty with no clear next step',
    },
  ],
  defaultShade: 'worry',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The ${shade} came from ${phrase}.`,
  deepened:
    "I'm starting to recognise this kind of worry in you. It often appears when there is uncertainty and no clear next step.",
  needValue: ['safety', 'certainty', 'reassurance', 'clarity'],
};

const HURT_MAP: EmotionMap = {
  id: 'hurt',
  label: 'Hurt & Disconnection',
  tone: 'calm',
  valence: 'negative',
  activation: 'medium',
  familyKeywords: [
    'hurt', 'left out', 'rejected', 'unseen', 'betrayed', 'dismissed', 'excluded',
    'abandoned', 'misunderstood', 'unwanted', 'ignored by', 'no reply', 'ghosted',
  ],
  noticed: 'I think there may be a social kind of pain here.',
  shapeQuestion: 'Did it feel like being left out, dismissed, or not chosen?',
  shapeWords: ['sinking', 'heavy', 'hollow', 'aching', 'tight', 'numb'],
  shapeReflect: (w) => `I'm learning that this hurt feels ${w}, and it makes you want to pull back.`,
  triggerQuestion: 'Was the painful part what happened, or what it seemed to mean about the relationship?',
  triggerRules: [
    {
      match: ['ignored', 'no reply', 'left out', 'not invited', 'distant', 'didn\'t', 'forgot'],
      phrase: 'feeling like you were not really seen or taken in',
      appraisal: 'Maybe I do not matter to them as much as I hoped.',
      short: 'feeling unseen by someone who matters',
    },
  ],
  defaultShade: 'feeling dismissed',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The hurt came from ${phrase}.`,
  deepened:
    "I'm starting to recognise this kind of hurt in you. It often appears when someone important seems distant.",
  needValue: ['belonging', 'being seen', 'trust', 'closeness'],
};

const SHAME_MAP: EmotionMap = {
  id: 'shame',
  label: 'Shame & Guilt',
  tone: 'calm',
  valence: 'negative',
  activation: 'medium',
  familyKeywords: [
    'ashamed', 'shame', 'guilty', 'guilt', 'embarrassed', 'regret', 'humiliated',
    'inadequate', 'foolish', 'stupid', 'self-critical', 'should have', 'my fault',
  ],
  noticed: 'I think this feeling may be turning inward toward you.',
  shapeQuestion: 'Does it make you want to repair, hide, explain, or disappear?',
  shapeWords: ['hot', 'small', 'heavy', 'sinking', 'tight', 'frozen', 'exposed'],
  shapeReflect: (w) => `I'm learning that this feels ${w}, and it pulls you to look away.`,
  triggerQuestion: 'Would you phrase this as "I did something wrong" or "I am wrong"?',
  triggerRules: [
    {
      match: ['did', 'said', 'hurt them', 'let them down', 'mistake', 'wrong thing'],
      phrase: 'caring about being fair, and this moment felt out of line with that',
      appraisal: 'I did something I wish I had handled differently.',
      short: 'feeling you may have let someone down',
      shade: 'guilt',
    },
  ],
  defaultShade: 'guilt',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The ${shade} came because you ${phrase}.`,
  deepened:
    "I'm starting to recognise this kind of guilt in you. It often appears when you feel you may have let someone down.",
  needValue: ['repair', 'integrity', 'self-respect', 'compassion'],
};

const JOY_MAP: EmotionMap = {
  id: 'joy',
  label: 'Joy & Pleasure',
  tone: 'calm',
  valence: 'positive',
  activation: 'medium',
  familyKeywords: [
    'happy', 'glad', 'joy', 'joyful', 'pleased', 'delighted', 'grateful', 'relieved',
    'proud', 'excited', 'content', 'good', 'great', 'hopeful', 'lighter',
  ],
  noticed: 'I think there is something light or good here. I do not fully understand it yet.',
  shapeQuestion: 'Is this joy more bright and excited, or quiet and settled?',
  shapeWords: ['bright', 'warm', 'light', 'open', 'settled', 'buzzing', 'soft'],
  shapeReflect: (w) => `I'm learning that this good feeling is ${w}.`,
  triggerQuestion: 'What did this moment seem to say about what matters to you?',
  triggerRules: [
    {
      match: ['finished', 'done', 'news', 'saw', 'with', 'together', 'managed', 'finally'],
      phrase: 'something you were carrying finally easing',
      appraisal: 'This matters to me — something good landed.',
      short: 'relief after carrying something',
    },
  ],
  defaultShade: 'relief',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The good feeling came from ${phrase}.`,
  deepened:
    "I'm starting to recognise this kind of relief in you. It often appears after pressure has been building for a while.",
  needValue: ['connection', 'appreciation', 'rest after effort', 'meaning'],
};

const CALM_MAP: EmotionMap = {
  id: 'calm',
  label: 'Calm & Steadiness',
  tone: 'calm',
  valence: 'positive',
  activation: 'low',
  familyKeywords: [
    'calm', 'settled', 'okay', 'peaceful', 'steady', 'grounded', 'rested', 'at ease',
    'relaxed', 'balanced', 'fine actually',
  ],
  noticed: 'I think something in you feels more settled right now.',
  shapeQuestion: 'Does this feel peaceful, relieved, steady, or simply okay?',
  shapeWords: ['slow', 'soft', 'open', 'still', 'light', 'quiet', 'easy'],
  shapeReflect: (w) => `I'm learning that this steadiness feels ${w}.`,
  triggerQuestion: 'What helped create this steadier feeling?',
  triggerRules: [
    {
      match: ['rest', 'quiet', 'finished', 'space', 'home', 'alone', 'slept'],
      phrase: 'there finally being enough space to stop bracing',
      appraisal: 'Nothing needs to be fixed right now.',
      short: 'enough space to stop bracing',
    },
  ],
  defaultShade: 'steadiness',
  understood: (shade, phrase) =>
    `I think I understand this moment now. The calm came because ${phrase}.`,
  deepened:
    "I'm starting to recognise calm for you. It often appears when things feel clear and not demanding too much.",
  needValue: ['safety', 'space', 'rest', 'stability'],
};

export const EMOTION_MAPS: Record<EmotionFamilyId, EmotionMap> = {
  anger: ANGER_MAP,
  flat: FLAT_MAP,
  pressure: PRESSURE_MAP,
  sadness: SADNESS_MAP,
  fear: FEAR_MAP,
  hurt: HURT_MAP,
  shame: SHAME_MAP,
  joy: JOY_MAP,
  calm: CALM_MAP,
};

/**
 * Detection priority. Specific families are checked before Flat & Unclear, which
 * is the catch-all for vague language ("off", "not sure", "I don't know").
 */
export const DETECTION_ORDER: EmotionFamilyId[] = [
  'anger', 'fear', 'pressure', 'hurt', 'shame', 'sadness', 'joy', 'calm', 'flat',
];

/** Representative colour per family — used for calendar dots and entry accents. */
export const FAMILY_COLORS: Record<EmotionFamilyId, string> = {
  joy: '#F5B945',
  calm: '#5FBFA6',
  fear: '#8C7AE6',
  pressure: '#F2994A',
  anger: '#EF6B6B',
  sadness: '#5B8DEF',
  hurt: '#E07BB0',
  shame: '#9B7EDE',
  flat: '#9AA0B5',
};
