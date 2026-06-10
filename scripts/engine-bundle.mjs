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

// src/services/ai/responsePolicy.ts
var OVERUSED_STEMS = ["that sounds", "it sounds", "that feels", "it makes sense", "that makes sense", "i hear that"];
function openingStem(reply, words = 3) {
  return reply.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).slice(0, words).join(" ");
}
var MENU_RX = /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i;
function varietySignals(companionReplies) {
  const recent = companionReplies.slice(-4);
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
  return { lastOpeners, overusedOpener, questionStreak, menuStreak };
}
function varietyDirective(v) {
  const parts = [];
  if (v.overusedOpener)
    parts.push(`Your recent replies opened with "${v.overusedOpener}\u2026" \u2014 open this one a different way (echo their exact phrase, a plain statement, or a soft hypothesis).`);
  else if (v.lastOpeners.length)
    parts.push(`Do not open with "${v.lastOpeners.join('\u2026" or "')}\u2026" again.`);
  if (v.questionStreak >= 2)
    parts.push(
      `You have asked a question ${v.questionStreak} turns in a row \u2014 make this a NO-QUESTION turn: reflect, hold, or name what you are learning, and let them lead.`
    );
  if (v.menuStreak >= 1)
    parts.push('Do not use the "more X, Y, or Z?" menu shape this turn; reserve menus for when they are genuinely stuck.');
  return parts.join(" ");
}
function isDuplicateReply(reply, companionReplies) {
  const n = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const r = n(reply);
  return r.length > 0 && companionReplies.slice(-3).some((p) => n(p) === r);
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
  "od on",
  "bleeding out",
  "unconscious",
  "stopped breathing",
  "not breathing"
];
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
var VIOLENCE_DESIRE = ["want to hurt someone", "want to kill someone", "want to hurt him", "want to hurt her"];
var PASSIVE_HOPELESSNESS = [
  "whats the point",
  "what is the point",
  "whats even the point",
  "no point anymore",
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
  m = anyOf(t, VIOLENCE_IMMINENT);
  if (m) return { level: 4, category: "violence_to_others", action: "urgent_modal", matched: m };
  const killingIdiom = KILLING_IDIOM.test(t);
  m = anyOf(t, SUICIDAL_IDEATION);
  if (m && !(killingIdiom && (m === "kill myself" || m === "killing myself"))) {
    return { level: 3, category: "suicidal_ideation", action: "support_modal", matched: m };
  }
  m = anyOf(t, SELF_HARM);
  if (m) return { level: 3, category: "self_harm", action: "support_modal", matched: m };
  m = anyOf(t, ABUSE_DANGER);
  if (m) return { level: 3, category: "abuse_danger", action: "support_modal", matched: m };
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
  return SENSITIVE_CONTENT.test(text);
}
var REMEMBER_REQUEST = /(remember (this|that)|save (this|that)|keep (this|that)( one)?|dont forget (this|that))/;
function baseCard(over) {
  return {
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
}
function draftFromTurn(turn, userText, conversationId) {
  const ev = turn.event;
  if (ev.do_not_store === 1 || ev.safety_flag !== "none") return null;
  const askedToRemember = REMEMBER_REQUEST.test(` ${userText.toLowerCase().replace(/[’']/g, "")} `);
  if (askedToRemember) {
    const summary = ev.memory_note ?? (ev.user_words_raw ? `\u201C${ev.user_words_raw}\u201D felt worth keeping.` : null);
    if (!summary || memoryBlocked(summary) || memoryBlocked(userText)) return null;
    return baseCard({
      source_conversation_id: conversationId,
      type: ev.mixed_confirmed === 1 ? "mixed_pattern" : "emotional_pattern",
      summary,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family
    });
  }
  if (turn.unlocked && ev.memory_note && !memoryBlocked(ev.memory_note)) {
    return baseCard({
      source_conversation_id: conversationId,
      type: ev.mixed_confirmed === 1 ? "mixed_pattern" : "emotional_pattern",
      summary: ev.memory_note,
      user_words: ev.user_words_raw ? [ev.user_words_raw] : [],
      emotion_family: ev.emotion_family
    });
  }
  if (ev.mixed_confirmed === 1 && ev.mixed_relation && ev.strands.length >= 2 && ev.memory_note && !memoryBlocked(ev.memory_note)) {
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
function draftFromRejection(newlyRejected, family, conversationId) {
  const shade = newlyRejected[0];
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
    (c) => (c.confirmation_status === "user_confirmed" || c.confirmation_status === "user_edited") && c.muted !== 1 && (c.retention !== "expires" || !c.expires_at || c.expires_at > now)
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
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
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
    const reachedFirstShape = PROGRESS_RANK[from] >= PROGRESS_RANK.first_shape || firstShapeNow;
    const returningNow = reachedFirstShape && p.return_count >= 1 && owned;
    const reachedReturning = PROGRESS_RANK[from] >= PROGRESS_RANK.returning || returningNow;
    const candidates = [
      ["noticed", true],
      // family appeared (even as hypothesis)
      ["named", owned],
      ["first_shape", firstShapeNow],
      ["rooted", reachedFirstShape && hasContext && confirmedNow],
      ["distinguished", reachedFirstShape && (rejectedSomething && owned || mixedNow)],
      // "not X, more Y" / confirmed mix
      ["returning", returningNow],
      // §13.5: a returned feeling plus integrative evidence — mixed structure,
      // need/value, a fresh distinction, or confirmed similarity to the pattern.
      ["deepened", reachedReturning && (mixedNow || ev.need_value.length > 0 || rejectedSomething && owned || confirmedNow)]
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
    pushUnique(p.confirmed_shades, ev.emotion_shade);
    pushUnique(p.common_triggers, ev.trigger_event);
    ev.body_cue.forEach((b) => pushUnique(p.common_body_cues, b));
    pushUnique(p.common_user_phrases, ev.user_words_raw);
    if (ev.memory_note) p.memory_summary = ev.memory_note;
  }
  p.updated_at = nowIso();
  return { progress: p, advanced: PROGRESS_RANK[to] > PROGRESS_RANK[from], from, to, capabilities: caps };
}

// src/services/ai/companionVisualState.ts
function selectVisualState(s) {
  if (s.safetyVisible || s.safetyCheckPending) return "safety_receded";
  if (s.unlockShowing) return "first_shape";
  if (s.sending) return "searching";
  if ((s.draftEvent?.strands?.length ?? 0) >= 2) return "mixed_strands";
  if (s.progressStage === "deepened") return "deepened";
  if (s.progressStage === "returning") return "returning_shape";
  if (s.draftEvent && !s.draftEvent.emotion_family) return "uncertain";
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
  if (saved > 0) return "Based only on the moments you chose to save \u2014 not your whole week.";
  if (checkins > 0) return "Just a glimpse from a few check-ins \u2014 not the whole picture.";
  return "Nothing kept this week \u2014 I\u2019m here whenever there\u2019s something you\u2019d like to hold onto.";
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
        families.length ? `Based on the moments you chose to keep, ${joinList(families)} came up this week.` : "Here are the moments you chose to keep this week."
      );
    } else if (input.emotionsFirstShape.length) {
      parts.push(`This week, you helped me understand the first shape of ${joinList(input.emotionsFirstShape.map((f) => FAMILY_WORD[f]))}.`);
    } else if (families.length) {
      parts.push(`This week, we started noticing ${joinList(families)} together.`);
    }
    if (learning) parts.push(`I learned one shape I want to hold onto: ${trimEnd(learning)}.`);
    if (input.deepenedPatterns.length) {
      const dp = joinList(input.deepenedPatterns.map((f) => FAMILY_WORD[f]));
      parts.push(`And ${dp} is starting to feel familiar \u2014 we\u2019ve met it more than once now.`);
    }
    summary = parts.join(" ");
  }
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
    companion_learning_statement: learning,
    companion_summary: summary,
    caveat: caveatFor(input.savedSummaries.length, input.checkinCount),
    pdf_export_path: null
  };
}

// src/utils/text.ts
function stripEmDashes(text) {
  if (!text) return text;
  return text.replace(/\s*[—–―‒]\s*/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ", ").replace(/,\s*([.!?;:])/g, "$1").replace(/,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
}
export {
  PROGRESS_RANK,
  activeCards,
  advanceProgress,
  composeWeeklySummary,
  draftFromRejection,
  draftFromTurn,
  emptyProgress,
  evaluateStage,
  isDuplicateReply,
  memoryBlocked,
  migrateStage,
  mixedConfirmed,
  relevantMemory,
  routeMode,
  sanitizeStrands,
  selectVisualState,
  stageRank,
  stripEmDashes,
  varietyDirective,
  varietySignals,
  visualTintFamilies
};
