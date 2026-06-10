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
function routeMode(userText, prevEvent) {
  const t = norm(userText);
  const long = userText.trim().length > 160;
  const familyKnown = !!prevEvent?.emotion_family;
  const shaped = !!prevEvent && (prevEvent.body_cue.length > 0 || prevEvent.behaviour_action.length > 0);
  if (REPAIR.test(t))
    return {
      mode: "repair",
      directive: 'Mode: REPAIR \u2014 they just corrected or rejected your reading. Acknowledge the miss plainly and without defensiveness ("I had that wrong" / "let me step back"), drop the rejected label completely (record it as rejected, never re-propose it), lower the intensity, and either offer a low-effort correction ("what word would be closer?") or simply make room. Nothing can be marked understood on a repair turn.'
    };
  if (CLOSE.test(t))
    return {
      mode: "close",
      directive: "Mode: CLOSE \u2014 they are wrapping up. End with dignity in one warm sentence, in their register. No new question, no re-opening the feeling, no summary unless they asked. Vary your closing words from previous closes."
    };
  if (MIXED.test(t))
    return {
      mode: "hold_mixed",
      directive: "Mode: HOLD MIXED \u2014 more than one feeling is present. Hold both strands without collapsing them into one label. If useful, ask ONE question about how they relate (both at once / moving between them / one underneath the other). Set mixed_relation in your output. Never force a single answer."
    };
  if (DONT_KNOW.test(t) || BODY_WORDS.test(t) && !EMOTION_WORD.test(t))
    return {
      mode: "body_first",
      directive: 'Mode: BODY FIRST \u2014 they cannot or do not want to name it. Do not demand emotion words. Stay with the felt sense: where it sits, its weight/temperature/movement. "Unnamed for now" is a fully valid resting place.'
    };
  if (GREETING.test(t))
    return {
      mode: "soft_landing",
      directive: "Mode: SOFT LANDING \u2014 a greeting/small talk. Just be warm and present; make it easy to begin. No emotion probing, no menus. emotion_family stays null."
    };
  if (long && (EMOTION_WORD.test(t) || HEAVY_DISCLOSURE.test(t)) || HEAVY_DISCLOSURE.test(t))
    return {
      mode: "witness",
      directive: "Mode: WITNESS \u2014 they shared something heavy or rich. The job this turn is to make them feel HEARD, not to classify. Reflect ONE concrete, specific detail in their own words. Strongly prefer NO question this turn \u2014 a question now would feel extractive. If you must ask, make it one short, open invitation."
    };
  if (ASK_WHAT_FEELING.test(t) || EMOTION_WORD.test(t) && !familyKnown)
    return {
      mode: "name",
      directive: "Mode: NAME \u2014 a feeling word is on the table. Accept their word first; help find the closest-fitting shade only if it helps. Treat any label you supply as a tentative hypothesis, never as truth."
    };
  if (VAGUE.test(t) && !familyKnown)
    return {
      mode: "clarify",
      directive: "Mode: CLARIFY \u2014 the signal is vague. Offer one small, gentle distinction (not a quiz). It is fine to leave it broad; do not push a label onto it."
    };
  if (familyKnown && shaped)
    return {
      mode: "meaning",
      directive: "Mode: MEANING \u2014 the feeling has a name and a felt shape. Gently reach for what the moment seemed to mean or what set it off, one step only, in their words. If meaning is already clear, reflect the shape you now understand."
    };
  if (familyKnown)
    return {
      mode: "differentiate",
      directive: "Mode: DIFFERENTIATE \u2014 a family is in play but the shade is loose. Help separate nearby feelings only as far as is useful; their own word beats a precise-sounding one."
    };
  return {
    mode: "witness",
    directive: "Mode: WITNESS (default) \u2014 reflect one specific thing you actually heard, in their words, before anything else. At most one short question, and only if it clearly helps."
  };
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
export {
  evaluateStage,
  isDuplicateReply,
  mixedConfirmed,
  routeMode,
  sanitizeStrands,
  stageRank,
  varietyDirective,
  varietySignals
};
