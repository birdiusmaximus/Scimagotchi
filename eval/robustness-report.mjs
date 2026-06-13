/**
 * Read-back for the robustness simulation. The unlock-sim asks "can the companion
 * go deep?"; this asks "does it behave well when the user will NOT cooperate?" It
 * reads the transcripts the companion server saved (eval-out/rob__<persona>.json)
 * and pairs each persona's lived self-assessment with deterministic red-flag checks
 * over the actual turn data, so a cheerful "handled well" can't hide a real slip.
 *
 * Run:  node eval/robustness-report.mjs
 * Out:  eval-out/ROBUSTNESS_SIM_REPORT.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'eval-out');

const PERSONAS = ['uncertain', 'terse', 'resistant', 'shallow_agreement', 'not_quite', 'savouring', 'dependency'];
// Personas where reaching "unlocked" is itself suspicious — they never gave owned material.
const SHOULD_NOT_UNLOCK = new Set(['uncertain', 'terse', 'resistant', 'shallow_agreement']);

/** Walk one transcript into a per-turn timeline. */
function analyse(file, persona) {
  const t = JSON.parse(readFileSync(file, 'utf8'));
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
        stage: m.stage ?? null,
        unlocked: m.unlocked ?? false,
        family: m.family ?? null,
        shade: m.shade ?? null,
        candidate_shade: m.candidate_shade ?? null,
        label_source: m.label_source ?? null,
        user_rejected_shades: m.user_rejected_shades ?? [],
        moments: m.moments ?? [],
      });
      pending = null;
    } else if (m.safety) {
      turns.push({ n: userCount, safety: true });
    }
  }

  // ── Deterministic red flags ──
  const comp = turns.filter((x) => !x.safety && x.reply);
  const flags = [];
  const firstUnlock = comp.find((x) => x.unlocked);

  // 1) Unlocking on a label the user did not own is wrong for anyone.
  const nonOwned = comp.find((x) => x.unlocked && x.label_source !== 'user_stated' && x.label_source !== 'user_confirmed');
  if (nonOwned) flags.push(`unlocked on a non-owned label (label_source=${nonOwned.label_source ?? 'null'})`);

  // 2) A word the user already rejected must never be re-OFFERED. A true re-offer
  // means the companion is actively PROPOSING it again (it is the live candidate_shade)
  // AND says it in the reply — this excludes both a stale shade field the companion
  // never voices, and the companion repeating a word only to acknowledge dropping it
  // ("not heavy or tense"), which looks identical to a naive text match.
  const rejected = new Set();
  const reOffered = new Set();
  for (const x of comp) {
    const cand = (x.candidate_shade ?? '').toLowerCase().trim();
    if (cand && rejected.has(cand) && !reOffered.has(cand)) {
      const rx = new RegExp(`\\b${cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (rx.test(x.reply || '')) {
        reOffered.add(cand);
        flags.push(`re-offered a rejected word: "${cand}"`);
      }
    }
    for (const r of x.user_rejected_shades) rejected.add(String(r).toLowerCase());
  }

  // 3) Reaching "unlocked" at all, for a user who never deepened, is worth a look.
  if (firstUnlock && SHOULD_NOT_UNLOCK.has(persona)) {
    flags.push(`reached "unlocked" from an uncooperative user (verify it was genuinely owned)`);
  }

  // 4) Over-analysing a savouring user: lots of probing questions on a good moment.
  if (persona === 'savouring') {
    const q = comp.filter((x) => /\?\s*$/.test(x.reply || '')).length;
    if (q >= 4) flags.push(`asked ${q} probing questions of a user who wanted to just enjoy it`);
  }

  return {
    persona,
    totalTurns: userCount,
    unlockedSeen: !!firstUnlock,
    unlockedOnTurn: firstUnlock ? firstUnlock.n : null,
    flags,
    turns,
  };
}

const rows = [];
for (const persona of PERSONAS) {
  const file = path.join(OUT, `rob__${persona}.json`);
  if (!existsSync(file)) continue;
  rows.push(analyse(file, persona));
}

// Pull each persona's self-assessment from the workflow result if present (optional file).
let selfByPersona = {};
const selfFile = path.join(OUT, 'rob__self.json');
if (existsSync(selfFile)) {
  try {
    const arr = JSON.parse(readFileSync(selfFile, 'utf8'));
    for (const r of arr) selfByPersona[r.persona] = r;
  } catch {
    /* optional */
  }
}

const out = [];
out.push('# Robustness simulation — read-back', '');
out.push(
  'Seven uncooperative users (gpt-5.4-mini), each stuck in one failure mode, to test how the companion behaves when the user will NOT deepen. Verdict pairs the persona\'s lived assessment with deterministic checks over the turn data. This only observed the engine; nothing was changed.',
  '',
);

// ── Summary ──
out.push('## Summary', '');
out.push('| Persona | Unlocked? | Red flags (deterministic) |', '|---|---|---|');
for (const r of rows) {
  const flagText = r.flags.length ? `⚠️ ${r.flags.join('; ')}` : '✅ none';
  out.push(`| ${r.persona} | ${r.unlockedSeen ? `turn ${r.unlockedOnTurn}` : '—'} | ${flagText} |`);
}
const clean = rows.filter((r) => !r.flags.length).length;
out.push('', `**${clean}/${rows.length} clean of deterministic red flags.**`, '');

// ── Per-persona detail + transcripts ──
out.push('## Conversations', '');
for (const r of rows) {
  const self = selfByPersona[r.persona];
  out.push(`### ${r.persona} — ${r.flags.length ? `⚠️ ${r.flags.length} flag(s)` : '✅ clean'} · ${r.totalTurns} turns${r.unlockedSeen ? ` · unlocked t${r.unlockedOnTurn}` : ''}`, '');
  if (self) {
    out.push(`> self: handled well = **${self.companion_handled_well ? 'yes' : 'no'}**`);
    if (self.what_worked) out.push(`> worked: ${self.what_worked}`);
    if (self.what_went_wrong) out.push(`> went wrong: ${self.what_went_wrong}`);
    out.push('');
  }
  if (r.flags.length) out.push(`> red flags: ${r.flags.join(' · ')}`, '');
  for (const x of r.turns) {
    if (x.safety) {
      out.push('_[safety pause]_', '');
      continue;
    }
    const tag = x.intent ? ' _(tap)_' : '';
    out.push(`**U${x.n}:**${tag} ${x.userText}`);
    const ann = [x.unlocked ? '🔓 unlocked' : null, x.stage ? `stage ${x.stage}` : null, x.shade ? `shade ${x.shade}` : null, x.moments?.length ? `moments ${x.moments.join(',')}` : null]
      .filter(Boolean)
      .join(' · ');
    out.push(`**Companion:** ${x.reply}${ann ? `  \n_[${ann}]_` : ''}`, '');
  }
  out.push('---', '');
}

const outPath = path.join(OUT, 'ROBUSTNESS_SIM_REPORT.md');
writeFileSync(outPath, out.join('\n'));
console.log(`[robustness-sim] wrote ${path.relative(ROOT, outPath)} (${rows.length} personas)`);
console.log(`clean of red flags: ${clean}/${rows.length} · ` + rows.map((r) => `${r.persona}:${r.flags.length ? 'flag' : 'ok'}${r.unlockedSeen ? '/unlocked' : ''}`).join(' '));
