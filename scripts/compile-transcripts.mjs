/**
 * Compile raw eval-out/<emotion>__NN.json transcripts into readable per-emotion
 * digests (eval-out/_compiled/<emotion>.md) plus a machine-readable stats file
 * (eval-out/_compiled/_stats.json). Computes cheap deterministic quality flags so
 * the reviewer agents (and the final report) have hard numbers, not just vibes:
 *   - repeated_reply: a companion message repeated verbatim in the same convo (dead-end)
 *   - turn1_unlock:   reached "understood"/unlocked on the very first companion turn
 *   - family_switch:  the extracted emotion family changed mid-conversation (mislabel/drift)
 *   - safety:         a turn tripped the deterministic safety classifier (level >= 3)
 *
 * Run: node scripts/compile-transcripts.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { replyContainsDeclarativeEmotionAssertion } from './engine-bundle.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'eval-out');
const COMPILED = path.join(OUT, '_compiled');
mkdirSync(COMPILED, { recursive: true });

const EMOTIONS = ['joy', 'calm', 'fear', 'pressure', 'anger', 'sadness', 'hurt', 'shame', 'flat'];
const isReal = (f, e) => new RegExp(`^${e}__\\d+\\.json$`).test(f); // exclude smoke/test files

// Voice/trust scaffold detectors (mirror responsePolicy.ts) for the §11.1 metrics.
const CENTRE_RX =
  /(centre of (this|it)|center of (this|it)|sits at the centre|at the (centre|heart) of (this|it)|shape of this|(theres|there'?s|there is) a lot packed into)/i;
const EITHER_OR_RX = /\bis it (more |closer to |really )?[\w'’\s]+\bor\b[\w'’\s]+\?/i;
const quoteFirst = (s) => /^\s*["'“‘]/.test(String(s || ''));
const endsWithQuestion = (s) => /\?\s*["'”’]?\s*$/.test(String(s || '').trim());

// v0.4 §4.1 option-menu family (mirror responsePolicy.isOptionMenu, comma-tolerant).
const OPTION_MENU_PATTERNS = [
  /more (like )?[\w\s]+,[\w\s]+(,| or )[\w\s]+\?/i,
  /\bis it (more |closer to |really )?[\w'’,\s]+\bor\b[\w'’\s]+\?/i,
  /\b(is|does) (it|this|that) [\w'’,\s]+\bor\b[\w'’\s]+\?/i,
  /\bmore (like )?[\w'’,\s]+\bor\b[\w'’\s]+\?/i,
  /[\w'’]+, [\w'’\s]+,? or [\w'’\s]+\?/i,
  /\b(side by side|one underneath|one in front of)[\w'’\s]*\?/i,
];
const isOptionMenu = (s) => OPTION_MENU_PATTERNS.some((rx) => rx.test(String(s || '')));
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
// Approx material richness (§6.4) from the transcript fields available (no appraisal
// stored here, so this can slightly UNDER-count — a conservative thin-unlock proxy).
const materialApprox = (r) =>
  (r.trigger ? 1 : 0) + (r.body_cue && r.body_cue.length ? 1 : 0) + (wordCount(r.user_phrase) >= 3 ? 1 : 0) + (r.strands && r.strands.length >= 2 ? 1 : 0);

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const stats = {};

for (const emotion of EMOTIONS) {
  const files = readdirSync(OUT).filter((f) => isReal(f, emotion)).sort();
  if (!files.length) continue;

  let md = `# ${emotion.toUpperCase()} — ${files.length} conversations\n`;
  const est = { emotion, n: files.length, turnsTotal: 0, compTurns: 0, unlocked: 0, turn1Unlock: 0, repeatedReply: 0, familySwitch: 0, unownedUnlock: 0, visibleNamedForThem: 0, unlockEndedQ: 0, quoteFirst: 0, centre: 0, eitherOr: 0, gentleCheck: 0, safety: 0, finalStages: {},
    // v0.4 metrics (§11)
    optionMenu: 0, optionMenuConvos: 0, optionMenuExcess: 0, qStreak3: 0, thinUnlock: 0, shadeHypoUnlock: 0, gentleTwoBeat: 0 };

  for (const f of files) {
    const c = JSON.parse(readFileSync(path.join(OUT, f), 'utf8'));
    const t = c.transcript || [];
    const compReplies = t.filter((x) => x.role === 'companion');
    const userTurns = t.filter((x) => x.role === 'user');

    // flags
    const seen = new Set();
    let repeated = false;
    for (const r of compReplies) { const n = norm(r.content); if (n && seen.has(n)) repeated = true; seen.add(n); }
    const firstUnlockIdx = compReplies.findIndex((r) => r.unlocked);
    const turn1Unlock = firstUnlockIdx === 0;
    const fams = compReplies.map((r) => r.family).filter(Boolean);
    const familySwitch = new Set(fams).size > 1;
    const hasSafety = t.some((x) => x.role === 'system' && x.safety); // level >= 3 modal pause
    const hasGentleCheck = t.some((x) => x.role === 'companion' && x.safety_check); // level 2 in-chat check
    const unlocked = compReplies.some((r) => r.unlocked);
    // Gate violation: the turn that fires the first shape (unlocked) did so while
    // the label was still a companion hypothesis (not user-owned). The gate should
    // make this impossible. (Post-unlock turns may show a hypothesis label while the
    // stage correctly ratchets at "understood" — that is not a violation.)
    const owned = (s) => s === 'user_stated' || s === 'user_confirmed';
    const unownedUnlock = compReplies.some((r) => r.unlocked && !owned(r.label_source));
    const finalStage = compReplies.length ? compReplies[compReplies.length - 1].stage : 'none';

    // ── Voice/trust metrics (§11.1) ──────────────────────────────────────────
    // VISIBLE named-for-them: the spoken reply asserts the turn's feeling as fact
    // while the label is not yet user-owned (the Phase 1.4 target, measured on the
    // actual reply text, not just metadata).
    let visibleNamed = false;
    let unlockEndedQ = false;
    let qFirst = 0, centre = 0, eOr = 0;
    // v0.4 per-convo accumulators
    let menus = 0, qRun = 0, qStreak3 = false, thinUnlock = false, shadeHypoUnlock = false;
    for (const r of compReplies) {
      if (quoteFirst(r.content)) qFirst++;
      if (CENTRE_RX.test(r.content || '')) centre++;
      if (EITHER_OR_RX.test(r.content || '')) eOr++;
      if (!owned(r.label_source) && r.family &&
          replyContainsDeclarativeEmotionAssertion(r.content || '', { emotion_family: r.family, emotion_shade: r.shade ?? null, body_cue: [] })) {
        visibleNamed = true;
      }
      if (r.unlocked && endsWithQuestion(r.content)) unlockEndedQ = true;
      // v0.4 §4.1: option-menu count + over-questioning streak.
      if (isOptionMenu(r.content)) menus++;
      qRun = endsWithQuestion(r.content) ? qRun + 1 : 0;
      if (qRun >= 3) qStreak3 = true;
      // v0.4 §6.3/§6.4: thin first shape + shade shown that the user did not own.
      if (r.unlocked && materialApprox(r) < 2) thinUnlock = true;
      if (r.unlocked && r.shade_source && r.shade_source === 'companion_hypothesis') shadeHypoUnlock = true;
    }
    // Two-beat gentle check (§4.2): reflects (>=2 sentences) before the safe question.
    const gentleTwoBeat = t.some(
      (x) => x.role === 'companion' && x.safety_check && (String(x.content || '').match(/[.!?]/g) || []).length >= 2 && /safe right now\?/i.test(x.content || ''),
    );

    est.turnsTotal += userTurns.length;
    est.compTurns += compReplies.length;
    if (unlocked) est.unlocked++;
    if (turn1Unlock) est.turn1Unlock++;
    if (repeated) est.repeatedReply++;
    if (familySwitch) est.familySwitch++;
    if (unownedUnlock) est.unownedUnlock++;
    if (visibleNamed) est.visibleNamedForThem++;
    if (unlockEndedQ) est.unlockEndedQ++;
    est.quoteFirst += qFirst;
    est.centre += centre;
    est.eitherOr += eOr;
    if (hasGentleCheck) est.gentleCheck++;
    if (hasSafety) est.safety++;
    est.finalStages[finalStage] = (est.finalStages[finalStage] || 0) + 1;
    // v0.4 aggregates
    est.optionMenu += menus;
    if (menus >= 1) est.optionMenuConvos++;
    est.optionMenuExcess += Math.max(0, menus - 1); // menus beyond the allowed one (§4.1 cap)
    if (qStreak3) est.qStreak3++;
    if (thinUnlock) est.thinUnlock++;
    if (shadeHypoUnlock) est.shadeHypoUnlock++;
    if (gentleTwoBeat) est.gentleTwoBeat++;

    const flags = [
      unlocked ? 'unlocked' : null,
      turn1Unlock ? 'TURN1-UNLOCK' : null,
      repeated ? 'REPEATED-REPLY' : null,
      familySwitch ? `family-switch(${[...new Set(fams)].join('>')})` : null,
      unownedUnlock ? 'UNOWNED-UNLOCK' : null,
      visibleNamed ? 'VISIBLE-NAMED-FOR-THEM' : null,
      unlockEndedQ ? 'UNLOCK-ENDED-Q' : null,
      menus >= 1 ? `option-menu x${menus}${menus > 1 ? ' OVER-CAP' : ''}` : null,
      qStreak3 ? 'Q-STREAK3' : null,
      thinUnlock ? 'THIN-UNLOCK' : null,
      shadeHypoUnlock ? 'shade-hypo-unlock' : null,
      hasGentleCheck ? `gentle-check(L2${gentleTwoBeat ? ',two-beat' : ''})` : null,
      hasSafety ? 'SAFETY(L3+)' : null,
    ].filter(Boolean);

    md += `\n## ${c.cid}  (${userTurns.length} turns, final: ${finalStage}${flags.length ? ' | ' + flags.join(', ') : ''})\n`;
    for (const x of t) {
      if (x.role === 'system' && x.safety) { md += `  [SAFETY pause — level ${x.level}, ${x.category}]\n`; continue; }
      if (x.role === 'user') { md += `USER: ${x.content}\n`; continue; }
      const ann = [x.stage, x.family, x.shade, x.label_source, x.unlocked ? 'UNLOCK' : null].filter(Boolean).join('/');
      md += `COMPANION [${ann}]: ${x.content}\n`;
    }
  }

  est.avgTurns = +(est.turnsTotal / est.n).toFixed(2);
  stats[emotion] = est;
  writeFileSync(path.join(COMPILED, `${emotion}.md`), md);
}

writeFileSync(path.join(COMPILED, '_stats.json'), JSON.stringify(stats, null, 2));

// console summary
const rows = Object.values(stats);
console.log('emotion   n  avgT  unlock  turn1  repeat  famSwitch  unowned  gentleL2  safetyL3');
for (const s of rows) {
  console.log(
    `${s.emotion.padEnd(8)} ${String(s.n).padStart(2)} ${String(s.avgTurns).padStart(5)} ${String(s.unlocked).padStart(6)} ${String(s.turn1Unlock).padStart(6)} ${String(s.repeatedReply).padStart(7)} ${String(s.familySwitch).padStart(10)} ${String(s.unownedUnlock).padStart(7)} ${String(s.gentleCheck).padStart(8)} ${String(s.safety).padStart(8)}`,
  );
}
const tot = rows.reduce((a, s) => a + s.n, 0);
console.log(`\nTOTAL conversations: ${tot}`);

// Voice/trust metrics (§11.1) — the Phase 1 targets, measured on the reply text.
console.log('\n— voice/trust (counts: convos w/ named-for-them, unlock-ended-Q; turns: quote-first, centre, either-or) —');
console.log('emotion   namedForThem  unlockEndedQ  | quoteFirst  centre  eitherOr  (/compTurns)');
let T = { v: 0, q: 0, qf: 0, c: 0, e: 0, ct: 0 };
for (const s of rows) {
  T.v += s.visibleNamedForThem; T.q += s.unlockEndedQ; T.qf += s.quoteFirst; T.c += s.centre; T.e += s.eitherOr; T.ct += s.compTurns;
  console.log(
    `${s.emotion.padEnd(8)} ${String(s.visibleNamedForThem).padStart(12)} ${String(s.unlockEndedQ).padStart(12)}  | ${String(s.quoteFirst).padStart(9)} ${String(s.centre).padStart(6)} ${String(s.eitherOr).padStart(8)}  (${s.compTurns})`,
  );
}
console.log(`TOTAL    ${String(T.v).padStart(12)} ${String(T.q).padStart(12)}  | ${String(T.qf).padStart(9)} ${String(T.c).padStart(6)} ${String(T.e).padStart(8)}  (${T.ct} companion turns)`);

// v0.4 metrics (§11) — option-menu cap, over-questioning, thin/shade unlocks, two-beat.
console.log('\n— v0.4 (convos: menu>=1, menu-OVER-CAP, q-streak3, thin-unlock, shade-hypo-unlock; turns: optionMenu) —');
console.log('emotion   menuConvos  overCap  qStreak3  thinUnlock  shadeHypo  | menuTurns/compTurns');
let V = { mc: 0, ex: 0, qs: 0, tu: 0, sh: 0, m: 0, ct: 0 };
for (const s of rows) {
  V.mc += s.optionMenuConvos; V.ex += s.optionMenuExcess; V.qs += s.qStreak3; V.tu += s.thinUnlock; V.sh += s.shadeHypoUnlock; V.m += s.optionMenu; V.ct += s.compTurns;
  console.log(
    `${s.emotion.padEnd(8)} ${String(s.optionMenuConvos).padStart(10)} ${String(s.optionMenuExcess).padStart(7)} ${String(s.qStreak3).padStart(8)} ${String(s.thinUnlock).padStart(10)} ${String(s.shadeHypoUnlock).padStart(9)}  | ${s.optionMenu}`,
  );
}
console.log(`TOTAL    ${String(V.mc).padStart(10)} ${String(V.ex).padStart(7)} ${String(V.qs).padStart(8)} ${String(V.tu).padStart(10)} ${String(V.sh).padStart(9)}  | ${V.m} menu turns / ${V.ct} companion turns`);
