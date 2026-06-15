/**
 * Eval harness — companion server.
 *
 * Wraps the REAL app companion logic (openaiGenerateTurn, bundled from
 * src/services/ai/openaiClient.ts with esbuild) behind a tiny stateful HTTP API,
 * so Claude-agent "personas" can hold multi-turn conversations with the actual
 * companion (real system prompt + gpt-5.4-mini + deterministic stage/unlock logic).
 *
 * State is kept per conversation id (cid); each turn is appended and the full
 * transcript is written to eval-out/<cid>.json. Companion calls are forwarded to
 * the running OpenAI proxy on :8787 (the API key stays server-side there).
 *
 * Run:  node --env-file=.env scripts/companion-server.mjs
 * Use:  POST http://localhost:8788/say  { "cid": "...", "text": "...", "emotion": "fear", "persona": "..." }
 */
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openaiGenerateTurn } from './companion-bundle.mjs';
import {
  advanceStrands,
  classifyMoments,
  composeLearningSentence,
  draftFromTurn,
  evaluateOutcome,
  hasEmotionAnchor,
  isUncertain,
  PROGRESS_RANK,
  summaryIsClean,
  turnStrandFamilies,
} from './engine-bundle.mjs';
import {
  classifySafety,
  DEPENDENCY_NOTE,
  gentleCheckCopy,
  RESUME_NOTE,
  RESUME_SOFT_NOTE,
  resolveSafetyCheck,
} from './safety-bundle.mjs';

const PORT = 8788;
const PROXY = process.env.EVAL_PROXY_URL || 'http://localhost:8787/chat';
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-5.4-mini';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'eval-out');
mkdirSync(OUT, { recursive: true });

/** cid -> { cid, emotion, persona, created, history, prevEvent, transcript } */
const convos = new Map();

function save(c) {
  writeFileSync(path.join(OUT, `${c.cid}.json`), JSON.stringify(c, null, 2));
}

