/**
 * Emotion unlock / double-tap animations (animation brief). Each learned feeling
 * gives the companion a new movement grammar — a short 3-act sequence (recognition
 * -> expression -> settle) it can embody. Data-driven: each beat is a partial pose
 * (body + two arms + glow) the orb animates toward, then it returns to calm.
 *
 * Positions are FRACTIONS of the body diameter (like companionPose), so they scale.
 * The grammar is deliberately restrained and premium — never childish, never a
 * reward explosion (see brief §1, §7, §16).
 */

import { PROGRESS_RANK } from '@/services/ai/progressionEngine';
import type { EmotionFamilyId, EmotionProgress, EmotionProgressStage } from '@/types/models';

/** Canonical order the home double-tap cycles through (learned ones only). */
export const EMOTION_CYCLE_ORDER: EmotionFamilyId[] = [
  'joy',
  'calm',
  'sadness',
  'anger',
  'fear',
  'pressure',
  'shame',
  'hurt',
  'flat',
];

/** A feeling is "learned" (eligible to embody) once it has reached its First Shape. */
export function isEmotionLearned(stage: EmotionProgressStage | null | undefined): boolean {
  return !!stage && PROGRESS_RANK[stage] >= PROGRESS_RANK.first_shape;
}

/** The learned families, in cycle order — what the home double-tap may play. */
export function learnedFamilies(progress: Partial<Record<EmotionFamilyId, EmotionProgress>>): EmotionFamilyId[] {
  return EMOTION_CYCLE_ORDER.filter((f) => isEmotionLearned(progress[f]?.current_stage));
}

export type SeqSpring = 'gentle' | 'soft' | 'lively' | 'restrained';
export const SEQ_SPRINGS: Record<SeqSpring, { damping: number; stiffness: number; mass: number }> = {
  gentle: { damping: 18, stiffness: 120, mass: 0.9 },
  soft: { damping: 24, stiffness: 95, mass: 1 },
  lively: { damping: 14, stiffness: 150, mass: 0.8 },
  restrained: { damping: 28, stiffness: 80, mass: 1.1 },
};

export interface SeqBody {
  y?: number;
  scale?: number;
  rotate?: number;
}
export interface SeqArm {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
}
export interface SeqGlow {
  scale?: number;
  opacity?: number;
}
export interface EmotionBeat {
  dur: number;
  spring?: SeqSpring;
  body?: SeqBody;
  left?: SeqArm;
  right?: SeqArm;
  glow?: SeqGlow;
}

// terse builders
const b = (y: number, scale: number, rotate = 0): SeqBody => ({ y, scale, rotate });
const a = (x: number, y: number, scale = 1, rotate = 0): SeqArm => ({ x, y, scale, rotate });
const g = (scale: number, opacity: number): SeqGlow => ({ scale, opacity });
const beat = (dur: number, body: SeqBody, left: SeqArm, right: SeqArm, glow: SeqGlow, spring?: SeqSpring): EmotionBeat => ({
  dur,
  body,
  left,
  right,
  glow,
  spring,
});

/**
 * Per-family sequences. Silhouettes (brief §7): joy lifts/opens, calm widens/settles,
 * sadness lowers/softens, anger gathers then marks a boundary, fear gathers/alert,
 * pressure compresses then makes room, shame shrinks then gently reopens, hurt recoils
 * then reopens, flat slows/quiets then a faint contact.
 */
