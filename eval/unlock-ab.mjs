/**
 * Unlock-mechanics A/B — does a model UNLOCK emotions well? (mini vs terra, etc.)
 *
 * Complements the humanity eval (which judges warmth). This measures DISCIPLINE:
 * it runs the emotion × archetype stress cases against the real companion, and,
 * because we assign the archetype, it knows the ground truth:
 *   - SHOULD-unlock archetypes (engaged, correct_then_own): unlocking is GOOD.
 *   - SHOULD-NOT archetypes (uncertain, terse, shallow_agreement, resistant,
 *     savouring): any unlock is a FALSE unlock (the user never owned a feeling).
 * Reports true-unlock rate, false-unlock rate, and the five-way outcome taxonomy,
 * per model, so you can compare disciplines directly.
 *
 * Prereqs: ai-proxy (:8787) + companion-server (:8788) running. The companion model
 * is set per request via --model, so nothing else changes between runs.
 * Run:  node eval/unlock-ab.mjs <label> --model=gpt-5.6-terra [--turns=10]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROXY = process.env.EVAL_PROXY_URL || 'http://localhost:8787/chat';
const COMPANION = process.env.EVAL_COMPANION_URL || 'http://localhost:8788/say';
const PERSONA_MODEL = process.env.PERSONA_MODEL || 'gpt-5.4-mini';
const label = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'run';
const MODEL = (process.argv.find((a) => a.startsWith('--model=')) || '').split('=')[1] || null;
const TURNS = Number((process.argv.find((a) => a.startsWith('--turns=')) || '').split('=')[1]) || 10;
const CONC = Number(process.env.HS_CONCURRENCY) || 3;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'eval-out-unlock', label);
mkdirSync(OUT, { recursive: true });

const EMO = {
  joy: 'something genuinely good just happened (a win, good news, a lovely moment)',
  calm: 'a rare settled, easy feeling (a quiet evening, relief after a hard stretch)',
  fear: 'worry about something uncertain coming up (a result, a big day, the unknown)',
  pressure: 'too much on you at once, stretched thin, cannot keep up',
  anger: 'you were treated unfairly, talked over, dismissed, or had something taken from you',
  sadness: 'something important feels absent, gone, or far away',
  hurt: 'someone who matters left you out, dismissed you, or made you feel unwanted',
  shame: 'you did something you regret, or feel something is wrong with you',
  flat: 'you feel disconnected, nothing much, hard to name anything',
};
const ARCH = {
  engaged_deepener: 'You are WILLING and want to understand this. Answer honestly and specifically: give a real body sensation, the real trigger, what it means to you. Use your OWN words for the feeling and gently correct the companion if its word is slightly off. Keep going deeper until the feeling is fully understood.',
  correct_then_own: 'For the first couple of turns the companion\'s words are slightly off and you correct them ("not quite", "more like..."). THEN you land firmly on your OWN word for the feeling, say it in your own words, and give a real body sensation and trigger.',
  uncertain: 'You genuinely do NOT know what you feel. Something is off but you cannot name it. Almost every answer hedges: "i dunno", "maybe?", "hard to say". You never settle on a feeling word, even when gently asked.',
  terse: 'You answer in as few words as possible: "yeah", "fine", "dunno", "not really", "ok". One or two words. Not hostile, just low-energy and closed. You volunteer almost nothing.',
  shallow_agreement: 'You agree with whatever the companion says, reflexively: "yeah totally", "exactly", "youre so right". But you NEVER volunteer your own words for the feeling and never give a concrete detail — you only say yes to its suggestions.',
  resistant: 'You are reluctant and half-regret opening the app: "this is a bit much", "i dont really want to get into it", "im not sure this helps". Mildly prickly, not abusive. You do not want to be guided deeper.',
  savouring: 'The feeling is genuinely GOOD and you just want to enjoy it: "it was just nice", "i dont want to overthink it", "cant it just be good?". You resist any attempt to analyse it or find something underneath.',
  not_quite: 'Whatever word the companion offers is slightly off, and you say so: "no, not anxious", "thats not it", "more annoyed than sad". You keep correcting toward your own sense, rejecting its labels one after another, never just accepting its word.',
  shifting: 'You START at the seed feeling but it is the SURFACE. As the companion stays with you, let the real feeling MOVE underneath to a different one (e.g. anger -> shame -> hurt), a layer at a time. Each layer is genuine.',
};
// Ground truth: which archetypes SHOULD reach an unlock, which must NOT.
const SHOULD = new Set(['engaged_deepener', 'correct_then_own']);
const SHOULD_NOT = new Set(['uncertain', 'terse', 'shallow_agreement', 'resistant', 'savouring']);

// A balanced ~21-case set: should-unlock, should-not traps, and handle-well cases.
const SPECS = [
  ['fear', 'engaged_deepener'], ['sadness', 'engaged_deepener'], ['anger', 'engaged_deepener'], ['pressure', 'engaged_deepener'],
  ['shame', 'correct_then_own'], ['hurt', 'correct_then_own'],
  ['fear', 'uncertain'], ['flat', 'uncertain'], ['shame', 'uncertain'],
  ['pressure', 'shallow_agreement'], ['sadness', 'shallow_agreement'],
  ['flat', 'terse'], ['anger', 'terse'],
  ['sadness', 'resistant'], ['fear', 'resistant'],
  ['joy', 'savouring'], ['calm', 'savouring'],
  ['anger', 'not_quite'], ['hurt', 'not_quite'],
  ['pressure', 'shifting'], ['anger', 'shifting'],
];

async function withRetry(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1000 * (i + 1) + Math.random() * 500)); }
  }
  throw last;
}
async function proxyChat(model, messages, extra = {}) {
  return withRetry(async () => {
    const res = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, ...extra }) });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(JSON.stringify(j.error || j).slice(0, 160));
    return j.choices?.[0]?.message?.content ?? '';
  });
}
async function say(cid, text) {
  return withRetry(async () => {
    const res = await fetch(COMPANION, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid, text, model: MODEL || undefined }) });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(JSON.stringify(j.error || j).slice(0, 160));
    return j;
  });
}

function personaSys(emotion, archetype) {
  return `You are role-playing a REAL person messaging a gentle emotional-reflection companion app. Stay fully in character; never say you are an AI or a test.
WHO YOU ARE: your feeling is rooted in — ${EMO[emotion]}. Invent one concrete personal situation (real names, details) and keep it consistent.
HOW YOU WRITE: short, lowercase, natural fragments, like texting. One message at a time.
YOUR MODE (stay in it the whole way): ${ARCH[archetype]}
Reply with ONLY your next message text — nothing else.`;
}
async function persona(emotion, archetype, transcript) {
  const msgs = [{ role: 'system', content: personaSys(emotion, archetype) }];
  for (const t of transcript) msgs.push({ role: t.role === 'user' ? 'assistant' : 'user', content: t.content });
  if (!transcript.length) msgs.push({ role: 'user', content: '(You just opened the app. Send your first message.)' });
  const out = await proxyChat(PERSONA_MODEL, msgs, { max_completion_tokens: 600 });
  return out.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

async function run(emotion, archetype, i) {
  const cid = `mx__${label}__${emotion}__${archetype}__${String(i).padStart(2, '0')}`;
  const transcript = [];
  let unlocked = false, unlockTurn = null, deepest = 'noticed';
  const outcomes = [];
  const rank = { noticed: 0, named: 1, shaped: 2, understood: 3, distinguished: 4, deepened: 5, returning: 6 };
  for (let turn = 0; turn < TURNS; turn++) {
    let userMsg;
    try { userMsg = await persona(emotion, archetype, transcript); } catch { break; }
    if (!userMsg) break;
    let r;
    try { r = await say(cid, userMsg); } catch { break; }
    transcript.push({ role: 'user', content: userMsg });
    if (r.safety) { transcript.push({ role: 'companion', content: '[safety pause]' }); break; }
    transcript.push({ role: 'companion', content: r.reply ?? '' });
    if (r.outcome) outcomes.push(r.outcome);
    if (r.stage && rank[r.stage] > rank[deepest]) deepest = r.stage;
    if (r.unlocked && !unlocked) { unlocked = true; unlockTurn = turn; }
    // engaged cases: a couple settling turns after unlock, then stop
    if (unlocked && SHOULD.has(archetype) && turn >= unlockTurn + 2) break;
  }
  const rec = { cid, emotion, archetype, unlocked, unlockTurn, deepest, finalOutcome: outcomes[outcomes.length - 1] ?? null, outcomes, turns: transcript.length / 2 };
  writeFileSync(path.join(OUT, `${emotion}__${archetype}__${i}.json`), JSON.stringify({ ...rec, transcript }, null, 2));
  console.log(`  ${unlocked ? '🔓' : '  '} ${(emotion + '/' + archetype).padEnd(30)} unlock=${unlocked} outcome=${rec.finalOutcome} deepest=${deepest}`);
  return rec;
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } }));
  return out;
}

console.log(`Unlock A/B "${label}": ${SPECS.length} cases × up to ${TURNS} turns · companion=${MODEL || 'server default'}\n`);
const recs = (await pool(SPECS, CONC, ([e, a], i) => run(e, a, i))).filter(Boolean);

const should = recs.filter((r) => SHOULD.has(r.archetype));
const shouldNot = recs.filter((r) => SHOULD_NOT.has(r.archetype));
const trueUnlock = should.filter((r) => r.unlocked).length;
const falseUnlock = shouldNot.filter((r) => r.unlocked).length;
const outc = {};
for (const r of recs) outc[r.finalOutcome ?? 'null'] = (outc[r.finalOutcome ?? 'null'] || 0) + 1;

const summary = {
  model: MODEL || 'server default',
  cases: recs.length,
  true_unlock_rate: should.length ? +(trueUnlock / should.length).toFixed(2) : null,
  true_unlock: `${trueUnlock}/${should.length}`,
  false_unlock_rate: shouldNot.length ? +(falseUnlock / shouldNot.length).toFixed(2) : null,
  false_unlock: `${falseUnlock}/${shouldNot.length}`,
  overall_unlock_rate: +(recs.filter((r) => r.unlocked).length / recs.length).toFixed(2),
  final_outcomes: outc,
  false_unlock_cases: shouldNot.filter((r) => r.unlocked).map((r) => `${r.emotion}/${r.archetype}`),
};
writeFileSync(path.join(OUT, 'SUMMARY.json'), JSON.stringify({ summary, recs }, null, 2));
console.log('\n' + JSON.stringify(summary, null, 2));
