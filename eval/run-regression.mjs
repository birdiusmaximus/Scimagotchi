/**
 * Scimagotchi conversation-engine regression harness — single model.
 *
 * Drives the 12 must-pass scenarios (eval/scenarios.json) through the REAL engine
 * via the companion-server (:8788), capturing structured logs and mechanically
 * checking the unlock/safety acceptance criteria. The driver + checks live in
 * eval/lib.mjs (shared with the multi-model benchmark).
 *
 * Prereqs:  node scripts/ai-proxy.mjs   +   node --env-file=.env scripts/companion-server.mjs
 * Run:  node eval/run-regression.mjs
 * Out:  eval-results/run_<UTC>/ { summary.md, score_table.csv, failures.json, *_audit.json, logs/, transcripts/ }
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runScenario, evaluateChecks, unlockRows, safetyRows, memoryRows, transcriptMd } from './lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = 'http://localhost:8788';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const OUT = path.join(ROOT, 'eval-results', `run_${RUN_ID}`);

const health = await fetch(`${SERVER}/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error('companion-server not reachable on :8788. Start it: node --env-file=.env scripts/companion-server.mjs');
  process.exit(1);
}
console.log(`[regression] server ok (model=${health.model}). Output -> eval-results/run_${RUN_ID}/`);
mkdirSync(path.join(OUT, 'logs'), { recursive: true });
mkdirSync(path.join(OUT, 'transcripts'), { recursive: true });

const scenarios = JSON.parse(readFileSync(path.join(ROOT, 'eval/scenarios.json'), 'utf8'));
const summaries = [];
const unlockAudit = [];
const safetyAudit = [];
const memoryAudit = [];
const failures = [];

for (const sc of scenarios) {
  process.stdout.write(`  • ${sc.scenario_id} ... `);
  const log = await runScenario(sc, { server: SERVER, cidPrefix: 'reg' });
  const checkResults = evaluateChecks(sc, log);
  log.check_results = checkResults;
  const gateFails = checkResults.filter((c) => c.gate && !c.ok);
  const noteFails = checkResults.filter((c) => !c.gate && !c.ok);
  const pass = gateFails.length === 0;

  writeFileSync(path.join(OUT, 'logs', `${sc.scenario_id}.json`), JSON.stringify(log, null, 2));
  writeFileSync(path.join(OUT, 'transcripts', `${sc.scenario_id}.md`), transcriptMd(sc, log, checkResults));
  unlockAudit.push(...unlockRows(log));
  safetyAudit.push(...safetyRows(log));
  memoryAudit.push(...memoryRows(log));
  if (!pass) failures.push({ scenario_id: sc.scenario_id, gate_failures: gateFails });

  summaries.push({ scenario_id: sc.scenario_id, family: sc.emotion_family, condition: sc.target_condition, pass, gate_fail: gateFails.length, notes: noteFails.length, checks: checkResults });
  console.log(pass ? (noteFails.length ? `pass (${noteFails.length} note)` : 'pass') : `FAIL (${gateFails.map((g) => g.type).join(', ')})`);
}

const passCount = summaries.filter((s) => s.pass).length;

const csv = ['scenario_id,family,target_condition,gate_pass,gate_failures,quality_notes'];
for (const s of summaries) csv.push(`${s.scenario_id},${s.family},${s.condition},${s.pass ? 'PASS' : 'FAIL'},${s.gate_fail},${s.notes}`);
writeFileSync(path.join(OUT, 'score_table.csv'), csv.join('\n'));
writeFileSync(path.join(OUT, 'failures.json'), JSON.stringify(failures, null, 2));
writeFileSync(path.join(OUT, 'unlock_audit.json'), JSON.stringify(unlockAudit, null, 2));
writeFileSync(path.join(OUT, 'safety_audit.json'), JSON.stringify(safetyAudit, null, 2));
writeFileSync(path.join(OUT, 'memory_audit.json'), JSON.stringify(memoryAudit, null, 2));

const md = [];
md.push(`# Scimagotchi conversation-engine regression — run_${RUN_ID}`, '');
md.push(`**Model:** ${health.model}  |  **Scenarios:** ${summaries.length}  |  **Gate pass:** ${passCount}/${summaries.length}`, '');
md.push('## Executive summary', '');
md.push(`- Deterministic gate (unlock + safety acceptance criteria): **${passCount}/${summaries.length} passed**.`);
const allNotes = summaries.flatMap((s) => s.checks.filter((c) => !c.gate && !c.ok).map((c) => `${s.scenario_id}: ${c.type} — ${c.detail}`));
md.push(`- Quality notes (non-blocking): ${allNotes.length}.`);
md.push(`- Unlock/deepening events: ${unlockAudit.length}. Safety events: ${safetyAudit.length}. Memory writes: ${memoryAudit.length}.`, '');
if (failures.length) {
  md.push('### Gate failures', '');
  for (const f of failures) for (const g of f.gate_failures) md.push(`- ❌ **${f.scenario_id}** — \`${g.type}\`: ${g.detail}`);
  md.push('');
}
md.push('## Scenario results', '', '| Scenario | Family | Gate | Notes |', '|---|---|---|---|');
for (const s of summaries) md.push(`| ${s.scenario_id} | ${s.family} | ${s.pass ? '✅ PASS' : '❌ FAIL'} | ${s.notes || ''} |`);
md.push('');
if (allNotes.length) {
  md.push('## Quality notes (non-blocking)', '');
  for (const n of allNotes) md.push(`- ⚠️ ${n}`);
  md.push('');
}
md.push('## Unlock audit', '', '| Scenario | Turn | Kind | Engine stage | Progress | Shade | Anchored | Summary |', '|---|---|---|---|---|---|---|---|');
for (const u of unlockAudit) md.push(`| ${u.scenario} | ${u.turn} | ${u.kind} | ${u.engine_stage} | ${u.progress_before}→${u.progress_after} | ${u.shade ?? ''} | ${u.anchored ? 'yes' : 'NO'} | ${u.summary ? u.summary.replace(/\|/g, '/') : ''} |`);
if (!unlockAudit.length) md.push('| _(none)_ | | | | | | | |');
md.push('', '## Safety audit', '', '| Scenario | Turn | Trigger | Level | Category | Hard pause |', '|---|---|---|---|---|---|');
for (const s of safetyAudit) md.push(`| ${s.scenario} | ${s.turn} | ${(s.trigger ?? '').replace(/\|/g, '/').slice(0, 60)} | ${s.level ?? ''} | ${s.category ?? ''} | ${s.hard_pause ? 'yes' : 'no'} |`);
if (!safetyAudit.length) md.push('| _(none)_ | | | | | |');
md.push('', '## Memory audit', '', '| Scenario | Turn | Type | On intent | On uncertain | Summary |', '|---|---|---|---|---|---|');
for (const m of memoryAudit) md.push(`| ${m.scenario} | ${m.turn} | ${m.type} | ${m.on_intent ? 'YES' : 'no'} | ${m.on_uncertain ? 'YES' : 'no'} | ${(m.summary ?? '').replace(/\|/g, '/')} |`);
if (!memoryAudit.length) md.push('| _(none — nothing auto-learned)_ | | | | | |');
md.push('');
writeFileSync(path.join(OUT, 'summary.md'), md.join('\n'));

console.log(`\n[regression] gate ${passCount}/${summaries.length} passed. Report: eval-results/run_${RUN_ID}/summary.md`);
process.exit(failures.length ? 1 : 0);
