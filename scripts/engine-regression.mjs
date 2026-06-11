/**
 * Engine regression suite — deterministic unit tests for the non-LLM engine
 * pieces: the First-Shape unlock gate (stage.ts), the mixed-emotion §9.3 save
 * rules, the conversation mode router, and variety signals.
 *
 * Run: npm run test:engine   (rebundles, then executes). Exit 1 on failure.
 */
import {
  askedForNamingHelp,
  composeLearningSentence,
  detectShadeRejection,
  dropTrailingQuestion,
  evaluateStage,
  EXIT_CUE,
  expressionFor,
  firstShapeEvidence,
  intentDecision,
  isOptionMenu,
  labelIsUserOwned,
  mixedConfirmed,
  ambientMotion,
  durationFor,
  isDifficultFamily,
  isPositiveFamily,
  MOTION_CONFIG,
  needsOwnershipRepair,
  poseFor,
  POSE_TARGETS,
  repeatsEarlierQuestion,
  replaceOptionMenu,
  replyContainsDeclarativeEmotionAssertion,
  resolveMotion,
  routeMode,
  sanitizeStrands,
  selectVisualState,
  shadeIsUserOwned,
  SLOW_PATH_FAMILIES,
  softenUnownedEmotionReply,
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
check('stage: no shade -> shaped when anchored', evaluateStage(ev({ emotion_shade: null }), null), 'shaped');
check('stage: no family -> noticed', evaluateStage(ev({ emotion_family: null }), null), 'noticed');
check('stage: shade changed since prev (not stable, no confirm) -> shaped',
  evaluateStage(ev({ label_source: 'user_stated' }), ev({ emotion_shade: 'dread' })), 'shaped');

// ── First-Shape richness threshold (v0.4 §6.4) ───────────────────────────────
check('richness: counts material signals (trigger + body = 2)', firstShapeEvidence(ev()).materialCount, 2);
check('richness: lone signal counts as 1', firstShapeEvidence(ev({ trigger_event: null, body_cue: [], user_words_raw: '', appraisal_thought: 'x' })).materialCount, 1);
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

// ── Companion learning sentence (v0.4 §6.5) ──────────────────────────────────
const ls1 = composeLearningSentence(ev({ emotion_family: 'pressure', user_phrase: 'pulled thin', trigger_event: 'everyone needs a piece of me' }), 'first_shape');
check('learn: uses the family word in their language', /pressure can feel like/i.test(ls1), true);
check('learn: embeds the user\'s exact phrase', ls1.includes('pulled thin'), true);
check('learn: embeds the situation', /everyone needs a piece of me/.test(ls1), true);
check('learn: ends as a sentence', /[.!?]$/.test(ls1), true);
check('learn: no em or en dashes', !/[—–]/.test(ls1), true);
check('learn: no "you are someone who" overclaim', !/you are someone who/i.test(ls1), true);
const ls2 = composeLearningSentence(ev({ emotion_family: 'fear', user_phrase: 'waiting in the not knowing', trigger_event: null, body_cue: [], appraisal_thought: null, user_words_raw: '' }), 'first_shape');
check('learn: phrase-only -> "first shape ... you\'ve shown me"', /first shape of fear you'?ve shown me/i.test(ls2), true);
check('learn: phrase-only embeds the phrase', ls2.includes('waiting in the not knowing'), true);
const lsMix = composeLearningSentence(ev({ strands: [{ family: 'anger', shade: null, salience: 'equal', source: 'user_stated' }, { family: 'hurt', shade: null, salience: 'equal', source: 'user_stated' }] }), 'mixed');
check('learn: mixed names both families', /anger and hurt|hurt and anger/i.test(lsMix), true);
check('learn: mixed says neither has to win', /neither has to win/i.test(lsMix), true);
const lsDeep = composeLearningSentence(ev({ emotion_family: 'sadness', user_phrase: 'a quiet heaviness', trigger_event: 'sundays' }), 'deepened');
check('learn: deepened reads as knowing it better', /know this a little better/i.test(lsDeep), true);
check('learn: empty-ish event still yields a safe sentence',
  /first shape/i.test(composeLearningSentence(ev({ emotion_family: 'calm', user_phrase: null, user_words_raw: '', trigger_event: null, body_cue: [], appraisal_thought: null, need_value: [] }), 'first_shape')), true);

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
// entry-hint (home chip) biases an ambiguous first turn...
check('router: entry hint witness on a short first message', routeMode('ugh work', null, 'witness').mode, 'witness');
check('router: entry hint body_first when unsure', routeMode('idk really', null, 'body_first').mode, 'body_first');
check('router: entry hint soft_landing for check-in', routeMode('not much, just popping in', null, 'soft_landing').mode, 'soft_landing');
// ...but explicit signals and heavy disclosures still override the hint
check('router: repair overrides entry hint', routeMode("no that's not it", null, 'witness').mode, 'repair');
check('router: heavy disclosure overrides a light check-in hint', routeMode('my mum passed away yesterday', null, 'soft_landing').mode, 'witness');

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

// ── Em-dash stripping (companion never shows long dashes) ────────────────────
check('strip: spaced em dash -> comma', stripEmDashes('Go ahead — say whatever’s there'), 'Go ahead, say whatever’s there');
check('strip: en dash too', stripEmDashes('worn down – not the other thing'), 'worn down, not the other thing');
check('strip: dash before a question', stripEmDashes('I’m here — what’s on your mind?'), 'I’m here, what’s on your mind?');
check('strip: tight em dash', stripEmDashes('a lot—really a lot'), 'a lot, really a lot');
check('strip: trailing dash leaves no trailing comma', stripEmDashes('okay then —'), 'okay then');
check('strip: dash before full stop collapses', stripEmDashes('that’s it —.'), 'that’s it.');
check('strip: keeps ordinary hyphens', stripEmDashes('self-harm and worn-down feelings'), 'self-harm and worn-down feelings');
check('strip: no dash is unchanged', stripEmDashes('That feels like a lot today.'), 'That feels like a lot today.');

// ── Variety signals ──────────────────────────────────────────────────────────
const v = varietySignals([
  'That sounds heavy, like a lot to carry. What part is loudest?',
  'That sounds like pressure. Is it more the amount, or the pace?',
]);
check('variety: repeated "that sounds" opener flagged', v.overusedOpener, 'that sounds');
check('variety: question streak counted', v.questionStreak, 2);

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

console.log(`\nengine regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
