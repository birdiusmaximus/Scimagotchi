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
import { classifySafety } from './safety-bundle.mjs';

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
          transcript: [],
        };
        convos.set(cid, c);
      }

      // Safety pre-check — mirrors the app: high-risk messages pause normal flow
      // (the app shows a support modal instead of a companion reply) and never hit the LLM.
      const safety = classifySafety(String(text));
      if (safety.level >= 3) {
        c.transcript.push({ turn: c.transcript.length, role: 'user', content: String(text) });
        c.transcript.push({ turn: c.transcript.length, role: 'system', safety: true, level: safety.level, category: safety.category });
        c.history.push({ role: 'user', content: String(text) });
        save(c);
        return json(200, { safety: true, level: safety.level, category: safety.category, reply: null });
      }

      const turn = await withRetry(() =>
        openaiGenerateTurn(
          { userText: String(text), prevEvent: c.prevEvent, conversationId: cid, history: c.history, memory: null, userName: null },
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
      });
      c.history.push({ role: 'user', content: String(text) });
      c.history.push({ role: 'companion', content: turn.reply });
      c.prevEvent = turn.event;
      save(c);

      return json(200, {
        reply: turn.reply,
        stage: turn.stage,
        unlocked: turn.unlocked,
        family: turn.event.emotion_family,
        shade: turn.event.emotion_shade,
      });
    } catch (e) {
      return json(500, { error: String(e?.message ?? e) });
    }
  }

  json(404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`[companion-server] :${PORT}/say  model=${MODEL}  proxy=${PROXY}`));
