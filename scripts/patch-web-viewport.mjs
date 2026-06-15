/**
 * Post-export patch for the Capacitor wrap.
 *
 * Expo Router's static web export controls the viewport <meta> itself and drops any
 * custom `viewport-fit=cover` (verified: it never reaches the built HTML). Inside the
 * Capacitor WebView we NEED it, or env(safe-area-inset-*) resolves to 0 and the layout
 * can't run edge-to-edge under the status bar (the white-bar fix). So we add it back to
 * dist/index.html after every `expo export`.
 *
 * Wired into `npm run build:web`. Idempotent + safe to run twice.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FILE = 'dist/index.html';

if (!existsSync(FILE)) {
  console.error(`patch-web-viewport: ${FILE} not found — run "expo export --platform web" first.`);
  process.exit(1);
}

let html = readFileSync(FILE, 'utf8');
const before = html;

html = html.replace(
  /(<meta[^>]*name=["']viewport["'][^>]*content=["'])([^"']*)(["'][^>]*>)/i,
  (match, pre, content, post) => (/viewport-fit/.test(content) ? match : `${pre}${content}, viewport-fit=cover${post}`),
);

// No viewport meta at all? Inject one right after <head>.
if (!/viewport-fit=cover/.test(html)) {
  html = html.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
}

if (html !== before) {
  writeFileSync(FILE, html);
  console.log(`patch-web-viewport: added viewport-fit=cover to ${FILE}`);
} else {
  console.log('patch-web-viewport: viewport-fit=cover already present — no change');
}
