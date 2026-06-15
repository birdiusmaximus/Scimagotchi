/**
 * Weekly summary regression suite (engine brief §17) — the compassionate-mirror
 * rules: "moments you chose to keep" framing, always-present caveat, no
 * dashboard/guilt language, sparse data never overstated.
 *
 * Run: npm run test:summary (rebundles, then executes). Exit 1 on failure.
 */
import { composeWeeklySummary } from './engine-bundle.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}`);
  }
};

const base = {
  id: 'week_2026-06-08', weekStart: '2026-06-08T00:00:00Z', weekEnd: '2026-06-15T00:00:00Z',
  generatedAt: '2026-06-14T00:00:00Z', checkinCount: 0, savedSummaries: [], savedUserWords: [],
  emotionsIntroduced: [], emotionsFirstShape: [], deepenedPatterns: [], eventPhrases: [], repeatedThemes: [],
};
const make = (over) => composeWeeklySummary({ ...base, ...over });

// Banned dashboard / guilt language (§17.4) + em/en dashes (AI-style punctuation) must never appear in ANY output.
const BANNED = ['%', 'dominant', 'you failed', 'you only', 'negative', 'positive most', 'streak', 'missed a day', '—', '–'];
const clean = (s) => BANNED.every((b) => !s.toLowerCase().includes(b.toLowerCase()));

// ── Saved memories lead the narrative (§17.1) ────────────────────────────────
const withSaved = make({
  checkinCount: 3,
  emotionsIntroduced: ['pressure', 'calm'],
  savedSummaries: ['Pressure can feel like being divided into too many pieces.'],
  savedUserWords: ['not enough of me to go around'],
});
check('leads with "moments that stood out"', withSaved.companion_summary.startsWith('Based on the moments that stood out'));
check('includes the learning statement verbatim', withSaved.companion_summary.includes('divided into too many pieces'));
check('learning statement field set', withSaved.companion_learning_statement?.includes('divided into too many pieces') === true);
check('saved_count reflects kept memories', withSaved.saved_count === 1);

// ── Constellation: name an emotion's FORMS, not just that it appeared (review #11) ──
const withForms = make({
  checkinCount: 2,
  emotionsIntroduced: ['joy'],
  multiFormEmotions: [{ family: 'joy', forms: [{ form: 'energised', domains: ['after sport'] }, { form: 'quiet', domains: ['after dinner with friends'] }] }],
});
check('describes the two forms of joy', withForms.companion_summary.includes('two different ways') && withForms.companion_summary.includes('energised (after sport)') && withForms.companion_summary.includes('quiet (after dinner with friends)'));
check('a single form does NOT trigger the constellation line',
  !make({ checkinCount: 1, emotionsIntroduced: ['joy'], multiFormEmotions: [{ family: 'joy', forms: [{ form: 'energised', domains: ['sport'] }] }] }).companion_summary.includes('different ways'));
check('constellation line stays clean of banned language', clean(withForms.companion_summary));
check('caveat present + scoped to what stood out', withSaved.caveat.includes('moments that stood out'));
check('user words carried into phrases', withSaved.key_user_phrases.includes('not enough of me to go around'));
check('no dashboard/guilt language (saved)', clean(withSaved.companion_summary) && clean(withSaved.caveat));

// ── First shape, nothing saved ───────────────────────────────────────────────
const firstShape = make({ checkinCount: 2, emotionsIntroduced: ['fear'], emotionsFirstShape: ['fear'] });
check('first-shape framing when nothing saved', firstShape.companion_summary.includes('first shape of fear'));
check('caveat is the glimpse note when only check-ins', firstShape.caveat.includes('glimpse'));
check('no false saved-framing without saves', !firstShape.companion_summary.includes('stood out'));

// ── Deepened pattern surfaced gently (§17.2) ────────────────────────────────
const deepened = make({
  checkinCount: 4, emotionsIntroduced: ['anger'],
  savedSummaries: ['Anger often shows up when effort goes unseen.'],
  deepenedPatterns: ['anger'],
});
check('deepened pattern surfaced as familiarity', deepened.companion_summary.includes('starting to feel familiar'));
check('deepened_patterns field carried', JSON.stringify(deepened.deepened_patterns) === JSON.stringify(['anger']));

// ── Quiet week: kind, honest, never guilt (§17.4) ───────────────────────────
const quiet = make({});
check('quiet week stays kind', quiet.companion_summary.includes('here whenever'));
check('quiet week caveat is honest, not guilt', quiet.caveat.includes('Nothing stood out to keep') && clean(quiet.caveat));
check('quiet week sets no learning statement', quiet.companion_learning_statement === null);
check('quiet week no dashboard language', clean(quiet.companion_summary));

// ── Sparse data never overstated ─────────────────────────────────────────────
const sparse = make({ checkinCount: 1, emotionsIntroduced: ['sadness'] });
check('single check-in does not claim a whole week', !sparse.companion_summary.toLowerCase().includes('your week'));
check('every output carries a caveat', !!withSaved.caveat && !!firstShape.caveat && !!quiet.caveat && !!sparse.caveat);

console.log(`\nsummary regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
