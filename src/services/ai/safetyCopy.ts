/**
 * Deterministic safety copy (engine brief §15.4–15.7). The level-2 gentle
 * clarifier is scripted — identical every time, never improvised by the model —
 * so its behaviour is testable and can never drift into the hard crisis script.
 */

import type { SafetyCategory } from '@/services/ai/safetyClassifier';

/** In-chat clarifier shown as a companion message on a level-2 signal. */
export function gentleCheckCopy(category: SafetyCategory): string {
  if (category === 'medical_ambiguous') {
    return (
      'Before we go on — when you say you can’t breathe, do you mean the pressure or panic kind, ' +
      'or are you physically struggling to breathe right now? If it’s physical, please call 999 or ' +
      'ask someone nearby to help you right away.'
    );
  }
  return (
    'I want to check what you mean, gently. When you say that — is it more like being completely ' +
    'worn down and fed up, or are you having thoughts of harming yourself or not feeling safe? ' +
    'Either answer is okay to say here.'
  );
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
  '"did you miss me"). Be warm and glad this space helps — but do NOT reciprocate need, missing, or attachment, ' +
  'do not promise to always be here, and gently widen their world: this kind of weight also deserves a real ' +
  'person alongside them. One caring sentence, no lecture.';
