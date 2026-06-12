/**
 * Memory Ledger regression suite (engine brief §12, §20.6) — deterministic
 * tests for drafting rules, sensitivity blocking, and confirmed-only retrieval.
 *
 * Run: npm run test:memory (rebundles, then executes). Exit 1 on failure.
 */
import { activeCards, draftFromRejection, draftFromTurn, memoryBlocked, relevantMemory } from './engine-bundle.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}`);
  }
};

const ev = (over = {}) => ({
  id: 'e1', conversation_id: 'c1', timestamp: '', user_words_raw: 'buzzing chest',
  emotion_status: 'confirmed', emotion_family: 'pressure', emotion_shade: 'overwhelmed',
  secondary_emotions: [], valence: 'negative', activation: 'high', control_power: 'unknown',
  intensity: null, trigger_event: 'deadlines', appraisal_thought: null,
  body_cue: ['buzzing chest'], behaviour_action: [], coping_response: [], outcome: null,
  social_context: [], need_value: [], confidence_level: 'medium', evidence_basis: [],
  user_confirmation: 'yes', label_source: 'user_confirmed',
  user_rejected_shades: [], mixed_relation: null, strands: [], mixed_confirmed: 0,
  unlock_stage: 'understood', memory_note: 'Pressure can feel like being divided into too many pieces.',
  do_not_store: 0, safety_flag: 'none',
  ...over,
});
const turn = (over = {}, evOver = {}) => ({ reply: 'r', event: ev(evOver), unlocked: true, tone: 'calm', stage: 'understood', ...over });

// ── Drafting rules ───────────────────────────────────────────────────────────
check('draft on unlock with memory_note', draftFromTurn(turn(), 'it just clicked', 'c1')?.summary?.includes('divided into too many pieces') === true);
check('NO draft without unlock (nothing landed)', draftFromTurn(turn({ unlocked: false }), 'ok', 'c1') === null);
check('NO draft when do_not_store', draftFromTurn(turn({}, { do_not_store: 1 }), 'ok', 'c1') === null);
check('NO draft when safety-flagged', draftFromTurn(turn({}, { safety_flag: 'urgent_review' }), 'ok', 'c1') === null);
check('NO draft when note contains sensitive content',
  draftFromTurn(turn({}, { memory_note: 'They mentioned their antidepressant dose changing.' }), 'ok', 'c1') === null);
check('explicit "remember this" drafts even without unlock',
  draftFromTurn(turn({ unlocked: false }), 'please remember this one', 'c1') !== null);
check('mixed_confirmed draft becomes mixed_pattern',
  draftFromTurn(turn({ unlocked: false }, {
    mixed_confirmed: 1, mixed_relation: 'foreground_background',
    strands: [
      { family: 'anger', shade: null, salience: 'foreground', source: 'user_stated' },
      { family: 'hurt', shade: null, salience: 'background', source: 'user_stated' },
    ],
  }), 'yeah both', 'c1')?.type === 'mixed_pattern');
check('rejection draft is a repair_instruction naming the word',
  draftFromRejection(['anxious'], 'fear', 'c1')?.summary?.includes('anxious') === true &&
  draftFromRejection(['anxious'], 'fear', 'c1')?.type === 'repair_instruction');

// ── Sensitivity blocking ─────────────────────────────────────────────────────
check('crisis language blocked from memory', memoryBlocked('they said they want to hurt themselves'));
check('hopeless language blocked from memory', memoryBlocked('nothing feels worth it lately'));
check('diagnosis/meds language blocked', memoryBlocked('started a new antidepressant last week'));
check('identity self-condemnation blocked from memory', memoryBlocked('the user feels they are a bad person'));
check('identity "not good enough" blocked from memory', memoryBlocked('she is fundamentally not good enough'));
check('ordinary feeling note NOT blocked', !memoryBlocked('Pressure can feel like being divided into too many pieces.'));

// ── Confirmed-only retrieval ─────────────────────────────────────────────────
const card = (over = {}) => ({
  id: over.id ?? 'm1', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
  source_conversation_id: 'c0', type: 'emotional_pattern',
  summary: 'Pressure can feel like being divided into too many pieces.',
  user_words: ['not enough of me to go around'], emotion_family: 'pressure',
  confirmation_status: 'user_confirmed', sensitivity: 'low',
  retention: 'persistent_until_deleted', expires_at: null, muted: 0,
  ...over,
});

check('drafts are never retrieved', activeCards([card({ confirmation_status: 'draft' })]).length === 0);
check('rejected cards are never retrieved', activeCards([card({ confirmation_status: 'user_rejected' })]).length === 0);
check('muted cards are never retrieved', activeCards([card({ muted: 1 })]).length === 0);
check('expired cards are never retrieved',
  activeCards([card({ retention: 'expires', expires_at: '2000-01-01T00:00:00Z' })]).length === 0);
check('confirmed card retrieved for same family',
  relevantMemory([card()], 'work is piling up again', 'pressure')?.includes('divided into too many pieces') === true);
check('user words echoed for tentative callback',
  relevantMemory([card()], 'everyone needs something from me', 'pressure')?.includes('not enough of me to go around') === true);
check('irrelevant memory stays out',
  relevantMemory([card({ emotion_family: 'joy', summary: 'Joy lands when sharing wins.', user_words: ['call everyone'] })], 'the deadline pressure is back', 'pressure') === null);
check('cap at 3 most relevant', (() => {
  const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => card({ id }));
  const out = relevantMemory(cards, 'pressure pieces again', 'pressure');
  return out !== null && out.split('\n').length === 3;
})());

console.log(`\nmemory regression: ${pass} passed, ${fail} failed (${pass + fail} cases)`);
process.exit(fail ? 1 : 0);
