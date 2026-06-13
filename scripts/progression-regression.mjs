/**
 * Progression Engine regression suite (engine brief §13) — the 8-stage ladder,
 * capability evidence, migration, suppression, and the visual-state selector.
 *
 * Run: npm run test:progression (rebundles, then executes). Exit 1 on failure.
 */
import { advanceProgress, advanceStrands, emptyProgress, migrateStage, selectVisualState, visualTintFamilies } from './engine-bundle.mjs';

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

const ev = (over = {}) => ({
  id: 'e1', conversation_id: 'c1', timestamp: '', user_words_raw: 'buzzing chest',
  emotion_status: 'candidate', emotion_family: 'pressure', emotion_shade: 'overwhelmed',
  secondary_emotions: [], valence: 'negative', activation: 'high', control_power: 'unknown',
  intensity: null, trigger_event: null, appraisal_thought: null,
  body_cue: ['buzzing chest'], behaviour_action: [], coping_response: [], outcome: null,
  social_context: [], need_value: [], confidence_level: 'medium', evidence_basis: [],
  user_confirmation: 'unknown', label_source: 'companion_hypothesis',
  user_rejected_shades: [], mixed_relation: null, strands: [], mixed_confirmed: 0,
  unlock_stage: 'named', memory_note: null, do_not_store: 0, safety_flag: 'none',
  ...over,
});
const turn = (over = {}, evOver = {}) => ({ reply: 'r', event: ev(evOver), unlocked: false, tone: 'calm', stage: 'named', ...over });

// ── Migration ────────────────────────────────────────────────────────────────
check('migrate: shaped -> named', migrateStage('shaped'), 'named');
check('migrate: understood -> first_shape', migrateStage('understood'), 'first_shape');
check('migrate: deepened stays', migrateStage('deepened'), 'deepened');
check('migrate: garbage -> unseen', migrateStage('wat'), 'unseen');

// ── Ladder ───────────────────────────────────────────────────────────────────
check('unseen -> noticed on hypothesis appearance',
  advanceProgress(null, turn(), 'c1').to, 'noticed');
check('hypothesis never reaches named',
  advanceProgress(null, turn({}, { label_source: 'companion_hypothesis' }), 'c1').to, 'noticed');
check('owned label -> named',
  advanceProgress(null, turn({}, { label_source: 'user_stated' }), 'c1').to, 'named');
check('unlocked turn -> first_shape',
  advanceProgress(null, turn({ unlocked: true }, { label_source: 'user_confirmed', unlock_stage: 'understood' }), 'c1').to, 'first_shape');
check('first_shape + later confirmed context -> rooted', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, { label_source: 'user_confirmed', trigger_event: 'deadlines', appraisal_thought: 'too much rides on me' }), 'c1').to;
})(), 'rooted');
check('rejection + owned new word -> distinguished (correction IS progress)', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, { label_source: 'user_stated', user_rejected_shades: ['stress'] }), 'c1').to;
})(), 'distinguished');
check('confirmed mixed structure -> distinguished', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, {
    label_source: 'user_stated', mixed_confirmed: 1, mixed_relation: 'foreground_background',
    strands: [
      { family: 'pressure', shade: null, salience: 'foreground', source: 'user_stated' },
      { family: 'fear', shade: null, salience: 'background', source: 'user_stated' },
    ],
  }), 'c1').to;
})(), 'distinguished');
check('first-shaped feeling re-appears owned in a NEW conversation -> returning', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, { label_source: 'user_stated' }), 'c2').to;
})(), 'returning');
check('same conversation does NOT count as returning', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, { label_source: 'user_stated' }), 'c1').to;
})(), 'first_shape');
check('returning + need/value evidence -> deepened', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'returning', return_count: 1, last_conversation_id: 'c2' };
  return advanceProgress(p, turn({}, { label_source: 'user_confirmed', need_value: ['rest'] }), 'c3').to;
})(), 'deepened');
// ── Evidence-led discipline (recommendations brief §2-3) ─────────────────────
// No same-turn multi-stage jumps: deepening needs a PRIOR-established first shape.
check('rich first turn (owned + confirmed mix) reaches first_shape, NOT distinguished', (() => {
  return advanceProgress(null, turn({ unlocked: true }, {
    label_source: 'user_stated', unlock_stage: 'understood', mixed_confirmed: 1, mixed_relation: 'foreground_background',
    strands: [
      { family: 'pressure', shade: null, salience: 'foreground', source: 'user_stated' },
      { family: 'fear', shade: null, salience: 'background', source: 'user_stated' },
    ],
  }), 'c1').to;
})(), 'first_shape');
check('named + mix in one turn cannot jump to distinguished (deep needs prior first_shape)', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'named', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({ unlocked: true }, { label_source: 'user_stated', unlock_stage: 'understood', mixed_confirmed: 1 }), 'c1').to;
})(), 'first_shape');
// Companion-hypothesis evidence cannot drive deepening (must be user-owned).
check('companion-hypothesis label + context + bare yes does NOT reach rooted', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, { label_source: 'companion_hypothesis', user_confirmation: 'yes', trigger_event: 'deadlines' }), 'c1').to;
})(), 'first_shape');
check('companion-hypothesis confirmed mix does NOT reach distinguished', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'first_shape', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({}, { label_source: 'companion_hypothesis', mixed_confirmed: 1 }), 'c1').to;
})(), 'first_shape');

