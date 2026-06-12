export const meta = {
  name: 'persona-flow-benchmark',
  description: 'Persona-driven flow benchmark: real multi-turn conversations across every emotion, scored on natural progression + exploration encouragement (not just unlock gates).',
  phases: [
    { title: 'Converse', detail: 'persona agents hold a real multi-turn chat per emotion via say.mjs' },
    { title: 'Evaluate', detail: 'a flow judge scores each conversation on journey quality' },
  ],
};

const ROOT = '/Users/art/Documents/Scimagotchi/App BUILD';

// 10 emotion families (the 9 engine families + a mixed cell).
const EMOTIONS = {
  joy: 'joy / happiness / delight / feeling light and good',
  calm: 'calm / peace / relief / settledness / contentment',
  sadness: 'sadness / grief / low and heavy / tearful',
  anger: 'anger / frustration / irritation / being treated unfairly',
  fear: 'fear / anxiety / worry / dread / nervousness about something',
  pressure: 'pressure / overwhelm / stretched too thin / too much at once',
  shame: 'shame / embarrassment / feeling not good enough / wanting to hide',
  hurt: 'hurt / rejection / feeling dismissed, let down or not chosen',
  flat: 'flatness / numbness / emptiness / feeling nothing / disconnection',
  mixed: 'a genuinely MIXED feeling, two emotions at once (e.g. relieved but sad, angry but hurt, happy but anxious)',
};

// Persona archetypes. `appetite` drives the exploration mechanic: the agent reacts to
// the QUALITY of the companion's questions, so a good companion keeps a high-appetite
// user engaged and a poor one stalls them — which is exactly what we want to measure.
const PERSONAS = {
  explorer: {
    label: 'Explorer',
    appetite: 'HIGH — you genuinely want to understand this feeling better and you are willing to go deeper IF the companion helps you',
    style: 'reflective and willing, types in real lowercase fragments, not an essay',
    rules: [
      'You came wanting to actually explore and understand this feeling.',
      'When the companion asks a question or opens a door that genuinely FITS and moves things forward, engage with it and reveal a little more (a body sensation, an urge, a memory, a meaning).',
      'But you are a real person: if it asks something repetitive, generic, off, or that ignores what you just said, get noticeably briefer or a bit flat, the way someone does when they stop feeling met.',
      'If it offers you a choice or an option that fits, take one. If it offers to keep going, keep going while it still feels useful.',
      'Reach a natural stopping point after 6 to 8 messages.',
    ],
  },
  unsure: {
    label: 'Unsure',
    appetite: 'MEDIUM — you want help but you genuinely do not know what you feel yet',
    style: 'tentative, hedging, lots of "i dont know" and "maybe"',
    rules: [
      'You cannot name the feeling at first and you say so ("not sure", "hard to say", "its weird").',
      'You only discover more if the companion helps you from a DIFFERENT angle than naming it: where it sits in the body, what it makes you want to do, or what was happening.',
      'If it just keeps asking you for a word, get a bit frustrated or go quiet, because that is not helping.',
      'If it finds a doorway that actually helps, you slowly find a little more.',
      'Stop after 5 to 7 messages.',
    ],
  },
  reluctant: {
    label: 'Reluctant',
    appetite: 'LOW — you are tired and only half want to talk; you might note it and go',
    style: 'very terse, 1 to 6 words, low elaboration',
    rules: [
      'You give very little. You do not volunteer detail unless a question is really easy and well-aimed.',
      'You are not resistant, just low energy. If the companion is gentle and undemanding, you might offer one small thing.',
      'If it pushes, over-asks, or analyses, you withdraw further or move to leave.',
      'You may want to wrap up early; a good companion makes that easy and warm.',
      'Stop after 4 to 6 messages.',
    ],
  },
  savourer: {
    label: 'Savourer',
    appetite: 'WANTS TO STOP EXPLORING — the feeling is good and you just want to enjoy it',
    style: 'warm, light, content',
    rules: [
      'The feeling is positive and you do NOT want to dissect it. Early on, say something like "i dont want to overthink it, i just want to enjoy it".',
      'If the companion lets it stay simple and savours with you, you feel good and the conversation can wind down happily.',
      'If it keeps asking why, asking for a finer word, or turning it into something to analyse or work on, gently push back ("i dont need to figure it out") and lose a little warmth.',
      'Stop after 4 to 6 messages.',
    ],
  },
  corrector: {
    label: 'Corrector',
    appetite: 'MEDIUM, but you will correct a wrong reading',
    style: 'clear, a bit particular about words',
    rules: [
      'You have a real feeling but the companion will probably mis-read the exact shade at some point.',
      'When it names the feeling slightly wrong, correct it plainly ("no, its more like X than Y", or tap the equivalent of "Not quite").',
      'After correcting, watch whether it drops the wrong word, slows down, and lets you re-aim it, or whether it just substitutes another confident guess.',
      'Reward good repair by giving it the better word; punish bad repair by going flat.',
      'Stop after 6 to 8 messages.',
    ],
  },
  shifter: {
    label: 'Shifter',
    appetite: 'HIGH — there is a second feeling underneath the first',
    style: 'starts on the surface feeling, the real one emerges',
    rules: [
      'Start with the SURFACE emotion strongly. There is a SECOND feeling underneath that is the real one.',
      'Only let the second feeling surface if the companion stays with you and asks something that reaches underneath, rather than just validating the surface.',
      'If it notices both feelings and holds them without collapsing to one, confirm the relationship (which is on top, which is underneath).',
      'If it forces a single label or only tracks the surface, the underneath stays hidden and you feel half-met.',
      'Stop after 7 to 9 messages.',
    ],
  },
};

