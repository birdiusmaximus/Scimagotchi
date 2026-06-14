/**
 * Engine regression suite — deterministic unit tests for the non-LLM engine
 * pieces: the First-Shape unlock gate (stage.ts), the mixed-emotion §9.3 save
 * rules, the conversation mode router, and variety signals.
 *
 * Run: npm run test:engine   (rebundles, then executes). Exit 1 on failure.
 */
import {
  askedForNamingHelp,
  classifyMoments,
  composeLearningSentence,
  summaryIsClean,
  detectShadeRejection,
  doorwayOf,
  dropTrailingQuestion,
  evaluateStage,
  EXIT_CUE,
  expressionFor,
  firstShapeEvidence,
  hasEmotionAnchor,
  intentDecision,
  isClarifyingQuestion,
  isOptionMenu,
  isUncertain,
  labelIsUserOwned,
  labelNamedByUser,
  mixedConfirmed,
  ambientMotion,
  durationFor,
  EMOTION_BEATS,
  EMOTION_CYCLE_ORDER,
  isDifficultFamily,
  isEmotionLearned,
  learnedFamilies,
  sequenceDuration,
  isPositiveFamily,
  MOTION_CONFIG,
  needsOwnershipRepair,
  poseFor,
  POSE_TARGETS,
  repeatsEarlierQuestion,
  repeatsRecentReflection,
  stripEchoedSentences,
  offersOffRamp,
  stripOffRamp,
  replaceOptionMenu,
  replyContainsDeclarativeEmotionAssertion,
  resolveMotion,
  routeMode,
  sanitizeStrands,
  selectVisualState,
  shadeIsUserOwned,
  SLOW_PATH_FAMILIES,
  softenUnownedEmotionReply,
  stripControlChars,
  stripEmDashes,
  userConfirmsLabel,
  varietyDirective,
  varietySignals,
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
check('stage (v0.4): a single anchor (lone appraisal) is NOT enough — needs 2 signals',
  evaluateStage(
    ev({ label_source: 'user_confirmed', trigger_event: null, body_cue: [], user_words_raw: '', appraisal_thought: 'if I rest, something fails' }),
    null,
  ), 'shaped');
check('stage (v0.4): appraisal + body cue (2 material signals) DOES unlock',
  evaluateStage(
    ev({ label_source: 'user_confirmed', trigger_event: null, body_cue: ['tight chest'], appraisal_thought: 'if I rest, something fails' }),
    null,
  ), 'understood');
check('stage: owned label but NO anchor -> named',
  evaluateStage(ev({ label_source: 'user_confirmed', trigger_event: null, body_cue: [], user_words_raw: '' }), null), 'named');
// Feeling vs scene evidence (brief §1,3,5): context/scene alone never reaches understood.
check('stage: context-only (owned label + trigger + scene phrase, no felt signal) -> shaped, not understood',
  evaluateStage(ev({ label_source: 'user_confirmed', emotion_shade: 'pressured', shade_source: 'companion_hypothesis', trigger_event: 'everyone wants a piece of me at work', user_phrase: 'everyone wants a piece of me at work', body_cue: [], behaviour_action: [], appraisal_thought: null, user_words_raw: '' }), null), 'shaped');
// Vague "foggy"/"off" shade (robustness-sim "uncertain"): a not-yet-located marker can
// shape but never unlock, even when owned + stable across turns.
check('stage: a "foggy" shade, owned + stable, stays shaped (never understood)',
  evaluateStage(
    ev({ emotion_family: 'flat', label_source: 'user_stated', emotion_shade: 'foggy', shade_source: 'user_stated', trigger_event: 'something with my brother', appraisal_thought: 'it doesnt add up' }),
    ev({ emotion_family: 'flat', emotion_shade: 'foggy' }),
  ), 'shaped');
check('stage: a SPECIFIC flat shade ("numb"), owned + stable, DOES unlock',
  evaluateStage(
    ev({ emotion_family: 'flat', label_source: 'user_stated', emotion_shade: 'numb', shade_source: 'user_stated', trigger_event: 'after the funeral', appraisal_thought: 'nothing reaches me' }),
    ev({ emotion_family: 'flat', emotion_shade: 'numb' }),
  ), 'understood');
check('stage: "murky" as a shade is vague -> shaped, not understood',
  evaluateStage(
    ev({ emotion_family: 'flat', label_source: 'user_stated', emotion_shade: 'murky', shade_source: 'user_stated', body_cue: ['heavy'], trigger_event: 'nothing in particular' }),
    ev({ emotion_family: 'flat', emotion_shade: 'murky' }),
  ), 'shaped');
// "off" is NOT vague (the engaged happy-path unlocks on it) — it must still be able to unlock.
check('stage: "off" as a shade is NOT vague -> can unlock',
  evaluateStage(
    ev({ emotion_family: 'hurt', label_source: 'user_stated', emotion_shade: 'off', shade_source: 'user_stated', body_cue: ['hollow'], trigger_event: 'left out of the dinner' }),
    ev({ emotion_family: 'hurt', emotion_shade: 'off' }),
  ), 'understood');
check('stage: a felt body cue makes it understood (feeling signal present)',
  evaluateStage(ev({ label_source: 'user_confirmed', emotion_shade: 'pressured', shade_source: 'companion_hypothesis', trigger_event: 'everyone wants a piece of me at work', body_cue: ['pulled apart'], appraisal_thought: null }), null), 'understood');
check('stage: a user-owned shade is itself a feeling signal -> understood',
  evaluateStage(ev({ label_source: 'user_stated', emotion_shade: 'pulled apart', shade_source: 'user_stated', trigger_event: 'work', user_phrase: 'pulled apart', body_cue: [], appraisal_thought: null, user_confirmation: 'yes' }), null), 'understood');
check('stage: no shade -> shaped when anchored', evaluateStage(ev({ emotion_shade: null }), null), 'shaped');
check('stage: no family -> noticed', evaluateStage(ev({ emotion_family: null }), null), 'noticed');
check('stage: shade changed since prev (not stable, no confirm) -> shaped',
  evaluateStage(ev({ label_source: 'user_stated' }), ev({ emotion_shade: 'dread' })), 'shaped');

// ── First-Shape richness threshold (v0.4 §6.4) ───────────────────────────────
check('richness: counts material signals (trigger + body = 2)', firstShapeEvidence(ev()).materialCount, 2);
check('richness: lone signal counts as 1', firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: '', appraisal_thought: 'x' })).materialCount, 1);
// over-eager-unlock guards (recommendations brief §2-3)
check('richness: an inferred need alone is NOT material', firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: '', appraisal_thought: null, need_value: ['respect', 'autonomy'] })).materialCount, 0);
check('richness: a filler phrase ("just am") is not material', firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: '', appraisal_thought: null, user_phrase: 'just am' })).materialCount, 0);
check('richness: a real 2-word metaphor ("pulled thin") still counts', firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: '', appraisal_thought: null, user_phrase: 'pulled thin' })).materialCount, 1);
check('stage: bare label + "just am" + inferred need does NOT unlock', evaluateStage(
  ev({ label_source: 'user_stated', trigger_event: null, body_cue: [], appraisal_thought: null, user_words_raw: '', user_phrase: 'just am', need_value: ['respect', 'autonomy'] }),
  ev({ label_source: 'user_stated', trigger_event: null, body_cue: [], appraisal_thought: null }),
), 'named');
check('richness: user phrase (3+ words) counts as a signal',
  firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: 'pulled too thin lately' })).userPhraseOrMetaphor, true);
