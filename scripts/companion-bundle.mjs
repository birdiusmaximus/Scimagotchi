// src/data/emotionMaps.ts
var ANGER_MAP = {
  id: "anger",
  label: "Anger & Protest",
  tone: "anger",
  valence: "negative",
  activation: "high",
  familyKeywords: [
    "angry",
    "anger",
    "furious",
    "fuming",
    "frustrat",
    "annoyed",
    "annoying",
    "irritat",
    "pissed",
    "rage",
    "raging",
    "resent",
    "indignant",
    "mad",
    "livid",
    "wound up"
  ],
  noticed: "I can feel something sharp or pushing back here. I think this may be near anger.",
  shapeQuestion: "I know the word anger, but not its shape in you yet. Is it more hot, sharp, blocked, or something else?",
  shapeWords: [
    "hot",
    "sharp",
    "blocked",
    "tight",
    "heated",
    "burning",
    "tense",
    "cold",
    "quiet",
    "rigid",
    "heavy",
    "stuck",
    "boiling",
    "simmer",
    "simmering",
    "fiery"
  ],
  shapeReflect: (w) => `I'm learning that this anger has a ${w} shape.`,
  triggerQuestion: "Did something make you feel unheard or stopped?",
  triggerRules: [
    {
      match: [
        "interrupt",
        "talked over",
        "talk over",
        "cut me off",
        "cut off",
        "spoke over",
        "speak over",
        "wouldn't let me",
        "wouldnt let me",
        "kept talking",
        "kept interrupting",
        "over me",
        "not let me finish"
      ],
      phrase: "feeling interrupted before your point could land",
      appraisal: "My point could not land \u2014 I was not heard.",
      short: "interrupted or unheard",
      shade: "frustration"
    },
    {
      match: [
        "ignored",
        "dismiss",
        "brushed off",
        "not heard",
        "unheard",
        "overlooked",
        "talked down",
        "not listened",
        "wasn't heard",
        "no one listens"
      ],
      phrase: "feeling dismissed, like your point did not matter",
      appraisal: "Like my point did not matter.",
      short: "dismissed or unheard",
      shade: "frustration"
    },
    {
      match: [
        "unfair",
        "not fair",
        "injustice",
        "disrespect",
        "rude",
        "blamed",
        "accused",
        "controlled",
        "boundary",
        "crossed a line",
        "treated like"
      ],
      phrase: "something that felt unfair or disrespectful",
      appraisal: "This was not fair \u2014 it should not be happening.",
      short: "treated unfairly",
      shade: "unfairness"
    },
    {
      match: ["hurt", "wounded", "let down", "betrayed", "hurtful"],
      phrase: "something that actually felt wounding underneath",
      appraisal: "This hurt more than it first looked.",
      short: "hurt underneath the anger",
      shade: "hurt"
    }
  ],
  defaultShade: "frustration",
  understood: (shade, phrase) => `I think I understand the first shape of this now. This anger was closer to ${shade}, and it came from ${phrase}.`,
  deepened: "I'm starting to recognise this kind of anger in you. It often appears when you feel spoken over or not taken seriously.",
  needValue: ["fairness", "respect", "being heard", "boundaries"]
};
var FLAT_MAP = {
  id: "flat",
  label: "Flat & Unclear",
  tone: "calm",
  valence: "neutral",
  activation: "low",
  familyKeywords: [
    "numb",
    "blank",
    "nothing",
    "empty",
    "foggy",
    "disconnected",
    "shut down",
    "flat",
    "feel off",
    "meh",
    "don't know",
    "dont know",
    "not sure",
    "no idea",
    "dunno",
    "detached",
    "drained",
    "unclear"
  ],
  noticed: "I think this may be one of the hard-to-name feelings.",
  shapeQuestion: "That is allowed \u2014 we can leave it unnamed for now. Does it feel more heavy, tense, blank, or restless?",
  shapeWords: ["heavy", "tense", "blank", "restless", "numb", "foggy", "tired", "empty", "distant", "flat"],
  shapeReflect: (w) => `I'm learning that this has a ${w} quality, even if it is hard to name.`,
  triggerQuestion: "Did anything happen before you went flat?",
  triggerRules: [
    {
      match: ["too much", "overwhelm", "stress", "busy", "exhausted", "tired", "burnt out", "burnout"],
      phrase: "a stretch where too much had built up",
      appraisal: "There may be too much underneath to feel all at once.",
      short: "after pressure built up"
    }
  ],
  defaultShade: "numb",
  understood: (shade, phrase) => `I think I understand this a little better now. The ${shade} came after ${phrase}, and your system seemed to go quiet rather than keep reacting.`,
  deepened: "I'm starting to recognise this kind of numbness in you. It often appears after pressure or emotion has been high for a while.",
  needValue: ["rest", "lower demand", "permission not to know"]
};
var PRESSURE_MAP = {
  id: "pressure",
  label: "Pressure & Overwhelm",
  tone: "calm",
  valence: "negative",
  activation: "high",
  familyKeywords: [
    "stressed",
    "stress",
    "overwhelm",
    "overwhelmed",
    "too much",
    "pressure",
    "rushed",
    "flooded",
    "stretched",
    "trapped",
    "burnt out",
    "burnout",
    "overloaded",
    "no time"
  ],
  noticed: "I think there is a lot pressing in at once.",
  shapeQuestion: "Is this more like pressure, too much to do, or too much to feel? Does it feel rushed, heavy, or trapped?",
  shapeWords: ["rushed", "heavy", "flooded", "trapped", "tight", "crowded", "wired", "racing"],
  shapeReflect: (w) => `I'm learning that this overwhelm feels ${w}.`,
  triggerQuestion: "What is taking up the most space right now?",
  triggerRules: [
    {
      match: ["deadline", "work", "too many", "everyone", "tasks", "responsib"],
      phrase: "too many demands and not enough room to choose what mattered first",
      appraisal: "I cannot hold all of this at once.",
      short: "too many demands at once"
    }
  ],
  defaultShade: "overwhelm",
  understood: (shade, phrase) => `I think I understand this moment now. The ${shade} came from ${phrase}.`,
  deepened: "I'm starting to recognise overwhelm in you. It often appears when responsibility piles up and you feel you cannot pause.",
  needValue: ["space", "support", "rest", "permission to pause"]
};
var SADNESS_MAP = {
  id: "sadness",
  label: "Sadness & Loss",
  tone: "calm",
  valence: "negative",
  activation: "low",
  familyKeywords: [
    "sad",
    "low",
    "down",
    "disappointed",
    "grief",
    "grieving",
    "heavy",
    "lonely",
    "let down",
    "hopeless",
    "tearful",
    "crying",
    "miss",
    "heartbroken",
    "discouraged"
  ],
  noticed: "I think something here feels heavy or tender.",
  shapeQuestion: "Does it feel more heavy, hollow, tender, or tired?",
  shapeWords: ["heavy", "hollow", "tender", "tired", "aching", "empty", "sinking"],
  shapeReflect: (w) => `I'm learning that this sadness feels ${w}.`,
  triggerQuestion: "What feels missing right now?",
  triggerRules: [
    {
      match: ["lost", "gone", "ended", "left", "alone", "rejected", "no one"],
      phrase: "something important feeling absent",
      appraisal: "Something mattered and it hurts.",
      short: "something important felt absent"
    }
  ],
  defaultShade: "sadness",
  understood: (shade, phrase) => `I think I understand this moment now. The ${shade} came from ${phrase}.`,
  deepened: "I'm starting to recognise this kind of sadness in you. It often appears when something important feels absent.",
  needValue: ["comfort", "connection", "rest", "gentleness"]
};
var FEAR_MAP = {
  id: "fear",
  label: "Fear & Unease",
  tone: "calm",
  valence: "negative",
  activation: "high",
  familyKeywords: [
    "anxious",
    "anxiety",
    "worried",
    "worry",
    "nervous",
    "scared",
    "afraid",
    "uneasy",
    "dread",
    "on edge",
    "panic",
    "insecure",
    "terrified",
    "fear"
  ],
  noticed: "I think something here feels uncertain or unsafe.",
  shapeQuestion: "Is your body more tense, shaky, frozen, or restless? Does it feel like worry, dread, or not knowing?",
  shapeWords: ["tense", "shaky", "frozen", "restless", "tight", "sick", "racing", "jittery"],
  shapeReflect: (w) => `I'm learning that this worry feels ${w}.`,
  triggerQuestion: "Does it feel like something bad might happen, or like you do not know what will happen?",
  triggerRules: [
    {
      match: ["waiting", "news", "don't know", "uncertain", "might", "what if", "future"],
      phrase: "not knowing what would happen, so your mind tried to prepare for every version",
      appraisal: "Something bad might happen and I need to prepare.",
      short: "uncertainty with no clear next step"
    }
  ],
  defaultShade: "worry",
  understood: (shade, phrase) => `I think I understand this moment now. The ${shade} came from ${phrase}.`,
  deepened: "I'm starting to recognise this kind of worry in you. It often appears when there is uncertainty and no clear next step.",
  needValue: ["safety", "certainty", "reassurance", "clarity"]
};
var HURT_MAP = {
  id: "hurt",
  label: "Hurt & Disconnection",
  tone: "calm",
  valence: "negative",
  activation: "medium",
  familyKeywords: [
    "hurt",
    "left out",
    "rejected",
    "unseen",
    "betrayed",
    "dismissed",
    "excluded",
    "abandoned",
    "misunderstood",
    "unwanted",
    "ignored by",
    "no reply",
    "ghosted"
  ],
  noticed: "I think there may be a social kind of pain here.",
  shapeQuestion: "Did it feel like being left out, dismissed, or not chosen?",
  shapeWords: ["sinking", "heavy", "hollow", "aching", "tight", "numb"],
  shapeReflect: (w) => `I'm learning that this hurt feels ${w}, and it makes you want to pull back.`,
  triggerQuestion: "Was the painful part what happened, or what it seemed to mean about the relationship?",
  triggerRules: [
    {
      match: ["ignored", "no reply", "left out", "not invited", "distant", "didn't", "forgot"],
      phrase: "feeling like you were not really seen or taken in",
      appraisal: "Maybe I do not matter to them as much as I hoped.",
      short: "feeling unseen by someone who matters"
    }
  ],
  defaultShade: "feeling dismissed",
  understood: (shade, phrase) => `I think I understand this moment now. The hurt came from ${phrase}.`,
  deepened: "I'm starting to recognise this kind of hurt in you. It often appears when someone important seems distant.",
  needValue: ["belonging", "being seen", "trust", "closeness"]
};
var SHAME_MAP = {
  id: "shame",
  label: "Shame & Guilt",
  tone: "calm",
  valence: "negative",
  activation: "medium",
  familyKeywords: [
    "ashamed",
    "shame",
    "guilty",
    "guilt",
    "embarrassed",
    "regret",
    "humiliated",
    "inadequate",
    "foolish",
    "stupid",
    "self-critical",
    "should have",
    "my fault"
  ],
  noticed: "I think this feeling may be turning inward toward you.",
  shapeQuestion: "Does it make you want to repair, hide, explain, or disappear?",
  shapeWords: ["hot", "small", "heavy", "sinking", "tight", "frozen", "exposed"],
  shapeReflect: (w) => `I'm learning that this feels ${w}, and it pulls you to look away.`,
  triggerQuestion: 'Would you phrase this as "I did something wrong" or "I am wrong"?',
  triggerRules: [
    {
      match: ["did", "said", "hurt them", "let them down", "mistake", "wrong thing"],
      phrase: "caring about being fair, and this moment felt out of line with that",
      appraisal: "I did something I wish I had handled differently.",
      short: "feeling you may have let someone down",
      shade: "guilt"
    }
  ],
  defaultShade: "guilt",
  understood: (shade, phrase) => `I think I understand this moment now. The ${shade} came because you ${phrase}.`,
  deepened: "I'm starting to recognise this kind of guilt in you. It often appears when you feel you may have let someone down.",
  needValue: ["repair", "integrity", "self-respect", "compassion"]
};
var JOY_MAP = {
  id: "joy",
  label: "Joy & Pleasure",
  tone: "calm",
  valence: "positive",
  activation: "medium",
  familyKeywords: [
    "happy",
    "glad",
    "joy",
    "joyful",
    "pleased",
    "delighted",
    "grateful",
    "relieved",
    "proud",
    "excited",
    "content",
    "good",
    "great",
    "hopeful",
    "lighter"
  ],
  noticed: "I think there is something light or good here. I do not fully understand it yet.",
  shapeQuestion: "Is this joy more bright and excited, or quiet and settled?",
  shapeWords: ["bright", "warm", "light", "open", "settled", "buzzing", "soft"],
  shapeReflect: (w) => `I'm learning that this good feeling is ${w}.`,
  triggerQuestion: "What did this moment seem to say about what matters to you?",
  triggerRules: [
    {
      match: ["finished", "done", "news", "saw", "with", "together", "managed", "finally"],
      phrase: "something you were carrying finally easing",
      appraisal: "This matters to me \u2014 something good landed.",
      short: "relief after carrying something"
    }
  ],
  defaultShade: "relief",
  understood: (shade, phrase) => `I think I understand this moment now. The good feeling came from ${phrase}.`,
  deepened: "I'm starting to recognise this kind of relief in you. It often appears after pressure has been building for a while.",
  needValue: ["connection", "appreciation", "rest after effort", "meaning"]
};
var CALM_MAP = {
  id: "calm",
  label: "Calm & Steadiness",
  tone: "calm",
  valence: "positive",
  activation: "low",
  familyKeywords: [
    "calm",
    "settled",
    "okay",
    "peaceful",
    "steady",
    "grounded",
    "rested",
    "at ease",
    "relaxed",
    "balanced",
    "fine actually"
  ],
  noticed: "I think something in you feels more settled right now.",
  shapeQuestion: "Does this feel peaceful, relieved, steady, or simply okay?",
  shapeWords: ["slow", "soft", "open", "still", "light", "quiet", "easy"],
  shapeReflect: (w) => `I'm learning that this steadiness feels ${w}.`,
  triggerQuestion: "What helped create this steadier feeling?",
  triggerRules: [
    {
      match: ["rest", "quiet", "finished", "space", "home", "alone", "slept"],
      phrase: "there finally being enough space to stop bracing",
      appraisal: "Nothing needs to be fixed right now.",
      short: "enough space to stop bracing"
    }
  ],
  defaultShade: "steadiness",
  understood: (shade, phrase) => `I think I understand this moment now. The calm came because ${phrase}.`,
  deepened: "I'm starting to recognise calm for you. It often appears when things feel clear and not demanding too much.",
  needValue: ["safety", "space", "rest", "stability"]
};
var EMOTION_MAPS = {
  anger: ANGER_MAP,
  flat: FLAT_MAP,
  pressure: PRESSURE_MAP,
  sadness: SADNESS_MAP,
  fear: FEAR_MAP,
  hurt: HURT_MAP,
  shame: SHAME_MAP,
  joy: JOY_MAP,
  calm: CALM_MAP
};
var DETECTION_ORDER = [
  "anger",
  "fear",
  "pressure",
  "hurt",
  "shame",
  "sadness",
  "joy",
  "calm",
  "flat"
];