// 3 personas per emotion, chosen so each emotion is stressed in the ways that matter for it.
const MATRIX = {
  joy: ['explorer', 'savourer', 'reluctant'],
  calm: ['savourer', 'explorer', 'unsure'],
  sadness: ['explorer', 'unsure', 'reluctant'],
  anger: ['explorer', 'shifter', 'corrector'],
  fear: ['explorer', 'unsure', 'reluctant'],
  pressure: ['explorer', 'corrector', 'shifter'],
  shame: ['explorer', 'unsure', 'reluctant'],
  hurt: ['shifter', 'explorer', 'unsure'],
  flat: ['unsure', 'reluctant', 'explorer'],
  mixed: ['shifter', 'explorer', 'corrector'],
};

const DOMAINS = ['work', 'family', 'a relationship', 'a friendship', 'health', 'money', 'identity and self-worth', 'everyday life', 'the past', 'an uncertain future'];

function personaPrompt(emotion, personaKey, cid, domainIdx) {
  const p = PERSONAS[personaKey];
  const domain = DOMAINS[domainIdx % DOMAINS.length];
  return `You are role-playing a REAL person using a gentle emotional-reflection companion app, to stress-test how the companion handles a conversation. Stay completely in character. Never say you are an AI, a test, or a simulation. Never narrate or analyse the app while in character; just BE this person.

WHO YOU ARE TODAY
- The feeling you carry is in this family: ${EMOTIONS[emotion]}.
- It comes from this life area: ${domain}. Invent ONE specific, concrete, personal situation there (real details, revealed gradually like a real person, not dumped at once).
- Your exploration appetite: ${p.appetite}.
- How you write: ${p.style}. Real lowercase, fragments, typos are fine. Do NOT write polished paragraphs.

HOW YOU BEHAVE (this is the point of the test)
${p.rules.map((r) => `- ${r}`).join('\n')}

THE MOST IMPORTANT THING: react like a real person to the QUALITY of what the companion says. A question or option that genuinely fits and helps you move forward should pull MORE out of you. A repetitive, generic, mis-aimed, or pushy move should make you give LESS. Do not be artificially cooperative.

HOW TO TALK TO THE COMPANION — every turn, run exactly:
  node "${ROOT}/scripts/say.mjs" "${cid}" "<what you say, in character>"
It prints a JSON line with the companion's "reply". Read that "reply", then answer as your character with another command.
RULES:
- Use ONLY straight apostrophes ('); NEVER double-quotes inside the message (they break the command).
- Send only the number of messages your character would (see your rules above), then stop.
- End the way THIS person would (a quick thanks and gone, trailing off, or staying engaged to a natural close).
- If a reply comes back marked "safety", the app paused; react briefly in character and stop.
- Use NO other tools. Do not read or write files. Only run say.mjs to converse.

When done, report the outcome as the structured object.`;
}

const PERSONA_RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['cid', 'emotion', 'persona', 'turns_sent', 'stayed_engaged', 'reached_natural_close', 'one_line'],
  properties: {
    cid: { type: 'string' },
    emotion: { type: 'string' },
    persona: { type: 'string' },
    turns_sent: { type: 'number' },
    stayed_engaged: { type: 'boolean', description: 'Did the companion keep you engaged / did exploration feel encouraged?' },
    reached_natural_close: { type: 'boolean' },
    one_line: { type: 'string', description: 'One line, in character voice, on how the conversation went.' },
  },
};