check('richness: mixed-emotion distinction counts',
  firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: '', mixed_confirmed: 1 })).mixedEmotionDistinction, true);
// Slow-path: flat/shame need an extra turn unless very rich.
check('slowpath: flat is a slow-path family', SLOW_PATH_FAMILIES.has('flat'), true);
check('slowpath: shame is a slow-path family', SLOW_PATH_FAMILIES.has('shame'), true);
check('slowpath: flat, 2 signals, confirmed but NOT stable -> not yet understood (shaped)',
  evaluateStage(ev({ emotion_family: 'flat', emotion_shade: 'numb', label_source: 'user_confirmed' }), null), 'shaped');
check('slowpath: flat, 2 signals, stable across a turn -> understood',
  evaluateStage(
    ev({ emotion_family: 'flat', emotion_shade: 'numb', label_source: 'user_confirmed' }),
    ev({ emotion_family: 'flat', emotion_shade: 'numb', label_source: 'user_confirmed' }),
  ), 'understood');
check('slowpath: flat, VERY rich (3 signals) unlocks without the extra turn',
  evaluateStage(
    ev({ emotion_family: 'flat', emotion_shade: 'numb', label_source: 'user_confirmed', user_words_raw: 'just totally blank and far away' }),
    null,
  ), 'understood');
check('slowpath: a non-slow family (fear) still unlocks on 2 signals + confirm, first turn',
  evaluateStage(ev({ label_source: 'user_confirmed' }), null), 'understood');

// ── Shade ownership gate (v0.4 §6.3) ─────────────────────────────────────────
check('shade-own: user said the shade word -> owned', shadeIsUserOwned('dread', 'its mostly dread i think', [], false), true);
check('shade-own: said in earlier user turn -> owned',
  shadeIsUserOwned('dread', 'yeah', [{ role: 'user', content: 'this is dread' }], false), true);
check('shade-own: companion-only shade, user silent -> NOT owned', shadeIsUserOwned('stretched', 'work was a lot', [], false), false);
check('shade-own: accept of the SAME proposed shade -> owned',
  shadeIsUserOwned('stretched', 'yeah thats the word', [], { proposedShade: 'stretched' }), true);
check('shade-own: accept does NOT own a shade the model just SWAPPED in (pulled thin -> stretched)',
  shadeIsUserOwned('stretched', 'yeah pulled thin is exactly it', [], { proposedShade: 'pressure' }), false);
check('shade-own: accept does NOT own it when there was no proposal',
  shadeIsUserOwned('stretched', 'yeah', [], {}), false);
// Echo guard (robustness-sim "shallow_agreement"): a word the companion just supplied,
// repeated by the user who never used it before, is parroting, not owning.
check('shade-own: echoing the companion\'s just-supplied word is NOT owned',
  shadeIsUserOwned('stretched', 'yeah stretched thats it', [{ role: 'companion', content: 'sounds more like being stretched' }], {}), false);
check('shade-own: user said it earlier, even if companion also did -> still owned',
  shadeIsUserOwned('stretched', 'yeah', [{ role: 'user', content: 'i feel stretched' }, { role: 'companion', content: 'stretched then' }], {}), true);
check('shade-own: a prior user mention that was itself an echo does NOT launder into ownership',
  shadeIsUserOwned('stretched', 'hmm', [{ role: 'companion', content: 'sounds stretched' }, { role: 'user', content: 'yeah stretched' }, { role: 'companion', content: 'stretched then' }], {}), false);
check('shade-accept: a bare "yeah" no longer confirms a proposed shade',
  shadeIsUserOwned('stretched', 'yeah', [], { proposedShade: 'stretched' }), false);
check('shade-accept: "yeah thats the word" still confirms a proposed shade',
  shadeIsUserOwned('stretched', 'yeah thats the word', [], { proposedShade: 'stretched' }), true);

// ── Unlock pushback detector (v0.4 §6.3) ─────────────────────────────────────
check('pushback: "no, that doesnt fit" rejects the in-play shade',
  detectShadeRejection("no that doesnt fit", { emotion_shade: 'dread' }), 'dread');
check('pushback: "not quite" rejects the in-play shade',
  detectShadeRejection('hmm, not quite', { emotion_shade: 'guilt' }), 'guilt');
check('pushback: "wrong word" rejects', detectShadeRejection('thats the wrong word honestly', { emotion_shade: 'shame' }), 'shame');
check('pushback: a bare "no" does NOT trigger rejection (too broad)',
  detectShadeRejection('no', { emotion_shade: 'dread' }), null);
check('pushback: acceptance does not trigger rejection',
  detectShadeRejection('yeah thats it', { emotion_shade: 'dread' }), null);
check('pushback: nothing in play -> null', detectShadeRejection('no that doesnt fit', { emotion_shade: null }), null);