export const EMOTION_BEATS: Record<EmotionFamilyId, EmotionBeat[]> = {
  joy: [
    beat(240, b(0.05, 0.99), a(-0.54, 0.36, 0.96), a(0.54, 0.36, 0.96), g(0.96, 0.55), 'gentle'), // anticipation dip
    beat(520, b(-0.18, 1.08), a(-0.82, -0.04, 1.08, -14), a(0.82, -0.08, 1.1, 16), g(1.22, 0.9), 'lively'), // lift
    beat(380, b(-0.02, 1.02), a(-0.7, 0.14, 1.04, -6), a(0.7, 0.12, 1.04, 6), g(1.12, 0.76), 'gentle'), // soft landing
    beat(720, b(0, 1), a(-0.62, 0.26, 1, -2), a(0.62, 0.26, 1, 2), g(1.08, 0.7), 'soft'), // open settle
  ],
  calm: [
    beat(900, b(-0.03, 1.035), a(-0.66, 0.22, 1.02), a(0.66, 0.22, 1.02), g(1.18, 0.65), 'soft'), // quiet inhale
    beat(1300, b(0, 1), a(-0.78, 0.3, 0.98), a(0.78, 0.3, 0.98), g(1.24, 0.55), 'restrained'), // wide settle
  ],
  sadness: [
    beat(440, b(0.02, 0.99), a(-0.52, 0.32, 0.96), a(0.52, 0.32, 0.96), g(0.98, 0.48), 'soft'), // recognition pause
    beat(860, b(0.16, 0.93), a(-0.4, 0.42, 0.92, 4), a(0.4, 0.42, 0.92, -4), g(0.86, 0.4), 'soft'), // lower + soften
    beat(900, b(0.1, 0.96), a(-0.46, 0.4, 0.94, 2), a(0.46, 0.4, 0.94, -2), g(0.92, 0.46), 'soft'), // held settle
  ],
  anger: [
    beat(280, b(0.02, 0.95), a(-0.46, 0.3, 0.95), a(0.46, 0.3, 0.95), g(0.9, 0.62), 'gentle'), // gather heat
    beat(440, b(-0.02, 1.03), a(-0.86, 0.16, 1.06, -10), a(0.86, 0.16, 1.06, 10), g(1.2, 0.9), 'lively'), // boundary pulse
    beat(720, b(0.01, 1), a(-0.7, 0.24, 1, -3), a(0.7, 0.24, 1, 3), g(1.04, 0.64), 'restrained'), // firm settle
  ],
  fear: [
    beat(260, b(-0.02, 1), a(-0.6, 0.28, 1), a(0.6, 0.28, 1), g(0.96, 0.58), 'restrained'), // freeze
    beat(520, b(-0.06, 0.93), a(-0.42, 0.22, 0.94), a(0.42, 0.22, 0.94), g(0.84, 0.64), 'restrained'), // gather alert
    beat(460, b(-0.05, 0.94), a(-0.43, 0.22, 0.94), a(0.41, 0.24, 0.94), g(0.86, 0.6), 'soft'), // micro tremor
    beat(760, b(0, 0.98), a(-0.5, 0.3, 0.96), a(0.5, 0.3, 0.96), g(0.98, 0.52), 'soft'), // contained settle
  ],
  pressure: [
    beat(420, b(0.06, 0.9), a(-0.4, 0.26, 0.94), a(0.4, 0.26, 0.94), g(0.86, 0.62), 'gentle'), // space narrows
    beat(600, b(0.05, 0.91), a(-0.36, 0.24, 0.93), a(0.36, 0.24, 0.93), g(0.84, 0.6), 'soft'), // compressed wobble
    beat(900, b(0.01, 1), a(-0.56, 0.3, 0.98), a(0.56, 0.3, 0.98), g(1, 0.54), 'soft'), // make some room
  ],
  shame: [
    beat(560, b(0.12, 0.88), a(-0.3, 0.2, 0.9, 8), a(0.3, 0.2, 0.9, -8), g(0.8, 0.36), 'soft'), // pull inward / shield
    beat(480, b(0.12, 0.88), a(-0.26, 0.18, 0.9, 8), a(0.26, 0.18, 0.9, -8), g(0.78, 0.34), 'restrained'), // small pause
    beat(1100, b(0.06, 0.95), a(-0.5, 0.3, 0.94), a(0.46, 0.28, 0.94), g(0.94, 0.44), 'soft'), // gentle reopen
  ],
  hurt: [
    beat(420, b(0.04, 0.96, -2), a(-0.34, 0.26, 0.93), a(0.5, 0.32, 0.95), g(0.92, 0.5), 'soft'), // soft recoil
    beat(700, b(0.06, 0.96, -1), a(-0.22, 0.22, 0.92), a(0.46, 0.36, 0.94), g(0.9, 0.48), 'soft'), // protect tender spot
    beat(900, b(0.02, 0.99), a(-0.5, 0.3, 0.96), a(0.54, 0.3, 0.98), g(1, 0.52), 'soft'), // small reopen
  ],
  flat: [
    beat(900, b(0.04, 0.96), a(-0.54, 0.4, 0.9), a(0.54, 0.4, 0.9), g(0.84, 0.26), 'restrained'), // desaturate
    beat(820, b(0.04, 0.96), a(-0.54, 0.4, 0.9), a(0.54, 0.4, 0.9), g(0.84, 0.26), 'restrained'), // almost still
    beat(1100, b(0.02, 0.98), a(-0.56, 0.38, 0.94), a(0.56, 0.38, 0.94), g(0.92, 0.38), 'soft'), // faint contact
  ],
};

/** Total wall-clock of a sequence (for cooldown / lock timing). */
export function sequenceDuration(family: EmotionFamilyId): number {
  return (EMOTION_BEATS[family] ?? []).reduce((sum, x) => sum + x.dur, 0);
}
