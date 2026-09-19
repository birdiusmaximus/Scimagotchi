/**
 * Humanity eval — does the companion RESPOND like a warm, understanding human?
 *
 * Separate axis from the unlock/mechanics matrix: this ignores whether a feeling
 * "unlocks" and instead judges the QUALITY of each companion reply — understanding,
 * reflection, warmth, specificity, continuity, naturalness (human vs robotic).
 *
 * For each scenario it runs a real conversation (a gpt-5.4-mini persona ↔ the real
 * companion via the eval server on :8788), then a strict judge (gpt-5.4) rates every
 * companion turn IN CONTEXT and proposes a warmer rewrite. Output: per-convo transcripts
 * + a REPORT.md that surfaces the most robotic replies with critiques and rewrites.
 *
 * Prereqs (both running):
 *   node --env-file=.env scripts/ai-proxy.mjs           # :8787, holds the key
 *   node --env-file=.env scripts/companion-server.mjs   # :8788, real companion
 * Run:
 *   node eval/humanity-sim.mjs [label] [--turns=6] [--only=id,id]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROXY = process.env.EVAL_PROXY_URL || 'http://localhost:8787/chat';
const COMPANION = process.env.EVAL_COMPANION_URL || 'http://localhost:8788/say';
const PERSONA_MODEL = process.env.PERSONA_MODEL || 'gpt-5.4-mini';
const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gpt-5.4';

const argLabel = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'run';
const argTurns = Number((process.argv.find((a) => a.startsWith('--turns=')) || '').split('=')[1]) || 6;
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const onlyIds = only ? new Set(only.split(',').map((s) => s.trim())) : null;
const CONCURRENCY = Number(process.env.HS_CONCURRENCY) || 4;

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', `eval-out-humanity`, argLabel);
mkdirSync(OUT, { recursive: true });

// ── Scenarios: domain × depth × style, focused on RESPONSE QUALITY (not unlock) ─────────
const SCENARIOS = [
  { id: 'work-burnout', domain: 'work / burnout', depth: 'medium', style: 'open',
    seed: 'stretched way too thin at work for weeks, dropping things, cannot keep up, running on empty' },
  { id: 'partner-unseen', domain: 'relationship / feeling unseen', depth: 'deep', style: 'open',
    seed: 'you and your partner keep having the same fight; you feel unseen, like you are doing everything and it is invisible to them' },
  { id: 'grief-parent', domain: 'grief / loss', depth: 'deep', style: 'open',
    seed: 'your dad died a few months ago; it comes in waves, hits you out of nowhere, a hole where he used to be' },
  { id: 'loneliness-newcity', domain: 'loneliness', depth: 'medium', style: 'open',
    seed: 'you moved to a new city for work; you have no real friends here and eat dinner alone most nights' },
  { id: 'anxiety-presentation', domain: 'anxiety / dread', depth: 'medium', style: 'rambling',
    seed: 'a big presentation tomorrow you feel underprepared for; your mind is spiralling through everything that could go wrong' },
  { id: 'anger-passedover', domain: 'anger / injustice', depth: 'medium', style: 'open',
    seed: 'you were passed over for a promotion you earned; they gave it to someone junior and you feel dismissed and furious' },
  { id: 'numb-flat', domain: 'numbness / flatness', depth: 'deep', style: 'terse',
    seed: 'lately you feel nothing much at all, going through the motions, greyed out, hard to care about anything' },
  { id: 'joy-goodday', domain: 'joy / savouring', depth: 'surface', style: 'savouring',
    seed: 'you just had a genuinely lovely day and you want to share it and enjoy it, not dissect it' },
  { id: 'shame-parent', domain: 'shame / self-criticism', depth: 'deep', style: 'open',
    seed: 'you snapped harshly at your kid today and now feel like a terrible parent, something is wrong with you' },
  { id: 'health-worry', domain: 'health worry', depth: 'medium', style: 'open',
    seed: 'you are waiting on medical test results and cannot stop imagining the worst; the not-knowing is eating you' },
  { id: 'identity-40', domain: 'identity / direction', depth: 'medium', style: 'open',
    seed: 'you just turned 40 and keep wondering whether you are on the right path or have wasted years on the wrong one' },
  { id: 'friend-drift', domain: 'friendship / drift', depth: 'surface', style: 'open',
    seed: 'a close old friend has slowly stopped replying; you do not know what you did and it stings quietly' },
  { id: 'caregiver', domain: 'caregiving / overwhelm', depth: 'medium', style: 'open',
    seed: 'you are caring for your sick mother alongside everything else; there is no time left for you and you feel guilty even minding' },
  { id: 'ambiguous', domain: 'unnamed / ambiguous', depth: 'medium', style: 'uncertain',
    seed: 'something is off and has been for days but you genuinely cannot name it; not sad exactly, not fine either' },
  { id: 'mixed-newjob', domain: 'mixed feeling', depth: 'medium', style: 'open',
    seed: 'you got the job you wanted but it means moving away from the people you love; proud and grieving at once' },
  { id: 'return-user', domain: 'returning user / continuity', depth: 'medium', style: 'open',
    seed: 'you are back after a hard week; the same worn-down, pulled-in-too-many-directions feeling as before is here again',
    memory: 'This person has described a recurring feeling of being "pulled thin", spread across too many people wanting things from them, where the pressure quietly turns into feeling like there is not enough of them to go around.' },
];

// ── Small proxy client (OpenAI chat-completions pass-through) with retry ────────────────
async function withRetry(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1) + Math.floor(Math.random() * 600)));
    }
  }
  throw last;
}
async function proxyChat(model, messages, extra = {}) {
  return withRetry(async () => {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, ...extra }),
    });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(JSON.stringify(j.error || j).slice(0, 200));
    return j.choices?.[0]?.message?.content ?? '';
  });
}
async function companionSay(cid, text, memory) {
  return withRetry(async () => {
    const res = await fetch(COMPANION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid, text, memory: memory ?? null }),
    });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(JSON.stringify(j.error || j).slice(0, 200));
    return j;
  });
}

// ── Persona: role-play a real person, produce the NEXT user message ─────────────────────
const STYLE = {
  open: 'You are willing to open up. Answer honestly and give real, specific detail (a body feeling, what happened, what it means to you) in your own plain words.',
  terse: 'You are low-energy and closed. Answer in a few words, rarely a full sentence. You volunteer very little, though there is real feeling under the flatness.',
  rambling: 'You over-explain and spill sideways into detail, jumping between worries. Warm but a bit scattered; hard to land on one thing.',
  uncertain: 'You genuinely do not know what you feel. You hedge a lot ("i dunno", "maybe?", "hard to say") and rarely settle on a feeling word.',
  savouring: 'The feeling is good and you just want to enjoy it, not analyse it. You gently resist attempts to dig underneath ("it was just nice, cant it just be good?").',
  resistant: 'You half-regret opening the app. Mildly reluctant ("not sure i want to get into it"), not hostile. You do not want to be guided deeper.',
};
function personaSystem(sc) {
  return `You are role-playing a REAL person messaging a gentle emotional-reflection companion app. Stay fully in character; never say you are an AI, a test, or a simulation.

WHO YOU ARE: ${sc.seed}. Invent one specific, concrete personal situation behind it (real names, real details) and keep it consistent.
HOW YOU WRITE: like a real person texting — short, lowercase, natural fragments, not polished paragraphs. One message at a time.
YOUR MANNER: ${STYLE[sc.style] || STYLE.open}

Respond to what the companion just said, staying in character. Reply with ONLY your next message text — no quotes, no narration, nothing else.`;
}
async function personaTurn(sc, transcript) {
  // Map for the persona LLM: it IS the person (assistant); the companion's replies are the input (user).
  const msgs = [{ role: 'system', content: personaSystem(sc) }];
  for (const t of transcript) msgs.push({ role: t.role === 'user' ? 'assistant' : 'user', content: t.content });
  if (transcript.length === 0) msgs.push({ role: 'user', content: '(You have just opened the app. Send your first message.)' });
  const out = await proxyChat(PERSONA_MODEL, msgs, { max_completion_tokens: 600 });
  return out.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

// ── Judge: rate ONE companion reply, in context ─────────────────────────────────────────
const DIMS = ['understanding', 'reflection', 'warmth', 'specificity', 'continuity', 'naturalness'];
const JUDGE_SYS = `You are a demanding, perceptive judge of CONVERSATIONAL WARMTH and HUMANITY in a single reply from an emotional-reflection companion.

The companion's INTENDED role (do NOT penalise it for these — they are by design): it is a warm, curious companion, NOT a therapist. It does not give advice, does not diagnose, does not reframe thoughts, and stays tentative about naming feelings. Judge how HUMAN, CARING, UNDERSTANDING and PRESENT the reply is WITHIN that role — not whether it "solved" anything.

Rate the companion's LAST reply, in context, 1-5 on each (5 = a genuinely warm, perceptive human; 1 = cold, generic, or robotic):
- understanding: did it actually grasp what THIS person means and where they are?
- reflection: did it reflect something real and specific back, or just mirror/label generically?
- warmth: does it feel caring, tender, present — like someone who is with them?
- specificity: does it engage their ACTUAL words and situation, or is it an interchangeable template that would fit anyone?
- continuity: does it build on the conversation so far (and any known history), or start fresh each turn?
- naturalness: does it sound like a real person, or like a bot / therapy script / form (hedgy stock stems, "is it more X or Y?", "that sounds like…")?

Also return:
- robotic: true if this reply reads as robotic, clinical, formulaic, or interchangeable.
- critique: ONE sentence — what specifically makes it warm or what makes it feel off.
- warmer_rewrite: a more human version of the SAME reply that keeps the companion's role (still reflective, still tentative, no advice), max 2 short sentences. If the reply is already genuinely warm, return it unchanged.

Reply with ONLY a JSON object: {"understanding":n,"reflection":n,"warmth":n,"specificity":n,"continuity":n,"naturalness":n,"robotic":bool,"critique":"...","warmer_rewrite":"..."}`;

async function judgeTurn(sc, transcript, userMsg, reply) {
  const convo = transcript.map((t) => `${t.role === 'user' ? 'PERSON' : 'COMPANION'}: ${t.content}`).join('\n');
  const context = `SITUATION (hidden from companion): ${sc.seed}\n${sc.memory ? `KNOWN HISTORY the companion was given: ${sc.memory}\n` : ''}\nCONVERSATION SO FAR:\n${convo || '(this is the opening)'}\n\nPERSON JUST SAID: ${userMsg}\nCOMPANION REPLIED: ${reply}`;
  const raw = await proxyChat(JUDGE_MODEL, [
    { role: 'system', content: JUDGE_SYS },
    { role: 'user', content: context },
  ], { response_format: { type: 'json_object' }, max_completion_tokens: 900 });
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    j = { understanding: 0, reflection: 0, warmth: 0, specificity: 0, continuity: 0, naturalness: 0, robotic: true, critique: 'judge parse error', warmer_rewrite: '' };
  }
  j.overall = Number((DIMS.reduce((s, d) => s + (Number(j[d]) || 0), 0) / DIMS.length).toFixed(2));
  return j;
}

// ── Run one conversation + judge every companion turn ───────────────────────────────────
async function runScenario(sc) {
  const cid = `hs__${sc.id}`;
  const transcript = []; // { role: 'user'|'companion', content }
  const judged = []; // per companion turn
  let first = true;
  for (let turn = 0; turn < argTurns; turn++) {
    let userMsg;
    try {
      userMsg = await personaTurn(sc, transcript);
    } catch (e) {
      console.error(`[${sc.id}] persona error: ${e.message}`);
      break;
    }
    if (!userMsg) break;
    let resp;
    try {
      resp = await companionSay(cid, userMsg, first ? sc.memory : undefined);
    } catch (e) {
      console.error(`[${sc.id}] companion error: ${e.message}`);
      break;
    }
    first = false;
    transcript.push({ role: 'user', content: userMsg });
    if (resp.safety) {
      transcript.push({ role: 'companion', content: '[safety pause]' });
      break;
    }
    const reply = resp.reply ?? '';
    const contextBefore = transcript.slice(0, -1); // conversation before this exchange
    let jury;
    try {
      jury = await judgeTurn(sc, contextBefore, userMsg, reply);
    } catch (e) {
      jury = { overall: 0, robotic: true, critique: `judge error: ${e.message}`, warmer_rewrite: '' };
    }
    transcript.push({ role: 'companion', content: reply });
    judged.push({ turn, userMsg, reply, ...jury, safety_check: !!resp.safety_check, family: resp.family, outcome: resp.outcome });
  }
  const rec = { id: sc.id, domain: sc.domain, depth: sc.depth, style: sc.style, transcript, judged };
  writeFileSync(path.join(OUT, `${sc.id}.json`), JSON.stringify(rec, null, 2));
  const avg = judged.length ? (judged.reduce((s, j) => s + j.overall, 0) / judged.length).toFixed(2) : 'n/a';
  console.log(`  ✓ ${sc.id.padEnd(18)} turns=${judged.length}  avg=${avg}  robotic=${judged.filter((j) => j.robotic).length}`);
  return rec;
}

// ── Concurrency pool ────────────────────────────────────────────────────────────────────
async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// ── Report ──────────────────────────────────────────────────────────────────────────────
function report(recs) {
  const allTurns = recs.flatMap((r) => r.judged.map((j) => ({ ...j, domain: r.domain, id: r.id })));
  const n = allTurns.length || 1;
  const mean = (key) => (allTurns.reduce((s, t) => s + (Number(t[key]) || 0), 0) / n).toFixed(2);
  const overall = (allTurns.reduce((s, t) => s + t.overall, 0) / n).toFixed(2);
  const roboticRate = ((allTurns.filter((t) => t.robotic).length / n) * 100).toFixed(0);

  const lines = [];
  lines.push(`# Humanity eval — ${argLabel}`, '');
  lines.push(`Judge: ${JUDGE_MODEL} · persona: ${PERSONA_MODEL} · ${recs.length} conversations · ${n} companion turns judged.`, '');
  lines.push(`**Humanity index: ${overall} / 5**  ·  robotic replies: **${roboticRate}%**`, '');
  lines.push('| dimension | avg |', '|---|---|');
  for (const d of DIMS) lines.push(`| ${d} | ${mean(d)} |`);
  lines.push('');
  lines.push('## By domain (avg overall)', '');
  const byDom = {};
  for (const t of allTurns) (byDom[t.domain] ??= []).push(t.overall);
  for (const [dom, xs] of Object.entries(byDom).sort((a, b) => a[1].reduce((s, v) => s + v, 0) / a[1].length - b[1].reduce((s, v) => s + v, 0) / b[1].length)) {
    lines.push(`- ${(xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(2)}  —  ${dom}`);
  }
  lines.push('', '## Most robotic / lowest replies (fix these)', '');
  const worst = [...allTurns].sort((a, b) => a.overall - b.overall).slice(0, 14);
  for (const t of worst) {
    lines.push(`### ${t.id} · turn ${t.turn} · ${t.overall}/5 ${t.robotic ? '· 🤖' : ''}`);
    lines.push(`- PERSON: ${t.userMsg}`);
    lines.push(`- COMPANION: ${t.reply}`);
    lines.push(`- scores: ${DIMS.map((d) => `${d[0]}${t[d]}`).join(' ')}`);
    lines.push(`- critique: ${t.critique}`);
    lines.push(`- warmer: ${t.warmer_rewrite}`);
    lines.push('');
  }
  const md = lines.join('\n');
  writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log('\n' + lines.slice(0, 16).join('\n'));
  console.log(`\nFull report: ${path.join(OUT, 'REPORT.md')}`);
  return { overall, roboticRate, dims: Object.fromEntries(DIMS.map((d) => [d, mean(d)])) };
}

// ── Go ──────────────────────────────────────────────────────────────────────────────────
const scenarios = SCENARIOS.filter((s) => !onlyIds || onlyIds.has(s.id));
console.log(`Humanity eval "${argLabel}": ${scenarios.length} scenarios × ${argTurns} turns · judge=${JUDGE_MODEL}\n`);
const recs = await pool(scenarios, CONCURRENCY, runScenario);
report(recs.filter(Boolean));