// ── Uncertainty + emotion-anchor gates (unlock/deepening bug fix) ─────────────
check('uncertain: "not sure" is uncertainty', isUncertain('not sure'), true);
check('uncertain: "i dont know" is uncertainty', isUncertain("i don't know"), true);
check('uncertain: "hard to say" is uncertainty', isUncertain('hard to say honestly'), true);
check('uncertain: bare "maybe" is uncertainty', isUncertain('maybe'), true);
check('uncertain: bare "i guess" is uncertainty', isUncertain('i guess'), true);
check('uncertain: "unclear" is uncertainty', isUncertain('it is all a bit unclear'), true);
check('uncertain: a clear feeling is NOT uncertainty', isUncertain('i am quite ashamed of myself'), false);
check('uncertain: real detail is NOT uncertainty', isUncertain('i want to hide'), false);
check('uncertain: "not quite" alone is NOT uncertainty (it is a rejection)', isUncertain('not quite'), false);
check('uncertain: "maybe it is anger" (with content) is NOT bare-hedge uncertainty', isUncertain('maybe it is anger'), false);
// Disowning phrases the old regex missed (robustness-sim "uncertain", U6): adverbs
// between "i" and "know", disowning the framing, and "just guessing".
check('uncertain: "i dont even know" is uncertainty', isUncertain("i dont even know what to call it"), true);
check('uncertain: "i really just dont know what this is" is uncertainty', isUncertain('i really just dont know what this is'), true);
check('uncertain: "that might be you putting words on it" is uncertainty', isUncertain('that might be you putting words on it'), true);
check('uncertain: "im just guessing" is uncertainty', isUncertain('honestly im just guessing'), true);
// Must STAY false for genuine confirmations / owned feelings (no new false positives
// that would block a legitimate unlock).
check('uncertain: "yeah thats it" is NOT uncertainty', isUncertain("yeah thats it"), false);
check('uncertain: "it feels like a weight on my chest" is NOT uncertainty', isUncertain('it feels like a weight on my chest'), false);
check('uncertain: "im furious about it" is NOT uncertainty', isUncertain('im furious about it'), false);
// Clarifying-question guard (live bug): asking about the companion's offered words is a
// question to answer, not a feeling being chosen.
check('clarifyingQ: "whats the difference between quiet and settled?" -> true', isClarifyingQuestion("whats the difference between quiet and settled?"), true);
check('clarifyingQ: "what do you mean?" -> true', isClarifyingQuestion('what do you mean?'), true);
check('clarifyingQ: "which one?" -> true', isClarifyingQuestion('which one?'), true);
check('clarifyingQ: "is settled the same as calm?" -> true', isClarifyingQuestion('is settled the same as calm?'), true);
check('clarifyingQ: a feeling question "why do i feel so empty?" -> false', isClarifyingQuestion('why do i feel so empty?'), false);
check('clarifyingQ: a check-in "is that bad?" -> false', isClarifyingQuestion('is that bad?'), false);
check('clarifyingQ: a statement "i think its settled, thats the difference for me" -> false', isClarifyingQuestion("i think its settled, thats the difference for me"), false);
check('clarifyingQ: owning a feeling "yeah, settled" -> false', isClarifyingQuestion('yeah, settled'), false);
// hasEmotionAnchor: a learned moment needs a real, user-owned anchor
check('anchor: a body cue counts', hasEmotionAnchor(ev({ body_cue: ['tight chest'] })), true);
check('anchor: a trigger counts', hasEmotionAnchor(ev({ trigger_event: 'they saw me fail', body_cue: [] })), true);
check('anchor: an appraisal counts', hasEmotionAnchor(ev({ appraisal_thought: 'i am bad', trigger_event: null, body_cue: [] })), true);
check('anchor: a user-owned shade counts', hasEmotionAnchor(ev({ emotion_shade: 'exposed', shade_source: 'user_stated', trigger_event: null, body_cue: [], appraisal_thought: null })), true);
check('anchor: a companion-only shade does NOT count', hasEmotionAnchor(ev({ emotion_shade: 'exposed', shade_source: 'companion_hypothesis', trigger_event: null, body_cue: [], appraisal_thought: null, need_value: [], strands: [], mixed_confirmed: 0 })), false);
check('anchor: an empty/unsure turn has no anchor', hasEmotionAnchor(ev({ emotion_shade: null, trigger_event: null, body_cue: [], behaviour_action: [], appraisal_thought: null, need_value: [], strands: [], mixed_confirmed: 0 })), false);
// composeLearningSentence must never echo "not sure" as a learned phrase
check('learn: never builds a sentence from "not sure"', composeLearningSentence(ev({ emotion_family: 'shame', user_phrase: 'not sure', trigger_event: null, body_cue: [], appraisal_thought: null, user_words_raw: 'not sure' }), 'deepened').toLowerCase().includes('not sure'), false);

// ── Companion learning sentence — restrained templates (brief §6) ────────────
const ls1 = composeLearningSentence(ev({ emotion_family: 'pressure', user_phrase: 'pulled thin', trigger_event: 'everyone needs a piece of me' }), 'first_shape');
check('learn: first shape uses the restrained "has a first shape here" form', /pressure has a first shape here/i.test(ls1), true);
check('learn: first shape embeds the user\'s felt anchor', ls1.includes('pulled thin'), true);
check('learn: ends as a sentence', /[.!?]$/.test(ls1), true);
check('learn: no em or en dashes', !/[—–]/.test(ls1), true);
check('learn: no "you are someone who" overclaim', !/you are someone who/i.test(ls1), true);
check('learn: no "not just X" filler', !/not just/i.test(ls1), true);
const ls2 = composeLearningSentence(ev({ emotion_family: 'fear', user_phrase: 'waiting in the not knowing', trigger_event: null, body_cue: [], appraisal_thought: null, user_words_raw: '' }), 'first_shape');
check('learn: a metaphor phrase is the anchor', /fear has a first shape here: waiting in the not knowing/i.test(ls2), true);
const lsMix = composeLearningSentence(ev({ strands: [{ family: 'anger', shade: null, salience: 'equal', source: 'user_stated' }, { family: 'hurt', shade: null, salience: 'equal', source: 'user_stated' }] }), 'mixed');
check('learn: mixed uses "Two feelings are present" + both families', /two feelings are present: (anger and hurt|hurt and anger)/i.test(lsMix), true);
const lsRel = composeLearningSentence(ev({ mixed_relation: 'foreground_background', strands: [{ family: 'anger', shade: null, salience: 'foreground', source: 'user_stated' }, { family: 'hurt', shade: null, salience: 'background', source: 'user_stated' }] }), 'mixed');
check('learn: mixed names the relationship when known', /one in front and one underneath/i.test(lsRel), true);
const lsDeep = composeLearningSentence(ev({ emotion_family: 'sadness', user_phrase: 'a quiet heaviness', trigger_event: 'sundays' }), 'deepened');
check('learn: deepened uses "became more specific" + anchor', /this became more specific: a quiet heaviness/i.test(lsDeep), true);
check('learn: empty-ish event still yields a safe sentence',
  /first shape/i.test(composeLearningSentence(ev({ emotion_family: 'calm', user_phrase: null, user_words_raw: '', trigger_event: null, body_cue: [], appraisal_thought: null, need_value: [] }), 'first_shape')), true);
