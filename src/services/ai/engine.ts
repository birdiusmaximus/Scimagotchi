/** Barrel for the deterministic engine pieces — esbuild entry for the test bundle. */
export { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
export { routeMode, type ConversationMode, type ModeDecision } from '@/services/ai/modeRouter';
export { dropTrailingQuestion, isDuplicateReply, varietyDirective, varietySignals } from '@/services/ai/responsePolicy';
export {
  needsOwnershipRepair,
  replyContainsDeclarativeEmotionAssertion,
  softenUnownedEmotionReply,
} from '@/services/ai/replyOwnership';
export { evaluateStage, labelIsUserOwned, stageRank, userConfirmsLabel } from '@/services/ai/stage';
export { activeCards, draftFromRejection, draftFromTurn, memoryBlocked, relevantMemory } from '@/services/memoryLedger';
export { advanceProgress, emptyProgress, migrateStage, PROGRESS_RANK } from '@/services/ai/progressionEngine';
export { selectVisualState, visualTintFamilies, type CompanionVisualState } from '@/services/ai/companionVisualState';
export { expressionFor } from '@/services/ai/orbExpression';
export { composeWeeklySummary } from '@/services/ai/weeklyNarrative';
export { stripEmDashes } from '@/utils/text';
