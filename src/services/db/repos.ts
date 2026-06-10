/**
 * Typed repositories over the persistence adapter. One module here stands in for
 * the per-table repo files in the brief's suggested structure; the surface is
 * intentionally small for v0.1.
 */

import { db } from '@/services/db/persistence';
import type {
  AppSettings,
  Conversation,
  EmotionEvent,
  EmotionProgress,
  MemoryCard,
  Message,
  SafetyEvent,
  WeeklySummary,
} from '@/types/models';
import { dayKey } from '@/utils/date';

export const conversationsRepo = {
  all: () => db().getAll<Conversation>('conversations'),
  get: (id: string) => db().getById<Conversation>('conversations', id),
  save: (c: Conversation) => db().put('conversations', c),
};

export const messagesRepo = {
  add: (m: Message) => db().put('messages', m),
  async listByConversation(conversationId: string): Promise<Message[]> {
    const all = await db().getAll<Message>('messages');
    return all
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
};

export const emotionEventsRepo = {
  upsert: (e: EmotionEvent) => db().put('emotion_events', e),
  get: (id: string) => db().getById<EmotionEvent>('emotion_events', id),
  all: () => db().getAll<EmotionEvent>('emotion_events'),
  async unlockedByDay(): Promise<Record<string, EmotionEvent[]>> {
    const all = await db().getAll<EmotionEvent>('emotion_events');
    const out: Record<string, EmotionEvent[]> = {};
    for (const e of all) {
      if (e.do_not_store) continue;
      const key = dayKey(e.timestamp);
      (out[key] ??= []).push(e);
    }
    return out;
  },
};

export const emotionProgressRepo = {
  all: () => db().getAll<EmotionProgress>('emotion_progress'),
  get: (familyId: string) => db().getById<EmotionProgress>('emotion_progress', familyId),
  save: (p: EmotionProgress) => db().put('emotion_progress', p),
};

export const safetyEventsRepo = {
  add: (s: SafetyEvent) => db().put('safety_events', s),
  all: () => db().getAll<SafetyEvent>('safety_events'),
};

export const memoryCardsRepo = {
  save: (c: MemoryCard) => db().put('memory_cards', c),
  get: (id: string) => db().getById<MemoryCard>('memory_cards', id),
  all: () => db().getAll<MemoryCard>('memory_cards'),
  remove: (id: string) => db().remove('memory_cards', id),
};

export const weeklySummariesRepo = {
  save: (w: WeeklySummary) => db().put('weekly_summaries', w),
  get: (id: string) => db().getById<WeeklySummary>('weekly_summaries', id),
  all: () => db().getAll<WeeklySummary>('weekly_summaries'),
};

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    return (await db().getById<AppSettings>('app_settings', 'app')) ?? { id: 'app' };
  },
  save: (s: AppSettings) => db().put('app_settings', { ...s, id: 'app' }),
};

export async function clearAllData(): Promise<void> {
  await db().clearAll();
}
