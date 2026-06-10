# ENGINE_AUDIT — Scimagotchi v0.1 → Engine v2

Phase 0 deliverable for `SCIMAGOTCHI_APP_ENGINE_IMPROVEMENT_BRIEF_FOR_CLAUDE.md`.
Maps the current architecture onto the brief's target modules, records the baseline,
and sets the implementation boundaries for the phased upgrade.

## 1. Current architecture (baseline)

| Concern | File(s) | State |
|---|---|---|
| Conversation prompt | `src/services/ai/prompts.ts` — `buildSystemPrompt()` + `COMPANION_OUTPUT_SCHEMA` | Single system prompt: voice rules, greet-vs-explore flow, 5-stage guide, anti-dead-end section, per-family reference blocks, `knownSoFar()` tally |
| LLM turn | `src/services/ai/openaiClient.ts` | One gpt-5.4-mini call returns reply + structured extraction (strict json_schema); app computes stage |
| Provider routing | `src/services/ai/aiClient.ts` | Proxy/native-key routing; silent fallback to local engine |
| Local fallback engine | `src/services/ai/companionEngine.ts` | Deterministic keyword walk; natural greeting path; `emptyEvent()` |
| Emotion data | `src/data/emotionMaps.ts`, `src/data/emotionReference.ts` | 9 families with shades/body/triggers/meanings/urges/questions — already close to the brief's §11 maps |
| Unlock / progression | `src/services/ai/stage.ts` (`evaluateStage`) + `store._updateProgress` | "understood" fires the moment family+shade+(body|urge)+trigger exist in ONE extraction — no user confirmation (eval defect) |
| Safety | `src/services/ai/safetyClassifier.ts` | Substring rules, levels 3–4 only. No passive hopelessness (level 2), no idiom guards ("can't breathe", "killing myself over work" escalate), no dependency cues (eval CRITICAL defect) |
| Safety UI | `src/components/SafetyModal.tsx`, `src/data/safetyResources.ts` | UK-first routes; modal for level ≥ 3 |
| State machine | `src/state/store.ts` | Owns send pipeline: safety pre-check → LLM turn → unlock/progress; zustand |
| Memory | `emotion_progress` rows + `memoryDigest()` into prompt | Implicit, not user-confirmed — brief Phase 5 replaces with consented Memory Ledger |
| Persistence | `src/services/db/*` | JSON document store (SQLite native / localStorage web) — **new event fields persist with no migration** |
| Summaries | `src/services/weeklySummary.ts`, calendar/patterns screens | Phase 7 target |
| Eval harness | `scripts/companion-server.mjs`, `say.mjs`, `emotion-eval-batch.mjs`, `compile-transcripts.mjs`, `eval-analyze.mjs`, `build-report.mjs` | **Phase 8 partially exists** — 216-conversation baseline in `eval-out/` (`SCIMAGOTCHI_EVAL_REPORT.md`) |

## 2. Baseline metrics (from the 216-conversation eval)

- Scores (1–5): attunement 4.4 · usefulness 4.3 · flow 4.1 · framework 4.0 · capture 3.9 · **safety 3.4 · humanness 3.4**
- 0/216 verbatim dead-ends; ~88% unlock rate; ~70% family-switch; ~50% of turns open "That sounds…"
- Confirmed defects: passive-hopelessness safety misses (`fear__02`, `flat__01`); idiom over-escalation (`pressure__17` "can't breathe abt it" → level 4); hard-script over-fire (`shame__02`); unlock on unconfirmed hypothesis (`calm__24`, `anger__20`); templating.

## 3. Module boundaries (adapted from brief §22)

Keep `src/services/ai/` as the engine home (no churn move to `src/engine/`); add modules:

| Brief module | Implementation here |
|---|---|
| Safety Layer (§15) | `safetyClassifier.ts` (rewrite: levels 0–4, guards, dependency, `resolveSafetyCheck`) + `safetyCopy.ts` (deterministic clarifiers/directives) + `safety.ts` barrel |
| Conversation Mode Router (§6) | `modeRouter.ts` — deterministic heuristic router; mode + per-turn directive injected into the prompt |
| Response Composer (§7) | Composer rules live in `prompts.ts` (variety/no-question/repair sections) + deterministic variety signals computed in `openaiClient.ts` from history + duplicate-reply retry + schema fields `response_shape` / `asked_question` |
| Emotion Understanding separation (§8) | Schema fields `label_source` / `user_confirmed_label` / `rejected_shades` mapped onto `EmotionEvent` (Phase 3 expands to full strands) |
| Progression (§13) | Phase-1 slice now: First-Shape confirmation gate in `stage.ts`; full 8-stage model in Phase 6 |
| Mixed Emotion Engine (§9) | Scaffold now (`mixed_relation` in schema + holding rules in prompt); engine in Phase 4 |
| Memory Ledger (§12) | Phase 5 (UI + consent flow + retrieval) |
| Summaries (§17) | Phase 7 |
| Eval harness (§19–20) | Safety regression runner now (`scripts/safety-regression.mjs`); full rubric harness exists from the 216-convo eval |

### Architectural decision: one LLM call, deterministic pre/post stages
The brief's §5 pipeline is implemented as deterministic computation **around the single
existing model call** (normalize → safety → mode-route → directives in → LLM → sanitize →
stage-gate → UI actions), not as multiple LLM calls. gpt-5.4-mini is a reasoning model;
2–3 calls per turn would multiply latency/cost without clear quality gain at this stage.
The `ResponsePlan` (§23.2) is realised as the per-turn directive block in the system prompt.

## 4. Known risks / constraints

- Level-2 phrase nets will produce some gentle-check false positives by design (cost: one soft in-chat question). Guards added for "what's the point of <mundane>", "drowning in work", "killing myself over <work>", "<x> is killing me".
- Mid-conversation reloads rehydrate events from disk; `label_source` persists (JSON store) but stage stability windows reset with store state — degradation is toward *later* unlock, never earlier.
- Family re-labelling mid-conversation keeps the monotonic stage clamp (existing behaviour) — properly handled by the Phase 6 progression model.
- The local fallback engine keeps its simpler unlock walk (offline demo path); it now tags `label_source` so the gate semantics stay consistent.

## 5. Phase plan status

| Phase | Status |
|---|---|
| 0 Audit + baseline | **This document + baseline commit** |
| 1 Safety layer + regression tests | **Implemented this pass** |
| 2 Mode router + response composer | **Implemented this pass** |
| 3 Emotion understanding + maps | Scaffolded (source separation in schema); full strands next |
| 4 Mixed emotion engine | Scaffolded (relation field + prompt holding rules) |
| 5 Memory ledger | Not started |
| 6 Progression engine | First-Shape confirmation gate implemented; full stage model pending |
| 7 Summaries/calendar | Not started |
| 8 Eval harness | Safety regression runner added; 216-convo persona harness exists |
