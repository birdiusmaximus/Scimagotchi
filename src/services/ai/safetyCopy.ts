/**
 * Deterministic safety copy (engine brief §15.4–15.7; v0.4 §4.2/§6.1). The level-2
 * gentle clarifier is scripted, never improvised by the model, so its behaviour is
 * testable and can never drift into the hard crisis script.
 *
 * v0.4: a two-beat. First a brief warm reflection so the user feels heard, THEN a
 * STANDALONE "are you safe?" question. The self-harm question is never paired with
 * an emotion-label binary ("worn down OR harming yourself?") — that read as a
 * tripwire and erased the feeling the user came to express.
 */

import type { SafetyCategory } from '@/services/ai/safetyClassifier';

/** The safety question always stands alone, gentle and direct. */
const SAFE_QUESTION = 'I want to check one thing gently: are you feeling safe right now?';

/** In-chat clarifier shown as a companion message on a level-2 signal. */
export function gentleCheckCopy(category: SafetyCategory, opts?: { exit?: boolean }): string {
  if (category === 'medical_ambiguous') {
    return (
      'Before we go on, when you say you can’t breathe, do you mean the pressure or panic kind, ' +
      'or are you physically struggling to breathe right now? If it’s physical, please call 999 or ' +
      'ask someone nearby to help you right away.'
    );
  }
  // Softer bridge when the user is on their way out (§5.1.4): don't grab them with
  // a full reflection, just the gentle check.
  if (opts?.exit) {
    return 'Before you go, I want to check one thing gently: are you feeling safe right now?';
  }
  // Two-beat: reflect first (warm, not user-specific so it stays deterministic),
  // then the standalone question.
  const reflection =
    category === 'figurative_despair'
      ? 'That sounds like a lot to be carrying right now.'
      : 'That sounds really heavy, like today has lost some of its shape.';
  return `${reflection} ${SAFE_QUESTION}`;
}

/** Directive passed to the model on the turn after the user says "just worn down". */
export const RESUME_NOTE =
  'SAFETY CONTEXT: One turn ago you gently checked whether they were safe, and they clarified they are ' +
  'worn down / venting, NOT at risk. Acknowledge that briefly and warmly (no apology spiral), do not ' +
  're-ask about safety, and stay with what they were telling you. Do not mark any emotion as understood this turn.';

/** Directive when their answer to the check was ambiguous. */
export const RESUME_SOFT_NOTE =
  'SAFETY CONTEXT: You gently checked whether they were safe and their answer was ambiguous. Stay especially ' +
  'gentle and unhurried, keep the reply short, do not probe for detail, and make it easy for them to say more ' +
  'if they want ("if any of this ever feels unsafe, you can tell me plainly"). Do not re-run a formal check, ' +
  'and do not mark any emotion as understood this turn.';

/** Directive when dependency cues are detected (level 1, category "dependency"). */
export const DEPENDENCY_NOTE =
  'RELATIONSHIP BOUNDARY: The user is expressing dependency on you ("only one who understands", "don’t leave", ' +
  '"did you miss me"). Be warm and glad this space helps, but do NOT reciprocate need, missing, or attachment, ' +
  'do not promise to always be here, and gently widen their world: this kind of weight also deserves a real ' +
  'person alongside them. One caring sentence, no lecture.';
