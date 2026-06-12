/**
 * Vercel serverless function: the companion's cloud proxy.
 *
 * Holds OPENAI_API_KEY server-side (a Vercel env var, never shipped to the browser)
 * and forwards chat-completion requests to OpenAI. The web client calls this at
 * /api/chat — set EXPO_PUBLIC_AI_PROXY_URL=/api/chat in the build env so it routes
 * here instead of talking to OpenAI directly (which CORS blocks anyway).
 *
 * This mirrors scripts/ai-proxy.mjs (the local dev proxy), in Vercel handler shape.
 */
const UPSTREAM = 'https://api.openai.com/v1/chat/completions';

export default async function handler(req, res) {
  // Same-origin in production, but keep this permissive so previews/tools work too.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method Not Allowed' } });
    return;
  }

  const KEY = process.env.OPENAI_API_KEY;
  if (!KEY) {
    res.status(500).json({ error: { message: 'Proxy has no OPENAI_API_KEY set in this environment.' } });
    return;
  }

  try {
    // Vercel parses a JSON body into req.body; re-serialise it for the upstream call.
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body,
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(502).json({ error: { message: String((e && e.message) || e) } });
  }
}
