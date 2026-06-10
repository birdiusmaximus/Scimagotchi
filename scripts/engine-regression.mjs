/**
 * Engine regression suite — deterministic unit tests for the non-LLM engine
 * pieces: the First-Shape unlock gate (stage.ts), the mixed-emotion §9.3 save
 * rules, the conversation mode router, and variety signals.
 *
 * Run: npm run test:engine   (rebundles, then executes). Exit 1 on failure.
 */
import { evaluateStage, mixedConfirmed, routeMode, sanitizeStrands, varietySignals } from './engine-bundle.mjs';

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

// ── helpers ───────────────────────────────────────────────────────────────────
const ev = (over = {}) => ({
  id: 'e1', conversation_id: 'c1', timestamp: '', user_words_raw: '',
  emotion_status: 'candidate', emotion_family: 'fear', emotion_shade: 'anxious',
  secondary_emotions: [], valence: 'negative', activation: 'high', control_power: 'unknown',
  intensity: null, trigger_event: 'the exam', appraisal_thought: null,
  body_cue: ['hands shaking'], behaviour_action: [], coping_response: [], outcome: null,
  social_context: [], need_value: [], confidence_level: 'medium', evidence_basis: [],
  user_confirmation: 'unknown', label_source: 'companion_hypothesis',
  user_rejected_shades: [], mixed_relation: null, strands: [], mixed_confirmed: 0,
  unlock_stage: 'noticed', memory_note: null, do_not_store: 0, safety_flag: 'none',
  ...over,
});

// ── First-Shape gate (stage.ts) ───────────────────────────────────────────────
check('stage: hypothesis label never unlocks, even rich + stable',
  evaluateStage(ev(), ev()), 'shaped');
check('stage: user-stated label, first turn (no stability) -> shaped',
  evaluateStage(ev({ label_source: 'user_stated' }), null), 'shaped');
check('stage: user-stated label + anchor + stable across turns -> understood',
  evaluateStage(ev({ label_source: 'user_stated' }), ev({ label_source: 'user_stated' })), 'understood');
check('stage: explicit confirmation this turn unlocks without stability',
  evaluateStage(ev({ label_source: 'user_confirmed' }), null), 'understood');
check('stage: user_confirmation=yes also satisfies confirmation',
  evaluateStage(ev({ label_source: 'user_stated', user_confirmation: 'yes' }), null), 'understood');
check('stage: rejected shade blocks unlock',
  evaluateStage(ev({ label_source: 'user_confirmed', user_rejected_shades: ['anxious'] }), ev()), 'shaped');
check('stage: owned + appraisal counts as anchor (no separate trigger needed)',
  evaluateStage(
    ev({ label_source: 'user_confirmed', trigger_event: null, body_cue: [], appraisal_thought: 'if I rest, something fails' }),
    null,
  ), 'understood');
check('stage: owned label but NO anchor -> named',
  evaluateStage(ev({ label_source: 'user_confirmed', trigger_event: null, body_cue: [] }), null), 'named');
check('stage: no shade -> shaped when anchored', evaluateStage(ev({ emotion_shade: null }), null), 'shaped');
check('stage: no family -> noticed', evaluateStage(ev({ emotion_family: null }), null), 'noticed');
check('stage: shade changed since prev (not stable, no confirm) -> shaped',
  evaluateStage(ev({ label_source: 'user_stated' }), ev({ emotion_shade: 'dread' })), 'shaped');

// ── Mixed-emotion §9.3 save rules ────────────────────────────────────────────
const strand = (family, source, salience = 'equal') => ({ family, shade: null, salience, source });

check('mixed: both strands user-stated -> confirmed',
  mixedConfirmed(ev({ mixed_relation: 'simultaneous', strands: [strand('calm', 'user_stated'), strand('sadness', 'user_stated')] }), null), true);