const lsDup = composeLearningSentence(ev({ emotion_family: 'pressure', user_phrase: 'everyone wants a piece of me at work', trigger_event: 'everyone wants a piece of me at work', body_cue: [], appraisal_thought: null, need_value: [] }), 'first_shape');
check('learn: never echoes the same fragment twice', (lsDup.toLowerCase().match(/everyone wants a piece of me at work/g) || []).length, 1);
const lsWeak = composeLearningSentence(ev({ emotion_family: 'pressure', user_phrase: 'pressure than stress', trigger_event: 'everyone wants a piece of me', body_cue: [], appraisal_thought: null, need_value: [] }), 'deepened');
check('learn: drops a phrase that just restates the family', /pressure than stress/i.test(lsWeak), false);
check('learn: weak-phrase deepened still anchors on context', /comes up when everyone wants a piece of me/i.test(lsWeak), true);
// Copy validator + identity guard (brief §6,7,13)
check('summary: a clean felt-anchor summary passes', summaryIsClean('Pressure has a first shape here: pulled thin.'), true);
check('summary: the bare generic fallback is rejected', summaryIsClean("This is the first shape of shame you've shown me."), false);
check('summary: an identity-condemnation summary is rejected', summaryIsClean('Shame has a first shape here: i am a bad person.'), false);
check('summary: a "not sure" summary is rejected', summaryIsClean('This became more specific: not sure.'), false);
check('learn: identity self-condemnation never becomes the anchor',
  /bad person|not good enough/i.test(composeLearningSentence(ev({ emotion_family: 'shame', user_phrase: 'im a bad person', appraisal_thought: 'im a bad person', body_cue: ['chest tight'], trigger_event: null }), 'first_shape')), false);

// ── Ownership backstop: the user must name/confirm the feeling (stage.ts) ─────
check('owned: described situation, never named the feeling -> not owned',
  labelIsUserOwned('pressure', 'just feels like more work to do', [], null), false);
check('owned: used a family word this turn -> owned',
  labelIsUserOwned('pressure', 'I feel so overwhelmed', [], null), true);
check('owned: named the family in an earlier user turn -> owned',
  labelIsUserOwned('pressure', 'and it keeps going', [{ role: 'user', content: 'I am so stressed' }], null), true);
check('owned: affirming a family already in play -> owned',
  labelIsUserOwned('pressure', "yeah, that's it", [], { emotion_family: 'pressure' }), true);
check('owned: bare affirmation with no family in play -> not owned',
  labelIsUserOwned('pressure', 'yes exactly', [], null), false);
check('owned: only the companion used the word -> not owned',
  labelIsUserOwned('pressure', 'hmm, maybe', [{ role: 'companion', content: 'sounds like pressure' }], null), false);
// labelNamedByUser is the STRONG half — a bare affirmation must not satisfy it (the
// closing/uncertain backstop relies on this so a goodbye "yeah" can't unlock).
check('named: user used a family word this turn -> named',
  labelNamedByUser('pressure', 'I feel so overwhelmed', []), true);
check('named: named in an earlier user turn -> named',
  labelNamedByUser('pressure', 'and it keeps going', [{ role: 'user', content: 'I am so stressed' }]), true);
check('named: a bare "yeah" affirming a proposal is NOT named-by-user',
  labelNamedByUser('shame', 'yeah. lets leave it there. thanks', [{ role: 'companion', content: 'a self-critical edge' }]), false);
check('named: describing a situation without the feeling word is NOT named',
  labelNamedByUser('shame', 'my brother left and the place is quiet', []), false);
// Bare-yeah no longer owns a label (robustness-sim "terse"): only a label-SPECIFIC
// affirmation does, so a people-pleaser's reflexive assent can't mint a first shape.
check('owned: a bare "yeah" affirming a proposal is NOT enough to own',
  labelIsUserOwned('pressure', 'yeah', [], { emotion_family: 'pressure' }), false);
check('owned: "yeah totally" is NOT enough to own',
  labelIsUserOwned('pressure', 'yeah totally', [], { emotion_family: 'pressure' }), false);
check('owned: "yeah thats the one" (points at the label) DOES own',
  labelIsUserOwned('pressure', 'yeah thats the one', [], { emotion_family: 'pressure' }), true);

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
check('router: "baked into it" -> hold_mixed', mode('the relief has the sadness baked into it'), 'hold_mixed');
check('router: "in the same" -> hold_mixed', mode('the finally and the missing are in the same quiet'), 'hold_mixed');
check('router: "underneath that" -> hold_mixed', mode('on top its anger but underneath that its hurt'), 'hold_mixed');
check('router: body location "underneath my ribs" is NOT mixed', mode('theres a knot underneath my ribs') !== 'hold_mixed', true);
check('router: body words, no emotion word -> body_first', mode("i don't know what i feel, my chest is just tight"), 'body_first');
check('router: greeting -> soft_landing', mode('hey'), 'soft_landing');
check('router: heavy disclosure -> witness', mode('my mum passed away last month and the house feels wrong'), 'witness');
check('router: named feeling, no family yet -> name', mode("i'm so angry at my sister"), 'name');
check('router: vague short -> clarify', mode('i feel off today'), 'clarify');
check('router: family known + shaped -> meaning',
  mode('it started after the meeting', ev({ label_source: 'user_stated' })), 'meaning');
// entry-hint (home chip) biases an ambiguous first turn...
check('router: entry hint witness on a short first message', routeMode('ugh work', null, 'witness').mode, 'witness');
check('router: entry hint body_first when unsure', routeMode('idk really', null, 'body_first').mode, 'body_first');
check('router: entry hint soft_landing for check-in', routeMode('not much, just popping in', null, 'soft_landing').mode, 'soft_landing');
// ...but explicit signals and heavy disclosures still override the hint
check('router: repair overrides entry hint', routeMode("no that's not it", null, 'witness').mode, 'repair');
check('router: heavy disclosure overrides a light check-in hint', routeMode('my mum passed away yesterday', null, 'soft_landing').mode, 'witness');

// ── Sticky savour: a savoured positive stays protected on later warm-detail turns ─
check('savour: explicit "just want to enjoy it" on a positive -> savouring',
  routeMode('i just want to enjoy it', ev({ emotion_family: 'joy' }), null).mode, 'savouring');
check('savour: a savoured positive + neutral warm detail -> stays savouring (no analysis flip)',
  routeMode('my brother called and it felt warm', ev({ emotion_family: 'joy' }), null, { savouredEarlier: true }).mode, 'savouring');
check('savour: WITHOUT an earlier savour, the same turn analyses (meaning)',
  routeMode('my brother called and it felt warm', ev({ emotion_family: 'joy' }), null, { savouredEarlier: false }).mode, 'meaning');
check('savour: a genuine shift to mixed still wins over sticky savour',
  routeMode('happy but also anxious now', ev({ emotion_family: 'joy' }), null, { savouredEarlier: true }).mode, 'hold_mixed');
check('savour: a shift to uncertainty still wins over sticky savour',
  routeMode('i dont know, it feels weird now', ev({ emotion_family: 'joy' }), null, { savouredEarlier: true }).mode, 'body_first');
check('savour: stickiness only applies to positive families',
  routeMode('it still sits with me', ev({ emotion_family: 'sadness' }), null, { savouredEarlier: true }).mode, 'meaning');

