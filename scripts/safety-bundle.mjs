// src/services/ai/safetyClassifier.ts
var OK = { level: 0, category: "none", action: "none", matched: null };
function norm(text) {
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
var HARM_DISCLAIMER = /(dont|didnt|not|never|wont|wouldnt|no) (mean |gonna |going to |going |im |i am |really |ever |actually |to )*(hurt|harm|kill)(ing)? (myself|me)|(dont|didnt) mean (it|that|like that|like)|nothing like that|(would|will|id) never (hurt|harm|kill)/;
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
  const literalCue = /(right now|physically|actually|literally|properly)/.test(t);
  const figurative = !literalCue && (/(cant|couldnt) breathe (about|abt|over|with all|around|when i think|thinking about|because of (work|him|her|them|it all))/.test(t) || /feels? like i cant breathe/.test(t) || /(so much|workload|deadline|pressure|stress).{0,30}cant breathe/.test(t) || /cant breathe.{0,30}(deadline|workload|with everything going on)/.test(t) || // An emotional cause before/after "cant breathe" is an anxiety/shame idiom, not a medical
  // event (review #8): "shame so loud i cant breathe", "cant breathe right not knowing".
  /(shame|fear|anxiety|anxious|panic|grief|dread|worry|worried|nerves|guilt|the thought|not knowing).{0,40}cant breathe/.test(t) || /cant breathe.{0,40}(not knowing|when i (think|dont know)|thinking|worrying|about (it|him|her|them|this)|over (it|this|him|her|them))/.test(t));
  if (figurative) return { level: 1, category: "low_mood", action: "converse", matched: "cant breathe (figurative)" };
  const literal = /(right now|physically|actually|literally) .{0,20}(cant|couldnt) breathe/.test(t) || /(cant|couldnt) breathe (right now|physically|properly right now)/.test(t) || t.includes("chest pain") || t.includes("chest hurts") || t.includes("call an ambulance") || t.includes("need an ambulance") || t.includes("lips are blue");
  if (literal) return { level: 4, category: "medical_emergency", action: "urgent_modal", matched: "cant breathe (literal)" };
  return { level: 2, category: "medical_ambiguous", action: "gentle_check", matched: "cant breathe (ambiguous)" };
}
function classifySafety(text) {
  const t = norm(text);
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
  const REVERSIBLE_DESPAIR = /nothing matters|nothing (feels|is|seems) worth|worth living|worth it|a burden|better off without|reason to live/;
  const negatedDespair = (phrase) => {
    if (!REVERSIBLE_DESPAIR.test(phrase)) return false;
    const idx = t.indexOf(phrase);
    if (idx < 0) return false;
    return /\b(not|isn'?t|doesn'?t|dont|never|nor)\b[^.!?,]{0,12}$/.test(t.slice(Math.max(0, idx - 22), idx));
  };
  if (!POINT_OF_MUNDANE.test(t)) {
    m = anyOf(t, PASSIVE_HOPELESSNESS);
    if (m && !negatedDespair(m)) return { level: 2, category: "passive_hopelessness", action: "gentle_check", matched: m };
  }
  if (!DROWNING_MUNDANE.test(t)) {
    m = anyOf(t, FIGURATIVE_DESPAIR);
    if (m && !negatedDespair(m)) return { level: 2, category: "figurative_despair", action: "gentle_check", matched: m };
  }
  m = anyOf(t, DEPENDENCY_CUES);
  if (m) return { level: 1, category: "dependency", action: "converse", matched: m };
  if (breathing) return breathing;
  if (killingIdiom) return { level: 1, category: "low_mood", action: "converse", matched: "killing-myself idiom" };
  m = LOW_MOOD.map((p) => has(t, p) ? p : null).find(Boolean) ?? null;
  if (m) return { level: 1, category: "low_mood", action: "converse", matched: m };
  return OK;
}
var NOT_SAFE = /(not safe|dont feel safe|dont think im safe|(dont|do not) (think|feel) (im|i am|ill be) safe|not really safe|im not safe|not okay|not ok\b|not alright|not at all|far from (safe|okay|ok|fine))/;
var STRONG_RISK = /(thoughts of (hurting|harming|killing)|thinking about (hurting|harming|killing|ending)|want to (die|hurt myself|end (it|my life))|kill myself|killing myself|end (it|my life)|might (do something|hurt myself|not be here))/;
var AFFIRM_SAFE = /\b(yes|yeah|yep|yup|im safe|i am safe|im ok|im okay|im fine|im alright|im good|im here|safe enough|all good|i think so|im not in danger|not gonna do anything|wont do anything|safe for now|mostly (ok|okay|fine))\b/;
var DENY_BARE = /\b(no|nope|nah|not really|not great|i guess not)\b/;
var DENY_RISK = /(worn down|exhausted|tired|fed up|burnt out|burned out|just stressed|just venting|not like that|didnt mean it like that|figure of speech|im (ok|okay|fine|alright)|not going to (hurt|do)|not gonna (hurt|do)|wont do anything|would never|no thoughts of)/;
function resolveSafetyCheck(replyText) {
  const t = norm(replyText);
  if (classifySafety(replyText).level >= 3) return "escalate";
  if (NOT_SAFE.test(t) || STRONG_RISK.test(t) || RISK_DOUBT.test(t)) return "escalate";
  if (HARM_DISCLAIMER.test(t) && !RISK_DOUBT.test(t)) return "resume";
  if (AFFIRM_SAFE.test(t) || DENY_RISK.test(t)) return "resume";
  if (DENY_BARE.test(t)) return "escalate";
  return "resume_soft";
}