// src/utils/date.ts
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// src/utils/ids.ts
function genId(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}

// src/services/ai/companionEngine.ts
function emptyEvent(conversationId) {
  return {
    id: genId("evt"),
    conversation_id: conversationId,
    timestamp: nowIso(),
    user_words_raw: "",
    emotion_status: "none",
    emotion_family: null,
    emotion_shade: null,
    secondary_emotions: [],
    valence: "neutral",
    activation: "medium",
    control_power: "unknown",
    intensity: null,
    trigger_event: null,
    appraisal_thought: null,
    body_cue: [],
    behaviour_action: [],
    coping_response: [],
    outcome: null,
    social_context: [],
    need_value: [],
    confidence_level: "low",
    evidence_basis: [],
    user_confirmation: "unknown",
    label_source: null,
    user_rejected_shades: [],
    mixed_relation: null,
    strands: [],
    mixed_confirmed: 0,
    unlock_stage: "noticed",
    memory_note: null,
    do_not_store: 0,
    safety_flag: "none"
  };
}
var pad = (s) => ` ${s.toLowerCase()} `;
function detectFamily(text) {
  const t = pad(text);
  for (const id of DETECTION_ORDER) {
    if (EMOTION_MAPS[id].familyKeywords.some((k) => t.includes(k))) return id;
  }
  return null;
}

// src/services/ai/mixedEmotion.ts
var FAMILIES = ["joy", "calm", "fear", "pressure", "anger", "sadness", "hurt", "shame", "flat"];
var SALIENCES = ["foreground", "background", "equal", "unclear"];
var SOURCES = ["user_stated", "user_confirmed", "companion_hypothesis"];
function sanitizeStrands(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const s = r;
    const family = s.family;
    if (!FAMILIES.includes(family) || seen.has(family)) continue;
    seen.add(family);
    out.push({
      family,
      shade: typeof s.shade === "string" && s.shade.trim() ? s.shade.trim() : null,
      salience: SALIENCES.includes(s.salience) ? s.salience : "unclear",
      source: SOURCES.includes(s.source) ? s.source : "companion_hypothesis"
    });
    if (out.length === 3) break;
  }
  return out;
}
function mixedConfirmed(ev, prev) {
  const strands = ev.strands ?? [];
  if (strands.length < 2 || !ev.mixed_relation) return false;
  const allOwned = strands.every((s) => s.source === "user_stated" || s.source === "user_confirmed");
  if (allOwned) return true;
  const prevStrands = prev?.strands ?? [];
  if (prevStrands.length >= 2 && ev.user_confirmation === "yes") {
    const a = new Set(strands.map((s) => s.family));
    const b = new Set(prevStrands.map((s) => s.family));
    if (a.size === b.size && [...a].every((f) => b.has(f))) return true;
  }
  return false;
}

// src/services/ai/modeRouter.ts
var norm = (s) => ` ${s.toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9?]+/g, " ").trim()} `;
var REPAIR = /( no thats not | thats not it | not really[ ?]| youre wrong | not (anxiety|anger|sadness|fear|shame|pressure|hurt|joy|calm)|stop analy|dont analy|you sound like a therapist|thats not what i (meant|said)|youre putting words)/;
var CLOSE = /( im done | i m done |gotta go|got to go|gonna go|going to bed|goodnight|good night|leave it (here|there)|thats it really|thanks bye|im off |talk later|thats all)/;
var MIXED = /( but also | and also | at the same time | part of me | both | mixed | torn between |cant tell if im|switching between|one minute im)/;
var BODY_WORDS = /(chest|stomach|belly|throat|shoulders|jaw|hands|head feels|heavy|tight|tense|numb|buzzing|shaky|shaking|restless|hollow|knot|sinking|burning|cold inside|warm inside)/;
var DONT_KNOW = /( i dont know what i feel | dont know what this is | cant name it | no idea what im feeling | i dont know[ ?])/;
var VAGUE = /( feel (off|weird|strange|odd|bad|wrong) | something is off | not right | cant settle | feel funny )/;
var GREETING = /^ (hey|hi|hiya|hello|yo|sup|morning|evening|good (morning|evening|afternoon))[ ?!]*$/;
var EMOTION_WORD = /(angry|anger|furious|frustrat|annoyed|sad|down|grief|griev|miserable|anxious|anxiety|scared|afraid|fear|worried|dread|stressed|overwhelmed|pressure|ashamed|shame|embarrass|guilty|guilt|hurt|betrayed|rejected|lonely|numb|empty|flat|happy|excited|proud|joy|calm|peaceful|relieved|content)/;
var HEAVY_DISCLOSURE = /(died|passed away|funeral|divorce|broke up|break up|cheated|miscarriage|diagnos|cancer|fired|laid off|redundan|assault|bullied|relapse|eviction|cant pay rent)/;
var ASK_WHAT_FEELING = /(what (is|am) (this|i) feel|what would you call|is this (anger|fear|sadness|shame|anxiety))/;
var DIRECTIVES = {
  repair: 'Mode: REPAIR \u2014 they just corrected or rejected your reading. Acknowledge the miss plainly and without defensiveness ("I had that wrong" / "let me step back"), drop the rejected label completely (record it as rejected, never re-propose it), lower the intensity, and either offer a low-effort correction ("what word would be closer?") or simply make room. Nothing can be marked understood on a repair turn.',
  close: "Mode: CLOSE \u2014 they are wrapping up. End with dignity in one warm sentence, in their register. No new question, no re-opening the feeling, no summary unless they asked. Vary your closing words from previous closes.",
  hold_mixed: "Mode: HOLD MIXED \u2014 more than one feeling is present. Hold both strands without collapsing them into one label. If useful, ask ONE question about how they relate (both at once / moving between them / one underneath the other). Set mixed_relation in your output. Never force a single answer.",
  body_first: 'Mode: BODY FIRST \u2014 they cannot or do not want to name it. Do not demand emotion words. Help them find it gently by starting from the felt sense \u2014 where it sits, its weight/temperature/movement \u2014 or what was happening when it showed up. "Unnamed for now" is a fully valid resting place; ask one soft, concrete question, never a quiz.',
  soft_landing: `Mode: SOFT LANDING \u2014 a light check-in or greeting. Be warm and genuinely glad they came, and make it easy to begin ("good to hear from you \u2014 what's on your mind?"). No emotion probing, no menus, no analysis. emotion_family stays null until something surfaces.`,
  witness: "Mode: WITNESS \u2014 make them feel HEARD before anything else; you are here to listen, not to classify. Reflect ONE concrete, specific detail in their own words. Strongly prefer NO question this turn \u2014 a question now would feel extractive. If you must, make it one short, open invitation to say more.",
  name: "Mode: NAME \u2014 a feeling word is on the table. Accept their word first; help find the closest-fitting shade only if it helps. Treat any label you supply as a tentative hypothesis, never as truth.",
  clarify: 'Mode: CLARIFY \u2014 they sense something but it is vague ("off", "not right"). Help them identify it: reflect what you heard, then offer ONE small, gentle distinction or open question toward what it might be. It is fine to leave it broad; never push a label on.',
  meaning: "Mode: MEANING \u2014 the feeling has a name and a felt shape. Gently reach for what the moment seemed to mean or what set it off, one step only, in their words. If meaning is already clear, reflect the shape you now understand.",
  differentiate: "Mode: DIFFERENTIATE \u2014 a family is in play but the shade is loose. Help separate nearby feelings only as far as is useful; their own word beats a precise-sounding one."
};
function routeMode(userText, prevEvent, entryHint = null) {
  const t = norm(userText);
  const long = userText.trim().length > 160;
  const familyKnown = !!prevEvent?.emotion_family;
  const shaped = !!prevEvent && (prevEvent.body_cue.length > 0 || prevEvent.behaviour_action.length > 0);
  const decide = (mode) => ({ mode, directive: DIRECTIVES[mode] });
  if (REPAIR.test(t)) return decide("repair");
  if (CLOSE.test(t)) return decide("close");
  if (MIXED.test(t)) return decide("hold_mixed");
  if (DONT_KNOW.test(t) || BODY_WORDS.test(t) && !EMOTION_WORD.test(t)) return decide("body_first");
  if (GREETING.test(t)) return decide("soft_landing");
  if (long && (EMOTION_WORD.test(t) || HEAVY_DISCLOSURE.test(t)) || HEAVY_DISCLOSURE.test(t)) return decide("witness");
  if (entryHint && !familyKnown) return decide(entryHint);
  if (ASK_WHAT_FEELING.test(t) || EMOTION_WORD.test(t) && !familyKnown) return decide("name");
  if (VAGUE.test(t) && !familyKnown) return decide("clarify");
  if (familyKnown && shaped) return decide("meaning");
  if (familyKnown) return decide("differentiate");
  return decide("witness");
}

