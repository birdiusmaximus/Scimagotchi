/**
 * Weekly summary orchestration (engine brief §17). Fetches the week's data —
 * led by the memories the user CHOSE to keep — and delegates the narration to
 * the pure composer (weeklyNarrative.ts). The companion reflects what it
 * learned; it never recommends, scores, or guilts a quiet week.
 */

import { composeWeeklySummary } from '@/services/ai/weeklyNarrative';
import {
  conversationsRepo,
  emotionEventsRepo,
  emotionProgressRepo,
  memoryCardsRepo,
  weeklySummariesRepo,
} from '@/services/db/repos';
import type { EmotionFamilyId, WeeklySummary } from '@/types/models';
import { nowIso } from '@/utils/date';

export async function buildWeeklySummary(weekStart: Date): Promise<WeeklySummary> {
  const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const inWeek = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  };
  const pad = (x: number) => String(x).padStart(2, '0');

  const [events, convos, progress, memories] = await Promise.all([
    emotionEventsRepo.all().catch(() => []),
    conversationsRepo.all().catch(() => []),
    emotionProgressRepo.all().catch(() => []),
    memoryCardsRepo.all().catch(() => []),
  ]);

  const weekEvents = events.filter((e) => !e.do_not_store && e.emotion_family && inWeek(e.timestamp));
  const weekConvos = convos.filter((c) => inWeek(c.created_at));

  // The moments the companion kept this week — the heart of the summary (§17.1).
  // Memory is now auto-learned at settled moments, so auto_learned cards count too.
  const savedThisWeek = memories.filter(
    (m) =>
      (m.confirmation_status === 'auto_learned' ||
        m.confirmation_status === 'user_confirmed' ||
        m.confirmation_status === 'user_edited') &&
      inWeek(m.created_at),
  );
  const savedSummaries = savedThisWeek.map((m) => m.summary).filter(Boolean);
  const savedUserWords = savedThisWeek.flatMap((m) => m.user_words).filter(Boolean);

  const emotionsIntroduced = [...new Set(weekEvents.map((e) => e.emotion_family))] as EmotionFamilyId[];
  const emotionsFirstShape = progress.filter((p) => inWeek(p.first_shape_at)).map((p) => p.emotion_family);
  const deepenedPatterns = progress
    .filter((p) => inWeek(p.deepened_at) || inWeek(p.returning_at))
    .map((p) => p.emotion_family);
  const eventPhrases = [...new Set(weekEvents.map((e) => e.user_words_raw).filter(Boolean))].slice(0, 4);

  const triggerCounts: Record<string, number> = {};
  weekEvents.forEach((e) => {
    if (e.trigger_event) triggerCounts[e.trigger_event] = (triggerCounts[e.trigger_event] ?? 0) + 1;
  });
  const repeatedThemes = Object.entries(triggerCounts)
    .filter(([, count]) => count >= 2)
    .map(([t]) => t);

  const summary = composeWeeklySummary({
    id: `week_${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    generatedAt: nowIso(),
    checkinCount: weekConvos.length,
    savedSummaries,
    savedUserWords,
    emotionsIntroduced,
    emotionsFirstShape,
    deepenedPatterns,
    eventPhrases,
    repeatedThemes,
  });

  weeklySummariesRepo.save(summary).catch(() => {});
  return summary;
}
