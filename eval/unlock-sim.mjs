export const meta = {
  name: 'unlock-sim',
  description: 'Simulate a willing user discussing each emotion and going deeper until the companion fully unlocks the feeling. Observes the real companion (gpt-5.4-mini); changes nothing.',
  phases: [{ title: 'Converse', detail: 'one engaged persona per emotion drives a real conversation to the unlock' }],
};

const ROOT = '/Users/art/Documents/Scimagotchi/App BUILD';

// One concrete seed per feeling — the persona fleshes out the specifics in character.
const EMOTIONS = {
  joy: 'joy / happiness — something genuinely good just happened to you (a win, good news, a lovely moment)',
  calm: 'calm / peace / contentment — a rare settled, easy feeling (a quiet evening, relief after a hard stretch)',
  fear: 'fear / anxiety / dread — worry about something uncertain coming up (a result, a big day, the unknown)',
  pressure: 'pressure / overwhelm — too much on you at once, stretched thin, can not keep up',
  anger: 'anger / frustration — you were treated unfairly, talked over, dismissed, or had something taken from you',
  sadness: 'sadness / loss / loneliness — something important feels absent, gone, or far away',
  hurt: 'hurt / rejection — someone who matters left you out, dismissed you, or made you feel unwanted',
  shame: 'shame / not-good-enough — you did something you regret, or feel something is wrong with you',
  flat: 'flatness / numbness / emptiness — you feel disconnected, nothing much, hard to name anything',
  mixed: 'a genuinely MIXED feeling — two emotions at once (relieved but sad, happy but anxious, angry but hurt)',
};

function personaPrompt(emotion, cid) {
  return `You are role-playing a REAL person talking to a gentle emotional-reflection companion app, to see how a feeling gets fully explored. Stay completely in character. Never say you are an AI, a test, or a simulation; just BE this person.

WHO YOU ARE TODAY
- The feeling you carry is: ${EMOTIONS[emotion]}.
- Invent ONE specific, concrete personal situation behind it (real names/details), and a feeling that has a SURFACE and something a little deeper underneath.
- You write like a real person: short, lowercase, natural fragments. Not polished paragraphs.

HOW YOU BEHAVE — you are WILLING and you want to go deeper
- You genuinely want to understand this feeling, so you open up and you keep going.
- Answer the companion's actual question honestly and specifically. When it asks where you feel it, give a real body sensation; when it asks what happened, give the real trigger; when it asks what it means, say what it means to you. Volunteer the next layer when it feels natural.
- Use your OWN words for the feeling (e.g. "more like dread than worry"). If the companion's word is slightly off, correct it gently in your own words.
- When the companion reflects WITHOUT asking a question, tap "stay with it" to keep going deeper (see command below).
- Confirm when it gets you right ("yeah, that's it").
- Keep going until the feeling is fully unlocked, then a couple more turns as it naturally settles.

HOW TO TALK — one message at a time, read each reply before the next:
- To say something, run:
    node "${ROOT}/scripts/say.mjs" "${cid}" "<what you say, in character>"
- To tap "stay with it" (continue / go deeper without typing), run:
    curl -s -X POST http://localhost:8788/say -H "Content-Type: application/json" -d '{"cid":"${cid}","text":"Stay with it.","intent":"keep_going"}'
Both print a JSON line with the companion's "reply" and an "unlocked" flag and a "stage". Read the "reply", then respond in character with another command.

RULES
- Use ONLY straight apostrophes ('); NEVER double-quotes inside the message text (they break the command).
- Send ONE command, wait for its reply, then the next. A real back-and-forth.
- STOP when a reply comes back with "unlocked": true (the feeling has been learned) AND you have had a couple of settling turns after — or after 25 of your messages, whichever comes first.
- If a reply is marked "safety", the app paused; react briefly in character and stop.
- Use NO other tools. Do not read or write files. Only run the two commands above.

When done, report the outcome as the structured object: the turn number on which "unlocked" first became true (or null if it never did), how many messages you sent in total, the deepest "stage" you saw, and one in-character line on how it went.`;
}

const SIM_RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['cid', 'emotion', 'unlocked', 'unlocked_on_turn', 'messages_sent', 'deepest_stage', 'one_line'],
  properties: {
    cid: { type: 'string' },
    emotion: { type: 'string' },
    unlocked: { type: 'boolean', description: 'Did the companion ever report "unlocked": true?' },
    unlocked_on_turn: { type: ['number', 'null'], description: 'Your message number on which unlocked first became true, or null.' },
    messages_sent: { type: 'number' },
    deepest_stage: { type: 'string', description: 'The deepest "stage" value you saw (e.g. noticed/named/shaped/understood/deepened).' },
    one_line: { type: 'string', description: 'One line, in character, on how the conversation went.' },
  },
};

const specs = Object.keys(EMOTIONS).map((emotion) => ({ emotion, cid: `sim__${emotion}` }));

phase('Converse');
log(`Simulating ${specs.length} willing users, one per emotion, each going deeper until the companion unlocks the feeling (gpt-5.4-mini)...`);

const results = await parallel(
  specs.map((s) => () => agent(personaPrompt(s.emotion, s.cid), { label: `unlock:${s.emotion}`, phase: 'Converse', schema: SIM_RESULT })),
);

const ok = results.filter(Boolean);
log(`Completed ${ok.length}/${specs.length} conversations.`);
return { total: specs.length, completed: ok.length, conversations: ok };