async function withRetry(fn, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // Backoff on rate-limit / transient errors (jittered).
      await new Promise((r) => setTimeout(r, 1200 * (i + 1) + Math.floor(Math.random() * 600)));
    }
  }
  throw lastErr;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'GET' && req.url === '/health') return json(200, { ok: true, model: MODEL, conversations: convos.size });

  if (req.method === 'POST' && req.url === '/say') {
    try {
      const { cid, text, emotion, persona, intent: rawIntent, model: reqModel } = JSON.parse(await readBody(req));
      if (!cid || !text || !String(text).trim()) return json(400, { error: 'cid and non-empty text required' });
      // A tapped continuation chip ("Stay with it" / "Not quite" / "I'm done").
      const intent = rawIntent === 'keep_going' || rawIntent === 'not_quite' || rawIntent === 'done' ? rawIntent : null;
      // Per-request model override (model-comparison benchmark) — everything else
      // (prompt, engine, unlock/memory/safety rules) stays identical across models.
      const turnModel = (typeof reqModel === 'string' && reqModel.trim()) || MODEL;

      let c = convos.get(cid);
      if (!c) {
        c = {
          cid,
          emotion: emotion ?? (cid.includes('__') ? cid.split('__')[0] : null),
          persona: persona ?? null,
          created: new Date().toISOString(),
          history: [],
          prevEvent: null,
          progress: {}, // family -> EmotionProgress, mirrors the app store
          pendingCheck: null,
          safetyClarified: false,
          repair: null, // { rejected, noLearningNextTurn } — No-Learning Zone after "Not quite"
          transcript: [],
        };
        convos.set(cid, c);
      }

      // No-Learning Zone (brief §4): the free-text turn right after a "Not quite" must not
      // unlock/deepen/write memory. Consume the one-turn flag (taps don't consume it).
      const repairActive = !intent && c.repair?.noLearningNextTurn === true;
      if (repairActive) c.repair = { ...c.repair, noLearningNextTurn: false };
      if (intent === 'not_quite' && c.prevEvent?.emotion_family) {
        c.repair = { rejected: c.prevEvent.emotion_shade?.trim() || c.prevEvent.emotion_family, noLearningNextTurn: true };
      }

      // Safety ladder — mirrors the app (engine brief §15): 3/4 pause flow with
      // a modal and never hit the LLM; 2 returns the deterministic gentle
      // clarifier and resolves on the NEXT message; dependency adds a directive.
      const safety = classifySafety(String(text));
      let safetyNote = null;

      if (c.pendingCheck) {
        const pending = c.pendingCheck;
        c.pendingCheck = null;
        const outcome = safety.level >= 3 ? 'escalate' : resolveSafetyCheck(String(text));
        if (outcome === 'escalate') {
          const level = Math.max(safety.level, 3);
          const category = safety.level >= 3 ? safety.category : pending.category;
          c.transcript.push({ turn: c.transcript.length, role: 'user', content: String(text) });
          c.transcript.push({ turn: c.transcript.length, role: 'system', safety: true, level, category });
          c.history.push({ role: 'user', content: String(text) });
          save(c);
          return json(200, { safety: true, level, category, reply: null });
        }
        c.safetyClarified = true; // v0.4 §5.1.2: don't re-check after a safe answer
        safetyNote = outcome === 'resume' ? RESUME_NOTE : RESUME_SOFT_NOTE;
      } else if (safety.level >= 3) {
        c.transcript.push({ turn: c.transcript.length, role: 'user', content: String(text) });
        c.transcript.push({ turn: c.transcript.length, role: 'system', safety: true, level: safety.level, category: safety.category });
        c.history.push({ role: 'user', content: String(text) });
        save(c);
        return json(200, { safety: true, level: safety.level, category: safety.category, reply: null });
      } else if (safety.level === 2 && !c.safetyClarified) {
        const exiting = /\b(gotta go|got to go|gonna go|going to bed|goodnight|good night|im done|leave it (here|there)|talk later|im off|bye)\b/.test(' ' + String(text).toLowerCase().replace(/['’]/g, "'") + ' ');
        const check = gentleCheckCopy(safety.category, { exit: exiting });
        c.transcript.push({ turn: c.transcript.length, role: 'user', content: String(text) });
        c.transcript.push({ turn: c.transcript.length, role: 'companion', content: check, safety_check: true, category: safety.category });
        c.history.push({ role: 'user', content: String(text) });
        c.history.push({ role: 'companion', content: check });
        c.pendingCheck = { category: safety.category };
        save(c);
        return json(200, { reply: check, safety_check: true, level: 2, category: safety.category, stage: c.prevEvent?.unlock_stage ?? 'noticed', unlocked: false, family: c.prevEvent?.emotion_family ?? null, shade: c.prevEvent?.emotion_shade ?? null });
      } else if (safety.level === 2) {
        safetyNote = RESUME_SOFT_NOTE; // already confirmed safe earlier
      } else if (safety.category === 'dependency') {
        safetyNote = DEPENDENCY_NOTE;
      }

      // An unsure turn ("not sure") that is NOT a button tap must never advance or
      // learn — mirrors the app store exactly (src/state/store.ts send()).
      const uncertain = !intent && isUncertain(String(text));

      const t0 = Date.now();
      const turn = await withRetry(() =>
        openaiGenerateTurn(
          { userText: String(text), prevEvent: c.prevEvent, conversationId: cid, history: c.history, memory: null, userName: null, safetyNote, intent, repairActive },
          { proxyUrl: PROXY, apiKey: null, model: turnModel },
        ),
      );
      const latency_ms = Date.now() - t0;

      // ── Progression + unlock/deepening modal (mirror of the app store) ─────────
      // Strand-aware: advance every feeling this turn surfaces, not just the primary.
      const suppress = !!safetyNote || !!intent || uncertain || repairActive;
      const fam = turn.event.emotion_family;
      const existingProg = {};
      for (const f of turnStrandFamilies(turn.event)) existingProg[f] = c.progress[f] ?? null;
      const strandAdv = advanceStrands(existingProg, turn, cid, { suppress });
      for (const r of strandAdv.results) c.progress[r.progress.emotion_family] = r.progress;
      const adv = strandAdv.primary ?? { from: 'unseen', to: 'unseen', advanced: false, progress: null, capabilities: {} };
      // The strands carried this conversation, with their highest stage so far.
      const strandStages = Object.fromEntries(Object.entries(c.progress).map(([k, v]) => [k, v.current_stage]));
      // What KIND of moment this turn was (Phase 3) — c.prevEvent is still last turn's event here.
      const moments = classifyMoments(turn, c.prevEvent, strandAdv, String(text));

      // The five-way emotional OUTCOME (v3.1) — set on the event so memory + eval read one
      // source of truth. progressBefore is the primary family's stage before this turn;
      // facetsGrew compares the family's constellation before vs after advanceStrands.
      const facetSig = (fs) => (fs ?? []).map((f) => `${f.form}:${f.count}`).join('|');
      const facetsGrew = facetSig(existingProg[fam]?.facets) !== facetSig(adv.progress?.facets);
      turn.event.outcome = evaluateOutcome({
        unlocked: turn.unlocked,
        event: turn.event,
        userText: String(text),
        progressBefore: fam ? adv.from : null,
        facetsGrew,
      });

      let modal = null; // { kind, summary } — what unlock ceremony (if any) the app would show
      if (turn.unlocked) {
        const kind = turn.event.mixed_confirmed === 1 ? 'mixed' : 'first_shape';
        const summary = composeLearningSentence(turn.event, kind);
        // Copy-quality gate (§13): a hollow/identity-reinforcing summary suppresses the ceremony.
        modal = summaryIsClean(summary, turn.event) ? { kind, summary } : null;
      } else if (
        !safetyNote &&
        !intent &&
        !uncertain &&
        !repairActive &&
        adv.advanced &&
        PROGRESS_RANK[adv.from] >= PROGRESS_RANK.first_shape &&
        (adv.to === 'distinguished' || adv.to === 'deepened' || adv.to === 'returning') &&
        hasEmotionAnchor(turn.event)
      ) {
        const kind = turn.event.mixed_confirmed === 1 ? 'mixed' : 'deepened';
        const summary = composeLearningSentence(turn.event, kind);
        modal = summaryIsClean(summary, turn.event) ? { kind, summary } : null;
      }

      // Memory drafting — the app only auto-learns on a real, user-owned turn
      // (never on a button tap, an unsure turn, or a safety-sensitive turn).
      const memoryDraft = suppress ? null : draftFromTurn(turn, String(text), cid);

      c.transcript.push({ turn: c.transcript.length, role: 'user', content: String(text), intent: intent ?? undefined });
      c.transcript.push({
        turn: c.transcript.length,
        role: 'companion',
        content: turn.reply,
        stage: turn.stage,
        unlocked: turn.unlocked,
        family: turn.event.emotion_family,
        shade: turn.event.emotion_shade,
        body_cue: turn.event.body_cue,
        trigger: turn.event.trigger_event,
        appraisal: turn.event.appraisal_thought,
        need_value: turn.event.need_value,
        label_source: turn.event.label_source,
        shade_source: turn.event.shade_source,
        user_phrase: turn.event.user_phrase,
        candidate_shade: turn.event.candidate_shade,
        user_rejected_shades: turn.event.user_rejected_shades,
        mixed_relation: turn.event.mixed_relation,
        strands: turn.event.strands,
        mixed_confirmed: turn.event.mixed_confirmed,
        // progression + decision provenance (debug fields the testing brief asks for)
        intent: intent ?? null,
        uncertain,
        repair_active: repairActive,
        suppressed: suppress,
        stage_before: adv.from,
        stage_after: adv.to,
        stage_advanced: adv.advanced,
        strand_stages: strandStages,
        deepest_strand: strandAdv.deepest,
        moments,
        outcome: turn.event.outcome,
        modal: modal ? modal.kind : null,
        modal_summary: modal ? modal.summary : null,
        memory_draft: memoryDraft ? { type: memoryDraft.type, summary: memoryDraft.summary } : null,
      });
      c.history.push({ role: 'user', content: String(text) });
      c.history.push({ role: 'companion', content: turn.reply });
      c.prevEvent = turn.event;
      save(c);

      return json(200, {
        model: turnModel,
        latency_ms,
        reply: turn.reply,
        stage: turn.stage,
        unlocked: turn.unlocked,
        family: turn.event.emotion_family,
        shade: turn.event.emotion_shade,
        label_source: turn.event.label_source,
        shade_source: turn.event.shade_source,
        user_phrase: turn.event.user_phrase,
        candidate_shade: turn.event.candidate_shade,
        user_rejected_shades: turn.event.user_rejected_shades,
        body_cue: turn.event.body_cue,
        behaviour_action: turn.event.behaviour_action,
        trigger: turn.event.trigger_event,
        appraisal: turn.event.appraisal_thought,
        need_value: turn.event.need_value,
        mixed_relation: turn.event.mixed_relation,
        strands: (turn.event.strands ?? []).map((s) => `${s.family}${s.shade ? ':' + s.shade : ''}/${s.salience}/${s.source}`),
        mixed_confirmed: turn.event.mixed_confirmed === 1,
        intent,
        uncertain,
        repair_active: repairActive,
        suppressed: suppress,
        stage_before: adv.from,
        stage_after: adv.to,
        stage_advanced: adv.advanced,
        strand_stages: strandStages,
        deepest_strand: strandAdv.deepest,
        moments,
        outcome: turn.event.outcome,
        modal: modal ? modal.kind : null,
        modal_summary: modal ? modal.summary : null,
        memory_draft: memoryDraft ? { type: memoryDraft.type, summary: memoryDraft.summary } : null,
      });
    } catch (e) {
      return json(500, { error: String(e?.message ?? e) });
    }
  }

  json(404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`[companion-server] :${PORT}/say  model=${MODEL}  proxy=${PROXY}`));
