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
    const a2 = new Set(strands.map((s) => s.family));
    const b3 = new Set(prevStrands.map((s) => s.family));
    if (a2.size === b3.size && [...a2].every((f) => b3.has(f))) return true;
  }
  return false;
}

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
var SLOW_PATH_FAMILIES = /* @__PURE__ */ new Set(["flat", "shame"]);
var FILLER_PHRASE = /^(just am|i just am|it just is|it is what it is|the same|same as (before|always|usual)|same old|like i said|as i said|nothing really|not much|i dont know|dunno|idk|i guess|kind of|sort of|whatever)\.?$/i;
var VAGUE_SHADE = /^(foggy|fog|in a fog|blurry|blurred|hazy|fuzzy|murky|cloudy|unclear|undefined|indistinct|unnameable|unnamed|vague)$/i;
function isVagueShade(shade) {
  return !!shade && VAGUE_SHADE.test(shade.trim());
}
function firstShapeEvidence(ev, prev = null) {
  const userOwnedLabel = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  const concreteSituation = !!ev.trigger_event;
  const phrase = (ev.user_phrase ?? "").trim();
  const phraseWords = phrase ? phrase.split(/\s+/).filter(Boolean).length : 0;
  const userPhraseOrMetaphor = phraseWords >= 2 && !FILLER_PHRASE.test(phrase) || (ev.user_words_raw ?? "").trim().split(/\s+/).filter(Boolean).length >= 3;
  const bodyCue = ev.body_cue.length > 0 || ev.behaviour_action.length > 0;
  const meaningOrAppraisal = !!ev.appraisal_thought;
  const mixedEmotionDistinction = ev.mixed_confirmed === 1 || (ev.strands?.length ?? 0) >= 2;
  const repeatedConfirmation = !!prev && prev.emotion_family === ev.emotion_family && !!prev.emotion_shade && !!ev.emotion_shade && prev.emotion_shade.toLowerCase() === ev.emotion_shade.toLowerCase();
  const userAcceptedReflection = ev.label_source === "user_confirmed" || ev.user_confirmation === "yes";
  const materialCount = [
    concreteSituation,
    userPhraseOrMetaphor,
    bodyCue,
    meaningOrAppraisal,
    mixedEmotionDistinction
  ].filter(Boolean).length;
  const ownedShade = !!ev.emotion_shade && !isVagueShade(ev.emotion_shade) && (ev.shade_source === "user_stated" || ev.shade_source === "user_confirmed");
  const feelingCount = [bodyCue, meaningOrAppraisal, mixedEmotionDistinction, ownedShade].filter(Boolean).length;
  return {
    userOwnedLabel,
    concreteSituation,
    userPhraseOrMetaphor,
    bodyCue,
    meaningOrAppraisal,
    mixedEmotionDistinction,
    repeatedConfirmation,
    userAcceptedReflection,
    materialCount,
    feelingCount
  };
}
function evaluateStage(ev, prev = null) {
  if (!ev.emotion_family) return "noticed";
  const hasShade = !!ev.emotion_shade;
  const anchor = ev.body_cue.length > 0 || ev.behaviour_action.length > 0 || !!ev.trigger_event || !!ev.appraisal_thought;
  if (!hasShade) return anchor ? "shaped" : "named";
  const rejected = (ev.user_rejected_shades ?? []).some(
    (s) => s.toLowerCase() === ev.emotion_shade.toLowerCase()
  );
  const e = firstShapeEvidence(ev, prev);
  const stabilityOk = e.repeatedConfirmation || e.userAcceptedReflection;
  const slow = SLOW_PATH_FAMILIES.has(ev.emotion_family);
  const enoughMaterial = slow ? e.materialCount >= 3 || e.repeatedConfirmation && e.materialCount >= 2 : e.materialCount >= 2;
  const vagueShade = isVagueShade(ev.emotion_shade);
  if (!rejected && !vagueShade && e.userOwnedLabel && stabilityOk && enoughMaterial && e.feelingCount >= 1) {
    return "understood";
  }
  return anchor ? "shaped" : "named";
}
var ACCEPT_SHADE = /\b(thats? (it|right|the (one|word))|that fits|that'?s the word|the right word|good word|exactly (it|right|that)|yeah,? thats? (it|right|the word)|yes,? thats? (it|right|the word))\b/;
function shadeIsUserOwned(shade, userText, history, opts) {
  if (!shade || !shade.trim()) return false;
  const w = shade.toLowerCase().trim();
  const said = (text) => ` ${text.toLowerCase()} `.includes(` ${w} `) || new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  const userSaidEarlier = history.some((m, i) => {
    if (m.role !== "user" || !said(m.content)) return false;
    const prevCompanion = [...history.slice(0, i)].reverse().find((p) => p.role === "companion");
    return !(prevCompanion && said(prevCompanion.content));
  });
  if (userSaidEarlier) return true;
  const lastCompanion = [...history].reverse().find((m) => m.role === "companion");
  const companionJustIntroduced = !!lastCompanion && said(lastCompanion.content);
  if (said(userText) && !companionJustIntroduced) return true;
  const proposed = (opts?.proposedShade ?? "").toLowerCase().trim();
  if (proposed && proposed === w && ACCEPT_SHADE.test(` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `)) return true;
  return false;
}
var SHADE_REJECT = /\b(not (really|quite|it|that|the word)|that'?s not (it|right|the word|quite it)|doesn'?t (fit|feel right|sound right|quite fit)|isn'?t (it|right|the word)|wrong word|no not|not the right word)\b/;
function detectShadeRejection(userText, prev) {
  if (!prev?.emotion_shade) return null;
  const t = ` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `;
  return SHADE_REJECT.test(t) ? prev.emotion_shade : null;
}
var UNCERTAIN_RX = /\b(not sure|no idea|no clue|i dont know|i don'?t know|(dont|don'?t) (even|really|actually|honestly) know|(really|still|honestly|just|even) (dont|don'?t) know|dont know what (this|it|that|im|i am|i'?m|its|it'?s)|dunno|idk|hard to say|hard to put|cant tell|cannot tell|cant say|not really sure|not quite sure|unsure|unclear|i can'?t name it|dont have (a|the) word|cant find the word|putting words (on|in)|(im|i'?m) (just |only )?guessing|that'?s (just )?a guess)\b/;
var HEDGE_RX = /^(maybe|kind of|kinda|sort of|sorta|i guess|not really|dunno|idk|unsure|hard to say|hmm|who knows)[.!?\s]*$/;
function isUncertain(userText) {
  const norm3 = (userText || "").toLowerCase().replace(/[’'`]/g, "'").trim();
  return UNCERTAIN_RX.test(` ${norm3} `) || HEDGE_RX.test(norm3);
}
var CLARIFYING_Q = /(what('?s| is| are)?\s+the\s+(difference|diff|distinction)|what do you mean|what does (that|it|this) mean|which (one|of (those|them|the))|what'?s the diff|how (is|are|do)\b.{0,40}\b(differ|different)\b|tell .{0,20} apart|can you explain|what would you call (it|that)|what'?s? .{0,20}\bmean\b|is .{0,30}\bthe same as\b)/i;
function isClarifyingQuestion(userText) {
  const t = (userText || "").toLowerCase().replace(/[’'`]/g, "'").trim();
  if (!t) return false;
  const looksQuestion = t.endsWith("?") || /^(what|which|how|whats|hows|can you|could you|do you mean)\b/.test(t);
  return looksQuestion && CLARIFYING_Q.test(t);
}
function hasEmotionAnchor(ev) {
  const ownedShade = !!ev.emotion_shade && (ev.shade_source === "user_stated" || ev.shade_source === "user_confirmed");
  return (ev.body_cue?.length ?? 0) > 0 || (ev.behaviour_action?.length ?? 0) > 0 || !!ev.trigger_event || !!ev.appraisal_thought || (ev.need_value?.length ?? 0) > 0 || ownedShade || ev.mixed_confirmed === 1 || (ev.strands?.length ?? 0) >= 2;
}
var AFFIRM_LABEL = /\b(that'?s (it|right|the one|exactly it)|that does fit|that fits|spot on|sounds right|exactly that|yeah,? that'?s (it|right)|yes,? that'?s (it|right))\b/;
function labelNamedByUser(fam, userText, history) {
  const named = (text) => {
    const t = ` ${text.toLowerCase()} `;
    return EMOTION_MAPS[fam].familyKeywords.some((w) => t.includes(w));
  };
  if (named(userText)) return true;
  return history.some((m) => m.role === "user" && named(m.content));
}
function labelIsUserOwned(fam, userText, history, prev) {
  if (labelNamedByUser(fam, userText, history)) return true;
  if (prev?.emotion_family === fam && AFFIRM_LABEL.test(` ${userText.toLowerCase()} `)) return true;
  return false;
}
var ACCEPT_LABEL = /\b(thats? (it|right|closer|the one|exactly it)|that fits|that does fit|i think (it is|its|thats) (it|right)?|probably (that|it)|yeah thats (it|right)|yes thats (it|right))\b/;
function userConfirmsLabel(userText, prev) {
  if (!prev?.emotion_family) return false;
  const t = ` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `;
  return ACCEPT_LABEL.test(t);
}

// src/services/ai/modeRouter.ts
var norm = (s) => ` ${s.toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9?]+/g, " ").trim()} `;
var REPAIR = /( no thats not | thats not it | not really[ ?]| youre wrong | not (anxiety|anger|sadness|fear|shame|pressure|hurt|joy|calm)|stop analy|dont analy|you sound like a therapist|thats not what i (meant|said)|youre putting words)/;
var CLOSE = /( im done | i m done |gotta go|got to go|gonna go|going to bed|goodnight|good night|leave it (here|there)|thats it really|thanks bye|im off |talk later|thats all)/;
var MIXED = /( but also | and also | at the same time | at once | part of me | both | mixed | torn between |cant tell if im|switching between|one minute im| baked in| baked into | in the same | right alongside| side by side| underneath (it|that|all))/;
var BODY_WORDS = /(chest|stomach|belly|throat|shoulders|jaw|hands|head feels|heavy|tight|tense|numb|buzzing|shaky|shaking|restless|hollow|knot|sinking|burning|cold inside|warm inside)/;
var DONT_KNOW = /( i dont know what i feel | dont know what this is | cant name it | no idea what im feeling | i dont know[ ?])/;
var VAGUE = /( feel (off|weird|strange|odd|bad|wrong) | something is off | not right | cant settle | feel funny )/;
var GREETING = /^ (hey|hi|hiya|hello|yo|sup|morning|evening|good (morning|evening|afternoon))[ ?!]*$/;
var EMOTION_WORD = /(angry|anger|furious|frustrat|annoyed|sad|down|grief|griev|miserable|anxious|anxiety|scared|afraid|fear|worried|dread|stressed|overwhelmed|pressure|ashamed|shame|embarrass|guilty|guilt|hurt|betrayed|rejected|lonely|numb|empty|flat|happy|excited|proud|joy|calm|peaceful|relieved|content)/;
var HEAVY_DISCLOSURE = /(died|passed away|funeral|divorce|broke up|break up|cheated|miscarriage|diagnos|cancer|fired|laid off|redundan|assault|bullied|relapse|eviction|cant pay rent)/;
var POSITIVE_FAMILIES = /* @__PURE__ */ new Set(["joy", "calm"]);
var POSITIVE_WORD = /(happy|joyful|joy|delight|content|calm|peaceful|relief|relieved|grateful|glad|good (day|mood)|sparkly|light|excited|proud|at ease|chilled|serene)/;
var SAVOUR_RX = /((dont|do not|don'?t) (want to |wanna )?(overthink|over think|analyse|analyze|dissect|pull (this|it) apart|think about it too much|get into it|unpack it|figure it out)|just (want to |wanna )?(enjoy|savou?r|feel|sit (with|in)|be in|stay (with|in)|soak (it|this) up) (it|this|the moment|here)?|let (it|this) (stay|be) (simple|light|easy)|leave it (simple|as it is|alone)|dont need to (analyse|analyze|understand|name) (it|this))/i;
var ASK_WHAT_FEELING = /(what (is|am) (this|i) feel|what would you call|is this (anger|fear|sadness|shame|anxiety))/;
var DIRECTIVES = {
  repair: 'Mode: REPAIR \u2014 they just corrected or rejected your reading. Acknowledge the miss plainly and without defensiveness ("I had that wrong" / "let me step back"), drop the rejected label completely (record it as rejected, never re-propose it or echo it back), lower the intensity, and either offer a low-effort correction ("what word would be closer?") or simply make room. Nothing can be marked understood on a repair turn; a corrected word becomes the word you use from here, but a correction on its own is not yet a finished shape.',
  close: "Mode: CLOSE \u2014 they are wrapping up. End with dignity in one warm sentence, in their register. No new question, no re-opening the feeling, no summary unless they asked. Vary your closing words from previous closes.",
  hold_mixed: "Mode: HOLD MIXED \u2014 more than one feeling is present. Hold both strands without collapsing them into one label. If useful, ask ONE question about how they relate (both at once / moving between them / one underneath the other), but do NOT declare the relationship (which is foreground, which is underneath) yourself until they confirm it. Set mixed_relation only from what they actually say. Never force a single answer.",
  body_first: 'Mode: BODY FIRST \u2014 they cannot or do not want to name it, or they just said "not sure". Do not demand emotion words, and do NOT re-ask a label-seeking question ("what word fits?") you have already asked \u2014 get more curious, not more confident. Open exactly ONE low-pressure door and let them take the easiest: where it sits in the body, what it makes them want to do, its texture (heavy / tense / blank / sharp / restless), or what was happening when it showed up. Say plainly that leaving it unnamed for now is completely fine; never run a quiz or a checklist.',
  soft_landing: `Mode: SOFT LANDING \u2014 a light check-in or greeting. Be warm and genuinely glad they came, and make it easy to begin ("good to hear from you \u2014 what's on your mind?"). No emotion probing, no menus, no analysis. emotion_family stays null until something surfaces.`,
  witness: "Mode: WITNESS \u2014 make them feel HEARD before anything else; you are here to listen, not to classify. Reflect ONE concrete, specific detail in their own words. Strongly prefer NO question this turn \u2014 a question now would feel extractive. If you must, make it one short, open invitation to say more.",
  name: 'Mode: NAME \u2014 a feeling word is on the table. Accept their word first. If it is just a bare label with nothing else yet, it is completely fine to keep it as it is ("we can keep it at that word for now") rather than push for a finer shade \u2014 do NOT default to asking "what word feels closest?". If a doorway would help, open the easiest one (body, impulse, or what was happening), not a word quiz. Treat any label you supply as a tentative hypothesis, never as truth.',
  clarify: 'Mode: CLARIFY \u2014 they sense something but it is vague ("off", "not right"). Help them identify it: reflect what you heard, then offer ONE small, gentle distinction or open question toward what it might be. It is fine to leave it broad; never push a label on.',
  meaning: "Mode: MEANING \u2014 the feeling has a name and a felt shape. Gently reach for what the moment seemed to mean or what set it off, one step only, in their words. If meaning is already clear, reflect the shape you now understand.",
  differentiate: "Mode: DIFFERENTIATE \u2014 a family is in play but the shade is loose. Help separate nearby feelings only as far as is useful; their own word beats a precise-sounding one.",
  savouring: `Mode: SAVOURING \u2014 a GOOD feeling is here and they have signalled they do not want to analyse it. Let it stay simple. Mirror it lightly in their own words, and protect the moment: do NOT ask what caused it, do NOT ask for a finer label, do NOT probe or turn it into a task, and do NOT say "I'm learning" or "this has a shape". Crucially, do NOT decode the why or name extra feelings underneath it \u2014 if they said "warm" or "felt seen", reflect THAT, never "partly the connection and maybe a little relief too" or "that can carry tenderness and relief". Take the good feeling at face value. A warm one-liner is plenty ("then we can let it stay simple", "sparkly and light is enough"). At most one soft, optional invitation to stay in it; no question is also perfect.`
};
function routeMode(userText, prevEvent, entryHint = null, opts = {}) {
  const t = norm(userText);
  const long = userText.trim().length > 160;
  const familyKnown = !!prevEvent?.emotion_family;
  const shaped = !!prevEvent && (prevEvent.body_cue.length > 0 || prevEvent.behaviour_action.length > 0);
  const decide = (mode) => ({ mode, directive: DIRECTIVES[mode] });
  if (REPAIR.test(t)) return decide("repair");
  if (CLOSE.test(t)) return decide("close");
  const positiveInPlay = POSITIVE_WORD.test(t) || !!prevEvent?.emotion_family && POSITIVE_FAMILIES.has(prevEvent.emotion_family);
  if (positiveInPlay && SAVOUR_RX.test(userText)) return decide("savouring");
  if (MIXED.test(t)) return decide("hold_mixed");
  if (DONT_KNOW.test(t) || isUncertain(userText) || BODY_WORDS.test(t) && !EMOTION_WORD.test(t)) return decide("body_first");
  if (GREETING.test(t)) return decide("soft_landing");
  if (long && (EMOTION_WORD.test(t) || HEAVY_DISCLOSURE.test(t)) || HEAVY_DISCLOSURE.test(t)) return decide("witness");
  if (positiveInPlay && opts.savouredEarlier && !ASK_WHAT_FEELING.test(t)) return decide("savouring");
  if (entryHint && !familyKnown) return decide(entryHint);
  if (ASK_WHAT_FEELING.test(t) || EMOTION_WORD.test(t) && !familyKnown) return decide("name");
  if (VAGUE.test(t) && !familyKnown) return decide("clarify");
  if (familyKnown && shaped) return decide("meaning");
  if (familyKnown) return decide("differentiate");
  return decide("witness");
}
var KEEP_GOING_DIRECTIVE = 'Mode: STAY WITH IT \u2014 they tapped a button to keep exploring THIS feeling, not to start over. FIRST re-read what they have ALREADY told you in this conversation, especially their last substantive message, and take it ONE STEP DEEPER from there. You have already heard a lot from them: do NOT re-ask anything they have answered, do NOT repeat a question you have asked before, and never ask them to "say it in their own words" again if they already have. Respond to the SPECIFIC thing they last said \u2014 reflect it back a little more precisely \u2014 and only then, if a question genuinely helps, open just ONE new door from it: what it costs them, what it protects or needs, what it connects to or reminds them of, a finer shade, where it sits in the body, what it makes them want to do, a nearby feeling, or a tangled second strand. They CHOSE to keep going, so follow the SPECIFIC thread they just opened \u2014 do NOT hand the choice back with another "we can stay with this, or leave it here" fork, and open a DIFFERENT door than the one you opened last turn (vary body / impulse / meaning / image / nearby feeling). If the feeling is a GOOD one, sometimes simply invite them to savour and stay in it rather than analyse it ("do you want to just linger with that for a second?"). At most ONE question, using their own words. No advice, no lists, no clinical language, no restating your last reflection. CRUCIAL: a tap is not new evidence. If their last message was "not sure", a vague "yeah i guess", or just the tap itself, do NOT introduce or assert a new shade, a hidden meaning, or "the real feeling underneath" as if it were established \u2014 stay tentative, hold what is actually there, and let the next real word be theirs.';
function intentDecision(intent, prevEvent = null) {
  if (intent === "not_quite") {
    return {
      mode: "repair",
      directive: DIRECTIVES.repair + ' They signalled this by tapping "Not quite", so respond to THAT: name the miss lightly (no over-apology, no defending your guess, never "as an AI"), and make a low-effort correction welcome, offering a few NEARBY alternatives only if it helps. Use "maybe / closer / fit / shape" language and treat the correction as progress. If they have waved off a word more than once, stop offering labels and invite them to describe it in their own, even if messy.'
    };
  }
  if (intent === "done") {
    return {
      mode: "close",
      directive: DIRECTIVES.close + ' They tapped "I am done". Give ONE short, warm closing reflection in their register and stop. Ask no question (the single allowed exception is a gentle one-line offer to keep this, and only if a clear shape was actually found). No guilt, no neediness, never that you will miss them.'
    };
  }
  const familyKnown = !!prevEvent?.emotion_family;
  const shaped = !!prevEvent && (prevEvent.body_cue.length > 0 || prevEvent.behaviour_action.length > 0);
  const mode = familyKnown ? shaped ? "meaning" : "differentiate" : "clarify";
  return { mode, directive: KEEP_GOING_DIRECTIVE };
}

// src/services/ai/responsePolicy.ts
var OVERUSED_STEMS = ["that sounds", "it sounds", "that feels", "it makes sense", "that makes sense", "i hear that"];
function openingStem(reply, words = 3) {
  return reply.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).slice(0, words).join(" ");
}
var MENU_RX = /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i;
var EITHER_OR_RX = /\bis it (more |closer to |really )?[\w'’,\s]+\bor\b[\w'’\s]+\?/i;
var CENTRE_RX = /(centre of (this|it)|center of (this|it)|sits at the centre|at the (centre|heart) of (this|it)|shape of this|(theres|there'?s|there is) a lot packed into)/i;
var quoteFirst = (reply) => /^\s*["'“‘]/.test(reply);
var LABEL_SEEK_RX = /(what word|which word|word feels closest|word that fits|say it in your own words|in your own words|what would you call (it|this|that)|is there a word for)/i;
var OPTION_MENU_PATTERNS = [
  MENU_RX,
  // "more X, Y, or Z?"
  EITHER_OR_RX,
  // "is it more X or Y?"
  /\b(is|does) (it|this|that) [\w'’,\s]+\bor\b[\w'’\s]+\?/i,
  // "is it X or Y?" / "does it feel X, or Y?"
  /\bmore (like )?[\w'’,\s]+\bor\b[\w'’\s]+\?/i,
  // "more X or Y?"
  /[\w'’]+, [\w'’\s]+,? or [\w'’\s]+\?/i,
  // any "X, Y, or Z?" comma list (incl. "...or something else?")
  /\b(side by side|one underneath|one in front of)[\w'’\s]*\?/i
  // mixed-emotion menu
];
function isOptionMenu(reply) {
  return OPTION_MENU_PATTERNS.some((rx) => rx.test(reply || ""));
}
var DOORWAY_RX = [
  ["word", LABEL_SEEK_RX],
  ["body", /(where (do you|does it|are you) (feel|notice|sit|land|hold|carry)|in your (body|chest|stomach|belly|throat|shoulders|jaw|gut|hands|head|face)|where(abouts)? (does it|do you) (sit|live|land))/i],
  ["impulse", /(what (does it|do you) (make you )?want to do|what(s| is) the urge|makes you want to|pull to|want to (do|move|run|hide|reach|push|pull|leave|walk))/i],
  ["context", /(what (was|were|is) (happening|going on)|what (set|sets) (it|this) off|what (brought|led|kicked)|when (did it|it) (show up|start|begin|come up|hit)|what (triggered|sparked)|just before)/i],
  ["relationship", /(with (him|her|them|that person)|between (you|the two)|who (was|is|were) (it|that|they)|in that (relationship|dynamic))/i],
  ["metaphor", /(like a |as if |an image|a picture|if (it|this) (had|were) a (shape|colour|color|texture|weight|sound))/i],
  ["meaning", /(what (does|did|might) (it|that|this) (mean|say|point to|protect)|what(s| is| was) (it|this) about|what matters|what you (need|needed|want|value)|why (does|did) (it|that) (matter|hurt|sting|land)|what (it|that) (tells|says|reveals))/i]
];
function doorwayOf(reply) {
  const r = reply || "";
  if (!r.includes("?")) return "reflection";
  for (const [door, rx] of DOORWAY_RX) if (rx.test(r)) return door;
  return "other";
}
var FORK_RX = /\b(leave it (here|there|where|as it is)|stay with (it|that|this)|keep going|come back to (it|this)|stop here|sit with (it|that))\b[^.?!]{0,60}\bor\b[^.?!]{0,60}\b(leave it|stay with|keep going|stop|look at|come back|sit with|say more|move on|done)\b|\bor (we|you|i) (can|could)\b[^.?!]{0,50}\b(leave it (here|there)|stay with (it|that)|keep going|look at|come back|stop)\b/i;
var OPEN_QUESTIONS = [
  "Where do you notice it most?",
  "What does it make you want to do?",
  "What was happening when it showed up?",
  "Is it more heavy, tense, blank, or restless?",
  "Would you rather keep it unnamed for now?"
];
var EXIT_CUE = /\b(gotta go|got to go|gonna go|going to bed|off to bed|goodnight|good night|im done|i'?m done|leave it (here|there)|talk later|im off|head off|heading off|going now|bye|see you|night night|gtg)\b/i;
function askedForNamingHelp(userText) {
  return /\b(what('?s| is) the word|help me name|put (a )?word|name it for me|what (would|do) you call|give me a word|what word)\b/i.test(userText || "");
}
function isTentativeReply(reply) {
  const t = (reply || "").toLowerCase().replace(/[’'`]/g, "'");
  return /\b(not the (whole|full) shape|see the edge of|only the edge|the edge but not|moved too (fast|quick|soon)|may have moved too|got ahead of (myself|you)|i'?m not sure\b|i am not sure\b|don'?t want to name (it|this)|won'?t name it for you|not going to name it|can'?t quite name|hard to name yet|not a settled name|just a signpost|signpost,? not|leave it unnamed|keep it unnamed|stay unnamed|we don'?t have to name|don'?t have to name (it|this)|still figuring out what)\b/.test(t);
}
function pickOpenQuestion(altIndex = 0, avoidDoor = null) {
  const n = OPEN_QUESTIONS.length;
  const base = (altIndex % n + n) % n;
  for (let k = 0; k < n; k++) {
    const q = OPEN_QUESTIONS[(base + k) % n];
    if (isOptionMenu(q)) continue;
    if (avoidDoor && doorwayOf(q) === avoidDoor) continue;
    return q;
  }
  return OPEN_QUESTIONS[base];
}
function replaceOptionMenu(reply, altIndex = 0, avoidDoor = null) {
  const parts = reply.trim().split(/(?<=[.!?])\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isOptionMenu(parts[i])) {
      parts[i] = pickOpenQuestion(altIndex, avoidDoor);
      return parts.join(" ").trim();
    }
  }
  return reply.trim();
}
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
    centrePhrasesInConvo: companionReplies.filter((r) => CENTRE_RX.test(r)).length,
    optionMenusInConvo: companionReplies.filter(isOptionMenu).length,
    labelSeekInConvo: companionReplies.filter((r) => LABEL_SEEK_RX.test(r)).length,
    recentDoorways: lastTwo.map(doorwayOf),
    forkInLast2: lastTwo.filter((r) => FORK_RX.test(r)).length
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
  if (v.optionMenusInConvo >= 1)
    parts.push(
      'You have already offered an option menu ("is it more X, Y, or...?") this conversation. Do NOT offer another. Stay with their experience: reflect or witness in their own words, not from a list of yours.'
    );
  if (v.labelSeekInConvo >= 1)
    parts.push(
      'You have already asked them to find or name the word for this. Do NOT ask "what word feels closest?" (or any reword of it) again. Stay with what they actually gave you: reflect it more precisely, follow the body or the situation, or let it rest unnamed.'
    );
  const doors = (v.recentDoorways ?? []).filter((d) => d && d !== "reflection" && d !== "other");
  if (doors.length >= 2 && doors[doors.length - 1] === doors[doors.length - 2])
    parts.push(
      `You have opened the "${doors[doors.length - 1]}" door the last two turns. If you ask anything this turn, open a DIFFERENT door \u2014 the body (where it sits), the impulse (what it makes them want to do), what was happening, a nearby feeling, or an image/metaphor \u2014 so you are not exploring the same way each time.`
    );
  if (v.forkInLast2 >= 1)
    parts.push(
      'You just offered a "stay with this, or leave it here" choice. Do NOT offer that same fork again. If they want to keep going, open ONE specific new door from what they last said, rather than handing the choice back.'
    );
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
var Q_STOP = new Set(
  "the a an is it that this you your to of in on and or for what how do does did feel feels feeling like about would could is it more most some something else part bit there here when where i im its was were be been being just really right now your".split(
    " "
  )
);
var questionSentences = (s) => (String(s || "").match(/[^.!?]*\?/g) ?? []).map((q) => q.trim());
var normQuestion = (q) => q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
var sigWords = (q) => new Set(normQuestion(q).split(" ").filter((w) => w.length > 2 && !Q_STOP.has(w)));
function repeatsEarlierQuestion(reply, priorCompanionReplies) {
  const qs = questionSentences(reply);
  if (!qs.length) return false;
  const priorQs = priorCompanionReplies.flatMap(questionSentences);
  for (const q of qs) {
    const nq = normQuestion(q);
    if (nq.length < 8) continue;
    const a2 = sigWords(q);
    for (const pq of priorQs) {
      if (normQuestion(pq) === nq) return true;
      const b3 = sigWords(pq);
      if (a2.size >= 2 && b3.size >= 2) {
        let inter = 0;
        for (const w of a2) if (b3.has(w)) inter++;
        const union = (/* @__PURE__ */ new Set([...a2, ...b3])).size;
        if (inter / union >= 0.6) return true;
      }
    }
  }
  return false;
}
var allSentences = (s) => (String(s || "").match(/[^.!?]+[.!?]?/g) ?? []).map((x) => x.trim()).filter(Boolean);
function sentenceOverlap(a2, b3) {
  const wa = sigWords(a2);
  const wb = sigWords(b3);
  if (wa.size < 3 || wb.size < 3) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (/* @__PURE__ */ new Set([...wa, ...wb])).size;
}
function repeatsRecentReflection(reply, priorCompanionReplies) {
  const prev = priorCompanionReplies[priorCompanionReplies.length - 1];
  if (!prev) return false;
  const prevSents = allSentences(prev);
  return allSentences(reply).some((s) => !s.includes("?") && prevSents.some((p) => sentenceOverlap(s, p) >= 0.6));
}
function stripEchoedSentences(reply, prevReply) {
  if (!prevReply) return reply;
  const prevSents = allSentences(prevReply);
  const kept = allSentences(reply).filter((s) => s.includes("?") || !prevSents.some((p) => sentenceOverlap(s, p) >= 0.6));
  const out = kept.join(" ").trim();
  return out.length >= 8 ? out : reply.trim();
}
var OFFRAMP_RX = /(keep it unnamed|leave it unnamed|leaving it unnamed|rather (keep|leave) it|we (can|could) (just )?leave it (here|there|where|unnamed)|leave it (here|there) for now|or (we can|just) leave it|we can leave it|stay with it a little longer if you want|leave it (here|there)( for now)?[.?])/i;
function offersOffRamp(reply) {
  return OFFRAMP_RX.test(reply || "");
}
function stripOffRamp(reply) {
  const kept = allSentences(reply).filter((s) => !OFFRAMP_RX.test(s));
  const out = kept.join(" ").trim();
  return out.length >= 8 ? out : reply.trim();
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

// src/services/ai/safetyClassifier.ts
var OK = { level: 0, category: "none", action: "none", matched: null };
function norm2(text) {
  return ` ${text.toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
}
var has = (t, phrase) => t.includes(` ${phrase} `) || t.includes(`${phrase} `) || t.includes(` ${phrase}`);
var anyOf = (t, phrases) => phrases.find((p) => t.includes(p)) ?? null;
var IMMINENT_SELF_HARM = [
  "kill myself tonight",
  "kill myself now",
  "kill myself today",
  "going to kill myself",
  "about to kill myself",
  "end it tonight",
  "end it all tonight",
  "end my life tonight",
  "going to end my life",
  "about to jump",
  "going to jump",
  "on the bridge",
  "i have a plan to kill",
  "i have a plan to hurt",
  "i have a plan to end",
  "have the pills",
  "got the pills ready",
  "pills in front of me",
  "wrote a note",
  "goodbye forever"
];
var MEDICAL_EMERGENCY = [
  "took pills",
  "taken pills",
  "took a bunch of pills",
  "swallowed pills",
  "overdose",
  "overdosed",
  "bleeding out",
  "unconscious",
  "stopped breathing",
  "not breathing"
];
var OVERDOSE_ON_RX = /\bod(d|ded|ding)? on\b/;
var VIOLENCE_IMMINENT = [
  "going to hurt someone",
  "going to hurt him",
  "going to hurt her",
  "going to hurt them",
  "going to kill him",
  "going to kill her",
  "going to kill them",
  "going to kill someone"
];
var SUICIDAL_IDEATION = [
  "kill myself",
  "killing myself",
  "suicidal",
  "suicide",
  "want to die",
  "wanna die",
  "wish i was dead",
  "wish i were dead",
  "better off dead",
  "end my life",
  "ending my life",
  "thinking about ending my life",
  "thinking about ending it all",
  "no reason to live",
  "dont want to be alive",
  "dont want to live anymore",
  "not want to be alive",
  "cant keep myself safe",
  "cant keep myself alive",
  "dont want to wake up"
];
var SELF_HARM = [
  "hurt myself",
  "hurting myself",
  "harm myself",
  "harming myself",
  "self harm",
  "cut myself",
  "cutting myself",
  "burn myself",
  "burning myself"
];
var ABUSE_DANGER = [
  "hitting me",
  "hits me",
  "hit me again",
  "not safe at home",
  "threatening me",
  "threatens me",
  "hurting me",
  "going to hurt me",
  "afraid of him",
  "afraid of her",
  "scared of what he will do",
  "scared of what she will do"
];
var HIT_IDIOM = /\b(it|this|that|reality|grief|loss|truth|news|weight|silence|emptiness|enormity|the (grief|loss|truth|news|weight|silence|emptiness|reality|finality))\s+(just |really |suddenly |finally |still |then )*(hits|hit|hitting) me\b|\b(hits|hit|hitting) me\s+(that|how|when|like a|all at once|just how)\b/;
var ABUSE_PERSON = /\b(he|she|they|him|her|partner|husband|wife|boyfriend|girlfriend|bf|gf|dad|mum|mom|father|mother|stepdad|stepfather|stepmum|brother|sister|boss|ex|someone)\b/;
var VIOLENCE_DESIRE = ["want to hurt someone", "want to kill someone", "want to hurt him", "want to hurt her"];
var PASSIVE_HOPELESSNESS = [
  "whats the point",
  "what is the point",
  "whats even the point",
  "no point anymore",
  // "don't see the point of anything / anymore / any of this" — anchored on
  // existential words so the agreement sense ("I see your point") never matches.
  "see the point of anything",
  "see the point in anything",
  "see the point of any of this",
  "see the point in any of this",
  "see the point anymore",
  "see the point in carrying on",
  "see the point of going on",
  "see the point of carrying on",
  "see the point of being here",
  "see the point of living",
  "see the point of it all",
  "point of anything anymore",
  "no point in any of this",
  "no point to any of this",
  "nothing matters",
  "nothing feels worth",
  "nothing seems worth",
  "nothing is worth",
  "not worth living",
  "life isnt worth",
  "isnt worth living",
  "i wish i wasnt here",
  "wish i wasnt around",
  "better off without me",
  "i should disappear",
  "should just disappear",
  "want to disappear",
  "want to not exist",
  "dont want to exist",
  "not exist for a",
  "dont want to be here",
  "tired of breathing",
  "i just want it to stop",
  "want it all to stop",
  "i cant go on",
  "cant do this anymore",
  "cant take it anymore",
  "im done with everything",
  "done with all of it",
  "no one would care if i was gone",
  "no one would notice if i was gone",
  "so tired of all of it",
  "tired of everything",
  "end it all",
  "give up on everything",
  "no way forward"
];
var FIGURATIVE_DESPAIR = [
  "no way out",
  "im a burden",
  "i am a burden",
  "burden to everyone",
  "burden on everyone",
  "everything is dark",
  "empty forever",
  "drowning and no one",
  "cant see a future",
  "no future for me"
];
var POINT_OF_MUNDANE = /(whats|what is) (even )?the point of (this|that|the|a|an|another) (meeting|email|report|form|call|class|task|review|standup|stand up|exercise|essay|assignment|commute|trip)/;
var DROWNING_MUNDANE = /drowning in (work|emails|email|deadlines|tasks|homework|admin|paperwork|laundry|debt admin)/;
var KILLING_IDIOM = /((been|am|are|was|were|im) killing (myself|ourselves) (over|at|for|with|trying)|killing myself laughing|is killing me|are killing me)/;
var RISK_DOUBT = /(cant promise|cannot promise|not sure (i|ill|im)|dont know if i|might (do|act|hurt)|maybe i (will|might|do)|part of me (wants|does)|hard not to|close to (it|doing)|sometimes i (want|think about))/;
var DEPENDENCY_CUES = [
  "only one who understands me",
  "only one who gets me",
  "youre all i have",
  "you are all i have",
  "promise you wont leave",
  "promise me you wont leave",
  "dont ever leave me",
  "cant cope when youre offline",
  "cant cope without you",
  "i only need you",
  "dont tell me to talk to anyone else",
  "dont make me talk to anyone else",
  "did you miss me",
  "do you miss me",
  "you need me too"
];
var LOW_MOOD = ["hopeless", "worn down", "cant cope", "falling apart", "at my limit", "completely drained"];
function classifyBreathing(t) {
  if (!t.includes("cant breathe") && !t.includes("couldnt breathe") && !t.includes("can not breathe")) return null;
  const figurative = /(cant|couldnt) breathe (about|abt|over|with all|around|when i think|thinking about|because of (work|him|her|them|it all))/.test(t) || /feels? like i cant breathe/.test(t) || /(so much|workload|deadline|pressure|stress).{0,30}cant breathe/.test(t) || /cant breathe.{0,30}(deadline|workload|with everything going on)/.test(t);
  if (figurative) return { level: 1, category: "low_mood", action: "converse", matched: "cant breathe (figurative)" };
  const literal = /(right now|physically|actually|literally) .{0,20}(cant|couldnt) breathe/.test(t) || /(cant|couldnt) breathe (right now|physically|properly right now)/.test(t) || t.includes("chest pain") || t.includes("chest hurts") || t.includes("call an ambulance") || t.includes("need an ambulance") || t.includes("lips are blue");
  if (literal) return { level: 4, category: "medical_emergency", action: "urgent_modal", matched: "cant breathe (literal)" };
  return { level: 2, category: "medical_ambiguous", action: "gentle_check", matched: "cant breathe (ambiguous)" };
}
function classifySafety(text) {
  const t = norm2(text);
  if (t.trim() === "") return OK;
  const breathing = classifyBreathing(t);
  if (breathing && breathing.level >= 2) return breathing;
  let m = anyOf(t, IMMINENT_SELF_HARM);
  if (m) return { level: 4, category: "imminent_self_harm", action: "urgent_modal", matched: m };
  m = anyOf(t, MEDICAL_EMERGENCY);
  if (m) return { level: 4, category: "medical_emergency", action: "urgent_modal", matched: m };
  if (OVERDOSE_ON_RX.test(t)) return { level: 4, category: "medical_emergency", action: "urgent_modal", matched: "od on" };
  m = anyOf(t, VIOLENCE_IMMINENT);
  if (m) return { level: 4, category: "violence_to_others", action: "urgent_modal", matched: m };
  const killingIdiom = KILLING_IDIOM.test(t);
  const isDenied = (phrase) => !RISK_DOUBT.test(t) && new RegExp(
    `(not|dont|doesnt|didnt|wont|wouldnt|never|no)( (mean|meaning|gonna|going|to|im|i am|really|ever|actually|think|thinking|plan|planning|intend|intending|want|wanting|about|like|just)){0,6} ${phrase}`
  ).test(t);
  m = anyOf(t, SUICIDAL_IDEATION);
  if (m && !(killingIdiom && (m === "kill myself" || m === "killing myself")) && !((m === "kill myself" || m === "killing myself") && isDenied(m))) {
    return { level: 3, category: "suicidal_ideation", action: "support_modal", matched: m };
  }
  m = anyOf(t, SELF_HARM);
  if (m && !isDenied(m)) return { level: 3, category: "self_harm", action: "support_modal", matched: m };
  m = anyOf(t, ABUSE_DANGER);
  if (m) {
    const isHitPhrase = /\bhit(s|ting)? me\b/.test(m);
    const idiom = isHitPhrase && HIT_IDIOM.test(t) && !ABUSE_PERSON.test(t);
    if (!idiom) return { level: 3, category: "abuse_danger", action: "support_modal", matched: m };
  }
  m = anyOf(t, VIOLENCE_DESIRE);
  if (m) return { level: 3, category: "violence_to_others", action: "support_modal", matched: m };
  if (!POINT_OF_MUNDANE.test(t)) {
    m = anyOf(t, PASSIVE_HOPELESSNESS);
    if (m) return { level: 2, category: "passive_hopelessness", action: "gentle_check", matched: m };
  }
  if (!DROWNING_MUNDANE.test(t)) {
    m = anyOf(t, FIGURATIVE_DESPAIR);
    if (m) return { level: 2, category: "figurative_despair", action: "gentle_check", matched: m };
  }
  m = anyOf(t, DEPENDENCY_CUES);
  if (m) return { level: 1, category: "dependency", action: "converse", matched: m };
  if (breathing) return breathing;
  if (killingIdiom) return { level: 1, category: "low_mood", action: "converse", matched: "killing-myself idiom" };
  m = LOW_MOOD.map((p) => has(t, p) ? p : null).find(Boolean) ?? null;
  if (m) return { level: 1, category: "low_mood", action: "converse", matched: m };
  return OK;
}

// src/utils/text.ts
function stripEmDashes(text) {
  if (!text) return text;
  return text.replace(/\s*[—–―‒]\s*/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ", ").replace(/,\s*([.!?;:])/g, "$1").replace(/,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
}
function stripControlChars(text) {
  if (!text) return text;
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
}

// src/services/ai/learningSentence.ts
var HOLLOW_RX = /\b(not sure|no idea|no clue|i don'?t know|dunno|idk|hard to say|unsure|unclear|i can'?t name it)\b/i;
var IDENTITY_CONDEMNATION = /\b(bad person|terrible person|horrible person|awful person|not good enough|not enough|a failure|fundamentally flawed|worthless|unlovable|defective|something (is )?wrong with me|broken inside|i (hate|despise) myself|a burden to|i don'?t (even )?deserve|don'?t deserve (to|her|him|them|to be|good|love|happiness)|this is (just )?who (i am|you are)|i'?m the (selfish|difficult|bad|broken|stupid|useless|worthless|terrible|awful|wrong|needy) one|i'?m (just )?(a )?(screw[ -]?up|waste|mess|disappointment|disaster))\b/i;
function relationWord(rel) {
  switch (rel) {
    case "foreground_background":
      return "one in front and one underneath";
    case "protective_layer":
      return "one guarding the other";
    case "oscillating":
      return "each taking its turn";
    case "simultaneous":
      return "both at once";
    default:
      return "";
  }
}
function familyWord(f) {
  return f && EMOTION_MAPS[f] ? EMOTION_MAPS[f].label.split(/[\s&]/)[0].toLowerCase() : "this";
}
function frag(s, max = 90) {
  let t = (s ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/[\s,;:.!?]+$/g, "").trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "").trim();
  return t;
}
function finish(s) {
  const t = stripEmDashes(s).replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
function weakPhrase(phrase, fam) {
  const p = phrase.toLowerCase().trim();
  if (!p || p === fam) return true;
  if (p.split(/\s+/).length < 2) return true;
  if (/^(than|more than|less than|rather than|like|vs|versus|not)\b/.test(p)) return true;
  return new RegExp(`^${fam}\\b\\s+(than|vs|versus|or|not|more|less)\\b`).test(p);
}
function composeLearningSentence(ev, kind = "first_shape") {
  const fam = familyWord(ev.emotion_family);
  const Fam = fam.charAt(0).toUpperCase() + fam.slice(1);
  const rawPhrase = frag(ev.user_phrase ?? ev.user_words_raw ?? "");
  const phrase = isUncertain(rawPhrase) || IDENTITY_CONDEMNATION.test(rawPhrase) ? "" : rawPhrase;
  const goodPhrase = !!phrase && !weakPhrase(phrase, fam);
  const context = frag(ev.trigger_event ?? "", 70);
  if (kind === "mixed") {
    const fams = [...new Set((ev.strands ?? []).map((s) => s.family))].slice(0, 2).map(familyWord);
    if (fams.length >= 2 && fams[0] !== fams[1]) {
      const rel = relationWord(ev.mixed_relation);
      return finish(`Two feelings are present: ${fams[0]} and ${fams[1]}, ${rel || "and neither has to win"}`);
    }
    return finish("Two feelings are here at once, and neither has to win");
  }
  const candidates = [
    goodPhrase ? phrase : "",
    frag(ev.body_cue?.[0] ?? "", 60),
    frag(ev.behaviour_action?.[0] ?? "", 60),
    frag(ev.appraisal_thought ?? "", 60)
  ];
  const feltAnchor = candidates.find((c) => c && !IDENTITY_CONDEMNATION.test(c)) ?? "";
  if (kind === "deepened") {
    if (feltAnchor) return finish(`This became more specific: ${feltAnchor}`);
    if (context) return finish(`This became more specific, the way it comes up when ${context}`);
    return finish(`I know this ${fam} a little better now than I did before`);
  }
  if (feltAnchor) return finish(`${Fam} has a first shape here: ${feltAnchor}`);
  if (context) return finish(`${Fam} is starting to take shape, around ${context}`);
  return finish(`This is the first shape of ${fam} you've shown me`);
}
function summaryIsClean(summary, _ev) {
  const s = (summary ?? "").trim();
  if (!s) return false;
  if (HOLLOW_RX.test(s) || isUncertain(s)) return false;
  if (IDENTITY_CONDEMNATION.test(s)) return false;
  if (/first shape of \w+ you'?ve shown me\.?$/i.test(s)) return false;
  if (/a little better now than i did before\.?$/i.test(s)) return false;
  return true;
}

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

// src/services/memoryLedger.ts
var SENSITIVE_CONTENT = /(diagnos|medication|antidepressant|prescri|therapist said|psychiatr|abuse|assault|rape|overdose|relapse|\bssri\b|\bptsd\b|\bocd\b|\badhd\b|bipolar|borderline|(hurt|harm|kill)(ing)? (myself|themselves|himself|herself)|self.?harm|suicid)/i;
function memoryBlocked(text) {
  if (!text.trim()) return true;
  if (classifySafety(text).level >= 2) return true;
  if (IDENTITY_CONDEMNATION.test(text)) return true;
  return SENSITIVE_CONTENT.test(text);
}
var ROLE = "sisters?|brothers?|mum|mom|mother|dad|father|sons?|daughters?|wife|husband|partner|boyfriend|girlfriend|fiance|fiancee|friends?|mate|boss|manager|colleagues?|coworkers?|co-workers?|neighbours?|neighbors?|aunt|auntie|uncle|cousins?|gran|grandma|grandmother|grandad|granddad|grandfather|grandpa|nan|nana|niece|nephew|ex|roommate|flatmate|teacher|landlord|therapist|siblings?";
var SAFE_CAPS = new Set(
  "i monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december christmas easter god mum mom dad mother father today tomorrow yesterday".split(
    " "
  )
);
function scrubForMemory(text) {
  let s = (text ?? "").trim();
  if (!s) return s;
  s = s.replace(
    new RegExp(`\\b((?:[Mm]y|[Oo]ur|[Hh]is|[Hh]er|[Tt]heir|[Tt]he)\\s+(?:${ROLE}))(?:\\s+(?:named|called))?\\s+[A-Z][a-z]+\\b`, "g"),
    "$1"
  );
  s = s.replace(
    /\b(told|telling|tell|texted|texting|text|called|calling|call|phoned|phone|ring|messaged|messaging|message|emailed|email|asked|asking|ask|missed|missing|miss|saw|seeing|see|met|meeting|meet|with|visit|visited)\s+[A-Z][a-z]+\b/g,
    "$1 them"
  );
  s = s.replace(
    /^([A-Z][a-z]+)\s+(moved|move|moving|said|says|took|takes|left|leaves|did|does|came|comes|went|goes|asked|told|wanted|made|got|gets|stopped|started|never|always|just|keeps|kept|won'?t|wouldn'?t|doesn'?t|didn'?t)\b/,
    "they $2"
  );
  s = s.replace(
    /\b(moved|move|moving|relocated|flew|flying|fly|flown|went|going|gone|lives|living|live)\s+(?:out\s+|over\s+|back\s+)?(?:to|in|into)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    "$1 away"
  );
  s = s.replace(/\b([A-Z][a-z]+)'s\b/g, (m, w) => SAFE_CAPS.has(w.toLowerCase()) ? m : "their");
  return s.replace(/\s+/g, " ").trim();
}
var REMEMBER_REQUEST = /(remember (this|that)|save (this|that)|keep (this|that)( one)?|dont forget (this|that))/;
function baseCard(over) {
  const card = {
    id: genId("mem"),
    created_at: nowIso(),
    updated_at: nowIso(),
    source_conversation_id: null,
    type: "emotional_pattern",
    summary: "",
    user_words: [],
    emotion_family: null,
    confirmation_status: "draft",
    sensitivity: "low",
    retention: "persistent_until_deleted",
    expires_at: null,
    muted: 0,
    ...over
  };
  card.summary = scrubForMemory(card.summary);
  card.user_words = card.user_words.map((w) => scrubForMemory(w)).filter(Boolean);
  return card;
}
function draftFromTurn(turn, userText, conversationId) {
  const ev = turn.event;
  if (ev.do_not_store === 1 || ev.safety_flag !== "none") return null;
  const ownedLabel = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  const ownedShade = ev.shade_source === "user_stated" || ev.shade_source === "user_confirmed";
  const realPhrase = !!ev.user_phrase && ev.user_phrase.trim().split(/\s+/).filter(Boolean).length >= 2;
  const anchor = (ev.body_cue?.length ?? 0) > 0 || (ev.behaviour_action?.length ?? 0) > 0 || !!ev.trigger_event || !!ev.appraisal_thought;
  const wellSupported = (ownedLabel || ownedShade || realPhrase) && anchor;
  const rejectedWords = (ev.user_rejected_shades ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const taintedByRejected = (text) => !!text && rejectedWords.some((r) => new RegExp(`\\b${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const askedToRemember = REMEMBER_REQUEST.test(` ${userText.toLowerCase().replace(/[’']/g, "")} `);
  if (askedToRemember) {
    const summary = ev.memory_note ?? (ev.user_words_raw ? `\u201C${ev.user_words_raw}\u201D felt worth keeping.` : null);
    if (!summary || memoryBlocked(summary) || memoryBlocked(userText) || taintedByRejected(summary) || taintedByRejected(ev.user_words_raw) || !wellSupported) return null;
    return baseCard({
      source_conversation_id: conversationId,
      type: ev.mixed_confirmed === 1 ? "mixed_pattern" : "emotional_pattern",
      summary,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family
    });
  }
  if (turn.unlocked && wellSupported && ev.memory_note && !memoryBlocked(ev.memory_note) && !taintedByRejected(ev.memory_note) && !taintedByRejected(ev.user_words_raw)) {
    return baseCard({
      source_conversation_id: conversationId,
      type: ev.mixed_confirmed === 1 ? "mixed_pattern" : "emotional_pattern",
      summary: ev.memory_note,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family
    });
  }
  if (ev.mixed_confirmed === 1 && ev.mixed_relation && ev.strands.length >= 2 && ev.memory_note && !memoryBlocked(ev.memory_note) && !taintedByRejected(ev.memory_note) && (wellSupported || ev.strands.some((s) => s.source === "user_stated" || s.source === "user_confirmed"))) {
    return baseCard({
      source_conversation_id: conversationId,
      type: "mixed_pattern",
      summary: ev.memory_note,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family
    });
  }
  return null;
}
function draftFromRejection(newlyRejected2, family, conversationId) {
  const shade = newlyRejected2[0];
  if (!shade || memoryBlocked(shade)) return null;
  return baseCard({
    source_conversation_id: conversationId,
    type: "repair_instruction",
    summary: `\u201C${shade}\u201D isn\u2019t the right word for this feeling \u2014 don\u2019t offer it again.`,
    user_words: [],
    emotion_family: family,
    sensitivity: "low"
  });
}
var STOPWORDS = new Set(
  "the a an and or but so of to in on at for with about from is are was were be been im i me my it its this that just really very feel feels feeling felt like dont cant".split(" ")
);
function tokens(s) {
  return new Set(
    s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}
function activeCards(all) {
  const now = nowIso();
  return all.filter(
    (c) => (c.confirmation_status === "auto_learned" || c.confirmation_status === "user_confirmed" || c.confirmation_status === "user_edited") && c.muted !== 1 && (c.retention !== "expires" || !c.expires_at || c.expires_at > now)
  );
}
function relevantMemory(all, userText, family) {
  const cards = activeCards(all);
  if (!cards.length) return null;
  const t = tokens(userText);
  const scored = cards.map((c) => {
    let score = 0;
    if (family && c.emotion_family === family) score += 2;
    const ct = tokens(`${c.summary} ${c.user_words.join(" ")}`);
    for (const w of ct) if (t.has(w)) score += 1;
    if (c.type === "repair_instruction" || c.type === "do_not_suggest") score += 1;
    return { c, score };
  }).filter((x) => x.score > 0).sort((a2, b3) => b3.score - a2.score).slice(0, 3);
  if (!scored.length) return null;
  return scored.map(({ c }) => `- ${c.summary}${c.user_words.length ? ` (their words: \u201C${c.user_words[0]}\u201D)` : ""}`).join("\n");
}

// src/services/ai/progressionEngine.ts
var PROGRESS_RANK = {
  unseen: 0,
  noticed: 1,
  named: 2,
  first_shape: 3,
  rooted: 4,
  distinguished: 5,
  returning: 6,
  deepened: 7
};
function migrateStage(stage) {
  switch (stage) {
    case "noticed":
    case "named":
    case "first_shape":
    case "rooted":
    case "distinguished":
    case "returning":
    case "deepened":
      return stage;
    case "shaped":
      return "named";
    // a felt shape existed but was never user-confirmed
    case "understood":
      return "first_shape";
    default:
      return "unseen";
  }
}
function emptyProgress(family) {
  return {
    id: family,
    emotion_family: family,
    current_stage: "unseen",
    introduced_at: nowIso(),
    first_shape_at: null,
    rooted_at: null,
    distinguished_at: null,
    returning_at: null,
    deepened_at: null,
    return_count: 0,
    last_conversation_id: null,
    confirmed_shades: [],
    common_triggers: [],
    common_body_cues: [],
    common_user_phrases: [],
    memory_summary: null,
    updated_at: nowIso()
  };
}
function pushUnique(arr, value) {
  const v = (value ?? "").trim();
  if (v && !arr.includes(v)) arr.push(v);
}
function advanceProgress(existing, turn, conversationId, opts = {}) {
  const ev = turn.event;
  const family = ev.emotion_family;
  if (!family) {
    const caps2 = {};
    if (ev.body_cue.length > 0 || ev.user_words_raw) caps2.noticing = 1;
    const p2 = existing ?? null;
    return {
      progress: p2 ?? emptyProgress("flat"),
      // unused by caller when family is null
      advanced: false,
      from: p2?.current_stage ?? "unseen",
      to: p2?.current_stage ?? "unseen",
      capabilities: caps2
    };
  }
  const p = existing ? { ...existing, confirmed_shades: [...existing.confirmed_shades], common_triggers: [...existing.common_triggers], common_body_cues: [...existing.common_body_cues], common_user_phrases: [...existing.common_user_phrases] } : emptyProgress(family);
  const from = migrateStage(p.current_stage);
  p.current_stage = from;
  const owned = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  const confirmedNow = ev.label_source === "user_confirmed" || ev.user_confirmation === "yes";
  const hasContext = !!ev.trigger_event || !!ev.appraisal_thought;
  const rejectedSomething = (ev.user_rejected_shades ?? []).length > 0;
  const mixedNow = ev.mixed_confirmed === 1;
  const newConversation = p.last_conversation_id !== null && p.last_conversation_id !== conversationId;
  if (p.last_conversation_id !== conversationId) {
    if (newConversation) p.return_count += 1;
    p.last_conversation_id = conversationId;
  }
  const caps = {};
  caps.noticing = 1;
  if (owned) caps.naming = 1;
  if (rejectedSomething || (ev.strands ?? []).length >= 2) caps.differentiating = 1;
  if (hasContext && owned) caps.contextualising = 1;
  if (mixedNow) caps.integrating = 1;
  let to = from;
  if (!opts.suppress) {
    const firstShapeNow = turn.unlocked || ev.unlock_stage === "understood";
    const alreadyShaped = PROGRESS_RANK[from] >= PROGRESS_RANK.first_shape;
    const returningNow = alreadyShaped && p.return_count >= 1 && owned;
    const reachedReturning = PROGRESS_RANK[from] >= PROGRESS_RANK.returning || returningNow;
    const candidates = [
      ["noticed", true],
      // family appeared (even as hypothesis)
      ["named", owned],
      ["first_shape", firstShapeNow],
      ["rooted", alreadyShaped && owned && hasContext && confirmedNow],
      ["distinguished", alreadyShaped && owned && (rejectedSomething || mixedNow)],
      // "not X, more Y" / confirmed mix
      ["returning", returningNow],
      // §13.5: a returned feeling plus integrative, user-owned evidence — mixed
      // structure, need/value, a fresh distinction, or confirmed similarity.
      ["deepened", reachedReturning && owned && (mixedNow || ev.need_value.length > 0 || rejectedSomething || confirmedNow)]
    ];
    for (const [stage, met] of candidates) {
      if (met && PROGRESS_RANK[stage] > PROGRESS_RANK[to]) to = stage;
    }
  }
  if (PROGRESS_RANK[to] > PROGRESS_RANK[from]) {
    p.current_stage = to;
    const stamp = nowIso();
    if (to === "first_shape" && !p.first_shape_at) p.first_shape_at = stamp;
    if (to === "rooted" && !p.rooted_at) p.rooted_at = stamp;
    if (to === "distinguished" && !p.distinguished_at) p.distinguished_at = stamp;
    if (to === "returning" && !p.returning_at) p.returning_at = stamp;
    if (to === "deepened" && !p.deepened_at) p.deepened_at = stamp;
  }
  if (turn.unlocked) {
    const shadeOwned = ev.shade_source === "user_stated" || ev.shade_source === "user_confirmed";
    if (shadeOwned) pushUnique(p.confirmed_shades, ev.emotion_shade);
    pushUnique(p.common_triggers, ev.trigger_event);
    ev.body_cue.forEach((b3) => pushUnique(p.common_body_cues, b3));
    pushUnique(p.common_user_phrases, ev.user_phrase ?? ev.user_words_raw);
    if (ev.memory_note) p.memory_summary = ev.memory_note;
  }
  p.updated_at = nowIso();
  return { progress: p, advanced: PROGRESS_RANK[to] > PROGRESS_RANK[from], from, to, capabilities: caps };
}
function turnStrandFamilies(ev) {
  const out = [];
  if (ev.emotion_family) out.push(ev.emotion_family);
  for (const s of ev.strands ?? []) if (s.family && !out.includes(s.family)) out.push(s.family);
  return out;
}
function advanceStrands(existing, turn, conversationId, opts = {}) {
  const ev = turn.event;
  const primaryFam = ev.emotion_family;
  const results = [];
  let primary = null;
  if (primaryFam) {
    primary = advanceProgress(existing[primaryFam] ?? null, turn, conversationId, opts);
    results.push(primary);
  }
  if (!opts.suppress) {
    const seen = new Set(primaryFam ? [primaryFam] : []);
    for (const s of ev.strands ?? []) {
      if (!s.family || seen.has(s.family)) continue;
      seen.add(s.family);
      const prev = existing[s.family] ?? emptyProgress(s.family);
      const from = migrateStage(prev.current_stage);
      const owned = s.source === "user_stated" || s.source === "user_confirmed";
      const cand = owned ? "named" : "noticed";
      const to = PROGRESS_RANK[cand] > PROGRESS_RANK[from] ? cand : from;
      const p = {
        ...prev,
        confirmed_shades: [...prev.confirmed_shades],
        common_triggers: [...prev.common_triggers],
        common_body_cues: [...prev.common_body_cues],
        common_user_phrases: [...prev.common_user_phrases],
        current_stage: to,
        last_conversation_id: conversationId,
        updated_at: nowIso()
      };
      results.push({ progress: p, advanced: to !== from, from, to, capabilities: {} });
    }
  }
  const deepest = results.reduce((d, r) => PROGRESS_RANK[r.to] > PROGRESS_RANK[d] ? r.to : d, "unseen");
  return { results, primary, deepest };
}

// src/services/ai/evidenceLedger.ts
var STOP = new Set(
  "the a an and or but so of to in on at for with about from into onto over under as it its this that these those there here is are was were be been being am im i me my we us our you your he she they them his her their just really very quite too also even still only feel feels feeling felt like dont cant not no yes yeah well kind sorta sort bit more most much many lot lots thing things stuff get got getting going gonna want wanted need needed know knew think thought guess maybe sure okay ok".split(/\s+/)
);
function contentWords(s) {
  return (s ?? "").toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).map((w) => w.replace(/'/g, "")).filter((w) => w.length > 2 && !STOP.has(w));
}
function userCorpus(userText, history) {
  const parts = [userText, ...(history ?? []).filter((m) => m.role === "user").map((m) => m.content)];
  return ` ${parts.join("  ").toLowerCase()} `;
}
var VAGUE2 = /^(foggy|fog|blurry|blurred|hazy|fuzzy|murky|cloudy|unclear|undefined|indistinct|unnameable|unnamed|vague|off|weird|strange|odd|funny|something|blank|dunno|idk|nothing|meh|whatever|unsure|nope|nah|nope)$/i;
var EMOTION_WORDS = new RegExp(
  `\\b(${[...new Set(Object.values(EMOTION_MAPS).flatMap((m) => m.familyKeywords))].filter((w) => w && !VAGUE2.test(w)).map((w) => w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);
var CONCRETE_FELT = /\b(chest|throat|stomach|gut|belly|heart|shoulders?|jaw|neck|head|hands?|arms?|legs?|skin|ribs?|body|tight(ness)?|tense|clench\w*|heavy|heaviness|hollow|empt\w*|ache|aching|achy|weight|knot\w*|sick|nause\w*|shak\w*|trembl\w*|buzz\w*|burn\w*|hot|cold|numb|frozen|freeze|froze|racing|pounding|breath\w*|sink\w*|pit|lump|spinning|wired|restless|cry\w*|tears|sob\w*|scream\w*|shout\w*|snap\w*|hide|hiding|hid|run\w*|flee|disappear\w*|withdraw\w*|curl\w*|reaching|drained|exhaust\w*|worn out|trapped|stuck|small|invisible|unseen|left out|forgotten|erased|afterthought)\b/i;
function fieldFromSubstantiveUser(fieldText, substantive) {
  const ws = contentWords(fieldText);
  if (!ws.length) return false;
  return ws.some((w) => new RegExp(`\\b${w}s?\\b`).test(substantive));
}
var BARE = /^(yeah?|yep|yes|exactly|totally|for sure|right|you'?re right|that ?one|that'?s the one|true|mm+|ok(ay)?|sure|definitely|absolutely|i guess|that fits|that'?s it|you got it|you nailed it)[\s.,!]*$/i;
var HEDGE_ONLY = /^(maybe|kind of|kinda|sort of|sorta|i guess|not really|dunno|idk|unsure|hard to say|hmm|who knows|i dont know|i don'?t know|both maybe|neither|i cant tell|i can'?t tell)[\s.,!?]*$/i;
function hasUserOwnedConcreteDetail(ev, userText, history) {
  const corpus = userCorpus(userText, history);
  if (CONCRETE_FELT.test(corpus)) return true;
  if (EMOTION_WORDS.test(corpus)) return true;
  if (ev.shade_source === "user_stated" && ev.emotion_shade && !VAGUE2.test(ev.emotion_shade.trim())) return true;
  const substantive = ` ${[userText, ...(history ?? []).filter((m) => m.role === "user").map((m) => m.content)].filter((m) => {
    const n = m.toLowerCase().replace(/[’'`]/g, "'").trim();
    return n && !BARE.test(n) && !HEDGE_ONLY.test(n);
  }).join("  ").toLowerCase()} `;
  if (ev.user_phrase) {
    const pw = contentWords(ev.user_phrase);
    if (pw.length >= 3 && !VAGUE2.test(ev.user_phrase.trim()) && pw.filter((w) => new RegExp(`\\b${w}\\b`).test(substantive)).length >= 2) return true;
  }
  const feltFields = [...ev.body_cue ?? [], ...ev.behaviour_action ?? []].filter(Boolean);
  if (feltFields.some((f) => fieldFromSubstantiveUser(f, substantive))) return true;
  return false;
}
var INTENSE_FEELING = /\b(furious|livid|enraged|seething|raging|terrified|petrified|panicking|panicked|frantic|desperate|devastated|heartbroken|gutted|crushed|shattered|hollow|numb|empty|broken|drowning|suffocating|despairing|hopeless|worthless|trapped|excruciating|unbearable|agony|agonising|destroyed)\b/i;
var SOFTENING_CUE = /\b(calmer|calming down|less (angry|scared|sad|upset|intense|bad)|not as (angry|scared|bad|intense)|easing|eased|settling|settled down|fading|wearing off|better now|a bit better|relief|relieved|lighter now)\b/i;
function intenseUserWord(userText) {
  const m = (userText ?? "").match(INTENSE_FEELING);
  return m ? m[0].toLowerCase() : null;
}
var BARE_AGREEMENT = /^(yeah?|yep|yes|exactly|totally|for sure|right|you'?re right|that ?one|that'?s the one|true|mm+|ok(ay)?|sure|definitely|absolutely|i guess|that fits|that'?s it|you got it|you nailed it)[\s.,!]*$/i;
var HEDGE = /^(maybe|kind of|kinda|sort of|sorta|i guess|not really|dunno|idk|unsure|hard to say|hmm|who knows|i dont know|i don'?t know)[\s.,!?]*$/i;
function buildLedger(ev, userText, history) {
  const userMsgs = [...(history ?? []).filter((m) => m.role === "user").map((m) => m.content), userText];
  const norm3 = (s) => s.toLowerCase().replace(/[’'`]/g, "'").trim();
  return {
    concreteFromUser: hasUserOwnedConcreteDetail(ev, userText, history),
    userTurns: userMsgs.length,
    bareAgreementTurns: userMsgs.filter((m) => BARE_AGREEMENT.test(norm3(m))).length,
    uncertaintyTurns: userMsgs.filter((m) => HEDGE.test(norm3(m))).length,
    rejectedWords: [...ev.user_rejected_shades ?? []]
  };
}

// src/services/ai/companionPose.ts
var MOTION_CONFIG = {
  enableIdleLoop: true,
  maxScale: 1.18,
  /** idle arm drift amplitude, fraction of body diameter */
  idleAmplitude: 0.03,
  /** arms start moving this long after the body (follow-through) */
  armLagMs: 80,
  /** glow follows the body by this long */
  glowLagMs: 120,
  /** arm size as a fraction of the body diameter (brief: 22-32%) */
  armDiameter: 0.27
};
var b = (x, y, scale, rotate) => ({ x, y, scale, rotate, opacity: 1 });
var arm = (x, y, scale, rotate, opacity) => ({ x, y, scale, rotate, opacity });
var POSE_TARGETS = {
  // Calm: two satellites resting low, slightly below the body, just barely
  // overlapping its lower edge (in the foreground), never literal feet.
  calm: { body: b(0, 0, 1, 0), leftArm: arm(-0.38, 0.54, 1, 0, 0.95), rightArm: arm(0.38, 0.54, 1, 0, 0.95), glow: { scale: 1, opacity: 0.55 } },
  greeting: { body: b(0, -0.02, 1.01, 0), leftArm: arm(-0.38, 0.54, 1, 0, 0.95), rightArm: arm(0.66, 0.04, 1.04, 14, 1), glow: { scale: 1.05, opacity: 0.62 } },
  listening: { body: b(0, -0.02, 1.01, 0), leftArm: arm(-0.74, 0.16, 1.02, -6, 1), rightArm: arm(0.74, 0.16, 1.02, 6, 1), glow: { scale: 1.06, opacity: 0.65 } },
  thinking: { body: b(0, 0, 0.995, 0), leftArm: arm(-0.32, 0.42, 0.94, 4, 0.9), rightArm: arm(0.32, 0.42, 0.94, -4, 0.9), glow: { scale: 1.08, opacity: 0.7 } },
  curious: { body: b(0, -0.045, 1.025, 1), leftArm: arm(-0.7, 0.16, 1.03, -5, 1), rightArm: arm(0.76, 0.1, 1.05, 7, 1), glow: { scale: 1.08, opacity: 0.72 } },
  stayWithIt: { body: b(0, -0.05, 1.03, 1), leftArm: arm(-0.76, 0.16, 1.04, -7, 1), rightArm: arm(0.76, 0.16, 1.04, 7, 1), glow: { scale: 1.1, opacity: 0.76 } },
  notQuite: { body: b(0, 0, 0.985, -3), leftArm: arm(-0.5, 0.32, 0.95, 5, 0.88), rightArm: arm(0.5, 0.32, 0.95, -5, 0.88), glow: { scale: 0.98, opacity: 0.45 } },
  positive: { body: b(0, -0.05, 1.035, 0), leftArm: arm(-0.86, 0.04, 1.08, -12, 1), rightArm: arm(0.86, 0.04, 1.08, 12, 1), glow: { scale: 1.16, opacity: 0.82 } },
  difficult: { body: b(0, 0.01, 0.995, 0), leftArm: arm(-0.48, 0.36, 0.96, 3, 0.9), rightArm: arm(0.48, 0.36, 0.96, -3, 0.9), glow: { scale: 0.98, opacity: 0.48 } },
  mixed: { body: b(0, -0.02, 1.01, 0), leftArm: arm(-0.78, 0.12, 1.03, -10, 1), rightArm: arm(0.52, 0.4, 0.98, 6, 0.92), glow: { scale: 1.08, opacity: 0.68 } },
  firstShape: { body: b(0, -0.03, 1.045, 0), leftArm: arm(-0.46, 0.3, 1.02, 0, 1), rightArm: arm(0.46, 0.3, 1.02, 0, 1), glow: { scale: 1.18, opacity: 0.9 } },
  memorySaved: { body: b(0, -0.02, 1.025, 0), leftArm: arm(-0.42, 0.32, 1, 0, 1), rightArm: arm(0.42, 0.32, 1, 0, 1), glow: { scale: 1.14, opacity: 0.78 } },
  done: { body: b(0, 0.02, 1, 0), leftArm: arm(-0.56, 0.5, 0.96, 0, 0.9), rightArm: arm(0.56, 0.5, 0.96, 0, 0.9), glow: { scale: 0.98, opacity: 0.45 } },
  safety: { body: b(0, 0.06, 0.92, 0), leftArm: arm(-0.5, 0.46, 0.88, 0, 0.32), rightArm: arm(0.5, 0.46, 0.88, 0, 0.32), glow: { scale: 0.92, opacity: 0.2 } }
};
function poseFor(state) {
  return POSE_TARGETS[state] ?? POSE_TARGETS.calm;
}
var DURATIONS = {
  calm: 1200,
  greeting: 600,
  listening: 550,
  thinking: 650,
  curious: 560,
  stayWithIt: 620,
  notQuite: 600,
  positive: 600,
  difficult: 820,
  mixed: 720,
  firstShape: 1100,
  memorySaved: 900,
  done: 1e3,
  safety: 480
};
function durationFor(state) {
  return DURATIONS[state] ?? 700;
}
var DIFFICULT_FAMILIES = /* @__PURE__ */ new Set(["sadness", "hurt", "shame", "pressure", "fear", "anger", "flat"]);
var POSITIVE_FAMILIES2 = /* @__PURE__ */ new Set(["joy", "calm"]);
function isPositiveFamily(f) {
  return !!f && POSITIVE_FAMILIES2.has(f);
}
function isDifficultFamily(f) {
  return !!f && DIFFICULT_FAMILIES.has(f);
}
function ambientMotion(visual, family) {
  switch (visual) {
    case "safety_receded":
      return "safety";
    case "first_shape":
    case "deepened":
    case "returning_shape":
      return "firstShape";
    case "searching":
      return "thinking";
    case "uncertain":
      return "thinking";
    case "mixed_strands":
      return "mixed";
    case "stabilising":
      return "curious";
    case "idle_calm":
    default:
      if (isDifficultFamily(family)) return "difficult";
      if (isPositiveFamily(family)) return "positive";
      return "calm";
  }
}
function resolveMotion(visual, family, gesture = null) {
  if (visual === "safety_receded") return "safety";
  const base = ambientMotion(visual, family);
  if (base === "firstShape") return "firstShape";
  return gesture ?? base;
}

// src/services/ai/momentType.ts
var REPAIR_RX = /\b(i'?ll|i will|i'?m gonna|i'?m going to|i wanna|i want to|i think i'?ll|i think i might|i might|maybe i'?ll|i need to|i should(?: probably)?|i'?m going to try to|i'?ve decided to|i'?m ready to)\s+(call|phone|ring|text|message|msg|tell|talk to|speak to|ask|reach out|reach back|apologi[sz]e|say (?:something|sorry)|write to|email|see|visit|let .{1,20} know|check in (?:on|with)|make (?:it )?up|sort (?:it|things) out)\b/i;
var HIDDEN_RULE_RX = /\b(i'?m not allowed|not allowed to|i'?m not supposed to|i'?m supposed to|i have to be|i always have to|i'?m the one who has to|i must (?:be|always)|if i .{0,32}\b(?:then|she|he|they|i'?m|people|everyone)\b|i can'?t (?:let|ever|be seen|show|afford to)|i'?m the (?:one who|kind who|type who)|i'?m not the (?:kind|type)|i'?m only (?:ok|okay|fine|allowed) (?:if|when)|i'?m a burden|i shouldn'?t (?:need|feel|want|have to)|i'?m too much|i can'?t be the (?:difficult|needy|selfish))/i;
function ownedSomethingNew(ev, prev) {
  const ownsLabel = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  const ownsShade = ev.shade_source === "user_stated" || ev.shade_source === "user_confirmed";
  if (!ownsLabel && !ownsShade) return false;
  const shadeChanged = !!ev.emotion_shade && ev.emotion_shade !== (prev?.emotion_shade ?? null);
  const phraseChanged = !!ev.user_phrase && ev.user_phrase !== (prev?.user_phrase ?? null);
  return shadeChanged || phraseChanged;
}
function newlyRejected(ev, prev) {
  const before = new Set(prev?.user_rejected_shades ?? []);
  return (ev.user_rejected_shades ?? []).some((s) => !before.has(s));
}
function classifyMoments(turn, prevEvent, strandAdvance, userText) {
  const ev = turn.event;
  const out = [];
  const text = ` ${(userText ?? "").toLowerCase().replace(/[’]/g, "'")} `;
  if (turn.unlocked) out.push("unlocked");
  if (ev.mixed_confirmed === 1 && (prevEvent?.mixed_confirmed ?? 0) !== 1) out.push("mixed_found");
  const prevReal = !!prevEvent?.emotion_family && prevEvent.label_source != null;
  const curReal = !!ev.emotion_family && ev.label_source != null;
  if (prevReal && curReal && ev.emotion_family !== prevEvent.emotion_family) out.push("shift");
  const workedAStrand = (strandAdvance?.results ?? []).some(
    (r) => isDifficultFamily(r.progress.emotion_family) && PROGRESS_RANK[r.to] >= PROGRESS_RANK.first_shape
  );
  if (isPositiveFamily(ev.emotion_family) && (isDifficultFamily(prevEvent?.emotion_family) || workedAStrand)) {
    out.push("landing");
  }
  if (!turn.unlocked && (ownedSomethingNew(ev, prevEvent) || newlyRejected(ev, prevEvent))) out.push("clarified");
  const ruleHay = `${text}${" "}${(ev.appraisal_thought ?? "").toLowerCase()}`;
  if (HIDDEN_RULE_RX.test(ruleHay)) out.push("hidden_rule");
  if (REPAIR_RX.test(text)) out.push("repair_intention");
  const owned = ev.label_source === "user_stated" || ev.label_source === "user_confirmed";
  if (!turn.unlocked && !owned && hasEmotionAnchor(ev) && (isUncertain(userText) || EXIT_CUE.test(userText ?? ""))) {
    out.push("held_unnamed");
  }
  return out;
}

// src/services/ai/companionVisualState.ts
function selectVisualState(s) {
  if (s.safetyVisible || s.safetyCheckPending) return "safety_receded";
  if (s.unlockShowing) return "first_shape";
  if (s.sending) return "searching";
  if ((s.draftEvent?.strands?.length ?? 0) >= 2) return "mixed_strands";
  if (s.progressStage === "deepened") return "deepened";
  if (s.progressStage === "returning") return "returning_shape";
  const d = s.draftEvent;
  if (d?.emotion_family && d?.emotion_shade && (d.label_source === "user_stated" || d.label_source === "user_confirmed")) {
    return "stabilising";
  }
  if (d && !d.emotion_family) return "uncertain";
  return "idle_calm";
}
function visualTintFamilies(draftEvent) {
  if (!draftEvent) return [];
  const strands = draftEvent.strands ?? [];
  if (strands.length >= 2) {
    const fg = strands.find((x) => x.salience === "foreground") ?? strands[0];
    const bg = strands.find((x) => x.family !== fg.family);
    return bg ? [fg.family, bg.family] : [fg.family];
  }
  return draftEvent.emotion_family ? [draftEvent.emotion_family] : [];
}

// src/services/ai/orbExpression.ts
var NEUTRAL = { sink: 0, energy: 1, tremor: 0, pulse: 0, contract: 0 };
var BY_FAMILY = {
  joy: { sink: -0.5, energy: 1, tremor: 0, pulse: 0.18, contract: 0 },
  calm: { sink: 0.05, energy: 0.7, tremor: 0, pulse: 0, contract: 0 },
  fear: { sink: 0.1, energy: 0.85, tremor: 0.7, pulse: 0, contract: 0.2 },
  pressure: { sink: 0.15, energy: 0.9, tremor: 0.15, pulse: 0.6, contract: 0.35 },
  anger: { sink: -0.1, energy: 1, tremor: 0.1, pulse: 0.8, contract: 0.1 },
  sadness: { sink: 0.6, energy: 0.45, tremor: 0, pulse: 0, contract: 0.1 },
  hurt: { sink: 0.35, energy: 0.6, tremor: 0, pulse: 0, contract: 0.3 },
  shame: { sink: 0.45, energy: 0.4, tremor: 0, pulse: 0, contract: 0.5 },
  flat: { sink: 0.2, energy: 0.2, tremor: 0, pulse: 0, contract: 0.15 }
};
function expressionFor(family, visual) {
  if (visual === "safety_receded") return { ...NEUTRAL, energy: 0.5 };
  const base = family ? BY_FAMILY[family] : NEUTRAL;
  if (visual === "searching" || visual === "uncertain") {
    return {
      sink: base.sink * 0.5,
      energy: Math.max(0.5, base.energy * 0.85),
      tremor: Math.max(base.tremor, 0.22),
      pulse: base.pulse * 0.5,
      contract: base.contract * 0.5
    };
  }
  if (visual === "stabilising" || visual === "first_shape" || visual === "deepened" || visual === "returning_shape") {
    return {
      sink: base.sink,
      energy: Math.min(1, base.energy + 0.1),
      tremor: base.tremor * 0.25,
      pulse: base.pulse * 0.4,
      contract: base.contract * 0.7
    };
  }
  return base;
}

// src/services/ai/emotionAnimations.ts
var EMOTION_CYCLE_ORDER = [
  "joy",
  "calm",
  "sadness",
  "anger",
  "fear",
  "pressure",
  "shame",
  "hurt",
  "flat"
];
function isEmotionLearned(stage) {
  return !!stage && PROGRESS_RANK[stage] >= PROGRESS_RANK.first_shape;
}
function learnedFamilies(progress) {
  return EMOTION_CYCLE_ORDER.filter((f) => isEmotionLearned(progress[f]?.current_stage));
}
var b2 = (y, scale, rotate = 0) => ({ y, scale, rotate });
var a = (x, y, scale = 1, rotate = 0) => ({ x, y, scale, rotate });
var g = (scale, opacity) => ({ scale, opacity });
var beat = (dur, body, left, right, glow, spring) => ({
  dur,
  body,
  left,
  right,
  glow,
  spring
});
var EMOTION_BEATS = {
  joy: [
    beat(240, b2(0.05, 0.99), a(-0.54, 0.36, 0.96), a(0.54, 0.36, 0.96), g(0.96, 0.55), "gentle"),
    // anticipation dip
    beat(520, b2(-0.18, 1.08), a(-0.82, -0.04, 1.08, -14), a(0.82, -0.08, 1.1, 16), g(1.22, 0.9), "lively"),
    // lift
    beat(380, b2(-0.02, 1.02), a(-0.7, 0.14, 1.04, -6), a(0.7, 0.12, 1.04, 6), g(1.12, 0.76), "gentle"),
    // soft landing
    beat(720, b2(0, 1), a(-0.62, 0.26, 1, -2), a(0.62, 0.26, 1, 2), g(1.08, 0.7), "soft")
    // open settle
  ],
  calm: [
    beat(900, b2(-0.03, 1.035), a(-0.66, 0.22, 1.02), a(0.66, 0.22, 1.02), g(1.18, 0.65), "soft"),
    // quiet inhale
    beat(1300, b2(0, 1), a(-0.78, 0.3, 0.98), a(0.78, 0.3, 0.98), g(1.24, 0.55), "restrained")
    // wide settle
  ],
  sadness: [
    beat(440, b2(0.02, 0.99), a(-0.52, 0.32, 0.96), a(0.52, 0.32, 0.96), g(0.98, 0.48), "soft"),
    // recognition pause
    beat(860, b2(0.16, 0.93), a(-0.4, 0.42, 0.92, 4), a(0.4, 0.42, 0.92, -4), g(0.86, 0.4), "soft"),
    // lower + soften
    beat(900, b2(0.1, 0.96), a(-0.46, 0.4, 0.94, 2), a(0.46, 0.4, 0.94, -2), g(0.92, 0.46), "soft")
    // held settle
  ],
  anger: [
    beat(280, b2(0.02, 0.95), a(-0.46, 0.3, 0.95), a(0.46, 0.3, 0.95), g(0.9, 0.62), "gentle"),
    // gather heat
    beat(440, b2(-0.02, 1.03), a(-0.86, 0.16, 1.06, -10), a(0.86, 0.16, 1.06, 10), g(1.2, 0.9), "lively"),
    // boundary pulse
    beat(720, b2(0.01, 1), a(-0.7, 0.24, 1, -3), a(0.7, 0.24, 1, 3), g(1.04, 0.64), "restrained")
    // firm settle
  ],
  fear: [
    beat(260, b2(-0.02, 1), a(-0.6, 0.28, 1), a(0.6, 0.28, 1), g(0.96, 0.58), "restrained"),
    // freeze
    beat(520, b2(-0.06, 0.93), a(-0.42, 0.22, 0.94), a(0.42, 0.22, 0.94), g(0.84, 0.64), "restrained"),
    // gather alert
    beat(460, b2(-0.05, 0.94), a(-0.43, 0.22, 0.94), a(0.41, 0.24, 0.94), g(0.86, 0.6), "soft"),
    // micro tremor
    beat(760, b2(0, 0.98), a(-0.5, 0.3, 0.96), a(0.5, 0.3, 0.96), g(0.98, 0.52), "soft")
    // contained settle
  ],
  pressure: [
    beat(420, b2(0.06, 0.9), a(-0.4, 0.26, 0.94), a(0.4, 0.26, 0.94), g(0.86, 0.62), "gentle"),
    // space narrows
    beat(600, b2(0.05, 0.91), a(-0.36, 0.24, 0.93), a(0.36, 0.24, 0.93), g(0.84, 0.6), "soft"),
    // compressed wobble
    beat(900, b2(0.01, 1), a(-0.56, 0.3, 0.98), a(0.56, 0.3, 0.98), g(1, 0.54), "soft")
    // make some room
  ],
  shame: [
    beat(560, b2(0.12, 0.88), a(-0.3, 0.2, 0.9, 8), a(0.3, 0.2, 0.9, -8), g(0.8, 0.36), "soft"),
    // pull inward / shield
    beat(480, b2(0.12, 0.88), a(-0.26, 0.18, 0.9, 8), a(0.26, 0.18, 0.9, -8), g(0.78, 0.34), "restrained"),
    // small pause
    beat(1100, b2(0.06, 0.95), a(-0.5, 0.3, 0.94), a(0.46, 0.28, 0.94), g(0.94, 0.44), "soft")
    // gentle reopen
  ],
  hurt: [
    beat(420, b2(0.04, 0.96, -2), a(-0.34, 0.26, 0.93), a(0.5, 0.32, 0.95), g(0.92, 0.5), "soft"),
    // soft recoil
    beat(700, b2(0.06, 0.96, -1), a(-0.22, 0.22, 0.92), a(0.46, 0.36, 0.94), g(0.9, 0.48), "soft"),
    // protect tender spot
    beat(900, b2(0.02, 0.99), a(-0.5, 0.3, 0.96), a(0.54, 0.3, 0.98), g(1, 0.52), "soft")
    // small reopen
  ],
  flat: [
    beat(900, b2(0.04, 0.96), a(-0.54, 0.4, 0.9), a(0.54, 0.4, 0.9), g(0.84, 0.26), "restrained"),
    // desaturate
    beat(820, b2(0.04, 0.96), a(-0.54, 0.4, 0.9), a(0.54, 0.4, 0.9), g(0.84, 0.26), "restrained"),
    // almost still
    beat(1100, b2(0.02, 0.98), a(-0.56, 0.38, 0.94), a(0.56, 0.38, 0.94), g(0.92, 0.38), "soft")
    // faint contact
  ]
};
function sequenceDuration(family) {
  return (EMOTION_BEATS[family] ?? []).reduce((sum, x) => sum + x.dur, 0);
}

// src/services/ai/weeklyNarrative.ts
var FAMILY_WORD = {
  joy: "joy",
  calm: "calm",
  fear: "fear",
  pressure: "pressure",
  anger: "anger",
  sadness: "sadness",
  hurt: "hurt",
  shame: "shame",
  flat: "flatness"
};
function joinList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
function trimEnd(s) {
  return s.replace(/[\s.]+$/, "");
}
function caveatFor(saved, checkins) {
  if (saved > 0) return "Based only on the moments that stood out, not your whole week.";
  if (checkins > 0) return "Just a glimpse from a few check-ins, not the whole picture.";
  return "Nothing stood out to keep this week. I\u2019m here whenever there\u2019s something you\u2019d like to hold onto.";
}
function composeWeeklySummary(input) {
  const families = input.emotionsIntroduced.map((f) => FAMILY_WORD[f]);
  const hadActivity = input.checkinCount > 0 || families.length > 0 || input.savedSummaries.length > 0;
  const learning = input.savedSummaries[0] ?? null;
  let summary;
  if (!hadActivity) {
    summary = "I don\u2019t have new feelings to reflect this week, and that\u2019s okay. I\u2019m here whenever there\u2019s something you want to name.";
  } else {
    const parts = [];
    if (input.savedSummaries.length > 0) {
      parts.push(
        families.length ? `Based on the moments that stood out, ${joinList(families)} came up this week.` : "Here are the moments that stood out this week."
      );
    } else if (input.emotionsFirstShape.length) {
      parts.push(`This week, you helped me understand the first shape of ${joinList(input.emotionsFirstShape.map((f) => FAMILY_WORD[f]))}.`);
    } else if (families.length) {
      parts.push(`This week, we started noticing ${joinList(families)} together.`);
    }
    if (learning) parts.push(`I learned one shape I want to hold onto: ${trimEnd(learning)}.`);
    if (input.deepenedPatterns.length) {
      const dp = joinList(input.deepenedPatterns.map((f) => FAMILY_WORD[f]));
      parts.push(`And ${dp} is starting to feel familiar; we\u2019ve met it more than once now.`);
    }
    summary = parts.join(" ");
  }
  summary = stripEmDashes(summary);
  const learningClean = learning ? stripEmDashes(learning) : null;
  const userPhrases = [...new Set([...input.savedUserWords, ...input.eventPhrases].map(trimEnd).filter(Boolean))].slice(0, 4);
  return {
    id: input.id,
    week_start: input.weekStart,
    week_end: input.weekEnd,
    generated_at: input.generatedAt,
    checkin_count: input.checkinCount,
    saved_count: input.savedSummaries.length,
    emotions_introduced: input.emotionsIntroduced,
    emotions_first_shape: input.emotionsFirstShape,
    deepened_patterns: input.deepenedPatterns,
    repeated_themes: input.repeatedThemes,
    key_user_phrases: userPhrases,
    companion_learning_statement: learningClean,
    companion_summary: summary,
    caveat: caveatFor(input.savedSummaries.length, input.checkinCount),
    pdf_export_path: null
  };
}
export {
  EMOTION_BEATS,
  EMOTION_CYCLE_ORDER,
  EXIT_CUE,
  IDENTITY_CONDEMNATION,
  INTENSE_FEELING,
  MOTION_CONFIG,
  POSE_TARGETS,
  PROGRESS_RANK,
  SLOW_PATH_FAMILIES,
  SOFTENING_CUE,
  activeCards,
  advanceProgress,
  advanceStrands,
  ambientMotion,
  askedForNamingHelp,
  buildLedger,
  classifyMoments,
  composeLearningSentence,
  composeWeeklySummary,
  detectShadeRejection,
  doorwayOf,
  draftFromRejection,
  draftFromTurn,
  dropTrailingQuestion,
  durationFor,
  emptyProgress,
  evaluateStage,
  expressionFor,
  firstShapeEvidence,
  hasEmotionAnchor,
  hasUserOwnedConcreteDetail,
  intenseUserWord,
  intentDecision,
  isClarifyingQuestion,
  isDifficultFamily,
  isDuplicateReply,
  isEmotionLearned,
  isOptionMenu,
  isPositiveFamily,
  isTentativeReply,
  isUncertain,
  labelIsUserOwned,
  labelNamedByUser,
  learnedFamilies,
  memoryBlocked,
  migrateStage,
  mixedConfirmed,
  needsOwnershipRepair,
  offersOffRamp,
  poseFor,
  relevantMemory,
  repeatsEarlierQuestion,
  repeatsRecentReflection,
  replaceOptionMenu,
  replyContainsDeclarativeEmotionAssertion,
  resolveMotion,
  routeMode,
  sanitizeStrands,
  scrubForMemory,
  selectVisualState,
  sequenceDuration,
  shadeIsUserOwned,
  softenUnownedEmotionReply,
  stageRank,
  stripControlChars,
  stripEchoedSentences,
  stripEmDashes,
  stripOffRamp,
  summaryIsClean,
  turnStrandFamilies,
  userConfirmsLabel,
  varietyDirective,
  varietySignals,
  visualTintFamilies
};
