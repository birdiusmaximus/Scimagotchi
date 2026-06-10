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
md += '| Emotion | n | avg turns | unlocked | turn-1 unlock | repeated reply | family-switch | safety |\n|---|---|---|---|---|---|---|---|\n';
for (const e of EMOTIONS) {
  const s = stats[e];
  if (!s) continue;
  md += `| ${e} | ${s.n} | ${s.avgTurns} | ${s.unlocked} | ${s.turn1Unlock} | ${s.repeatedReply} | ${s.familySwitch} | ${s.safety} |\n`;
}
md += '\n_Repeated reply = verbatim companion repeat (dead-end). Family-switch = the extracted emotion family changed mid-conversation._\n\n';

// 9. All transcripts (headings demoted two levels so they nest under §9)
md += '## 9. All transcripts\n\nEach companion turn is annotated `[stage/family/shade/UNLOCK]`; `[SAFETY pause]` marks a triggered safety check.\n\n';
for (const e of EMOTIONS) {
  const f = path.join(COMPILED, e + '.md');
  if (!existsSync(f)) continue;
  const body = readFileSync(f, 'utf8').split('\n').map((l) => (/^#{1,2} /.test(l) ? '##' + l : l)).join('\n');
  md += body + '\n\n---\n\n';
}

writeFileSync(path.join(OUT, 'SCIMAGOTCHI_EVAL_REPORT.md'), md);
console.log(`Wrote eval-out/SCIMAGOTCHI_EVAL_REPORT.md (${(md.length / 1024).toFixed(0)} KB, ${md.split('\n').length} lines)`);
