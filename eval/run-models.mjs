/**
 * Multi-model benchmark driver (model-benchmarking brief).
 *
 * Runs the SAME everything (system prompt, engine, unlock/memory/safety rules,
 * scenarios, checks, logging) across several models — the only variable is the
 * model, supplied per-request to the companion-server. Covers:
 *   Mode 1 — fixed-transcript replay (eval/fixed-replay.json): identical user turns
 *   Mode 2 — the 12-scenario regression (eval/scenarios.json)
 *
 * Prereqs:  node scripts/ai-proxy.mjs  +  node --env-file=.env scripts/companion-server.mjs
 * Run:  node eval/run-models.mjs [model1 model2 ...]   (default: gpt-5.4-nano gpt-5.4-mini gpt-5.4)
 * Out:  eval-results/models_<UTC>/<model>/ { logs/, transcripts/, summary.md, *_audit.json, latency.json }
 *       eval-results/models_<UTC>/manifest.json
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runScenario, evaluateChecks, unlockRows, safetyRows, memoryRows, transcriptMd } from './lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = 'http://localhost:8788';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const OUT = path.join(ROOT, 'eval-results', `models_${RUN_ID}`);

const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4'];
const MODES = [
  { mode: 'fixed', file: 'eval/fixed-replay.json' }, // Mode 1
  { mode: 'reg', file: 'eval/scenarios.json' },      // Mode 2
];

const health = await fetch(`${SERVER}/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error('companion-server not reachable on :8788. Start it: node --env-file=.env scripts/companion-server.mjs');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
console.log(`[models] server ok. Comparing [${MODELS.join(', ')}] x [${MODES.map((m) => m.mode).join(', ')}] -> ${path.basename(OUT)}`);

const loaded = MODES.map((m) => ({ ...m, scenarios: JSON.parse(readFileSync(path.join(ROOT, m.file), 'utf8')) }));
const manifest = { run_id: RUN_ID, models: MODELS, modes: loaded.map((m) => ({ mode: m.mode, file: m.file, count: m.scenarios.length })), per_model: {} };

for (const model of MODELS) {
  const dir = path.join(OUT, model);
  mkdirSync(path.join(dir, 'logs'), { recursive: true });
  mkdirSync(path.join(dir, 'transcripts'), { recursive: true });
  const unlockAudit = [], safetyAudit = [], memoryAudit = [], summaries = [];
  const latencies = [];
  console.log(`\n=== ${model} ===`);

  for (const { mode, scenarios } of loaded) {
    for (const sc of scenarios) {
      process.stdout.write(`  • [${mode}] ${sc.scenario_id} ... `);
      const log = await runScenario(sc, { server: SERVER, model, cidPrefix: `${model}_${mode}` });
      log.mode = mode;
      const checkResults = evaluateChecks(sc, log);
      log.check_results = checkResults;
      const gateFails = checkResults.filter((c) => c.gate && !c.ok);
      const noteFails = checkResults.filter((c) => !c.gate && !c.ok);
      const pass = gateFails.length === 0;
      const key = `${mode}__${sc.scenario_id}`;

      writeFileSync(path.join(dir, 'logs', `${key}.json`), JSON.stringify(log, null, 2));
      writeFileSync(path.join(dir, 'transcripts', `${key}.md`), transcriptMd(sc, log, checkResults));
      for (const r of unlockRows(log)) unlockAudit.push({ ...r, mode });
      for (const r of safetyRows(log)) safetyAudit.push({ ...r, mode });
      for (const r of memoryRows(log)) memoryAudit.push({ ...r, mode });
      for (const t of log.turns) if (typeof t.latency_ms === 'number') latencies.push(t.latency_ms);
      summaries.push({ scenario_id: sc.scenario_id, mode, family: sc.emotion_family, pass, gate_fail: gateFails.length, notes: noteFails.length });
      console.log(pass ? (noteFails.length ? `pass (${noteFails.length} note)` : 'pass') : `FAIL (${gateFails.map((g) => g.type).join(', ')})`);
    }
  }

  writeFileSync(path.join(dir, 'unlock_audit.json'), JSON.stringify(unlockAudit, null, 2));
  writeFileSync(path.join(dir, 'safety_audit.json'), JSON.stringify(safetyAudit, null, 2));
  writeFileSync(path.join(dir, 'memory_audit.json'), JSON.stringify(memoryAudit, null, 2));
  const sorted = [...latencies].sort((a, b) => a - b);
  const lat = {
    turns: latencies.length,
    avg_ms: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p50_ms: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    p90_ms: sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : null,
  };
  writeFileSync(path.join(dir, 'latency.json'), JSON.stringify(lat, null, 2));

  const gate = summaries.filter((s) => s.pass).length;
  const deepened = unlockAudit.filter((u) => u.kind === 'deepened').length;
  const md = [
    `# ${model} — benchmark run ${RUN_ID}`, '',
    `**Gate pass:** ${gate}/${summaries.length}  |  **Unlocks:** ${unlockAudit.length} (deepened ${deepened})  |  **Memory writes:** ${memoryAudit.length}  |  **Safety events:** ${safetyAudit.length}`,
    `**Latency:** avg ${lat.avg_ms}ms · p50 ${lat.p50_ms}ms · p90 ${lat.p90_ms}ms (${lat.turns} turns)`, '',
    '| Mode | Scenario | Gate | Notes |', '|---|---|---|---|',
    ...summaries.map((s) => `| ${s.mode} | ${s.scenario_id} | ${s.pass ? '✅' : '❌'} | ${s.notes || ''} |`),
  ];
  writeFileSync(path.join(dir, 'summary.md'), md.join('\n'));
  manifest.per_model[model] = { gate_pass: gate, total: summaries.length, unlocks: unlockAudit.length, deepened, memory_writes: memoryAudit.length, safety_events: safetyAudit.length, latency: lat };
  console.log(`  -> gate ${gate}/${summaries.length} · unlocks ${unlockAudit.length} · memory ${memoryAudit.length} · avg ${lat.avg_ms}ms`);
}

writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n[models] done. Folder: eval-results/${path.basename(OUT)}`);
console.log(`Next: judge each model with the SAME evaluator, then compare:`);
for (const m of MODELS) console.log(`  EXPO_PUBLIC_OPENAI_MODEL=gpt-5.4 node --env-file=.env eval/evaluate.mjs eval-results/${path.basename(OUT)}/${m}`);
console.log(`  node eval/compare-models.mjs eval-results/${path.basename(OUT)}`);