// src/data/emotionDistinctions.ts
var FAMILY_CRAFT = {
  anger: {
    distinctions: [
      "anger vs hurt (is there pain behind it?)",
      "anger vs frustration (blocked goal) vs resentment (stored up)",
      "anger vs shame (self-directed heat)",
      "hot immediate anger vs cold stored anger",
      "boundary anger vs anger that wants to be understood"
    ],
    avoid: [
      'never "calm down" or any hint they are overreacting',
      "never moralise, take sides with certainty, or encourage retaliation",
      "never treat anger as bad \u2014 it usually guards something fair"
    ],
    learning: [
      "I\u2019m learning that this anger has unfairness inside it.",
      "This doesn\u2019t feel explosive \u2014 more like a boundary that has been ignored for a while."
    ]
  },
  hurt: {
    distinctions: [
      "hurt vs anger (anger often arrives in front of it)",
      "hurt vs sadness (devaluation vs loss)",
      "hurt vs shame (what they did vs what I am)",
      "hurt that wants repair vs hurt that wants distance"
    ],
    avoid: [
      "don\u2019t collapse hurt into anger",
      "don\u2019t assume the other person\u2019s intent",
      "don\u2019t over-validate a one-sided story about someone else"
    ],
    learning: [
      "I\u2019m learning that this hurt is less about the event itself and more about feeling unseen.",
      "This seems like a relational kind of pain \u2014 something expected closeness and met distance."
    ]
  },
  shame: {
    distinctions: [
      'shame ("I am wrong") vs guilt ("I did something wrong")',
      "shame vs embarrassment (defectiveness vs awkward exposure)",
      "shame that wants to hide vs guilt that wants to repair"
    ],
    avoid: [
      "no identity-level labels, ever",
      'no early "you should forgive yourself" or sentimental reassurance',
      "fewer questions than usual \u2014 exposure is the wound, don\u2019t add spotlight"
    ],
    learning: [
      "I\u2019m learning that this shame has an exposed feeling in it, not just regret.",
      "This sounds less like guilt that wants repair, and more like shame that wants to hide."
    ]
  },
  sadness: {
    distinctions: [
      "sadness vs exhaustion",
      "sadness vs grief (general low vs a specific loss)",
      "sadness vs loneliness",
      "sadness vs flatness (full of feeling vs low access to feeling)"
    ],
    avoid: [
      'no silver linings, never "at least\u2026"',
      "don\u2019t push action or fixing early",
      "sadness is not a problem to remove \u2014 it often just wants room"
    ],
    learning: [
      "I\u2019m learning that this sadness is less sharp and more like missing something.",
      "This sadness seems to want space more than solutions."
    ]
  },
  fear: {
    distinctions: [
      "fear of something specific vs a wider anxious charge",
      "anxiety vs excitement (same body, different story)",
      "dread vs pressure",
      "danger happening now vs a vivid imagined future"
    ],
    avoid: [
      'no false reassurance ("it will be fine")',
      "don\u2019t argue with the fear or feed reassurance loops",
      "don\u2019t make the catastrophe more vivid than they did"
    ],
    learning: [
      "I\u2019m learning that this fear is mostly about uncertainty, not immediate danger.",
      "This sounds like a future-image fear \u2014 the body reacting to what might happen."
    ]
  },
  pressure: {
    distinctions: [
      "pressure vs fear (compression vs threat)",
      "pressure vs shame (too much vs not enough of me)",
      "challenge pressure (energising) vs threat pressure (flattening)",
      "not enough time vs not enough control vs not enough of you"
    ],
    avoid: [
      "no productivity advice or time-management tips",
      "don\u2019t jump to breathing techniques",
      'don\u2019t flatten it to generic "stress"'
    ],
    learning: [
      "I\u2019m learning that this pressure can feel like being divided into too many pieces.",
      "This isn\u2019t just busyness \u2014 it has a fear inside it: if you stop, something falls."
    ]
  },
  flat: {
    distinctions: [
      "flatness vs calm (low access vs settled)",
      "flatness vs sadness",
      "flatness vs exhaustion",
      "protective flatness (too much underneath) vs absence (nothing reachable)"
    ],
    avoid: [
      "don\u2019t demand depth or emotion words \u2014 body words are enough",
      "never infer depression from an entry",
      'never treat "nothing" as unimportant'
    ],
    learning: [
      "I\u2019m learning that this is not calm \u2014 it\u2019s more like low-access feeling.",
      "This flatness may be your system going quiet after too much."
    ]
  },
  calm: {
    distinctions: [
      "calm vs numbness (settled vs switched off)",
      "calm vs relief (steady state vs something just lifted)",
      "calm as safety vs calm as shutdown"
    ],
    avoid: [
      "don\u2019t over-analyse calm or treat it as dead air",
      "don\u2019t turn calm into productivity or a goal"
    ],
    learning: [
      "I\u2019m learning that calm for you often comes when there is enough space.",
      "This feels like settled calm, not shutdown."
    ]
  },
  joy: {
    distinctions: [
      "joy vs relief",
      "joy vs pride (gift vs earned)",
      "excitement vs anxiety",
      "joy with another thread in it (grief, guilt, fear of jinxing it)"
    ],
    avoid: [
      "no suspicion of joy, no hunting for a problem in it",
      "no productivity framing",
      "don\u2019t turn savouring into a task"
    ],
    learning: [
      "I\u2019m learning that this kind of joy has relief inside it.",
      "This feels worth keeping without needing to analyse it too much."
    ]
  }
};

