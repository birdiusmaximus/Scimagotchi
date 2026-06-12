/**
 * Report generator for the persona flow benchmark.
 *
 * Takes the Workflow's returned JSON (the { conversations: [...] } object, saved to a
 * file) and produces a human-readable report: flow scores by emotion and by persona,
 * the exploration-engagement picture, doorway usage, failure patterns, best/worst
 * journeys, per-emotion notes, and every transcript.
 *
 * Run:  node eval/persona-flow-report.mjs <results.json>
 * Out:  <same dir>/PERSONA_FLOW_REPORT.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsPath = process.argv[2];
if (!resultsPath || !existsSync(resultsPath)) {
  console.error('usage: node eval/persona-flow-report.mjs <results.json>');
  process.exit(1);
}
const data = JSON.parse(readFileSync(resultsPath, 'utf8'));
const convos = (data.conversations ?? []).filter((c) => c && c.flow && c.flow.scores);

const DIMS = ['natural_progression', 'exploration_invitation', 'question_fit', 'options_offered', 'avoids_dead_end', 'depth_matching', 'felt_progress', 'variety', 'felt_heard', 'earned_learning'];
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const fmt = (v, d = 2) => (v == null ? 'n/a' : Number(v).toFixed(d));
const dimMean = (cs, dim) => mean(cs.map((c) => c.flow.scores[dim] ?? 0));
const flowMean = (c) => mean(DIMS.map((d) => c.flow.scores[d] ?? 0));

const out = [];
out.push('# Scimagotchi — persona flow benchmark', '');
out.push(`Real multi-turn conversations across every emotion, judged on the JOURNEY (natural flow + exploration encouragement), not just unlock gates. ${convos.length} conversations.`, '');

// ── Overall ──
out.push('## 1. Overall flow scores', '');
out.push('| Dimension | avg |', '|---|---|');
for (const d of DIMS) out.push(`| ${d.replace(/_/g, ' ')} | ${fmt(dimMean(convos, d))} |`);
out.push(`| **mean (all dims)** | ${fmt(mean(convos.map(flowMean)))} |`, '');
const engaged = convos.filter((c) => c.persona_outcome?.stayed_engaged).length;
const closed = convos.filter((c) => c.persona_outcome?.reached_natural_close).length;
const stalled = convos.filter((c) => c.flow.stalled).length;
out.push(`- **Exploration encouraged** (persona stayed engaged): ${engaged}/${convos.length}`);
out.push(`- Reached a natural close: ${closed}/${convos.length}  ·  Stalled / went in circles: ${stalled}/${convos.length}`, '');

// ── By emotion ──
out.push('## 2. By emotion', '');
out.push('| Emotion | flow mean | explore-invite | question-fit | depth-match | felt-progress | stalled |', '|---|---|---|---|---|---|---|');
const byEmotion = {};
for (const c of convos) (byEmotion[c.emotion] ??= []).push(c);
for (const [emo, cs] of Object.entries(byEmotion)) {
  out.push(`| ${emo} | ${fmt(mean(cs.map(flowMean)))} | ${fmt(dimMean(cs, 'exploration_invitation'))} | ${fmt(dimMean(cs, 'question_fit'))} | ${fmt(dimMean(cs, 'depth_matching'))} | ${fmt(dimMean(cs, 'felt_progress'))} | ${cs.filter((c) => c.flow.stalled).length}/${cs.length} |`);
}
out.push('');

// ── By persona ──
out.push('## 3. By persona', '');
out.push('| Persona | flow mean | explore-invite | options | avoids-dead-end | engaged |', '|---|---|---|---|---|---|');
const byPersona = {};
for (const c of convos) (byPersona[c.persona] ??= []).push(c);
for (const [per, cs] of Object.entries(byPersona)) {
  out.push(`| ${per} | ${fmt(mean(cs.map(flowMean)))} | ${fmt(dimMean(cs, 'exploration_invitation'))} | ${fmt(dimMean(cs, 'options_offered'))} | ${fmt(dimMean(cs, 'avoids_dead_end'))} | ${cs.filter((c) => c.persona_outcome?.stayed_engaged).length}/${cs.length} |`);
}
out.push('');

// ── Doorway usage + failure tags ──
const doorways = {};
for (const c of convos) for (const d of c.flow.doorways_used ?? []) doorways[d] = (doorways[d] ?? 0) + 1;
out.push('## 4. Doorways used (across all companion turns)', '');
out.push(Object.entries(doorways).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} (${n})`).join(' · ') || '_none recorded_', '');
const tags = {};
for (const c of convos) for (const t of c.flow.failure_tags ?? []) tags[t] = (tags[t] ?? 0) + 1;
out.push('', '## 5. Failure patterns (count)', '');
out.push(Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `**${t}** (${n})`).join(' · ') || '_none flagged_', '');

// ── Best / worst journeys ──
const ranked = [...convos].sort((a, b) => flowMean(b) - flowMean(a));
out.push('', '## 6. Best & worst journeys', '');
out.push('**Top 5:**', '');
for (const c of ranked.slice(0, 5)) out.push(`- [${c.emotion}/${c.persona} · ${fmt(flowMean(c), 1)}] ${c.flow.verdict}`);
out.push('', '**Bottom 5:**', '');
for (const c of ranked.slice(-5).reverse()) out.push(`- [${c.emotion}/${c.persona} · ${fmt(flowMean(c), 1)}] ${c.flow.verdict}`);
out.push('');

// ── Per-conversation detail + transcripts ──
out.push('## 7. Per-conversation detail', '');
for (const c of ranked) {
  out.push(`### ${c.emotion} / ${c.persona} — flow ${fmt(flowMean(c), 1)}${c.flow.stalled ? ' · STALLED' : ''}`);
  out.push(`> scores: ${DIMS.map((d) => `${d.split('_')[0]} ${c.flow.scores[d]}`).join(' · ')}`);
  if (c.flow.doorways_used?.length) out.push(`> doorways: ${c.flow.doorways_used.join(' → ')}`);
  if (c.flow.failure_tags?.length) out.push(`> tags: ${c.flow.failure_tags.join(', ')}`);
  out.push(`> verdict: ${c.flow.verdict}`);
  if (c.flow.best_question) out.push(`> best question: ${c.flow.best_question}`);
  if (c.flow.worst_moment) out.push(`> worst moment: ${c.flow.worst_moment}`);
  if (c.persona_outcome?.one_line) out.push(`> persona felt: ${c.persona_outcome.one_line} (engaged: ${c.persona_outcome.stayed_engaged}, ${c.persona_outcome.turns_sent} turns)`);
  out.push('');
  const tp = path.join(ROOT, 'eval-out', `${c.cid}.json`);
  if (existsSync(tp)) {
    const t = JSON.parse(readFileSync(tp, 'utf8'));
    for (const m of t.transcript ?? []) {
      if (m.role === 'user') out.push(`**User:** ${m.content}`);
      else if (m.role === 'companion') out.push(`**Companion:** ${m.content}`);
      else if (m.safety) out.push(`_[safety pause]_`);
    }
  }
  out.push('', '---', '');
}

const outPath = path.join(path.dirname(resultsPath), 'PERSONA_FLOW_REPORT.md');
writeFileSync(outPath, out.join('\n'));
console.log(`[persona-flow] wrote ${path.relative(ROOT, outPath)} (${convos.length} conversations)`);
console.log(`overall flow mean ${fmt(mean(convos.map(flowMean)))}, exploration-engaged ${engaged}/${convos.length}, stalled ${stalled}/${convos.length}`);
