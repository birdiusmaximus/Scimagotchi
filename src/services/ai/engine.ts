/** Barrel for the deterministic engine pieces — esbuild entry for the test bundle. */
export { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
export { routeMode, type ConversationMode, type ModeDecision } from '@/services/ai/modeRouter';
export { isDuplicateReply, varietyDirective, varietySignals } from '@/services/ai/responsePolicy';
export { evaluateStage, stageRank } from '@/services/ai/stage';
export { activeCards, draftFromRejection, draftFromTurn, memoryBlocked, relevantMemory } from '@/services/memoryLedger';
export { advanceProgress, emptyProgress, migrateStage, PROGRESS_RANK } from '@/services/ai/progressionEngine';
export { selectVisualState, visualTintFamilies, type CompanionVisualState } from '@/services/ai/companionVisualState';
export { composeWeeklySummary } from '@/services/ai/weeklyNarrative';
