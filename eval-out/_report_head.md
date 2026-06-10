# Scimagotchi Companion — Conversation Evaluation Report

**216 simulated conversations · 9 emotion families · ~1,300 companion turns · June 2026**

This report tests the **real app companion logic** (the production system prompt, `gpt-5.4-mini`, and the deterministic stage / unlock / safety code) against a large, deliberately varied set of simulated people, then analyses where it does well, where it fails, and what to change.

---

## 1. Methodology

### 1.1 Goal
Stress-test the companion across *every* emotion it can recognise, with people who differ in situation, personality, verbosity, and willingness to open up — then judge, with evidence, how **human** it feels, how **useful** it is in the app's context (gentle reflection, explicitly *not* therapy), and how to improve the conversation **logic and structure**.

### 1.2 The harness — testing the *real* app, not a mock
The eval drives the exact code the app ships, so findings transfer directly:

- **Bundled production logic.** `src/services/ai/openaiClient.ts` (which builds the real system prompt via `prompts.ts`, calls the model with the real JSON-schema extraction, and runs the deterministic `stage.ts` unlock logic) and `src/services/ai/safetyClassifier.ts` were bundled with `esbuild` into standalone modules (`scripts/companion-bundle.mjs`, `scripts/safety-bundle.mjs`) — resolving the `@/` path aliases so they run under plain Node while remaining byte-for-byte the app's logic.
- **Stateful companion server** (`scripts/companion-server.mjs`). A small HTTP service that holds per-conversation state and, for each user message: (1) runs the **real safety pre-check** first — if it scores level ≥ 3 it returns a safety pause and never calls the model, exactly as the app's `store.send` does; otherwise (2) calls the real `openaiGenerateTurn`, forwarding to the OpenAI proxy so the API key stays server-side. Every turn is appended to a transcript and written to `eval-out/<cid>.json` with the full extracted emotion event and per-turn stage/family/shade/unlock annotations.
- **Persona helper** (`scripts/say.mjs`). Lets a simulated person send one in-character message and read the companion's reply, so persona agents never hand-craft fragile JSON.

### 1.3 The simulated people
Each conversation is driven by a **Claude agent role-playing one realistic person** (the human side only — every *companion* turn is the real `gpt-5.4-mini` app logic, so the thing under test is never simulated). Each persona is composed from independent variation axes so the 24 conversations per emotion are genuinely different, not 24 paraphrases:

- **Depth / length:** simple-and-short (3–4 turns) · medium (5–6) · complex-and-difficult (7–9).
- **Writing style:** terse & clipped · rambling over-sharer · guarded & reluctant · articulate & reflective · humour-deflecting · raw & emotional · matter-of-fact · scattered.
- **Approach mode:** engages openly · just logs and leaves · small-talk first · **mislabels the feeling** at first · two tangled feelings · vague & resistant ("I don't know") · skeptical of the app · quietly overwhelmed.
- **Life domain:** work · family · romantic relationship · health · money · friendship · identity/self-worth · everyday life · the past · an uncertain future.
- **Distress probes:** for the heavier families (fear, sadness, hurt, shame, flat), two personas per family were seeded into a low, hopeless mood expressed in realistic but non-graphic ways ("what's the point", "nothing feels worth it") to probe the safety path.

Each agent invents a concrete, specific scenario fitting its axes, reveals it gradually the way a real person would, types like that kind of person (lowercase, fragments, typos), and ends the way they would — a quick thanks, going quiet, or trailing off.

### 1.4 Coverage & how it was run
- **9 emotion families** × **24 conversations** = **216** (joy, calm, fear, pressure, anger, sadness, hurt, shame, flat).
- Run as **background multi-agent workflows in emotional batches** (`scripts/emotion-eval-batch.mjs`): fear (24), then joy+calm+pressure (72), then anger+sadness+hurt (72), then shame+flat (48) — sequential to avoid rate-limit storms and to checkpoint quality between batches.

### 1.5 The analysis
- **Deterministic pass** (`scripts/compile-transcripts.mjs`) compiles every transcript into a readable per-emotion digest and computes hard flags with no model judgment: verbatim **repeated replies** (dead-ends), **turn-1 unlocks**, **family-switches** (the extracted emotion family changing mid-conversation), and **safety** triggers.
- **Qualitative pass** (`scripts/eval-analyze.mjs`, a workflow): **nine reviewer agents** — one per emotion — read all 24 of their transcripts plus the deterministic flags and score the companion 1–5 on seven dimensions (humanness, attunement, usefulness, framework adherence, conversational flow, capture accuracy, safety handling), citing a real conversation id and verbatim quote for every strength and failure mode. A **synthesizer agent** then produces the cross-cutting verdict and code-tied recommendations.
- **Independent verification.** The two highest-severity defects were confirmed by hand against the raw transcripts and by directly probing `classifySafety()` — they are not relayed agent claims.

### 1.6 Limitations (read the findings with these in mind)
- **Personas are LLM-simulated.** They are varied and realistic but tend to be *more* coherent and articulate than real distressed users, and under-represent very short, noisy, or chaotic real-world inputs. Treat humanness/usefulness scores as directional, not absolute.
- **The companion is non-deterministic.** `gpt-5.4-mini` varies run-to-run; that variance is itself a finding (the safety detection is inconsistent precisely because it leans on the model).
- **Safety was probed, not red-teamed.** ~10 distress personas surfaced real gaps, but this is not an exhaustive crisis-language audit.
- **One pass, model-judged scores.** Rubric- and evidence-anchored, but reviewer judgment nonetheless.
- **Logic layer only.** The harness bypasses the UI, so this evaluates the conversation/logic — not rendering, animation, or the on-device experience.

---
