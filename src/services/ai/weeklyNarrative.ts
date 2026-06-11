/**
 * Weekly summary narration (engine brief §17) — a compassionate mirror, never a
 * dashboard. Pure + deterministic (no repos, no React) so it can be bundled and
 * tested. The data-fetching orchestrator (weeklySummary.ts) feeds it.
 *
 * Hard rules encoded here:
 * - Lead from "the moments that stood out" whenever memory was kept this week.
 * - Always carry an honest caveat — never present sparse data as a whole week.
 * - No percentages, no "dominant mood", no "you only logged…", no guilt.
 */

import type { EmotionFamilyId, WeeklySummary } from '@/types/models';
import { stripEmDashes } from '@/utils/text';

const FAMILY_WORD: Record<EmotionFamilyId, string> = {
  joy: 'joy',
  calm: 'calm',
  fear: 'fear',
  pressure: 'pressure',
  anger: 'anger',
  sadness: 'sadness',
  hurt: 'hurt',
  shame: 'shame',
  flat: 'flatness',
};

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function trimEnd(s: string): string {
  return s.replace(/[\s.]+$/, '');
}

export interface WeeklyInput {
  id: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  checkinCount: number;
  /** Summaries of memories the user CHOSE to keep this week (the heart of §17). */
  savedSummaries: string[];
  /** User words from those saved memories. */
  savedUserWords: string[];
  emotionsIntroduced: EmotionFamilyId[];
  emotionsFirstShape: EmotionFamilyId[];
  deepenedPatterns: EmotionFamilyId[];
  /** Verbatim phrases from this week's events (fallback when nothing was saved). */
  eventPhrases: string[];
  repeatedThemes: string[];
}

function caveatFor(saved: number, checkins: number): string {
  if (saved > 0) return 'Based only on the moments that stood out, not your whole week.';
  if (checkins > 0) return 'Just a glimpse from a few check-ins, not the whole picture.';
  return 'Nothing stood out to keep this week. I’m here whenever there’s something you’d like to hold onto.';
}

export function composeWeeklySummary(input: WeeklyInput): WeeklySummary {
  const families = input.emotionsIntroduced.map((f) => FAMILY_WORD[f]);
  const hadActivity = input.checkinCount > 0 || families.length > 0 || input.savedSummaries.length > 0;

  const learning = input.savedSummaries[0] ?? null;

  let summary: string;
  if (!hadActivity) {
    summary =
      'I don’t have new feelings to reflect this week, and that’s okay. I’m here whenever there’s something you want to name.';
  } else {
    const parts: string[] = [];

    if (input.savedSummaries.length > 0) {
      parts.push(
        families.length
          ? `Based on the moments that stood out, ${joinList(families)} came up this week.`
          : 'Here are the moments that stood out this week.',
      );
    } else if (input.emotionsFirstShape.length) {
      parts.push(`This week, you helped me understand the first shape of ${joinList(input.emotionsFirstShape.map((f) => FAMILY_WORD[f]))}.`);
    } else if (families.length) {
      parts.push(`This week, we started noticing ${joinList(families)} together.`);
    }

    if (learning) parts.push(`I learned one shape I want to hold onto: ${trimEnd(learning)}.`);

    if (input.deepenedPatterns.length) {
      const dp = joinList(input.deepenedPatterns.map((f) => FAMILY_WORD[f]));
      parts.push(`And ${dp} is starting to feel familiar; we’ve met it more than once now.`);
    }

    summary = parts.join(' ');
  }
  summary = stripEmDashes(summary);
  const learningClean = learning ? stripEmDashes(learning) : null;

  const userPhrases = [...new Set([...input.savedUserWords, ...input.eventPhrases].map(trimEnd).filter(Boolean))].slice(0, 4);

  return {
    id: input.id,
    week_start: input.weekStart,
    week_end: input.weekEnd,
    generated_at: input.generatedAt,
    checkin_count: input.checkinCount,
    saved_count: input.savedSummaries.length,
    emotions_introduced: input.emotionsIntroduced,
    emotions_first_shape: input.emotionsFirstShape,
    deepened_patterns: input.deepenedPatterns,
    repeated_themes: input.repeatedThemes,
    key_user_phrases: userPhrases,
    companion_learning_statement: learningClean,
    companion_summary: summary,
    caveat: caveatFor(input.savedSummaries.length, input.checkinCount),
    pdf_export_path: null,
  };
}
