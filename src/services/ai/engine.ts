/** Barrel for the deterministic engine pieces — esbuild entry for the test bundle. */
export { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
export { intentDecision, routeMode, type ChipIntent, type ConversationMode, type ModeDecision } from '@/services/ai/modeRouter';
export {
  askedForNamingHelp,
  doorwayOf,
  dropTrailingQuestion,
  EXIT_CUE,
  isDuplicateReply,
  isOptionMenu,
  isTentativeReply,
  offersOffRamp,
  replaceOptionMenu,
  repeatsEarlierQuestion,
  repeatsRecentReflection,
  stripEchoedSentences,
  stripOffRamp,
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
  isClarifyingQuestion,
  isUncertain,
  labelIsUserOwned,
  labelNamedByUser,
  shadeIsUserOwned,
  SLOW_PATH_FAMILIES,
  stageRank,
  userConfirmsLabel,
} from '@/services/ai/stage';
export { activeCards, draftFromRejection, draftFromTurn, memoryBlocked, relevantMemory, scrubForMemory } from '@/services/memoryLedger';
export { advanceProgress, advanceStrands, emptyProgress, migrateStage, PROGRESS_RANK, turnStrandFamilies } from '@/services/ai/progressionEngine';
export { buildLedger, hasUserOwnedConcreteDetail, userHasOriginated, intenseUserWord, INTENSE_FEELING, SOFTENING_CUE, type EvidenceLedger } from '@/services/ai/evidenceLedger';
export { classifyMoments, type MomentType } from '@/services/ai/momentType';
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
export { composeLearningSentence, summaryIsClean, IDENTITY_CONDEMNATION, type LearningKind } from '@/services/ai/learningSentence';
export {
  EMOTION_BEATS,
  EMOTION_CYCLE_ORDER,
  isEmotionLearned,
  learnedFamilies,
  sequenceDuration,
} from '@/services/ai/emotionAnimations';
export { composeWeeklySummary } from '@/services/ai/weeklyNarrative';
export { stripControlChars, stripEmDashes } from '@/utils/text';