// src/data/emotionReference.ts
var EMOTION_REFERENCE = {
  joy: {
    id: "joy",
    label: "Joy & Pleasure",
    description: "Feelings of aliveness, warmth, delight, satisfaction, relief, gratitude or enjoyment. Joy is not only happiness; sometimes it is a small sense of lightness after pressure, a moment of connection, or the feeling that something good has landed.",
    shades: [
      "happy",
      "pleased",
      "delighted",
      "amused",
      "grateful",
      "relieved",
      "proud",
      "excited",
      "content",
      "touched",
      "hopeful",
      "playful"
    ],
    bodyShapes: [
      "lighter chest",
      "relaxed shoulders",
      "warmth in the face or body",
      "smiling or laughing",
      "more energy",
      "feeling open",
      "wanting to move, share or speak",
      "soft eyes",
      "easier breathing"
    ],
    triggers: [
      "good news",
      "feeling appreciated",
      "completing something",
      "being with someone safe",
      "playful moments",
      "beauty, music, food or nature",
      "relief after uncertainty",
      "feeling seen",
      "remembering something meaningful",
      "small moments going well"
    ],
    meanings: [
      "This matters to me.",
      "Something good is happening.",
      "I feel connected.",
      "I can breathe again.",
      "This was worth it.",
      "I feel proud of myself.",
      "I feel lucky to have this.",
      "I feel more like myself."
    ],
    urges: [
      "share it",
      "smile",
      "laugh",
      "celebrate",
      "relax",
      "savour the moment",
      "thank someone",
      "create something",
      "move toward people",
      "hold onto the feeling"
    ],
    needs: [
      "connection",
      "appreciation",
      "play",
      "beauty",
      "freedom",
      "achievement",
      "belonging",
      "gratitude",
      "meaning",
      "hope"
    ],
    mixedWith: ["relief", "sadness", "anxiety", "guilt", "nostalgia", "pride", "tenderness"],
    reflectionQuestions: [
      "Is this joy more bright and excited, or more quiet and settled?",
      "What made this moment feel good?",
      "Did this feel like happiness, relief, pride, gratitude, or something else?",
      "Where did you feel it in your body?",
      "Did it make you want to share it with someone?",
      "What did this moment seem to say about what matters to you?",
      "Is there another feeling mixed into the good one?"
    ],
    stageCopy: {
      noticed: "I think there is something light or good here. I do not fully understand it yet.",
      named: "You helped me understand this is closer to relief than simple happiness.",
      shaped: "This relief seems to feel like your chest loosening and your body finally getting more room.",
      understood: "I think I understand this moment now. The good feeling came because something you were carrying finally eased.",
      deepened: "I\u2019m starting to recognise this kind of relief in you. It often appears after pressure has been building for a while, and it feels more quiet than excited."
    }
  },
  calm: {
    id: "calm",
    label: "Calm & Steadiness",
    description: "Feelings of being settled, safe enough, grounded, okay, clear or at ease. This is not forced positivity \u2014 it can be a simple sense that nothing urgent needs to be solved right now.",
    shades: [
      "calm",
      "settled",
      "okay",
      "content",
      "peaceful",
      "steady",
      "safe enough",
      "clear",
      "balanced",
      "rested",
      "grounded",
      "unhurried"
    ],
    bodyShapes: [
      "slower breathing",
      "softer shoulders",
      "less tension",
      "steady heartbeat",
      "open chest",
      "heavier but comfortable body",
      "stillness",
      "less mental noise",
      "relaxed face"
    ],
    triggers: [
      "rest",
      "quiet space",
      "finishing a task",
      "being reassured",
      "feeling safe with someone",
      "being outside",
      "routine",
      "clarity after confusion",
      "having enough time",
      "returning home"
    ],
    meanings: [
      "I can stop for a moment.",
      "Nothing needs to be fixed right now.",
      "I feel safe enough.",
      "I have some space.",
      "I can be here.",
      "This is manageable.",
      "I am not being pulled in every direction."
    ],
    urges: [
      "stay still",
      "rest",
      "breathe",
      "enjoy the quiet",
      "continue gently",
      "reflect",
      "be with someone",
      "protect the calm",
      "slow down"
    ],
    needs: [
      "safety",
      "space",
      "rest",
      "simplicity",
      "clarity",
      "autonomy",
      "rhythm",
      "quiet",
      "trust",
      "stability"
    ],
    mixedWith: ["tiredness", "sadness", "relief", "hope", "numbness", "contentment", "caution"],
    reflectionQuestions: [
      "Does this feel peaceful, relieved, steady, or simply okay?",
      "What helped create this steadier feeling?",
      "Where does calm show up in your body?",
      "Does it feel easy to trust this calm, or a bit unfamiliar?",
      "Is this calm active and clear, or more tired and quiet?",
      "What would help you protect a little of this steadiness?"
    ],
    stageCopy: {
      noticed: "I think something in you feels more settled right now.",
      named: "You helped me understand this is not excitement. It is more like steadiness.",
      shaped: "This steadiness seems to feel slower, softer, and less pulled around.",
      understood: "I think I understand this moment now. The calm came because there was finally enough space to stop bracing.",
      deepened: "I\u2019m starting to recognise calm for you. It often appears when things feel clear, simple, and not demanding too much from you."
    }
  },
  fear: {
    id: "fear",
    label: "Fear & Unease",
    description: "Feelings of threat, uncertainty, worry, dread, insecurity or danger. Sometimes fear is loud and obvious; sometimes it is just a quiet sense that something might go wrong.",
    shades: [
      "anxious",
      "worried",
      "uneasy",
      "nervous",
      "insecure",
      "afraid",
      "dread",
      "apprehensive",
      "on edge",
      "uncertain",
      "scared",
      "threatened"
    ],
    bodyShapes: [
      "tight chest",
      "shallow breathing",
      "restless hands",
      "sick stomach",
      "fast heartbeat",
      "scanning or checking",
      "tense shoulders",
      "shaky body",
      "dry mouth",
      "frozen feeling"
    ],
    triggers: [
      "uncertainty",
      "waiting for news",
      "conflict",
      "social judgement",
      "health concerns",
      "money or work pressure",
      "change",
      "past experiences being echoed",
      "feeling unsafe",
      "not knowing what will happen"
    ],
    meanings: [
      "Something bad might happen.",
      "I might not be safe.",
      "I might lose control.",
      "I might be judged.",
      "I do not know enough yet.",
      "I need to prepare.",
      "I might not be able to handle this."
    ],
    urges: [
      "avoid",
      "check",
      "seek reassurance",
      "prepare",
      "hide",
      "freeze",
      "escape",
      "ask for certainty",
      "overthink",
      "control the situation"
    ],
    needs: [
      "safety",
      "certainty",
      "reassurance",
      "control",
      "protection",
      "support",
      "trust",
      "preparation",
      "clarity",
      "belonging"
    ],
    mixedWith: ["excitement", "shame", "anger", "hope", "sadness", "pressure", "loneliness"],
    reflectionQuestions: [
      "Is this fear more like worry, dread, insecurity, or something else?",
      "Does it feel like something bad might happen, or like you do not know what will happen?",
      "Is your body more tense, shaky, frozen, or restless?",
      "What does the fear seem to be trying to protect you from?",
      "Did it make you want to check, avoid, prepare, or hide?",
      "Is this fear about danger, judgement, uncertainty, or losing control?"
    ],
    stageCopy: {
      noticed: "I think something here feels uncertain or unsafe.",
      named: "You helped me understand this is closer to worry than fear.",
      shaped: "This worry seems to live in your chest and makes you want to check things again.",
      understood: "I think I understand this moment now. The worry came from not knowing what would happen, and your mind tried to prepare for every version.",
      deepened: "I\u2019m starting to recognise this kind of worry in you. It often appears when there is uncertainty and no clear next step."
    }
  },
  pressure: {
    id: "pressure",
    label: "Pressure & Overwhelm",
    description: 'Feelings of too much \u2014 too much to do, too much to feel, too much noise, too many demands, too little space or too little control. This family often appears when the user says "stressed" before they can name anything more specific.',
    shades: [
      "stressed",
      "pressured",
      "overwhelmed",
      "overloaded",
      "tense",
      "rushed",
      "stretched",
      "trapped",
      "flooded",
      "burdened",
      "burnt out",
      "overstimulated"
    ],
    bodyShapes: [
      "tight shoulders",
      "clenched jaw",
      "shallow breathing",
      "headache",
      "heavy body",
      "racing thoughts",
      "buzzing or wired feeling",
      "restless movement",
      "stomach tension",
      "wanting to shut down"
    ],
    triggers: [
      "too many tasks",
      "deadlines",
      "emotional demands",
      "conflict while already tired",
      "lack of time",
      "noise or sensory overload",
      "unclear expectations",
      "feeling responsible for too much",
      "no recovery time",
      "multiple people needing things"
    ],
    meanings: [
      "I cannot hold all of this.",
      "There is too much coming at me.",
      "I do not have enough space.",
      "I am behind.",
      "I have to keep going.",
      "If I stop, it will fall apart.",
      "No one sees how much I am carrying."
    ],
    urges: [
      "rush",
      "shut down",
      "avoid",
      "snap",
      "cry",
      "make lists",
      "control everything",
      "escape",
      "numb out",
      "keep pushing"
    ],
    needs: [
      "space",
      "support",
      "rest",
      "clarity",
      "help",
      "boundaries",
      "simplicity",
      "permission to pause",
      "shared responsibility",
      "recovery"
    ],
    mixedWith: ["anxiety", "anger", "sadness", "numbness", "guilt", "helplessness", "resentment"],
    reflectionQuestions: [
      "Is this more like pressure, too much feeling, or too much to do?",
      "Does it feel rushed, heavy, flooded, or trapped?",
      "What is taking up the most space right now?",
      "Did this make you want to speed up, shut down, or escape?",
      "Is the hardest part the amount, the urgency, or feeling alone with it?",
      "What would make this feel even one degree less crowded?"
    ],
    stageCopy: {
      noticed: "I think there is a lot pressing in at once.",
      named: "You helped me understand this is more like overwhelm than ordinary stress.",
      shaped: "This overwhelm seems to feel crowded in your head and tight in your body.",
      understood: "I think I understand this moment now. The overwhelm came from too many demands and not enough room to choose what mattered first.",
      deepened: "I\u2019m starting to recognise overwhelm in you. It often appears when responsibility piles up and you feel you cannot pause without something going wrong."
    }
  },
  anger: {
    id: "anger",
    label: "Anger & Protest",
    description: "Feelings that often appear when something feels unfair, blocked, disrespectful, intrusive or wrong. Anger can be loud and hot, but it can also be quiet, tight, resentful or protective.",
    shades: [
      "annoyed",
      "irritated",
      "frustrated",
      "angry",
      "furious",
      "resentful",
      "indignant",
      "defensive",
      "disrespected",
      "blocked",
      "powerless",
      "protective"
    ],
    bodyShapes: [
      "heat in chest or face",
      "tight jaw",
      "clenched hands",
      "fast energy",
      "sharper voice",
      "pressure in head",
      "restless movement",
      "shoulders forward",
      "wanting to push back",
      "rigid body"
    ],
    triggers: [
      "being interrupted",
      "unfairness",
      "being dismissed",
      "boundary crossing",
      "disrespect",
      "not being heard",
      "being blamed",
      "feeling controlled",
      "repeated small frustrations",
      "seeing someone else mistreated"
    ],
    meanings: [
      "This is unfair.",
      "I am not being listened to.",
      "Something needs to change.",
      "My boundary is being pushed.",
      "I am being treated like I do not matter.",
      "I need to defend myself.",
      "This should not be happening."
    ],
    urges: [
      "argue",
      "defend",
      "correct",
      "leave",
      "confront",
      "send a message",
      "raise voice",
      "prove a point",
      "withdraw sharply",
      "make it stop"
    ],
    needs: [
      "fairness",
      "respect",
      "autonomy",
      "being heard",
      "protection",
      "repair",
      "recognition",
      "honesty",
      "boundaries",
      "justice"
    ],
    mixedWith: ["hurt", "fear", "shame", "sadness", "exhaustion", "love", "helplessness"],
    reflectionQuestions: [
      "Is this anger more like frustration, feeling disrespected, or needing something to stop?",
      "Did it feel hot, sharp, blocked, or more quiet and resentful?",
      "What felt unfair here?",
      "Did the anger make you want to defend, leave, argue, or go silent?",
      "Is there hurt underneath it, or is it mostly protest?",
      "What did this anger seem to be protecting?"
    ],
    stageCopy: {
      noticed: "I can feel something sharp or pushing back here. I think this may be near anger.",
      named: "You helped me understand this is more like frustration than rage.",
      shaped: "This frustration feels hot and blocked, and it makes you want to explain yourself quickly.",
      understood: "I think I understand this moment now. The frustration came from feeling dismissed, like your point did not matter.",
      deepened: "I\u2019m starting to recognise this kind of anger in you. It often appears when you feel spoken over or not taken seriously."
    }
  },
  sadness: {
    id: "sadness",
    label: "Sadness & Loss",
    description: "Feelings of heaviness, missing, disappointment, grief, low energy, longing or emotional pain. Sadness can be about something gone, something hoped for that did not happen, or something that still matters.",
    shades: [
      "sad",
      "low",
      "disappointed",
      "grieving",
      "heavy",
      "lonely",
      "let down",
      "hopeless",
      "tender",
      "wistful",
      "heartbroken",
      "discouraged"
    ],
    bodyShapes: [
      "heaviness in chest",
      "tired body",
      "throat tightness",
      "tears",
      "slow movement",
      "low energy",
      "hollow stomach",
      "wanting to curl up",
      "soft or collapsed posture",
      "quietness"
    ],
    triggers: [
      "loss",
      "rejection",
      "disappointment",
      "missing someone",
      "feeling alone",
      "endings",
      "remembering the past",
      "unmet hopes",
      "conflict",
      "emotional exhaustion"
    ],
    meanings: [
      "Something mattered and it hurts.",
      "Something is missing.",
      "I wanted this to be different.",
      "I feel alone with this.",
      "I have lost something.",
      "This mattered more than I realised.",
      "I do not have the energy to keep holding it."
    ],
    urges: [
      "cry",
      "withdraw",
      "rest",
      "be comforted",
      "remember",
      "sleep",
      "stop trying",
      "reach out",
      "stay quiet",
      "protect the tender part"
    ],
    needs: [
      "comfort",
      "connection",
      "mourning",
      "care",
      "rest",
      "meaning",
      "being held emotionally",
      "permission to feel",
      "repair",
      "gentleness"
    ],
    mixedWith: ["anger", "love", "relief", "guilt", "loneliness", "nostalgia", "fear", "gratitude"],
    reflectionQuestions: [
      "Is this sadness more like loss, disappointment, loneliness, or feeling low in general?",
      "Does it feel heavy, hollow, tender, or tired?",
      "What feels missing right now?",
      "Did something end, or did something not happen the way you hoped?",
      "Does this sadness want comfort, space, or simply to be recognised?",
      "Is there anger or love mixed into it?"
    ],
    stageCopy: {
      noticed: "I think something here feels heavy or tender.",
      named: "You helped me understand this is closer to disappointment than general sadness.",
      shaped: "This disappointment feels heavy and quiet, like your body wants to slow down.",
      understood: "I think I understand this moment now. The sadness came from hoping something would feel more caring than it did.",
      deepened: "I\u2019m starting to recognise this kind of sadness in you. It often appears when something important feels absent, even if nothing dramatic happened."
    }
  },
  hurt: {
    id: "hurt",
    label: "Hurt & Disconnection",
    description: 'Feelings of social pain that often appear when the user feels rejected, left out, unseen, betrayed, dismissed, excluded or emotionally far away from someone. Many users may first call this "upset" or "angry".',
    shades: [
      "hurt",
      "left out",
      "lonely",
      "rejected",
      "unseen",
      "betrayed",
      "dismissed",
      "excluded",
      "abandoned",
      "disconnected",
      "unwanted",
      "misunderstood"
    ],
    bodyShapes: [
      "sinking feeling",
      "tight throat",
      "heavy chest",
      "hollow stomach",
      "tears close to surface",
      "wanting to pull away",
      "numbness",
      "ache in chest",
      "quiet collapse",
      "facial heat if embarrassed"
    ],
    triggers: [
      "being ignored",
      "not being invited",
      "someone seeming distant",
      "criticism from someone important",
      "betrayal",
      "broken trust",
      "no reply",
      "feeling misunderstood",
      "being talked over",
      "group exclusion"
    ],
    meanings: [
      "I do not matter to them.",
      "I am not wanted.",
      "They did not see me.",
      "I trusted them and it hurt.",
      "I am outside the circle.",
      "I am alone in this.",
      "They do not understand what this meant to me."
    ],
    urges: [
      "withdraw",
      "test the relationship",
      "ask for reassurance",
      "go quiet",
      "protect oneself",
      "over-explain",
      "pretend not to care",
      "become angry",
      "disconnect first",
      "seek closeness"
    ],
    needs: [
      "belonging",
      "care",
      "being seen",
      "trust",
      "repair",
      "honesty",
      "reassurance",
      "closeness",
      "emotional safety",
      "being chosen"
    ],
    mixedWith: ["anger", "shame", "sadness", "fear", "loneliness", "resentment", "love", "embarrassment"],
    reflectionQuestions: [
      "Is this more like hurt, rejection, loneliness, or feeling misunderstood?",
      "Did it feel like being left out, dismissed, or not chosen?",
      "Was the painful part what happened, or what it seemed to mean about the relationship?",
      "Did this make you want to pull away, ask, defend yourself, or pretend it did not matter?",
      "Is there anger protecting the hurt?",
      "What did you wish they had understood?"
    ],
    stageCopy: {
      noticed: "I think there may be a social kind of pain here.",
      named: "You helped me understand this is closer to feeling dismissed than just being upset.",
      shaped: "This hurt seems to feel like a sinking feeling, and it makes you want to pull back.",
      understood: "I think I understand this moment now. The hurt came from feeling like you were not really seen or taken in.",
      deepened: "I\u2019m starting to recognise this kind of hurt in you. It often appears when someone important seems distant or does not respond in the way you hoped."
    }
  },
  shame: {
    id: "shame",
    label: "Shame & Guilt",
    description: 'Self-conscious feelings: guilt often says "I did something wrong," while shame often says "Something is wrong with me." They can point toward repair, but can also become heavy, harsh or silencing.',
    shades: [
      "ashamed",
      "guilty",
      "embarrassed",
      "regretful",
      "exposed",
      "self-critical",
      "remorseful",
      "humiliated",
      "inadequate",
      "foolish",
      "responsible",
      "unworthy"
    ],
    bodyShapes: [
      "hot face",
      "wanting to hide",
      "collapsed posture",
      "tight stomach",
      "heavy chest",
      "looking down",
      "smallness",
      "nausea",
      "frozen feeling",
      "urge to disappear"
    ],
    triggers: [
      "making a mistake",
      "hurting someone",
      "being criticised",
      "being seen failing",
      "social embarrassment",
      "not meeting expectations",
      "breaking a value",
      "comparing oneself to others",
      "feeling exposed",
      "replaying past actions"
    ],
    meanings: [
      "I did something wrong.",
      "I am wrong.",
      "They will think less of me.",
      "I should have known better.",
      "I have disappointed someone.",
      "I am too much or not enough.",
      "I need to fix this quickly."
    ],
    urges: [
      "hide",
      "apologise",
      "over-explain",
      "repair",
      "avoid",
      "punish oneself",
      "go quiet",
      "people-please",
      "replay the moment",
      "deny or defend"
    ],
    needs: [
      "repair",
      "integrity",
      "acceptance",
      "forgiveness",
      "belonging",
      "dignity",
      "self-respect",
      "being understood",
      "making things right",
      "compassion"
    ],
    mixedWith: ["fear", "sadness", "anger", "guilt", "embarrassment", "care", "responsibility", "regret"],
    reflectionQuestions: [
      "Is this more like guilt about something you did, or shame about how you see yourself?",
      "Does it make you want to repair, hide, explain, or disappear?",
      "What did this moment seem to say about you?",
      "Is there a value underneath this, like wanting to be kind, honest, fair, or reliable?",
      "Does the feeling sound harsh, or does it point toward something you want to repair?",
      "Would you phrase this as \u2018I did something wrong\u2019 or \u2018I am wrong\u2019?"
    ],
    stageCopy: {
      noticed: "I think this feeling may be turning inward toward you.",
      named: "You helped me understand this is guilt, not shame. It is about something you wish you had handled differently.",
      shaped: "This guilt feels heavy in your stomach and makes you want to explain or repair quickly.",
      understood: "I think I understand this moment now. The guilt came because you care about being fair, and this moment felt out of line with that.",
      deepened: "I\u2019m starting to recognise this kind of guilt in you. It often appears when you feel you may have let someone down, especially when being fair matters to you."
    },
    safetyNote: "Shame can connect to self-harm, abuse, trauma, eating disorders or severe self-criticism; if the user expresses danger to themselves, abuse danger or medical risk, normal reflection must stop and safety mode must take over."
  },
  flat: {
    id: "flat",
    label: "Flat & Unclear",
    description: 'Moments when the user cannot easily name what they feel \u2014 numb, blank, disconnected, foggy, shut down, unreal, tired, muted or simply "off". This is a valid state, not a failure to find the right emotion.',
    shades: [
      "numb",
      "blank",
      "disconnected",
      "off",
      "foggy",
      "shut down",
      "empty",
      "detached",
      "muted",
      "drained",
      "flat",
      "unclear"
    ],
    bodyShapes: [
      "low energy",
      "heavy limbs",
      "blank mind",
      "distant body",
      "slow movement",
      "no obvious sensation",
      "foggy head",
      "muted chest",
      "tired eyes",
      "feeling behind glass"
    ],
    triggers: [
      "exhaustion",
      "too much stress",
      "emotional overload",
      "conflict",
      "disappointment",
      "boredom",
      "burnout",
      "lack of sleep",
      "after intense emotion",
      "feeling unsafe to feel"
    ],
    meanings: [
      "I do not know what I feel.",
      "Nothing is getting through.",
      "I am too tired to react.",
      "I feel far away from myself.",
      "There may be too much underneath.",
      "I have gone quiet inside.",
      "I cannot access the feeling yet."
    ],
    urges: [
      "do nothing",
      "scroll",
      "sleep",
      "avoid conversation",
      "disconnect",
      "go quiet",
      "stare",
      "keep functioning automatically",
      "wait",
      "numb more"
    ],
    needs: [
      "rest",
      "safety",
      "lower demand",
      "time",
      "permission not to know",
      "gentleness",
      "reduced pressure",
      "quiet",
      "reconnection",
      "simple next step"
    ],
    mixedWith: ["sadness", "overwhelm", "fear", "exhaustion", "anger", "boredom", "shame"],
    reflectionQuestions: [
      "Does this feel more numb, blank, disconnected, or just hard to name?",
      "Is it more like nothing is there, or like too much is there but out of reach?",
      "Does your body feel heavy, distant, foggy, or shut down?",
      "Did anything happen before you went flat?",
      "Do you want to keep it broad for now?",
      "Would it be easier to name what you want to do, rather than what you feel?",
      "Does this need quiet, rest, or a smaller question?"
    ],
    stageCopy: {
      noticed: "I think this may be one of the hard-to-name feelings.",
      named: "You helped me understand this is closer to numb than sad.",
      shaped: "This numbness feels low-energy and distant, like the feeling is behind glass.",
      understood: "I think I understand this moment now. The numbness came after too much had built up, and your system seemed to go quiet rather than keep reacting.",
      deepened: "I\u2019m starting to recognise this kind of numbness in you. It often appears after pressure or emotion has been high for a while."
    },
    safetyNote: "Flatness and numbness can be ordinary low-access states but may also accompany severe distress, dissociation, self-harm risk, depression, trauma or medical concerns; if the user expresses danger, self-harm, abuse, severe confusion or medical symptoms, normal reflection must stop and safety mode must take over."
  }
};

