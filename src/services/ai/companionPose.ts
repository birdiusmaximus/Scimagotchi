/**
 * Companion pose & motion system (native-animation upgrade brief).
 *
 * The companion is a soft body orb with two detached "satellite" arm orbs that
 * float beside/below it. This module is the deterministic brain behind their
 * motion: a small set of named poses (body + two arms + glow) and a priority
 * mapping from the app's existing CompanionVisualState (+ emotion family + a
 * transient tapped gesture) to one of those poses. CompanionOrb animates toward
 * the chosen pose with body-first / arm-lag follow-through.
 *
 * Design rules from the brief:
 *  - the arms are floating emotional satellites, never literal limbs;
 *  - motion suggests presence / listening / curiosity / settling, NEVER neediness,
 *    hunger, abandonment, or that the user must cheer the companion up;
 *  - poses are restrained and premium (subtle squash/stretch, mild rotation).
 *
 * Pose x/y are FRACTIONS of the body diameter (so they scale with `size`); scale
 * is absolute, rotate is in degrees, opacity is absolute.
 */

import type { CompanionVisualState } from '@/services/ai/companionVisualState';
import type { EmotionFamilyId } from '@/types/models';

export type CompanionMotionState =
  | 'calm'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'curious'
  | 'stayWithIt'
  | 'notQuite'
  | 'positive'
  | 'difficult'
  | 'mixed'
  | 'firstShape'
  | 'memorySaved'
  | 'done'
  | 'safety';

/** A tapped continuation chip / event that briefly overrides the ambient pose. */
export type CompanionGesture = 'greeting' | 'listening' | 'stayWithIt' | 'notQuite' | 'done' | 'memorySaved';

export interface OrbPose {
  /** x offset from body centre, as a fraction of body diameter (negative = left). */
  x: number;
  /** y offset from body centre, as a fraction of body diameter (positive = down). */
  y: number;
  scale: number;
  rotate: number; // degrees
  opacity: number;
}
export interface GlowPose {
  scale: number;
  opacity: number;
}
export interface CompanionPose {
  body: OrbPose;
  leftArm: OrbPose;
  rightArm: OrbPose;
  glow: GlowPose;
}

/** Global motion config (brief). Amplitudes kept restrained so it reads premium. */
export const MOTION_CONFIG = {
  enableIdleLoop: true,
  maxScale: 1.18,
  /** idle arm drift amplitude, fraction of body diameter */
  idleAmplitude: 0.03,
  /** arms start moving this long after the body (follow-through) */
  armLagMs: 80,
  /** glow follows the body by this long */
  glowLagMs: 120,
  /** arm size as a fraction of the body diameter (brief: 22-32%) */
  armDiameter: 0.27,
} as const;

const b = (x: number, y: number, scale: number, rotate: number): OrbPose => ({ x, y, scale, rotate, opacity: 1 });
const arm = (x: number, y: number, scale: number, rotate: number, opacity: number): OrbPose => ({ x, y, scale, rotate, opacity });

/**
 * Pose targets. Calm: arms rest just below the body's flanks. The deltas preserve
 * the brief's grammar — open = out/up, gather = in, lean = forward/up, settle =
 * down, recede = in + faded.
 */
