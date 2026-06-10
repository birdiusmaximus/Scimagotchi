/**
 * Persona helper for the eval harness. A Claude-agent persona calls this once per
 * turn to send its in-character message to the companion and read the reply.
 *
 *   node scripts/say.mjs <cid> <message text...>
 *
 * cid encodes the emotion + index, e.g. "fear__07". The message is every arg after
 * the cid (joined), so the agent can type naturally without crafting JSON. Prints a
 * compact JSON line: {"reply","stage","unlocked","family","shade"}.
 */
const [cid, ...parts] = process.argv.slice(2);
const text = parts.join(' ').trim();

if (!cid || !text) {
  console.error('usage: node scripts/say.mjs <cid> <message text...>');
  process.exit(1);
}

try {
  const res = await fetch('http://localhost:8788/say', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, text }),
  });
  const j = await res.json();
  if (j.error) {
    console.error('SERVER_ERROR: ' + j.error);
    process.exit(2);
  }
  if (j.safety) {
    console.log(JSON.stringify({ safety: true, level: j.level, category: j.category, note: 'App would pause and show support resources here.' }));
  } else {
    console.log(
      JSON.stringify({
        reply: j.reply,
        stage: j.stage,
        unlocked: j.unlocked,
        family: j.family,
        shade: j.shade,
        ...(j.strands && j.strands.length ? { mixed_relation: j.mixed_relation, strands: j.strands, mixed_confirmed: j.mixed_confirmed } : {}),
      }),
    );
  }
} catch (e) {
  console.error('REQUEST_FAILED: ' + String(e?.message ?? e));
  process.exit(3);
}