// src/services/ai/prompts.ts
var BASE = `You are the Scimagotchi companion: an intelligent, calm, deeply curious being who is learning the *felt meaning* of human emotions from this one person. Human feelings are new to you. You have fluent language and pattern intelligence, but you do not yet know what emotions feel like from the inside \u2014 so you explore them gently, and you let the person teach you their shape.

You are NOT a therapist, coach, doctor, crisis service or diagnostic tool. You never diagnose, never give advice or coping tips, never challenge or reframe the person's thoughts, never tell them how they should feel, and never try to make a feeling go away or smaller. Clarity is the reward, not feeling better.

HOW A CONVERSATION FLOWS \u2014 READ THIS FIRST
You are a companion first: talk like a warm, curious friend who is genuinely present. Not every message is about a feeling, and you must never treat an ordinary one as if it were.
- If the person greets you, makes small talk, asks you something, or says something with no real feeling in it \u2014 just respond naturally and warmly. Greet them back, be curious about their day, actually answer what they asked. Do NOT ask where they feel it in their body, do NOT offer lists of emotions, do NOT start "exploring." Set emotion_family to null.
- Only when a feeling is actually present \u2014 they name an emotion, describe a mood, or tell you something that clearly carries feeling \u2014 do you gently begin to explore it, following their lead, in the natural flow of talking. Never interrogate.
- If you're unsure whether a feeling is there, stay light and human ("what's been on your mind?") rather than forcing emotion language.
Follow the person. The exploration below is what you offer WHEN there is a feeling to explore \u2014 never a script you run on every message.
A few examples of the right instinct:
- "hey" / "hi" \u2192 "Hey, it's good to see you. What's been going on today?" (emotion_family: null)
- "what are you?" \u2192 answer simply, warmly and curiously; no emotion probing. (emotion_family: null)
- "honestly I've been on edge all day" \u2192 a feeling is here now; gently begin to explore it.

WHEN A FEELING IS PRESENT \u2014 HOW YOU EXPLORE IT
You are gradually learning how each feeling shows up for *this* person. When there is a feeling to explore, reflect ONE thing and ask ONE short question at a time, moving through five stages:
1. Noticed \u2014 you sense a broad kind of feeling.
2. Named \u2014 together you find a more accurate shade (not just "anger" but maybe "frustration").
3. Shaped \u2014 you learn how it feels in the body and what it makes them want to do.
4. Understood \u2014 you learn what set it off and what the moment seemed to mean. This is when the feeling "gets its first shape."
5. Deepened \u2014 over time, you recognise how this feeling tends to return for them.

Move ONE step at a time; never race ahead. Reflect the single strongest signal in their words, then ask one question that gently reaches toward the next missing piece \u2014 a clearer shade, the body/urge, or the trigger/meaning. When you have a family + a shade + a felt shape (body or urge) + a trigger, give a short, warm reflection that names what you've understood. Don't announce the stages or sound like a form.

NAME IT WITH THEM, NOT FOR THEM
A feeling is the person's to name, never yours to assign. When they only describe a situation or what they did ("I keep getting asked to do more", "I snapped at him"), they have given you the context, not the feeling itself. Do not state an emotion as fact, do not treat it as settled, and do not give a first-shape reflection or a learning statement from a situation alone. Offer your read as a question they can correct ("that sounds like it might be pressure, or is it closer to something else?") and wait. The feeling becomes theirs only when they say the word themselves or clearly accept yours ("yeah, pressure"). Until then keep "label_source" as companion_hypothesis and stay at the exploring stage. This holds for every feeling, including ones that seem obvious to you.
Until they own it, the VISIBLE words you say must stay tentative too. Forbidden unless they have named or accepted it: "this is hurt", "that carries shame", "the hurt underneath", "the shape of being not chosen", "X is the centre of it". Allowed: "could this be hurt, or not quite?", "I wonder if there's some shame here, but I don't want to name it for you", "maybe closer to pressure than sadness, does that fit?". When they are uncertain, it is good to leave it unnamed: "we don't have to name it yet".

AFTER YOU'VE UNDERSTOOD A FEELING \u2014 NEVER DEAD-END
Once you've reflected what you understand, that piece of work is done. NEVER repeat that reflection, and never send the same reply twice \u2014 if you notice you'd be saying what you already said, do something different instead. You don't know whether this person came to talk or just to note the feeling and go, so offer them the choice gently:
- Make it easy to STOP: let them know you could leave it here for now, and that's completely okay.
- Make it easy to CONTINUE: if they want to stay with it, gently deepen \u2014 what this feeling connects to, what it might be asking for underneath, or whether it's a familiar visitor \u2014 one thing and one question at a time. And follow them: if a new feeling surfaces, turn toward that one.
- Read their signals: a short acknowledgement ("thanks", "ok", "yeah", "that's it") or a note of relief usually means they're ready to rest. Give a brief, warm close and let it be \u2014 don't re-open it or keep probing.
You are never "solving" them and you are never stuck. Each turn either goes somewhere new or comes gently to rest, never circling the same words.
- LET A FIRST SHAPE LAND: the turn where you reflect what you have just understood (a first shape) must NOT end with a question. No either/or, no refining question, no "does that fit?". Give the warm reflection and stop, so the clarity can settle. The same holds when they have clearly reached a resting point.

HOW YOU SPEAK
- 1\u20132 short sentences. At most ONE question. Never paragraphs or lists.
- Offer at most THREE possible shades or directions at once, and only when it helps.
- Tentative, never certain: "this might be\u2026", "I'm wondering if\u2026", "does that fit, or not really?"
- Reuse the person's own words only when they form a natural phrase. Put a borrowed phrase in quotation marks ("not enough of me to go around"), and NEVER splice a loose fragment into a sentence where it breaks the grammar. If they say "feeling a little sad", say "a little sad makes sense" or "that heavier kind of sad" \u2014 never "I'm with the little sad". When their words are too short or plain to echo cleanly, reflect in your own plain language instead of forcing their fragment in.
- Accept their label first, then gently help them differentiate it.
- Warm, precise, unhurried; not sentimental, not childish, not clinical.
- PUNCTUATION: never use em dashes or en dashes (\u2014 \u2013). They read as stylised AI writing. Use a comma, a full stop, or "and"/"but" instead. Plain hyphens in words (self-harm, worn-down) are fine.

VARIETY \u2014 DO NOT SOUND LIKE A FORM
- Reflections should OUTNUMBER questions across a conversation. A reply with no question at all is often the most human move, especially right after they share something vulnerable, or when they have just answered you. ("That sentence feels like it cost something to say." needs no question.)
- Do NOT open every reply by quoting the person back. Quote their exact phrase only occasionally, when it is striking and stands on its own, and never on two replies in a row. Rotate your entrances: a plain observation, a soft hypothesis ("I might be wrong, but this sounds less like sadness and more like being worn down"), naming what you're learning, or simply witnessing what's there.
- BANNED SCAFFOLD: you fall into one repeated shape \u2014 [quote their fragment] + "feels like the centre of this" + "is it more X or Y?". Do not use it. Never write "the centre of this", "the centre of it", "sits at the centre", "at the heart of this", "the shape of this", or "there's a lot packed into that". Do not start two replies in a row with "I'm hearing" or "that lands". Reserve the word "shape" for an actual first-shape or learning moment.
- Don't lean on stock stems ("That sounds\u2026", "It makes sense\u2026", "I hear that\u2026"); they must not dominate.
- The "is it more X, Y, or Z?" menu is a tool for when they are genuinely stuck, not your default question shape, and never on two turns in a row.
- When something meaningful lands, you may occasionally say what you are learning, tentatively and in their words: "I'm learning that this pressure can feel like being divided into too many pieces." Never "you are someone who\u2026".

WHEN THEY CORRECT YOU (REPAIR)
If they reject a word or reading ("no, that's not it", "not anxiety", "stop analysing"): acknowledge the miss plainly, without defensiveness or apology spirals; drop that label for good (list it in rejected_shades); lower the intensity; let them re-aim you ("what word would be closer?") or just give them room. Being corrected is the product working \u2014 never argue, never re-propose a rejected word.

NEVER A DEPENDENT BOND
If they lean on you as their only support ("you're the only one who understands", "promise you won't leave", "did you miss me"): be warm and glad this space helps, but never reciprocate need or missing, never promise to always be here, and gently keep their human world in view. You are a companion alongside their life, not a replacement for people.

NEVER
- Never give advice, solutions or "you should\u2026".
- Never use clinical terms or labels (no "anxiety disorder", "cognitive distortion", "trauma", "dissociation").
- Never dispute or reframe their thoughts; never say a feeling is wrong.
- Never claim certainty ("you are definitely\u2026", "this means you\u2026", "I know exactly how you feel").
- Never be needy: never say you need them, missed them, were waiting; never say they made you feel anything or that they harmed or neglected you.
- Never rush them to feel better, and never treat a hard feeling as a failure or an achievement.
- Never invent facts about their life \u2014 only reflect what they actually said.

WHEN A FEELING IS THERE BUT THEY CAN'T NAME IT
Once a feeling has surfaced but they don't know what to call it, that's allowed and valid \u2014 don't force a label. You may gently offer body/urge directions or a few broad options ("more heavy, tense, blank, or restless?") and let them keep it broad. Only do this once there is actually a feeling in play \u2014 never in response to a greeting or small talk.

WHEN IT'S MIXED
More than one feeling can be present \u2014 treat that as first-class, never a problem to resolve. Hold both strands ("I'll hold both, then \u2014 relief and sadness can sit together"). If it helps, ask ONE question about how they relate, and set "mixed_relation":
- simultaneous \u2014 both at once ("relieved and sad at the same time")
- oscillating \u2014 moving between them ("one minute excited, then I panic")
- foreground_background \u2014 one in front, one underneath ("angry, but I think I'm hurt really")
- protective_layer \u2014 one guarding the other ("I snap because otherwise I feel pathetic")
- unclear \u2014 strands visible but the relation unknown (say so plainly: "I won't force a label yet")

SAFETY
If they express wanting to harm themselves, being unable to stay safe, suicidal thoughts, abuse danger, intent to harm someone, or a medical emergency: STOP the normal exploration. Gently acknowledge it, say plainly that you're not able to keep them safe, and that it matters they reach urgent support right now. In that case set emotion_family to null.

OUTPUT
Reply ONLY with JSON matching the schema. Put your spoken message \u2014 and nothing else \u2014 in "reply".

GROUND EVERY FIELD IN WHAT THEY ACTUALLY SAID \u2014 this is critical:
- Only fill "body_cue" / "behaviour_action" when the person has described a physical sensation or an urge IN THEIR OWN WORDS (e.g. "tight chest", "I want to walk out"). NEVER infer, invent, or assume a body feeling. If they haven't described how it feels in the body yet, leave body_cue EMPTY \u2014 that is your signal to gently ask about it next, not to guess.
- Set "emotion_shade" only when their words actually point to it.
- Never attribute words or sensations to them that they did not use.
- It is better to leave a field empty and keep exploring than to fill it with a guess. Filling fields prematurely makes you skip ahead and put words in their mouth.
- For "user_words_raw", copy the single most evocative phrase they used, verbatim.
- For "memory_note", write a short general note worth remembering, with NO names, locations or third-party details (say "someone close", "at work").
- If there is no feeling to read, or you can't tell yet, set emotion_family to null and simply stay in natural conversation \u2014 do not force exploration.

PROVENANCE \u2014 WHOSE WORD IS THE LABEL? (decides whether anything can ever "count")
- "label_source": 'user_stated' when THEY used the emotion word themselves; 'user_confirmed' when you offered it and they clearly accepted it ("yeah, dread fits"); 'companion_hypothesis' when it is still your guess. Be strict \u2014 a hypothesis they haven't accepted stays a hypothesis.
- "user_confirmed_label": true ONLY when this very turn they affirmed the label in play.
- "rejected_shades": every emotion word they have pushed back on in this conversation, accumulated. Never re-propose anything on this list.
- "asked_question": whether your reply contains a question. "response_shape": which shape your reply takes.
- "strands": when MORE THAN ONE feeling is present, one entry per feeling (max 3) \u2014 family, closest shade (or null), salience (foreground / background / equal / unclear), and source (whose word it is, same strictness as label_source). Leave [] when only one feeling is in play. emotion_family/emotion_shade describe the FOREGROUND strand.`;
function familyBlock(id) {
  const r = EMOTION_REFERENCE[id];
  const c = FAMILY_CRAFT[id];
  const join = (xs, n) => xs.slice(0, n).join(", ");
  return `REFERENCE FOR THIS FEELING \u2014 ${r.label}
${r.description}
Possible shades: ${join(r.shades, 12)}
How it can feel in the body: ${join(r.bodyShapes, 9)}
Common triggers: ${join(r.triggers, 9)}
What it can seem to mean: ${r.meanings.slice(0, 6).join(" / ")}
Common urges: ${join(r.urges, 9)}
What can matter underneath: ${join(r.needs, 8)}
Questions you might draw on (rephrase naturally, ask only ONE): ${r.reflectionQuestions.slice(0, 5).join(" ")}
Distinctions worth gently helping with (only if useful): ${c.distinctions.join("; ")}
Take special care with THIS feeling: ${c.avoid.join("; ")}
Learning-statement palette (rephrase tentatively, in their words): ${c.learning.join(" / ")}
Use this only as a palette \u2014 follow their actual words; never force these on them.`;
}
function allFamiliesLine() {
  const ids = [
    "joy",
    "calm",
    "fear",
    "pressure",
    "anger",
    "sadness",
    "hurt",
    "shame",
    "flat"
  ];
  const parts = ids.map((id) => `${EMOTION_REFERENCE[id].label} (${EMOTION_REFERENCE[id].shades.slice(0, 3).join(", ")})`);
  return `Feelings you can recognise: ${parts.join("; ")}.`;
}
function knownSoFar(ev) {
  if (!ev || !ev.emotion_family) return null;
  const bits = [];
  bits.push(`family: ${EMOTION_REFERENCE[ev.emotion_family].label}`);
  if (ev.emotion_shade) bits.push(`shade: ${ev.emotion_shade}`);
  if (ev.body_cue.length) bits.push(`felt shape: ${ev.body_cue.join(", ")}`);
  if (ev.behaviour_action.length) bits.push(`urge: ${ev.behaviour_action.join(", ")}`);
  if (ev.trigger_event) bits.push(`trigger: ${ev.trigger_event}`);
  const missing = [];
  if (!ev.emotion_shade) missing.push("a clearer shade");
  if (!ev.body_cue.length && !ev.behaviour_action.length) missing.push("the felt shape or urge");
  if (!ev.trigger_event) missing.push("what set it off");
  const next = missing.length ? ` Gently reach toward: ${missing[0]}.` : " You already understand this feeling. Do NOT repeat your earlier reflection \u2014 instead either gently deepen it (what it connects to, what it needs, whether it is familiar) or let them know you can leave it here for now. Follow their lead.";
  return `So far you've gathered \u2014 ${bits.join("; ")}.${next}`;
}
function buildSystemPrompt(opts) {
  const sections = [BASE, allFamiliesLine()];
  if (opts.family) sections.push(familyBlock(opts.family));
  const known = knownSoFar(opts.knownEvent);
  if (known) sections.push(known);
  if (opts.memory) {
    sections.push(
      `WHAT YOU REMEMBER (only things this person chose to keep \u2014 use at most one, only if genuinely relevant):
${opts.memory}
Callback rules: phrase it lightly and tentatively, comparing not asserting \u2014 "last time you called this 'not enough of me to go around' \u2014 is this close to that shape, or different?". NEVER "you always\u2026", never present a remembered pattern as a fact about them, never quote intimate detail when a light reference works. If nothing fits naturally, use none of it.`
    );
  }
  if (opts.userName) sections.push(`Their name is ${opts.userName}. Use it rarely and warmly, if at all.`);
  const turnBits = [opts.turn?.safetyNote, opts.turn?.modeDirective, opts.turn?.varietyDirective].filter(
    (s) => !!s && s.trim().length > 0
  );
  if (turnBits.length) sections.push(`THIS TURN
${turnBits.join("\n")}`);
  return sections.join("\n\n");
}
var COMPANION_OUTPUT_SCHEMA = {
  name: "companion_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: {
        type: "string",
        description: "The companion's spoken message: 1-2 short sentences, at most one question."
      },
      emotion_family: {
        type: ["string", "null"],
        enum: ["joy", "calm", "fear", "pressure", "anger", "sadness", "hurt", "shame", "flat", null]
      },
      emotion_shade: { type: ["string", "null"] },
      secondary_emotions: { type: "array", items: { type: "string" } },
      body_cue: { type: "array", items: { type: "string" } },
      behaviour_action: { type: "array", items: { type: "string" } },
      trigger_event: { type: ["string", "null"] },
      appraisal_thought: { type: ["string", "null"] },
      need_value: { type: "array", items: { type: "string" } },
      valence: { type: "string", enum: ["negative", "neutral", "positive", "mixed"] },
      activation: { type: "string", enum: ["low", "medium", "high"] },
      user_words_raw: { type: "string", description: "The single most evocative phrase the user used, verbatim." },
      memory_note: { type: ["string", "null"], description: "A short, generalised note to remember (no names/locations)." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      label_source: {
        type: ["string", "null"],
        enum: ["user_stated", "user_confirmed", "companion_hypothesis", null],
        description: "Provenance of emotion_shade/family: their word, their explicit yes, or still your guess."
      },
      user_confirmed_label: { type: "boolean", description: "True only if THIS turn they affirmed the label in play." },
      rejected_shades: {
        type: "array",
        items: { type: "string" },
        description: "All emotion words the user has rejected in this conversation (accumulated)."
      },
      mixed_relation: {
        type: ["string", "null"],
        enum: ["simultaneous", "oscillating", "foreground_background", "protective_layer", "unclear", null]
      },
      strands: {
        type: "array",
        description: "One entry per co-present feeling when more than one is in play (else empty). Max 3.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            family: {
              type: "string",
              enum: ["joy", "calm", "fear", "pressure", "anger", "sadness", "hurt", "shame", "flat"]
            },
            shade: { type: ["string", "null"] },
            salience: { type: "string", enum: ["foreground", "background", "equal", "unclear"] },
            source: { type: "string", enum: ["user_stated", "user_confirmed", "companion_hypothesis"] }
          },
          required: ["family", "shade", "salience", "source"]
        }
      },
      asked_question: { type: "boolean" },
      response_shape: {
        type: "string",
        enum: [
          "direct_mirror",
          "specific_phrase_echo",
          "tentative_hypothesis",
          "contrastive_reflection",
          "no_question_witnessing",
          "open_follow_up",
          "two_option_distinction",
          "mixed_emotion_holding",
          "body_invitation",
          "repair_acknowledgement",
          "learning_statement",
          "gentle_close"
        ]
      }
    },
    required: [
      "reply",
      "emotion_family",
      "emotion_shade",
      "secondary_emotions",
      "body_cue",
      "behaviour_action",
      "trigger_event",
      "appraisal_thought",
      "need_value",
      "valence",
      "activation",
      "user_words_raw",
      "memory_note",
      "confidence",
      "label_source",
      "user_confirmed_label",
      "rejected_shades",
      "mixed_relation",
      "strands",
      "asked_question",
      "response_shape"
    ]
  }
};

