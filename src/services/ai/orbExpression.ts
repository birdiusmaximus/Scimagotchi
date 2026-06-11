/**
 * Per-emotion orb expression (v0.3 brief §6.2/6.3). A deterministic mapping from
 * the active feeling + visual state to a small set of MOTION parameters, so the
 * companion visibly moves like the feeling it is learning: sadness sinks, joy
 * lifts, fear trembles, anger/pressure pulse, shame/flat draw inward and quiet.
 *
 * Crucially (§6.5): when a hard feeling reaches its first shape the orb does NOT
 * become "happy" — it becomes CLEARER. So clarity reduces agitation (tremor/pulse)
 * but keeps the feeling's posture (a settled sadness still sits low). Safety mode
 * drops all expressive theatrics. Pure module — no RN — so it can be unit-tested.
 */

import type { CompanionVisualState } from '@/services/ai/companionVisualState';
import type { EmotionFamilyId } from '@/types/models';

export interface OrbExpression {
  /** Vertical bias: -1 lifts up (joy), +1 sinks down (sadness). */
  sink: number;
  /** Ambient float/breathe amplitude: 0 damped (flat), 1 lively. */
  energy: number;
  /** Fine high-frequency tremble (fear). 0..1 */
  tremor: number;
  /** Sharper periodic pulse (anger, pressure). 0..1 */
  pulse: number;
  /** Slight inward draw / shrink (shame, hurt-fold, pressure-squeeze). 0..1 */
  contract: number;
}

const NEUTRAL: OrbExpression = { sink: 0, energy: 1, tremor: 0, pulse: 0, contract: 0 };

// Restrained, premium motion — never cartoon drama (§6.2). Values stay small.
const BY_FAMILY: Record<EmotionFamilyId, OrbExpression> = {
  joy: { sink: -0.5, energy: 1, tremor: 0, pulse: 0.18, contract: 0 },
  calm: { sink: 0.05, energy: 0.7, tremor: 0, pulse: 0, contract: 0 },
  fear: { sink: 0.1, energy: 0.85, tremor: 0.7, pulse: 0, contract: 0.2 },
  pressure: { sink: 0.15, energy: 0.9, tremor: 0.15, pulse: 0.6, contract: 0.35 },
  anger: { sink: -0.1, energy: 1, tremor: 0.1, pulse: 0.8, contract: 0.1 },
  sadness: { sink: 0.6, energy: 0.45, tremor: 0, pulse: 0, contract: 0.1 },
  hurt: { sink: 0.35, energy: 0.6, tremor: 0, pulse: 0, contract: 0.3 },
  shame: { sink: 0.45, energy: 0.4, tremor: 0, pulse: 0, contract: 0.5 },
  flat: { sink: 0.2, energy: 0.2, tremor: 0, pulse: 0, contract: 0.15 },
};

/** The orb's motion for the current feeling + conversational moment. */
export function expressionFor(family: EmotionFamilyId | null, visual: CompanionVisualState): OrbExpression {
  // Safety overrides character (§2.5): no expressive theatrics, just a quiet recede.
  if (visual === 'safety_receded') return { ...NEUTRAL, energy: 0.5 };

  const base = family ? BY_FAMILY[family] : NEUTRAL;

  // Still exploring: the feeling has no clear shape yet, so soften its posture and
  // add a touch of unsettled searching motion (§6.3 step 2).
  if (visual === 'searching' || visual === 'uncertain') {
    return {
      sink: base.sink * 0.5,
      energy: Math.max(0.5, base.energy * 0.85),
      tremor: Math.max(base.tremor, 0.22),
      pulse: base.pulse * 0.5,
      contract: base.contract * 0.5,
    };
  }

  // Clarity (a shape is forming / has formed): SETTLE. Agitation eases, but the
  // feeling's posture stays — clearer, not happier (§6.5).
  if (visual === 'stabilising' || visual === 'first_shape' || visual === 'deepened' || visual === 'returning_shape') {
    return {
      sink: base.sink,
      energy: Math.min(1, base.energy + 0.1),
      tremor: base.tremor * 0.25,
      pulse: base.pulse * 0.4,
      contract: base.contract * 0.7,
    };
  }

  return base;
}
