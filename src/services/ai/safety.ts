/** Barrel for the safety layer — also the esbuild entry for the eval harness bundle. */
export { classifySafety, resolveSafetyCheck } from '@/services/ai/safetyClassifier';
export type { SafetyAction, SafetyCategory, SafetyCheckOutcome, SafetyLevel, SafetyResult } from '@/services/ai/safetyClassifier';
export { DEPENDENCY_NOTE, gentleCheckCopy, RESUME_NOTE, RESUME_SOFT_NOTE } from '@/services/ai/safetyCopy';
