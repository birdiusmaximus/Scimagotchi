/**
 * Weekly summary generation (brief §11.7). Character-led, no advice, no guilt for
 * a quiet week. Computed locally from the week's emotion events, conversations and
 * progress. The companion narrates what it learned — it never recommends.
 */

import { EMOTION_MAPS } from '@/data/emotionMaps';
import {
  conversationsRepo,
  emotionEventsRepo,
  emotionProgressRepo,
  weeklySummariesRepo,
} from '@/services/db/repos';
import type { EmotionFamilyId, WeeklySummary } from '@/types/models';
import { nowIso } from '@/utils/date';

const familyWord = (id: EmotionFamilyId) => EMOTION_MAPS[id].label.split(' ')[0].toLowerCase();

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function narrate(s: WeeklySummary): string {
  const hadActivity = s.checkin_count > 0 || s.emotions_introduced.length > 0;
  if (!hadActivity) {
    return 'I don’t have new feelings to reflect this week. That’s okay — I’m here when there’s something you want to name.';
  }

  const parts: string[] = [];
  if (s.emotions_first_shape.length) {
    parts.push(
      `This week, you helped me understand the first shape of ${joinList(s.emotions_first_shape.map(familyWord))}.`,
    );
  } else if (s.emotions_introduced.length) {
    parts.push(`This week, we started noticing ${joinList(s.emotions_introduced.map(familyWord))} together.`);
  }

  if (s.key_user_phrases.length) {
    const phrase = s.key_user_phrases[0].replace(/[\s.]+$/, '');
    parts.push(`You described it in your own words — “${phrase}.”`);
  }

  const checkins = `${s.checkin_count} ${s.checkin_count === 1 ? 'time' : 'times'}`;
  const n = s.key_user_phrases.length;
  const learned = n ? `, and I learned ${n} new ${n === 1 ? 'phrase' : 'phrases'} from you` : '';
  parts.push(`You checked in ${checkins}${learned}.`);

  return parts.join(' ');
}

export async function buildWeeklySummary(weekStart: Date): Promise<WeeklySummary> {
  const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const inWeek = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  };
  const pad = (x: number) => String(x).padStart(2, '0');

  const [events, convos, progress] = await Promise.all([
    emotionEventsRepo.all().catch(() => []),
    conversationsRepo.all().catch(() => []),
    emotionProgressRepo.all().catch(() => []),
  ]);

  const weekEvents = events.filter((e) => !e.do_not_store && e.emotion_family && inWeek(e.timestamp));
  const weekConvos = convos.filter((c) => inWeek(c.created_at));

  const families = [...new Set(weekEvents.map((e) => e.emotion_family))] as EmotionFamilyId[];
  const firstShape = progress
    .filter((p) => p.first_shape_at && inWeek(p.first_shape_at))
    .map((p) => p.emotion_family);
  const phrases = [...new Set(weekEvents.map((e) => e.user_words_raw).filter(Boolean))].slice(0, 4);

  const triggerCounts: Record<string, number> = {};
  weekEvents.forEach((e) => {
    if (e.trigger_event) triggerCounts[e.trigger_event] = (triggerCounts[e.trigger_event] ?? 0) + 1;
  });
  const repeated = Object.entries(triggerCounts)
    .filter(([, count]) => count >= 2)
    .map(([t]) => t);

  const summary: WeeklySummary = {
    id: `week_${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    week_start: start.toISOString(),
    week_end: end.toISOString(),
    generated_at: nowIso(),
    checkin_count: weekConvos.length,
    emotions_introduced: families,
    emotions_first_shape: firstShape,
    repeated_themes: repeated,
    key_user_phrases: phrases,
    companion_summary: '',
    pdf_export_path: null,
  };
  summary.companion_summary = narrate(summary);

  weeklySummariesRepo.save(summary).catch(() => {});
  return summary;
}