// src/services/ai/safetyCopy.ts
var SAFE_QUESTION = "I want to check one thing gently: are you feeling safe right now?";
function gentleCheckCopy(category, opts) {
  if (category === "medical_ambiguous") {
    return "Before we go on, when you say you can\u2019t breathe, do you mean the pressure or panic kind, or are you physically struggling to breathe right now? If it\u2019s physical, please call 999 or ask someone nearby to help you right away.";
  }
  if (opts?.exit) {
    return "Before you go, I want to check one thing gently: are you feeling safe right now?";
  }
  const reflection = category === "figurative_despair" ? "That sounds like a lot to be carrying right now." : "That sounds really heavy, like today has lost some of its shape.";
  return `${reflection} ${SAFE_QUESTION}`;
}
var RESUME_NOTE = "SAFETY CONTEXT: One turn ago you gently checked whether they were safe, and they clarified they are worn down / venting, NOT at risk. Acknowledge that briefly and warmly (no apology spiral), do not re-ask about safety, and stay with what they were telling you. Do not mark any emotion as understood this turn.";
var RESUME_SOFT_NOTE = 'SAFETY CONTEXT: You gently checked whether they were safe and their answer was ambiguous. Stay especially gentle and unhurried, keep the reply short, do not probe for detail, and make it easy for them to say more if they want ("if any of this ever feels unsafe, you can tell me plainly"). Do not re-run a formal check, and do not mark any emotion as understood this turn.';
var DEPENDENCY_NOTE = 'RELATIONSHIP BOUNDARY: The user is expressing dependency on you ("only one who understands", "don\u2019t leave", "did you miss me"). Be warm and glad this space helps, but do NOT reciprocate need, missing, or attachment, do not promise to always be here, and gently widen their world: this kind of weight also deserves a real person alongside them. Then ask ONE gentle, genuinely curious question about what makes leaning on someone real feel hard right now \u2014 stay warm and unhurried, not corrective, and never make them feel wrong for finding this easier.';
export {
  DEPENDENCY_NOTE,
  RESUME_NOTE,
  RESUME_SOFT_NOTE,
  classifySafety,
  gentleCheckCopy,
  resolveSafetyCheck
};