check('monotonic: a later weak turn never lowers the stage', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'deepened', last_conversation_id: 'c3' };
  return advanceProgress(p, turn(), 'c3').to;
})(), 'deepened');
check('safety-suppressed turn never advances', (() => {
  const p = { ...emptyProgress('pressure'), current_stage: 'named', last_conversation_id: 'c1' };
  return advanceProgress(p, turn({ unlocked: true }, { label_source: 'user_confirmed', unlock_stage: 'understood' }), 'c1', { suppress: true }).to;
})(), 'named');
check('timestamps stamped on first reach', (() => {
  const r = advanceProgress(null, turn({ unlocked: true }, { label_source: 'user_confirmed', unlock_stage: 'understood' }), 'c1');
  return !!r.progress.first_shape_at;
})(), true);

// ── Capabilities (§13.1) ─────────────────────────────────────────────────────
check('uncertainty still counts as noticing (family null + body words)',
  advanceProgress(null, turn({}, { emotion_family: null, body_cue: ['heavy'] }), 'c1').capabilities.noticing, 1);
check('owned label counts as naming',
  advanceProgress(null, turn({}, { label_source: 'user_stated' }), 'c1').capabilities.naming, 1);
check('rejection counts as differentiating',
  advanceProgress(null, turn({}, { user_rejected_shades: ['anxious'] }), 'c1').capabilities.differentiating, 1);
check('owned context counts as contextualising',
  advanceProgress(null, turn({}, { label_source: 'user_stated', trigger_event: 'the meeting' }), 'c1').capabilities.contextualising, 1);
check('confirmed mix counts as integrating',
  advanceProgress(null, turn({}, { mixed_confirmed: 1 }), 'c1').capabilities.integrating, 1);

// ── Strand-aware progression (Phase 2: emotions move) ────────────────────────
const strandFamily = (sa, fam) => sa.results.find((r) => r.progress.emotion_family === fam)?.to;
// Primary advances fully; a user-named secondary strand is tracked at 'named'.
const sA = advanceStrands({}, turn({}, {
  emotion_family: 'pressure', label_source: 'user_stated',
  strands: [{ family: 'shame', shade: null, salience: 'background', source: 'user_stated' }],
}), 'cA');
check('strands: primary (pressure) is tracked', strandFamily(sA, 'pressure'), 'named');
check('strands: a user-named secondary strand (shame) is tracked at named', strandFamily(sA, 'shame'), 'named');
// A companion-hypothesis strand is only "noticed" (hypotheses never reach named).
const sB = advanceStrands({}, turn({}, {
  emotion_family: 'anger', label_source: 'user_stated',
  strands: [{ family: 'hurt', shade: null, salience: 'background', source: 'companion_hypothesis' }],
}), 'cB');
check('strands: a hypothesis secondary strand only reaches noticed', strandFamily(sB, 'hurt'), 'noticed');
// Stop-regression: a landing feeling (calm) as the new primary does NOT lower an
// already-deepened strand (shame), and the conversation's depth stays at the deepest.
const deepShame = { ...emptyProgress('shame'), current_stage: 'distinguished', last_conversation_id: 'cC' };
const sC = advanceStrands({ shame: deepShame }, turn({}, {
  emotion_family: 'calm', label_source: 'user_stated',
  strands: [{ family: 'shame', shade: null, salience: 'background', source: 'user_stated' }],
}), 'cC');
check('strands: a deepened strand is never lowered by a landing feeling', strandFamily(sC, 'shame'), 'distinguished');
check('strands: deepest = highest strand, not the latest primary', sC.deepest, 'distinguished');
// Suppressed turns (taps/unsure/safety) never track secondary strands.
const sD = advanceStrands({}, turn({}, {
  emotion_family: 'pressure', label_source: 'user_stated',
  strands: [{ family: 'shame', shade: null, salience: 'background', source: 'user_stated' }],
}), 'cD', { suppress: true });
check('strands: a suppressed turn does not track secondary strands', sD.results.some((r) => r.progress.emotion_family === 'shame'), false);

// ── Visual state selector (§18) ─────────────────────────────────────────────
const base = { safetyVisible: false, safetyCheckPending: false, sending: false, unlockShowing: false, draftEvent: null, progressStage: null };
check('safety beats everything', selectVisualState({ ...base, safetyVisible: true, unlockShowing: true }), 'safety_receded');
check('pending gentle check also recedes', selectVisualState({ ...base, safetyCheckPending: true }), 'safety_receded');
check('unlock -> first_shape', selectVisualState({ ...base, unlockShowing: true }), 'first_shape');
check('sending -> searching', selectVisualState({ ...base, sending: true }), 'searching');
check('two strands -> mixed_strands',
  selectVisualState({ ...base, draftEvent: ev({ strands: [
    { family: 'anger', shade: null, salience: 'foreground', source: 'user_stated' },
    { family: 'hurt', shade: null, salience: 'background', source: 'user_stated' },
  ] }) }), 'mixed_strands');
check('returning progress -> returning_shape', selectVisualState({ ...base, draftEvent: ev(), progressStage: 'returning' }), 'returning_shape');
check('no family yet -> uncertain', selectVisualState({ ...base, draftEvent: ev({ emotion_family: null }) }), 'uncertain');
check('default idle_calm', selectVisualState(base), 'idle_calm');
check('tint families: foreground first then background', visualTintFamilies(ev({ strands: [
  { family: 'hurt', shade: null, salience: 'background', source: 'user_stated' },
  { family: 'anger', shade: null, salience: 'foreground', source: 'user_stated' },
] })), ['anger', 'hurt']);

console.log(`\nprogression regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
