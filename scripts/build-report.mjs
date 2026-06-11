/**
 * Assemble the single master report: methodology (authored) + rendered analysis
 * (from the eval-analyze workflow output) + the full 216 transcripts.
 *
 * Usage: node scripts/build-report.mjs <path-to-eval-analyze-output.json>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'eval-out');
const COMPILED = path.join(OUT, '_compiled');
const ANALYSIS_FILE = process.argv[2];
const EMOTIONS = ['joy', 'calm', 'fear', 'pressure', 'anger', 'sadness', 'hurt', 'shame', 'flat'];

const raw = JSON.parse(readFileSync(ANALYSIS_FILE, 'utf8'));
const data = typeof raw.result === 'string' ? JSON.parse(raw.result) : raw.result || raw;
const reviews = data.reviews || [];
const report = data.report || {};
const stats = JSON.parse(readFileSync(path.join(COMPILED, '_stats.json'), 'utf8'));

// Run 2 baseline (archived) for the before/after comparison, if present.
const RUN2_STATS = path.join(OUT, 'run2', '_compiled', '_stats.json');
const run2 = existsSync(RUN2_STATS) ? JSON.parse(readFileSync(RUN2_STATS, 'utf8')) : null;
const sumMetric = (st, key) => Object.values(st).reduce((a, s) => a + (s[key] || 0), 0);

let md = readFileSync(path.join(OUT, '_report_head.md'), 'utf8') + '\n';

// 2. Executive summary
md += '## 2. Executive summary\n\n';
md += '> ' + (report.headline || '') + '\n\n';
const os = report.overall_scores || {};
md += '**Overall scores (1–5):** ' + Object.entries(os).map(([k, v]) => `${k} ${v}`).join(' · ') + '\n\n';
md += '**How human does it feel?** ' + (report.humanness_verdict || '') + '\n\n';
md += '**How useful is it?** ' + (report.usefulness_verdict || '') + '\n\n';

// 3. Scorecard
md += '## 3. Scorecard by emotion\n\n';
md += '| Emotion | Human | Attune | Useful | Framework | Flow | Capture | Safety |\n|---|---|---|---|---|---|---|---|\n';
for (const r of reviews) {
  const s = r.scores, v = (x) => (x == null ? '–' : x);
  md += `| ${r.emotion} | ${v(s.humanness)} | ${v(s.attunement)} | ${v(s.usefulness)} | ${v(s.framework_adherence)} | ${v(s.conversational_flow)} | ${v(s.capture_accuracy)} | ${v(s.safety_handling)} |\n`;
}
md += '\n';

// 4. What works
md += '## 4. What works\n\n';
for (const w of report.what_works || []) md += `- **${w.point}**\n  - _Evidence:_ ${w.evidence}\n`;
md += '\n';

// 5. What falls short
md += '## 5. What falls short\n\n';
const sev = { critical: '🚨 CRITICAL', high: '🔴 HIGH', medium: '🟡 MEDIUM', low: '🟢 LOW' };
for (const w of report.what_falls_short || []) md += `- **${sev[w.severity] || w.severity} — ${w.problem}**\n  - _Where:_ ${w.where}\n  - _Evidence:_ ${w.evidence}\n`;
md += '\n';

// 6. Recommendations
md += '## 6. Recommendations\n\n';
for (const r of report.recommendations || []) {
  md += `### ${r.priority} — ${r.title}\n`;
  md += `- **Problem:** ${r.problem}\n- **Change:** ${r.change}\n- **Where in code:** ${r.where_in_code}\n\n`;
}

// 7. Per-emotion detailed reviews
md += '## 7. Per-emotion detailed reviews\n\n';
for (const r of reviews) {
  md += `### ${r.emotion.toUpperCase()} (${r.n_reviewed} conversations)\n\n`;
  md += '**Scores:** ' + Object.entries(r.scores).map(([k, v]) => `${k} ${v == null ? '–' : v}`).join(' · ') + '\n\n';
  md += '**Summary:** ' + r.summary + '\n\n';
  md += '**Strengths:**\n';
  for (const x of r.strengths || []) md += `- ${x}\n`;
  md += '\n**Failure modes:**\n';
  for (const f of r.failure_modes || []) md += `- _(${f.severity})_ **${f.name}** — ${f.frequency}. e.g. \`${f.example_cid}\`: "${f.example_quote}". ${f.why_it_matters}\n`;
  md += `\n**Best example:** \`${r.best_example?.cid}\` — ${r.best_example?.why}\n\n`;
  md += `**Worst example:** \`${r.worst_example?.cid}\` — ${r.worst_example?.why}\n\n`;
}

// 8. Quantitative flags
md += '## 8. Quantitative flags (deterministic, no model judgment)\n\n';
md += '| Emotion | n | avg turns | unlocked | turn-1 unlock | repeated reply | family-switch | unowned unlock | gentle check (L2) | safety pause (L3+) |\n|---|---|---|---|---|---|---|---|---|---|\n';
let totUnowned = 0;
for (const e of EMOTIONS) {
  const s = stats[e];
  if (!s) continue;
  totUnowned += s.unownedUnlock || 0;
  md += `| ${e} | ${s.n} | ${s.avgTurns} | ${s.unlocked} | ${s.turn1Unlock} | ${s.repeatedReply} | ${s.familySwitch} | ${s.unownedUnlock ?? '–'} | ${s.gentleCheck ?? '–'} | ${s.safety} |\n`;
}
md += '\n_Repeated reply = verbatim companion repeat (dead-end). Family-switch = the extracted foreground emotion family changed mid-conversation (often legitimate re-tuning when a persona mislabels or carries two feelings). **Unowned unlock = a first shape fired while the label was still a companion hypothesis (a naming-gate violation) — total this run: ' + totUnowned + '.** Gentle check (L2) = an in-chat level-2 safety clarifier fired; safety pause (L3+) = a full modal pause._\n\n';

// 8b. Voice & trust metrics (the Phase 1 targets)
md += '### 8b. Voice & trust metrics (§11.1 — measured on the reply text)\n\n';
md += '| Emotion | named-for-them (convos) | unlock ended w/ question | quote-first openings | "centre of this" scaffold | companion turns |\n|---|---|---|---|---|---|\n';
for (const e of EMOTIONS) {
  const s = stats[e];
  if (!s) continue;
  md += `| ${e} | ${s.visibleNamedForThem ?? '–'} | ${s.unlockEndedQ ?? '–'} | ${s.quoteFirst ?? '–'} | ${s.centre ?? '–'} | ${s.compTurns ?? '–'} |\n`;
}
md += '\n_Named-for-them = the spoken reply asserted the turn\'s feeling as fact while the label was not yet user-owned. Unlock-ended-with-question = a first-shape reply that ended on a "?" (should be 0). Quote-first / "centre of this" = the repeated scaffold shapes._\n\n';

// 8c. Before/after vs Run 2
if (run2) {
  const METRICS = [
    ['unowned unlocks (gate violations)', 'unownedUnlock'],
    ['named-for-them (visible reply)', 'visibleNamedForThem'],
    ['unlock replies ending in a question', 'unlockEndedQ'],
    ['turn-1 unlocks', 'turn1Unlock'],
    ['repeated-reply dead-ends', 'repeatedReply'],
    ['quote-first openings', 'quoteFirst'],
    ['"centre of this" scaffold uses', 'centre'],
  ];
  md += '### 8c. Before / after vs Run 2 (same persona config; only the engine changed)\n\n';
  md += '| Metric | Run 2 (before) | Run 3 (after) | Δ |\n|---|---|---|---|\n';
  for (const [label, key] of METRICS) {
    const before = sumMetric(run2, key);
    const after = sumMetric(stats, key);
    const delta = after - before;
    md += `| ${label} | ${before} | ${after} | ${delta > 0 ? '+' + delta : delta} |\n`;
  }
  md += '\n_Both runs: 90 conversations, identical persona configuration. Run 2 = before the v0.3 visible-reply gate, unlock-rest and scaffold ban; Run 3 = after._\n\n';
}

// 9. All transcripts (headings demoted two levels so they nest under §9)
md += '## 9. All transcripts\n\nEach companion turn is annotated `[stage/family/shade/label_source/UNLOCK]`; `label_source` is the provenance of the label (`user_stated`, `user_confirmed`, or `companion_hypothesis`) — a first shape (`UNLOCK`) may only fire on a user-owned label. `[SAFETY pause]` marks a triggered safety check.\n\n';
for (const e of EMOTIONS) {
  const f = path.join(COMPILED, e + '.md');
  if (!existsSync(f)) continue;
  const body = readFileSync(f, 'utf8').split('\n').map((l) => (/^#{1,2} /.test(l) ? '##' + l : l)).join('\n');
  md += body + '\n\n---\n\n';
}

writeFileSync(path.join(OUT, 'SCIMAGOTCHI_EVAL_REPORT.md'), md);
console.log(`Wrote eval-out/SCIMAGOTCHI_EVAL_REPORT.md (${(md.length / 1024).toFixed(0)} KB, ${md.split('\n').length} lines)`);