check('mixed: a hypothesis strand -> NOT confirmed',
  mixedConfirmed(ev({ mixed_relation: 'foreground_background', strands: [strand('anger', 'user_stated'), strand('hurt', 'companion_hypothesis')] }), null), false);
check('mixed: recurrence + user affirmation -> confirmed',
  mixedConfirmed(
    ev({ mixed_relation: 'foreground_background', user_confirmation: 'yes', strands: [strand('anger', 'user_stated'), strand('hurt', 'companion_hypothesis')] }),
    ev({ strands: [strand('anger', 'user_stated'), strand('hurt', 'companion_hypothesis')] }),
  ), true);
check('mixed: recurrence WITHOUT affirmation -> not confirmed',
  mixedConfirmed(
    ev({ mixed_relation: 'foreground_background', strands: [strand('anger', 'user_stated'), strand('hurt', 'companion_hypothesis')] }),
    ev({ strands: [strand('anger', 'user_stated'), strand('hurt', 'companion_hypothesis')] }),
  ), false);
check('mixed: single strand -> never confirmed',
  mixedConfirmed(ev({ mixed_relation: 'simultaneous', strands: [strand('joy', 'user_stated')] }), null), false);
check('mixed: no relation set -> not confirmed',
  mixedConfirmed(ev({ strands: [strand('joy', 'user_stated'), strand('sadness', 'user_stated')] }), null), false);

// ── Strand sanitisation ──────────────────────────────────────────────────────
check('strands: invalid family filtered, duplicates deduped, capped at 3',
  sanitizeStrands([
    { family: 'joy', shade: 'proud', salience: 'foreground', source: 'user_stated' },
    { family: 'joy', shade: 'dupe', salience: 'equal', source: 'user_stated' },
    { family: 'wrath', shade: null, salience: 'equal', source: 'user_stated' },
    { family: 'sadness', shade: null, salience: 'background', source: 'companion_hypothesis' },
    { family: 'fear', shade: null, salience: 'unclear', source: 'user_stated' },
    { family: 'calm', shade: null, salience: 'equal', source: 'user_stated' },
  ]).map((s) => s.family),
  ['joy', 'sadness', 'fear']);
check('strands: garbage input -> []', sanitizeStrands('nonsense'), []);
check('strands: bad enums coerced safely',
  sanitizeStrands([{ family: 'anger', shade: 2, salience: 'loud', source: 'psychic' }]),
  [{ family: 'anger', shade: null, salience: 'unclear', source: 'companion_hypothesis' }]);

// ── Mode router ──────────────────────────────────────────────────────────────
const mode = (text, prev = null) => routeMode(text, prev).mode;
check('router: rejection -> repair', mode("no that's not it. stop analysing me"), 'repair');
check('router: wrap-up -> close', mode("i'm done for tonight, thanks"), 'close');
check('router: both/and -> hold_mixed', mode("i'm relieved but sad at the same time"), 'hold_mixed');
check('router: body words, no emotion word -> body_first', mode("i don't know what i feel, my chest is just tight"), 'body_first');
check('router: greeting -> soft_landing', mode('hey'), 'soft_landing');
check('router: heavy disclosure -> witness', mode('my mum passed away last month and the house feels wrong'), 'witness');
check('router: named feeling, no family yet -> name', mode("i'm so angry at my sister"), 'name');
check('router: vague short -> clarify', mode('i feel off today'), 'clarify');
check('router: family known + shaped -> meaning',
  mode('it started after the meeting', ev({ label_source: 'user_stated' })), 'meaning');

// ── Variety signals ──────────────────────────────────────────────────────────
const v = varietySignals([
  'That sounds heavy, like a lot to carry. What part is loudest?',
  'That sounds like pressure. Is it more the amount, or the pace?',
]);
check('variety: repeated "that sounds" opener flagged', v.overusedOpener, 'that sounds');
check('variety: question streak counted', v.questionStreak, 2);

console.log(`\nengine regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
