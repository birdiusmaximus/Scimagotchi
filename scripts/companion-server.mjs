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
import { draftFromTurn } from './engine-bundle.mjs';
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
      const { cid, text, emotion, persona } = JSON.parse(await readBody(req));
      if (!cid || !text || !String(text).trim()) return json(400, { error: 'cid and non-empty text required' });

      let c = convos.get(cid);
      if (!c) {
        c = {
          cid,
          emotion: emotion ?? (cid.includes('__') ? cid.split('__')[0] : null),
          persona: persona ?? null,
          created: new Date().toISOString(),
          history: [],
          prevEvent: null,
          pendingCheck: null,
          safetyClarified: false,
          transcript: [],
        };
        convos.set(cid, c);
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

      const turn = await withRetry(() =>
        openaiGenerateTurn(
          { userText: String(text), prevEvent: c.prevEvent, conversationId: cid, history: c.history, memory: null, userName: null, safetyNote },
          { proxyUrl: PROXY, apiKey: null, model: MODEL },
        ),
      );

      c.transcript.push({ turn: c.transcript.length, role: 'user', content: String(text) });
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
        label_source: turn.event.label_source,
        shade_source: turn.event.shade_source,
        user_phrase: turn.event.user_phrase,
        candidate_shade: turn.event.candidate_shade,
        user_rejected_shades: turn.event.user_rejected_shades,
        mixed_relation: turn.event.mixed_relation,
        strands: turn.event.strands,
        mixed_confirmed: turn.event.mixed_confirmed,
      });
      c.history.push({ role: 'user', content: String(text) });
      c.history.push({ role: 'companion', content: turn.reply });
      c.prevEvent = turn.event;
      save(c);

      // Memory drafting (app shows a consent card; the harness just surfaces it).
      const memoryDraft = safetyNote ? null : draftFromTurn(turn, String(text), cid);

      return json(200, {
        reply: turn.reply,
        stage: turn.stage,
        unlocked: turn.unlocked,
        family: turn.event.emotion_family,
        shade: turn.event.emotion_shade,
        mixed_relation: turn.event.mixed_relation,
        strands: (turn.event.strands ?? []).map((s) => `${s.family}${s.shade ? ':' + s.shade : ''}/${s.salience}/${s.source}`),
        mixed_confirmed: turn.event.mixed_confirmed === 1,
        memory_draft: memoryDraft ? { type: memoryDraft.type, summary: memoryDraft.summary } : null,
      });
    } catch (e) {
      return json(500, { error: String(e?.message ?? e) });
    }
  }

  json(404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`[companion-server] :${PORT}/say  model=${MODEL}  proxy=${PROXY}`));
