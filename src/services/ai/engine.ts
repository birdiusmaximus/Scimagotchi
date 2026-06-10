/** Barrel for the deterministic engine pieces — esbuild entry for the test bundle. */
export { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
export { routeMode, type ConversationMode, type ModeDecision } from '@/services/ai/modeRouter';
export { isDuplicateReply, varietyDirective, varietySignals } from '@/services/ai/responsePolicy';
export { evaluateStage, stageRank } from '@/services/ai/stage';