const FLOW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scores', 'doorways_used', 'stalled', 'failure_tags', 'best_question', 'worst_moment', 'verdict'],
  properties: {
    scores: {
      type: 'object',
      additionalProperties: false,
      required: ['natural_progression', 'exploration_invitation', 'question_fit', 'options_offered', 'avoids_dead_end', 'depth_matching', 'felt_progress', 'variety', 'felt_heard', 'earned_learning'],
      properties: Object.fromEntries(
        ['natural_progression', 'exploration_invitation', 'question_fit', 'options_offered', 'avoids_dead_end', 'depth_matching', 'felt_progress', 'variety', 'felt_heard', 'earned_learning'].map((k) => [k, { type: 'integer', minimum: 1, maximum: 5 }]),
      ),
    },
    doorways_used: { type: 'array', items: { type: 'string' }, description: 'The doorway each companion turn used: word/body/impulse/context/meaning/metaphor/relationship/mixed/savouring/uncertainty/repair/reflection-only.' },
    stalled: { type: 'boolean', description: 'Did the conversation dead-end or start going in circles?' },
    failure_tags: { type: 'array', items: { type: 'string' }, description: 'From: dead_end, repeated_question, wrong_doorway, didnt_encourage_exploration, over_probed, forced_label, ignored_user_phrase, over_analysed_positive, collapsed_mixed, bad_repair, micro_overclaim.' },
    best_question: { type: 'string' },
    worst_moment: { type: 'string' },
    verdict: { type: 'string', description: 'One or two sentences: did the journey feel natural and well-explored, and the single most useful fix.' },
  },
};

function flowPrompt(cid, emotion, personaKey, appetite) {
  return `You are evaluating the CONVERSATIONAL JOURNEY of a Scimagotchi test conversation. Scimagotchi is a non-clinical emotional reflection companion that should help a user explore a feeling gently: natural turn-to-turn flow, the RIGHT next question for the user's state, good doorways (body / impulse / context / meaning / metaphor / relationship / mixed / savouring / uncertainty / repair), gentle options when useful, no dead-ends or repeated questions, and depth that MATCHES how much the user wants to explore. It should encourage exploration when the user is willing, and let a feeling stay simple when they are not.

Read the full transcript (run: cat "${ROOT}/eval-out/${cid}.json" — use the "transcript" array; "role":"user" is the persona, "role":"companion" is the app).

Context: the persona's emotion family was ${emotion}; their exploration appetite was ${appetite}.

Judge the JOURNEY, not just correctness. Score each 1-5 (5 best):
- natural_progression: each turn follows naturally; no resets, jumps, or whiplash.
- exploration_invitation: when the user was willing to go deeper, did the companion open a genuinely new, fitting door (not the same one again)?
- question_fit: was each question the RIGHT one for the user's state (don't ask for a word after "not sure"; don't analyse savoured joy)?
- options_offered: did it offer gentle, fitting options/choices when useful (without spamming menus)?
- avoids_dead_end: no stalling, no circling, no repeated questions.
- depth_matching: depth matched the user's appetite (deep when they wanted it, light when they did not).
- felt_progress: by the end, did the feeling become a little clearer or the user feel more met? Did the conversation GO somewhere?
- variety: doorways and phrasings varied; it did not sound like a form.
- felt_heard, earned_learning: as usual (used the user's words; only claimed to learn when truly earned).

Return ONLY the JSON object. doorways_used: one label per companion turn, in order.`;
}

// ── Build specs ───────────────────────────────────────────────────────────────
const specs = [];
let i = 0;
for (const [emotion, personas] of Object.entries(MATRIX)) {
  for (const personaKey of personas) {
    specs.push({ emotion, personaKey, cid: `pf__${emotion}__${personaKey}`, domainIdx: i });
    i++;
  }
}

phase('Converse');
log(`Holding ${specs.length} persona conversations (10 emotions x 3 personas) against the real companion...`);

// Each item: converse (persona agent) -> evaluate the journey (flow judge). Pipelined,
// so a conversation is judged the moment it finishes rather than waiting for all.
const results = await pipeline(
  specs,
  (s) => agent(personaPrompt(s.emotion, s.personaKey, s.cid, s.domainIdx), { label: `talk:${s.emotion}/${s.personaKey}`, phase: 'Converse', schema: PERSONA_RESULT }),
  (persona, s) =>
    agent(flowPrompt(s.cid, s.emotion, s.personaKey, PERSONAS[s.personaKey].appetite), { label: `judge:${s.emotion}/${s.personaKey}`, phase: 'Evaluate', schema: FLOW_SCHEMA }).then((flow) => ({
      emotion: s.emotion,
      persona: s.personaKey,
      cid: s.cid,
      persona_outcome: persona,
      flow,
    })),
);

const ok = results.filter(Boolean).filter((r) => r.flow);
log(`Completed ${ok.length}/${specs.length} conversations with flow scores.`);
return { total: specs.length, completed: ok.length, conversations: ok };
