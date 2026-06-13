/**
 * Read-back for the emotion-unlock simulation. Reads the transcripts the companion
 * server already saved (eval-out/sim__<emotion>.json) — the deterministic record of
 * each turn's unlock + stage — and writes a human-readable report: per emotion, did
 * it unlock, on which turn, how deep it went, and the full conversation.
 *
 * Run:  node eval/unlock-sim-report.mjs
 * Out:  eval-out/UNLOCK_SIM_REPORT.md
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'eval-out');

// The durable progression ladder (progressionEngine.PROGRESS_RANK), for "how deep".
const RANK = { unseen: 0, noticed: 1, named: 2, first_shape: 3, rooted: 4, distinguished: 5, returning: 6, deepened: 7 };
const deeper = (a, b) => ((RANK[b] ?? -1) > (RANK[a] ?? -1) ? b : a);

const EMOTIONS = ['joy', 'calm', 'fear', 'pressure', 'anger', 'sadness', 'hurt', 'shame', 'flat', 'mixed'];

/** Walk one transcript into a per-turn timeline + summary. */
function analyse(file) {
  const t = JSON.parse(readFileSync(file, 'utf8'));
  const turns = []; // one entry per user→companion exchange
  let userCount = 0;
  let pendingUser = null;
  for (const m of t.transcript ?? []) {
    if (m.role === 'user') {
      userCount += 1;
      pendingUser = { n: userCount, text: m.content, intent: m.intent ?? null };
    } else if (m.role === 'companion') {
      turns.push({
        n: pendingUser?.n ?? userCount,
        userText: pendingUser?.text ?? '',
        intent: pendingUser?.intent ?? null,
        reply: m.content,
        unlockStage: m.stage ?? null, // in-conversation walk: noticed/named/shaped/understood/deepened
        progression: m.stage_after ?? null, // durable ladder
        advanced: m.stage_advanced ?? false,
        suppressed: m.suppressed ?? false,
        unlocked: m.unlocked ?? false,
        family: m.family ?? null,
        shade: m.shade ?? null,
        strandStages: m.strand_stages ?? null,
      });
      pendingUser = null;
    } else if (m.safety) {
      turns.push({ n: userCount, safety: true });
    }
  }
  const real = turns.filter((x) => !x.safety);
  const firstUnlock = real.find((x) => x.unlocked);
  const deepest = real.reduce((d, x) => deeper(d, x.progression ?? 'unseen'), 'unseen');
  // The strands this conversation carried (the last turn's cumulative map).
  const strands = [...real].reverse().find((x) => x.strandStages && Object.keys(x.strandStages).length)?.strandStages ?? {};
  return {
    cid: t.cid,
    totalTurns: userCount,
    unlocked: !!firstUnlock,
    unlockedOnTurn: firstUnlock ? firstUnlock.n : null,
    deepestStage: deepest,
    family: real.find((x) => x.family)?.family ?? null,
    strands,
    turns,
  };
}

const out = [];
out.push('# Emotion-unlock simulation — read-back', '');
out.push('A willing simulated user discussed each feeling and kept going deeper until the companion unlocked it. Companion model: gpt-5.4-mini. This only observed the engine; nothing was changed.', '');

const rows = [];
for (const emo of EMOTIONS) {
  const file = path.join(OUT, `sim__${emo}.json`);
  if (!existsSync(file)) continue;
  rows.push({ emo, ...analyse(file) });
}

const strandList = (s) => Object.entries(s || {}).filter(([, st]) => st && st !== 'unseen').map(([f, st]) => `${f}:${st}`);

// ── Summary table ──
out.push('## Summary', '');
out.push('| Emotion | Unlocked? | On turn | Deepest stage | Total turns | Strands tracked |', '|---|---|---|---|---|---|');
for (const r of rows) {
  out.push(`| ${r.emo} | ${r.unlocked ? '✅' : '—'} | ${r.unlockedOnTurn ?? '—'} | ${r.deepestStage} | ${r.totalTurns} | ${strandList(r.strands).join(', ') || '—'} |`);
}
const unlockedN = rows.filter((r) => r.unlocked).length;
const reached = (stage) => rows.filter((r) => (RANK[r.deepestStage] ?? 0) >= RANK[stage]).length;
out.push('', `**${unlockedN}/${rows.length} unlocked.** Reached first_shape+: ${reached('first_shape')} · rooted+: ${reached('rooted')} · distinguished: ${reached('distinguished')}.`);
out.push('_(In a single conversation the deepest reachable stage is `distinguished`; `returning`/`deepened` need the feeling to come back in a later conversation.)_', '');

// ── Per-emotion detail + transcripts ──
out.push('## Conversations', '');
for (const r of rows) {
  out.push(`### ${r.emo}${r.family && r.family !== r.emo ? ` (engine read: ${r.family})` : ''} — ${r.unlocked ? `unlocked on turn ${r.unlockedOnTurn}` : 'did not unlock'} · deepest ${r.deepestStage} · ${r.totalTurns} turns`, '');
  // compact stage timeline: turns where the progression advanced
  const moves = r.turns.filter((x) => !x.safety && x.advanced).map((x) => `t${x.n}→${x.progression}`);
  if (moves.length) out.push(`> progression: ${moves.join('  ')}`, '');
  const strands = strandList(r.strands);
  if (strands.length) out.push(`> strands carried: ${strands.join(' · ')}`, '');
  for (const x of r.turns) {
    if (x.safety) { out.push('_[safety pause]_', ''); continue; }
    const tag = x.intent ? ' _(tap: stay with it)_' : '';
    out.push(`**U${x.n}:**${tag} ${x.userText}`);
    const ann = [x.unlocked ? '🔓 unlocked' : null, x.progression ? `stage ${x.progression}` : null, x.shade ? `shade ${x.shade}` : null]
      .filter(Boolean)
      .join(' · ');
    out.push(`**Companion:** ${x.reply}${ann ? `  \n_[${ann}]_` : ''}`, '');
  }
  out.push('---', '');
}

const outPath = path.join(OUT, 'UNLOCK_SIM_REPORT.md');
writeFileSync(outPath, out.join('\n'));
console.log(`[unlock-sim] wrote ${path.relative(ROOT, outPath)} (${rows.length} emotions)`);
console.log(`unlocked ${unlockedN}/${rows.length} · ` + rows.map((r) => `${r.emo}:${r.unlocked ? r.unlockedOnTurn : 'x'}/${r.deepestStage}`).join(' '));
