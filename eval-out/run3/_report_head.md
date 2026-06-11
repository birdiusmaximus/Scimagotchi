# Scimagotchi Companion — Conversation Evaluation Report (Run 3)

**90 simulated conversations · 9 emotion families · 10 personas each · June 2026**

This report re-tests the **real app companion logic** (the production system prompt, `gpt-5.4-mini`, and the deterministic stage / unlock / safety / memory code) against a fresh set of simulated people, then analyses where it does well, where it fails, and what to change.

This is **Run 3**, after the v0.3 "trust, voice and aliveness" work. It uses the **exact same persona configuration as Run 2**, so the only thing that changed is the engine — letting the before/after table in §8c isolate the effect. The changes under test:

- **Visible-reply ownership gate.** The metadata gate already stopped *unowned unlocks*; now the spoken reply is repaired too, so the companion can't *say* a feeling is settled before the user owns it.
- **No templated scaffold.** The repeated "quote the user + 'feels like the centre of this' + 'is it more X or Y?'" shape is detected and suppressed (and removed from the prompt, where it had been a positive example).
- **A first shape lands without a question.** `dropTrailingQuestion` + a prompt rest rule guarantee an unlock reply never ends on a refining question.
- **Safety false-positive fixes.** An "od on" substring bug (which escalated "looks g*ood on* paper") and self-harm *denials* ("not gonna hurt myself") no longer trip a crisis pause; level-2 gentle checks are now counted.
- (Still holding from Run 2: the **naming gate**, **no broken mirroring**, **auto-learned memory**, **no em dashes**.)

The headline before/after (same personas, engine-only change) is in **§8c**.

---

## 1. Methodology

### 1.1 Goal
Stress-test the companion across *every* emotion it can recognise, with people who differ in situation, personality, verbosity, and willingness to open up — then judge, with evidence, how **human** it feels, how **useful** it is in the app's context (gentle reflection, explicitly *not* therapy), whether the **recent fixes hold**, and what to improve next.

### 1.2 The harness — testing the *real* app, not a mock
The eval drives the exact code the app ships, so findings transfer directly:

- **Bundled production logic.** `src/services/ai/openaiClient.ts` (which builds the real system prompt via `prompts.ts`, calls the model with the real JSON-schema extraction, and runs the deterministic `stage.ts` unlock + ownership logic) and `src/services/ai/safety.ts` were bundled with `esbuild` into standalone modules (`scripts/companion-bundle.mjs`, `scripts/safety-bundle.mjs`), resolving the `@/` path aliases so they run under plain Node while remaining byte-for-byte the app's logic. **These bundles were rebuilt immediately before this run** so the changes above are actually under test.
- **Stateful companion server** (`scripts/companion-server.mjs`). A small HTTP service that holds per-conversation state and, for each user message: (1) runs the **real safety pre-check** first — level ≥ 3 returns a safety pause and never calls the model, exactly as the app's `store.send` does; level 2 returns the deterministic gentle clarifier and resolves on the next message; otherwise (2) calls the real `openaiGenerateTurn`, forwarding to the OpenAI proxy so the API key stays server-side. Every turn is written to `eval-out/<cid>.json` with the full extracted emotion event and per-turn stage / family / shade / unlock / **label_source** annotations.
- **Persona helper** (`scripts/say.mjs`). Lets a simulated person send one in-character message and read the companion's reply, so persona agents never hand-craft fragile JSON.

### 1.3 The simulated people
Each conversation is driven by a **Claude agent role-playing one realistic person** (the human side only — every *companion* turn is the real `gpt-5.4-mini` app logic, so the thing under test is never simulated). Each persona is composed from independent variation axes so the 10 conversations per emotion are genuinely different, not 10 paraphrases:

- **Depth / length:** simple-and-short (3–4 turns) · medium (5–6) · complex-and-difficult (7–9).
- **Writing style:** terse & clipped · rambling over-sharer · guarded & reluctant · articulate & reflective · humour-deflecting · raw & emotional · matter-of-fact · scattered.
- **Approach mode:** engages openly · just logs and leaves · small-talk first · **mislabels the feeling** at first · two tangled feelings · vague & resistant ("I don't know") · skeptical of the app · quietly overwhelmed · **describes only the situation and never names the feeling** (a mode added this run to directly test the naming gate).
- **Life domain:** work · family · romantic relationship · health · money · friendship · identity/self-worth · everyday life · the past · an uncertain future.
- **Distress probes:** for the heavier families (fear, sadness, hurt, shame, flat), two personas per family were seeded into a low, hopeless mood expressed in realistic but non-graphic ways ("what's the point", "nothing feels worth it") to probe the safety path.

Each agent invents a concrete, specific scenario fitting its axes, reveals it gradually the way a real person would, types like that kind of person (lowercase, fragments, typos), and ends the way they would.

### 1.4 Coverage & how it was run
- **9 emotion families** × **10 conversations** = **90** (joy, calm, fear, pressure, anger, sadness, hurt, shame, flat).
- Run as a single **background multi-agent workflow** (`scripts/emotion-eval-batch.mjs`), ~8–14 personas conversing concurrently, with server-side retry/backoff to ride out rate limits.

### 1.5 The analysis
- **Deterministic pass** (`scripts/compile-transcripts.mjs`) compiles every transcript into a readable per-emotion digest and computes hard flags with no model judgment: verbatim **repeated replies** (dead-ends), **turn-1 unlocks**, **family-switches** (the extracted emotion family changing mid-conversation), **safety** triggers, and — new this run — **unowned unlocks** (a first shape reached while `label_source` was still a companion hypothesis, which the gate should make impossible).
- **Qualitative pass** (`scripts/eval-analyze.mjs`, a workflow): **nine reviewer agents** — one per emotion — read all of their transcripts plus the deterministic flags and score the companion 1–5 on seven dimensions (humanness, attunement, usefulness, framework adherence, conversational flow, capture accuracy, safety handling), citing a real conversation id and verbatim quote for every strength and failure mode, with explicit attention to whether the companion ever named a feeling the person had not. A **synthesizer agent** then produces the cross-cutting verdict and code-tied recommendations.

### 1.6 Limitations (read the findings with these in mind)
- **Personas are LLM-simulated.** Varied and realistic, but more coherent and articulate than real distressed users, and under-representing very short, noisy inputs. Treat humanness/usefulness scores as directional.
- **The companion is non-deterministic.** `gpt-5.4-mini` varies run-to-run; that variance is itself a finding. (The naming gate and safety pause, however, are deterministic and do not depend on the model.)
- **Safety was probed, not red-teamed.** The distress personas surface real signal but this is not an exhaustive crisis-language audit.
- **One pass, model-judged scores.** Rubric- and evidence-anchored, but reviewer judgment nonetheless.
- **Logic layer only.** The harness bypasses the UI, so this evaluates the conversation/logic — not rendering, animation, or the on-device experience.

---