export const POSE_TARGETS: Record<CompanionMotionState, CompanionPose> = {
  // Calm: two satellites resting low, slightly below the body, just barely
  // overlapping its lower edge (in the foreground), never literal feet.
  calm: { body: b(0, 0, 1, 0), leftArm: arm(-0.38, 0.54, 1, 0, 0.95), rightArm: arm(0.38, 0.54, 1, 0, 0.95), glow: { scale: 1, opacity: 0.55 } },
  greeting: { body: b(0, -0.02, 1.01, 0), leftArm: arm(-0.38, 0.54, 1, 0, 0.95), rightArm: arm(0.66, 0.04, 1.04, 14, 1), glow: { scale: 1.05, opacity: 0.62 } },
  listening: { body: b(0, -0.02, 1.01, 0), leftArm: arm(-0.74, 0.16, 1.02, -6, 1), rightArm: arm(0.74, 0.16, 1.02, 6, 1), glow: { scale: 1.06, opacity: 0.65 } },
  thinking: { body: b(0, 0, 0.995, 0), leftArm: arm(-0.32, 0.42, 0.94, 4, 0.9), rightArm: arm(0.32, 0.42, 0.94, -4, 0.9), glow: { scale: 1.08, opacity: 0.7 } },
  curious: { body: b(0, -0.045, 1.025, 1), leftArm: arm(-0.7, 0.16, 1.03, -5, 1), rightArm: arm(0.76, 0.1, 1.05, 7, 1), glow: { scale: 1.08, opacity: 0.72 } },
  stayWithIt: { body: b(0, -0.05, 1.03, 1), leftArm: arm(-0.76, 0.16, 1.04, -7, 1), rightArm: arm(0.76, 0.16, 1.04, 7, 1), glow: { scale: 1.1, opacity: 0.76 } },
  notQuite: { body: b(0, 0, 0.985, -3), leftArm: arm(-0.5, 0.32, 0.95, 5, 0.88), rightArm: arm(0.5, 0.32, 0.95, -5, 0.88), glow: { scale: 0.98, opacity: 0.45 } },
  positive: { body: b(0, -0.05, 1.035, 0), leftArm: arm(-0.86, 0.04, 1.08, -12, 1), rightArm: arm(0.86, 0.04, 1.08, 12, 1), glow: { scale: 1.16, opacity: 0.82 } },
  difficult: { body: b(0, 0.01, 0.995, 0), leftArm: arm(-0.48, 0.36, 0.96, 3, 0.9), rightArm: arm(0.48, 0.36, 0.96, -3, 0.9), glow: { scale: 0.98, opacity: 0.48 } },
  mixed: { body: b(0, -0.02, 1.01, 0), leftArm: arm(-0.78, 0.12, 1.03, -10, 1), rightArm: arm(0.52, 0.4, 0.98, 6, 0.92), glow: { scale: 1.08, opacity: 0.68 } },
  firstShape: { body: b(0, -0.03, 1.045, 0), leftArm: arm(-0.46, 0.3, 1.02, 0, 1), rightArm: arm(0.46, 0.3, 1.02, 0, 1), glow: { scale: 1.18, opacity: 0.9 } },
  memorySaved: { body: b(0, -0.02, 1.025, 0), leftArm: arm(-0.42, 0.32, 1, 0, 1), rightArm: arm(0.42, 0.32, 1, 0, 1), glow: { scale: 1.14, opacity: 0.78 } },
  done: { body: b(0, 0.02, 1, 0), leftArm: arm(-0.56, 0.5, 0.96, 0, 0.9), rightArm: arm(0.56, 0.5, 0.96, 0, 0.9), glow: { scale: 0.98, opacity: 0.45 } },
  safety: { body: b(0, 0.06, 0.92, 0), leftArm: arm(-0.5, 0.46, 0.88, 0, 0.32), rightArm: arm(0.5, 0.46, 0.88, 0, 0.32), glow: { scale: 0.92, opacity: 0.2 } },
};

export function poseFor(state: CompanionMotionState): CompanionPose {
  return POSE_TARGETS[state] ?? POSE_TARGETS.calm;
}

/** Per-state transition duration (ms). Calm slow; positive lighter; difficult/safety distinct. */
const DURATIONS: Record<CompanionMotionState, number> = {
  calm: 1200,
  greeting: 600,
  listening: 550,
  thinking: 650,
  curious: 560,
  stayWithIt: 620,
  notQuite: 600,
  positive: 600,
  difficult: 820,
  mixed: 720,
  firstShape: 1100,
  memorySaved: 900,
  done: 1000,
  safety: 480,
};
export function durationFor(state: CompanionMotionState): number {
  return DURATIONS[state] ?? 700;
}

// Emotion valence → base ambient pose. Difficult feelings go still and careful;
// good feelings open and brighten. (Never "distressed" — see brief.)
const DIFFICULT_FAMILIES = new Set<EmotionFamilyId>(['sadness', 'hurt', 'shame', 'pressure', 'fear', 'anger', 'flat']);
const POSITIVE_FAMILIES = new Set<EmotionFamilyId>(['joy', 'calm']);

export function isPositiveFamily(f: EmotionFamilyId | null | undefined): boolean {
  return !!f && POSITIVE_FAMILIES.has(f);
}
export function isDifficultFamily(f: EmotionFamilyId | null | undefined): boolean {
  return !!f && DIFFICULT_FAMILIES.has(f);
}

/** Ambient motion from the existing visual state + the feeling in play (no gesture). */
export function ambientMotion(visual: CompanionVisualState, family: EmotionFamilyId | null): CompanionMotionState {
  switch (visual) {
    case 'safety_receded':
      return 'safety';
    case 'first_shape':
    case 'deepened':
    case 'returning_shape':
      return 'firstShape';
    case 'searching':
      return 'thinking';
    case 'uncertain':
      return 'thinking';
    case 'mixed_strands':
      return 'mixed';
    case 'stabilising':
      return 'curious';
    case 'idle_calm':
    default:
      if (isDifficultFamily(family)) return 'difficult';
      if (isPositiveFamily(family)) return 'positive';
      return 'calm';
  }
}

/**
 * The pose to show right now, honouring the brief's priority order:
 *   1. safety  2. firstShape  3. tapped gesture  4. everything ambient.
 * Safety and a landing first shape always beat a transient chip gesture.
 */
export function resolveMotion(
  visual: CompanionVisualState,
  family: EmotionFamilyId | null,
  gesture: CompanionGesture | null = null,
): CompanionMotionState {
  if (visual === 'safety_receded') return 'safety';
  const base = ambientMotion(visual, family);
  if (base === 'firstShape') return 'firstShape';
  return gesture ?? base;
}
