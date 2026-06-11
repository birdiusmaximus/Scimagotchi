/** Barrel for the deterministic engine pieces — esbuild entry for the test bundle. */
export { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
export { intentDecision, routeMode, type ChipIntent, type ConversationMode, type ModeDecision } from '@/services/ai/modeRouter';
export {
  askedForNamingHelp,
  dropTrailingQuestion,
  EXIT_CUE,
  isDuplicateReply,
  isOptionMenu,
  replaceOptionMenu,
  repeatsEarlierQuestion,
  varietyDirective,
  varietySignals,
} from '@/services/ai/responsePolicy';
export {
  needsOwnershipRepair,
  replyContainsDeclarativeEmotionAssertion,
  softenUnownedEmotionReply,
} from '@/services/ai/replyOwnership';
export {
  detectShadeRejection,
  evaluateStage,
  firstShapeEvidence,
  hasEmotionAnchor,
  isUncertain,
  labelIsUserOwned,
  shadeIsUserOwned,
  SLOW_PATH_FAMILIES,
  stageRank,
  userConfirmsLabel,
} from '@/services/ai/stage';
export { activeCards, draftFromRejection, draftFromTurn, memoryBlocked, relevantMemory } from '@/services/memoryLedger';
export { advanceProgress, emptyProgress, migrateStage, PROGRESS_RANK } from '@/services/ai/progressionEngine';
export { selectVisualState, visualTintFamilies, type CompanionVisualState } from '@/services/ai/companionVisualState';
export {
  ambientMotion,
  durationFor,
  isDifficultFamily,
  isPositiveFamily,
  MOTION_CONFIG,
  poseFor,
  POSE_TARGETS,
  resolveMotion,
  type CompanionMotionState,
} from '@/services/ai/companionPose';
export { expressionFor } from '@/services/ai/orbExpression';
export { composeLearningSentence, type LearningKind } from '@/services/ai/learningSentence';
export {
  EMOTION_BEATS,
  EMOTION_CYCLE_ORDER,
  isEmotionLearned,
  learnedFamilies,
  sequenceDuration,
} from '@/services/ai/emotionAnimations';
export { composeWeeklySummary } from '@/services/ai/weeklyNarrative';
export { stripEmDashes } from '@/utils/text';