// ── Continuation-chip intents (Stay with it / Not quite / I'm done) ──────────
const kgKnown = intentDecision('keep_going', ev({ label_source: 'user_stated' }));
check('intent: keep_going (shaped) -> meaning mode', kgKnown.mode, 'meaning');
check('intent: keep_going directive is STAY WITH IT', /stay with it/i.test(kgKnown.directive), true);
check('intent: keep_going asks exactly one question, no advice', /one question only|one question/i.test(kgKnown.directive) && /no advice/i.test(kgKnown.directive), true);
check('intent: keep_going invites savouring for good feelings', /savour|linger/i.test(kgKnown.directive), true);
check('intent: keep_going with no family yet -> clarify mode', intentDecision('keep_going', null).mode, 'clarify');
check('intent: keep_going unshaped-but-known -> differentiate',
  intentDecision('keep_going', ev({ label_source: 'user_stated', body_cue: [], behaviour_action: [], trigger_event: null })).mode, 'differentiate');
const nq = intentDecision('not_quite', ev());
check('intent: not_quite -> repair mode', nq.mode, 'repair');
check('intent: not_quite acknowledges the miss / drops the label', /not quite/i.test(nq.directive) && /rejected|drop the rejected|never re-propose/i.test(nq.directive), true);
check('intent: not_quite uses maybe/closer/fit language', /closer|fit|shape|maybe/i.test(nq.directive), true);
const dn = intentDecision('done', ev());
check('intent: done -> close mode', dn.mode, 'close');
check('intent: done asks no question (except optional save)', /no question|ask no question/i.test(dn.directive), true);
check('intent: done forbids guilt / neediness', /no guilt|no neediness|never that you will miss/i.test(dn.directive), true);

// ── Repeated-question guard (Stay with it must not re-ask what they answered) ─
const priorQ = ['The way they act sounds like the part getting under your skin. How would you say it in your own words?'];
check('repeatQ: re-asking the same question is caught', repeatsEarlierQuestion('How would you say it in your own words?', priorQ), true);
check('repeatQ: a genuinely new question is fine', repeatsEarlierQuestion('What does it cost you when nothing changes?', priorQ), false);
check('repeatQ: heavy word overlap counts as a repeat',
  repeatsEarlierQuestion('What makes it feel heavy and stuck inside?', ['What makes it feel heavy and stuck?']), true);
check('repeatQ: a reflection with no question is never a repeat',
  repeatsEarlierQuestion('That sounds like it costs you something.', priorQ), false);
check('repeatQ: no prior questions -> not a repeat', repeatsEarlierQuestion('How does that sit with you?', ['I am glad you came by.']), false);
check('intent: keep_going directive says go one step deeper / not re-ask', /one step deeper/i.test(kgKnown.directive) && /do not re-ask|never ask them to/i.test(kgKnown.directive), true);

// ── Repeated-reflection guard (the "stay with it" tap echoing the last reflection) ──
const fearPrev = "One old result from your mum's story seems to be pulling this into the future for you.";
const fearEcho = "One old result from your mum's story seems to be pulling this into the future for you. It sounds like the waiting is being filled in by that memory, over and over.";
check('reflection-repeat: a tap that restates the last reflection is caught', repeatsRecentReflection(fearEcho, [fearPrev]), true);
check('reflection-repeat: a genuinely new reflection is not flagged', repeatsRecentReflection('That bracing sounds exhausting to hold all week.', [fearPrev]), false);
check('reflection-repeat: a question is not treated as a repeated reflection', repeatsRecentReflection('What does the waiting make you want to do?', [fearPrev]), false);
check('reflection-repeat: strip drops the echoed sentence, keeps the new one',
  stripEchoedSentences(fearEcho, fearPrev), 'It sounds like the waiting is being filled in by that memory, over and over.');
check('reflection-repeat: strip leaves a non-echoing reply intact',
  stripEchoedSentences('That bracing sounds exhausting.', fearPrev), 'That bracing sounds exhausting.');

// ── Off-ramp guard (no exit offered right after a "stay with it" tap) ──────────
check('offramp: "would you rather keep it unnamed" is an off-ramp', offersOffRamp('Would you rather keep it unnamed for now?'), true);
check('offramp: "we can leave it there..." is an off-ramp', offersOffRamp('We can leave it there, or stay with it a little longer if you want.'), true);
check('offramp: a plain reflection is not an off-ramp', offersOffRamp('That invisible feeling carries a real ache.'), false);
check('offramp: strip drops the exit question, keeps the reflection',
  stripOffRamp('That invisible feeling carries a real ache. Would you rather keep it unnamed for now?'), 'That invisible feeling carries a real ache.');
check('offramp: strip leaves a reflection-only reply intact',
  stripOffRamp('That invisible feeling carries a real ache.'), 'That invisible feeling carries a real ache.');

// ── Em-dash stripping (companion never shows long dashes) ────────────────────
check('strip: spaced em dash -> comma', stripEmDashes('Go ahead — say whatever’s there'), 'Go ahead, say whatever’s there');
check('strip: en dash too', stripEmDashes('worn down – not the other thing'), 'worn down, not the other thing');
check('strip: dash before a question', stripEmDashes('I’m here — what’s on your mind?'), 'I’m here, what’s on your mind?');
check('strip: tight em dash', stripEmDashes('a lot—really a lot'), 'a lot, really a lot');
check('strip: trailing dash leaves no trailing comma', stripEmDashes('okay then —'), 'okay then');
check('strip: dash before full stop collapses', stripEmDashes('that’s it —.'), 'that’s it.');
check('strip: keeps ordinary hyphens', stripEmDashes('self-harm and worn-down feelings'), 'self-harm and worn-down feelings');
check('strip: no dash is unchanged', stripEmDashes('That feels like a lot today.'), 'That feels like a lot today.');

// ── Control-char scrub (the "That" glitch the benchmark surfaced) ───────────
check('ctrl: strips a mid-word control char', stripControlChars('That feels nice'), 'That feels nice');
check('ctrl: strips DEL', stripControlChars('warmth'), 'warmth');
check('ctrl: keeps tab and newline', stripControlChars('a\tb\nc'), 'a\tb\nc');
check('ctrl: clean text is unchanged', stripControlChars('That feels nice.'), 'That feels nice.');

// ── Variety signals ──────────────────────────────────────────────────────────
const v = varietySignals([
  'That sounds heavy, like a lot to carry. What part is loudest?',
  'That sounds like pressure. Is it more the amount, or the pace?',
]);
check('variety: repeated "that sounds" opener flagged', v.overusedOpener, 'that sounds');
check('variety: question streak counted', v.questionStreak, 2);
// repeated label-seeking prompt suppression (recommendations brief §6)
const vLabel = varietySignals(['What word feels closest?', 'That sounds heavy to carry.']);
check('variety: label-seeking prompt counted', vLabel.labelSeekInConvo, 1);
check('variety: bans repeating the label-seeking prompt', /what word feels closest/i.test(varietyDirective(vLabel)) && /do not ask/i.test(varietyDirective(vLabel)), true);

