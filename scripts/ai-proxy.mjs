/**
 * Tiny local dev proxy for the companion's cloud brain.
 *
 * It holds the OpenAI key server-side (read from .env, never bundled into the
 * app) and forwards chat-completion requests, adding CORS headers so the web
 * preview can reach it. Run with: `npm run ai-proxy` (uses node --env-file=.env).
 *
 * This is the recommended production shape too: the client never sees the key.
 */

import http from 'node:http';

const KEY = process.env.OPENAI_API_KEY;
const PORT = Number(process.env.AI_PROXY_PORT) || 8787;
const UPSTREAM = 'https://api.openai.com/v1/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

if (!KEY) {
  console.warn('[ai-proxy] ⚠ No OPENAI_API_KEY in environment. Add it to .env, then restart this proxy.');
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, CORS);
    res.end('Method Not Allowed');
    return;
  }
  if (!KEY) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Proxy has no OPENAI_API_KEY. Set it in .env and restart.' } }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    try {
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body,
      });
      const text = await upstream.text();
      console.log(`[ai-proxy] ${upstream.status} (${text.length} bytes)`);
      res.writeHead(upstream.status, { ...CORS, 'Content-Type': 'application/json' });
      res.end(text);
    } catch (e) {
      console.error('[ai-proxy] upstream error:', e?.message ?? e);
      res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: String(e?.message ?? e) } }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${PORT}/chat → forwarding to OpenAI`);
});
