/**
 * v3.1 regression suite — the five-way emotional OUTCOME and the state-discipline
 * rules built on it (the central question: "I understand this feeling" vs "I
 * understand we are leaving it unnamed" vs "I have a hypothesis that isn't theirs").
 *
 * Grows across the v3.1 phases. Run: npm run test:v3_1 (rebundles, then executes).
 */
import {
  evaluateOutcome,
  hasEmotionAnchor,
} from './engine-bundle.mjs';

let pass = 0;
let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};

// Minimal EmotionEvent — anchored (body cue + trigger), companion-hypothesis label by default.
const ev = (over = {}) => ({
  id: 'e1', conversation_id: 'c1', timestamp: '', user_words_raw: '',
  emotion_status: 'candidate', emotion_family: 'fear', emotion_shade: 'anxious',
  secondary_emotions: [], valence: 'negative', activation: 'high', control_power: 'unknown',
  intensity: null, trigger_event: 'the exam', appraisal_thought: null,
  body_cue: ['hands shaking'], behaviour_action: [], coping_response: [], outcome: null,
  social_context: [], need_value: [], confidence_level: 'medium', evidence_basis: [],
  user_confirmation: 'unknown', label_source: 'companion_hypothesis', shade_source: null,
  user_phrase: null, candidate_shade: null,
  user_rejected_shades: [], mixed_relation: null, strands: [], mixed_confirmed: 0,
  unlock_stage: 'noticed', memory_note: null, do_not_store: 0, safety_flag: 'none',
  ...over,
});
const out = (over = {}) =>
  evaluateOutcome({ unlocked: false, event: ev(), userText: 'the exam felt heavy', progressBefore: 'named', facetsGrew: false, ...over });

// ── Rule 1: null when nothing emotional is in play ───────────────────────────
check('outcome: no family -> null', out({ event: ev({ emotion_family: null }) }), null);
check('outcome: savouring (do_not_store) -> null', out({ event: ev({ do_not_store: 1 }) }), null);
check('outcome: safety-flagged turn -> null', out({ event: ev({ safety_flag: 'urgent_review' }) }), null);

// ── Rule 2: understood is minted ONLY by a real unlock ───────────────────────
check('outcome: unlocked -> understood', out({ unlocked: true, event: ev({ label_source: 'user_stated' }) }), 'understood');
check('outcome: unlocked outranks a grown facet on the same turn',
  out({ unlocked: true, event: ev({ label_source: 'user_stated' }), facetsGrew: true, progressBefore: 'rooted' }), 'understood');

// ── Rule 3: new_facet only on an ALREADY-established family ───────────────────
check('outcome: owned new form on an established family -> new_facet',
  out({ event: ev({ label_source: 'user_stated', shade_source: 'user_stated', emotion_shade: 'restless' }), facetsGrew: true, progressBefore: 'rooted' }), 'new_facet');
check('outcome: facet growth but family NOT yet first-shaped -> not new_facet',
  out({ event: ev({ label_source: 'user_stated' }), facetsGrew: true, progressBefore: 'named' }), null);
check('outcome: first_shape stage counts as established for new_facet',
  out({ event: ev({ label_source: 'user_confirmed' }), facetsGrew: true, progressBefore: 'first_shape' }), 'new_facet');

// ── Rule 4: held_unnamed — anchored, not owned, user uncertain or exiting ─────
check('outcome: anchor + not owned + uncertain -> held_unnamed',
  out({ userText: "i honestly don't know what it is" }), 'held_unnamed');
check('outcome: anchor + not owned + winding down (exit cue) -> held_unnamed',
  out({ userText: "i think i'll leave it here" }), 'held_unnamed');
check('outcome: held_unnamed ranks above edge_found (uncertain wins)',
  out({ event: ev(), userText: 'not sure, maybe' }), 'held_unnamed');

// ── Rule 5: edge_found — anchor present, label not owned, NOT uncertain ───────
check('outcome: anchor + not owned + steady -> edge_found',
  out({ userText: 'it was right before the exam' }), 'edge_found');

// ── Rule 6: hypothesis — companion guess, NO anchor behind it ─────────────────
const noAnchor = { body_cue: [], behaviour_action: [], trigger_event: null, appraisal_thought: null };
check('outcome: companion guess with no anchor -> hypothesis',
  out({ event: ev({ ...noAnchor, label_source: 'companion_hypothesis' }), userText: 'maybe' }), 'hypothesis');
check('outcome: anchor discriminates edge_found from hypothesis',
  out({ event: ev({ label_source: 'companion_hypothesis' }), userText: 'right after work' }), 'edge_found');

// ── Rule 7: owned-but-unfinished -> null (in progress, nothing durable) ───────
check('outcome: owned label, no unlock, no facet, not established -> null',
  out({ event: ev({ label_source: 'user_stated' }), userText: 'it was the exam' }), null);

// sanity: the fixture is anchored by default (so the rules above are exercised correctly)
check('fixture sanity: default event has an anchor', hasEmotionAnchor(ev()), true);

console.log(`\nv3.1 regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