// ── Doorway rotation + no-repeat fork (persona-flow benchmark fixes #1-2) ─────
// doorwayOf classifies the question-type a reply opens (or 'reflection' if none).
check('doorway: body question -> body', doorwayOf('Where do you feel it in your body?'), 'body');
check('doorway: impulse question -> impulse', doorwayOf('What does it make you want to do?'), 'impulse');
check('doorway: context question -> context', doorwayOf('What was happening when it showed up?'), 'context');
check('doorway: meaning question -> meaning', doorwayOf('What does it mean to you?'), 'meaning');
check('doorway: metaphor question -> metaphor', doorwayOf('If it had a shape or colour, what would it be?'), 'metaphor');
check('doorway: label-seek question -> word', doorwayOf('What word feels closest?'), 'word');
check('doorway: relationship question -> relationship', doorwayOf('Was that with him, or someone else?'), 'relationship');
check('doorway: a reply with no question -> reflection', doorwayOf('That sounds heavy to carry.'), 'reflection');
check('doorway: a question matching no door -> other', doorwayOf('Does that fit?'), 'other');
// recentDoorways tracks the last two turns; the directive fires when the same door repeats.
const vDoor = varietySignals(['What does this mean to you?', 'What is this about, underneath?']);
check('doorway: recentDoorways records both turns', vDoor.recentDoorways, ['meaning', 'meaning']);
check('doorway: rotation directive fires when the same door repeats',
  /opened the "meaning" door the last two turns/i.test(varietyDirective(vDoor)), true);
// A varied history (body then impulse) must NOT trigger the rotation note.
const vVaried = varietySignals(['Where do you feel it most?', 'What does it make you want to do?']);
check('doorway: rotation directive silent on a varied history',
  /opened the ".*" door the last two turns/i.test(varietyDirective(vVaried)), false);
// FORK_RX catches the "stay with this, or leave it here" choice; the directive bans a repeat.
const vFork = varietySignals(['We can stay with this, or leave it here for now.']);
check('doorway: a stay/leave fork is counted', vFork.forkInLast2, 1);
check('doorway: no-fork directive fires after a fork',
  /do NOT offer that same fork again/i.test(varietyDirective(vFork)), true);
check('doorway: no-fork directive silent without a fork', vVaried.forkInLast2, 0);

// ── Visible-reply ownership gate (§5.1) ──────────────────────────────────────
check('ownership: declarative "this is X" is an assertion',
  replyContainsDeclarativeEmotionAssertion('This is fear, plainly.', ev()), true);
check('ownership: tentative "could this be X" is NOT an assertion',
  replyContainsDeclarativeEmotionAssertion('Could this be fear, or not quite?', ev()), false);
check('ownership: "the X underneath" is an assertion',
  replyContainsDeclarativeEmotionAssertion('The anxious underneath is clear here.', ev()), true);
check('ownership: plain witness is not an assertion',
  replyContainsDeclarativeEmotionAssertion('That sounds like a lot to carry.', ev()), false);
check('ownership: needs repair when unowned + asserted', needsOwnershipRepair('This is fear.', ev(), false), true);
check('ownership: no repair when the user owns the label', needsOwnershipRepair('This is fear.', ev(), true), false);
check('ownership: no repair when nothing is asserted', needsOwnershipRepair('We can stay with it a moment.', ev(), false), false);
check('ownership: softener makes "this is X" tentative', /might be (a )?fear/i.test(softenUnownedEmotionReply('This is fear.', ev())), true);

// ── Capture confirmation consolidation (§5.5) ────────────────────────────────
check('confirm: strong accept of an in-play family', userConfirmsLabel('yeah thats it', ev()), true);
check('confirm: "thats it" consolidates', userConfirmsLabel('thats it', ev()), true);
check('confirm: bare "yeah ok" does NOT consolidate (no premature unlock)', userConfirmsLabel('yeah ok', ev()), false);
check('confirm: no family in play -> not a confirmation', userConfirmsLabel('thats it', { emotion_family: null }), false);

// ── Unlock-turn rest (§5.3) ──────────────────────────────────────────────────
check('rest: drops a trailing question after a statement',
  dropTrailingQuestion('That has a clearer shape now. Does that fit?'), 'That has a clearer shape now.');
check('rest: leaves a question-free reply alone',
  dropTrailingQuestion('That has a clearer shape now.'), 'That has a clearer shape now.');
check('rest: will not empty a single-question reply', dropTrailingQuestion('Does that fit?'), 'Does that fit?');

// ── Scaffold detection (§5.2) ────────────────────────────────────────────────
check('scaffold: "centre of this" counted',
  varietySignals(['"caring" feels like the centre of this. is it more X or Y?']).centrePhrasesInConvo, 1);
check('scaffold: quote-first opening counted', varietySignals(['"i feel weird" you said, and it lingers.']).quoteFirstInLast3, 1);
check('scaffold: either-or question counted', varietySignals(['is it more hurt or shame?']).eitherOrInLast3, 1);
check('scaffold: plain reflection has no scaffold flags',
  (() => { const s = varietySignals(['That sounds heavy today.']); return s.centrePhrasesInConvo + s.quoteFirstInLast3 + s.eitherOrInLast3; })(), 0);

// ── Option-menu cap (v0.4 §4.1/§6.2) ─────────────────────────────────────────
check('menu: "is it more X or Y?" is a menu', isOptionMenu('Is it more loneliness or relief?'), true);
check('menu: "more X, Y, or Z?" is a menu', isOptionMenu('Is it more tired, flat, or restless?'), true);
check('menu: "X, Y, or something else?" is a menu', isOptionMenu('Heavy, tense, or something else?'), true);
check('menu: "does it feel X or Y?" is a menu', isOptionMenu('Does it feel sharp or dull?'), true);
check('menu: comma before "or" still counts ("is it more X, or does it Y?")',
  isOptionMenu('Is it more like they happen at once, or does it shift between them?'), true);
check('menu: mixed "side by side, or one underneath?" is a menu', isOptionMenu('Are they side by side, or one underneath the other?'), true);
check('menu: plain witnessing is NOT a menu', isOptionMenu('That sounds like it cost something to say.'), false);
check('menu: an open question is NOT a menu', isOptionMenu('What word feels closest?'), false);
check('menu: signal counts menus across the conversation',
  varietySignals(['Is it more anger or hurt?', 'That makes sense.', 'Is it sharp, heavy, or numb?']).optionMenusInConvo, 2);
check('menu: directive fires once a menu has been used',
  /already offered an option menu/i.test(varietyDirective(varietySignals(['Is it more anger or hurt?']))), true);
