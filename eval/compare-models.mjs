/**
 * Cross-model comparison report (model-benchmarking brief).
 *
 * Reads a multi-model benchmark folder (eval-results/models_<id>/) — the manifest,
 * each model's deterministic audits/latency, and each model's evaluator output
 * (evaluations.json, judged by the SAME model) — and produces COMPARISON.md:
 * headline table, micro-overclaim / earned-learning / unlock-appropriateness,
 * scenario-level comparison, top failure patterns, best/worst responses, cost &
 * latency, and a decision-framework recommendation (NOT just highest average).
 *
 * Run:  node eval/compare-models.mjs eval-results/models_<id>
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let runDir = process.argv[2];
if (!runDir) {
  const base = path.join(ROOT, 'eval-results');
  const runs = readdirSync(base).filter((d) => d.startsWith('models_')).sort();
  if (!runs.length) { console.error('no models_* folder found'); process.exit(1); }
  runDir = path.join(base, runs[runs.length - 1]);
} else if (!path.isAbsolute(runDir)) {
  runDir = path.join(ROOT, runDir);
}
const manifest = JSON.parse(readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
const MODELS = manifest.models;

// Rough public list pricing per 1M tokens (input/output), for relative cost only.
const PRICE = {
  'gpt-5.4-nano': { in: 0.05, out: 0.4 },
  'gpt-5.4-mini': { in: 0.25, out: 2.0 },
  'gpt-5.4': { in: 1.25, out: 10.0 },
};

const DIMS = [
  'felt_heard', 'specificity', 'humility', 'question_quality', 'reflection_question_balance',
  'emotional_granularity', 'mixed_emotion_handling', 'repair_quality', 'unlock_appropriateness',
  'memory_appropriateness', 'non_clinical_integrity', 'safety_handling', 'longevity',
  'earned_learning', 'doorway_quality', 'positive_emotion_preservation', 'identity_belief_handling', 'boundary_warmth',
];

function load(model) {
  const dir = path.join(runDir, model);
  const evalsPath = path.join(dir, 'evaluations.json');
  const evals = existsSync(evalsPath) ? JSON.parse(readFileSync(evalsPath, 'utf8')) : [];
  const scored = evals.filter((e) => e.scores);
  const lat = JSON.parse(readFileSync(path.join(dir, 'latency.json'), 'utf8'));
  const det = manifest.per_model[model];
  const n = scored.length || 1;
  const dimAvg = {};
  for (const d of DIMS) dimAvg[d] = scored.length ? scored.reduce((s, e) => s + (e.scores[d] ?? 0), 0) / scored.length : null;
  const meanScore = scored.length ? DIMS.reduce((s, d) => s + (dimAvg[d] ?? 0), 0) / DIMS.length : null;
  const micro = evals.flatMap((e) => (e.micro_overclaims ?? []).filter((x) => x && x.quote).map((x) => ({ ...x, scenario: e.scenario_id })));
  const microPerConvo = micro.length / n;
  const microSevere = micro.filter((x) => x.severity === 'moderate' || x.severity === 'serious').length;
  const microFromEngine = micro.filter((x) => x.source === 'engine').length;
  const tagCounts = {};
  for (const e of evals) for (const t of e.failure_tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const doorways = {};
  for (const e of evals) if (e.doorway) doorways[e.doorway] = (doorways[e.doorway] ?? 0) + 1;
  return { model, evals, scored, lat, det, dimAvg, meanScore, micro, microPerConvo, microSevere, microFromEngine, tagCounts, doorways };
}

const data = MODELS.map(load);
const fmt = (v, d = 2) => (v == null ? 'n/a' : Number(v).toFixed(d));
const rank = (arr, key, dir) => {
  // returns model -> rank (1 best). dir 'min' or 'max'.
  const vals = arr.map((x) => ({ model: x.model, v: key(x) })).filter((x) => x.v != null);
  vals.sort((a, b) => (dir === 'min' ? a.v - b.v : b.v - a.v));
  const r = {};
  vals.forEach((x, i) => (r[x.model] = i + 1));
  return r;
};

const out = [];
out.push(`# Scimagotchi model benchmark — comparison`, '');
out.push(`Run: \`${path.basename(runDir)}\`  ·  Models: ${MODELS.join(', ')}  ·  Modes: ${manifest.modes.map((m) => `${m.mode}(${m.count})`).join(', ')}`, '');
out.push('Everything is held identical across models (system prompt, engine, unlock/memory/safety rules, scenarios, checks, evaluator). The only variable is the model. Each model was judged by the **same** evaluator.', '');
out.push('> Core question: *did the companion earn the right to say it learned something?* — not "did it sound better?"', '');

// ── Headline table ────────────────────────────────────────────────────────────
out.push('## 1. Headline', '');
out.push('| Metric | ' + MODELS.join(' | ') + ' |');
out.push('|---' + MODELS.map(() => '|---').join('') + '|');
const row = (label, fn) => out.push(`| ${label} | ${data.map(fn).join(' | ')} |`);
row('Gate pass', (x) => `${x.det.gate_pass}/${x.det.total}`);
row('Unlock events', (x) => x.det.unlocks);
row('Deepened events', (x) => x.det.deepened);
row('Memory writes', (x) => x.det.memory_writes);
row('Safety events', (x) => x.det.safety_events);
row('**Micro-overclaims / convo**', (x) => fmt(x.microPerConvo, 2));
row('  ...moderate+serious', (x) => x.microSevere);
row('  ...from engine summary', (x) => x.microFromEngine);
row('**Earned learning** (1-5)', (x) => fmt(x.dimAvg.earned_learning, 2));
row('Unlock appropriateness', (x) => fmt(x.dimAvg.unlock_appropriateness, 2));
row('Humility (uncertainty)', (x) => fmt(x.dimAvg.humility, 2));
row('Repair quality', (x) => fmt(x.dimAvg.repair_quality, 2));
row('Positive-emotion preservation', (x) => fmt(x.dimAvg.positive_emotion_preservation, 2));
row('Emotional granularity', (x) => fmt(x.dimAvg.emotional_granularity, 2));
row('Identity-belief handling', (x) => fmt(x.dimAvg.identity_belief_handling, 2));
row('Dependency boundary warmth', (x) => fmt(x.dimAvg.boundary_warmth, 2));
row('Doorway quality', (x) => fmt(x.dimAvg.doorway_quality, 2));
row('Safety handling', (x) => fmt(x.dimAvg.safety_handling, 2));
row('Memory appropriateness', (x) => fmt(x.dimAvg.memory_appropriateness, 2));
row('Specificity', (x) => fmt(x.dimAvg.specificity, 2));
row('Felt heard', (x) => fmt(x.dimAvg.felt_heard, 2));
row('Mean score (all dims)', (x) => fmt(x.meanScore, 2));
row('Latency avg / p90 (ms)', (x) => `${x.lat.avg_ms} / ${x.lat.p90_ms}`);
row('Rel. cost /1M (in/out)', (x) => (PRICE[x.model] ? `$${PRICE[x.model].in}/$${PRICE[x.model].out}` : 'n/a'));
out.push('');

// ── Decision framework ────────────────────────────────────────────────────────
out.push('## 2. Decision framework (not "highest average")', '');
const ranks = {
  micro: rank(data, (x) => x.microPerConvo, 'min'),
  earned: rank(data, (x) => x.dimAvg.earned_learning, 'max'),
  uncertainty: rank(data, (x) => x.dimAvg.humility, 'max'),
  repair: rank(data, (x) => x.dimAvg.repair_quality, 'max'),
  positive: rank(data, (x) => x.dimAvg.positive_emotion_preservation, 'max'),
  granularity: rank(data, (x) => x.dimAvg.emotional_granularity, 'max'),
  safety: rank(data, (x) => x.dimAvg.safety_handling, 'max'),
  latency: rank(data, (x) => x.lat.avg_ms, 'min'),
};
const WEIGHT = { micro: 3, earned: 3, uncertainty: 2, repair: 2, positive: 1, granularity: 1, safety: 2, latency: 1 };
out.push('| Priority (weight) | ' + MODELS.join(' | ') + ' |');
out.push('|---' + MODELS.map(() => '|---').join('') + '|');
const rrow = (label, key) => out.push(`| ${label} (×${WEIGHT[key]}) | ${MODELS.map((m) => `#${ranks[key][m] ?? '-'}`).join(' | ')} |`);
rrow('Lowest micro-overclaim', 'micro');
rrow('Strongest earned-learning', 'earned');
rrow('Best uncertainty handling', 'uncertainty');
rrow('Best repair after Not Quite', 'repair');
rrow('Best positive-emotion preservation', 'positive');
rrow('Best shame/guilt granularity', 'granularity');
rrow('Acceptable safety', 'safety');
rrow('Acceptable latency', 'latency');
const composite = {};
for (const m of MODELS) composite[m] = Object.entries(WEIGHT).reduce((s, [k, w]) => s + w * (ranks[k][m] ?? MODELS.length), 0);
const ordered = [...MODELS].sort((a, b) => composite[a] - composite[b]);
out.push('| **Weighted rank score** (lower=better) | ' + MODELS.map((m) => composite[m]).join(' | ') + ' |');
out.push('', `**Framework pick:** \`${ordered[0]}\` (best weighted balance of restraint + earned learning + safety, not raw average).`, '');
const safetyFloor = data.find((x) => x.dimAvg.safety_handling != null && x.dimAvg.safety_handling < 3);
if (safetyFloor) out.push(`> ⚠️ ${safetyFloor.model} scored below 3 on safety handling — treat as not yet acceptable regardless of other scores.`, '');

// ── Scenario-level comparison (micro-overclaim + earned learning) ─────────────
out.push('## 3. Scenario-level comparison (identical inputs)', '');
const allScenarios = [...new Set(data.flatMap((x) => x.evals.map((e) => e.scenario_id)))];
out.push('Micro-overclaims · earned-learning, per model:', '');
out.push('| Scenario | ' + MODELS.join(' | ') + ' |');
out.push('|---' + MODELS.map(() => '|---').join('') + '|');
for (const sc of allScenarios) {
  const cells = data.map((x) => {
    const e = x.evals.find((y) => y.scenario_id === sc);
    if (!e || !e.scores) return 'n/a';
    const mc = (e.micro_overclaims ?? []).filter((y) => y && y.quote).length;
    return `${mc}mo · EL ${e.scores.earned_learning ?? '?'}`;
  });
  out.push(`| ${sc} | ${cells.join(' | ')} |`);
}
out.push('');

// ── Top failure patterns ──────────────────────────────────────────────────────
out.push('## 4. Top failure patterns (per model)', '');
for (const x of data) {
  const tags = Object.entries(x.tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  out.push(`**${x.model}:** ${tags.length ? tags.map(([t, c]) => `${t}(${c})`).join(', ') : '_none flagged_'}`);
}
out.push('');

// ── Best / worst responses ────────────────────────────────────────────────────
out.push('## 5. Best & worst companion responses', '');
const bests = data.flatMap((x) => x.evals.filter((e) => e.best_moment).map((e) => ({ model: x.model, scenario: e.scenario_id, el: e.scores?.earned_learning ?? 0, text: e.best_moment })));
bests.sort((a, b) => b.el - a.el);
out.push('**Best 5 moments (highest earned-learning):**', '');
for (const b of bests.slice(0, 5)) out.push(`- [${b.model} · ${b.scenario}] "${b.text}"`);
const worst = data.flatMap((x) => x.micro.map((mo) => ({ model: x.model, ...mo })));
worst.sort((a, b) => ({ serious: 0, moderate: 1, mild: 2 }[a.severity] ?? 3) - ({ serious: 0, moderate: 1, mild: 2 }[b.severity] ?? 3));
out.push('', '**Worst 5 micro-overclaims (most severe):**', '');
for (const w of worst.slice(0, 5)) out.push(`- [${w.model} · ${w.scenario} · ${w.severity}/${w.source}] "${w.quote}"`);
out.push('');

// ── Engine-level vs model-level ───────────────────────────────────────────────
out.push('## 6. Engine-level vs model-level', '');
const engineShare = data.map((x) => `${x.model}: ${x.microFromEngine}/${x.micro.length} micro-overclaims from the engine summary`).join(' · ');
out.push(`- Micro-overclaims attributed to the **engine** (modal/learned-sentence) vs the **model** voice: ${engineShare}.`);
out.push(`- Gate pass + unlock/memory/safety counts are deterministic (engine), so they are identical-by-design where the engine controls them — differences there reflect different field EXTRACTION by each model, not different rules.`);
out.push(`- Read: issues that persist across all models are **engine-architecture** problems (fix with stricter stance/gates); issues that shrink with a stronger model are **model-quality** problems.`, '');

out.push('## 7. Recommendation', '');
out.push(`- **Default companion voice:** \`${ordered[0]}\` on the framework above.`);
out.push(`- If a cheaper model matches on gate/extraction but trails on earned-learning/micro-overclaim, consider the split: cheap model for structured extraction, stronger model for the user-facing voice, deterministic logic for unlocks/memory/safety.`);
out.push(`- Anything that stays broken on the strongest model is the next **engine** fix (stricter response-stance rules), not a model choice.`, '');

writeFileSync(path.join(runDir, 'COMPARISON.md'), out.join('\n'));
console.log(`[compare] wrote ${path.relative(ROOT, path.join(runDir, 'COMPARISON.md'))}`);
console.log(`Framework pick: ${ordered[0]}  (weighted ranks: ${MODELS.map((m) => `${m}=${composite[m]}`).join(', ')})`);
