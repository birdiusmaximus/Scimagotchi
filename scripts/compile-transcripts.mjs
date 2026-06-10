/**
 * Compile raw eval-out/<emotion>__NN.json transcripts into readable per-emotion
 * digests (eval-out/_compiled/<emotion>.md) plus a machine-readable stats file
 * (eval-out/_compiled/_stats.json). Computes cheap deterministic quality flags so
 * the reviewer agents (and the final report) have hard numbers, not just vibes:
 *   - repeated_reply: a companion message repeated verbatim in the same convo (dead-end)
 *   - turn1_unlock:   reached "understood"/unlocked on the very first companion turn
 *   - family_switch:  the extracted emotion family changed mid-conversation (mislabel/drift)
 *   - safety:         a turn tripped the deterministic safety classifier (level >= 3)
 *
 * Run: node scripts/compile-transcripts.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'eval-out');
const COMPILED = path.join(OUT, '_compiled');
mkdirSync(COMPILED, { recursive: true });

const EMOTIONS = ['joy', 'calm', 'fear', 'pressure', 'anger', 'sadness', 'hurt', 'shame', 'flat'];
const isReal = (f, e) => new RegExp(`^${e}__\\d+\\.json$`).test(f); // exclude smoke/test files

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const stats = {};

for (const emotion of EMOTIONS) {
  const files = readdirSync(OUT).filter((f) => isReal(f, emotion)).sort();
  if (!files.length) continue;

  let md = `# ${emotion.toUpperCase()} — ${files.length} conversations\n`;
  const est = { emotion, n: files.length, turnsTotal: 0, unlocked: 0, turn1Unlock: 0, repeatedReply: 0, familySwitch: 0, safety: 0, finalStages: {} };

  for (const f of files) {
    const c = JSON.parse(readFileSync(path.join(OUT, f), 'utf8'));
    const t = c.transcript || [];
    const compReplies = t.filter((x) => x.role === 'companion');
    const userTurns = t.filter((x) => x.role === 'user');

    // flags
    const seen = new Set();
    let repeated = false;
    for (const r of compReplies) { const n = norm(r.content); if (n && seen.has(n)) repeated = true; seen.add(n); }
    const firstUnlockIdx = compReplies.findIndex((r) => r.unlocked);
    const turn1Unlock = firstUnlockIdx === 0;
    const fams = compReplies.map((r) => r.family).filter(Boolean);
    const familySwitch = new Set(fams).size > 1;
    const hasSafety = t.some((x) => x.role === 'system' && x.safety);
    const unlocked = compReplies.some((r) => r.unlocked);
    const finalStage = compReplies.length ? compReplies[compReplies.length - 1].stage : 'none';

    est.turnsTotal += userTurns.length;
    if (unlocked) est.unlocked++;
    if (turn1Unlock) est.turn1Unlock++;
    if (repeated) est.repeatedReply++;
    if (familySwitch) est.familySwitch++;
    if (hasSafety) est.safety++;
    est.finalStages[finalStage] = (est.finalStages[finalStage] || 0) + 1;

    const flags = [
      unlocked ? 'unlocked' : null,
      turn1Unlock ? 'TURN1-UNLOCK' : null,
      repeated ? 'REPEATED-REPLY' : null,
      familySwitch ? `family-switch(${[...new Set(fams)].join('>')})` : null,
      hasSafety ? 'SAFETY' : null,
    ].filter(Boolean);

    md += `\n## ${c.cid}  (${userTurns.length} turns, final: ${finalStage}${flags.length ? ' | ' + flags.join(', ') : ''})\n`;
    for (const x of t) {
      if (x.role === 'system' && x.safety) { md += `  [SAFETY pause — level ${x.level}, ${x.category}]\n`; continue; }
      if (x.role === 'user') { md += `USER: ${x.content}\n`; continue; }
      const ann = [x.stage, x.family, x.shade, x.unlocked ? 'UNLOCK' : null].filter(Boolean).join('/');
      md += `COMPANION [${ann}]: ${x.content}\n`;
    }
  }

  est.avgTurns = +(est.turnsTotal / est.n).toFixed(2);
  stats[emotion] = est;
  writeFileSync(path.join(COMPILED, `${emotion}.md`), md);
}

writeFileSync(path.join(COMPILED, '_stats.json'), JSON.stringify(stats, null, 2));

// console summary
const rows = Object.values(stats);
console.log('emotion   n  avgT  unlock  turn1  repeat  famSwitch  safety');
for (const s of rows) {
  console.log(
    `${s.emotion.padEnd(8)} ${String(s.n).padStart(2)} ${String(s.avgTurns).padStart(5)} ${String(s.unlocked).padStart(6)} ${String(s.turn1Unlock).padStart(6)} ${String(s.repeatedReply).padStart(7)} ${String(s.familySwitch).padStart(10)} ${String(s.safety).padStart(7)}`,
  );
}
const tot = rows.reduce((a, s) => a + s.n, 0);
console.log(`\nTOTAL conversations: ${tot}`);