// replaceOptionMenu swaps the menu sentence for an open question, keeps the reflection.
const swapped = replaceOptionMenu('That word carries weight. Is it more guilt or shame?', 0);
check('menu: replace keeps the reflection', /that word carries weight\./i.test(swapped), true);
check('menu: replace drops the either/or', isOptionMenu(swapped), false);
check('menu: replace lands on an open question', /\?$/.test(swapped), true);
check('menu: replace varies the open question by index',
  replaceOptionMenu('Is it X or Y?', 0) !== replaceOptionMenu('Is it X or Y?', 1), true);
check('menu: replace index wraps deterministically',
  replaceOptionMenu('Is it X or Y?', 0) === replaceOptionMenu('Is it X or Y?', 5), true);
// The swap must never land on another menu, and never reuse the previous turn's door
// (the repeat-"Where do you notice it most?" bug the live replay surfaced).
check('menu: replace never lands on another menu question',
  isOptionMenu(replaceOptionMenu('Is it more A, B, or C?', 3)), false);
check('menu: replace avoids the prior turn\'s doorway',
  doorwayOf(replaceOptionMenu('Is it X or Y?', 0, 'body')) !== 'body', true);
check('menu: two consecutive menu swaps open different doors',
  doorwayOf(replaceOptionMenu('Is it X or Y?', 0, null)) !== doorwayOf(replaceOptionMenu('Is it more X, Y, or Z?', 1, 'body')), true);

// ── Naming-help + exit cues (v0.4 §6.2/§6.3) ─────────────────────────────────
check('naming: "what\'s the word for this?" asks for naming help', askedForNamingHelp("what's the word for this?"), true);
check('naming: "help me name it" asks for naming help', askedForNamingHelp('can you help me name it'), true);
check('naming: ordinary venting does not ask for naming help', askedForNamingHelp('work was just a lot today'), false);
check('exit: "gotta go" is an exit cue', EXIT_CUE.test('ok i gotta go now'), true);
check('exit: "goodnight" is an exit cue', EXIT_CUE.test('goodnight'), true);
check('exit: ordinary message is not an exit cue', EXIT_CUE.test('i feel a bit lighter'), false);

// ── Companion aliveness: visual state + per-emotion expression (§6) ──────────
const vis = (over = {}) => selectVisualState({
  safetyVisible: false, safetyCheckPending: false, sending: false, unlockShowing: false,
  draftEvent: null, progressStage: null, ...over,
});
check('visual: safety always wins', vis({ safetyVisible: true, unlockShowing: true }), 'safety_receded');
check('visual: unlock -> first_shape', vis({ unlockShowing: true }), 'first_shape');
check('visual: sending -> searching', vis({ sending: true }), 'searching');
check('visual: owned family + shade -> stabilising',
  vis({ draftEvent: { emotion_family: 'sadness', emotion_shade: 'heavy', label_source: 'user_confirmed', strands: [] } }), 'stabilising');
check('visual: family-less draft -> uncertain',
  vis({ draftEvent: { emotion_family: null, emotion_shade: null, label_source: 'companion_hypothesis', strands: [] } }), 'uncertain');
check('visual: nothing -> idle_calm', vis(), 'idle_calm');

// ── Companion pose / motion system (arm-orb animation brief) ─────────────────
const MOTION_STATES = ['calm','greeting','listening','thinking','curious','stayWithIt','notQuite','positive','difficult','mixed','firstShape','memorySaved','done','safety'];
check('pose: every motion state has a full pose', MOTION_STATES.every((s) => POSE_TARGETS[s] && POSE_TARGETS[s].body && POSE_TARGETS[s].leftArm && POSE_TARGETS[s].rightArm && POSE_TARGETS[s].glow), true);
check('pose: arms are detached on opposite sides (L left, R right) in calm',
  POSE_TARGETS.calm.leftArm.x < 0 && POSE_TARGETS.calm.rightArm.x > 0, true);
check('pose: calm arms sit just below the body centre', POSE_TARGETS.calm.leftArm.y > 0 && POSE_TARGETS.calm.rightArm.y > 0, true);
check('pose: positive opens the arms wider than calm', Math.abs(POSE_TARGETS.positive.leftArm.x) > Math.abs(POSE_TARGETS.calm.leftArm.x), true);
check('pose: thinking gathers the arms inward', Math.abs(POSE_TARGETS.thinking.leftArm.x) < Math.abs(POSE_TARGETS.calm.leftArm.x), true);
check('pose: mixed is asymmetric (arms differ)', Math.abs(POSE_TARGETS.mixed.leftArm.x) !== Math.abs(POSE_TARGETS.mixed.rightArm.x) || POSE_TARGETS.mixed.leftArm.y !== POSE_TARGETS.mixed.rightArm.y, true);
check('pose: safety recedes (small body) and fades the arms', POSE_TARGETS.safety.body.scale < 1 && POSE_TARGETS.safety.leftArm.opacity < 0.5, true);
check('pose: firstShape brightens + steadies the glow', POSE_TARGETS.firstShape.glow.opacity > POSE_TARGETS.calm.glow.opacity, true);
check('pose: no pose exceeds the max scale guardrail', MOTION_STATES.every((s) => POSE_TARGETS[s].body.scale <= MOTION_CONFIG.maxScale && POSE_TARGETS[s].glow.scale <= MOTION_CONFIG.maxScale + 0.001), true);
check('pose: poseFor falls back to calm for an unknown state', poseFor('nonsense') === POSE_TARGETS.calm, true);

// ambientMotion + resolveMotion priority (safety > firstShape > gesture > ambient)
check('motion: searching -> thinking', ambientMotion('searching', null), 'thinking');
check('motion: idle + difficult family -> difficult', ambientMotion('idle_calm', 'sadness'), 'difficult');
check('motion: idle + positive family -> positive', ambientMotion('idle_calm', 'joy'), 'positive');
check('motion: idle + no family -> calm', ambientMotion('idle_calm', null), 'calm');
check('motion: mixed_strands -> mixed', ambientMotion('mixed_strands', null), 'mixed');
check('motion: stabilising -> curious', ambientMotion('stabilising', 'fear'), 'curious');
check('motion: safety beats a tapped gesture', resolveMotion('safety_receded', 'joy', 'stayWithIt'), 'safety');
check('motion: a landing first shape beats a tapped gesture', resolveMotion('first_shape', 'sadness', 'notQuite'), 'firstShape');
check('motion: a tapped gesture overrides ambient calm', resolveMotion('idle_calm', null, 'stayWithIt'), 'stayWithIt');
check('motion: no gesture -> ambient', resolveMotion('idle_calm', 'joy', null), 'positive');
check('motion: family valence helpers', isDifficultFamily('shame') && isPositiveFamily('calm') && !isPositiveFamily('anger'), true);
check('motion: difficult states are slower than positive', durationFor('difficult') > durationFor('positive'), true);
check('motion: safety is a quick, direct move', durationFor('safety') < durationFor('calm'), true);

