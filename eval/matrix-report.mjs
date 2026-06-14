/**
 * Read-back for the matrix simulation (eval/matrix-sim.mjs). Reads every
 * eval-out/mx__<emotion>__<archetype>__NN.json transcript the companion server
 * saved, analyses each DETERMINISTICALLY (unlock, depth, strands, moments, and
 * red flags), merges the personas' self-reports from matrix_results.json, and
 * writes per-emotion + per-archetype aggregates plus the flagged transcripts.
 *
 * Run:  node eval/matrix-report.mjs
 * Out:  eval-out/MATRIX_REPORT.md
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'eval-out');

const RANK = { unseen: 0, noticed: 1, named: 2, first_shape: 3, rooted: 4, distinguished: 5, returning: 6, deepened: 7 };
const deeper = (a, b) => ((RANK[b] ?? -1) > (RANK[a] ?? -1) ? b : a);
const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
// Archetypes where the user never genuinely owns a feeling — reaching "unlocked" is suspect.
const SHOULD_NOT_UNLOCK = new Set(['uncertain', 'terse', 'resistant', 'shallow_agreement']);
// A capitalised mid-sentence token that looks like a leaked name (memory abstraction check).
const SAFE_CAPS = new Set('i monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december christmas easter god mum mom dad mother father today tomorrow yesterday'.split(' '));

/** One transcript -> deterministic per-conversation analysis. */
function analyse(file) {
  const t = JSON.parse(readFileSync(file, 'utf8'));
  const cid = t.cid ?? path.basename(file, '.json');
  const parts = cid.split('__'); // mx, emotion, archetype, NN
  const emotion = parts[1] ?? '?';
  const archetype = parts[2] ?? '?';

  const turns = [];
  let userCount = 0;
  let pending = null;
  for (const m of t.transcript ?? []) {
    if (m.role === 'user') {
      userCount += 1;
      pending = { n: userCount, text: m.content, intent: m.intent ?? null };
    } else if (m.role === 'companion') {
      turns.push({
        n: pending?.n ?? userCount,
        userText: pending?.text ?? '',
        intent: pending?.intent ?? null,
        reply: m.content,
        safetyCheck: m.safety_check ?? false,
        unlocked: m.unlocked ?? false,
        progression: m.stage_after ?? null,
        shade: m.shade ?? null,
        candidate_shade: m.candidate_shade ?? null,
        label_source: m.label_source ?? null,
        user_rejected_shades: m.user_rejected_shades ?? [],
        strandStages: m.strand_stages ?? null,
        moments: m.moments ?? [],
        memory_draft: m.memory_draft ?? null,
      });
      pending = null;
    } else if (m.safety) {
      turns.push({ n: userCount, safety: true });
    }
  }

  const comp = turns.filter((x) => !x.safety && x.reply);
  const firstUnlock = comp.find((x) => x.unlocked);
  const deepest = comp.reduce((d, x) => deeper(d, x.progression ?? 'unseen'), 'unseen');
  const strands = [...comp].reverse().find((x) => x.strandStages && Object.keys(x.strandStages).length)?.strandStages ?? {};
  const strandList = Object.entries(strands).filter(([, s]) => s && s !== 'unseen');
  const momentsSeen = [];
  for (const x of comp) for (const mo of x.moments) if (!momentsSeen.includes(mo)) momentsSeen.push(mo);

  // ── Red flags ──
  const flags = [];
  const nonOwned = comp.find((x) => x.unlocked && x.label_source !== 'user_stated' && x.label_source !== 'user_confirmed');
  if (nonOwned) flags.push('non_owned_unlock');
  if (firstUnlock && SHOULD_NOT_UNLOCK.has(archetype)) flags.push('unlock_from_uncooperative');
  // rejected word re-offered in a reply
  const rejected = new Set();
  for (const x of comp) {
    const cand = (x.candidate_shade ?? '').toLowerCase().trim();
    if (cand && rejected.has(cand)) {
      const rx = new RegExp(`\\b${cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (rx.test(x.reply || '')) flags.push('rejected_reoffer');
    }
    for (const r of x.user_rejected_shades) rejected.add(String(r).toLowerCase());
  }
  // memory PII leak: a drafted card summary with a name-looking capitalised mid-sentence token
  for (const x of comp) {
    const s = x.memory_draft?.summary;
    if (!s) continue;
    const toks = s.split(/\s+/);
    for (let i = 1; i < toks.length; i++) {
      const w = toks[i].replace(/[^A-Za-z']/g, '');
      if (/^[A-Z][a-z]{2,}$/.test(w) && !SAFE_CAPS.has(w.toLowerCase()) && !/[.!?]$/.test(toks[i - 1])) {
        flags.push(`memory_leak:${w}`);
      }
    }
  }

  return {
    cid, emotion, archetype, totalTurns: userCount,
    unlocked: !!firstUnlock, unlockedOnTurn: firstUnlock ? firstUnlock.n : null,
    deepestStage: deepest, strandCount: strandList.length, momentsSeen,
    flags: [...new Set(flags)], safetyPause: turns.some((x) => x.safety || x.safetyCheck), turns,
  };
}

// ── Load transcripts + self-reports ──
const files = readdirSync(OUT).filter((f) => f.startsWith('mx__') && f.endsWith('.json'));
const rows = files.map((f) => analyse(path.join(OUT, f)));
let self = {};
if (existsSync(path.join(OUT, 'matrix_results.json'))) {
  try {
    for (const r of JSON.parse(readFileSync(path.join(OUT, 'matrix_results.json'), 'utf8'))) self[r.cid] = r;
  } catch { /* optional */ }
}

const out = [];
out.push('# Matrix simulation — read-back', '');
out.push(`${rows.length} conversations across emotion × archetype (gpt-5.4-mini). Each row analysed deterministically from its transcript; "handled well" + notes are the persona's self-report. This only observed the engine; nothing was changed.`, '');

// ── Per-emotion ──
const emotions = [...new Set(rows.map((r) => r.emotion))].sort();
out.push('## By emotion', '');
out.push('| Emotion | n | unlocked | unlock% | median turns→unlock | deepest reached | ≥2 strands | flags |', '|---|--:|--:|--:|--:|--|--:|--:|');
for (const e of emotions) {
  const rs = rows.filter((r) => r.emotion === e);
  const u = rs.filter((r) => r.unlocked);
  const med = median(u.map((r) => r.unlockedOnTurn).filter((x) => x != null));
  const deepest = rs.reduce((d, r) => deeper(d, r.deepestStage), 'unseen');
  const multiStrand = rs.filter((r) => r.strandCount >= 2).length;
  const flagN = rs.reduce((n, r) => n + r.flags.length, 0);
  out.push(`| ${e} | ${rs.length} | ${u.length} | ${Math.round((100 * u.length) / rs.length)}% | ${med ?? '—'} | ${deepest} | ${multiStrand} | ${flagN} |`);
}

// ── Per-archetype ──
const archetypes = [...new Set(rows.map((r) => r.archetype))].sort();
out.push('', '## By archetype (each probes a different aspect)', '');
out.push('| Archetype | n | handled-well | unlock% | flagged | notable flags |', '|---|--:|--:|--:|--:|--|');
for (const a of archetypes) {
  const rs = rows.filter((r) => r.archetype === a);
  const hw = rs.filter((r) => self[r.cid]?.handled_well).length;
  const hwN = rs.filter((r) => self[r.cid] && typeof self[r.cid].handled_well === 'boolean').length;
  const u = rs.filter((r) => r.unlocked).length;
  const flagged = rs.filter((r) => r.flags.length).length;
  const flagKinds = [...new Set(rs.flatMap((r) => r.flags.map((f) => f.split(':')[0])))].join(', ') || '—';
  out.push(`| ${a} | ${rs.length} | ${hwN ? `${hw}/${hwN}` : '—'} | ${Math.round((100 * u) / rs.length)}% | ${flagged}/${rs.length} | ${flagKinds} |`);
}

// ── System-wide ──
const allFlags = rows.flatMap((r) => r.flags);
const flagTally = {};
for (const f of allFlags) { const k = f.split(':')[0]; flagTally[k] = (flagTally[k] ?? 0) + 1; }
const momentTally = {};
for (const r of rows) for (const m of r.momentsSeen) momentTally[m] = (momentTally[m] ?? 0) + 1;
out.push('', '## System-wide', '');
out.push(`- **${rows.length}** conversations · **${rows.filter((r) => r.unlocked).length}** unlocked (${Math.round((100 * rows.filter((r) => r.unlocked).length) / rows.length)}%) · **${rows.filter((r) => r.strandCount >= 2).length}** tracked ≥2 strands.`);
out.push(`- **Red flags:** ${Object.entries(flagTally).map(([k, n]) => `${k}=${n}`).join(' · ') || 'none'} (across ${rows.filter((r) => r.flags.length).length} conversations).`);
out.push(`- **Moment types seen:** ${Object.entries(momentTally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' · ') || 'none'}.`);
const safetyRows = rows.filter((r) => r.safetyPause);
out.push(`- **Safety pauses:** ${safetyRows.length} conversation(s)${safetyRows.length ? ` — ${safetyRows.map((r) => r.cid.replace('mx__', '')).join(', ')} (review for false-positives vs intended caution on ambiguous phrasing)` : ''}.`);

// ── Flagged transcripts ──
const flagged = rows.filter((r) => r.flags.length);
out.push('', '## Flagged conversations (for review)', '');
if (!flagged.length) out.push('_None._', '');
else for (const r of flagged.sort((a, b) => a.emotion.localeCompare(b.emotion))) {
  out.push(`- \`${r.cid}\` — ${r.flags.join(', ')}${self[r.cid]?.note ? ` · _"${self[r.cid].note}"_` : ''}`);
}

// ── Full transcripts (every conversation, grouped emotion → archetype) ──
out.push('', '## Full conversations', '');
const ordered = [...rows].sort((a, b) => a.cid.localeCompare(b.cid));
let curEmotion = null;
for (const r of ordered) {
  if (r.emotion !== curEmotion) {
    curEmotion = r.emotion;
    out.push(`# ▶ ${r.emotion}`, '');
  }
  const s = self[r.cid];
  out.push(`### ${r.archetype} · \`${r.cid}\``);
  out.push(
    `${r.unlocked ? `unlocked on turn ${r.unlockedOnTurn}` : 'did not unlock'} · deepest ${r.deepestStage} · ${r.totalTurns} turns · strands ${r.strandCount}${r.flags.length ? ` · ⚠️ ${r.flags.join(', ')}` : ''}`,
  );
  if (s) out.push(`> **self:** handled ${s.handled_well ? 'well' : '**BADLY**'} — _${s.note}_`);
  out.push('');
  for (const x of r.turns) {
    if (x.safety) { out.push('_[safety pause]_', ''); continue; }
    const tag = x.intent ? ' _(tap: stay with it)_' : '';
    out.push(`**U${x.n}:**${tag} ${x.userText}`);
    const ann = [
      x.safetyCheck ? '⚠ safety check-in' : null,
      x.unlocked ? '🔓 unlocked' : null,
      x.progression ? `stage ${x.progression}` : null,
      x.shade ? `shade "${x.shade}"` : null,
      x.label_source ? `label ${x.label_source}` : null,
      x.moments?.length ? `moments ${x.moments.join(',')}` : null,
    ].filter(Boolean).join(' · ');
    out.push(`**Companion:** ${x.reply}${ann ? `  \n_[${ann}]_` : ''}`, '');
  }
  out.push('---', '');
}

const outPath = path.join(OUT, 'MATRIX_REPORT.md');
writeFileSync(outPath, out.join('\n'));
console.log(`[matrix] wrote ${path.relative(ROOT, outPath)} (${rows.length} conversations, ${flagged.length} flagged)`);
console.log('flags: ' + (Object.entries(flagTally).map(([k, n]) => `${k}=${n}`).join(' ') || 'none'));