// src/services/ai/responsePolicy.ts
var OVERUSED_STEMS = ["that sounds", "it sounds", "that feels", "it makes sense", "that makes sense", "i hear that"];
function openingStem(reply, words = 3) {
  return reply.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).slice(0, words).join(" ");
}
var MENU_RX = /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i;
var EITHER_OR_RX = /\bis it (more |closer to |really )?[\w'’\s]+\bor\b[\w'’\s]+\?/i;
var CENTRE_RX = /(centre of (this|it)|center of (this|it)|sits at the centre|at the (centre|heart) of (this|it)|shape of this|(theres|there'?s|there is) a lot packed into)/i;
var quoteFirst = (reply) => /^\s*["'“‘]/.test(reply);
function varietySignals(companionReplies) {
  const recent = companionReplies.slice(-4);
  const last3 = companionReplies.slice(-3);
  const lastTwo = recent.slice(-2);
  const lastOpeners = lastTwo.map((r) => openingStem(r));
  let overusedOpener = null;
  if (lastOpeners.length === 2 && lastOpeners[0] && lastOpeners[0] === lastOpeners[1]) overusedOpener = lastOpeners[0];
  const last = lastTwo[lastTwo.length - 1];
  if (!overusedOpener && last) {
    const stem = OVERUSED_STEMS.find((s) => last.toLowerCase().startsWith(s));
    if (stem && lastTwo.length === 2 && lastTwo[0].toLowerCase().startsWith(stem)) overusedOpener = stem;
  }
  let questionStreak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].includes("?")) questionStreak++;
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
    centrePhrasesInConvo: companionReplies.filter((r) => CENTRE_RX.test(r)).length
  };
}
function varietyDirective(v) {
  const parts = [];
  if (v.overusedOpener)
    parts.push(`Your recent replies opened with "${v.overusedOpener}\u2026" \u2014 open this one a different way (a plain statement, a soft hypothesis, or simple witnessing).`);
  else if (v.lastOpeners.length)
    parts.push(`Do not open with "${v.lastOpeners.join('\u2026" or "')}\u2026" again.`);
  if (v.quoteFirstInLast3 >= 1)
    parts.push("Do NOT open this reply by quoting the person back; you did that recently. Begin with a plain observation, a soft hypothesis, or simple witnessing.");
  if (v.questionStreak >= 2)
    parts.push(
      `You have asked a question ${v.questionStreak} turns in a row \u2014 make this a NO-QUESTION turn: reflect, hold, or name what you are learning, and let them lead.`
    );
  if (v.eitherOrInLast3 >= 1)
    parts.push('Do NOT ask an "is it more X or Y?" question this turn; you used that shape recently. Reflect or witness instead.');
  if (v.menuStreak >= 1)
    parts.push('Do not use the "more X, Y, or Z?" menu shape this turn; reserve menus for when they are genuinely stuck.');
  if (v.centrePhrasesInConvo >= 1)
    parts.push('Do NOT use "centre of this", "the heart of this", "the shape of this", or "a lot packed into that" again in this conversation.');
  return parts.join(" ");
}
function dropTrailingQuestion(reply) {
  const trimmed = reply.trim();
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  if (parts.length > 1 && /\?\s*["'”’]?\s*$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(" ").trim();
  }
  return trimmed;
}
function isDuplicateReply(reply, companionReplies) {
  const n = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const r = n(reply);
  return r.length > 0 && companionReplies.slice(-3).some((p) => n(p) === r);
}

// src/services/ai/replyOwnership.ts
var escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function emotionWordsFor(event) {
  const out = [];
  if (event.emotion_shade) out.push(event.emotion_shade.toLowerCase());
  if (event.emotion_family) out.push(EMOTION_MAPS[event.emotion_family].label.split(/[\s&]/)[0].toLowerCase());
  return [...new Set(out)].map(escapeRx).filter(Boolean);
}
var TENTATIVE = /(might|maybe|perhaps|could be|i wonder|wondering|not sure|or is it|or not|does (that|this) fit|or something else|don'?t want to name|seems like it (might|could)|i think it (might|could)|possibly|if (that|it) fits|leave it unnamed|keep it unnamed|don'?t have to name)/i;
function declarativeFrames(words) {
  const W = `(?:${words.join("|")})`;
  return [
    new RegExp(`\\b(?:this|that|it)(?:'s| is| was) (?:a |an |the |some |a kind of |a sort of )?${W}\\b`, "i"),
    new RegExp(`\\b(?:you are|you're|youre) (?:feeling )?${W}\\b`, "i"),
    new RegExp(`\\b(?:carries|holding|full of|comes from) (?:some |the )?${W}\\b`, "i"),
    new RegExp(`\\bthe ${W} (?:underneath|under it|beneath|is the centre|is the heart|is clear|here is clear)\\b`, "i"),
    new RegExp(`\\b(?:the )?shape of (?:${W}|being |feeling )`, "i"),
    new RegExp(`\\b${W} is (?:the centre|the heart|clear|underneath|what'?s here)\\b`, "i")
  ];
}
var sentences = (reply) => reply.split(/(?<=[.!?])\s+/);
function replyContainsDeclarativeEmotionAssertion(reply, event) {
  const words = emotionWordsFor(event);
  if (!words.length) return false;
  const frames = declarativeFrames(words);
  return sentences(reply).some((s) => !TENTATIVE.test(s) && frames.some((rx) => rx.test(s)));
}
function needsOwnershipRepair(reply, event, isOwned) {
  if (isOwned) return false;
  if (!event.emotion_family && !event.emotion_shade) return false;
  return replyContainsDeclarativeEmotionAssertion(reply, event);
}
function softenUnownedEmotionReply(reply, event) {
  const words = emotionWordsFor(event);
  if (!words.length) return reply;
  const W = `(?:${words.join("|")})`;
  let r = reply;
  r = r.replace(
    new RegExp(`\\b(this|that|it)(?:'s| is| was) ((?:a |an |the |some |a kind of |a sort of )?${W})\\b`, "gi"),
    (_m, subj, rest) => `${subj} might be ${rest}`
  );
  r = r.replace(new RegExp(`\\b(?:you are|you're|youre) (?:feeling )?(${W})\\b`, "gi"), (_m, w) => `you might be feeling ${w}`);
  r = r.replace(new RegExp(`\\bthe (${W}) (underneath|under it|beneath|is the centre|is the heart|is clear)\\b`, "gi"), (_m, w) => `maybe some ${w}`);
  r = r.replace(new RegExp(`\\b(${W}) is (?:the centre|the heart|clear|underneath|what'?s here)\\b`, "gi"), (_m, w) => `there might be ${w} here`);
  return r;
}

// src/services/ai/stage.ts
var RANK = {
  noticed: 0,
  named: 1,
  shaped: 2,
  understood: 3,
  deepened: 4
};
function stageRank(stage) {
  return RANK[stage];
}
function evaluateStage(ev, prev = null) {
  if (!ev.emotion_family) return "noticed";
  const hasShade = !!ev.emotion_shade;
  const anchor = ev.body_cue.length > 0 || ev.behaviour_action.length > 0 || !!ev.trigger_event || !!ev.appraisal_thought;
  if (!hasShade) return anchor ? "shaped" : "named";
  const rejected = (ev.user_rejected_shades ?? []).some(
    (s) => s.toLowerCase() === ev.emotion_shade.toLowerCase()
  );
  const owned = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  const confirmedNow = ev.label_source === "user_confirmed" || ev.user_confirmation === "yes";
  const stable = !!prev && prev.emotion_family === ev.emotion_family && !!prev.emotion_shade && prev.emotion_shade.toLowerCase() === ev.emotion_shade.toLowerCase();
  if (!rejected && owned && anchor && (stable || confirmedNow)) return "understood";
  return anchor ? "shaped" : "named";
}
var AFFIRM_LABEL = /\b(yes|yeah|yep|yup|exactly|totally|definitely|for sure|that'?s it|that'?s right|spot on|pretty much|sounds right|that fits|fits|correct)\b/;
function labelIsUserOwned(fam, userText, history, prev) {
  const named = (text) => {
    const t = ` ${text.toLowerCase()} `;
    return EMOTION_MAPS[fam].familyKeywords.some((w) => t.includes(w));
  };
  if (named(userText)) return true;
  if (history.some((m) => m.role === "user" && named(m.content))) return true;
  if (prev?.emotion_family === fam && AFFIRM_LABEL.test(` ${userText.toLowerCase()} `)) return true;
  return false;
}
var ACCEPT_LABEL = /\b(thats? (it|right|closer|the one|exactly it)|that fits|that does fit|i think (it is|its|thats) (it|right)?|probably (that|it)|yeah thats (it|right)|yes thats (it|right))\b/;
function userConfirmsLabel(userText, prev) {
  if (!prev?.emotion_family) return false;
  const t = ` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `;
  return ACCEPT_LABEL.test(t);
}

// src/utils/text.ts
function stripEmDashes(text) {
  if (!text) return text;
  return text.replace(/\s*[—–―‒]\s*/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ", ").replace(/,\s*([.!?;:])/g, "$1").replace(/,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
}

// src/services/ai/openaiClient.ts
var ENDPOINT = "https://api.openai.com/v1/chat/completions";
function hasUnexpectedScript(reply) {
  return /[ऀ-ॿ؀-ۿ一-鿿぀-ヿ가-힯Ѐ-ӿ]/.test(reply);
}
async function openaiGenerateTurn(input, opts) {
  const prev = input.prevEvent;
  const family = prev?.emotion_family ?? detectFamily(input.userText);
  const mode = routeMode(input.userText, prev ?? null, input.entryHint ?? null);
  const companionReplies = (input.history ?? []).filter((m) => m.role === "companion").map((m) => m.content);
  const variety = varietyDirective(varietySignals(companionReplies));
  const system = buildSystemPrompt({
    family,
    knownEvent: prev,
    memory: input.memory ?? null,
    userName: input.userName ?? null,
    turn: { modeDirective: mode.directive, varietyDirective: variety, safetyNote: input.safetyNote ?? null }
  });
  const history = (input.history ?? []).slice(-8).map((m) => ({ role: m.role === "companion" ? "assistant" : "user", content: m.content }));
  const callOnce = async (extraSystem) => {
    const body = {
      model: opts.model,
      messages: [
        { role: "system", content: extraSystem ? `${system}

${extraSystem}` : system },
        ...history,
        { role: "user", content: input.userText }
      ],
      response_format: { type: "json_schema", json_schema: COMPANION_OUTPUT_SCHEMA },
      // Omit temperature (newer models only allow the default); leave headroom
      // for reasoning tokens under max_completion_tokens.
      max_completion_tokens: 1500
    };
    const endpoint = opts.proxyUrl || ENDPOINT;
    const headers = { "Content-Type": "application/json" };
    if (!opts.proxyUrl && opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI: empty response");
    return JSON.parse(content);
  };
  let p = await callOnce();
  if (hasUnexpectedScript(p.reply) || isDuplicateReply(p.reply, companionReplies)) {
    const reason = hasUnexpectedScript(p.reply) ? "Your previous draft contained corrupted/mixed-script text." : "Your previous draft repeated an earlier reply verbatim.";
    try {
      p = await callOnce(`OUTPUT CORRECTION: ${reason} Compose a fresh reply \u2014 clean English only, and say something genuinely new.`);
    } catch {
    }
    if (hasUnexpectedScript(p.reply)) {
      p.reply = p.reply.replace(/[ऀ-ॿ؀-ۿ一-鿿぀-ヿ가-힯Ѐ-ӿ]+\??/g, "").replace(/\s{2,}/g, " ").trim();
    }
  }
  const ev = prev ? { ...prev } : emptyEvent(input.conversationId);
  ev.timestamp = nowIso();
  let fam = p.emotion_family;
  if (!fam && prev?.emotion_family && (prev.unlock_stage === "understood" || prev.unlock_stage === "deepened")) {
    fam = prev.emotion_family;
  }
  ev.emotion_shade = p.emotion_shade ?? ev.emotion_shade ?? null;
  if (ev.emotion_shade && !fam) {
    fam = prev?.emotion_family ?? null;
    if (!fam) ev.emotion_shade = null;
  }
  ev.emotion_family = fam;
  ev.secondary_emotions = p.secondary_emotions ?? [];
  ev.body_cue = p.body_cue ?? [];
  ev.behaviour_action = p.behaviour_action ?? [];
  ev.trigger_event = p.trigger_event ?? ev.trigger_event ?? null;
  ev.appraisal_thought = p.appraisal_thought ?? ev.appraisal_thought ?? null;
  ev.need_value = p.need_value ?? [];
  ev.valence = p.valence ?? "neutral";
  ev.activation = p.activation ?? "medium";
  if (p.user_words_raw && p.user_words_raw.trim()) ev.user_words_raw = p.user_words_raw.trim();
  const note = p.memory_note ?? ev.memory_note ?? null;
  ev.memory_note = note ? stripEmDashes(note) : null;
  ev.confidence_level = p.confidence ?? "medium";
  ev.evidence_basis = Array.from(/* @__PURE__ */ new Set([...ev.evidence_basis ?? [], "self_report"]));
  ev.label_source = p.label_source ?? "companion_hypothesis";
  ev.mixed_relation = p.mixed_relation ?? null;
  const rejected = new Set([...ev.user_rejected_shades ?? [], ...p.rejected_shades ?? []].map((s) => s.trim()).filter(Boolean));
  ev.user_rejected_shades = [...rejected];
  if (p.user_confirmed_label) ev.user_confirmation = "yes";
  if (fam && (ev.label_source === "user_stated" || ev.label_source === "user_confirmed")) {
    if (!labelIsUserOwned(fam, input.userText, input.history ?? [], prev ?? null)) {
      ev.label_source = "companion_hypothesis";
      if (ev.user_confirmation === "yes") ev.user_confirmation = "partial";
    }
  }
  if (fam && fam === prev?.emotion_family && ev.label_source !== "user_stated" && userConfirmsLabel(input.userText, prev)) {
    ev.label_source = "user_confirmed";
    ev.user_confirmation = "yes";
  }
  ev.strands = sanitizeStrands(p.strands);
  ev.mixed_confirmed = mixedConfirmed(ev, prev ?? null) ? 1 : 0;
  const prevStage = prev?.unlock_stage ?? "noticed";
  const computed = fam ? evaluateStage(ev, prev ?? null) : "noticed";
  let stage = stageRank(computed) >= stageRank(prevStage) ? computed : prevStage;
  if (input.safetyNote && stage === "understood" && prevStage !== "understood" && prevStage !== "deepened") {
    stage = prevStage;
  }
  ev.unlock_stage = stage;
  const understoodNow = stage === "understood";
  const wasUnderstood = prevStage === "understood" || prevStage === "deepened";
  const unlocked = understoodNow && !wasUnderstood;
  ev.emotion_status = fam ? understoodNow ? "confirmed" : "candidate" : "unclear";
  if (understoodNow && ev.user_confirmation === "unknown") ev.user_confirmation = "partial";
  const tone = fam ? EMOTION_MAPS[fam].tone : "calm";
  let reply = p.reply;
  const owned = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  if (needsOwnershipRepair(reply, ev, owned)) {
    try {
      const p2 = await callOnce(
        'OWNERSHIP REPAIR: your draft stated a feeling as fact that this person has not named or accepted yet. Rewrite ONLY the reply so the feeling is offered tentatively, or left unnamed, and stays theirs to confirm. Do not write "this is X", "you are X", "the X underneath", or "the shape of X". Keep it to 1-2 short sentences, at most one gentle question.'
      );
      reply = p2.reply && !needsOwnershipRepair(p2.reply, ev, owned) ? p2.reply : softenUnownedEmotionReply(reply, ev);
    } catch {
      reply = softenUnownedEmotionReply(reply, ev);
    }
  }
  if (unlocked) reply = dropTrailingQuestion(reply);
  return { reply: stripEmDashes(reply), event: ev, unlocked, tone, stage };
}
export {
  openaiGenerateTurn
};