// ── Learned-emotion animations + home double-tap eligibility (animation brief) ─
check('learned: first_shape counts as learned', isEmotionLearned('first_shape'), true);
check('learned: deepened counts as learned', isEmotionLearned('deepened'), true);
check('learned: returning counts as learned', isEmotionLearned('returning'), true);
check('learned: named does NOT count (only a guess/partial)', isEmotionLearned('named'), false);
check('learned: noticed does NOT count', isEmotionLearned('noticed'), false);
check('learned: null/unseen does NOT count', isEmotionLearned(null) || isEmotionLearned('unseen'), false);
check('learned: families filter to learned ones in cycle order',
  JSON.stringify(learnedFamilies({ joy: { current_stage: 'deepened' }, sadness: { current_stage: 'first_shape' }, anger: { current_stage: 'named' }, fear: { current_stage: 'first_shape' } })),
  JSON.stringify(['joy', 'sadness', 'fear']));
check('learned: empty progress -> no learned families', learnedFamilies({}).length, 0);
check('cycle: canonical order covers the 9 families', EMOTION_CYCLE_ORDER.length, 9);
check('beats: every cycle family has a non-empty sequence', EMOTION_CYCLE_ORDER.every((f) => (EMOTION_BEATS[f]?.length ?? 0) >= 2), true);
check('beats: joy is a recognisable multi-beat lift', EMOTION_BEATS.joy.length >= 3 && EMOTION_BEATS.joy.some((b) => (b.body?.y ?? 0) < -0.1), true);
check('beats: sadness lowers the body (positive y)', EMOTION_BEATS.sadness.some((b) => (b.body?.y ?? 0) > 0.1), true);
check('beats: sequence duration is in the 2-4s embodied range', sequenceDuration('joy') > 1500 && sequenceDuration('joy') < 4000, true);

check('expr: sadness sinks', expressionFor('sadness', 'idle_calm').sink > 0, true);
check('expr: joy lifts', expressionFor('joy', 'idle_calm').sink < 0, true);
check('expr: flat is low-energy', expressionFor('flat', 'idle_calm').energy < 0.5, true);
check('expr: fear trembles', expressionFor('fear', 'idle_calm').tremor > 0, true);
check('expr: shame draws inward', expressionFor('shame', 'idle_calm').contract > 0, true);
check('expr: safety drops theatrics (no tremor/pulse)',
  (() => { const e = expressionFor('fear', 'safety_receded'); return e.tremor === 0 && e.pulse === 0; })(), true);
check('expr: clarity settles anger (less pulse than exploring)',
  expressionFor('anger', 'first_shape').pulse < expressionFor('anger', 'idle_calm').pulse, true);
check('expr: a sad first shape stays low, not happy',
  expressionFor('sadness', 'first_shape').sink > 0.3, true);

// ── Typed conversational moments (Phase 3 momentType.ts) ──────────────────────
const mk = (event, unlocked = false) => ({ event, unlocked });
const sa = (fams) => ({
  results: fams.map(([f, to]) => ({ progress: { emotion_family: f }, to, from: 'unseen', advanced: true, capabilities: {} })),
  primary: null,
  deepest: fams.length ? fams[fams.length - 1][1] : 'unseen',
});
const has = (m, t) => m.includes(t);

check('moment: unlock turn yields "unlocked"',
  has(classifyMoments(mk(ev(), true), null, null, 'it just clicked'), 'unlocked'), true);
check('moment: focus moving anger -> shame is a "shift"',
  has(classifyMoments(mk(ev({ emotion_family: 'shame', label_source: 'user_stated' })), ev({ emotion_family: 'anger', label_source: 'user_stated' }), null, 'x'), 'shift'), true);
check('moment: first naming (no prior feeling) is NOT a shift',
  has(classifyMoments(mk(ev({ emotion_family: 'anger', label_source: 'user_stated' })), null, null, 'x'), 'shift'), false);
check('moment: newly-confirmed mixed is "mixed_found"',
  has(classifyMoments(mk(ev({ mixed_confirmed: 1 })), ev({ mixed_confirmed: 0 }), null, 'x'), 'mixed_found'), true);
check('moment: already-confirmed mixed does NOT refire mixed_found',
  has(classifyMoments(mk(ev({ mixed_confirmed: 1 })), ev({ mixed_confirmed: 1 }), null, 'x'), 'mixed_found'), false);
check('moment: calm after sadness is a "landing"',
  has(classifyMoments(mk(ev({ emotion_family: 'calm', valence: 'positive' })), ev({ emotion_family: 'sadness' }), null, 'x'), 'landing'), true);
check('moment: calm after a difficult strand took shape is a "landing"',
  has(classifyMoments(mk(ev({ emotion_family: 'calm' })), null, sa([['sadness', 'first_shape']]), 'x'), 'landing'), true);
check('moment: calm with no prior difficulty is NOT a landing',
  has(classifyMoments(mk(ev({ emotion_family: 'calm' })), ev({ emotion_family: 'joy' }), sa([['calm', 'named']]), 'x'), 'landing'), false);
check('moment: "i think i\'ll call my brother" is a repair_intention',
  has(classifyMoments(mk(ev()), null, null, "i think i'll call my brother tomorrow"), 'repair_intention'), true);
check('moment: "i want her to see me" is NOT a repair_intention',
  has(classifyMoments(mk(ev()), null, null, 'i just want her to see me'), 'repair_intention'), false);
check('moment: "if i push back she gets this look" surfaces a hidden_rule',
  has(classifyMoments(mk(ev()), null, null, 'if i push back she gets this look'), 'hidden_rule'), true);
check('moment: a hidden rule in the appraisal_thought also counts',
  has(classifyMoments(mk(ev({ appraisal_thought: "i'm not allowed to take up space" })), null, null, 'dunno'), 'hidden_rule'), true);
check('moment: a sharpened shade (owned, no unlock) is "clarified"',
  has(classifyMoments(mk(ev({ emotion_shade: 'dread', shade_source: 'user_confirmed' })), ev({ emotion_shade: 'anxious' }), null, 'x'), 'clarified'), true);
check('moment: a freshly rejected shade is "clarified"',
  has(classifyMoments(mk(ev({ user_rejected_shades: ['anxious'] })), ev({ user_rejected_shades: [] }), null, 'x'), 'clarified'), true);
check('moment: an unlock is not also tagged "clarified"',
  has(classifyMoments(mk(ev({ emotion_shade: 'dread', shade_source: 'user_confirmed' }), true), ev({ emotion_shade: 'anxious' }), null, 'x'), 'clarified'), false);

console.log(`\nengine regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
